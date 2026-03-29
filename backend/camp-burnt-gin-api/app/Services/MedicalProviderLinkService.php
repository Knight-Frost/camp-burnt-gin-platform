<?php

namespace App\Services;

use App\Models\Allergy;
use App\Models\Camper;
use App\Models\Document;
use App\Models\MedicalProviderLink;
use App\Models\MedicalRecord;
use App\Models\Medication;
use App\Models\User;
use App\Notifications\ProviderLinkCreatedNotification;
use App\Notifications\ProviderLinkExpiredNotification;
use App\Notifications\ProviderLinkRevokedNotification;
use App\Notifications\ProviderSubmissionReceivedNotification;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * Service for medical provider link operations.
 *
 * Handles link creation, validation, submission processing, and notifications.
 * Implements FR-19 through FR-26: Medical provider access requirements.
 */
class MedicalProviderLinkService
{
    /**
     * Create a new provider link and send notification.
     *
     * @param  array<string, mixed>  $data
     */
    public function createAndSend(Camper $camper, array $data, User $creator): MedicalProviderLink
    {
        $link = MedicalProviderLink::create([
            'camper_id' => $camper->id,
            'created_by' => $creator->id,
            'token' => MedicalProviderLink::generateToken(),
            'provider_email' => $data['provider_email'],
            'provider_name' => $data['provider_name'] ?? null,
            'expires_at' => now()->addHours($data['expires_in_hours'] ?? MedicalProviderLink::DEFAULT_EXPIRATION_HOURS),
            'notes' => $data['notes'] ?? null,
        ]);

        $this->sendProviderNotification($link);

        return $link;
    }

    /**
     * Send link notification to provider.
     */
    protected function sendProviderNotification(MedicalProviderLink $link): void
    {
        \Illuminate\Support\Facades\Notification::route('mail', $link->provider_email)
            ->notify(new ProviderLinkCreatedNotification($link));
    }

    /**
     * Revoke a provider link and notify relevant parties.
     */
    public function revoke(MedicalProviderLink $link, User $user): void
    {
        $link->revoke($user);

        $link->camper->user->notify(new ProviderLinkRevokedNotification($link));
    }

    /**
     * Regenerate a new link from an existing one.
     */
    public function regenerate(MedicalProviderLink $oldLink, User $creator): MedicalProviderLink
    {
        return $this->createAndSend(
            $oldLink->camper,
            [
                'provider_email' => $oldLink->provider_email,
                'provider_name' => $oldLink->provider_name,
                'notes' => $oldLink->notes,
            ],
            $creator
        );
    }

    /**
     * Resend notification for an existing valid link.
     */
    public function resend(MedicalProviderLink $link): void
    {
        $this->sendProviderNotification($link);
    }

    /**
     * Process medical information submission from provider.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function processSubmission(MedicalProviderLink $link, array $data): array
    {
        $validator = Validator::make($data, [
            'physician_name' => ['nullable', 'string', 'max:255'],
            'physician_phone' => ['nullable', 'string', 'max:20'],
            'special_needs' => ['nullable', 'string'],
            'dietary_restrictions' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'allergies' => ['nullable', 'array'],
            'allergies.*.allergen' => ['required_with:allergies', 'string', 'max:255'],
            'allergies.*.severity' => ['required_with:allergies', 'string', 'in:mild,moderate,severe,life_threatening'],
            'allergies.*.reaction' => ['nullable', 'string'],
            'allergies.*.treatment' => ['nullable', 'string'],
            'medications' => ['nullable', 'array'],
            'medications.*.name' => ['required_with:medications', 'string', 'max:255'],
            'medications.*.dosage' => ['required_with:medications', 'string', 'max:100'],
            'medications.*.frequency' => ['required_with:medications', 'string', 'max:100'],
            'medications.*.purpose' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return [
                'success' => false,
                'message' => 'Validation failed.',
                'errors' => $validator->errors()->toArray(),
            ];
        }

        DB::transaction(function () use ($link, $data) {
            $camper = $link->camper;

            $medicalRecord = $camper->medicalRecord ?? new MedicalRecord(['camper_id' => $camper->id]);
            $medicalRecord->fill([
                'physician_name' => $data['physician_name'] ?? $medicalRecord->physician_name,
                'physician_phone' => $data['physician_phone'] ?? $medicalRecord->physician_phone,
                'special_needs' => $data['special_needs'] ?? $medicalRecord->special_needs,
                'dietary_restrictions' => $data['dietary_restrictions'] ?? $medicalRecord->dietary_restrictions,
                'notes' => $data['notes'] ?? $medicalRecord->notes,
            ]);
            $medicalRecord->save();

            if (! empty($data['allergies'])) {
                foreach ($data['allergies'] as $allergyData) {
                    Allergy::create([
                        'camper_id' => $camper->id,
                        ...$allergyData,
                    ]);
                }
            }

            if (! empty($data['medications'])) {
                foreach ($data['medications'] as $medicationData) {
                    Medication::create([
                        'camper_id' => $camper->id,
                        ...$medicationData,
                    ]);
                }
            }

            $link->markAsUsed();
        });

        $this->notifySubmissionReceived($link);

        return ['success' => true];
    }

    /**
     * Upload a document via provider link.
     *
     * @return array<string, mixed>
     */
    public function uploadDocument(MedicalProviderLink $link, UploadedFile $file, ?string $documentType): array
    {
        if (! in_array($file->getMimeType(), Document::ALLOWED_MIME_TYPES)) {
            return [
                'success' => false,
                'message' => 'File type not allowed.',
            ];
        }

        $storedFilename = Str::uuid().'.'.$file->getClientOriginalExtension();
        $path = 'documents/medical/'.date('Y/m');

        Storage::disk('local')->putFileAs($path, $file, $storedFilename);

        $document = Document::create([
            'documentable_type' => MedicalRecord::class,
            'documentable_id' => $link->camper->medicalRecord?->id,
            'uploaded_by' => null,
            'original_filename' => $file->getClientOriginalName(),
            'stored_filename' => $storedFilename,
            'mime_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'disk' => 'local',
            'path' => $path.'/'.$storedFilename,
            'document_type' => $documentType ?? 'medical_document',
            'is_scanned' => false,
            'scan_passed' => null,
            'scanned_at' => null,
        ]);

        return [
            'success' => true,
            'document' => $document,
        ];
    }

    /**
     * Notify parent and admin of provider submission.
     */
    protected function notifySubmissionReceived(MedicalProviderLink $link): void
    {
        $link->camper->user->notify(new ProviderSubmissionReceivedNotification($link));

        User::where('role_id', function ($query) {
            $query->select('id')
                ->from('roles')
                ->where('name', 'admin')
                ->limit(1);
        })->each(function ($admin) use ($link) {
            $admin->notify(new ProviderSubmissionReceivedNotification($link));
        });
    }

    /**
     * Check and handle expired links.
     */
    public function handleExpiredLinks(): int
    {
        $expiredLinks = MedicalProviderLink::where('expires_at', '<=', now())
            ->where('is_used', false)
            ->whereNull('revoked_at')
            ->get();

        foreach ($expiredLinks as $link) {
            $link->camper->user->notify(new ProviderLinkExpiredNotification($link));
        }

        return $expiredLinks->count();
    }
}
