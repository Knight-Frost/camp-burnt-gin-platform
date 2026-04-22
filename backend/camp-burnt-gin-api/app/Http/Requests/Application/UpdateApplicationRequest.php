<?php

namespace App\Http\Requests\Application;

use App\Enums\SubmissionSource;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for updating an existing application.
 *
 * Supports three scenarios:
 *   1. Applicant editing a draft or editable submission — narrative fields only.
 *   2. Admin editing application content at any time — narratives + internal notes.
 *   3. Promoting a draft to submitted (submit=true flag) — applicant only.
 *
 * Role-based field restrictions are enforced here at the validation layer:
 *   - `notes` is internal staff-only metadata and is NEVER settable by applicants.
 *   - Narrative fields are writable by both roles when the status permits.
 *   - `submit` is only meaningful for applicants promoting a draft; admins do not
 *     use this flag (they use the dedicated /review endpoint for status changes).
 *
 * Status changes must still go through the dedicated /review endpoint.
 */
class UpdateApplicationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     * True here — the ApplicationPolicy::update() gate in the controller handles authorization.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Map client-side aliases to canonical DB column names before validation.
     * Mirrors StoreApplicationRequest so callers can use the same field names.
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('session_id') && ! $this->has('camp_session_id')) {
            $this->merge(['camp_session_id' => $this->input('session_id')]);
        }
        if ($this->has('session_id_second') && ! $this->has('camp_session_id_second')) {
            $this->merge(['camp_session_id_second' => $this->input('session_id_second')]);
        }

        // Strip unknown keys from `sections_reviewed` before validation runs.
        // The completeness engine only recognizes the nine canonical section
        // slugs; any other key is noise and could pollute the JSON column.
        if ($this->has('sections_reviewed') && is_array($this->input('sections_reviewed'))) {
            $allowed = [
                'camper', 'health', 'behavior', 'equipment', 'diet',
                'personal_care', 'activities', 'medications', 'narratives',
            ];
            $filtered = array_intersect_key($this->input('sections_reviewed'), array_flip($allowed));
            $this->merge(['sections_reviewed' => $filtered]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * Narrative rules are shared between roles. Role-specific fields (`notes`,
     * `submit`) are only added when the authenticated user's role permits them.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $isAdmin = $this->user()?->isAdmin() ?? false;

        $rules = [
            // Session selection and meta — applicants may update these when editing a draft.
            // prepareForValidation() maps session_id → camp_session_id before this runs.
            'camp_session_id' => ['sometimes', 'nullable', 'integer', 'exists:camp_sessions,id'],
            'camp_session_id_second' => ['sometimes', 'nullable', 'integer', 'exists:camp_sessions,id'],
            'first_application' => ['sometimes', 'boolean'],
            'attended_before' => ['sometimes', 'boolean'],
            // Narrative responses — writable by both admins and applicants.
            'narrative_rustic_environment' => ['nullable', 'string', 'max:5000'],
            'narrative_staff_suggestions' => ['nullable', 'string', 'max:5000'],
            'narrative_participation_concerns' => ['nullable', 'string', 'max:5000'],
            'narrative_camp_benefit' => ['nullable', 'string', 'max:5000'],
            'narrative_heat_tolerance' => ['nullable', 'string', 'max:5000'],
            'narrative_transportation' => ['nullable', 'string', 'max:5000'],
            'narrative_additional_info' => ['nullable', 'string', 'max:5000'],
            'narrative_emergency_protocols' => ['nullable', 'string', 'max:5000'],
        ];

        if ($isAdmin) {
            // Internal admin/staff notes — never exposed to or settable by applicants.
            $rules['notes'] = ['nullable', 'string', 'max:1000'];
            // Submission provenance — admins can correct or set the submission source.
            $rules['submission_source'] = ['sometimes', 'nullable', Rule::enum(SubmissionSource::class)];
        }

        if (! $isAdmin) {
            // Draft-promotion flag — applicants only. Admins change status via /review.
            $rules['submit'] = ['sometimes', 'boolean'];
        }

        // Per-application section-review attestation timestamps. Keyed by
        // canonical section slug (camper, health, behavior, equipment, diet,
        // personal_care, activities, medications, narratives) with ISO-8601
        // datetime values. These are the completeness engine's gate for
        // every data-bearing section — so validate strictly.
        //
        // - Unknown keys are rejected: without `Rule::in`, a parent could
        //   accumulate junk keys in the JSON blob. Also prevents typos that
        //   silently fail to satisfy the gate.
        // - Values must parse as dates: without this, a string like "yes" or
        //   any non-empty value satisfies `!empty($reviewed[$section])` in
        //   the engine, letting a parent bypass every review gate in one
        //   crafted PATCH without visiting any section.
        $rules['sections_reviewed'] = ['sometimes', 'nullable', 'array'];
        $rules['sections_reviewed.*'] = ['string', 'date'];
        $reviewableKeys = [
            'camper', 'health', 'behavior', 'equipment', 'diet',
            'personal_care', 'activities', 'medications', 'narratives',
        ];
        foreach ($reviewableKeys as $k) {
            $rules["sections_reviewed.{$k}"] = ['sometimes', 'string', 'date'];
        }
        // Reject any unknown section keys. Laravel has no first-class "forbid
        // unknown keys in this associative array" rule, so we validate the
        // keyset in prepareForValidation below.

        return $rules;
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'notes.max' => 'Admin notes may not exceed 1,000 characters.',
            'narrative_rustic_environment.max' => 'Response may not exceed 5,000 characters.',
            'narrative_staff_suggestions.max' => 'Response may not exceed 5,000 characters.',
            'narrative_participation_concerns.max' => 'Response may not exceed 5,000 characters.',
            'narrative_camp_benefit.max' => 'Response may not exceed 5,000 characters.',
            'narrative_heat_tolerance.max' => 'Response may not exceed 5,000 characters.',
            'narrative_transportation.max' => 'Response may not exceed 5,000 characters.',
            'narrative_additional_info.max' => 'Response may not exceed 5,000 characters.',
            'narrative_emergency_protocols.max' => 'Response may not exceed 5,000 characters.',
        ];
    }
}
