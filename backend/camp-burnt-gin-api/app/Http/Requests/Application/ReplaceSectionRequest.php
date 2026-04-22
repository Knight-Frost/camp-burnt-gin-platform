<?php

namespace App\Http\Requests\Application;

use App\Enums\ActivityPermissionLevel;
use App\Enums\AllergySeverity;
use App\Enums\DiagnosisSeverity;
use App\Models\Application;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates a single-section atomic-replace request.
 *
 * Endpoint: POST /api/applications/{application}/sections/{key}
 *
 * One request body shape per section key. The section key is taken from the
 * route parameter — `route('key')` — and selects which rule set to apply.
 *
 * Why this exists: the old per-row CRUD pattern used 8 different endpoints
 * with no transaction boundary. A network drop midway through saving a
 * section left the database in a partial state that the next save round
 * tried to diff against, producing spurious deletes and lost edits. This
 * request is paired with ApplicationSectionReplacer, which writes everything
 * inside a single DB::transaction. See the 2026-04-22 forensic audit for
 * the full motivation.
 *
 * The four "hybrid" sections (behavior, equipment, diet, medications) accept
 * an `attestation` boolean meaning "I have nothing to declare for this
 * section." The completeness engine treats data-OR-attestation as complete.
 * The other sections enforce required fields the way they always have.
 */
class ReplaceSectionRequest extends FormRequest
{
    /** Sections that may be replaced via this endpoint. */
    public const ALLOWED_SECTIONS = [
        'camper', 'health', 'behavior', 'equipment', 'diet',
        'personal_care', 'activities', 'medications', 'narratives',
    ];

    /** Sections that accept an explicit "nothing to declare" attestation. */
    public const ATTESTABLE_SECTIONS = ['behavior', 'equipment', 'diet', 'medications'];

    public function authorize(): bool
    {
        // Controller calls $this->authorize('replaceSection', $application).
        return true;
    }

    /**
     * The validated section key from the route. Throws 404 if missing or
     * unknown — keeps the rules() switch from receiving garbage.
     */
    public function sectionKey(): string
    {
        $key = (string) $this->route('key');
        abort_unless(in_array($key, self::ALLOWED_SECTIONS, true), 404);

        return $key;
    }

    public function rules(): array
    {
        $rules = match ($this->sectionKey()) {
            'camper' => $this->camperRules(),
            'health' => $this->healthRules(),
            'behavior' => $this->behaviorRules(),
            'equipment' => $this->equipmentRules(),
            'diet' => $this->dietRules(),
            'personal_care' => $this->personalCareRules(),
            'activities' => $this->activitiesRules(),
            'medications' => $this->medicationsRules(),
            'narratives' => $this->narrativesRules(),
        };

        // Every section accepts an explicit attestation, but only the four
        // hybrid sections actually consume it. For the other five the value
        // is silently ignored by the replacer (no harm, but no effect).
        $rules['attestation'] = ['sometimes', 'nullable', 'boolean'];

        return $rules;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Per-section rule sets
    //
    // Required fields are enforced strictly here (not just in the
    // completeness engine) so the API contract is self-describing — a 422
    // tells the parent what's missing before they finalize.
    // ─────────────────────────────────────────────────────────────────────

    private function camperRules(): array
    {
        // Replace-section semantics is "save what the parent has so far",
        // not "validate completeness". The ApplicationCompletenessService
        // is the single source of truth for whether the section is
        // complete; this request's job is to ensure the data shape is
        // well-formed. So required fields per the engine's REQUIRED_CAMPER_FIELDS
        // are NULLABLE here — the engine reports them as missing when null,
        // but the parent can still save mid-section without 422.
        return [
            'first_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'preferred_name' => ['nullable', 'string', 'max:100'],
            'date_of_birth' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'max:50'],
            'tshirt_size' => ['nullable', 'string', 'max:50'],
            'county' => ['nullable', 'string', 'max:100'],
            'needs_interpreter' => ['sometimes', 'boolean'],
            'preferred_language' => ['nullable', 'string', 'max:100'],
            'applicant_address' => ['nullable', 'string', 'max:255'],
            'applicant_city' => ['nullable', 'string', 'max:100'],
            'applicant_state' => ['nullable', 'string', 'max:50'],
            'applicant_zip' => ['nullable', 'string', 'max:20'],
            'camp_session_id' => ['nullable', 'integer', 'exists:camp_sessions,id'],
            'camp_session_id_second' => ['nullable', 'integer', 'exists:camp_sessions,id', 'different:camp_session_id'],
            'first_application' => ['sometimes', 'boolean'],
            'attended_before' => ['sometimes', 'boolean'],
            // Emergency contacts — full replace, may be empty during a draft.
            // Per-row fields are still validated when a row IS provided so
            // partial-row garbage isn't accepted.
            'emergency_contacts' => ['sometimes', 'array'],
            'emergency_contacts.*.name' => ['nullable', 'string', 'max:255'],
            'emergency_contacts.*.phone_primary' => ['nullable', 'string', 'max:50'],
            'emergency_contacts.*.phone_secondary' => ['nullable', 'string', 'max:50'],
            'emergency_contacts.*.phone_work' => ['nullable', 'string', 'max:50'],
            'emergency_contacts.*.email' => ['nullable', 'email', 'max:255'],
            'emergency_contacts.*.relationship' => ['nullable', 'string', 'max:100'],
            'emergency_contacts.*.is_primary' => ['sometimes', 'boolean'],
            'emergency_contacts.*.is_authorized_pickup' => ['sometimes', 'boolean'],
            'emergency_contacts.*.is_guardian' => ['sometimes', 'boolean'],
            'emergency_contacts.*.address' => ['nullable', 'string', 'max:255'],
            'emergency_contacts.*.city' => ['nullable', 'string', 'max:100'],
            'emergency_contacts.*.state' => ['nullable', 'string', 'max:50'],
            'emergency_contacts.*.zip' => ['nullable', 'string', 'max:20'],
            'emergency_contacts.*.primary_language' => ['nullable', 'string', 'max:100'],
            'emergency_contacts.*.interpreter_needed' => ['sometimes', 'boolean'],
        ];
    }

    private function healthRules(): array
    {
        // Same lenient-during-draft semantics as camperRules() — fields the
        // completeness engine considers required are NULLABLE here so the
        // parent can save mid-section. The engine reports them as missing
        // when null. Conditional rules (seizure description if has_seizures)
        // and well-formedness (date types, max lengths) ARE enforced.
        return [
            'physician_name' => ['nullable', 'string', 'max:255'],
            'physician_phone' => ['nullable', 'string', 'max:50'],
            'physician_address' => ['nullable', 'string', 'max:255'],
            'insurance_provider' => ['nullable', 'string', 'max:255'],
            'insurance_policy_number' => ['nullable', 'string', 'max:100'],
            'insurance_group' => ['nullable', 'string', 'max:100'],
            'medicaid_number' => ['nullable', 'string', 'max:100'],
            // Health flags.
            'has_seizures' => ['sometimes', 'boolean'],
            'last_seizure_date' => ['nullable', 'date'],
            'seizure_description' => ['nullable', 'string', 'max:5000'],
            'has_neurostimulator' => ['sometimes', 'boolean'],
            'has_contagious_illness' => ['sometimes', 'boolean'],
            'contagious_illness_description' => ['nullable', 'string', 'max:5000'],
            'tubes_in_ears' => ['sometimes', 'boolean'],
            'has_recent_illness' => ['sometimes', 'boolean'],
            'recent_illness_description' => ['nullable', 'string', 'max:5000'],
            'immunizations_current' => ['sometimes', 'boolean'],
            'tetanus_date' => ['nullable', 'date'],
            'date_of_medical_exam' => ['nullable', 'date'],
            'special_needs' => ['nullable', 'string', 'max:5000'],
            'dietary_restrictions' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            // Diagnoses — engine requires min 1 for CYSHCN, but the request
            // permits empty during draft (engine flags it as missing).
            'diagnoses' => ['sometimes', 'array'],
            'diagnoses.*.name' => ['required_with:diagnoses.*', 'string', 'max:255'],
            'diagnoses.*.description' => ['nullable', 'string', 'max:5000'],
            'diagnoses.*.severity_level' => ['nullable', Rule::enum(DiagnosisSeverity::class)],
            'diagnoses.*.notes' => ['nullable', 'string', 'max:5000'],
            // Allergies — optional, replaced wholesale.
            'allergies' => ['sometimes', 'array'],
            'allergies.*.allergen' => ['required_with:allergies.*', 'string', 'max:255'],
            'allergies.*.severity' => ['nullable', Rule::enum(AllergySeverity::class)],
            'allergies.*.reaction' => ['nullable', 'string', 'max:5000'],
            'allergies.*.treatment' => ['nullable', 'string', 'max:5000'],
        ];
    }

    private function behaviorRules(): array
    {
        // The behavioral profile is fully optional in the data sense — it's
        // valid for a camper to have no behavioral concerns. Conditional
        // rules still apply: if a flag is true, its description is required.
        return [
            'aggression' => ['sometimes', 'boolean'],
            'aggression_description' => ['nullable', 'string', 'max:5000', 'required_if:aggression,true'],
            'self_abuse' => ['sometimes', 'boolean'],
            'self_abuse_description' => ['nullable', 'string', 'max:5000', 'required_if:self_abuse,true'],
            'wandering_risk' => ['sometimes', 'boolean'],
            'wandering_description' => ['nullable', 'string', 'max:5000', 'required_if:wandering_risk,true'],
            'one_to_one_supervision' => ['sometimes', 'boolean'],
            'one_to_one_description' => ['nullable', 'string', 'max:5000', 'required_if:one_to_one_supervision,true'],
            'sexual_behaviors' => ['sometimes', 'boolean'],
            'sexual_behaviors_description' => ['nullable', 'string', 'max:5000', 'required_if:sexual_behaviors,true'],
            'interpersonal_behavior' => ['sometimes', 'boolean'],
            'interpersonal_behavior_description' => ['nullable', 'string', 'max:5000', 'required_if:interpersonal_behavior,true'],
            'social_emotional' => ['sometimes', 'boolean'],
            'social_emotional_description' => ['nullable', 'string', 'max:5000', 'required_if:social_emotional,true'],
            'developmental_delay' => ['sometimes', 'boolean'],
            'functioning_age_level' => ['nullable', 'string', 'max:100'],
            'functional_reading' => ['sometimes', 'boolean'],
            'functional_writing' => ['sometimes', 'boolean'],
            'independent_mobility' => ['sometimes', 'boolean'],
            'verbal_communication' => ['sometimes', 'boolean'],
            'social_skills' => ['sometimes', 'boolean'],
            'behavior_plan' => ['sometimes', 'boolean'],
            'follows_instructions' => ['sometimes', 'boolean'],
            'follows_instructions_description' => ['nullable', 'string', 'max:5000'],
            'group_participation' => ['sometimes', 'boolean'],
            'group_participation_description' => ['nullable', 'string', 'max:5000'],
            'attends_school' => ['nullable', 'boolean'],
            'classroom_type' => ['nullable', 'string', 'max:100'],
            'communication_methods' => ['sometimes', 'array'],
            'communication_methods.*' => ['string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    private function equipmentRules(): array
    {
        return [
            // Mobility-related notes live on the medical_record row.
            'mobility_notes' => ['nullable', 'string', 'max:5000'],
            // Devices list — full replace. Every row needs a device_type.
            'devices' => ['sometimes', 'array'],
            'devices.*.device_type' => ['required_with:devices.*', 'string', 'max:100'],
            'devices.*.requires_transfer_assistance' => ['sometimes', 'boolean'],
            'devices.*.notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    private function dietRules(): array
    {
        return [
            'special_diet' => ['sometimes', 'boolean'],
            'diet_description' => ['nullable', 'string', 'max:5000', 'required_if:special_diet,true'],
            'g_tube' => ['sometimes', 'boolean'],
            'formula' => ['nullable', 'string', 'max:255', 'required_if:g_tube,true'],
            'amount_per_feeding' => ['nullable', 'string', 'max:100', 'required_if:g_tube,true'],
            'feedings_per_day' => ['nullable', 'integer', 'min:0', 'max:24'],
            'feeding_times' => ['sometimes', 'array'],
            'feeding_times.*' => ['string', 'max:20'],
            'bolus_only' => ['sometimes', 'boolean'],
            'texture_modified' => ['sometimes', 'boolean'],
            'texture_level' => ['nullable', 'string', 'max:100'],
            'fluid_restriction' => ['sometimes', 'boolean'],
            'fluid_details' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    private function personalCareRules(): array
    {
        $adlLevels = ['independent', 'verbal_cue', 'physical_assist', 'full_assist'];

        // ADL levels are required by the engine, but during draft the
        // parent may save with some unset. When set, must be a valid enum.
        return [
            'bathing_level' => ['nullable', Rule::in($adlLevels)],
            'bathing_notes' => ['nullable', 'string', 'max:5000'],
            'toileting_level' => ['nullable', Rule::in($adlLevels)],
            'toileting_notes' => ['nullable', 'string', 'max:5000'],
            'nighttime_toileting' => ['sometimes', 'boolean'],
            'nighttime_notes' => ['nullable', 'string', 'max:5000'],
            'dressing_level' => ['nullable', Rule::in($adlLevels)],
            'dressing_notes' => ['nullable', 'string', 'max:5000'],
            'oral_hygiene_level' => ['nullable', Rule::in($adlLevels)],
            'oral_hygiene_notes' => ['nullable', 'string', 'max:5000'],
            'positioning_notes' => ['nullable', 'string', 'max:5000'],
            'sleep_notes' => ['nullable', 'string', 'max:5000'],
            'falling_asleep_issues' => ['sometimes', 'boolean'],
            'sleep_walking' => ['sometimes', 'boolean'],
            'night_wandering' => ['sometimes', 'boolean'],
            'bowel_control_notes' => ['nullable', 'string', 'max:5000'],
            'urinary_catheter' => ['sometimes', 'boolean'],
            'irregular_bowel' => ['sometimes', 'boolean'],
            'irregular_bowel_notes' => ['nullable', 'string', 'max:5000'],
            'menstruation_support' => ['sometimes', 'boolean'],
        ];
    }

    private function activitiesRules(): array
    {
        // The 7 canonical activities — engine requires every one to have a
        // permission row. Request permits empty / partial during draft.
        $canonicalSlugs = [
            'sports_games', 'arts_crafts', 'nature', 'fine_arts',
            'swimming', 'boating', 'camp_out',
        ];

        return [
            'permissions' => ['sometimes', 'array'],
            'permissions.*.activity_name' => ['required_with:permissions.*', Rule::in($canonicalSlugs)],
            'permissions.*.permission_level' => ['nullable', Rule::enum(ActivityPermissionLevel::class)],
            'permissions.*.restriction_notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    private function medicationsRules(): array
    {
        return [
            'medications' => ['sometimes', 'array'],
            'medications.*.name' => ['required_with:medications.*', 'string', 'max:255'],
            'medications.*.dosage' => ['required_with:medications.*', 'string', 'max:100'],
            'medications.*.frequency' => ['required_with:medications.*', 'string', 'max:255'],
            'medications.*.purpose' => ['nullable', 'string', 'max:5000'],
            'medications.*.prescribing_physician' => ['nullable', 'string', 'max:255'],
            'medications.*.notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    private function narrativesRules(): array
    {
        return [
            'narrative_rustic_environment' => ['nullable', 'string', 'max:5000'],
            'narrative_staff_suggestions' => ['nullable', 'string', 'max:5000'],
            'narrative_participation_concerns' => ['nullable', 'string', 'max:5000'],
            'narrative_camp_benefit' => ['nullable', 'string', 'max:5000'],
            'narrative_heat_tolerance' => ['nullable', 'string', 'max:5000'],
            'narrative_transportation' => ['nullable', 'string', 'max:5000'],
            'narrative_additional_info' => ['nullable', 'string', 'max:5000'],
            'narrative_emergency_protocols' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * Cross-field well-formedness checks. NOT completeness — that's the
     * engine's job. Only catch conditions that produce inconsistent /
     * unsafe rows (e.g. a "Restricted" activity row with no notes — the
     * combination doesn't make sense even mid-draft, so we reject it).
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ($this->sectionKey() === 'activities') {
                // Restricted permission requires restriction notes — staff
                // cannot make a safety decision without them. This is
                // well-formedness, not completeness; reject mid-draft.
                $perms = (array) $this->input('permissions', []);
                foreach ($perms as $i => $perm) {
                    if (
                        ($perm['permission_level'] ?? null) === ActivityPermissionLevel::Restricted->value
                        && empty($perm['restriction_notes'])
                    ) {
                        $validator->errors()->add(
                            "permissions.{$i}.restriction_notes",
                            'Restricted activities require restriction notes.',
                        );
                    }
                }
            }
        });
    }

    /**
     * Convenience for the controller: return only the validated payload
     * minus the meta fields the replacer doesn't need.
     */
    public function payload(): array
    {
        $data = $this->validated();
        unset($data['attestation']);

        return $data;
    }

    public function attestation(): bool
    {
        return (bool) $this->input('attestation', false);
    }
}
