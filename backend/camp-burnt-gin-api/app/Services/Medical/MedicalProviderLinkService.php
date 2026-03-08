<?php

namespace App\Services\Medical;

use App\Models\Allergy;
use App\Models\Camper;
use App\Models\Document;
use App\Models\MedicalProviderLink;
use App\Models\MedicalRecord;
use App\Models\Medication;
use App\Models\User;
use App\Notifications\Medical\ProviderLinkCreatedNotification;
use App\Notifications\Medical\ProviderLinkExpiredNotification;
use App\Notifications\Medical\ProviderLinkRevokedNotification;
use App\Notifications\Medical\ProviderSubmissionReceivedNotification;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * MedicalProviderLinkService — Secure External Medical Provider Access
 *
 * Camp Burnt Gin allows parents to invite a child's external doctor or specialist
 * (a "medical provider") to submit clinical information directly without creating
 * a portal account. This service manages that entire secure-link workflow.
 *
 * How it works:
 *  1. An admin or parent calls createAndSend() — a time-limited, single-use
 *     access token is generated and emailed to the provider.
 *  2. The provider clicks the link in their email, which sends the plain-text
 *     token to a public API endpoint. Only the hashed version is stored in the DB.
 *  3. The provider submits medical data (allergies, medications, physician info)
 *     via processSubmission(). The link is then marked as used.
 *  4. The provider can also upload supporting documents via uploadDocument().
 *  5. Links can be revoked at any time. A scheduled job calls handleExpiredLinks()
 *     to notify parents when an unused link lapses.
 *
 * Security design:
 *  - Tokens are stored as hashes — the plain text is never persisted
 *  - Links have a configurable expiry (default from MedicalProviderLink::DEFAULT_EXPIRATION_HOURS)
 *  - Each link is single-use; markAsUsed() prevents replay after submission
 *  - Uploaded documents are MIME-type validated before storage
 *
 * Implements FR-19 through FR-26: Medical provider access requirements.
 */
class MedicalProviderLinkService
{
    /**
     * Create a new provider access link and email it to the provider.
     *
     * Generates a random plain-text token, stores only its hash in the database,
     * then emails the plain-text version to the provider. This way, even if the
     * database is compromised, the tokens cannot be used.
     *
     * @param  array<string, mixed>  $data  provider_email, provider_name, expires_in_hours, notes
     */
    public function createAndSend(Camper $camper, array $data, User $creator): MedicalProviderLink
    {
        // Generate a cryptographically random plain-text token (e.g. 64 hex chars)
        $plainToken = MedicalProviderLink::generateToken();

        // Store the link record with the hashed token and expiry timestamp
        $link = MedicalProviderLink::create([
            'camper_id' => $camper->id,
            'created_by' => $creator->id,
            // Only the hash goes to the database — never the plain token
            'token' => MedicalProviderLink::hashToken($plainToken),
            'provider_email' => $data['provider_email'],
            'provider_name' => $data['provider_name'] ?? null,
            // Use provided hours or fall back to the model's default constant
            'expires_at' => now()->addHours($data['expires_in_hours'] ?? MedicalProviderLink::DEFAULT_EXPIRATION_HOURS),
            'notes' => $data['notes'] ?? null,
        ]);

        // Email the plain-text token to the provider (it won't be accessible after this)
        $this->sendProviderNotification($link, $plainToken);

        return $link;
    }

    /**
     * Send the access-link notification email to the provider.
     *
     * Uses Laravel's on-demand notification to send to a non-User email address.
     * The notification includes the plain-text token embedded in a clickable URL.
     */
    protected function sendProviderNotification(MedicalProviderLink $link, string $plainToken): void
    {
        // Route the notification directly to the provider's email — no User record needed
        \Illuminate\Support\Facades\Notification::route('mail', $link->provider_email)
            ->notify(new ProviderLinkCreatedNotification($link, $plainToken));
    }

    /**
     * Revoke an active provider link and notify the parent.
     *
     * Revocation sets a revoked_at timestamp on the link and sends the parent
     * a notification so they know the provider's access has been removed.
     */
    public function revoke(MedicalProviderLink $link, User $user): void
    {
        // Delegate the database update to the model's revoke() method
        $link->revoke($user);

        // Notify the parent (camper's user) that the link was revoked
        $link->camper->user->notify(new ProviderLinkRevokedNotification($link));
    }

    /**
     * Regenerate a link by creating a fresh one from an existing link's settings.
     *
     * Used when a link has expired or was revoked but the provider still needs access.
     * Copies provider contact info from the old link into a brand-new link with a new token.
     */
    public function regenerate(MedicalProviderLink $oldLink, User $creator): MedicalProviderLink
    {
        // createAndSend() handles token generation and email delivery
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
     * Resend a notification for an existing link.
     *
     * This is intentionally disabled. Because tokens are stored as hashes,
     * the plain-text token is gone after createAndSend() completes. To give
     * the provider a fresh link, the caller must use regenerate() instead.
     */
    public function resend(MedicalProviderLink $link): void
    {
        throw new \RuntimeException('Cannot resend link with hashed token. Use regenerate() instead.');
    }

    /**
     * Process a medical data submission from the external provider.
     *
     * This is the main intake method called when the provider fills out the
     * linked form. It validates the submitted data, then in a single database
     * transaction it:
     *  - Updates or creates the camper's MedicalRecord with physician info
     *  - Creates new Allergy records for each submitted allergy
     *  - Creates new Medication records for each submitted medication
     *  - Marks the link as used so it cannot be submitted again
     *
     * After the transaction, it notifies both the parent and all admins
     * that new medical data has been received.
     *
     * @param  array<string, mixed>  $data  Submitted form data (physician info, allergies, medications)
     * @return array<string, mixed>  'success' => true/false with optional 'errors'
     */
    public function processSubmission(MedicalProviderLink $link, array $data): array
    {
        // Validate the incoming data structure before touching the database
        $validator = Validator::make($data, [
            'physician_name' => ['nullable', 'string', 'max:255'],
            'physician_phone' => ['nullable', 'string', 'max:20'],
            'special_needs' => ['nullable', 'string'],
            'dietary_restrictions' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'allergies' => ['nullable', 'array'],
            // Allergy fields are required only when the allergies array is present
            'allergies.*.allergen' => ['required_with:allergies', 'string', 'max:255'],
            'allergies.*.severity' => ['required_with:allergies', 'string', 'in:mild,moderate,severe,life_threatening'],
            'allergies.*.reaction' => ['nullable', 'string'],
            'allergies.*.treatment' => ['nullable', 'string'],
            'medications' => ['nullable', 'array'],
            // Medication fields are required only when the medications array is present
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

        // Wrap all database writes in a transaction so a partial failure rolls back everything
        DB::transaction(function () use ($link, $data) {
            $camper = $link->camper;

            // Get the existing medical record or create a new unsaved instance to fill
            $medicalRecord = $camper->medicalRecord ?? new MedicalRecord(['camper_id' => $camper->id]);
            // Only overwrite fields that the provider explicitly submitted (preserve existing data)
            $medicalRecord->fill([
                'physician_name' => $data['physician_name'] ?? $medicalRecord->physician_name,
                'physician_phone' => $data['physician_phone'] ?? $medicalRecord->physician_phone,
                'special_needs' => $data['special_needs'] ?? $medicalRecord->special_needs,
                'dietary_restrictions' => $data['dietary_restrictions'] ?? $medicalRecord->dietary_restrictions,
                'notes' => $data['notes'] ?? $medicalRecord->notes,
            ]);
            $medicalRecord->save();

            // Create a new Allergy record for each allergy the provider submitted
            if (! empty($data['allergies'])) {
                foreach ($data['allergies'] as $allergyData) {
                    Allergy::create([
                        'camper_id' => $camper->id,
                        // Spread the allergy array fields into the create call
                        ...$allergyData,
                    ]);
                }
            }

            // Create a new Medication record for each medication the provider submitted
            if (! empty($data['medications'])) {
                foreach ($data['medications'] as $medicationData) {
                    Medication::create([
                        'camper_id' => $camper->id,
                        ...$medicationData,
                    ]);
                }
            }

            // Mark the link as used — prevents the same link from being submitted again
            $link->markAsUsed();
        });

        // Notify the parent and all admins that new medical data arrived
        $this->notifySubmissionReceived($link);

        return ['success' => true];
    }

    /**
     * Upload a medical document via a provider link.
     *
     * Allows the external provider to attach supporting files (PDFs, images) to the
     * camper's medical record without having a portal account.
     *
     * Security:
     *  - MIME type is checked against Document::ALLOWED_MIME_TYPES before storage
     *  - Filename is replaced with a UUID to prevent path traversal or name collisions
     *  - Files are stored in the private "local" disk, not publicly accessible
     *
     * @return array<string, mixed>  'success' => true/false with optional 'document'
     */
    public function uploadDocument(MedicalProviderLink $link, UploadedFile $file, ?string $documentType): array
    {
        // Reject file types not on the allowed list (e.g. no executables)
        if (! in_array($file->getMimeType(), Document::ALLOWED_MIME_TYPES)) {
            return [
                'success' => false,
                'message' => 'File type not allowed.',
            ];
        }

        // Generate a UUID-based filename to avoid collisions and name-based attacks
        $storedFilename = Str::uuid().'.'.$file->getClientOriginalExtension();
        // Organise files by year/month for easier maintenance
        $path = 'documents/medical/'.date('Y/m');

        // Store the file in the private local disk (not in the public web-accessible folder)
        Storage::disk('local')->putFileAs($path, $file, $storedFilename);

        // Create the database record linking the file to the camper's medical record
        $document = Document::create([
            'documentable_type' => MedicalRecord::class,
            'documentable_id' => $link->camper->medicalRecord?->id,
            'uploaded_by' => null,  // Provider has no user account — uploaded_by is null
            'original_filename' => $file->getClientOriginalName(),
            'stored_filename' => $storedFilename,
            'mime_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'disk' => 'local',
            'path' => $path.'/'.$storedFilename,
            'document_type' => $documentType ?? 'medical_document',
            'is_scanned' => false,  // Security scan will be queued after upload
            'scan_passed' => null,
            'scanned_at' => null,
        ]);

        return [
            'success' => true,
            'document' => $document,
        ];
    }

    /**
     * Notify the parent user and all admin users that a provider submitted data.
     *
     * This is called after a successful processSubmission() transaction so the
     * camp team knows to review the new information.
     */
    protected function notifySubmissionReceived(MedicalProviderLink $link): void
    {
        // Notify the parent (the camper's associated user account)
        $link->camper->user->notify(new ProviderSubmissionReceivedNotification($link));

        // Find all admin users and notify each one
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
     * Check for expired unused links and notify the relevant parent for each.
     *
     * Intended to be called by a scheduled artisan command (e.g. daily).
     * Returns the count of expired links found so the caller can log it.
     */
    public function handleExpiredLinks(): int
    {
        // Find links that have passed their expiry but were never used or revoked
        $expiredLinks = MedicalProviderLink::where('expires_at', '<=', now())
            ->where('is_used', false)
            ->whereNull('revoked_at')
            ->get();

        // Notify each camper's parent that their provider link has expired
        foreach ($expiredLinks as $link) {
            $link->camper->user->notify(new ProviderLinkExpiredNotification($link));
        }

        return $expiredLinks->count();
    }
}
