<?php

namespace App\Observers;

use App\Models\Diagnosis;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;

/**
 * Observer for Diagnosis model changes.
 *
 * Triggers risk reassessment when diagnoses are added, modified,
 * or removed, as diagnosis severity directly contributes to
 * overall medical complexity and risk scoring.
 */
class DiagnosisObserver
{
    /**
     * Handle the Diagnosis "saved" event.
     *
     * Reassesses risk when a diagnosis is created or updated,
     * as severity level changes impact risk calculations.
     */
    public function saved(Diagnosis $diagnosis): void
    {
        $camper = $diagnosis->camper;

        if ($camper) {
            app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
        }
    }

    /**
     * Handle the Diagnosis "deleted" event.
     *
     * Reassesses risk when a diagnosis is removed, as this
     * may lower the camper's overall risk score and potentially
     * reduce supervision requirements.
     */
    public function deleted(Diagnosis $diagnosis): void
    {
        $camper = $diagnosis->camper;

        if ($camper) {
            app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
        }
    }
}
