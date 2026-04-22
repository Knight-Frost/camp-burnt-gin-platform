/**
 * ApplicantPaperApplicationView — applicant-facing mirror of
 * PaperApplicationReviewView for families who submitted a paper packet.
 *
 * Replaces the 11-section CanonicalApplicationSections rendering on
 * ApplicantApplicationDetailPage when the application's submission_source
 * is 'paper_self' or 'paper_admin'. Without this view a paper-submitting
 * family sees empty camper-info, medical, behavioral, etc. sections —
 * misleading because they never filled those fields digitally.
 *
 * What we render instead:
 *
 *   A. Paper Application banner — a short "here's what you submitted"
 *      explainer so the family understands why the sections look
 *      different from what friends on digital apps might describe.
 *
 *   C. Submitted Documents (primary focus) — the paper packet and any
 *      supporting docs the family has uploaded, each with View and
 *      Download actions. This is the single answer to "did they
 *      actually receive my stuff."
 *
 *   D. Required Documents Checklist — reuses PAPER_REQUIRED_DOC_TYPES
 *      so the applicant sees the same three-doc checklist the admin
 *      uses. Present → green, missing → red with a link to the
 *      Documents page for the upload.
 *
 *   E. Action-Needed panel — when the admin has rejected a document,
 *      or a doc has expired, surface a clear "this needs your
 *      attention" callout with a re-upload link.
 *
 * What we intentionally omit:
 *
 *   - Camper Information, Medical, Behavioral, Equipment, Diet,
 *     Personal Care, Activities, Medications, Narratives, Consents
 *     sections. Paper applications have no structured data for these;
 *     rendering the shell against NULL fields is the "empty form" bug
 *     this component was built to fix.
 *
 *   - Status timeline. That block lives on the parent page and applies
 *     identically to paper and digital applications — no reason to
 *     duplicate it here.
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CheckCircle, Download, Eye, FileText } from 'lucide-react';

import { Button } from '@/ui/components/Button';
import { ROUTES } from '@/shared/constants/routes';
import {
  PAPER_REQUIRED_DOC_TYPES,
  getDocumentLabel,
} from '@/shared/constants/documentRequirements';
import type { CanonicalApplicationPayload, CanonicalDocument } from '@/shared/types/camp.types';

// Paper packet docs are stored with this document_type. Same constant the
// admin view uses — see PaperApplicationReviewView.tsx.
const PAPER_PACKET_DOCUMENT_TYPE = 'paper_application_packet';

interface Props {
  canonical: CanonicalApplicationPayload;
  onPreviewDocument: (doc: CanonicalDocument) => void;
  onDownloadDocument: (doc: CanonicalDocument) => void;
}

export function ApplicantPaperApplicationView({
  canonical,
  onPreviewDocument,
  onDownloadDocument,
}: Props) {
  const allDocuments = canonical.sections.documents.list ?? [];
  const packetDoc = allDocuments.find((d) => d.document_type === PAPER_PACKET_DOCUMENT_TYPE) ?? null;

  // "Action-needed" docs are ones the applicant must do something about —
  // either an admin rejected them or they expired. Pending/unverified docs
  // are waiting on staff, not on the family, so they don't appear here.
  const actionNeededDocs = allDocuments.filter((d) => {
    const rejected = d.verification_status === 'rejected';
    const expired = d.is_expired;
    return rejected || expired;
  });

  return (
    <div className="flex flex-col gap-5">
      <PaperApplicationBanner packetDoc={packetDoc} />
      {actionNeededDocs.length > 0 && (
        <ActionNeededPanel docs={actionNeededDocs} />
      )}
      <SubmittedDocumentsList
        documents={allDocuments}
        onPreview={onPreviewDocument}
        onDownload={onDownloadDocument}
      />
      <RequiredDocumentsChecklist documents={allDocuments} />
    </div>
  );
}

// ─── A. Paper application banner ────────────────────────────────────────────

function PaperApplicationBanner({ packetDoc }: { packetDoc: CanonicalDocument | null }) {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-2xl border p-5 flex items-start gap-3"
      style={{ background: 'rgba(234,88,12,0.06)', borderColor: 'rgba(234,88,12,0.25)' }}
    >
      <FileText className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--ember-orange)' }} />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('applicant_paper.banner_title', 'Paper Application Submitted')}
        </p>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {packetDoc
            ? t(
                'applicant_paper.banner_body_with_packet',
                "You submitted this application on paper. Camp staff will review your packet and supporting documents — the sections below show what's on file.",
              )
            : t(
                'applicant_paper.banner_body_without_packet',
                "This application was started as a paper submission but the scanned packet hasn't been uploaded yet. Upload the completed packet on the Documents page to move your review forward.",
              )}
        </p>
      </div>
    </div>
  );
}

// ─── C. Submitted documents list ────────────────────────────────────────────

function SubmittedDocumentsList({
  documents,
  onPreview,
  onDownload,
}: {
  documents: CanonicalDocument[];
  onPreview: (doc: CanonicalDocument) => void;
  onDownload: (doc: CanonicalDocument) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="rounded-2xl border"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
          {t('applicant_paper.submitted_docs_title', 'Submitted Documents')}
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {t(
            'applicant_paper.submitted_docs_desc',
            'Everything you have uploaded for this application. Click View to open or Download to save a copy.',
          )}
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
            {t('applicant_paper.no_submitted_docs', 'You have not uploaded any documents yet.')}
          </p>
          <Link
            to={ROUTES.PARENT_DOCUMENTS}
            className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-2"
            style={{ color: 'var(--ember-orange)' }}
          >
            {t('applicant_paper.go_to_documents_page', 'Go to Documents page')}
          </Link>
        </div>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {documents.map((doc) => {
            const isPacket = doc.document_type === PAPER_PACKET_DOCUMENT_TYPE;
            const label = doc.applicant_label || getDocumentLabel(doc.document_type, 'applicant');
            const isRejected = doc.verification_status === 'rejected';
            const isExpired = doc.is_expired;

            return (
              <li key={doc.id} className="flex items-center justify-between gap-4 px-6 py-3">
                <div className="min-w-0 flex-1 flex items-start gap-3">
                  <FileText
                    className="h-4 w-4 flex-shrink-0 mt-0.5"
                    style={{ color: isPacket ? 'var(--ember-orange)' : 'var(--muted-foreground)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                        {label}
                      </p>
                      {isPacket && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: 'rgba(234,88,12,0.15)', color: 'var(--ember-orange)' }}
                        >
                          {t('applicant_paper.packet_badge', 'Paper Packet')}
                        </span>
                      )}
                      {isRejected && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: 'rgba(220,38,38,0.10)', color: '#dc2626' }}
                        >
                          {t('applicant_paper.status_rejected', 'Rejected')}
                        </span>
                      )}
                      {isExpired && !isRejected && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: 'rgba(220,38,38,0.10)', color: '#dc2626' }}
                        >
                          {t('applicant_paper.status_expired', 'Expired')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                      {doc.original_filename ?? '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onPreview(doc)}
                    className="flex items-center gap-1.5"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t('common.view', 'View')}
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── D. Required documents checklist ────────────────────────────────────────

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
        {t('applicant_paper.required_docs_title', 'Required Documents')}
      </h3>

      <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
        {t('applicant_paper.required_docs_summary', '{{received}} of {{total}} required documents submitted', {
          received: presentCount,
          total: PAPER_REQUIRED_DOC_TYPES.length,
        })}
      </p>

      <ul className="flex flex-col gap-2 mb-4">
        {PAPER_REQUIRED_DOC_TYPES.map((type) => {
          const present = documents.some((d) => d.document_type === type);
          const label = getDocumentLabel(type, 'applicant');
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
              <span style={{ color: present ? 'var(--foreground)' : '#991b1b' }}>
                {label}
              </span>
              {!present && (
                <span className="text-xs" style={{ color: '#991b1b' }}>
                  ({t('applicant_paper.missing', 'not yet received')})
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {presentCount < PAPER_REQUIRED_DOC_TYPES.length && (
        <Link
          to={ROUTES.PARENT_DOCUMENTS}
          className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-2"
          style={{ color: 'var(--ember-orange)' }}
        >
          {t('applicant_paper.upload_missing', 'Upload missing documents')}
        </Link>
      )}
    </div>
  );
}

// ─── E. Action-needed panel ─────────────────────────────────────────────────

/**
 * Clear callout for documents the applicant must re-upload. Shown at the top
 * of the paper view (directly below the banner) because this is the single
 * most time-sensitive signal for a family — a rejected medical exam form
 * blocks approval no matter how else complete the packet is.
 *
 * Renders one row per action-needed doc. Each row names the document type,
 * the reason (rejected vs expired), and links to the Documents page where
 * the family can re-upload.
 */
function ActionNeededPanel({ docs }: { docs: CanonicalDocument[] }) {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: 'rgba(220,38,38,0.05)', borderColor: 'rgba(220,38,38,0.25)' }}
    >
      <div className="flex items-start gap-3 mb-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: '#991b1b' }}>
            {t('applicant_paper.action_needed_title', 'Action Needed')}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#991b1b' }}>
            {t(
              'applicant_paper.action_needed_subtitle',
              "These documents can't be accepted as-is. Please re-upload them on the Documents page.",
            )}
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2 mb-3">
        {docs.map((d) => {
          const label = d.applicant_label || getDocumentLabel(d.document_type, 'applicant');
          const reason = d.verification_status === 'rejected'
            ? t('applicant_paper.reason_rejected', 'rejected by camp staff')
            : t('applicant_paper.reason_expired', 'expired');
          return (
            <li key={d.id} className="text-sm" style={{ color: '#991b1b' }}>
              <span className="font-medium">{label}</span>{' '}
              <span className="text-xs">({reason})</span>
            </li>
          );
        })}
      </ul>

      <Link
        to={ROUTES.PARENT_DOCUMENTS}
        className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-2"
        style={{ color: '#991b1b' }}
      >
        {t('applicant_paper.reupload_link', 'Re-upload documents')}
      </Link>
    </div>
  );
}
