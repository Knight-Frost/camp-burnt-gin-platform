<?php

namespace App\Http\Requests\Application;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Form request for updating an existing application.
 *
 * Allows updating application notes. Status changes must be
 * performed through the dedicated review endpoint by administrators.
 */
class UpdateApplicationRequest extends FormRequest
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
        return [
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
