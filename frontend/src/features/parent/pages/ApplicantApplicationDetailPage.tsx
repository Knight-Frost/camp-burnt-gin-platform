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

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, User, FileText, Calendar, Download,
  CheckCircle, Clock, AlertTriangle, XCircle, Info,
} from 'lucide-react';
import { format } from 'date-fns';

import { getApplication } from '@/features/parent/api/applicant.api';
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
  icon: React.ReactNode;
  children: React.ReactNode;
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
  return (
    <div>
      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </p>
      <p className="text-sm" style={{ color: value ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
        {value ?? 'Not provided'}
      </p>
    </div>
  );
}

// ─── Status timeline ──────────────────────────────────────────────────────────

// Defines the three main forward-progress steps for a typical application
const STATUS_STEPS: { status: string; label: string; icon: React.ReactNode }[] = [
  { status: 'pending',      label: 'Submitted',    icon: <FileText className="h-3.5 w-3.5" /> },
  { status: 'under_review', label: 'Under review', icon: <Clock className="h-3.5 w-3.5" /> },
  { status: 'approved',     label: 'Approved',     icon: <CheckCircle className="h-3.5 w-3.5" /> },
];

// Visual progress indicator showing where an application is in the review pipeline
function StatusTimeline({ status }: { status: string }) {
  // Terminal failure states get their own simple message instead of a progress bar
  if (status === 'rejected' || status === 'withdrawn') {
    return (
      <div className="flex items-center gap-2 py-2">
        <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--destructive)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--destructive)' }}>
          {status === 'rejected' ? 'Application was not accepted.' : 'Application was withdrawn.'}
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
          This application is still a draft and has not been submitted.
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

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
      .catch(() => toast.error('Download failed. Please try again.'));
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
        Back to applications
      </Link>

      {/* Page header: camper name + status badge */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            className="text-xl font-headline font-semibold"
            style={{ color: 'var(--foreground)' }}
          >
            {camper?.full_name ?? `Application #${application.id}`}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Application #{application.id}
            {application.submitted_at && (
              <> &middot; Submitted {format(new Date(application.submitted_at), 'MMMM d, yyyy')}</>
            )}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      {/* Card sections */}
      <div className="flex flex-col gap-5">
        {/* Status timeline card — always shown */}
        <div>
          <SectionCard title="Application Status" icon={<AlertTriangle className="h-4 w-4" />}>
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
                  Review notes from camp staff
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
            <SectionCard title="Camper Information" icon={<User className="h-4 w-4" />}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Full name"     value={camper.full_name} />
                <Field label="Date of birth" value={camper.date_of_birth} />
                <Field label="Gender"        value={camper.gender} />
                {/* Handle both t_shirt_size and tshirt_size field name variants from the API */}
                <Field label="T-shirt size"  value={(camper as { t_shirt_size?: string }).t_shirt_size ?? (camper as { tshirt_size?: string }).tshirt_size} />
              </div>
            </SectionCard>
          </div>
        )}

        {/* Camp session details — only rendered when session data was eager-loaded */}
        {session && (
          <div>
            <SectionCard title="Camp Session" icon={<Calendar className="h-4 w-4" />}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Session"    value={session.name} />
                <Field label="Camp"       value={session.camp?.name} />
                <Field label="Start date" value={session.start_date ? format(new Date(session.start_date), 'MMMM d, yyyy') : undefined} />
                <Field label="End date"   value={session.end_date   ? format(new Date(session.end_date),   'MMMM d, yyyy') : undefined} />
              </div>
            </SectionCard>
          </div>
        )}

        {/* Documents — list all uploaded files with download buttons */}
        <div>
          <SectionCard title="Uploaded Documents" icon={<FileText className="h-4 w-4" />}>
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
                          {doc.name}
                        </p>
                        {/* Convert bytes to KB for a friendlier size display */}
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {(doc.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(doc.id, doc.name)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:border-[var(--ember-orange)]"
                      style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Footer — secondary back navigation */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => navigate(ROUTES.PARENT_APPLICATIONS)}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all applications
        </button>
      </div>
    </div>
  );
}
