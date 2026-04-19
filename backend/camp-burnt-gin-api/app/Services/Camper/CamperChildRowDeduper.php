<?php

namespace App\Services\Camper;

use App\Models\Allergy;
use App\Models\AssistiveDevice;
use App\Models\Camper;
use App\Models\Diagnosis;
use App\Models\EmergencyContact;
use App\Models\Medication;

/**
 * CamperChildRowDeduper — remove exact-duplicate rows from a camper's
 * child tables (medications, allergies, emergency contacts, diagnoses,
 * assistive devices).
 *
 * Why this exists (BUG-214):
 *
 * These five controllers use plain `Model::create()` in their `store()`
 * handlers. The parent submission flow iterates the form's array for each
 * section and calls POST once per element. If the submission is retried —
 * network hiccup, user clicks twice, validation bounces the flow back —
 * every retry re-posts the full list and creates another copy of every
 * row. The admin review page then renders "Baclofen — 10mg, Three times
 * daily" 15 times in a row.
 *
 * These fields are AES-256 encrypted at rest (Laravel's encrypted cast),
 * so SQL can't dedupe them with a GROUP BY or a conditional unique index.
 * Comparison has to happen in PHP after Eloquent decrypts the rows.
 *
 * The "signature" for each row is the stable natural-key fingerprint. Any
 * two rows whose fingerprints match are treated as duplicates; we keep
 * the newest (highest id) and delete the rest.
 *
 * This service is pure: no side effects beyond deleting exact duplicate
 * rows, no logging of PHI. Safe to call from finalize() or an artisan
 * cleanup command.
 */
class CamperChildRowDeduper
{
    /**
     * Dedupe all five child tables for this camper. Returns a per-table
     * count of rows deleted so the caller can log / report cleanup work.
     *
     * @return array{medications: int, allergies: int, emergency_contacts: int, diagnoses: int, assistive_devices: int}
     */
    public function dedupeForCamper(Camper $camper): array
    {
        return [
            'medications'        => $this->dedupeModel(
                Medication::class,
                $camper->id,
                fn (Medication $m) => [
                    $m->name,
                    $m->dosage,
                    $m->frequency,
                    $m->purpose,
                ],
            ),
            'allergies'          => $this->dedupeModel(
                Allergy::class,
                $camper->id,
                fn (Allergy $a) => [
                    $a->allergen,
                    $a->severity,
                    $a->reaction,
                    $a->treatment,
                ],
            ),
            'emergency_contacts' => $this->dedupeModel(
                EmergencyContact::class,
                $camper->id,
                fn (EmergencyContact $e) => [
                    $e->name,
                    $e->relationship,
                    $e->phone_primary,
                    $e->phone_secondary,
                    $e->is_primary,
                    $e->is_guardian,
                    $e->is_authorized_pickup,
                ],
            ),
            'diagnoses'          => $this->dedupeModel(
                Diagnosis::class,
                $camper->id,
                fn (Diagnosis $d) => [
                    $d->name,
                    $d->description,
                    $d->severity_level,
                ],
            ),
            'assistive_devices'  => $this->dedupeModel(
                AssistiveDevice::class,
                $camper->id,
                fn (AssistiveDevice $v) => [
                    $v->device_type,
                    $v->requires_transfer_assistance,
                    $v->notes,
                ],
            ),
        ];
    }

    /**
     * Delete rows whose signature (from $signatureFn) matches a newer row.
     * "Newer" = higher id — preserves the most recent edit.
     *
     * @template T of \Illuminate\Database\Eloquent\Model
     * @param  class-string<T>  $modelClass
     * @param  callable(T): array  $signatureFn
     */
    private function dedupeModel(string $modelClass, int $camperId, callable $signatureFn): int
    {
        // Newest first so the first row we see for each signature is the
        // survivor and everything after is deleted.
        $rows = $modelClass::where('camper_id', $camperId)
            ->orderByDesc('id')
            ->get();

        $seenSignatures = [];
        $deleted = 0;

        foreach ($rows as $row) {
            $signature = hash('sha256', serialize($signatureFn($row)));
            if (isset($seenSignatures[$signature])) {
                $row->delete();
                $deleted++;
                continue;
            }
            $seenSignatures[$signature] = true;
        }

        return $deleted;
    }
}
