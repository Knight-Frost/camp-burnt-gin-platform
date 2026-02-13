<?php

namespace App\Observers;

use App\Models\BehavioralProfile;
use App\Services\SpecialNeedsRiskAssessmentService;

/**
 * Observer for BehavioralProfile model changes.
 *
 * Triggers risk reassessment when behavioral profile data changes,
 * particularly high-risk behaviors like wandering, aggression, or
 * one-to-one supervision requirements which significantly impact
 * staffing ratios and supervision levels.
 */
class BehavioralProfileObserver
{
    /**
     * Handle the BehavioralProfile "saved" event.
     *
     * Reassesses risk when behavioral profile is created or updated,
     * as behavioral factors are critical determinants of supervision
     * requirements and overall risk scoring.
     */
    public function saved(BehavioralProfile $behavioralProfile): void
    {
        $camper = $behavioralProfile->camper;

        if ($camper) {
            app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
        }
    }
}
