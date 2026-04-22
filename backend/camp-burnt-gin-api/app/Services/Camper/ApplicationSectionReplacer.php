<?php

namespace App\Services\Camper;

use App\Models\Application;
use App\Models\ApplicationConsent;
use App\Models\Camper;
use Illuminate\Support\Facades\DB;

/**
 * Atomic per-section replace for the digital application form.
 *
 * Each replace runs inside one DB::transaction so the database moves from
 * one consistent state to another in a single step. Either every write
 * succeeds, or none do — there is no partial-write window for the next
 * flush to mis-diff against. This eliminates the entire class of bugs
 * that the per-row CRUD pattern caused (BUG-227 sequence, the 2026-04-22
 * forensic audit RC-3 / RC-4 / RC-5).
 *
 * Replacement strategy per section type:
 *
 *   Singleton sub-records (medical_record, behavioral_profile, feeding_plan,
 *   personal_care_plan)
 *     → updateOrCreate by camper_id with the validated fields. Existing
 *       null fields are NOT overwritten with null; the request only contains
 *       the fields the parent edited in the section, mass-assignment
 *       handles the rest correctly.
 *
 *   List sub-records (emergency_contacts, diagnoses, allergies,
 *   assistive_devices, activity_permissions, medications)
 *     → soft-delete every existing row for the camper, then create the
 *       full submitted list. This is genuinely "replace the section's
 *       collection" semantics — the request body is the source of truth
 *       for what should exist after the call.
 *
 *   Application meta (camper section also writes session_id, narratives
 *   write narrative_*)
 *     → patched directly onto the Application row.
 *
 * Every successful replace stamps `sections_reviewed[$key]` with the
 * current ISO timestamp (so the parent never has to manually mark a
 * section reviewed) and writes `section_attestations[$key]` if an
 * `attestation` flag was supplied.
 *
 * Why soft-delete-and-recreate for list relations:
 *   The list relations are PHI-encrypted, so SQL-level upsert by natural
 *   key is impossible. Doing in-PHP diff-and-update is brittle (it has
 *   been the source of every BUG-214–242 partial-write defect). Soft-
 *   delete preserves audit trail; the deleted rows remain in the DB with
 *   a deleted_at timestamp for any post-hoc forensic query but are
 *   excluded from every operational view.
 *
 * Why soft-delete is acceptable HIPAA-wise:
 *   The PHI is encrypted at rest. Soft-deleting an encrypted row leaves
 *   it unreadable from raw SQL and excluded from app queries. This is the
 *   same pattern every existing list-relation already uses (see Allergy,
 *   Diagnosis, Medication, EmergencyContact models — all use SoftDeletes).
 */
class ApplicationSectionReplacer
{
    /**
     * Replace a single section atomically.
     *
     * @return Application The reloaded Application with all fresh relations.
     */
    public function replace(Application $application, string $sectionKey, array $payload, bool $attestation): Application
    {
        return DB::transaction(function () use ($application, $sectionKey, $payload, $attestation) {
            // Lock the Application row first to prevent the read-modify-write
            // race on the sections_reviewed and section_attestations JSON
            // columns. Two concurrent replaces on the same application —
            // possible when an admin edits a section while the parent's form
            // also flushes — could otherwise drop one another's keys from
            // the merged map. See code-reviewer finding 1 (2026-04-22).
            $application = Application::lockForUpdate()->findOrFail($application->id);
            /** @var \App\Models\Camper $camper */
            $camper = $application->camper()->lockForUpdate()->firstOrFail();

            match ($sectionKey) {
                'camper' => $this->replaceCamper($application, $camper, $payload),
                'health' => $this->replaceHealth($camper, $payload),
                'behavior' => $this->replaceBehavior($camper, $payload),
                'equipment' => $this->replaceEquipment($camper, $payload),
                'diet' => $this->replaceDiet($camper, $payload),
                'personal_care' => $this->replacePersonalCare($camper, $payload),
                'activities' => $this->replaceActivities($camper, $payload),
                'medications' => $this->replaceMedications($camper, $payload),
                'narratives' => $this->replaceNarratives($application, $payload),
                'consents' => $this->replaceConsents($application, $payload),
                default => null,
            };

            // Stamp the per-application review timestamp + attestation in a
            // single update. Both are JSON columns; merge with what's
            // already there so other sections' values are preserved.
            $reviewed = $application->sections_reviewed ?? [];
            $reviewed[$sectionKey] = now()->toIso8601String();

            $attestations = $application->section_attestations ?? [];
            $attestations[$sectionKey] = $attestation;

            $application->update([
                'sections_reviewed' => $reviewed,
                'section_attestations' => $attestations,
            ]);

            return $application->fresh([
                'camper.emergencyContacts',
                'camper.medicalRecord',
                'camper.diagnoses',
                'camper.allergies',
                'camper.medications',
                'camper.behavioralProfile',
                'camper.feedingPlan',
                'camper.personalCarePlan',
                'camper.activityPermissions',
                'camper.assistiveDevices',
            ]);
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Per-section replacement implementations
    // ─────────────────────────────────────────────────────────────────────

    private function replaceCamper(Application $application, Camper $camper, array $payload): void
    {
        // Application-level meta lives on the Application row, not the Camper.
        $appFields = array_intersect_key($payload, array_flip([
            'camp_session_id', 'camp_session_id_second',
            'first_application', 'attended_before',
        ]));
        if (! empty($appFields)) {
            $application->update($appFields);
        }

        // Camper profile fields.
        $camperFields = array_intersect_key($payload, array_flip([
            'first_name', 'last_name', 'preferred_name', 'date_of_birth',
            'gender', 'tshirt_size', 'county',
            'needs_interpreter', 'preferred_language',
            'applicant_address', 'applicant_city', 'applicant_state', 'applicant_zip',
        ]));
        $camper->update($camperFields);

        // Emergency contacts — full replace.
        $contacts = $payload['emergency_contacts'] ?? [];
        $this->replaceListRelation(
            $camper->emergencyContacts(),
            $contacts,
            ['camper_id' => $camper->id],
        );
    }

    private function replaceHealth(Camper $camper, array $payload): void
    {
        // Medical record — singleton upsert. `insurance_type` is the
        // first-class enum answer (none/medicaid/other); the detail
        // columns flow through unchanged.
        $mrFields = array_intersect_key($payload, array_flip([
            'insurance_type',
            'physician_name', 'physician_phone', 'physician_address',
            'insurance_provider', 'insurance_policy_number', 'insurance_group',
            'medicaid_number',
            'has_seizures', 'last_seizure_date', 'seizure_description',
            'has_neurostimulator', 'has_contagious_illness',
            'contagious_illness_description', 'tubes_in_ears',
            'has_recent_illness', 'recent_illness_description',
            'immunizations_current', 'tetanus_date', 'date_of_medical_exam',
            'special_needs', 'dietary_restrictions', 'notes',
        ]));
        $camper->medicalRecord()->updateOrCreate(
            ['camper_id' => $camper->id],
            $mrFields,
        );

        // Diagnoses — full replace.
        $this->replaceListRelation(
            $camper->diagnoses(),
            $payload['diagnoses'] ?? [],
            ['camper_id' => $camper->id],
        );

        // Allergies — full replace (may be empty, allergies are optional).
        $this->replaceListRelation(
            $camper->allergies(),
            $payload['allergies'] ?? [],
            ['camper_id' => $camper->id],
        );
    }

    private function replaceBehavior(Camper $camper, array $payload): void
    {
        $bpFields = array_intersect_key($payload, array_flip([
            'aggression', 'aggression_description',
            'self_abuse', 'self_abuse_description',
            'wandering_risk', 'wandering_description',
            'one_to_one_supervision', 'one_to_one_description',
            'sexual_behaviors', 'sexual_behaviors_description',
            'interpersonal_behavior', 'interpersonal_behavior_description',
            'social_emotional', 'social_emotional_description',
            'developmental_delay', 'functioning_age_level',
            'functional_reading', 'functional_writing',
            'independent_mobility', 'verbal_communication',
            'social_skills', 'behavior_plan',
            'follows_instructions', 'follows_instructions_description',
            'group_participation', 'group_participation_description',
            'attends_school', 'classroom_type',
            'communication_methods', 'notes',
        ]));
        $camper->behavioralProfile()->updateOrCreate(
            ['camper_id' => $camper->id],
            $bpFields,
        );
    }

    private function replaceEquipment(Camper $camper, array $payload): void
    {
        // Mobility notes live on medical_record; updateOrCreate so we don't
        // wipe the rest of the record's fields.
        if (array_key_exists('mobility_notes', $payload)) {
            $camper->medicalRecord()->updateOrCreate(
                ['camper_id' => $camper->id],
                ['mobility_notes' => $payload['mobility_notes']],
            );
        }

        // Devices — full replace.
        $this->replaceListRelation(
            $camper->assistiveDevices(),
            $payload['devices'] ?? [],
            ['camper_id' => $camper->id],
        );
    }

    private function replaceDiet(Camper $camper, array $payload): void
    {
        $fpFields = array_intersect_key($payload, array_flip([
            'special_diet', 'diet_description',
            'g_tube', 'formula', 'amount_per_feeding', 'feedings_per_day',
            'feeding_times', 'bolus_only',
            'texture_modified', 'texture_level',
            'fluid_restriction', 'fluid_details',
            'notes',
        ]));
        $camper->feedingPlan()->updateOrCreate(
            ['camper_id' => $camper->id],
            $fpFields,
        );
    }

    private function replacePersonalCare(Camper $camper, array $payload): void
    {
        $pcpFields = array_intersect_key($payload, array_flip([
            'bathing_level', 'bathing_notes',
            'toileting_level', 'toileting_notes',
            'nighttime_toileting', 'nighttime_notes',
            'dressing_level', 'dressing_notes',
            'oral_hygiene_level', 'oral_hygiene_notes',
            'positioning_notes',
            'sleep_notes', 'falling_asleep_issues', 'sleep_walking', 'night_wandering',
            'bowel_control_notes', 'urinary_catheter',
            'irregular_bowel', 'irregular_bowel_notes',
            'menstruation_support',
        ]));
        $camper->personalCarePlan()->updateOrCreate(
            ['camper_id' => $camper->id],
            $pcpFields,
        );
    }

    private function replaceActivities(Camper $camper, array $payload): void
    {
        $this->replaceListRelation(
            $camper->activityPermissions(),
            $payload['permissions'] ?? [],
            ['camper_id' => $camper->id],
        );
    }

    private function replaceMedications(Camper $camper, array $payload): void
    {
        $this->replaceListRelation(
            $camper->medications(),
            $payload['medications'] ?? [],
            ['camper_id' => $camper->id],
        );
    }

    private function replaceNarratives(Application $application, array $payload): void
    {
        $narrativeFields = array_intersect_key($payload, array_flip([
            'narrative_rustic_environment', 'narrative_staff_suggestions',
            'narrative_participation_concerns', 'narrative_camp_benefit',
            'narrative_heat_tolerance', 'narrative_transportation',
            'narrative_additional_info', 'narrative_emergency_protocols',
        ]));
        if (! empty($narrativeFields)) {
            $application->update($narrativeFields);
        }
    }

    /**
     * Replace all consent records atomically + stamp the Application's
     * signature fields. The payload is validated upstream by
     * ReplaceSectionRequest::consentsRules() to have exactly 7 consent
     * entries with canonical types and a signature block.
     *
     * Semantics: this is an all-or-nothing legal artifact. The list-replace
     * pattern (soft-delete existing rows, create fresh ones) keeps any prior
     * signatures in the audit trail while making the current set the
     * authoritative record.
     */
    private function replaceConsents(Application $application, array $payload): void
    {
        // Wipe any prior consent rows for this application. Soft-delete
        // only — the encrypted rows remain in the DB for audit. Matches
        // the list-relation pattern used for EC, diagnoses, etc.
        $application->consents()->delete();

        $guardianName = $payload['guardian_name'];
        $guardianRelationship = $payload['guardian_relationship'];
        $guardianSignature = $payload['guardian_signature'];
        $applicantSignature = $payload['applicant_signature'] ?? null;
        $signedAt = $payload['signed_at'];

        foreach ($payload['consents'] as $consent) {
            ApplicationConsent::create([
                'application_id' => $application->id,
                'consent_type' => $consent['consent_type'],
                'guardian_name' => $guardianName,
                'guardian_relationship' => $guardianRelationship,
                'guardian_signature' => $guardianSignature,
                'applicant_signature' => $applicantSignature,
                'signed_at' => $signedAt,
            ]);
        }

        // Stamp signature fields on the Application itself. The engine's
        // validateConsents() requires signed_at to be non-null, and the
        // existing PDF export + admin review UI reads signature_name +
        // signature_data directly off the Application row. These stay in
        // sync with the ApplicationConsent rows inside the enclosing
        // transaction, so a crash between the two writes cannot happen.
        $application->update([
            'signature_name' => $guardianName,
            'signature_data' => $guardianSignature,
            'signed_at' => $signedAt,
        ]);
    }

    /**
     * Soft-delete all existing rows in a HasMany relation, then create the
     * supplied rows. Used for every list relation (EC, diagnoses, allergies,
     * devices, activities, medications).
     *
     * `$baseAttributes` are merged into every created row — typically just
     * `['camper_id' => $id]` to satisfy the foreign key.
     */
    private function replaceListRelation($relation, array $rows, array $baseAttributes): void
    {
        // Soft-delete the current set. Existing rows remain in the DB with
        // a deleted_at timestamp for audit. PHI stays encrypted; nothing
        // becomes readable that wasn't already.
        $relation->delete();

        $modelClass = $relation->getRelated()::class;

        foreach ($rows as $row) {
            // Drop client-supplied primary keys so the new rows always have
            // fresh IDs. The frontend may include id from prior fetches —
            // ignore it; the natural identity is the camper_id + payload.
            unset($row['id']);
            $modelClass::create(array_merge($baseAttributes, $row));
        }
    }
}
