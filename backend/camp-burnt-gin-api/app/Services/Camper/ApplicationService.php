<?php

namespace App\Services\Camper;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\AuditLog;
use App\Models\MedicalRecord;
use App\Models\User;
use App\Notifications\Camper\ApplicationStatusChangedNotification;
use App\Notifications\Camper\WaitlistedNotification;
use App\Services\Document\DocumentEnforcementService;
use App\Services\System\LetterService;
use App\Services\SystemNotificationService;
use App\Traits\QueuesNotifications;
use Illuminate\Support\Facades\DB;

/**
 * Sentinel exception raised when the locked in-transaction capacity re-check
 * detects that the session just filled up. Caught by reviewApplication() to
 * return a structured error instead of leaking as a 500.
 */
class CapacityRaceException extends \RuntimeException {}

/**
 * ApplicationService — Camp Application Review Workflow
 *
 * This service is the single authoritative entry point for every admin-initiated
 * status change on a camp application. It enforces the complete approval and
 * reversal workflow, including camper activation/deactivation, medical record
 * lifecycle management, audit logging, and notification dispatch.
 *
 * Workflow summary:
 *
 *   Approval (any state → Approved):
 *     1. Validate the state transition.
 *     2. Check session capacity.
 *     3. Check document compliance.
 *     4. Inside a DB transaction:
 *          a. Update application status, reviewer, and timestamp.
 *          b. Set camper.is_active = true.
 *          c. Create the medical record if absent, then set is_active = true.
 *          d. Write an audit log entry.
 *     5. Post-commit: dispatch email notification, inbox message, acceptance letter.
 *
 *   Reversal (Approved → Rejected or Cancelled):
 *     1. Validate the state transition.
 *     2. Inside a DB transaction:
 *          a. Update application status, reviewer, and timestamp.
 *          b. If no other approved application exists for the camper:
 *               — Set camper.is_active = false.
 *               — Set medical_record.is_active = false.
 *          c. Write an audit log entry.
 *     3. Post-commit: dispatch email notification, inbox message, rejection letter.
 *
 *   Other transitions (e.g. Pending → UnderReview, Waitlisted → Rejected):
 *     1. Validate the state transition.
 *     2. Inside a DB transaction:
 *          a. Update application status, reviewer, and timestamp.
 *          b. Write an audit log entry.
 *     3. Post-commit: dispatch status-change notification.
 *
 * Transactional guarantee:
 *   All database writes (application update, camper activation/deactivation,
 *   medical record activation/deactivation, audit log) are wrapped in a single
 *   DB::transaction(). If any write fails, all changes are rolled back and the
 *   system remains in its previous consistent state. Notification dispatch occurs
 *   only after the transaction has successfully committed.
 *
 * Non-duplication guarantee:
 *   MedicalRecord::firstOrCreate() ensures only one medical record can exist per
 *   camper, regardless of how many times approval is granted or reversed and
 *   re-granted. Activation and deactivation are idempotent updates.
 */
class ApplicationService
{
    use QueuesNotifications;

    public function __construct(
        protected DocumentEnforcementService $documentEnforcement,
        protected LetterService $letterService,
        protected SystemNotificationService $systemNotifications,
    ) {}

    /**
     * Execute the full review workflow for a single application status change.
     *
     * This method is the single entry point for all admin review actions.
     * It validates, persists, activates/deactivates operational records, writes
     * the audit log, and dispatches post-commit notifications.
     *
     * @param  Application  $application  The application being reviewed.
     * @param  ApplicationStatus  $newStatus  The target status.
     * @param  string|null  $notes  Optional reviewer notes.
     * @param  User  $reviewedBy  The admin performing the review.
     * @param  bool  $overrideIncomplete  True when admin explicitly approved despite missing data.
     * @param  array  $missingSummary  Structured list of what was missing at approval time.
     * @return array{
     *   success: bool,
     *   draft_not_reviewable?: bool,
     *   invalid_transition?: bool,
     *   capacity_exceeded?: bool,
     *   session_name?: string,
     *   capacity?: int,
     *   enrolled?: int,
     *   compliance_details?: array
     * }
     */
    public function reviewApplication(
        Application $application,
        ApplicationStatus $newStatus,
        ?string $notes,
        User $reviewedBy,
        bool $overrideIncomplete = false,
        array $missingSummary = [],
    ): array {
        // Draft applications are not officially submitted and must never receive
        // review decisions. The policy layer enforces this, but we guard here too
        // so that any internal call path (e.g., admin-on-behalf) is also safe.
        if ($application->is_draft) {
            return ['success' => false, 'draft_not_reviewable' => true];
        }

        // Capture the current status before any mutation occurs.
        $previousStatus = $application->status;

        // ── State transition validation ───────────────────────────────────────
        // Enforce the authoritative transition table defined in ApplicationStatus.
        // An invalid transition is rejected immediately before any I/O.
        if (! $previousStatus->canTransitionTo($newStatus)) {
            return [
                'success' => false,
                'invalid_transition' => true,
            ];
        }

        // Load relationships needed for both pre-flight checks and post-commit
        // side effects. Loading here (before the transaction) avoids triggering
        // lazy loads inside the atomic block.
        $application->loadMissing('camper.user', 'campSession');

        // ── Approval pre-flight checks (outside the transaction) ─────────────
        // These checks are read-only and do not modify state. Running them before
        // the transaction keeps the transaction scope as narrow as possible.
        if ($newStatus === ApplicationStatus::Approved) {
            // Step 0: Capacity gate — block approval when the session is full.
            if ($application->campSession && $application->campSession->isAtCapacity()) {
                return [
                    'success' => false,
                    'capacity_exceeded' => true,
                    'session_name' => $application->campSession->name,
                    'capacity' => $application->campSession->capacity,
                    'enrolled' => $application->campSession->enrolled_count,
                ];
            }

            // Step 1: Document compliance gate.
            // When the admin has NOT overridden the completeness warning, enforce compliance
            // as a hard block. When $overrideIncomplete is true, the admin has already seen
            // and acknowledged the missing data via the warning modal — proceed regardless.
            if (! $overrideIncomplete) {
                $compliance = $this->documentEnforcement->checkCompliance($application->camper);
                if (! $compliance['is_compliant']) {
                    return [
                        'success' => false,
                        'compliance_details' => [
                            'missing_documents' => $compliance['missing_documents'],
                            'expired_documents' => $compliance['expired_documents'],
                            'unverified_documents' => $compliance['unverified_documents'],
                        ],
                    ];
                }
            }
        }

        // ── Atomic database mutations ─────────────────────────────────────────
        // All writes are wrapped in a single transaction. If any step fails, the
        // entire block is rolled back and the system remains in its prior state.
        // Capacity-race detection uses a sentinel exception (defined below) so
        // an empty/no-op transaction doesn't accidentally commit.
        $capacityRaceResult = null;

        try {
            DB::transaction(function () use (
                $application,
                $newStatus,
                $notes,
                $reviewedBy,
                $previousStatus,
                $overrideIncomplete,
                $missingSummary,
                &$capacityRaceResult,
            ) {
                // Step 1b: Re-check capacity inside the transaction under a row-level
                // lock. Two admins approving the last spot at the same time can BOTH
                // pass the outer pre-flight check above; without this lock they would
                // both commit and the session enrolled_count would exceed capacity.
                // lockForUpdate serialises the two transactions so the second one
                // sees the updated enrollment and bails out cleanly.
                if ($newStatus === ApplicationStatus::Approved && $application->camp_session_id !== null) {
                    $session = \App\Models\CampSession::whereKey($application->camp_session_id)
                        ->lockForUpdate()
                        ->first();

                    if ($session && $session->isAtCapacity()) {
                        $capacityRaceResult = [
                            'success' => false,
                            'capacity_exceeded' => true,
                            'session_name' => $session->name,
                            'capacity' => $session->capacity,
                            'enrolled' => $session->enrolled_count,
                        ];

                        // Abort the transaction without writing anything.
                        throw new CapacityRaceException;
                    }
                }

                // Step 2: Persist the review decision.
                $updateData = [
                    'status' => $newStatus,
                    'notes' => $notes,
                    'reviewed_at' => now(),
                    'reviewed_by' => $reviewedBy->id,
                ];

                // Flag the application when it was approved despite known missing data.
                // This flag persists so future admins can see the application was incomplete at approval.
                if ($overrideIncomplete && $newStatus === ApplicationStatus::Approved) {
                    $updateData['is_incomplete_at_approval'] = true;
                }

                $application->update($updateData);

                // Step 3: Approval path — activate camper and medical record.
                if ($newStatus === ApplicationStatus::Approved) {
                    // Mark the camper as operationally active.
                    $application->camper->update(['is_active' => true]);

                    // Create the medical record if it does not exist (first approval),
                    // then ensure it is active. firstOrCreate is idempotent across
                    // repeated approve → reverse → approve cycles.
                    $medicalRecord = MedicalRecord::firstOrCreate(
                        ['camper_id' => $application->camper_id]
                    );
                    $medicalRecord->update(['is_active' => true]);
                }

                // Step 4: Reversal path — conditionally deactivate camper and medical record.
                // A reversal occurs when a previously approved application is moved to
                // rejected or cancelled. Deactivation only applies when the camper has
                // no other currently approved application for a different session.
                $isReversal = $previousStatus === ApplicationStatus::Approved
                    && in_array($newStatus, [ApplicationStatus::Rejected, ApplicationStatus::Cancelled]);

                if ($isReversal) {
                    $hasOtherApprovedApplication = Application::where('camper_id', $application->camper_id)
                        ->where('id', '!=', $application->id)
                        ->where('status', ApplicationStatus::Approved->value)
                        ->exists();

                    if (! $hasOtherApprovedApplication) {
                        // No other approved enrollment — remove the camper from operational views.
                        $application->camper->update(['is_active' => false]);

                        // Deactivate the associated medical record without deleting it.
                        // The record is retained for HIPAA audit and record-retention compliance.
                        MedicalRecord::where('camper_id', $application->camper_id)
                            ->update(['is_active' => false]);
                    }
                }

                // Step 5: Write an immutable audit log entry for this review action.
                // When the admin overrode the completeness warning, the action key and
                // description make this explicit, and the missing_at_approval metadata
                // records exactly what was missing so it is never silently lost.
                $auditMetadata = [
                    'application_id' => $application->id,
                    'camper_id' => $application->camper_id,
                    'previous_status' => $previousStatus->value,
                    'new_status' => $newStatus->value,
                    'notes' => $notes,
                ];

                if ($overrideIncomplete && ! empty($missingSummary)) {
                    $auditMetadata['forced_approval_with_missing'] = true;
                    $auditMetadata['missing_at_approval'] = $missingSummary;
                }

                $auditAction = ($overrideIncomplete && $newStatus === ApplicationStatus::Approved)
                    ? 'application.approved.override'
                    : "application.{$newStatus->value}";

                $auditDescription = ($overrideIncomplete && $newStatus === ApplicationStatus::Approved)
                    ? "Application #{$application->id} FORCE APPROVED with missing data by admin #{$reviewedBy->id}. "
                      ."Previous status: {$previousStatus->value}."
                    : "Application #{$application->id} status changed from {$previousStatus->value} to {$newStatus->value}.";

                AuditLog::logAdminAction(
                    action: $auditAction,
                    user: $reviewedBy,
                    description: $auditDescription,
                    metadata: $auditMetadata,
                );
            });
        } catch (CapacityRaceException) {
            // Another admin just took the last spot between the pre-flight and
            // the locked re-check. Return the same error shape as the pre-flight.
            return $capacityRaceResult ?? ['success' => false, 'capacity_exceeded' => true];
        }

        // ── Post-commit side effects ──────────────────────────────────────────
        // Notifications and letters are dispatched only after the transaction has
        // committed successfully. If the transaction were to roll back, these
        // would not execute.
        /** @var \App\Models\User $parentUser */
        $parentUser = $application->camper->user;
        $camperName = $application->camper->first_name.' '.$application->camper->last_name;

        // Dispatch the status notification.
        // Approved/rejected: database-only bell — the formal acceptance/rejection letter
        //   handles the email, so we avoid sending the parent two emails.
        // Waitlisted: dedicated notification with proper waitlist context.
        // All other transitions: standard queued status change notification (mail + database).
        if (in_array($newStatus, [ApplicationStatus::Approved, ApplicationStatus::Rejected])) {
            $parentUser->notifyNow(
                ApplicationStatusChangedNotification::forDatabase($application, $previousStatus->value)
            );
        } elseif ($newStatus === ApplicationStatus::Waitlisted) {
            $this->queueNotification($parentUser, new WaitlistedNotification($application));
        } else {
            $this->queueNotification(
                $parentUser,
                new ApplicationStatusChangedNotification($application, $previousStatus->value)
            );
        }

        // Dispatch the most specific in-app inbox message for the new status.
        // Cancelled → bespoke message with reason. UnderReview transitions
        // from Cancelled → bespoke "reinstated" message so the parent isn't
        // confused by a status that just says "under review" again.
        $isReinstatement = $previousStatus === ApplicationStatus::Cancelled
            && $newStatus === ApplicationStatus::UnderReview;

        match (true) {
            $newStatus === ApplicationStatus::Approved => $this->systemNotifications->applicationApproved(
                $parentUser, $application->id, $camperName
            ),
            $newStatus === ApplicationStatus::Rejected => $this->systemNotifications->applicationRejected(
                $parentUser, $application->id, $camperName, $notes
            ),
            $newStatus === ApplicationStatus::Cancelled => $this->systemNotifications->applicationCancelled(
                $parentUser, $application->id, $camperName, $notes
            ),
            $isReinstatement => $this->systemNotifications->applicationReinstated(
                $parentUser, $application->id, $camperName
            ),
            default => $this->systemNotifications->applicationStatusChanged(
                $parentUser, $application->id, $camperName, $newStatus->value
            ),
        };

        // Send the formal decision letter for approval and rejection decisions.
        if ($newStatus === ApplicationStatus::Approved) {
            $this->letterService->sendAcceptanceLetter($application);
        } elseif ($newStatus === ApplicationStatus::Rejected) {
            $this->letterService->sendRejectionLetter($application);
        }

        return ['success' => true];
    }

    /**
     * Clone an existing application into a new draft for reapplication.
     *
     * Creates a new draft Application that references the same camper and
     * records the source application's ID in reapplied_from_id. The clone
     * starts with no session (the parent must select one), no status data,
     * and no signature — it is a blank draft tied to the same camper.
     *
     * The camper's existing medical, behavioral, and equipment data is already
     * on file; the parent reviews and submits the new application as a fresh
     * cycle for a new camp session.
     *
     * @param  Application  $source  The application being reapplied from.
     * @param  User  $requestedBy  The parent initiating the reapplication.
     * @return Application The new draft application.
     */
    public function cloneApplication(Application $source, User $requestedBy): Application
    {
        // Verify the requesting user owns the camper this application belongs to.
        // Admins are always permitted. For parents, the camper must belong to them.
        if (! $requestedBy->isAdmin()) {
            $ownerUserId = $source->camper->user_id ?? $source->camper()->value('user_id');
            if ((int) $ownerUserId !== (int) $requestedBy->id) {
                throw new \Illuminate\Auth\Access\AuthorizationException(
                    'You may only reapply for your own campers.'
                );
            }
        }

        return DB::transaction(function () use ($source, $requestedBy) {
            $draft = Application::create([
                'camper_id' => $source->camper_id,
                'reapplied_from_id' => $source->id,
                'status' => \App\Enums\ApplicationStatus::Submitted,
                'is_draft' => true,
                'form_definition_id' => \App\Models\FormDefinition::where('status', 'active')->value('id'),
            ]);

            AuditLog::logAdminAction(
                action: 'application.reapply',
                user: $requestedBy,
                description: "Draft application #{$draft->id} created as reapplication from "
                             ."application #{$source->id} by user #{$requestedBy->id}.",
                metadata: [
                    'new_application_id' => $draft->id,
                    'source_application_id' => $source->id,
                    'camper_id' => $source->camper_id,
                ]
            );

            return $draft;
        });
    }

    /**
     * Execute a parent-initiated application withdrawal.
     *
     * This method is the entry point for all parent withdrawal actions. It sets the
     * application status to Withdrawn, conditionally deactivates the camper and medical
     * record if the application was previously approved, writes an audit log entry,
     * and dispatches post-commit notifications.
     *
     * Deactivation follows the same multi-session safety rule as admin reversal: the
     * camper is only deactivated when no other approved application exists for them.
     *
     * @param  Application  $application  The application being withdrawn.
     * @param  User  $withdrawnBy  The parent performing the withdrawal.
     * @return array{success: bool, already_withdrawn?: bool, not_withdrawable?: bool}
     */
    public function withdrawApplication(Application $application, User $withdrawnBy): array
    {
        $previousStatus = $application->status;

        // Idempotency guard: a second Withdraw on the same application must not
        // re-write the audit log, re-fire notifications, or silently appear to
        // succeed. The ApplicationPolicy blocks this at the HTTP layer, but a
        // service-layer check protects internal call paths (batch operations,
        // admin-on-behalf flows) from producing bogus audit entries.
        if ($previousStatus === ApplicationStatus::Withdrawn) {
            return ['success' => false, 'already_withdrawn' => true];
        }

        // Withdrawal is only meaningful while the application is in an active
        // state. Rejected/cancelled applications should not become "withdrawn".
        $withdrawableFrom = [
            ApplicationStatus::Submitted,
            ApplicationStatus::UnderReview,
            ApplicationStatus::Approved,
            ApplicationStatus::Waitlisted,
        ];
        if (! in_array($previousStatus, $withdrawableFrom, true)) {
            return ['success' => false, 'not_withdrawable' => true];
        }

        $application->loadMissing('camper.user', 'campSession');

        DB::transaction(function () use ($application, $previousStatus, $withdrawnBy) {
            $application->update([
                'status' => ApplicationStatus::Withdrawn,
            ]);

            // If the application was approved, apply the same conditional deactivation
            // logic as admin reversal — only deactivate if no other session is active.
            if ($previousStatus === ApplicationStatus::Approved) {
                $hasOtherApprovedApplication = Application::where('camper_id', $application->camper_id)
                    ->where('id', '!=', $application->id)
                    ->where('status', ApplicationStatus::Approved->value)
                    ->exists();

                if (! $hasOtherApprovedApplication) {
                    $application->camper->update(['is_active' => false]);

                    MedicalRecord::where('camper_id', $application->camper_id)
                        ->update(['is_active' => false]);
                }
            }

            AuditLog::logAdminAction(
                action: 'application.withdrawn',
                user: $withdrawnBy,
                description: "Application #{$application->id} withdrawn by parent "
                             ."(user #{$withdrawnBy->id}). Previous status: {$previousStatus->value}.",
                metadata: [
                    'application_id' => $application->id,
                    'camper_id' => $application->camper_id,
                    'previous_status' => $previousStatus->value,
                    'new_status' => ApplicationStatus::Withdrawn->value,
                ]
            );
        });

        $parentUser = $application->camper->user;
        $camperName = $application->camper->first_name.' '.$application->camper->last_name;

        // Confirm the withdrawal to the parent via in-app inbox.
        $this->systemNotifications->applicationStatusChanged(
            $parentUser, $application->id, $camperName, ApplicationStatus::Withdrawn->value
        );

        return ['success' => true];
    }
}
