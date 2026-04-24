/**
 * ReviewerDocumentsPanel — live documents + outstanding requests for the
 * application being reviewed.
 *
 * Purpose: close the audit gap where reviewers had no single pane showing
 * every ask and every submitted file for the current application. Before this
 * panel, the canonical snapshot in the left column was the only place a
 * document appeared, and it was a frozen projection — approvals did not
 * update it without a full page refetch.
 *
 * Data sources (both introduced in Phase 1):
 *   - GET /applications/{id}/documents         — live Document records
 *   - GET /applications/{id}/document-requests — admin-issued asks
 *
 * The panel aggressively refreshes after any approve/reject action so the
 * UI never lags behind the server's notion of truth. It uses the shared
 * `DocumentStatusBadge` so wording matches the Document Control Center and
 * Applicant Documents page.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronUp, RefreshCw, Send,
} from 'lucide-react';
import { format } from 'date-fns';

import {
  getApplicationDocuments,
  getApplicationDocumentRequests,
  verifyDocument,
  type ReviewerApplicationDocument,
  type ReviewerDocumentRequest,
} from '@/features/admin/api/admin.api';
import { DocumentStatusBadge } from '@/ui/components/DocumentStatusBadge';
import {
  mapRequestStatus,
  resolveDocumentStatus,
  type DocumentUIStatus,
} from '@/shared/constants/documentStatuses';
import { getDocumentLabel } from '@/shared/constants/documentRequirements';
import {
  CollapsibleDocumentCard,
  type DocumentCardStatus,
} from '@/features/admin/components/review/CollapsibleDocumentCard';

/**
 * Translate the canonical 8-state UI vocabulary to the CollapsibleDocumentCard's
 * legacy status set. Admin-facing surfaces never see 'draft' (drafts are the
 * applicant's private staging area and filtered out server-side), so that case
 * maps defensively to awaiting_upload. Every other state has a direct analog.
 */
const UI_TO_CARD_STATUS: Record<DocumentUIStatus, DocumentCardStatus> = {
  missing:       'missing',
  requested:     'requested',
  draft:         'awaiting_upload',
  submitted:     'sent',
  under_review:  'under_review',
  approved:      'approved',
  rejected:      'rejected',
  overdue:       'overdue',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  applicationId: number;
  /** When true, approve/reject controls render. Usually matches ReviewPanel's canEdit. */
  canEdit: boolean;
  /**
   * Callback fired after an approve/reject action succeeds. Parent uses this
   * to refetch the canonical application projection so the left-column
   * snapshot updates along with this panel.
   */
  onDocumentActioned?: () => void;
  /**
   * Preview + download are delegated to the parent since the page already
   * owns a PreviewModal. Pass the document id; parent looks up the url and
   * renders the modal using its existing state.
   */
  onPreviewDocument?: (docId: number) => void;
  onDownloadDocument?: (docId: number) => void;
  /** Used by the parent to request a rejection reason via its existing modal. */
  onRequestReject?: (doc: ReviewerApplicationDocument) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReviewerDocumentsPanel({
  applicationId, canEdit,
  onDocumentActioned, onPreviewDocument, onDownloadDocument, onRequestReject,
}: Props) {
  const [documents, setDocuments]   = useState<ReviewerApplicationDocument[]>([]);
  const [requests,  setRequests]    = useState<ReviewerDocumentRequest[]>([]);
  const [loading,   setLoading]     = useState(true);
  const [actioning, setActioning]   = useState<number | null>(null);
  const [expanded,  setExpanded]    = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      getApplicationDocuments(applicationId),
      getApplicationDocumentRequests(applicationId),
    ]).then(([docsResult, reqsResult]) => {
      if (docsResult.status === 'fulfilled') setDocuments(docsResult.value);
      if (reqsResult.status === 'fulfilled') setRequests(reqsResult.value);
    }).finally(() => setLoading(false));
  }, [applicationId]);

  useEffect(load, [load]);

  // Match a document to its originating request (if any) so the badge can
  // reflect request-level state (overdue, rejected-and-awaiting-resubmit).
  const statusForDocument = (doc: ReviewerApplicationDocument): DocumentUIStatus => {
    const req = doc.document_request_id
      ? requests.find((r) => r.id === doc.document_request_id)
      : undefined;
    return resolveDocumentStatus({
      request: req
        ? { status: req.status, is_overdue: req.is_overdue }
        : undefined,
      document: {
        verification_status: doc.verification_status,
        submitted_at: doc.submitted_at,
      },
    });
  };

  // Requests the reviewer hasn't seen fulfilled yet — awaiting_upload or
  // overdue. Requests that have a matching document already show that
  // document in the Documents list below with the same badge, so filtering
  // them out here prevents double-display.
  const pendingRequests = requests.filter((r) =>
    !r.latest_document_id
    && (r.status === 'awaiting_upload' || r.status === 'overdue' || r.is_overdue),
  );

  async function handleApprove(doc: ReviewerApplicationDocument) {
    setActioning(doc.id);
    try {
      await verifyDocument(doc.id, 'approved');
      toast.success('Document approved.');
      load();
      onDocumentActioned?.();
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      toast.error(msg ? `Approve failed: ${msg}` : 'Approve failed.');
    } finally {
      setActioning(null);
    }
  }

  function handleReject(doc: ReviewerApplicationDocument) {
    // Rejection needs a reason — the parent page already owns a modal for
    // that exact flow, so delegate upward rather than duplicating it here.
    onRequestReject?.(doc);
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--glass-light)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:opacity-80 transition-opacity"
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Documents
        </span>
        <span className="flex items-center gap-1.5">
          {(documents.length + pendingRequests.length) > 0 && (
            <span
              className="text-xs rounded-full px-1.5 py-0.5 font-medium"
              style={{ background: 'var(--glass-medium)', color: 'var(--muted-foreground)' }}
            >
              {documents.length + pendingRequests.length}
            </span>
          )}
          {expanded
            ? <ChevronUp className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
            : <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {loading && (
            <p className="text-xs py-2" style={{ color: 'var(--muted-foreground)' }}>
              Loading documents…
            </p>
          )}

          {!loading && documents.length === 0 && pendingRequests.length === 0 && (
            <p className="text-xs py-2" style={{ color: 'var(--muted-foreground)' }}>
              No documents or requests for this application yet.
            </p>
          )}

          {/* ── Pending requests (no document uploaded yet) ─────────── */}
          {!loading && pendingRequests.length > 0 && (
            <div className="mb-3">
              <p
                className="text-xs uppercase tracking-wide font-semibold mb-1.5"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Awaiting upload
              </p>
              <ul className="space-y-2">
                {pendingRequests.map((req) => {
                  const status = mapRequestStatus(req.status, req.is_overdue);
                  return (
                    <li
                      key={`req-${req.id}`}
                      className="rounded-lg border px-3 py-2"
                      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs font-medium truncate"
                            style={{ color: 'var(--foreground)' }}
                          >
                            {getDocumentLabel(req.document_type, 'admin')}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <DocumentStatusBadge status={status} />
                            {req.due_date && (
                              <span
                                className="text-xs"
                                style={{ color: 'var(--muted-foreground)' }}
                              >
                                Due {format(new Date(req.due_date), 'MMM d')}
                              </span>
                            )}
                          </div>
                          {req.requested_by && (
                            <p
                              className="text-xs mt-1"
                              style={{ color: 'var(--muted-foreground)' }}
                            >
                              Requested by {req.requested_by.name}
                              {' · '}
                              {format(new Date(req.created_at), 'MMM d')}
                            </p>
                          )}
                        </div>
                        <Send className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* ── Uploaded documents ──────────────────────────────────── */}
          {/*
            Each document renders through the shared CollapsibleDocumentCard
            so collapse/expand behavior matches the Paper Application Packet
            and every other document surface on the review page. "No
            exceptions" per the design brief — one card, one pattern.
          */}
          {!loading && documents.length > 0 && (
            <div>
              {pendingRequests.length > 0 && (
                <p
                  className="text-xs uppercase tracking-wide font-semibold mb-1.5"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Uploaded
                </p>
              )}
              <div className="space-y-2">
                {documents.map((doc) => {
                  const uiStatus = statusForDocument(doc);
                  const cardStatus = UI_TO_CARD_STATUS[uiStatus];
                  const canAct = canEdit
                    && doc.verification_status === 'pending'
                    && doc.submitted_at !== null;
                  const isActing = actioning === doc.id;
                  return (
                    <CollapsibleDocumentCard
                      key={doc.id}
                      title={getDocumentLabel(doc.document_type ?? '', 'admin')}
                      fileName={doc.original_filename ?? undefined}
                      status={cardStatus}
                      uploadedBy={doc.uploader?.name}
                      uploadedAt={doc.submitted_at ?? undefined}
                      rejectionReason={doc.rejection_reason ?? undefined}
                      canReview={canAct}
                      actionsDisabled={isActing}
                      onApprove={canAct ? () => void handleApprove(doc) : undefined}
                      onReject={canAct ? () => handleReject(doc) : undefined}
                      onPreview={onPreviewDocument ? () => onPreviewDocument(doc.id) : undefined}
                      onDownload={onDownloadDocument ? () => onDownloadDocument(doc.id) : undefined}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Unused warning silencers — kept so future row variants have
              easy access without re-importing. */}
          <span className="hidden">
            <DocumentStatusBadge status="missing" />
            {format(new Date(), 'yyyy')}
          </span>
        </div>
      )}

      {/* Inline refresh control — useful when the reviewer has opened the
          page before the applicant sends a document and wants to pull the
          latest without a full page reload. */}
      {!loading && (
        <button
          type="button"
          onClick={load}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs border-t hover:opacity-80 transition-opacity"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--glass-medium)',
            color: 'var(--muted-foreground)',
          }}
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      )}

    </div>
  );
}
