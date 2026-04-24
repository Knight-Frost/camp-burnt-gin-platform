<?php

namespace App\Models;

use App\Enums\DocumentReviewAction;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * DocumentReviewEvent — append-only timeline of every significant document action.
 *
 * This is a user-facing audit trail (distinct from AuditLog which is the HIPAA
 * compliance ledger). Each event represents a state change or notable action on a
 * document, queryable by document, request, application, or camper.
 *
 * Immutable: no updated_at, no soft deletes. Corrections appear as new events.
 */
class DocumentReviewEvent extends Model
{
    // No updated_at — this is an append-only ledger.
    const UPDATED_AT = null;

    protected $fillable = [
        'document_id',
        'document_request_id',
        'application_id',
        'camper_id',
        'action',
        'performed_by',
        'reason',
        'notes',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'action' => DocumentReviewAction::class,
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────────────────

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function documentRequest(): BelongsTo
    {
        return $this->belongsTo(DocumentRequest::class);
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    public function performer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performed_by');
    }

    // ── Factory helpers ────────────────────────────────────────────────────────

    /**
     * Record that an admin created a document request.
     *
     * document_id is null here — no document exists yet at request creation time.
     * The column was made nullable (migration 2026_04_23_000005) specifically to
     * support pre-upload lifecycle events like this one.
     */
    public static function recordRequested(
        DocumentRequest $request,
        User $admin
    ): self {
        return self::create([
            'document_id' => null,
            'document_request_id' => $request->id,
            'application_id' => $request->application_id,
            'camper_id' => $request->camper_id,
            'action' => DocumentReviewAction::Requested,
            'performed_by' => $admin->id,
        ]);
    }

    /**
     * Record that an applicant sent (submitted) a document to admin review.
     */
    public static function recordSent(
        Document $document,
        User $uploader,
        ?DocumentRequest $request = null
    ): self {
        return self::create([
            'document_id' => $document->id,
            'document_request_id' => $request?->id ?? $document->document_request_id,
            'application_id' => $document->documentable_type === 'App\Models\Application'
                ? $document->documentable_id : null,
            'camper_id' => self::resolveCamperId($document),
            'action' => DocumentReviewAction::Sent,
            'performed_by' => $uploader->id,
        ]);
    }

    /**
     * Record that an admin approved a document.
     */
    public static function recordApproved(
        Document $document,
        User $admin,
        ?string $notes = null
    ): self {
        return self::create([
            'document_id' => $document->id,
            'document_request_id' => $document->document_request_id,
            'application_id' => $document->documentable_type === 'App\Models\Application'
                ? $document->documentable_id : null,
            'camper_id' => self::resolveCamperId($document),
            'action' => DocumentReviewAction::Approved,
            'performed_by' => $admin->id,
            'notes' => $notes,
        ]);
    }

    /**
     * Record that an admin rejected a document with a required reason.
     */
    public static function recordRejected(
        Document $document,
        User $admin,
        string $reason,
        ?string $notes = null
    ): self {
        return self::create([
            'document_id' => $document->id,
            'document_request_id' => $document->document_request_id,
            'application_id' => $document->documentable_type === 'App\Models\Application'
                ? $document->documentable_id : null,
            'camper_id' => self::resolveCamperId($document),
            'action' => DocumentReviewAction::Rejected,
            'performed_by' => $admin->id,
            'reason' => $reason,
            'notes' => $notes,
        ]);
    }

    /**
     * Record that an admin approved a document request that has no linked Document row.
     *
     * Used for standalone document requests where the file is stored directly
     * on the document_requests row (not via the Document polymorphic system).
     * document_id is null; document_request_id carries the audit reference.
     */
    public static function recordApprovedForRequest(
        DocumentRequest $request,
        User $admin
    ): self {
        return self::create([
            'document_id' => null,
            'document_request_id' => $request->id,
            'application_id' => $request->application_id,
            'camper_id' => $request->camper_id,
            'action' => DocumentReviewAction::Approved,
            'performed_by' => $admin->id,
        ]);
    }

    /**
     * Record that an admin rejected a document request that has no linked Document row.
     *
     * Used for standalone document requests where the file is stored directly
     * on the document_requests row. document_id is null; reason is required.
     */
    public static function recordRejectedForRequest(
        DocumentRequest $request,
        User $admin,
        string $reason
    ): self {
        return self::create([
            'document_id' => null,
            'document_request_id' => $request->id,
            'application_id' => $request->application_id,
            'camper_id' => $request->camper_id,
            'action' => DocumentReviewAction::Rejected,
            'performed_by' => $admin->id,
            'reason' => $reason,
        ]);
    }

    /**
     * Record that an overdue detection job marked this request as overdue.
     * performed_by is null — system-generated event.
     *
     * document is nullable: overdue events most commonly fire when no upload
     * has occurred yet, so there is no Document row to reference.
     */
    public static function recordOverdue(
        DocumentRequest $request,
        ?Document $document = null
    ): self {
        return self::create([
            'document_id' => $document?->id,
            'document_request_id' => $request->id,
            'application_id' => $request->application_id,
            'camper_id' => $request->camper_id,
            'action' => DocumentReviewAction::Overdue,
            'performed_by' => null,
        ]);
    }

    /**
     * Record that an applicant resubmitted after a rejection.
     */
    public static function recordResubmitted(
        Document $document,
        User $uploader
    ): self {
        return self::create([
            'document_id' => $document->id,
            'document_request_id' => $document->document_request_id,
            'application_id' => $document->documentable_type === 'App\Models\Application'
                ? $document->documentable_id : null,
            'camper_id' => self::resolveCamperId($document),
            'action' => DocumentReviewAction::Resubmitted,
            'performed_by' => $uploader->id,
        ]);
    }

    /**
     * Record an application-level lifecycle event (Start Review, Approve,
     * Reject, Waitlist, Cancel, Reopen).
     *
     * document_id is null for these rows — the event pertains to the
     * application as a whole, not a single file. application_id + camper_id
     * are set so the review-history endpoint's where('application_id', ...)
     * query picks them up alongside document events, giving reviewers a
     * single interleaved timeline.
     *
     * The action enum must be one where isApplicationLevel() is true; the
     * method accepts any value to stay open to future additions but callers
     * should stick to the application-level cases.
     */
    public static function recordApplicationEvent(
        Application $application,
        User $admin,
        DocumentReviewAction $action,
        ?string $notes = null,
        ?string $reason = null,
    ): self {
        return self::create([
            'document_id' => null,
            'document_request_id' => null,
            'application_id' => $application->id,
            'camper_id' => $application->camper_id,
            'action' => $action,
            'performed_by' => $admin->id,
            'notes' => $notes,
            'reason' => $reason,
        ]);
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private static function resolveCamperId(Document $document): ?int
    {
        if ($document->documentable_type === 'App\Models\Camper') {
            return $document->documentable_id;
        }

        if ($document->documentable_type === 'App\Models\Application') {
            return optional($document->documentable)->camper_id;
        }

        return null;
    }
}
