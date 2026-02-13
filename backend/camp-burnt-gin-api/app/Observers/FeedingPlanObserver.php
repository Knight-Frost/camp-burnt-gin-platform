<?php

namespace App\Observers;

use App\Models\FeedingPlan;
use App\Services\SpecialNeedsRiskAssessmentService;

/**
 * Observer for FeedingPlan model changes.
 *
 * Triggers risk reassessment when feeding plan data changes,
 * particularly G-tube status which significantly impacts medical
 * complexity, staff training requirements, and risk scoring.
 */
class FeedingPlanObserver
{
    /**
     * Handle the FeedingPlan "saved" event.
     *
     * Reassesses risk when feeding plan is created or updated,
     * as G-tube feeding and specialized dietary needs impact
     * medical complexity and supervision requirements.
     */
    public function saved(FeedingPlan $feedingPlan): void
    {
        $camper = $feedingPlan->camper;

        if ($camper) {
            app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
        }
    }
}
