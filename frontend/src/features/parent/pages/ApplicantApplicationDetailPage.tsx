/**
 * ApplicantApplicationDetailPage.tsx
 *
 * Purpose: Read-only view of a single application for the parent who submitted it.
 * Responsibilities:
 *   - Fetch one application by ID from the API
 *   - Display a visual status timeline (Submitted → Under Review → Approved)
 *     with special handling for rejected/withdrawn/draft states
 *   - Show camper information, camp session details, and any admin review notes
 *   - List uploaded documents with a download button per file
 *
 * Plain-English: Think of this page as the receipt a parent gets after turning
 * in an application — it shows exactly where things stand and lets them
 * download any files they attached.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ArrowLeft, FileText, Download,
  CheckCircle, Clock, AlertTriangle, XCircle, Info, Plus, X, RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';

import { getApplicationCanonical, withdrawApplication, submitDraftApplication } from '@/features/parent/api/applicant.api';
import { NewSessionModal } from '@/features/parent/components/NewSessionModal';
import type { Camper, CanonicalApplicationPayload, CanonicalDocument } from '@/shared/types';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { ErrorState } from '@/ui/components/EmptyState';
import { SkeletonCard } from '@/ui/components/Skeletons';
import { ROUTES } from '@/shared/constants/routes';
import axiosInstance from '@/api/axios.config';
import type { Application } from '@/features/admin/types/admin.types';
import { CanonicalApplicationSections } from '@/features/applications/components/CanonicalApplicationSections';

// ─── Section card — reusable titled card with an icon ─────────────────────────

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2.5 mb-5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(22,163,74,0.10)', color: 'var(--ember-orange)' }}
        >
          {icon}
        </div>
        <h3 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

// Field helper removed — all section-level field rendering now lives in the
// shared CanonicalApplicationSections component. SectionCard is kept because
// the Status timeline card at the top of the page still uses it.

// ─── Status timeline ──────────────────────────────────────────────────────────

// Visual progress indicator showing where an application is in the review pipeline
// STATUS_STEPS is defined inside the component so labels rebuild when language changes
function StatusTimeline({ status }: { status: string }) {
  const { t } = useTranslation();

  // Defines the forward-progress steps for a typical application.
  // waitlisted sits between under_review and approved — applications can be promoted
  // from the waitlist when capacity opens.
  const STATUS_STEPS: { status: string; label: string; icon: ReactNode }[] = [
    { status: 'submitted',    label: t('applicant_detail.step_submitted'),    icon: <FileText className="h-3.5 w-3.5" /> },
    { status: 'under_review', label: t('applicant_detail.step_under_review'), icon: <Clock className="h-3.5 w-3.5" /> },
    { status: 'waitlisted',   label: t('applicant_detail.step_waitlisted'),   icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    { status: 'approved',     label: t('applicant_detail.step_approved'),     icon: <CheckCircle className="h-3.5 w-3.5" /> },
  ];

  // Terminal failure states get their own simple message instead of a progress bar
  if (status === 'rejected' || status === 'withdrawn') {
    return (
      <div className="flex items-center gap-2 py-2">
        <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--destructive)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--destructive)' }}>
          {status === 'rejected' ? t('applicant_detail.rejected_notice') : t('applicant_detail.withdrawn_notice')}
        </p>
      </div>
    );
  }
  if (status === 'draft') {
    return null; // handled inline in the status card with Submit Draft button
  }

  const stepOrder = ['submitted', 'under_review', 'waitlisted', 'approved'];
  // Find where the current status sits in the ordered list
  const currentIdx = stepOrder.indexOf(status);

  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((step, i) => {
        const done    = i < currentIdx;   // step already passed
        const active  = i === currentIdx; // step currently happening
        const pending = i > currentIdx;   // step not yet reached

        return (
          <div key={step.status} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              {/* Circle icon: filled brand color when done or active, grey when pending */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  background: done || active ? 'var(--ember-orange)' : 'var(--border)',
                  color: done || active ? '#fff' : 'var(--muted-foreground)',
                }}
              >
                {step.icon}
              </div>
              {/* Step label bold when it's the active step */}
              <p
                className="text-xs text-center leading-tight"
                style={{
                  color: pending ? 'var(--muted-foreground)' : 'var(--foreground)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {step.label}
              </p>
            </div>
            {/* Connector line between steps — filled brand color when the step before it is done */}
            {i < STATUS_STEPS.length - 1 && (
              <div
                className="h-px flex-1 mb-4"
                style={{ background: done ? 'var(--ember-orange)' : 'var(--border)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ApplicantApplicationDetailPage() {
  // Pull the application ID from the URL (e.g. /applicant/applications/7)
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [application, setApplication] = useState<Application | null>(null);
  const [canonical, setCanonical] = useState<CanonicalApplicationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  // Increment to re-trigger the fetch after an error
  const [retryKey, setRetryKey] = useState(0);

  // "Apply for a New Session" modal — true = modal is open; false = closed.
  // Session loading, selection, and navigation are handled inside NewSessionModal.
  const [showNewAppModal, setShowNewAppModal] = useState(false);

  // Preview modal — fetch blob via axios so the Bearer token is included
  const [previewDoc, setPreviewDoc]         = useState<{ id: number; name: string; mime: string } | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [submittingDraft, setSubmittingDraft] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(false);
    getApplicationCanonical(Number(id))
      .then(({ data, canonical }) => {
        setApplication(data as unknown as Application);
        setCanonical(canonical);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id, retryKey]);

  // Withdraw the application after an explicit confirmation prompt.
  async function handleWithdraw() {
    if (!application) return;
    const confirmed = window.confirm(t('applicant_detail.withdraw_confirm'));
    if (!confirmed) return;

    setWithdrawing(true);
    try {
      const updated = await withdrawApplication(application.id);
      setApplication(updated as unknown as Application);
      toast.success(t('applicant_detail.withdraw_success'));
    } catch {
      toast.error(t('applicant_detail.withdraw_error'));
    } finally {
      setWithdrawing(false);
    }
  }

  async function handleSubmitDraft() {
    if (!application) return;
    const confirmed = window.confirm('Submit this application? Once submitted it will be sent to staff for review and cannot be edited as a draft.');
    if (!confirmed) return;
    setSubmittingDraft(true);
    try {
      const updated = await submitDraftApplication(application.id);
      setApplication(updated as unknown as Application);
      toast.success('Application submitted successfully.');
    } catch {
      toast.error('Could not submit application. Please try again.');
    } finally {
      setSubmittingDraft(false);
    }
  }

  // Open the "Apply for a New Session" modal.
  // Session loading, selection, and navigation are handled inside NewSessionModal.
  function handleOpenNewAppModal() {
    if (!application) return;
    setShowNewAppModal(true);
  }

  // Per-document submit flow removed in the canonical-view cutover. On a
  // draft, documents cascade to submitted state atomically inside
  // finalize() (see ApplicationController::finalize). For submitted
  // applications, any re-uploaded document is auto-submitted by
  // DocumentService. A separate applicant-facing action for "submit just
  // this doc" was rarely used and was a source of partial-visibility bugs.

  // Fetch preview blob whenever the preview modal opens (auth-gated download URL)
  useEffect(() => {
    if (!previewDoc) {
      if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null); }
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    axiosInstance
      .get(`/documents/${previewDoc.id}/download`, { responseType: 'blob' })
      .then((res) => { if (!cancelled) setPreviewBlobUrl(URL.createObjectURL(res.data as Blob)); })
      .catch(() => { if (!cancelled) setPreviewBlobUrl(null); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewDoc]);

  // Download a document by fetching it as a blob and triggering a browser save
  function handleDownload(docId: number, name: string) {
    axiosInstance
      .get(`/documents/${docId}/download`, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data as Blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = name;
        // Append to body so the click works in Firefox too
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Free the object URL immediately to avoid memory leaks
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error(t('applicant_detail.download_error')));
  }

  // Adapter: canonical document callbacks wired to the existing preview/download flow.
  const onPreviewCanonical = (doc: CanonicalDocument) => {
    setPreviewDoc({
      id: doc.id,
      name: doc.original_filename ?? doc.document_type_label,
      mime: doc.mime_type ?? 'application/octet-stream',
    });
  };
  const onDownloadCanonical = (doc: CanonicalDocument) => {
    handleDownload(doc.id, doc.original_filename ?? `${doc.document_type}.bin`);
  };

  // Show skeleton cards while the application is loading
  if (loading) {
    return (
      <div className="flex flex-col gap-5 max-w-3xl">
        <div className="h-8 w-40 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      </div>
    );
  }

  if (error || !application) {
    return <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />;
  }

  // Camper kept for the page header and the "New Session" modal.
  const camper  = application.camper;

  return (
    <>
    {/* ── Document preview modal ─────────────────────────────────────────── */}
    {previewDoc && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
        <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--card)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh' }}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 overflow-hidden">
              <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
              <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{previewDoc.name}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleDownload(previewDoc.id, previewDoc.name)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium"
                style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
              <button type="button" onClick={() => setPreviewDoc(null)} className="p-1 rounded-lg" style={{ color: 'var(--muted-foreground)' }}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1" style={{ minHeight: 380 }}>
            {previewLoading ? (
              <div className="flex items-center justify-center h-full p-8" style={{ color: 'var(--muted-foreground)' }}>
                <RefreshCw className="h-5 w-5 animate-spin opacity-50" />
              </div>
            ) : !previewBlobUrl ? (
              <div className="flex flex-col items-center justify-center gap-3 p-8" style={{ color: 'var(--muted-foreground)' }}>
                <FileText className="h-10 w-10 opacity-30" />
                <p className="text-sm">Could not load preview.</p>
              </div>
            ) : previewDoc.mime.startsWith('image/') ? (
              <div className="flex items-center justify-center p-4" style={{ background: 'var(--dash-bg)' }}>
                <img src={previewBlobUrl} alt={previewDoc.name} className="max-w-full object-contain rounded-lg" style={{ maxHeight: '65vh' }} />
              </div>
            ) : (
              <iframe src={previewBlobUrl} title={previewDoc.name} className="w-full" style={{ border: 'none', height: '65vh' }} />
            )}
          </div>
        </div>
      </div>
    )}

    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Back navigation link */}
      <Link
        to={ROUTES.PARENT_APPLICATIONS}
        className="inline-flex items-center gap-2 text-sm transition-colors w-fit"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ArrowLeft className="h-4 w-4" />
        {t('applicant_detail.back')}
      </Link>

      {/* Page header: camper name + status badge */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            className="text-xl font-headline font-semibold"
            style={{ color: 'var(--foreground)' }}
          >
            {/* Prefer camper full name; fall back to the human-readable app number (never raw id) */}
            {camper?.full_name ?? application.application_number ?? t('applicant_detail.app_number', { number: application.application_number ?? `#${application.id}` })}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {/* Show human-readable identifier (CBG-2026-042) instead of raw database id */}
            {t('applicant_detail.app_number', { number: application.application_number ?? `#${application.id}` })}
            {application.submitted_at && (
              <> &middot; {t('applicant_detail.submitted_on', { date: format(new Date(application.submitted_at), 'MMMM d, yyyy') })}</>
            )}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      {/* Card sections */}
      <div className="flex flex-col gap-5">
        {/* Status timeline card — always shown */}
        <div>
          <SectionCard title={t('applicant_detail.status_title')} icon={<AlertTriangle className="h-4 w-4" />}>
            {application.status === 'draft' ? (
              <div className="flex items-start justify-between gap-4 py-2">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {t('applicant_detail.draft_notice')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={submittingDraft}
                  onClick={() => void handleSubmitDraft()}
                  className="flex-shrink-0 text-sm px-4 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-50"
                  style={{ background: 'var(--ember-orange)', color: '#fff' }}
                >
                  {submittingDraft ? 'Submitting…' : 'Submit Application'}
                </button>
              </div>
            ) : (
              <StatusTimeline status={application.status} />
            )}
            {/* Admin notes box appears only when the reviewer left a message */}
            {application.notes && (
              <div
                className="mt-4 rounded-xl p-4 border"
                style={{
                  background: 'rgba(22,163,74,0.04)',
                  borderColor: 'rgba(22,163,74,0.15)',
                }}
              >
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--ember-orange)' }}>
                  {t('applicant_detail.review_notes_label')}
                </p>
                {/* whitespace-pre-wrap preserves line breaks the admin typed in */}
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>
                  {application.notes}
                </p>
              </div>
            )}
          </SectionCard>
        </div>

        {/* All 11 canonical sections — admin and applicant portals consume
            the same component against the same canonical payload, so they
            cannot show divergent truth for the same row. Role-appropriate
            document labels and compliance messages are selected server-side. */}
        {canonical && (
          <CanonicalApplicationSections
            canonical={canonical}
            // Component-level viewer-role discriminator, not WAI-ARIA role.
            // eslint-disable-next-line jsx-a11y/aria-role
            role="applicant"
            onPreviewDocument={onPreviewCanonical}
            onDownloadDocument={onDownloadCanonical}
          />
        )}
      </div>

      {/* What's Next — status-specific guidance. Hidden for drafts: the draft
          notice above already handles that state, and status='submitted' on
          a draft record must not render the "awaiting review" block. */}
      {application && application.status !== 'draft' && (
        <div>
          <SectionCard
            title={application.status === 'approved' ? 'You\'re In!' : 'What Happens Next'}
            icon={<Info className="h-4 w-4" />}
          >
            {application.status === 'submitted' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                  <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#b45309' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Application submitted — awaiting review</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Camp staff will review your application and may contact you with questions.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: 'rgba(234,88,12,0.25)', background: 'rgba(234,88,12,0.04)' }}>
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--ember-orange)' }}>Medical Examination Form required</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      A completed medical exam form signed by a licensed physician must be on file before your application can be approved.
                      Download the form from the <Link to={ROUTES.PARENT_DOCUMENTS} className="underline hover:opacity-80">Documents page</Link>, take it to your doctor, then upload the completed form.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {application.status === 'under_review' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                  <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#2563eb' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Under active review by camp staff</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Staff may reach out via the inbox with questions. Check your messages regularly.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: 'rgba(234,88,12,0.25)', background: 'rgba(234,88,12,0.04)' }}>
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--ember-orange)' }}>Ensure your Medical Examination Form is uploaded</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      Applications cannot be approved without a physician-signed medical exam completed within the last 12 months.
                      Go to the <Link to={ROUTES.PARENT_DOCUMENTS} className="underline hover:opacity-80">Documents page</Link> to download and upload the form.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {application.status === 'approved' && (
              <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: 'rgba(22,163,74,0.25)', background: 'rgba(22,163,74,0.04)' }}>
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#16a34a' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: '#16a34a' }}>Application accepted — your camper has a spot!</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Ensure all required documents are submitted. Camp staff will send further details via the inbox.</p>
                </div>
              </div>
            )}
            {application.status === 'waitlisted' && (
              <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: 'rgba(234,88,12,0.25)', background: 'rgba(234,88,12,0.04)' }}>
                <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#ea580c' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: '#ea580c' }}>You are on the waitlist</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>If a spot opens up, you will be contacted. Make sure your medical form is ready so acceptance can proceed quickly.</p>
                </div>
              </div>
            )}
            {(application.status === 'rejected' || application.status === 'withdrawn' || application.status === 'cancelled') && (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                  <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {application.status === 'rejected' ? 'Application was not accepted for this session.' :
                       application.status === 'withdrawn' ? 'You withdrew this application.' :
                       'This application was cancelled.'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>You can re-apply for a future session. Your camper's information will be pre-filled.</p>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* Footer — back navigation + conditional withdraw button */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          onClick={() => navigate(ROUTES.PARENT_APPLICATIONS)}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('applicant_detail.back_to_applications')}
        </button>

        <div className="flex items-center gap-3">
          {/* "Apply for a New Session" — visible for all terminal states. Opens a
              modal that explains the feature, lets the parent choose a future session,
              and then navigates to the application form with prefilled camper data. */}
          {application && ['approved', 'rejected', 'withdrawn', 'cancelled'].includes(application.status) && (
            <button
              onClick={handleOpenNewAppModal}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border transition-colors"
              style={{ borderColor: 'var(--ember-orange)', color: 'var(--ember-orange)' }}
            >
              <Plus className="h-4 w-4" />
              {t('applicant_detail.new_app_button')}
            </button>
          )}

          {/* Withdraw button — only visible on submitted (non-draft) applications. */}
          {application && application.status !== 'draft' && ['submitted', 'under_review', 'approved', 'waitlisted'].includes(application.status) && (
            <button
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border transition-colors disabled:opacity-50"
              style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}
            >
              <XCircle className="h-4 w-4" />
              {withdrawing ? 'Withdrawing…' : 'Withdraw application'}
            </button>
          )}
        </div>
      </div>
    </div>

      {/* ── "Apply for a New Session" modal ──────────────────────────────────────
          Opened when the parent clicks the footer button on a terminal application.
          Session loading, selection, and navigation are handled inside NewSessionModal.
          This application is used as the audit-trail source (reappliedFromId). */}
      {showNewAppModal && application?.camper && (
        <NewSessionModal
          camper={application.camper as Camper}
          reappliedFromId={application.id}
          onClose={() => setShowNewAppModal(false)}
        />
      )}
    </>
  );
}
