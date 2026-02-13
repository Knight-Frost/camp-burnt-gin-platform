<?php

namespace App\Models;

use App\Enums\DocumentVerificationStatus;
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
        'message_id',
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
        'verification_status',
        'verified_by',
        'verified_at',
        'expiration_date',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * These fields contain sensitive internal storage information
     * that should never be exposed in API responses.
     *
     * @var list<string>
     */
    protected $hidden = [
        'path',             // Internal storage path - security risk if exposed
        'stored_filename',  // UUID filename - reveals storage structure
        'disk',             // Storage backend configuration
    ];

    /**
     * Get the attributes that should be cast.
     *
     * Original filename is encrypted to prevent PHI disclosure through filenames.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'original_filename' => 'encrypted',
            'file_size' => 'integer',
            'is_scanned' => 'boolean',
            'scan_passed' => 'boolean',
            'scanned_at' => 'datetime',
            'verification_status' => DocumentVerificationStatus::class,
            'verified_at' => 'datetime',
            'expiration_date' => 'date',
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
     * Get the user who verified this document.
     */
    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    /**
     * Get the message this document is attached to (if any).
     */
    public function message(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Message::class, 'message_id');
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
        return ! $this->is_scanned;
    }

    /**
     * Check if the document is verified and approved.
     */
    public function isVerified(): bool
    {
        return $this->verification_status?->isApproved() ?? false;
    }

    /**
     * Check if the document verification is pending.
     */
    public function isPendingVerification(): bool
    {
        return $this->verification_status?->isPending() ?? true;
    }

    /**
     * Check if the document has expired.
     */
    public function isExpired(): bool
    {
        if ($this->expiration_date === null) {
            return false;
        }

        return $this->expiration_date->isPast();
    }

    /**
     * Check if the document is valid for compliance purposes.
     *
     * A document is valid if it is verified, passed security scan,
     * and has not expired.
     */
    public function isValid(): bool
    {
        return $this->isVerified()
            && $this->isSecure()
            && ! $this->isExpired();
    }
}
