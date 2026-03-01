/**
 * ParentApplicationDetailPage.tsx
 * Read-only view of a single application for the parent who submitted it.
 * Shows camper info, session, current status, admin review notes, and uploaded documents.
 * Route: /parent/applications/:id
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, User, FileText, Calendar, Download,
  CheckCircle, Clock, AlertTriangle, XCircle, Info,
} from 'lucide-react';
import { format } from 'date-fns';

import { getApplication } from '@/features/parent/api/parent.api';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { ErrorState } from '@/ui/components/EmptyState';
import { SkeletonCard } from '@/ui/components/Skeletons';
import { ROUTES } from '@/shared/constants/routes';
import { scrollRevealVariants, staggerContainerVariants, staggerChildVariants } from '@/shared/constants/motion';
import axiosInstance from '@/api/axios.config';
import type { Application } from '@/features/admin/types/admin.types';

// ─── Section card ──────────────────────────────────────────────────────────────

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

// ─── Field row ────────────────────────────────────────────────────────────────

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

const STATUS_STEPS: { status: string; label: string; icon: React.ReactNode }[] = [
  { status: 'submitted',    label: 'Submitted',    icon: <FileText className="h-3.5 w-3.5" /> },
  { status: 'under_review', label: 'Under review', icon: <Clock className="h-3.5 w-3.5" /> },
  { status: 'accepted',     label: 'Accepted',     icon: <CheckCircle className="h-3.5 w-3.5" /> },
];

function StatusTimeline({ status }: { status: string }) {
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
    return (
      <div className="flex items-center gap-2 py-2">
        <Info className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          This application is still a draft and has not been submitted.
        </p>
      </div>
    );
  }

  const stepOrder = ['submitted', 'under_review', 'accepted'];
  const currentIdx = stepOrder.indexOf(status);

  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((step, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;
        const pending = i > currentIdx;

        return (
          <div key={step.status} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  background: done || active ? 'var(--ember-orange)' : 'var(--border)',
                  color: done || active ? '#fff' : 'var(--muted-foreground)',
                }}
              >
                {step.icon}
              </div>
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

export function ParentApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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

  function handleDownload(docId: number, name: string) {
    axiosInstance
      .get(`/documents/${docId}/download`, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data as Blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error('Download failed. Please try again.'));
  }

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

  const camper  = application.camper;
  const session = application.session;

  return (
    <motion.div
      variants={scrollRevealVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-6 max-w-3xl"
    >
      {/* Back link */}
      <Link
        to={ROUTES.PARENT_APPLICATIONS}
        className="inline-flex items-center gap-2 text-sm transition-colors w-fit"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to applications
      </Link>

      {/* Header */}
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

      <motion.div
        variants={staggerContainerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-5"
      >
        {/* Status timeline */}
        <motion.div variants={staggerChildVariants}>
          <SectionCard title="Application Status" icon={<AlertTriangle className="h-4 w-4" />}>
            <StatusTimeline status={application.status} />
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
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>
                  {application.notes}
                </p>
              </div>
            )}
          </SectionCard>
        </motion.div>

        {/* Camper info */}
        {camper && (
          <motion.div variants={staggerChildVariants}>
            <SectionCard title="Camper Information" icon={<User className="h-4 w-4" />}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Full name"     value={camper.full_name} />
                <Field label="Date of birth" value={camper.date_of_birth} />
                <Field label="Gender"        value={camper.gender} />
                <Field label="T-shirt size"  value={(camper as { t_shirt_size?: string }).t_shirt_size ?? (camper as { tshirt_size?: string }).tshirt_size} />
              </div>
            </SectionCard>
          </motion.div>
        )}

        {/* Session info */}
        {session && (
          <motion.div variants={staggerChildVariants}>
            <SectionCard title="Camp Session" icon={<Calendar className="h-4 w-4" />}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Session"    value={session.name} />
                <Field label="Camp"       value={session.camp?.name} />
                <Field label="Start date" value={session.start_date ? format(new Date(session.start_date), 'MMMM d, yyyy') : undefined} />
                <Field label="End date"   value={session.end_date   ? format(new Date(session.end_date),   'MMMM d, yyyy') : undefined} />
              </div>
            </SectionCard>
          </motion.div>
        )}

        {/* Documents */}
        <motion.div variants={staggerChildVariants}>
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
        </motion.div>
      </motion.div>

      {/* Footer action */}
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
    </motion.div>
  );
}
