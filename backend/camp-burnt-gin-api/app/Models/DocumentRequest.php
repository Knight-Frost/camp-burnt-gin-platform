<?php

namespace App\Models;

use App\Enums\DocumentRequestStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * DocumentRequest — tracks admin-initiated document request lifecycle.
 *
 * Lifecycle:
 *   awaiting_upload → uploaded → scanning → under_review → approved
 *                                                        ↘ rejected → awaiting_upload
 *
 * Each request is linked to an inbox conversation so the applicant receives
 * notifications and status updates in their inbox.
 */
class DocumentRequest extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'applicant_id',
        'application_id',
        'camper_id',
        'requested_by_admin_id',
        'document_type',
        'instructions',
        'status',
        'due_date',
        'uploaded_document_path',
        'uploaded_file_name',
        'uploaded_mime_type',
        'uploaded_at',
        'reviewed_by_admin_id',
        'reviewed_at',
        'rejection_reason',
        'conversation_id',
    ];

    protected $casts = [
        'status' => DocumentRequestStatus::class,
        'due_date' => 'date',
        'uploaded_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    // ── Relationships ──────────────────────────────────────────────────────────

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'applicant_id');
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class, 'application_id');
    }

    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class, 'camper_id');
    }

    public function requestedByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_admin_id');
    }

    public function reviewedByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_admin_id');
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class, 'conversation_id');
    }

    /**
     * All documents uploaded in response to this request (newest last).
     */
    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'document_request_id')->orderBy('created_at');
    }

    /**
     * The most recently uploaded document for this request.
     */
    public function latestDocument(): HasOne
    {
        return $this->hasOne(Document::class, 'document_request_id')->latestOfMany('created_at');
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Returns true if the applicant is allowed to upload a document.
     */
    public function canUpload(): bool
    {
        return $this->status->canUpload();
    }

    /**
     * Returns true if this request is past its due date with no upload.
     */
    public function isOverdue(): bool
    {
        if (! $this->due_date) {
            return false;
        }

        return $this->status->canUpload() && $this->due_date->isPast();
    }

    /**
     * Record the admin's rejection decision and reopen the request for resubmission.
     *
     * Decision D4: rejecting a document does not close the request — the same
     * DocumentRequest flips back to awaiting_upload so the applicant sees the
     * task reappear immediately without a new admin re-request action.
     */
    public function markRejectedAndReopen(string $reason, User $admin): void
    {
        $this->update([
            'status' => DocumentRequestStatus::AwaitingUpload,
            'rejection_reason' => $reason,
            'reviewed_by_admin_id' => $admin->id,
            'reviewed_at' => now(),
        ]);
    }

    /**
     * Advance status to Approved and record the reviewing admin.
     */
    public function markApproved(User $admin): void
    {
        $this->update([
            'status' => DocumentRequestStatus::Approved,
            'reviewed_by_admin_id' => $admin->id,
            'reviewed_at' => now(),
        ]);
    }

    /**
     * Advance status to UnderReview when a document is sent by the applicant.
     */
    public function markUnderReview(): void
    {
        if ($this->status === DocumentRequestStatus::AwaitingUpload
            || $this->status === DocumentRequestStatus::Overdue) {
            $this->update(['status' => DocumentRequestStatus::UnderReview]);
        }
    }
}
