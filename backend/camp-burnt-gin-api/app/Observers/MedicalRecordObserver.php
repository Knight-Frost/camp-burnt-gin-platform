<?php

namespace App\Observers;

use App\Models\MedicalRecord;
use App\Services\SpecialNeedsRiskAssessmentService;

/**
 * Observer for MedicalRecord model changes.
 *
 * Triggers risk reassessment when medical record data changes,
 * particularly seizure status which significantly impacts
 * supervision requirements and risk scoring.
 */
class MedicalRecordObserver
{
    /**
     * Handle the MedicalRecord "saved" event.
     *
     * Reassesses risk when medical record is created or updated,
     * as changes to seizure status or other medical conditions
     * may alter supervision requirements.
     */
    public function saved(MedicalRecord $medicalRecord): void
    {
        $camper = $medicalRecord->camper;

        if ($camper) {
            app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
        }
    }
}
