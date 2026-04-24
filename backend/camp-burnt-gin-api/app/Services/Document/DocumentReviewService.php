<?php

namespace App\Services\Document;

use App\Enums\DocumentVerificationStatus;
use App\Models\AuditLog;
use App\Models\Document;
use App\Models\DocumentReviewEvent;
use App\Models\User;
use App\Services\SystemNotificationService;
use Illuminate\Support\Facades\DB;

/**
 * DocumentReviewService — orchestrates approve/reject/send on Document records.
 *
 * Each method wraps DB::transaction so the document column mutations, request
 * state changes, review event creation, and notification delivery are atomic.
 *
 * Callers: DocumentController::verify(), DocumentController::submit().
 * Design D4: rejection reopens the originating DocumentRequest (if any) so the
 * applicant can resubmit without a new admin request action.
 */
class DocumentReviewService
{
    public function __construct(
        private readonly SystemNotificationService $notifications,
        private readonly DocumentMatchingService $matcher,
    ) {}

    /**
     * Approve a document's content.
     *
     * Marks the document approved, advances the linked DocumentRequest to Approved
     * (if present), records a review event, logs to AuditLog, and notifies the uploader.
     */
    public function approve(Document $document, User $admin, ?string $notes = null): Document
    {
        return DB::transaction(function () use ($document, $admin, $notes) {
            $document->update([
                'verification_status' => DocumentVerificationStatus::Approved,
                'verified_by' => $admin->id,
                'verified_at' => now(),
                'approved_by' => $admin->id,
                'approved_at' => now(),
                // Ensure approved documents are visible to DocumentEnforcementService.
                // The service requires submitted_at IS NOT NULL for admin compliance
                // checks; a document approved directly from draft state would otherwise
                // remain invisible and falsely appear as "missing" at the approval gate.
                'submitted_at' => $document->submitted_at ?? now(),
            ]);

            // Promote scan_passed if it was null (BUG-243 pattern).
            if ($document->scan_passed === null) {
                $document->update(['scan_passed' => true]);
            }

            // Advance the linked request to Approved terminal state.
            $request = $document->documentRequest;
            $request?->markApproved($admin);

            // Append to the review event timeline.
            DocumentReviewEvent::recordApproved($document->fresh(), $admin, $notes);

            // PHI-safe audit log.
            AuditLog::logAdminAction(
                'document_approved',
                $admin,
                $document,
                ['document_type' => $document->document_type]
            );

            // Notify the uploader (applicant).
            $uploader = $document->uploader;
            if ($uploader) {
                $camperName = $this->resolveCamperName($document);
                $this->notifications->documentApproved($uploader, $document->id, $document->document_type, $camperName);
            }

            return $document->fresh();
        });
    }

    /**
     * Reject a document's content with a required reason.
     *
     * Decision D4: after rejection the originating DocumentRequest (if any) flips
     * back to awaiting_upload, making the task reappear immediately in the
     * applicant's portal without a new admin re-request action.
     */
    public function reject(Document $document, User $admin, string $reason): Document
    {
        return DB::transaction(function () use ($document, $admin, $reason) {
            $document->update([
                'verification_status' => DocumentVerificationStatus::Rejected,
                'verified_by' => $admin->id,
                'verified_at' => now(),
                'rejected_by' => $admin->id,
                'rejected_at' => now(),
                'rejection_reason' => $reason,
            ]);

            // D4: reopen the request for resubmission instead of closing it.
            $request = $document->documentRequest;
            $request?->markRejectedAndReopen($reason, $admin);

            // Append to the review event timeline.
            DocumentReviewEvent::recordRejected($document->fresh(), $admin, $reason);

            // PHI-safe audit log.
            AuditLog::logAdminAction(
                'document_rejected',
                $admin,
                $document,
                ['document_type' => $document->document_type, 'reason' => $reason]
            );

            // Notify the uploader (applicant).
            $uploader = $document->uploader;
            if ($uploader) {
                $camperName = $this->resolveCamperName($document);
                $this->notifications->documentRejected($uploader, $document->id, $document->document_type, $camperName, $reason);
            }

            return $document->fresh();
        });
    }

    /**
     * Record that an applicant sent a document to admin review.
     *
     * Matches the document to its originating request (if any), transitions the
     * request to UnderReview, appends a review event, and notifies admins.
     *
     * Resubmission detection: if the linked request has a prior 'rejected' review
     * event, this send is a resubmission — record Resubmitted instead of Sent so
     * the timeline accurately reflects the retry cycle.
     *
     * Called from DocumentController::submit() after setting submitted_at.
     */
    public function recordSent(Document $document, User $sender): Document
    {
        return DB::transaction(function () use ($document, $sender) {
            // Link to originating request.
            $request = $this->matcher->matchAndLink($document);

            // Advance request to UnderReview so it no longer shows "Awaiting Upload".
            $request?->markUnderReview();

            // Detect resubmission: this send follows a prior rejection on the same request.
            $isResubmission = $request && \App\Models\DocumentReviewEvent::where('document_request_id', $request->id)
                ->where('action', \App\Enums\DocumentReviewAction::Rejected->value)
                ->exists();

            if ($isResubmission) {
                \App\Models\DocumentReviewEvent::recordResubmitted($document->fresh(), $sender);
            } else {
                DocumentReviewEvent::recordSent($document->fresh(), $sender, $request);
            }

            // Notify admins that a new document is in the queue.
            $camperName = $this->resolveCamperName($document);
            $this->notifications->documentSent($sender, $document->id, $document->document_type, $camperName);

            return $document->fresh();
        });
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private function resolveCamperName(Document $document): ?string
    {
        if ($document->documentable_type === 'App\Models\Camper') {
            /** @var \App\Models\Camper|null $camper */
            $camper = $document->documentable;

            return $camper?->full_name;
        }

        if ($document->documentable_type === 'App\Models\Application') {
            /** @var \App\Models\Application|null $app */
            $app = $document->documentable;

            return $app?->camper?->full_name;
        }

        return null;
    }
}
