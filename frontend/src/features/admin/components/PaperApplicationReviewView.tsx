/**
 * PaperApplicationReviewView — admin review panel for paper-submitted applications.
 *
 * Renders three sections in the left column:
 *   1. Paper Packet Viewer — the uploaded PDF/image, with collapse/fullscreen/download.
 *   2. Required Supporting Documents — read-only checklist (approved / pending / missing).
 *      NO actions here — that work happens in section 3.
 *   3. Supporting Documents — the main work area. Every uploaded doc and every
 *      outstanding request for this application, all as CollapsibleDocumentCards
 *      with Verify / Reject / Preview / Download controls.
 *
 * Data source: live API calls — NOT the frozen canonical snapshot. This ensures
 * documents uploaded after the initial page load appear immediately without a
 * full refetch. Parent bumps `refreshKey` after any verify/reject action so this
 * component re-fetches and the checklist updates in the same tick.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle, CheckCircle, ChevronDown, ChevronUp,
  Clock, Download, Eye, FileText, Maximize2, Minimize2,
} from 'lucide-react';

import { Button } from '@/ui/components/Button';
import axiosInstance from '@/api/axios.config';
import {
  PAPER_REQUIRED_DOC_TYPES,
  getDocumentLabel,
} from '@/shared/constants/documentRequirements';
import {
  approveDocumentRequest,
  downloadDocumentRequestFile,
  getApplicationDocuments,
  getApplicationDocumentRequests,
  rejectDocumentRequest,
  type ReviewerApplicationDocument,
  type ReviewerDocumentRequest,
} from '@/features/admin/api/admin.api';
import {
  CollapsibleDocumentCard,
  type DocumentCardStatus,
} from '@/features/admin/components/review/CollapsibleDocumentCard';
import {
  mapRequestStatus,
  resolveDocumentStatus,
  type DocumentUIStatus,
} from '@/shared/constants/documentStatuses';

const PAPER_PACKET_DOCUMENT_TYPE = 'paper_application_packet';

// ── UI-status → card-status translation ───────────────────────────────────────
const UI_TO_CARD: Record<DocumentUIStatus, DocumentCardStatus> = {
  missing:      'missing',
  requested:    'requested',
  draft:        'awaiting_upload',
  submitted:    'sent',
  under_review: 'under_review',
  approved:     'approved',
  rejected:     'rejected',
  overdue:      'overdue',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  applicationId: number;
  /**
   * Incrementing counter — parent bumps after any verify/reject action. Causes
   * this component to refetch docs and refresh the checklist + cards.
   */
  refreshKey?: number;
  onPreviewDocument: (doc: ReviewerApplicationDocument) => void;
  onDownloadDocument: (doc: ReviewerApplicationDocument) => void;
  adminDocumentActions?: {
    onVerify: (doc: ReviewerApplicationDocument) => void;
    onReject:  (doc: ReviewerApplicationDocument) => void;
    disabled:  boolean;
  };
}

// ── Root component ─────────────────────────────────────────────────────────────

export function PaperApplicationReviewView({
  applicationId,
  refreshKey = 0,
  onPreviewDocument,
  onDownloadDocument,
  adminDocumentActions,
}: Props) {
  const [documents, setDocuments] = useState<ReviewerApplicationDocument[]>([]);
  const [requests,  setRequests]  = useState<ReviewerDocumentRequest[]>([]);
  const [loading,   setLoading]   = useState(true);

  // Document-request action state (separate from Document actions handled by parent)
  const [verifyingReqId,    setVerifyingReqId]    = useState<number | null>(null);
  const [reqRejectionTarget, setReqRejectionTarget] = useState<{ id: number; uploadedFileName: string | null } | null>(null);
  const [reqRejectionReason, setReqRejectionReason] = useState('');

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

  // Refetch on mount and whenever parent bumps refreshKey (post verify/reject).
  useEffect(load, [load, refreshKey]);

  async function handlePreviewDocumentRequest(req: ReviewerDocumentRequest) {
    const blob = await downloadDocumentRequestFile(req.id);
    window.open(URL.createObjectURL(blob), '_blank');
  }

  async function handleDownloadDocumentRequest(req: ReviewerDocumentRequest) {
    const blob = await downloadDocumentRequestFile(req.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = req.uploaded_file_name ?? `document-request-${req.id}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleApproveDocumentRequest(req: ReviewerDocumentRequest) {
    if (verifyingReqId !== null) return;
    setVerifyingReqId(req.id);
    try {
      await approveDocumentRequest(req.id);
      load();
    } finally {
      setVerifyingReqId(null);
    }
  }

  function handleInitiateRejectDocumentRequest(req: ReviewerDocumentRequest) {
    setReqRejectionTarget({ id: req.id, uploadedFileName: req.uploaded_file_name });
    setReqRejectionReason('');
  }

  async function handleConfirmRejectDocumentRequest() {
    if (!reqRejectionTarget || !reqRejectionReason.trim()) return;
    setVerifyingReqId(reqRejectionTarget.id);
    try {
      await rejectDocumentRequest(reqRejectionTarget.id, reqRejectionReason.trim());
      setReqRejectionTarget(null);
      setReqRejectionReason('');
      load();
    } finally {
      setVerifyingReqId(null);
    }
  }

  const packetDoc     = documents.find((d) => d.document_type === PAPER_PACKET_DOCUMENT_TYPE) ?? null;
  const supportingDocs = documents.filter((d) => d.document_type !== PAPER_PACKET_DOCUMENT_TYPE);

  // All requests without a matched Document record — shown as standalone cards.
  // Approved and rejected (D4-reopened) requests MUST remain visible for audit
  // traceability; status-badge changes replace removal.
  const standaloneRequests = requests.filter((r) => !r.latest_document_id);

  return (
    <div className="flex flex-col gap-6">
      <PaperPacketViewer
        doc={packetDoc}
        onPreview={onPreviewDocument}
        onDownload={onDownloadDocument}
      />
      <RequiredDocumentsChecklist documents={supportingDocs} requests={requests} loading={loading} />
      <SupportingDocumentsList
        documents={supportingDocs}
        standaloneRequests={standaloneRequests}
        requests={requests}
        loading={loading}
        onPreview={onPreviewDocument}
        onDownload={onDownloadDocument}
        adminActions={adminDocumentActions}
        onPreviewRequest={handlePreviewDocumentRequest}
        onDownloadRequest={handleDownloadDocumentRequest}
        adminRequestActions={adminDocumentActions ? {
          onVerify: handleApproveDocumentRequest,
          onReject: handleInitiateRejectDocumentRequest,
          disabled: verifyingReqId !== null,
        } : undefined}
      />

      {/* Document-request rejection reason modal */}
      {reqRejectionTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="req-rejection-modal-title"
        >
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => setReqRejectionTarget(null)}
            className="absolute inset-0 w-full h-full cursor-default"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          />
          <div
            className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          >
            <h2
              id="req-rejection-modal-title"
              className="text-base font-semibold mb-1"
              style={{ color: 'var(--foreground)' }}
            >
              Reject Document
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
              The applicant will be notified and can resubmit.
              {reqRejectionTarget.uploadedFileName && (
                <span className="block mt-1 font-medium" style={{ color: 'var(--foreground)' }}>
                  {reqRejectionTarget.uploadedFileName}
                </span>
              )}
            </p>
            <div className="mb-5">
              <label
                htmlFor="req-rejection-reason"
                className="block text-xs font-medium mb-1"
                style={{ color: 'var(--foreground)' }}
              >
                Reason <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                id="req-rejection-reason"
                rows={3}
                value={reqRejectionReason}
                onChange={(e) => setReqRejectionReason(e.target.value)}
                placeholder="Explain what the applicant needs to fix or resubmit…"
                className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
                style={{
                  background: 'var(--glass-light)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReqRejectionTarget(null)}
                className="px-4 py-2 rounded-lg text-sm border transition-opacity hover:opacity-70"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectDocumentRequest}
                disabled={!reqRejectionReason.trim() || verifyingReqId !== null}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }}
              >
                Reject &amp; Notify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Paper packet viewer ────────────────────────────────────────────────────

type ViewerMode = 'collapsed' | 'normal' | 'fullscreen';

function PaperPacketViewer({
  doc,
  onPreview,
  onDownload,
}: {
  doc: ReviewerApplicationDocument | null;
  onPreview:  (doc: ReviewerApplicationDocument) => void;
  onDownload: (doc: ReviewerApplicationDocument) => void;
}) {
  const { t } = useTranslation();
  const [blobUrl,    setBlobUrl]    = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [loadError,  setLoadError]  = useState(false);
  const [mode,       setMode]       = useState<ViewerMode>('normal');

  useEffect(() => {
    if (mode !== 'fullscreen') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMode('normal'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  useEffect(() => {
    if (!doc) { setBlobUrl(null); return; }

    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setLoadError(false);

    axiosInstance
      .get(`/documents/${doc.id}/download`, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(res.data as Blob);
        setBlobUrl(createdUrl);
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [doc]);

  if (!doc) {
    return (
      <div
        className="rounded-2xl border p-6 flex items-start gap-4"
        style={{ background: 'rgba(220,38,38,0.05)', borderColor: 'rgba(220,38,38,0.20)' }}
      >
        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold" style={{ color: '#991b1b' }}>
            {t('admin.review.paper.no_packet_title', 'Paper packet not yet received')}
          </p>
          <p className="text-xs" style={{ color: '#991b1b' }}>
            {t(
              'admin.review.paper.no_packet_desc',
              "This application was flagged as paper-submitted but no scanned packet is attached. Upload the packet to review the family's answers.",
            )}
          </p>
        </div>
      </div>
    );
  }

  const isImage = doc.mime_type.startsWith('image/');

  const containerClass = mode === 'fullscreen'
    ? 'fixed inset-0 z-50 flex flex-col rounded-none'
    : 'rounded-2xl border overflow-hidden';

  const iframeStyle = mode === 'fullscreen'
    ? { flex: 1, border: 'none', minHeight: 0 } as const
    : { height: 720, border: 'none' } as const;

  return (
    <div
      className={containerClass}
      style={mode === 'fullscreen'
        ? { background: 'var(--card)' }
        : { background: 'var(--card)', borderColor: 'var(--border)' }
      }
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-4 px-5 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
              {t('admin.review.paper.packet_title', 'Paper Application Packet')}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
              {doc.original_filename ?? `Document #${doc.id}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {mode !== 'fullscreen' && (
            <button
              type="button"
              title={mode === 'collapsed'
                ? t('admin.review.paper.expand', 'Expand viewer')
                : t('admin.review.paper.collapse', 'Collapse viewer')}
              onClick={() => setMode(mode === 'collapsed' ? 'normal' : 'collapsed')}
              className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {mode === 'collapsed'
                ? <ChevronDown className="h-4 w-4" />
                : <ChevronUp   className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            title={mode === 'fullscreen'
              ? t('admin.review.paper.exit_fullscreen', 'Exit fullscreen')
              : t('admin.review.paper.enter_fullscreen', 'Fullscreen viewer')}
            onClick={() => setMode(mode === 'fullscreen' ? 'normal' : 'fullscreen')}
            className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {mode === 'fullscreen'
              ? <Minimize2 className="h-4 w-4" />
              : <Maximize2 className="h-4 w-4" />}
          </button>
          <Button size="sm" variant="ghost" onClick={() => onPreview(doc)} className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            {t('admin.review.paper.open_in_tab', 'Open in tab')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDownload(doc)} className="flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" />
            {t('common.download', 'Download')}
          </Button>
        </div>
      </div>

      {mode !== 'collapsed' && (
        <div
          className={mode === 'fullscreen' ? 'flex-1 flex flex-col' : ''}
          style={mode === 'fullscreen'
            ? { background: '#f9fafb', minHeight: 0 }
            : { background: '#f9fafb', minHeight: 640 }}
        >
          {loading && (
            <div className="flex items-center justify-center h-[640px]">
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t('admin.review.paper.loading_packet', 'Loading packet…')}
              </p>
            </div>
          )}
          {loadError && (
            <div className="flex items-center justify-center h-[640px] px-6">
              <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
                {t(
                  'admin.review.paper.load_error',
                  'The packet could not be previewed inline. Use "Open in tab" to view it, or "Download" to save it locally.',
                )}
              </p>
            </div>
          )}
          {!loading && !loadError && blobUrl && (
            isImage ? (
              <img
                src={blobUrl}
                alt={doc.original_filename ?? 'Paper application packet'}
                className={mode === 'fullscreen' ? 'w-full flex-1 object-contain' : 'w-full h-auto'}
                style={mode === 'fullscreen' ? { minHeight: 0 } : { maxHeight: 720, objectFit: 'contain' }}
              />
            ) : (
              <iframe
                src={blobUrl}
                title="Paper application packet"
                className="w-full"
                style={iframeStyle}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Required documents checklist ───────────────────────────────────────────

/**
 * Read-only summary: approved / pending / missing per required doc type.
 * NO actions here — that belongs in SupportingDocumentsList below.
 * Updates live whenever the parent bumps refreshKey.
 */
function RequiredDocumentsChecklist({
  documents,
  requests,
  loading,
}: {
  documents: ReviewerApplicationDocument[];
  requests: ReviewerDocumentRequest[];
  loading: boolean;
}) {
  const { t } = useTranslation();

  // A required doc type is "received" if either:
  //   a) a submitted Document with that type exists and is not rejected, OR
  //   b) a DocumentRequest with that type has been uploaded (status !== awaiting_upload/rejected)
  const isTypeReceived = (type: string) =>
    documents.some((d) => d.document_type === type && d.verification_status !== 'rejected')
    || requests.some(
      (r) => r.document_type === type && !r.is_overdue
           && r.status !== 'awaiting_upload' && r.status !== 'rejected',
    );

  const receivedCount = PAPER_REQUIRED_DOC_TYPES.filter(isTypeReceived).length;

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <h3 className="font-headline font-semibold text-sm mb-3" style={{ color: 'var(--foreground)' }}>
        {t('admin.review.paper.required_docs_title', 'Required Supporting Documents')}
      </h3>

      <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
        {loading
          ? t('common.loading', 'Loading…')
          : t('admin.review.paper.required_docs_summary', '{{received}} of {{total}} required documents received', {
              received: receivedCount,
              total:    PAPER_REQUIRED_DOC_TYPES.length,
            })
        }
      </p>

      <ul className="flex flex-col gap-2">
        {PAPER_REQUIRED_DOC_TYPES.map((type) => {
          const matchingDoc = documents.find(
            (d) => d.document_type === type && d.verification_status !== 'rejected',
          );
          const matchingReq = !matchingDoc
            ? requests.find(
                (r) => r.document_type === type && !r.is_overdue
                     && r.status !== 'awaiting_upload' && r.status !== 'rejected',
              )
            : null;
          const isApproved = matchingDoc?.verification_status === 'approved'
            || matchingReq?.status === 'approved';
          const isReceived = !!(matchingDoc || matchingReq);
          const label      = getDocumentLabel(type, 'admin');

          return (
            <li key={type} className="flex items-center gap-2 text-sm">
              {isApproved ? (
                <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--forest-green)' }} />
              ) : isReceived ? (
                <Clock className="h-4 w-4 flex-shrink-0" style={{ color: '#7c3aed' }} />
              ) : (
                <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#dc2626' }} />
              )}
              <span style={{ color: isReceived ? 'var(--foreground)' : '#991b1b' }}>
                {label}
              </span>
              {!isApproved && (
                <span className="text-xs" style={{ color: isReceived ? '#7c3aed' : '#991b1b' }}>
                  ({isReceived
                    ? t('admin.review.paper.pending_review', 'awaiting review')
                    : t('admin.review.paper.missing', 'missing')
                  })
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Supporting documents (main work area) ──────────────────────────────────

/**
 * Full-card list using CollapsibleDocumentCard for every uploaded document
 * and every outstanding request. This is the unified work area where admins
 * verify, reject, preview, and download.
 */
function SupportingDocumentsList({
  documents,
  standaloneRequests,
  requests,
  loading,
  onPreview,
  onDownload,
  adminActions,
  onPreviewRequest,
  onDownloadRequest,
  adminRequestActions,
}: {
  documents:          ReviewerApplicationDocument[];
  standaloneRequests: ReviewerDocumentRequest[];
  requests:           ReviewerDocumentRequest[];
  loading:            boolean;
  onPreview:          (doc: ReviewerApplicationDocument) => void;
  onDownload:         (doc: ReviewerApplicationDocument) => void;
  adminActions?:      Props['adminDocumentActions'];
  onPreviewRequest:   (req: ReviewerDocumentRequest) => void;
  onDownloadRequest:  (req: ReviewerDocumentRequest) => void;
  adminRequestActions?: {
    onVerify: (req: ReviewerDocumentRequest) => void;
    onReject:  (req: ReviewerDocumentRequest) => void;
    disabled:  boolean;
  };
}) {
  const { t } = useTranslation();

  const resolveStatus = (doc: ReviewerApplicationDocument): DocumentUIStatus => {
    const req = doc.document_request_id
      ? requests.find((r) => r.id === doc.document_request_id)
      : undefined;
    return resolveDocumentStatus({
      request:  req ? { status: req.status, is_overdue: req.is_overdue } : undefined,
      document: { verification_status: doc.verification_status, submitted_at: doc.submitted_at },
    });
  };

  const isEmpty = documents.length === 0 && standaloneRequests.length === 0;

  return (
    <div
      className="rounded-2xl border"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
          {t('admin.review.paper.supporting_docs_title', 'Supporting Documents')}
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {t(
            'admin.review.paper.supporting_docs_desc',
            'All documents the family has provided alongside the paper packet.',
          )}
        </p>
      </div>

      <div className="p-4 space-y-3">
        {loading && (
          <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
            {t('common.loading', 'Loading…')}
          </p>
        )}

        {!loading && isEmpty && (
          <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
            {t('admin.review.paper.no_supporting_docs', 'No supporting documents have been uploaded yet.')}
          </p>
        )}

        {/* Standalone requests — requests without a matched Document record.
            When the applicant has uploaded a file (uploaded_at set), wire up
            preview/download and approve/reject using the document-request endpoints. */}
        {!loading && standaloneRequests.map((req) => {
          const status   = mapRequestStatus(req.status, req.is_overdue);
          const hasFile  = req.uploaded_at !== null;
          const canActOnReq = !!(adminRequestActions && hasFile
            && (req.status === 'uploaded' || req.status === 'scanning' || req.status === 'under_review'));
          return (
            <CollapsibleDocumentCard
              key={`req-${req.id}`}
              title={getDocumentLabel(req.document_type, 'admin')}
              fileName={hasFile ? (req.uploaded_file_name ?? undefined) : undefined}
              status={UI_TO_CARD[status]}
              uploadedAt={hasFile ? (req.uploaded_at ?? undefined) : undefined}
              requestedBy={req.requested_by?.name}
              requestedAt={req.created_at}
              dueDate={req.due_date ?? undefined}
              rejectionReason={req.rejection_reason ?? undefined}
              canReview={canActOnReq}
              actionsDisabled={adminRequestActions?.disabled}
              onApprove={canActOnReq ? () => adminRequestActions!.onVerify(req) : undefined}
              onReject={canActOnReq  ? () => adminRequestActions!.onReject(req)  : undefined}
              onPreview={hasFile  ? () => onPreviewRequest(req)  : undefined}
              onDownload={hasFile ? () => onDownloadRequest(req) : undefined}
            />
          );
        })}

        {/* Uploaded documents — full card with Verify / Reject */}
        {!loading && documents.map((doc) => {
          const uiStatus  = resolveStatus(doc);
          const cardStatus = UI_TO_CARD[uiStatus];
          const canAct    = !!(adminActions
            && doc.verification_status === 'pending'
            && doc.submitted_at !== null);
          const req = doc.document_request_id
            ? requests.find((r) => r.id === doc.document_request_id)
            : undefined;

          return (
            <CollapsibleDocumentCard
              key={doc.id}
              title={getDocumentLabel(doc.document_type ?? '', 'admin')}
              fileName={doc.original_filename ?? undefined}
              status={cardStatus}
              uploadedBy={doc.uploader?.name}
              uploadedAt={doc.submitted_at ?? undefined}
              requestedBy={req?.requested_by?.name}
              requestedAt={req?.created_at}
              dueDate={req?.due_date ?? undefined}
              rejectionReason={doc.rejection_reason ?? undefined}
              canReview={canAct}
              actionsDisabled={adminActions?.disabled}
              onApprove={canAct ? () => adminActions!.onVerify(doc) : undefined}
              onReject={canAct  ? () => adminActions!.onReject(doc)  : undefined}
              onPreview={() => onPreview(doc)}
              onDownload={() => onDownload(doc)}
            />
          );
        })}
      </div>

    </div>
  );
}
