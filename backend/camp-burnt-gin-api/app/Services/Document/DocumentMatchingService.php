<?php

namespace App\Services\Document;

use App\Enums\DocumentRequestStatus;
use App\Models\Document;
use App\Models\DocumentRequest;

/**
 * DocumentMatchingService — links a newly-sent document to its originating request.
 *
 * Decision D1: single FK (documents.document_request_id). Priority rules:
 *   1. Document already has an explicit document_request_id set at upload — use it.
 *   2. Match by (camper, application, document_type) — most precise scope.
 *   3. Match by (camper, document_type) — drop application_id, still camper-scoped.
 *   4. No match — document fulfils no known request; leave null.
 *
 * IMPORTANT: matching NEVER crosses camper boundaries. Passing a null camper_id
 * intentionally disables cross-camper matching (not a fallback).
 */
class DocumentMatchingService
{
    /**
     * Resolve and persist the best-matching DocumentRequest for a sent Document.
     *
     * Returns the matched request (or null). Sets document_request_id on the
     * Document row so callers do not need to do it themselves.
     */
    public function matchAndLink(Document $document): ?DocumentRequest
    {
        // Priority 1: already explicitly linked at upload time — nothing to do.
        if ($document->document_request_id !== null) {
            return DocumentRequest::find($document->document_request_id);
        }

        $camperId = $this->resolveCamperId($document);

        // Cannot match without camper scope — enforces cross-camper isolation.
        if ($camperId === null) {
            return null;
        }

        $applicationId = $document->documentable_type === 'App\Models\Application'
            ? $document->documentable_id
            : null;

        $request = $this->findOpenRequest($camperId, $applicationId, $document->document_type);

        if ($request) {
            $document->update(['document_request_id' => $request->id]);
        }

        return $request;
    }

    /**
     * Find the oldest open (unresolved) request for a camper + type combination.
     *
     * "Open" means the request is waiting for an upload or was previously rejected
     * and reopened (D4: rejection flips status back to awaiting_upload).
     *
     * Tries application-scoped match first; falls back to camper-only scope.
     */
    public function findOpenRequest(
        int $camperId,
        ?int $applicationId,
        ?string $documentType
    ): ?DocumentRequest {
        if ($documentType === null) {
            return null;
        }

        $openStatuses = [
            DocumentRequestStatus::AwaitingUpload->value,
            DocumentRequestStatus::Overdue->value,
        ];

        // Priority 2: exact scope with application_id
        if ($applicationId !== null) {
            $request = DocumentRequest::where('camper_id', $camperId)
                ->where('application_id', $applicationId)
                ->where('document_type', $documentType)
                ->whereIn('status', $openStatuses)
                ->whereNull('deleted_at')
                ->oldest()
                ->first();

            if ($request) {
                return $request;
            }
        }

        // Priority 3: camper-only scope (no application constraint)
        return DocumentRequest::where('camper_id', $camperId)
            ->where('document_type', $documentType)
            ->whereIn('status', $openStatuses)
            ->whereNull('deleted_at')
            ->oldest()
            ->first();
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private function resolveCamperId(Document $document): ?int
    {
        if ($document->documentable_type === 'App\Models\Camper') {
            return $document->documentable_id;
        }

        if ($document->documentable_type === 'App\Models\Application') {
            $app = \App\Models\Application::find($document->documentable_id);

            return $app?->camper_id;
        }

        return null;
    }
}
