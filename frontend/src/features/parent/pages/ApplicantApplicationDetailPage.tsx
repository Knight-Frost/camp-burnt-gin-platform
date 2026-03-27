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
  ArrowLeft, User, FileText, Calendar, Download,
  CheckCircle, Clock, AlertTriangle, XCircle, Info, RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';

import { getApplication, withdrawApplication, cloneApplication } from '@/features/parent/api/applicant.api';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { ErrorState } from '@/ui/components/EmptyState';
import { SkeletonCard } from '@/ui/components/Skeletons';
import { ROUTES } from '@/shared/constants/routes';
import axiosInstance from '@/api/axios.config';
import type { Application } from '@/features/admin/types/admin.types';

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

// ─── Field row — label + value pair ───────────────────────────────────────────

// Shows "Not provided" when value is null/undefined to communicate intent clearly
function Field({ label, value }: { label: string; value?: string | null }) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </p>
      <p className="text-sm" style={{ color: value ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
        {value ?? t('applicant_detail.not_provided')}
      </p>
    </div>
  );
}

// ─── Status timeline ──────────────────────────────────────────────────────────

// Visual progress indicator showing where an application is in the review pipeline
// STATUS_STEPS is defined inside the component so labels rebuild when language changes
function StatusTimeline({ status }: { status: string }) {
  const { t } = useTranslation();

  // Defines the three main forward-progress steps for a typical application
  const STATUS_STEPS: { status: string; label: string; icon: ReactNode }[] = [
    { status: 'pending',      label: t('applicant_detail.step_submitted'),    icon: <FileText className="h-3.5 w-3.5" /> },
    { status: 'under_review', label: t('applicant_detail.step_under_review'), icon: <Clock className="h-3.5 w-3.5" /> },
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
    // Draft applications haven't entered the pipeline yet
    return (
      <div className="flex items-center gap-2 py-2">
        <Info className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {t('applicant_detail.draft_notice')}
        </p>
      </div>
    );
  }

  const stepOrder = ['pending', 'under_review', 'approved'];
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [reapplying, setReapplying] = useState(false);
  // Increment to re-trigger the fetch after an error
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(false);
    getApplication(Number(id))
      .then((app) => setApplication(app as unknown as Application))
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

  // Clone the application into a new draft for reapplication and navigate to it.
  async function handleReapply() {
    if (!application) return;
    const confirmed = window.confirm(t('applicant_detail.reapply_confirm'));
    if (!confirmed) return;

    setReapplying(true);
    try {
      const newApp = await cloneApplication(application.id);
      toast.success(t('applicant_detail.reapply_success'));
      navigate(ROUTES.PARENT_APPLICATION_DETAIL(newApp.id));
    } catch {
      toast.error(t('applicant_detail.reapply_error'));
    } finally {
      setReapplying(false);
    }
  }

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

  // Destructure for cleaner JSX below
  const camper  = application.camper;
  const session = application.session;

  return (
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
            <StatusTimeline status={application.status} />
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

        {/* Camper information — only rendered when camper data was eager-loaded */}
        {camper && (
          <div>
            <SectionCard title={t('applicant_detail.camper_info')} icon={<User className="h-4 w-4" />}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label={t('applicant_detail.field_full_name')} value={camper.full_name} />
                <Field label={t('applicant_detail.field_dob')}       value={camper.date_of_birth} />
                <Field label={t('applicant_detail.field_gender')}    value={camper.gender} />
                {/* Handle both t_shirt_size and tshirt_size field name variants from the API */}
                <Field label={t('applicant_detail.field_tshirt')}    value={(camper as { t_shirt_size?: string }).t_shirt_size ?? (camper as { tshirt_size?: string }).tshirt_size} />
              </div>
            </SectionCard>
          </div>
        )}

        {/* Camp session details — only rendered when session data was eager-loaded */}
        {session && (
          <div>
            <SectionCard title={t('applicant_detail.camp_session_title')} icon={<Calendar className="h-4 w-4" />}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label={t('applicant_detail.field_session')} value={session.name} />
                <Field label={t('applicant_detail.field_camp')}    value={session.camp?.name} />
                <Field label={t('applicant_detail.field_start')}   value={session.start_date ? format(new Date(session.start_date), 'MMMM d, yyyy') : undefined} />
                <Field label={t('applicant_detail.field_end')}     value={session.end_date   ? format(new Date(session.end_date),   'MMMM d, yyyy') : undefined} />
              </div>
            </SectionCard>
          </div>
        )}

        {/* Application completeness — digital form + medical form upload status */}
        <div>
          <SectionCard title={t('applicant_detail.checklist_title')} icon={<CheckCircle className="h-4 w-4" />}>
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
              {/* Digital form */}
              <div className="flex items-center justify-between gap-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#16a34a' }} />
                  <div>
                    <span className="text-sm" style={{ color: 'var(--foreground)' }}>{t('applicant_detail.application_form_label')}</span>
                    <span className="ml-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('applicant_detail.digital_label')}</span>
                  </div>
                </div>
                <span className="text-xs font-medium" style={{ color: '#16a34a' }}>{t('applicant_detail.submitted_label')}</span>
              </div>

              {/* Medical form upload */}
              {(() => {
                const medicalDoc = application.documents?.find(
                  (d) => d.document_type === 'official_medical_form'
                );
                return (
                  <div className="flex items-center justify-between gap-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {medicalDoc ? (
                        <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#16a34a' }} />
                      ) : (
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: '#ca8a04' }} />
                      )}
                      <div>
                        <span className="text-sm" style={{ color: 'var(--foreground)' }}>{t('applicant_detail.medical_form_label')}</span>
                        <span className="ml-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('applicant_detail.doctor_complete')}</span>
                      </div>
                    </div>
                    {medicalDoc ? (
                      <span className="text-xs font-medium" style={{ color: '#16a34a' }}>{t('applicant_detail.uploaded_label')}</span>
                    ) : (
                      <Link
                        to={ROUTES.PARENT_FORMS}
                        className="text-xs font-medium hover:underline"
                        style={{ color: '#ca8a04' }}
                      >
                        {t('applicant_detail.upload_link')}
                      </Link>
                    )}
                  </div>
                );
              })()}
            </div>
          </SectionCard>
        </div>

        {/* Documents — list all uploaded files with view and download buttons */}
        <div>
          <SectionCard title={t('applicant_detail.documents_title')} icon={<FileText className="h-4 w-4" />}>
            {!application.documents || application.documents.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                No documents uploaded for this application.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {application.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-xl border"
                    style={{ borderColor: 'var(--border)', background: 'transparent' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                      <div className="min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>
                          {doc.name ?? doc.file_name}
                        </p>
                        {/* Convert bytes to KB for a friendlier size display */}
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {(doc.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* View button — opens the file in a new tab if a URL is available */}
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:border-[var(--ember-orange)]"
                          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                        >
                          View
                        </a>
                      )}
                      <button
                        onClick={() => handleDownload(doc.id, doc.name ?? doc.file_name)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:border-[var(--ember-orange)]"
                        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* What's Next — status-specific guidance including medical form requirement */}
      {application && (
        <div>
          <SectionCard
            title={application.status === 'approved' ? 'You\'re In!' : 'What Happens Next'}
            icon={<Info className="h-4 w-4" />}
          >
            {application.status === 'pending' && (
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
          {/* Reapply button — visible for terminal states where reapplication is appropriate. */}
          {application && ['rejected', 'withdrawn', 'cancelled'].includes(application.status) && (
            <button
              onClick={handleReapply}
              disabled={reapplying}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border transition-colors disabled:opacity-50"
              style={{ borderColor: 'var(--ember-orange)', color: 'var(--ember-orange)' }}
            >
              <RefreshCw className="h-4 w-4" />
              {reapplying ? 'Creating draft…' : 'Reapply'}
            </button>
          )}

          {/* Withdraw button — only visible when the application is still withdrawable. */}
          {application && ['pending', 'under_review', 'approved', 'waitlisted'].includes(application.status) && (
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
  );
}
