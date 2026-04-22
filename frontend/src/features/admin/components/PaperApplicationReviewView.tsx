/**
 * PaperApplicationReviewView — admin review panel for paper-submitted applications.
 *
 * Replaces the 11-section CanonicalApplicationSections rendering when an
 * application's submission_source is 'paper_self' or 'paper_admin'. Paper
 * applications have no structured section data until (and unless) staff
 * transcribe the packet — rendering the digital form against those NULL
 * fields produced the "empty form" bug the forensic audit flagged.
 *
 * What we render instead:
 *
 *   1. A prominent Paper Packet viewer at the top. The uploaded PDF /
 *      image is embedded inline via an authenticated blob URL so the
 *      reviewer can read the form in place without leaving the page.
 *
 *   2. A required-documents checklist (RequiredDocumentsChecklist) that
 *      at a glance tells the reviewer whether the mandatory supporting
 *      docs (immunization record, insurance card, medical exam form)
 *      are on file. See the component docblock for the domain rule.
 *
 *   3. A supporting-documents list that reuses the existing admin
 *      Verify / Reject / Preview / Download actions for each non-packet
 *      document.
 *
 * Out of scope for Phase 3:
 *
 *   - Inline transcription into structured fields. That's the logical
 *     next iteration but a separate body of work; for now an admin who
 *     wants to move a paper app into the digital rails uses the existing
 *     AdminApplicationEditPage.
 *   - Any changes to the approve/reject/waitlist decision flow. The
 *     ReviewPanel on the right column of ApplicationReviewPage is
 *     unchanged — paper and digital take the same transition paths.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle, Download, Eye, FileText, XCircle } from 'lucide-react';

import { Button } from '@/ui/components/Button';
import axiosInstance from '@/api/axios.config';
import {
  PAPER_REQUIRED_DOC_TYPES,
  getDocumentLabel,
} from '@/shared/constants/documentRequirements';
import type { CanonicalApplicationPayload, CanonicalDocument } from '@/shared/types/camp.types';

// Paper packet docs are stored with this document_type — authoritative per
// BUG-232/BUG-236 (paper forms forensic audit) and the DocumentService mime map.
const PAPER_PACKET_DOCUMENT_TYPE = 'paper_application_packet';

interface Props {
  canonical: CanonicalApplicationPayload;
  onPreviewDocument: (doc: CanonicalDocument) => void;
  onDownloadDocument: (doc: CanonicalDocument) => void;
  adminDocumentActions?: {
    onVerify: (doc: CanonicalDocument) => void;
    onReject: (doc: CanonicalDocument) => void;
    disabled: boolean;
  };
}

export function PaperApplicationReviewView({
  canonical,
  onPreviewDocument,
  onDownloadDocument,
  adminDocumentActions,
}: Props) {
  const allDocuments = canonical.sections.documents.list ?? [];
  const packetDoc = allDocuments.find((d) => d.document_type === PAPER_PACKET_DOCUMENT_TYPE) ?? null;
  const supportingDocs = allDocuments.filter((d) => d.document_type !== PAPER_PACKET_DOCUMENT_TYPE);

  return (
    <div className="flex flex-col gap-6">
      <PaperPacketViewer
        doc={packetDoc}
        onPreview={onPreviewDocument}
        onDownload={onDownloadDocument}
      />
      <RequiredDocumentsChecklist documents={supportingDocs} />
      <SupportingDocumentsList
        documents={supportingDocs}
        onPreview={onPreviewDocument}
        onDownload={onDownloadDocument}
        adminActions={adminDocumentActions}
      />
    </div>
  );
}

// ─── Paper packet viewer ────────────────────────────────────────────────────

/**
 * Embeds the scanned paper packet inline so reviewers can read it in place.
 *
 * Fetches the document via the authenticated /documents/{id}/download
 * endpoint as a blob, converts to an object URL, and renders it in an
 * iframe (PDF) or img tag (image). The URL is revoked on unmount and
 * on doc-id change so stale blobs don't leak memory on navigation.
 *
 * If the packet hasn't been uploaded yet (paper_admin flow where staff
 * hasn't attached the physical form), we render a clear "missing" card
 * instead of a broken viewer — the reviewer sees exactly what's wrong.
 */
function PaperPacketViewer({
  doc,
  onPreview,
  onDownload,
}: {
  doc: CanonicalDocument | null;
  onPreview: (doc: CanonicalDocument) => void;
  onDownload: (doc: CanonicalDocument) => void;
}) {
  const { t } = useTranslation();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!doc) {
      setBlobUrl(null);
      return;
    }

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
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

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

  const isImage = (doc.mime_type ?? '').startsWith('image/');

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {/* Header with filename + actions */}
      <div
        className="flex items-center justify-between gap-4 px-5 py-3 border-b"
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
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onPreview(doc)}
            className="flex items-center gap-1.5"
          >
            <Eye className="h-3.5 w-3.5" />
            {t('admin.review.paper.open_in_tab', 'Open in tab')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDownload(doc)}
            className="flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            {t('common.download', 'Download')}
          </Button>
        </div>
      </div>

      {/* Inline viewer */}
      <div style={{ background: '#f9fafb', minHeight: 640 }}>
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
          <>
            {isImage ? (
              <img
                src={blobUrl}
                alt={doc.original_filename ?? 'Paper application packet'}
                className="w-full h-auto"
                style={{ maxHeight: 720, objectFit: 'contain' }}
              />
            ) : (
              <iframe
                src={blobUrl}
                title="Paper application packet"
                className="w-full"
                style={{ height: 720, border: 'none' }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Required documents checklist ───────────────────────────────────────────

/**
 * RequiredDocumentsChecklist — at-a-glance status for the three mandatory
 * supporting documents on a paper application.
 *
 * Why this component exists:
 *
 *   A paper packet is only half the picture. The family still needs to
 *   supply the immunization record, insurance card, and medical exam
 *   form — the same required set as a digital application. Without this
 *   checklist a reviewer has to scan through the supporting-docs list
 *   and mentally cross-reference against the required list, which is
 *   how "approved apps with a missing medical form" slip through.
 *
 * What a reviewer expects:
 *
 *   - Three rows, one per required doc type.
 *   - Each row shows present (green check) or missing (red warning).
 *   - The label should be the human-friendly name that appears on the
 *     applicant side so there is no translation gap between portals.
 *
 * TODO (USER CONTRIBUTION): implement the present/missing rendering.
 *
 *   Use the REQUIRED_TYPES array below as the spec. For each entry,
 *   compute `present = documents.some(d => d.document_type === type)`,
 *   then render a small row: <CheckCircle/> (green) when present,
 *   <AlertCircle/> (red / amber) when missing, plus the label.
 *
 *   ~10 lines. Keep the layout flat (ul/li) — no extra card chrome,
 *   the wrapping component below already provides the card.
 *
 *   Consider: do you want to render "N of 3 received" summary at the
 *   top? Do you want missing docs to sort first? Your call.
 *
 * Single-source-of-truth note: the required-type list comes from
 * PAPER_REQUIRED_DOC_TYPES in shared/constants/documentRequirements so the
 * applicant paper view cannot drift from the admin one. Labels are looked up
 * through getDocumentLabel() against the same canonical table.
 */
function RequiredDocumentsChecklist({
  documents,
}: {
  documents: CanonicalDocument[];
}) {
  const { t } = useTranslation();

  const presentCount = PAPER_REQUIRED_DOC_TYPES.filter((type) =>
    documents.some((d) => d.document_type === type),
  ).length;

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <h3 className="font-headline font-semibold text-sm mb-3" style={{ color: 'var(--foreground)' }}>
        {t('admin.review.paper.required_docs_title', 'Required Supporting Documents')}
      </h3>

      <p className="text-sm mb-2" style={{ color: 'var(--muted-foreground)' }}>
        {t('admin.review.paper.required_docs_summary', '{{received}} of {{total}} required documents received', {
          received: presentCount,
          total: PAPER_REQUIRED_DOC_TYPES.length,
        })}
      </p>

      <ul className="flex flex-col gap-2">
        {PAPER_REQUIRED_DOC_TYPES.map((type) => {
          const present = documents.some((d) => d.document_type === type);
          const label = getDocumentLabel(type, 'admin');

          return (
            <li key={type} className="flex items-center gap-2 text-sm">
              {present ? (
                <CheckCircle
                  className="h-4 w-4 flex-shrink-0"
                  style={{ color: 'var(--forest-green)' }}
                />
              ) : (
                <AlertCircle
                  className="h-4 w-4 flex-shrink-0"
                  style={{ color: '#dc2626' }}
                />
              )}

              <span
                style={{ color: present ? 'var(--foreground)' : '#991b1b' }}
              >
                {label}
              </span>

              {!present && (
                <span className="text-xs" style={{ color: '#991b1b' }}>
                  ({t('admin.review.paper.missing', 'missing')})
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Supporting documents list ──────────────────────────────────────────────

/**
 * Per-doc row with admin Verify / Reject / Preview / Download controls. Mirrors
 * the canonical Documents section row but stripped of the compliance chrome —
 * paper apps lean on the top-level checklist for that signal instead.
 */
function SupportingDocumentsList({
  documents,
  onPreview,
  onDownload,
  adminActions,
}: {
  documents: CanonicalDocument[];
  onPreview: (doc: CanonicalDocument) => void;
  onDownload: (doc: CanonicalDocument) => void;
  adminActions?: Props['adminDocumentActions'];
}) {
  const { t } = useTranslation();

  return (
    <div
      className="rounded-2xl border"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div
        className="px-5 py-3 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
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

      {documents.length === 0 ? (
        <p className="text-sm px-5 py-6 text-center" style={{ color: 'var(--muted-foreground)' }}>
          {t('admin.review.paper.no_supporting_docs', 'No supporting documents have been uploaded yet.')}
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                  {doc.admin_label || doc.document_type}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                  {doc.original_filename ?? '—'}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onPreview(doc)}
                  className="flex items-center gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {t('common.preview', 'Preview')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDownload(doc)}
                  className="flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('common.download', 'Download')}
                </Button>
                {adminActions && doc.verification_status !== 'approved' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => adminActions.onVerify(doc)}
                    disabled={adminActions.disabled}
                    className="flex items-center gap-1.5"
                    style={{ color: 'var(--forest-green)' }}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    {t('admin.review.verify', 'Verify')}
                  </Button>
                )}
                {adminActions && doc.verification_status !== 'rejected' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => adminActions.onReject(doc)}
                    disabled={adminActions.disabled}
                    className="flex items-center gap-1.5"
                    style={{ color: '#dc2626' }}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {t('admin.review.reject', 'Reject')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
