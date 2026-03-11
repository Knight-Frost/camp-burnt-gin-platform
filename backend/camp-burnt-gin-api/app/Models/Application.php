<?php

namespace App\Models;

use App\Enums\ApplicationStatus;
use App\Models\FormDefinition;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * Application model — records a camper's request to attend a specific camp session.
 *
 * The lifecycle of an application moves through several states:
 *   draft → submitted → under_review → approved / waitlisted / denied
 *
 * Key design points:
 *  - is_draft lets parents save progress before final submission.
 *  - signature_data stores the legal consent signature and is hidden from API
 *    responses to avoid exposing the raw image/base64 blob unnecessarily.
 *  - Documents (medical forms, permission slips) attach to an application via a
 *    polymorphic relationship so one Document model serves multiple owner types.
 *  - 'session' is exposed as a virtual attribute alias of campSession so the
 *    frontend can use application.session everywhere consistently.
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
        'camper_id',            // Which camper this application is for.
        'camp_session_id',      // Which specific session they want to attend.
        'form_definition_id',   // FK to the form version active at submission time (nullable; null = pre-Phase 14).
        'status',               // Current workflow state (ApplicationStatus enum).
        'is_draft',             // True while the parent is still filling it out.
        'submitted_at',         // Timestamp when the parent officially submitted.
        'reviewed_at',          // Timestamp when an admin completed their review.
        'reviewed_by',          // FK to the User who performed the review.
        'notes',                // Admin notes visible only internally.
        'signature_data',       // Raw signature image/data — hidden from API output.
        'signature_name',       // Typed name accompanying the signature.
        'signed_at',            // When the signature was captured.
        'signed_ip_address',    // IP address for legal proof of consent.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Automatically resolves the stored string to an ApplicationStatus enum value.
            'status'       => ApplicationStatus::class,
            'is_draft'     => 'boolean',
            // Carbon datetime objects for easy comparison and formatting.
            'submitted_at' => 'datetime',
            'reviewed_at'  => 'datetime',
            'signed_at'    => 'datetime',
        ];
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * signature_data is hidden so the raw consent image is never leaked in an
     * API response. It can be accessed directly on the model when truly needed.
     *
     * @var list<string>
     */
    protected $hidden = [
        'signature_data',
    ];

    /**
     * Virtual attributes appended to JSON/array output.
     *
     * Adding 'session' here makes Laravel automatically call getSessionAttribute()
     * and include the result in every API response as application.session,
     * so the frontend does not need to reference the underlying campSession key.
     *
     * @var list<string>
     */
    protected $appends = ['session'];

    /**
     * Get documents attached to this application (polymorphic).
     *
     * MorphMany means Document rows can belong to ANY model type, not just Application.
     * The 'documentable' morph name is stored as documentable_type + documentable_id
     * in the documents table.
     */
    public function documents(): MorphMany
    {
        return $this->morphMany(Document::class, 'documentable');
    }

    /**
     * Get the camper this application was submitted for.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the camp session this application is requesting enrollment in.
     */
    public function campSession(): BelongsTo
    {
        return $this->belongsTo(CampSession::class);
    }

    /**
     * Expose campSession data under the key 'session' in JSON output.
     *
     * getRelationValue() returns the already-loaded relation without triggering
     * a new query, keeping this accessor safe to call inside loops.
     */
    public function getSessionAttribute(): mixed
    {
        return $this->getRelationValue('campSession');
    }

    /**
     * Get the admin user who reviewed this application.
     *
     * Uses 'reviewed_by' as the foreign key instead of the default 'user_id'.
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Get the form definition version that was active when this application was submitted.
     *
     * Null means the application predates the dynamic form system (Phase 14).
     * Those applications are rendered using the current active definition for display.
     */
    public function formDefinition(): BelongsTo
    {
        return $this->belongsTo(FormDefinition::class);
    }

    /**
     * Determine if an admin has already reviewed this application.
     */
    public function isReviewed(): bool
    {
        // reviewed_at is only set once the admin records a decision.
        return $this->reviewed_at !== null;
    }

    /**
     * Determine if the application status is terminal (cannot change further).
     *
     * Delegates to the ApplicationStatus enum so the business rule lives in one place.
     */
    public function isFinal(): bool
    {
        return $this->status->isFinal();
    }

    /**
     * Determine if the application can still be edited by the parent.
     *
     * A draft can always be edited. A non-draft can be edited if its status
     * is still in an editable state (e.g. "returned for corrections").
     */
    public function isEditable(): bool
    {
        return $this->is_draft || $this->status->isEditable();
    }

    /**
     * Determine if this application is still a draft (not yet submitted).
     */
    public function isDraft(): bool
    {
        return $this->is_draft === true;
    }

    /**
     * Determine if the legal consent signature has been collected.
     */
    public function isSigned(): bool
    {
        return $this->signed_at !== null;
    }

    /**
     * Query scope — filter only draft (unsubmitted) applications.
     *
     * Usage: Application::draft()->get()
     */
    public function scopeDraft($query)
    {
        return $query->where('is_draft', true);
    }

    /**
     * Query scope — filter only formally submitted applications.
     *
     * Both conditions are required: is_draft must be false AND
     * submitted_at must be set (guards against partially-updated rows).
     */
    public function scopeSubmitted($query)
    {
        return $query->where('is_draft', false)->whereNotNull('submitted_at');
    }

    /**
     * Query scope — filter applications by a specific status value.
     *
     * Accepts either the enum instance or a raw string value so callers
     * are not forced to import the enum when building dynamic queries.
     */
    public function scopeWithStatus($query, ApplicationStatus|string $status)
    {
        // Normalise enum to its raw database string before passing to the query.
        $statusValue = $status instanceof ApplicationStatus ? $status->value : $status;

        return $query->where('status', $statusValue);
    }
}
