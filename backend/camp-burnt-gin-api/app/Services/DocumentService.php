<?php

namespace App\Services;

use App\Models\Document;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Service for document upload and management.
 *
 * Handles file storage, validation, and security scanning.
 * Implements FR-34 and FR-35: File upload and validation requirements.
 */
class DocumentService
{
    /**
     * Upload a new document.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function upload(UploadedFile $file, array $data, User $user): array
    {
        if (! $this->validateMimeType($file)) {
            return [
                'success' => false,
                'message' => 'File type not allowed.',
            ];
        }

        if (! $this->validateFileSize($file)) {
            return [
                'success' => false,
                'message' => 'File size exceeds maximum allowed size.',
            ];
        }

        $storedFilename = $this->generateFilename($file);
        $path = $this->getStoragePath($data);

        Storage::disk('local')->putFileAs($path, $file, $storedFilename);

        $document = Document::create([
            'documentable_type' => $data['documentable_type'] ?? null,
            'documentable_id' => $data['documentable_id'] ?? null,
            'uploaded_by' => $user->id,
            'original_filename' => $file->getClientOriginalName(),
            'stored_filename' => $storedFilename,
            'mime_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'disk' => 'local',
            'path' => $path.'/'.$storedFilename,
            'document_type' => $data['document_type'] ?? null,
            'is_scanned' => false,
        ]);

        $this->queueSecurityScan($document);

        return [
            'success' => true,
            'document' => $document,
        ];
    }

    /**
     * Validate file MIME type against allowed types using content inspection.
     *
     * This method performs both client-reported MIME type validation and
     * content-based verification using PHP's fileinfo extension to prevent
     * MIME type spoofing attacks.
     */
    protected function validateMimeType(UploadedFile $file): bool
    {
        $reportedMime = $file->getMimeType();

        // Verify reported MIME type is in whitelist
        if (! in_array($reportedMime, Document::ALLOWED_MIME_TYPES)) {
            return false;
        }

        // Perform content-based MIME type detection using magic bytes
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $detectedMime = finfo_file($finfo, $file->getRealPath());
        finfo_close($finfo);

        // Verify detected MIME type matches reported type or is in allowed list
        // This prevents uploading executables disguised as PDFs
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
     * Validate file size against maximum allowed.
     */
    protected function validateFileSize(UploadedFile $file): bool
    {
        return $file->getSize() <= Document::MAX_FILE_SIZE;
    }

    /**
     * Generate a unique filename for storage with validated extension.
     *
     * Uses validated extension from MIME type mapping to prevent
     * extension spoofing attacks.
     */
    protected function generateFilename(UploadedFile $file): string
    {
        // Map MIME types to safe extensions to prevent extension spoofing
        $mimeToExtension = [
            'application/pdf' => 'pdf',
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        ];

        $detectedMime = $file->getMimeType();
        $extension = $mimeToExtension[$detectedMime] ?? $file->getClientOriginalExtension();

        // Additional sanitization: ensure extension contains only alphanumeric characters
        $extension = preg_replace('/[^a-z0-9]/i', '', $extension);

        return Str::uuid().'.'.$extension;
    }

    /**
     * Get the storage path based on document data.
     *
     * @param  array<string, mixed>  $data
     */
    protected function getStoragePath(array $data): string
    {
        $basePath = 'documents';

        if (! empty($data['documentable_type'])) {
            $type = class_basename($data['documentable_type']);
            $basePath .= '/'.Str::snake($type);
        }

        return $basePath.'/'.date('Y/m');
    }

    /**
     * Queue a security scan for the document.
     */
    protected function queueSecurityScan(Document $document): void
    {
        dispatch(function () use ($document) {
            $scanPassed = $this->performSecurityScan($document);

            $document->update([
                'is_scanned' => true,
                'scan_passed' => $scanPassed,
                'scanned_at' => now(),
            ]);
        })->afterResponse();
    }

    /**
     * Perform security scan on document.
     *
     * HIPAA COMPLIANCE NOTE:
     * This implements a quarantine-based security system where all uploaded
     * files are marked as "pending review" and require manual administrator
     * approval before they can be accessed by non-admin users.
     *
     * For production deployment with automated virus scanning, integrate
     * one of the following solutions:
     * - ClamAV (open-source antivirus engine)
     * - VirusTotal API (cloud-based scanning)
     * - AWS GuardDuty Malware Protection
     * - Microsoft Defender for Cloud
     *
     * @return bool|null Returns false for obviously dangerous files,
     *                   null for files requiring manual review,
     *                   true for approved files (manual approval only)
     */
    protected function performSecurityScan(Document $document): ?bool
    {
        $dangerousExtensions = ['exe', 'bat', 'cmd', 'sh', 'php', 'js', 'vbs', 'com', 'pif', 'scr'];
        $extension = pathinfo($document->stored_filename, PATHINFO_EXTENSION);

        if (in_array(strtolower($extension), $dangerousExtensions)) {
            return false;
        }

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

        return null;
    }

    /**
     * Manually approve a document after security review (admin only).
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
     * Manually reject a document after security review (admin only).
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
     * Download a document with security headers.
     *
     * Implements HIPAA-compliant download with security headers to prevent
     * MIME type confusion attacks and ensure sensitive documents are not cached.
     */
    public function download(Document $document): StreamedResponse
    {
        $response = Storage::disk($document->disk)->download(
            $document->path,
            $document->original_filename
        );

        // Add security headers to prevent MIME type confusion and caching
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('Expires', '0');

        return $response;
    }

    /**
     * Delete a document with transaction safety.
     *
     * Ensures atomic deletion of both file and database record.
     * Uses transaction to prevent orphaned files or database records.
     */
    public function delete(Document $document): void
    {
        DB::transaction(function () use ($document) {
            // Store file path before deletion
            $filePath = $document->path;
            $disk = $document->disk;

            // Delete database record first (can be rolled back)
            $document->delete();

            // Then delete file (throws exception on failure if configured)
            try {
                if (! Storage::disk($disk)->delete($filePath)) {
                    throw new \RuntimeException('File deletion failed');
                }
            } catch (\Exception $e) {
                // Rollback database deletion by throwing exception
                Log::error('File deletion failed, rolling back database deletion', [
                    'document_id' => $document->id,
                    'path' => $filePath,
                    'error' => $e->getMessage(),
                ]);

                throw $e;
            }
        });
    }
}
