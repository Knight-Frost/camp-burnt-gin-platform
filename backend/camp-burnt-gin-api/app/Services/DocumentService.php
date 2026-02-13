<?php

namespace App\Services;

use App\Models\Document;
use App\Models\User;
use Illuminate\Http\UploadedFile;
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
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function upload(UploadedFile $file, array $data, User $user): array
    {
        if (!$this->validateMimeType($file)) {
            return [
                'success' => false,
                'message' => 'File type not allowed.',
            ];
        }

        if (!$this->validateFileSize($file)) {
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
            'message_id' => $data['message_id'] ?? null,
            'uploaded_by' => $user->id,
            'original_filename' => $file->getClientOriginalName(),
            'stored_filename' => $storedFilename,
            'mime_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'disk' => 'local',
            'path' => $path . '/' . $storedFilename,
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
     * Validate file MIME type against allowed types.
     */
    protected function validateMimeType(UploadedFile $file): bool
    {
        return in_array($file->getMimeType(), Document::ALLOWED_MIME_TYPES);
    }

    /**
     * Validate file size against maximum allowed.
     */
    protected function validateFileSize(UploadedFile $file): bool
    {
        return $file->getSize() <= Document::MAX_FILE_SIZE;
    }

    /**
     * Generate a unique filename for storage.
     */
    protected function generateFilename(UploadedFile $file): string
    {
        $extension = $file->getClientOriginalExtension();
        return Str::uuid() . '.' . $extension;
    }

    /**
     * Get the storage path based on document data.
     *
     * @param array<string, mixed> $data
     */
    protected function getStoragePath(array $data): string
    {
        $basePath = 'documents';

        if (!empty($data['documentable_type'])) {
            $type = class_basename($data['documentable_type']);
            $basePath .= '/' . Str::snake($type);
        }

        return $basePath . '/' . date('Y/m');
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
     */
    protected function performSecurityScan(Document $document): bool
    {
        $dangerousExtensions = ['exe', 'bat', 'cmd', 'sh', 'php', 'js', 'vbs'];
        $extension = pathinfo($document->original_filename, PATHINFO_EXTENSION);

        if (in_array(strtolower($extension), $dangerousExtensions)) {
            return false;
        }

        $dangerousMimeTypes = [
            'application/x-executable',
            'application/x-msdownload',
            'application/x-httpd-php',
            'text/x-php',
        ];

        if (in_array($document->mime_type, $dangerousMimeTypes)) {
            return false;
        }

        return true;
    }

    /**
     * Download a document.
     */
    public function download(Document $document): StreamedResponse
    {
        return Storage::disk($document->disk)->download(
            $document->path,
            $document->original_filename
        );
    }

    /**
     * Delete a document.
     */
    public function delete(Document $document): void
    {
        Storage::disk($document->disk)->delete($document->path);
        $document->delete();
    }
}
