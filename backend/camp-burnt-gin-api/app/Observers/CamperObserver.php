<?php

namespace App\Observers;

use App\Models\Camper;
use App\Models\MedicalRecord;

/**
 * CamperObserver — automatically provisions a medical record when a camper is created.
 *
 * Observers in Laravel listen for Eloquent model events (created, updated, deleted, etc.)
 * and run code automatically in response — no manual calls needed anywhere in the codebase.
 *
 * Why this observer exists:
 *   Every camper in the system must have a medical record — it is a core safety requirement.
 *   Rather than trusting every code path that creates campers (form submission, admin panel,
 *   bulk import scripts, etc.) to also create a medical record, this observer guarantees it
 *   happens automatically for every single camper, no matter how they were created.
 *
 * Registration: this observer is registered in AppServiceProvider (or ObserverServiceProvider)
 * with Camper::observe(CamperObserver::class).
 */
class CamperObserver
{
    /**
     * Auto-provision an empty medical record immediately after a camper is created.
     *
     * Uses firstOrCreate so it is completely safe to call even if a medical record
     * already exists (e.g., if the application form created one in the same request).
     * The "first or create" pattern prevents duplicate medical records.
     *
     * The medical record starts empty and is enriched later by:
     *   - The applicant filling out the medical section of the application form
     *   - Medical staff adding data during the camp season
     *   - External providers submitting via a MedicalProviderLink
     */
    public function created(Camper $camper): void
    {
        // firstOrCreate: if a medical record for this camper already exists, return it
        // If not, create a new empty one so medical staff always find a record ready
        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
        );
    }
}
