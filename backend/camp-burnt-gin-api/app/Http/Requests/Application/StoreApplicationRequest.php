<?php

namespace App\Http\Requests\Application;

use App\Models\Camper;
use App\Models\CampSession;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for creating a new camp application.
 *
 * Validates application submission including camper and session
 * selection. Ensures the camper belongs to the requesting user
 * unless the user is an administrator.
 */
class StoreApplicationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        // Admins can create applications for any camper
        if ($user->isAdmin()) {
            return true;
        }

        // Parents can only create applications for their own campers
        if ($user->isParent()) {
            $camperId = $this->input('camper_id');
            if ($camperId) {
                $camper = Camper::find($camperId);
                // If camper exists but doesn't belong to user, deny (403)
                if ($camper && $camper->user_id !== $user->id) {
                    return false;
                }
            }
            return true;
        }

        return false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'camper_id' => ['required', 'integer', 'exists:campers,id'],
            'camp_session_id' => [
                'required',
                'integer',
                'exists:camp_sessions,id',
                Rule::unique('applications')->where(function ($query) {
                    return $query->where('camper_id', $this->input('camper_id'));
                }),
            ],
            'notes' => ['nullable', 'string', 'max:1000'],
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
            'camp_session_id.exists' => 'The selected camp session does not exist.',
            'camp_session_id.unique' => 'An application for this camper and session already exists.',
        ];
    }
}
