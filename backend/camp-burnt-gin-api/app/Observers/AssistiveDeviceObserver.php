<?php

namespace App\Observers;

use App\Models\AssistiveDevice;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;

/**
 * Observer for AssistiveDevice model changes.
 *
 * Triggers risk reassessment when assistive devices are added,
 * modified, or removed, particularly when transfer assistance
 * requirements change which impact staffing and risk scoring.
 */
class AssistiveDeviceObserver
{
    /**
     * Handle the AssistiveDevice "saved" event.
     *
     * Reassesses risk when an assistive device is created or updated,
     * as transfer assistance requirements contribute to risk scoring
     * and may affect supervision needs.
     */
    public function saved(AssistiveDevice $assistiveDevice): void
    {
        $camper = $assistiveDevice->camper;

        if ($camper) {
            app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
        }
    }

    /**
     * Handle the AssistiveDevice "deleted" event.
     *
     * Reassesses risk when an assistive device is removed, as this
     * may reduce transfer assistance requirements and potentially
     * lower the camper's overall risk score.
     */
    public function deleted(AssistiveDevice $assistiveDevice): void
    {
        $camper = $assistiveDevice->camper;

        if ($camper) {
            app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
        }
    }
}
