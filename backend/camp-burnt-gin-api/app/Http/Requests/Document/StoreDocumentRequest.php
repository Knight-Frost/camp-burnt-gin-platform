<?php

namespace App\Http\Requests\Document;

use App\Models\Camper;
use App\Models\Document;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\File;

/**
 * Validates document upload requests.
 *
 * Ensures uploaded files meet type, size, and security requirements.
 * Implements FR-34 and FR-35: File upload validation.
 */
class StoreDocumentRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        if (! $this->documentable_type || ! $this->documentable_id) {
            return true;
        }

        if ($this->documentable_type === 'App\\Models\\Camper') {
            $camper = Camper::find($this->documentable_id);
            if (! $camper) {
                return false;
            }

            $user = $this->user();

            return $user->isAdmin() || $user->isMedicalProvider() || $user->ownsCamper($camper);
        }

        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $maxSize = Document::MAX_FILE_SIZE / 1024;
        $allowedMimes = implode(',', array_map(function ($mime) {
            return explode('/', $mime)[1];
        }, Document::ALLOWED_MIME_TYPES));

        return [
            'file' => [
                'required',
                File::types(['pdf', 'jpeg', 'jpg', 'png', 'gif', 'doc', 'docx'])
                    ->max($maxSize),
            ],
            'documentable_type' => ['nullable', 'string', 'in:App\\Models\\Camper,App\\Models\\MedicalRecord,App\\Models\\Application'],
            'documentable_id' => ['nullable', 'integer', 'required_with:documentable_type'],
            'document_type' => ['nullable', 'string', 'max:100'],
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
            'file.required' => 'A file is required.',
            'file.max' => 'File size cannot exceed 10 MB.',
            'documentable_id.required_with' => 'Document ID is required when type is specified.',
        ];
    }
}
