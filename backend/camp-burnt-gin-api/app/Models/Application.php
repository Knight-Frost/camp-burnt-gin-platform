<?php

namespace App\Models;

use App\Enums\ApplicationStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Application model representing a camper's registration request.
 *
 * Applications track a camper's enrollment request for a specific
 * camp session, including the review workflow and final decision.
 */
class Application extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',
        'camp_session_id',
        'status',
        'is_draft',
        'submitted_at',
        'reviewed_at',
        'reviewed_by',
        'notes',
        'signature_data',
        'signature_name',
        'signed_at',
        'signed_ip_address',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ApplicationStatus::class,
            'is_draft' => 'boolean',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'signed_at' => 'datetime',
        ];
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'signature_data',
    ];

    /**
     * Get the camper associated with this application.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the camp session this application is for.
     */
    public function campSession(): BelongsTo
    {
        return $this->belongsTo(CampSession::class);
    }

    /**
     * Get the user who reviewed this application.
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Determine if the application has been reviewed.
     */
    public function isReviewed(): bool
    {
        return $this->reviewed_at !== null;
    }

    /**
     * Determine if the application status is final.
     */
    public function isFinal(): bool
    {
        return $this->status->isFinal();
    }

    /**
     * Determine if the application can be edited.
     */
    public function isEditable(): bool
    {
        return $this->is_draft || $this->status->isEditable();
    }

    /**
     * Determine if the application is a draft.
     */
    public function isDraft(): bool
    {
        return $this->is_draft === true;
    }

    /**
     * Determine if the application has been signed.
     */
    public function isSigned(): bool
    {
        return $this->signed_at !== null;
    }

    /**
     * Scope to filter only draft applications.
     */
    public function scopeDraft($query)
    {
        return $query->where('is_draft', true);
    }

    /**
     * Scope to filter only submitted applications.
     */
    public function scopeSubmitted($query)
    {
        return $query->where('is_draft', false)->whereNotNull('submitted_at');
    }

    /**
     * Scope to filter by status.
     */
    public function scopeWithStatus($query, ApplicationStatus|string $status)
    {
        $statusValue = $status instanceof ApplicationStatus ? $status->value : $status;

        return $query->where('status', $statusValue);
    }
}
