<?php

namespace App\Services;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\User;
use App\Notifications\ApplicationStatusChangedNotification;
use Illuminate\Support\Facades\Notification;

/**
 * Service for managing application business logic.
 *
 * Handles complex application workflows including approval, rejection,
 * and compliance validation for camp registrations.
 */
class ApplicationService
{
    public function __construct(
        protected DocumentEnforcementService $documentEnforcement,
        protected LetterService $letterService
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

        // CRITICAL SAFETY CHECK: Enforce document compliance before approval
        if ($newStatus === ApplicationStatus::Approved) {
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

        // Update application status
        $application->update([
            'status' => $newStatus,
            'notes' => $notes,
            'reviewed_at' => now(),
            'reviewed_by' => $reviewedBy->id,
        ]);

        // Send status change notification
        $application->loadMissing('camper.user');
        Notification::send(
            $application->camper->user,
            new ApplicationStatusChangedNotification($application, $previousStatus)
        );

        // Send appropriate letter based on status
        if ($application->status === ApplicationStatus::Approved) {
            $this->letterService->sendAcceptanceLetter($application);
        } elseif ($application->status === ApplicationStatus::Rejected) {
            $this->letterService->sendRejectionLetter($application);
        }

        return ['success' => true];
    }
}
