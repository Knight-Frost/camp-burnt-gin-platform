<?php

namespace App\Http\Requests\Application;

use Illuminate\Foundation\Http\FormRequest;

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
            // Narrative responses — writable by both admins and applicants.
            'narrative_rustic_environment'     => ['nullable', 'string', 'max:5000'],
            'narrative_staff_suggestions'      => ['nullable', 'string', 'max:5000'],
            'narrative_participation_concerns' => ['nullable', 'string', 'max:5000'],
            'narrative_camp_benefit'           => ['nullable', 'string', 'max:5000'],
            'narrative_heat_tolerance'         => ['nullable', 'string', 'max:5000'],
            'narrative_transportation'         => ['nullable', 'string', 'max:5000'],
            'narrative_additional_info'        => ['nullable', 'string', 'max:5000'],
            'narrative_emergency_protocols'    => ['nullable', 'string', 'max:5000'],
        ];

        if ($isAdmin) {
            // Internal admin/staff notes — never exposed to or settable by applicants.
            $rules['notes'] = ['nullable', 'string', 'max:1000'];
        }

        if (! $isAdmin) {
            // Draft-promotion flag — applicants only. Admins change status via /review.
            $rules['submit'] = ['sometimes', 'boolean'];
        }

        return $rules;
    }
}
