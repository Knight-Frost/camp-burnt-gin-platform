<?php

namespace App\Observers;

use App\Models\BehavioralProfile;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;

/**
 * BehavioralProfileObserver — triggers automatic risk re-assessment when behavioral profile data changes.
 *
 * Behavioral factors — especially aggression, self-harm, wandering risk, and one-to-one supervision
 * requirements — are critical determinants of supervision needs. When any of these flags change,
 * the camper's overall risk score must be recalculated to ensure staffing is adjusted accordingly.
 *
 * Examples of when this matters:
 *   - A camper's wandering risk is added → risk score increases → extra staff may be required
 *   - One-to-one supervision is cleared by a clinician → risk score drops → ratio can be relaxed
 *
 * Registered in AppServiceProvider with BehavioralProfile::observe(BehavioralProfileObserver::class).
 */
class BehavioralProfileObserver
{
    /**
     * Trigger a risk re-assessment when the behavioral profile is created or updated.
     *
     * "saved" fires for both INSERT (new profile) and UPDATE (profile edited).
     * Behavioral profile changes can have an outsized effect on the risk score compared
     * to other medical data, making this observer particularly safety-critical.
     */
    public function saved(BehavioralProfile $behavioralProfile): void
    {
        // Navigate from the behavioral profile to its parent camper
        $camper = $behavioralProfile->camper;

        if ($camper) {
            // Re-score the camper — behavioral changes may require different supervision arrangements
            app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
        }
    }
}
