<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Document model representing uploaded files.
 *
 * Documents can be attached to various entities (campers, applications,
 * medical records) using polymorphic relationships.
 */
class Document extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'documentable_type',
        'documentable_id',
        'uploaded_by',
        'original_filename',
        'stored_filename',
        'mime_type',
        'file_size',
        'disk',
        'path',
        'document_type',
        'is_scanned',
        'scan_passed',
        'scanned_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
            'is_scanned' => 'boolean',
            'scan_passed' => 'boolean',
            'scanned_at' => 'datetime',
        ];
    }

    /**
     * Allowed MIME types for upload.
     */
    public const ALLOWED_MIME_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    /**
     * Maximum file size in bytes (10 MB).
     */
    public const MAX_FILE_SIZE = 10485760;

    /**
     * Get the parent documentable model.
     */
    public function documentable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Get the user who uploaded this document.
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * Get the full storage path for this document.
     */
    public function getFullPathAttribute(): string
    {
        return storage_path("app/{$this->path}");
    }

    /**
     * Check if the document passed security scanning.
     */
    public function isSecure(): bool
    {
        return $this->is_scanned && $this->scan_passed === true;
    }

    /**
     * Check if the document is pending scan.
     */
    public function isPendingScan(): bool
    {
        return !$this->is_scanned;
    }
}
