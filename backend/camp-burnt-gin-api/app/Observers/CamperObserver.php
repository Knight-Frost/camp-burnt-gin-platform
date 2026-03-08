<?php

namespace App\Observers;

use App\Models\Camper;
use App\Models\MedicalRecord;

/**
 * Observer for the Camper model.
 *
 * Ensures that every camper has a medical record from the moment
 * their profile is created. This safeguard handles all camper
 * creation paths (application form submission, admin manual creation,
 * bulk imports, etc.) so medical staff always find a record ready.
 *
 * The medical record is created empty and later enriched by the
 * application form data or by medical staff during camp.
 */
class CamperObserver
{
    /**
     * Auto-provision an empty medical record when a camper is created.
     *
     * Uses firstOrCreate so it is safe to call even when the camper
     * already has a record (e.g. if the application form created one
     * immediately before this observer fires).
     */
    public function created(Camper $camper): void
    {
        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
        );
    }
}
