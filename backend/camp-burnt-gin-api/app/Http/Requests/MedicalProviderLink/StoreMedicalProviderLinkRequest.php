<?php

namespace App\Http\Requests\MedicalProviderLink;

use App\Models\Camper;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates medical provider link creation requests.
 *
 * Ensures the requesting user has permission to create links for the camper.
 * Implements FR-19: Secure provider link creation.
 */
class StoreMedicalProviderLinkRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $camper = Camper::find($this->camper_id);

        if (! $camper) {
            return false;
        }

        $user = $this->user();

        return $user->isAdmin() || $user->ownsCamper($camper);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'camper_id' => ['required', 'exists:campers,id'],
            'provider_email' => ['required', 'email', 'max:255'],
            'provider_name' => ['nullable', 'string', 'max:255'],
            'expires_in_hours' => ['nullable', 'integer', 'min:4', 'max:72'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Get custom error messages for validation rules.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'camper_id.required' => 'Camper is required.',
            'camper_id.exists' => 'Camper not found.',
            'provider_email.required' => 'Provider email address is required.',
            'provider_email.email' => 'Please provide a valid email address.',
            'expires_in_hours.min' => 'Link must be valid for at least 4 hours.',
            'expires_in_hours.max' => 'Link cannot expire more than 3 days from now.',
        ];
    }
}
