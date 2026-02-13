<?php

namespace App\Http\Requests\BehavioralProfile;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for creating a new behavioral profile.
 *
 * Validates behavioral characteristics, developmental status, and
 * supervision requirements. High-risk behaviors trigger enhanced
 * supervision levels automatically.
 */
class StoreBehavioralProfileRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $user = $this->user();

        $camperRule = $user->isAdmin() || $user->isMedicalProvider()
            ? ['required', 'integer', 'exists:campers,id', 'unique:behavioral_profiles,camper_id']
            : ['required', 'integer', Rule::exists('campers', 'id')->where('user_id', $user->id), 'unique:behavioral_profiles,camper_id'];

        return [
            'camper_id' => $camperRule,
            'aggression' => ['boolean'],
            'self_abuse' => ['boolean'],
            'wandering_risk' => ['boolean'],
            'one_to_one_supervision' => ['boolean'],
            'developmental_delay' => ['boolean'],
            'functioning_age_level' => ['nullable', 'string', 'max:255'],
            'communication_methods' => ['nullable', 'array'],
            'communication_methods.*' => ['string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'camper_id.exists' => 'The selected camper is invalid or does not belong to you.',
            'camper_id.unique' => 'A behavioral profile already exists for this camper.',
            'communication_methods.array' => 'Communication methods must be an array.',
        ];
    }
}
