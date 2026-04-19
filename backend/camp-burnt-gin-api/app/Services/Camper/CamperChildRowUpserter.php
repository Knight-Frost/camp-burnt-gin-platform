<?php

namespace App\Services\Camper;

use App\Models\Allergy;
use App\Models\AssistiveDevice;
use App\Models\Diagnosis;
use App\Models\EmergencyContact;
use App\Models\Medication;
use Illuminate\Database\Eloquent\Model;

/**
 * CamperChildRowUpserter — idempotent writes for camper child tables.
 *
 * The underlying problem (BUG-214 / RC-1):
 *   The five child controllers (Medication, Allergy, Diagnosis,
 *   EmergencyContact, AssistiveDevice) each POST-per-row from the form
 *   page. If the submission flow is retried — network hiccup, autosave
 *   race, user clicks twice — every row is re-POSTed and a blind
 *   Model::create() in the controller produces a duplicate.
 *
 * The underlying solution:
 *   Move the dedupe BEFORE the insert. For each incoming row, compute
 *   the natural-key signature, scan existing rows for this camper, and
 *   if a match already exists update it in place instead of creating
 *   a new row.
 *
 * Natural-key signatures mirror CamperChildRowDeduper — the two
 * services agree on what "same row" means. The deduper remains as a
 * safety net for legacy data and edge cases; this upserter is the
 * primary defence.
 *
 * PHI note: fields are AES-256 encrypted at rest. Comparison happens
 * in PHP against decrypted values, never in SQL. The signatures never
 * include ids, timestamps, or other mutable metadata — only the fields
 * that define the clinical identity of the row.
 */
class CamperChildRowUpserter
{
    /**
     * Upsert a Medication row. Returns the Medication (existing or new).
     */
    public function upsertMedication(int $camperId, array $data): Medication
    {
        return $this->upsertByNaturalKey(
            Medication::class,
            $camperId,
            $data,
            fn (array $d) => [
                $d['name']      ?? null,
                $d['dosage']    ?? null,
                $d['frequency'] ?? null,
                $d['purpose']   ?? null,
            ],
            fn (Medication $m) => [
                $m->name,
                $m->dosage,
                $m->frequency,
                $m->purpose,
            ],
        );
    }

    /**
     * Upsert an Allergy row.
     */
    public function upsertAllergy(int $camperId, array $data): Allergy
    {
        return $this->upsertByNaturalKey(
            Allergy::class,
            $camperId,
            $data,
            fn (array $d) => [
                $d['allergen']  ?? null,
                $d['severity']  ?? null,
                $d['reaction']  ?? null,
                $d['treatment'] ?? null,
            ],
            fn (Allergy $a) => [
                $a->allergen,
                $a->severity instanceof \BackedEnum ? $a->severity->value : $a->severity,
                $a->reaction,
                $a->treatment,
            ],
        );
    }

    /**
     * Upsert a Diagnosis row.
     */
    public function upsertDiagnosis(int $camperId, array $data): Diagnosis
    {
        return $this->upsertByNaturalKey(
            Diagnosis::class,
            $camperId,
            $data,
            fn (array $d) => [
                $d['name']           ?? null,
                $d['description']    ?? null,
                $d['severity_level'] ?? null,
            ],
            fn (Diagnosis $dx) => [
                $dx->name,
                $dx->description,
                $dx->severity_level instanceof \BackedEnum ? $dx->severity_level->value : $dx->severity_level,
            ],
        );
    }

    /**
     * Upsert an EmergencyContact row.
     *
     * Natural key is narrower here than the deduper — (name, relationship,
     * phone_primary) is enough to establish identity; phone_secondary and
     * the is_* flags are treated as mutable attributes that update if the
     * contact already exists under the narrower key. This matches the
     * product intent: if the applicant changes "James Wicker (father)"'s
     * secondary phone number, that should update in place, not create a
     * second James Wicker row.
     */
    public function upsertEmergencyContact(int $camperId, array $data): EmergencyContact
    {
        return $this->upsertByNaturalKey(
            EmergencyContact::class,
            $camperId,
            $data,
            fn (array $d) => [
                $d['name']          ?? null,
                $d['relationship']  ?? null,
                $d['phone_primary'] ?? null,
            ],
            fn (EmergencyContact $e) => [
                $e->name,
                $e->relationship,
                $e->phone_primary,
            ],
        );
    }

    /**
     * Upsert an AssistiveDevice row.
     */
    public function upsertAssistiveDevice(int $camperId, array $data): AssistiveDevice
    {
        return $this->upsertByNaturalKey(
            AssistiveDevice::class,
            $camperId,
            $data,
            fn (array $d) => [
                $d['device_type'] ?? null,
                $d['notes']       ?? null,
            ],
            fn (AssistiveDevice $v) => [
                $v->device_type,
                $v->notes,
            ],
        );
    }

    /**
     * Core upsert — load existing rows for this camper, match by signature,
     * update in place if found, otherwise create.
     *
     * @template T of Model
     * @param  class-string<T>  $modelClass
     * @param  callable(array): array  $dataSignatureFn
     * @param  callable(T): array  $rowSignatureFn
     * @return T
     */
    private function upsertByNaturalKey(
        string $modelClass,
        int $camperId,
        array $data,
        callable $dataSignatureFn,
        callable $rowSignatureFn,
    ): Model {
        $targetSignature = hash('sha256', serialize($dataSignatureFn($data)));

        // Ensure camper_id scoping regardless of what the caller passed.
        $data['camper_id'] = $camperId;

        $existing = $modelClass::where('camper_id', $camperId)->get();

        foreach ($existing as $row) {
            if (hash('sha256', serialize($rowSignatureFn($row))) === $targetSignature) {
                // Natural key matches — treat as same clinical entity. Update
                // the mutable (non-signature) fields in place.
                $row->fill($data)->save();

                return $row;
            }
        }

        return $modelClass::create($data);
    }
}
