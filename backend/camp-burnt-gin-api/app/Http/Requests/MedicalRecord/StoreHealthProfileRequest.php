<?php

namespace App\Http\Requests\MedicalRecord;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the extended health profile payload submitted during the application
 * form (Section 2 extended fields). These fields extend the base MedicalRecord
 * with insurance details, physician address, immunization status, and clinical flags.
 *
 * Authorization is handled in the controller via CamperPolicy::update.
 * All PHI text fields are encrypted at rest by the MedicalRecord model casts.
 */
class StoreHealthProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Authorization is handled in the controller via Policy.
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Insurance
            'insurance_group' => 'nullable|string|max:100',
            'medicaid_number' => 'nullable|string|max:100',
            // Physician
            'physician_address' => 'nullable|string|max:500',
            // Immunization
            'immunizations_current' => 'nullable|boolean',
            'tetanus_date' => 'nullable|date',
            // Mobility (PHI — encrypted in model)
            'mobility_notes' => 'nullable|string|max:2000',
            // Contagious illness
            'has_contagious_illness' => 'nullable|boolean',
            'contagious_illness_description' => 'nullable|string|max:2000',
            // Ear tubes
            'tubes_in_ears' => 'nullable|boolean',
            // Recent illness
            'has_recent_illness' => 'nullable|boolean',
            'recent_illness_description' => 'nullable|string|max:2000',
        ];
    }
}
