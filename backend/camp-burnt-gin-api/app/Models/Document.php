<?php

namespace App\Models;

use App\Enums\DocumentVerificationStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

/**
 * Document model — represents an uploaded file attached to any entity in the system.
 *
 * Documents use a polymorphic relationship, meaning one Document row can belong to
 * an Application, a MedicalRecord, or any other model without separate join tables.
 * The documentable_type column stores the owning class name and documentable_id
 * stores the owning record's primary key.
 *
 * Security layers:
 *  1. Internal storage fields (path, stored_filename, disk) are hidden from API
 *     responses so attackers cannot discover the server's file storage layout.
 *  2. original_filename is encrypted because filenames can reveal PHI
 *     (e.g. "Jane_Doe_diagnosis_2026.pdf").
 *  3. Every upload goes through a virus/malware scan; scan_passed must be true
 *     before the file is considered safe to serve.
 *  4. An admin must verify the document before isValid() returns true.
 *  5. Documents with an expiration_date become invalid after that date,
 *     prompting re-upload (e.g. annual physician clearance forms).
 */
class Document extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * Bootstrap model events.
     *
     * forceDeleting fires when a record is permanently removed (via forceDelete()
     * or pruning soft-deleted rows). This ensures the physical file on disk is
     * always removed alongside the database row, preventing orphaned file
     * accumulation in storage. Soft-delete alone does NOT touch the file — the
     * file must remain available if the record is later restored.
     *
     * If Storage::delete() fails (e.g. file already removed), we log the error
     * rather than aborting — the DB row should still be cleaned up.
     */
    protected static function booted(): void
    {
        static::forceDeleting(function (Document $document): void {
            if ($document->disk && $document->path) {
                try {
                    Storage::disk($document->disk)->delete($document->path);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning('Document file could not be deleted during force-delete', [
                        'document_id' => $document->id,
                        'disk' => $document->disk,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        });
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'documentable_type',  // Class name of the owning model (polymorphic type).
        'documentable_id',    // Primary key of the owning record (polymorphic id).
        'message_id',            // Optional: links a document to a specific Message as an attachment.
        'document_request_id',   // Optional: the DocumentRequest that prompted this upload.
        'uploaded_by',           // FK to the User who uploaded the file.
        'original_filename',  // The name the user gave the file — encrypted PHI.
        'stored_filename',    // UUID-based name used on disk — never exposed via API.
        'mime_type',          // MIME type validated on upload (e.g. 'application/pdf').
        'file_size',          // File size in bytes — shown to users as a helpful hint.
        'disk',               // Laravel storage disk name (e.g. 'local', 's3') — hidden.
        'path',               // Full relative path on the disk — hidden from API.
        'document_type',      // Category label (e.g. 'medical_clearance', 'insurance').
        'is_scanned',         // True once the antivirus scan has run.
        'scan_passed',        // True if the scan found no threats.
        'scanned_at',         // Timestamp of the scan.
        'verification_status', // Admin review state (DocumentVerificationStatus enum).
        'verified_by',           // FK to the admin who performed security/scan verification.
        'verified_at',           // Timestamp of the scan-verification decision.
        'rejection_reason',      // Admin-authored reason shown to the applicant on rejection.
        'approved_by',           // FK to the admin who approved document content.
        'approved_at',           // Timestamp of the content-approval decision.
        'rejected_by',           // FK to the admin who rejected document content.
        'rejected_at',           // Timestamp of the content-rejection decision.
        'expiration_date',       // Date after which the document is considered expired.
        'archived_at',           // Null = active; timestamp = archived (soft-remove from workflow view).
        'submitted_at',          // Null = draft (visible only to uploader); timestamp = submitted to staff.
        'applicant_hidden_at',   // Null = visible to the uploader; timestamp = uploader hid it from their own list only. Admin queue is never affected.
        'sent_at',               // Null = sitting in the applicant's "Ready to Send" queue; timestamp = pushed to an admin via the inbox messaging flow.
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * These internal storage details must never appear in API responses —
     * exposing them would reveal the file system structure and enable path traversal attacks.
     *
     * @var list<string>
     */
    protected $hidden = [
        'path',             // Internal storage path — security risk if exposed.
        'stored_filename',  // UUID filename — reveals storage structure.
        'disk',             // Storage backend configuration detail.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * original_filename is encrypted to prevent PHI disclosure through file names.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'original_filename' => 'encrypted',                    // PHI — encrypted at rest.
            'file_size' => 'integer',
            'is_scanned' => 'boolean',
            'scan_passed' => 'boolean',
            'scanned_at' => 'datetime',
            // Maps the stored string to a DocumentVerificationStatus enum instance.
            'verification_status' => DocumentVerificationStatus::class,
            'verified_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'expiration_date' => 'date',
            'archived_at' => 'datetime',
            'submitted_at' => 'datetime',
            'applicant_hidden_at' => 'datetime',
            'sent_at' => 'datetime',
        ];
    }

    /**
     * Allowed MIME types for upload.
     *
     * Any file with a MIME type not in this list is rejected at the controller
     * level before the file even reaches the storage layer.
     */
    public const ALLOWED_MIME_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/x-png',  // Some PHP/OS environments report PNG files as image/x-png
        'image/gif',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    /**
     * Maximum file size in bytes (10 MB).
     *
     * 10 * 1024 * 1024 = 10,485,760 bytes. Files larger than this are rejected
     * to prevent storage abuse and to keep download times reasonable.
     */
    public const MAX_FILE_SIZE = 10485760;

    /**
     * Get the parent model that this document is attached to (polymorphic).
     *
     * morphTo() automatically resolves the correct model class from documentable_type
     * and loads the matching record by documentable_id.
     */
    public function documentable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Get the user who uploaded this document.
     *
     * The foreign key is 'uploaded_by' instead of the default 'user_id'.
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * Get the admin user who performed security/scan verification.
     *
     * The foreign key is 'verified_by' instead of the default 'user_id'.
     */
    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    /**
     * The DocumentRequest that prompted this document's upload, if any.
     */
    public function documentRequest(): BelongsTo
    {
        return $this->belongsTo(DocumentRequest::class, 'document_request_id');
    }

    /**
     * The admin who approved this document's content.
     */
    public function approvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * The admin who rejected this document's content.
     */
    public function rejectedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    /**
     * All review events recorded for this document (chronological, immutable).
     */
    public function reviewEvents(): HasMany
    {
        return $this->hasMany(DocumentReviewEvent::class)->orderBy('created_at');
    }

    /**
     * Get the message this document is attached to, if it was sent as a message attachment.
     *
     * message_id is nullable — documents can also belong to applications or other entities.
     */
    public function message(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Message::class, 'message_id');
    }

    /**
     * Messages that reference this document via the Phase 2 join table.
     *
     * Distinct from message() which is the legacy inline-attachment FK. A
     * Document lives in the Documents module once; any number of Messages
     * may reference it via this pivot.
     */
    public function attachedToMessages(): BelongsToMany
    {
        return $this->belongsToMany(
            \App\Models\Message::class,
            'message_document_links',
            'document_id',
            'message_id'
        )->withPivot(['id', 'attached_by', 'created_at']);
    }

    /**
     * Get the absolute filesystem path for this document.
     *
     * Used internally when the controller needs to stream or delete the file.
     * This accessor is intentionally not listed in $appends — callers must
     * access it explicitly, keeping it out of routine API responses.
     */
    public function getFullPathAttribute(): string
    {
        return storage_path("app/{$this->path}");
    }

    /**
     * Check if the document has passed the antivirus/malware security scan.
     *
     * Both conditions must be true: the scan must have run AND it must have passed.
     */
    public function isSecure(): bool
    {
        return $this->is_scanned && $this->scan_passed === true;
    }

    /**
     * Check if the document is still waiting for an antivirus scan.
     */
    public function isPendingScan(): bool
    {
        return ! $this->is_scanned;
    }

    /**
     * Check if an admin has approved this document.
     *
     * Delegates to the DocumentVerificationStatus enum so approval logic
     * is defined in one place.
     */
    public function isVerified(): bool
    {
        return $this->verification_status?->isApproved() ?? false;
    }

    /**
     * Check whether this document has been submitted to staff.
     *
     * Submitted documents are visible to admins. Draft documents (submitted_at = null)
     * are only visible to the uploader until they explicitly submit.
     */
    public function isSubmitted(): bool
    {
        return $this->submitted_at !== null;
    }

    /**
     * Check whether this document is still a draft (not yet submitted to staff).
     */
    public function isDraft(): bool
    {
        return $this->submitted_at === null;
    }

    /**
     * Check whether this document has been archived by an admin.
     *
     * Archived documents are hidden from the default admin workflow view but
     * can be recovered with the restore action.
     */
    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    /**
     * Check if this document is still awaiting admin review.
     *
     * Defaults to true (pending) when verification_status is null, covering
     * newly uploaded documents that have not yet been touched by an admin.
     */
    public function isPendingVerification(): bool
    {
        return $this->verification_status?->isPending() ?? true;
    }

    /**
     * Check if this document has passed its expiration date.
     *
     * Documents with no expiration_date never expire.
     */
    public function isExpired(): bool
    {
        if ($this->expiration_date === null) {
            return false;
        }

        // isPast() returns true if the date is before today.
        return $this->expiration_date->isPast();
    }

    /**
     * Check if this document is fully valid for compliance purposes.
     *
     * A document is compliant only when all three conditions are met:
     *  1. An admin has verified and approved it.
     *  2. It has passed the antivirus scan.
     *  3. It has not expired.
     */
    public function isValid(): bool
    {
        return $this->isVerified()
            && $this->isSecure()
            && ! $this->isExpired();
    }

    /**
     * Has the uploader hidden this document from their own applicant view?
     *
     * Purely an applicant-visibility flag. Admin and medical queues ignore it.
     */
    public function isHiddenFromApplicant(): bool
    {
        return $this->applicant_hidden_at !== null;
    }

    /**
     * Is this document safe to permanently destroy (soft-delete + file purge)?
     *
     * True only when the document has no downstream consumers — it was never
     * submitted to staff, never inline-attached to a message, never referenced
     * by a message via the Phase 2 join table, and never archived.
     *
     * Any other document is a compliance artifact that must be preserved.
     * An applicant asking to "delete" one of those gets their view hidden
     * via applicant_hidden_at; the row and file stay intact for admins.
     *
     * Admins can still force-destroy regardless — this method only gates the
     * applicant-uploader pathway.
     */
    public function canForceDelete(): bool
    {
        return $this->isDraft()
            && $this->message_id === null
            && $this->archived_at === null
            // Phase 2: a doc linked as a reference attachment to any message
            // is part of that message's audit trail. Destroying it leaves
            // the message with a dangling reference; not safe.
            && $this->attachedToMessages()->doesntExist();
    }
}
