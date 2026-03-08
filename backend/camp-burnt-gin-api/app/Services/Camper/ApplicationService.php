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
 * Service for managing application business logic.
 *
 * Handles complex application workflows including approval, rejection,
 * and compliance validation for camp registrations.
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
     * Review and update application status with full workflow.
     *
     * Handles:
     * - Document compliance validation before approval
     * - Status updates
     * - User notifications
     * - Acceptance/rejection letter generation
     *
     * @return array{success: bool, compliance_details?: array}
     */
    public function reviewApplication(
        Application $application,
        ApplicationStatus $newStatus,
        ?string $notes,
        User $reviewedBy
    ): array {
        $previousStatus = $application->status->value;

        // CRITICAL SAFETY CHECK: Enforce document compliance before approval.
        // Admins and super-admins may override this check to unblock borderline cases.
        if ($newStatus === ApplicationStatus::Approved && ! $reviewedBy->isAdmin() && ! $reviewedBy->isSuperAdmin()) {
            $application->loadMissing('camper');
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

        // Guarantee the camper has a medical record before approval is finalised.
        // The application form normally creates one during submission, but this
        // firstOrCreate is a safety net for any path that bypassed that step.
        if ($newStatus === ApplicationStatus::Approved) {
            $application->loadMissing('camper');
            MedicalRecord::firstOrCreate(
                ['camper_id' => $application->camper->id],
            );
        }

        // Update application status
        $application->update([
            'status' => $newStatus,
            'notes' => $notes,
            'reviewed_at' => now(),
            'reviewed_by' => $reviewedBy->id,
        ]);

        // Send status change notification (email + database)
        $application->loadMissing('camper.user');
        $parentUser  = $application->camper->user;
        $camperName  = $application->camper->first_name . ' ' . $application->camper->last_name;

        $this->queueNotification(
            $parentUser,
            new ApplicationStatusChangedNotification($application, $previousStatus)
        );

        // Send in-app system notification in the inbox System tab
        match ($newStatus) {
            ApplicationStatus::Approved => $this->systemNotifications->applicationApproved(
                $parentUser, $application->id, $camperName
            ),
            ApplicationStatus::Rejected => $this->systemNotifications->applicationRejected(
                $parentUser, $application->id, $camperName, $notes
            ),
            default => $this->systemNotifications->applicationStatusChanged(
                $parentUser, $application->id, $camperName, $newStatus->value
            ),
        };

        // Send appropriate letter based on status
        if ($application->status === ApplicationStatus::Approved) {
            $this->letterService->sendAcceptanceLetter($application);
        } elseif ($application->status === ApplicationStatus::Rejected) {
            $this->letterService->sendRejectionLetter($application);
        }

        return ['success' => true];
    }
}
