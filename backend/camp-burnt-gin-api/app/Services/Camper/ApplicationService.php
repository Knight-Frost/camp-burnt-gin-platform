<?php

namespace App\Services\Camper;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\MedicalRecord;
use App\Models\User;
use App\Notifications\Camper\ApplicationStatusChangedNotification;
use App\Services\Document\DocumentEnforcementService;
use App\Services\System\LetterService;
use App\Services\SystemNotificationService;
use App\Traits\QueuesNotifications;

/**
 * ApplicationService — Camp Application Review Workflow
 *
 * This service coordinates everything that happens when an admin reviews a
 * camp application and changes its status (e.g. Pending → Approved, or → Rejected).
 *
 * It sits between the ApplicationController and the various subsystems (documents,
 * letters, notifications) so the controller only needs one method call to trigger
 * the entire review workflow.
 *
 * Responsibilities:
 *  - Enforce document compliance before non-admin users can approve
 *  - Guarantee a medical record exists for the camper before approval is finalised
 *  - Persist the new status, reviewer, and notes to the database
 *  - Send email + database notifications to the parent
 *  - Send a matching in-app system notification to the parent's inbox
 *  - Generate and email the appropriate acceptance or rejection letter
 *
 * Connected services:
 *  - DocumentEnforcementService: checks that required documents are uploaded and verified
 *  - LetterService:              generates and sends acceptance/rejection letters
 *  - SystemNotificationService:  creates system-generated inbox messages for the parent
 */
class ApplicationService
{
    // This trait provides the queueNotification() helper used for email notifications
    use QueuesNotifications;

    /**
     * Inject the three services this class depends on via constructor injection.
     * Laravel's service container resolves and provides these automatically.
     */
    public function __construct(
        protected DocumentEnforcementService $documentEnforcement,
        protected LetterService $letterService,
        protected SystemNotificationService $systemNotifications,
    ) {}

    /**
     * Review an application: validate compliance, update status, and trigger all follow-up actions.
     *
     * This is the single entry point for the entire application-review workflow.
     * Calling this one method handles everything a reviewer needs to do.
     *
     * Step-by-step flow:
     *  1. (Non-admin only) Run document compliance check — block approval if documents are missing
     *  2. Ensure the camper has a medical record (create one if missing)
     *  3. Persist the new status, notes, reviewer, and timestamp
     *  4. Send a status-change email notification to the parent
     *  5. Send an in-app system notification to the parent's inbox
     *  6. Send an acceptance or rejection letter if the status warrants one
     *
     * @param  Application        $application  The application being reviewed
     * @param  ApplicationStatus  $newStatus    The status to change to (Approved, Rejected, etc.)
     * @param  string|null        $notes        Optional reviewer notes attached to the record
     * @param  User               $reviewedBy   The admin or super-admin performing the review
     * @return array{success: bool, compliance_details?: array}
     */
    public function reviewApplication(
        Application $application,
        ApplicationStatus $newStatus,
        ?string $notes,
        User $reviewedBy
    ): array {
        // Capture the current status before we change it (used in the notification later)
        $previousStatus = $application->status->value;

        // ── Step 0: Capacity gate ─────────────────────────────────────────────────
        // Block approval when the session is already at or over capacity.
        // This is checked before the document compliance gate so admins see the most
        // actionable error first (capacity is a session-level constraint; document
        // compliance is per-camper and can be resolved without admin intervention).
        if ($newStatus === ApplicationStatus::Approved) {
            $application->loadMissing('campSession');
            if ($application->campSession && $application->campSession->isAtCapacity()) {
                return [
                    'success'           => false,
                    'capacity_exceeded' => true,
                    'session_name'      => $application->campSession->name,
                    'capacity'          => $application->campSession->capacity,
                    'enrolled'          => $application->campSession->enrolled_count,
                ];
            }
        }

        // ── Step 1: Document compliance gate ────────────────────────────────────
        // CRITICAL SAFETY CHECK: All reviewers (including admins) are blocked if documents
        // are missing, expired, or unverified. This enforces medical compliance before approval.
        if ($newStatus === ApplicationStatus::Approved) {
            // Load the camper relationship if it hasn't been loaded yet
            $application->loadMissing('camper');
            $compliance = $this->documentEnforcement->checkCompliance($application->camper);

            // If required documents are missing, expired, or unverified — block the approval
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

        // ── Step 2: Create the medical record at the moment of approval ─────────
        // This is the sole point in the system where a medical record is created.
        // Submitting an application intentionally does NOT create a medical record —
        // the record must only exist for campers whose application has been accepted.
        // firstOrCreate is used so retried approvals remain idempotent.
        if ($newStatus === ApplicationStatus::Approved) {
            $application->loadMissing('camper');
            MedicalRecord::firstOrCreate(
                ['camper_id' => $application->camper->id],
            );
        }

        // ── Step 3: Persist the review decision to the database ──────────────────
        $application->update([
            'status' => $newStatus,
            'notes' => $notes,
            'reviewed_at' => now(),
            'reviewed_by' => $reviewedBy->id,
        ]);

        // ── Step 4: Email notification to the parent ─────────────────────────────
        // Load the parent user and camper name for use in notifications and letters
        $application->loadMissing('camper.user');
        $parentUser  = $application->camper->user;
        $camperName  = $application->camper->first_name . ' ' . $application->camper->last_name;

        // queueNotification() (from QueuesNotifications trait) sends the email after the response
        $this->queueNotification(
            $parentUser,
            new ApplicationStatusChangedNotification($application, $previousStatus)
        );

        // ── Step 5: In-app inbox notification ───────────────────────────────────
        // Use match to call the most specific notification method based on the new status
        match ($newStatus) {
            ApplicationStatus::Approved => $this->systemNotifications->applicationApproved(
                $parentUser, $application->id, $camperName
            ),
            ApplicationStatus::Rejected => $this->systemNotifications->applicationRejected(
                $parentUser, $application->id, $camperName, $notes
            ),
            // For any other status use the generic change notification
            default => $this->systemNotifications->applicationStatusChanged(
                $parentUser, $application->id, $camperName, $newStatus->value
            ),
        };

        // ── Step 6: Send the formal decision letter ──────────────────────────────
        // Note: we read $application->status (the freshly updated enum value) here
        if ($application->status === ApplicationStatus::Approved) {
            $this->letterService->sendAcceptanceLetter($application);
        } elseif ($application->status === ApplicationStatus::Rejected) {
            $this->letterService->sendRejectionLetter($application);
        }

        return ['success' => true];
    }
}
