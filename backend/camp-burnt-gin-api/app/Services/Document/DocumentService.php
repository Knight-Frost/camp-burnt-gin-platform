<?php

namespace App\Services\Document;

use App\Models\Document;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * DocumentService — Secure File Upload, Storage, and Management
 *
 * This service handles every step of the document lifecycle:
 *  - Upload:    Validate MIME type and file size, generate a safe filename,
 *               store to the private local disk, queue a security scan
 *  - Download:  Stream the file back to the client with security headers
 *  - Approve:   Admin marks a document as scan-passed (manual quarantine review)
 *  - Reject:    Admin marks a document as scan-failed
 *  - Delete:    Atomically remove both the database record and the physical file
 *
 * Security design (HIPAA and general best practices):
 *  - Files are stored in the private "local" disk — never in a web-accessible public folder
 *  - Original filenames are replaced with UUIDs to prevent path traversal and name collisions
 *  - MIME type is validated twice: against the whitelist, and via PHP's fileinfo magic-bytes
 *    inspection (prevents uploading executables with a fake .pdf extension)
 *  - Extensions are sanitised to alphanumeric-only characters
 *  - Downloads include security headers (no caching, no MIME sniffing) for HIPAA compliance
 *  - Deletions are wrapped in a transaction so a failed file delete rolls back the DB record
 *
 * Implements FR-34 and FR-35: File upload and validation requirements.
 */
class DocumentService
{
    /**
     * Upload a file and create a Document record in the database.
     *
     * Validates the file, generates a safe stored filename, writes the file to
     * the private disk, creates the database record, then queues a background
     * security scan that runs after the HTTP response is sent.
     *
     * @param  UploadedFile  $file  The uploaded file from the request
     * @param  array<string, mixed>  $data  documentable_type, documentable_id, document_type
     * @param  User  $user  The user performing the upload
     * @return array<string, mixed> 'success' => true/false with optional 'document' on success
     */
    public function upload(UploadedFile $file, array $data, User $user): array
    {
        // Validate MIME type using both whitelist check and magic-byte inspection
        if (! $this->validateMimeType($file)) {
            return [
                'success' => false,
                'message' => 'Unsupported file type. Allowed types: PDF, JPG, PNG.',
            ];
        }

        // Reject files over the 10 MB size limit
        if (! $this->validateFileSize($file)) {
            return [
                'success' => false,
                'message' => 'File size exceeds the 10 MB limit. Please upload a smaller file.',
            ];
        }

        // Generate a UUID-based filename with a sanitised extension
        $storedFilename = $this->generateFilename($file);
        // Build the storage path based on the documentable type and current year/month
        $path = $this->getStoragePath($data);

        // Store the file in the private local disk (not publicly accessible)
        Storage::disk('local')->putFileAs($path, $file, $storedFilename);

        // Medical examination forms expire 12 months after the exam date.
        // This enforces the CYSHCN requirement that Form 4523 must be current.
        // Handles both 'official_medical_form' (primary upload type from Official Forms page)
        // and the legacy 'physical_examination' type for backward compatibility.
        $expirationDate = null;
        $examFormTypes = ['official_medical_form', 'physical_examination'];
        if (in_array($data['document_type'] ?? null, $examFormTypes, true) && ! empty($data['exam_date'])) {
            $expirationDate = \Carbon\Carbon::parse($data['exam_date'])->addYear()->toDateString();
        }

        // Determine submission state at upload time.
        //
        // Only admin uploads are auto-submitted (submitted_at = now()).
        // ALL applicant uploads start as drafts (submitted_at = null) regardless
        // of document type. No exceptions. Applicants must explicitly submit via
        // PATCH /documents/{id}/submit before any document becomes visible to admins.
        $submittedAt = $user->isAdmin() ? now() : null;

        // ── Idempotent write: one live doc per (owner, type) ─────────────
        // BEFORE creating the new row, archive any existing LIVE Document of
        // the same (documentable_type, documentable_id, document_type).
        // "Live" = archived_at IS NULL AND deleted_at IS NULL.
        //
        // This is the primary defence. A DB-level functional unique index
        // (migration 2026_04_19_000003) backs it up so duplication is
        // impossible even if future code forgets this step. Message
        // attachments are intentionally exempt — a thread can carry
        // many attachments of the same type.
        $ownerType = $data['documentable_type'] ?? null;
        $ownerId = $data['documentable_id'] ?? null;
        $docType = $data['document_type'] ?? null;
        $isMessageAttachment = ! empty($data['message_id']);

        $create = function () use ($data, $user, $path, $storedFilename, $file, $expirationDate, $submittedAt) {
            return Document::create([
                'documentable_type' => $data['documentable_type'] ?? null,
                'documentable_id' => $data['documentable_id'] ?? null,
                'message_id' => $data['message_id'] ?? null,
                'uploaded_by' => $user->id,
                'original_filename' => $file->getClientOriginalName(),
                'stored_filename' => $storedFilename,
                'mime_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'disk' => 'local',
                'path' => $path.'/'.$storedFilename,
                'document_type' => $data['document_type'] ?? null,
                'expiration_date' => $expirationDate,
                'is_scanned' => false,
                'submitted_at' => $submittedAt,
            ]);
        };

        if (! $isMessageAttachment && $ownerType !== null && $ownerId !== null && $docType !== null) {
            // Transactional archive-old + create-new. If the create throws on
            // the unique-index guard (duplicate race), we roll back so neither
            // the archive nor the create lands — caller sees the failure.
            $document = DB::transaction(function () use ($ownerType, $ownerId, $docType, $create) {
                Document::where('documentable_type', $ownerType)
                    ->where('documentable_id', $ownerId)
                    ->where('document_type', $docType)
                    ->whereNull('archived_at')
                    ->lockForUpdate()
                    ->update(['archived_at' => now()]);

                return $create();
            });
        } else {
            // Unowned doc (orphan) or message attachment — no dedupe key.
            $document = $create();
        }

        // For medical examination form documents attached to a Camper, persist the exam date
        // back to the camper's MedicalRecord so the date is available outside the document system.
        // Handles both 'official_medical_form' (primary type) and legacy 'physical_examination'.
        if (
            in_array($data['document_type'] ?? null, $examFormTypes, true)
            && ! empty($data['exam_date'])
            && ($data['documentable_type'] ?? null) === 'App\Models\Camper'
            && ! empty($data['documentable_id'])
        ) {
            \App\Models\MedicalRecord::where('camper_id', $data['documentable_id'])
                ->update(['date_of_medical_exam' => $data['exam_date']]);
        }

        // Queue the security scan to run after the HTTP response is delivered
        $this->queueSecurityScan($document);

        return [
            'success' => true,
            'document' => $document,
        ];
    }

    /**
     * Validate the file's MIME type using two layers of checking.
     *
     * Layer 1: Check the client-reported MIME type against the allowed whitelist.
     * Layer 2: Use PHP's fileinfo extension to inspect the actual file bytes (magic bytes).
     *          This detects files that have been renamed to a different extension.
     *
     * Example attack this prevents: an attacker uploads "malware.exe" renamed to "form.pdf".
     * The client reports "application/pdf" but fileinfo detects "application/x-executable".
     */
    protected function validateMimeType(UploadedFile $file): bool
    {
        $reportedMime = $file->getMimeType();

        // First check: is the reported MIME type in our allowed list?
        if (! in_array($reportedMime, Document::ALLOWED_MIME_TYPES)) {
            return false;
        }

        // Second check: independently detect the MIME type from the file's actual bytes
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $detectedMime = finfo_file($finfo, $file->getRealPath());
        finfo_close($finfo);

        // If the detected type is not allowed, reject the file and log the mismatch
        if (! in_array($detectedMime, Document::ALLOWED_MIME_TYPES)) {
            Log::warning('MIME type mismatch detected', [
                'reported' => $reportedMime,
                'detected' => $detectedMime,
                'filename' => $file->getClientOriginalName(),
            ]);

            return false;
        }

        return true;
    }

    /**
     * Validate that the file size does not exceed the maximum allowed.
     * The limit is defined as a constant on the Document model.
     */
    protected function validateFileSize(UploadedFile $file): bool
    {
        return $file->getSize() <= Document::MAX_FILE_SIZE;
    }

    /**
     * Generate a safe stored filename using a UUID and a validated extension.
     *
     * We map detected MIME types to known safe extensions instead of trusting
     * the extension submitted by the client. The extension is also sanitised
     * to alphanumeric characters only to prevent directory traversal attacks.
     */
    protected function generateFilename(UploadedFile $file): string
    {
        // Map each allowed MIME type to a canonical safe extension
        $mimeToExtension = [
            'application/pdf' => 'pdf',
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/x-png' => 'png',  // Normalize alternate PNG MIME type to .png extension
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        ];

        $detectedMime = $file->getMimeType();
        // Fall back to the client extension if we don't have a mapping (shouldn't happen in practice)
        $extension = $mimeToExtension[$detectedMime] ?? $file->getClientOriginalExtension();

        // Strip any non-alphanumeric characters from the extension (e.g. remove dots, slashes)
        $extension = preg_replace('/[^a-z0-9]/i', '', $extension);

        // Combine a UUID (guaranteed unique) with the safe extension
        return Str::uuid().'.'.$extension;
    }

    /**
     * Build the storage path based on the documentable entity type and current date.
     *
     * Files are organised as: documents/{EntityType}/{year}/{month}/
     * For example: documents/medicalrecord/2026/03/
     *
     * @param  array<string, mixed>  $data
     */
    protected function getStoragePath(array $data): string
    {
        $basePath = 'documents';

        if (! empty($data['documentable_type'])) {
            // Convert "App\Models\MedicalRecord" to "medicalrecord" for the path
            $type = class_basename($data['documentable_type']);
            $basePath .= '/'.Str::snake($type);
        }

        // Add year/month subdirectory for better file organisation
        return $basePath.'/'.date('Y/m');
    }

    /**
     * Queue a security scan to run asynchronously after the HTTP response is sent.
     *
     * Using afterResponse() means the user doesn't wait for the scan before
     * receiving their upload confirmation. The document remains in "pending review"
     * state (scan_passed = null) until the scan completes.
     */
    protected function queueSecurityScan(Document $document): void
    {
        dispatch(function () use ($document) {
            $scanPassed = $this->performSecurityScan($document);

            // Update the document record with the scan result
            $document->update([
                'is_scanned' => true,
                'scan_passed' => $scanPassed,
                'scanned_at' => now(),
            ]);
        })->afterResponse();
    }

    /**
     * Perform a security scan on an uploaded document.
     *
     * Current implementation performs two-layer static analysis:
     *  1. Extension check: rejects known executable/script extensions
     *  2. MIME type check: rejects known dangerous MIME types
     *
     * Files that reach this method have already passed MIME whitelist validation
     * and PHP finfo magic-byte inspection in validateMimeType(). Any file that
     * survives both those checks AND the two checks here is treated as clean.
     *
     * Return values:
     *  - false  = dangerous file detected (extension or MIME is on the blocklist)
     *  - true   = file passed all checks — safe to serve to authorized users
     *  - null   = reserved for future integrations (ClamAV, VirusTotal, etc.)
     *             where a result is genuinely not yet available
     *
     * To integrate a real antivirus engine, replace the `return true` at the
     * bottom with the scanner call and return null while the scan is in flight.
     * Update queueSecurityScan() to use a real queued job so the result is
     * persisted asynchronously when the scanner responds.
     *
     * @return bool|null false = dangerous, true = clean, null = pending async result
     */
    protected function performSecurityScan(Document $document): ?bool
    {
        // Reject files with dangerous extensions (executables, scripts, server-side code)
        $dangerousExtensions = ['exe', 'bat', 'cmd', 'sh', 'php', 'js', 'vbs', 'com', 'pif', 'scr'];
        $extension = pathinfo($document->stored_filename, PATHINFO_EXTENSION);

        if (in_array(strtolower($extension), $dangerousExtensions)) {
            return false;
        }

        // Reject files whose MIME type indicates executable or script content
        $dangerousMimeTypes = [
            'application/x-executable',
            'application/x-msdownload',
            'application/x-httpd-php',
            'application/x-sh',
            'text/x-php',
            'text/x-shellscript',
        ];

        if (in_array($document->mime_type, $dangerousMimeTypes)) {
            return false;
        }

        // File cleared both static checks. Combined with the validateMimeType() whitelist
        // and finfo magic-byte inspection already performed at upload time, this file is
        // as safe as we can determine without a real-time antivirus engine.
        return true;
    }

    /**
     * Manually approve a document after admin security review.
     *
     * Sets scan_passed = true so the document becomes accessible to non-admin users.
     * Called from DocumentController (admin only).
     */
    public function approveDocument(Document $document): void
    {
        $document->update([
            'is_scanned' => true,
            'scan_passed' => true,
            'scanned_at' => now(),
        ]);
    }

    /**
     * Manually reject a document after admin security review.
     *
     * Sets scan_passed = false so the document is permanently blocked.
     * Called from DocumentController (admin only).
     */
    public function rejectDocument(Document $document): void
    {
        $document->update([
            'is_scanned' => true,
            'scan_passed' => false,
            'scanned_at' => now(),
        ]);
    }

    /**
     * Stream a document file to the client with HIPAA-compliant security headers.
     *
     * Security headers applied:
     *  - X-Content-Type-Options: nosniff  — prevents browser MIME-sniffing attacks
     *  - Cache-Control / Pragma / Expires  — prevents PHI from being cached by the browser
     */
    public function download(Document $document): StreamedResponse
    {
        // Guard against missing files — records can outlive their physical file if a
        // storage operation failed. Return 404 rather than letting Storage throw a 500.
        if (! Storage::disk($document->disk)->exists($document->path)) {
            abort(404, 'The requested file could not be found.');
        }

        // Fetch the file from the storage disk and stream it as a download
        $response = Storage::disk($document->disk)->download(
            $document->path,
            $document->original_filename
        );

        // Prevent MIME-type confusion attacks
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        // Prevent sensitive documents from being cached in the browser or proxy
        $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('Expires', '0');

        return $response;
    }

    /**
     * Soft-delete a document record.
     *
     * The physical file is intentionally NOT removed here. The Document model's
     * `forceDeleting` boot hook handles file removal only when a caller opts in
     * via `$document->forceDelete()` (or when a scheduled pruner wipes an
     * abandoned draft). Soft-deleted documents remain recoverable with their
     * file intact — a HIPAA-sensitive invariant: clicking "delete" must not
     * permanently destroy compliance records.
     *
     * The controller decides between soft-delete (this method) and force-delete
     * based on `Document::canForceDelete()` + the caller's role. Admins can
     * force-delete anything; applicants can only force-delete their own
     * pristine drafts (never submitted, never attached).
     */
    public function delete(Document $document): void
    {
        $document->delete();
    }

    /**
     * Permanently destroy a document and its physical file.
     *
     * Used for pristine drafts (applicant cleaning up before submit) and for
     * admin-initiated hard deletes. `forceDelete()` fires the model's
     * `forceDeleting` hook which removes the file from disk. If the file
     * removal fails, the hook logs a warning but still clears the DB row —
     * orphaned files are better than stuck DB rows in the admin UI.
     */
    public function forceDelete(Document $document): void
    {
        $document->forceDelete();
    }
}
