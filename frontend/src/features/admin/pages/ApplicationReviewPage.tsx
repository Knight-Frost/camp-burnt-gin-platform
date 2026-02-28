/**
 * ApplicationReviewPage.tsx
 *
 * Full application detail view for admins.
 * Shows camper info, medical data, documents, and review action panel.
 * Route: /admin/applications/:id
 */

import { useState, useEffect, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ArrowLeft, User, FileText, Heart, Pill, AlertTriangle,
  CheckCircle, XCircle, Clock, Download, ChevronRight,
} from 'lucide-react';

import { getApplication, reviewApplication } from '@/features/admin/api/admin.api';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { Button } from '@/ui/components/Button';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { pageEntry, staggerContainer, staggerChild } from '@/shared/constants/motion';
import { axiosInstance } from '@/api/axios.config';
import type { Application } from '@/features/admin/types/admin.types';

// ---------------------------------------------------------------------------
// Section card wrapper
// ---------------------------------------------------------------------------

interface SectionCardProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

function SectionCard({ title, icon, children }: SectionCardProps) {
  return (
    <div
      className="rounded-xl p-6 border"
      style={{
        background: 'var(--glass-medium)',
        borderColor: 'var(--border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: 'rgba(22,163,74,0.12)' }}
        >
          <span style={{ color: 'var(--ember-orange)' }}>{icon}</span>
        </div>
        <h3 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review panel
// ---------------------------------------------------------------------------

interface ReviewPanelProps {
  applicationId: number;
  currentStatus: Application['status'];
  onReviewed: (updated: Application) => void;
}

function ReviewPanel({ applicationId, currentStatus, onReviewed }: ReviewPanelProps) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState<'accepted' | 'rejected' | 'under_review' | null>(null);

  async function handleReview(status: 'accepted' | 'rejected' | 'under_review') {
    setSubmitting(status);
    try {
      const updated = await reviewApplication(applicationId, { status, notes });
      onReviewed(updated);
      toast.success(t('admin.review.success', { status }));
    } catch {
      toast.error(t('admin.review.error'));
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div
      className="rounded-xl p-6 border sticky top-6"
      style={{
        background: 'var(--glass-medium)',
        borderColor: 'var(--border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <h3 className="font-headline font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
        {t('admin.review.title')}
      </h3>

      <div className="mb-4">
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
          {t('admin.review.current_status')}
        </p>
        <StatusBadge status={currentStatus} />
      </div>

      <div className="mb-5">
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
          {t('admin.review.notes_label')}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder={t('admin.review.notes_placeholder')}
          className="w-full rounded-lg px-3 py-2 text-sm resize-none border outline-none focus:ring-2 transition-all"
          style={{
            background: 'var(--input)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={() => handleReview('accepted')}
          loading={submitting === 'accepted'}
          disabled={!!submitting}
          variant="primary"
          icon={<CheckCircle className="h-4 w-4" />}
        >
          {t('admin.review.accept')}
        </Button>
        <Button
          onClick={() => handleReview('under_review')}
          loading={submitting === 'under_review'}
          disabled={!!submitting}
          variant="secondary"
          icon={<Clock className="h-4 w-4" />}
        >
          {t('admin.review.mark_under_review')}
        </Button>
        <Button
          onClick={() => handleReview('rejected')}
          loading={submitting === 'rejected'}
          disabled={!!submitting}
          variant="ghost"
          icon={<XCircle className="h-4 w-4" />}
          style={{ color: 'var(--destructive)' }}
        >
          {t('admin.review.reject')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ApplicationReviewPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(false);
    getApplication(Number(id))
      .then(setApplication)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  function handleDownload(documentId: number, name: string) {
    axiosInstance
      .get(`/documents/${documentId}/download`, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data as Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error(t('common.download_error')));
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeletons.Block height={40} width={200} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeletons.Card />
            <Skeletons.Card />
          </div>
          <Skeletons.Card />
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <EmptyState
        title={t('admin.review.not_found')}
        description={t('admin.review.not_found_desc')}
        action={{ label: t('common.go_back'), onClick: () => navigate(-1) }}
      />
    );
  }

  const camper = application.camper;
  const medical = camper?.medical_record;

  return (
    <motion.div
      variants={pageEntry}
      initial="hidden"
      animate="visible"
      className="p-6 max-w-7xl"
    >
      {/* Back navigation */}
      <Link
        to="/admin/applications"
        className="inline-flex items-center gap-2 text-sm mb-6 transition-colors"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ArrowLeft className="h-4 w-4" />
        {t('admin.review.back_to_applications')}
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            {camper?.full_name ?? t('admin.review.unknown_camper')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('admin.review.application_id', { id: application.id })}
            {application.submitted_at && (
              <> &middot; {t('admin.review.submitted', { date: new Date(application.submitted_at).toLocaleDateString() })}</>
            )}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: detail columns */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="lg:col-span-2 space-y-5"
        >
          {/* Camper info */}
          <motion.div variants={staggerChild}>
            <SectionCard title={t('admin.review.camper_info')} icon={<User className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  [t('admin.review.field_name'), camper?.full_name],
                  [t('admin.review.field_dob'), camper?.date_of_birth],
                  [t('admin.review.field_gender'), camper?.gender],
                  [t('admin.review.field_shirt'), camper?.t_shirt_size],
                  [t('admin.review.field_session'), application.session?.name],
                  [t('admin.review.field_camp'), application.session?.camp?.name],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                    <p style={{ color: 'var(--foreground)' }}>{value ?? t('common.not_provided')}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </motion.div>

          {/* Medical summary */}
          {medical && (
            <motion.div variants={staggerChild}>
              <SectionCard title={t('admin.review.medical_summary')} icon={<Heart className="h-4 w-4" />}>
                {medical.primary_diagnosis && (
                  <div className="mb-4">
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      {t('admin.review.primary_diagnosis')}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                      {medical.primary_diagnosis}
                    </p>
                  </div>
                )}

                {medical.allergies && medical.allergies.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
                      <AlertTriangle className="h-3 w-3" /> {t('admin.review.allergies')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {medical.allergies.map((a) => (
                        <span
                          key={a.id}
                          className="text-xs px-2.5 py-1 rounded-full border"
                          style={{
                            background: a.severity === 'life-threatening' ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.1)',
                            borderColor: a.severity === 'life-threatening' ? 'rgba(220,38,38,0.4)' : 'rgba(22,163,74,0.3)',
                            color: a.severity === 'life-threatening' ? 'var(--destructive)' : 'var(--warm-amber)',
                          }}
                        >
                          {a.name} — {a.severity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {medical.medications && medical.medications.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
                      <Pill className="h-3 w-3" /> {t('admin.review.medications')}
                    </p>
                    <div className="space-y-1.5">
                      {medical.medications.map((m) => (
                        <p key={m.id} className="text-sm" style={{ color: 'var(--foreground)' }}>
                          {m.name} — {m.dosage}, {m.frequency}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>
            </motion.div>
          )}

          {/* Documents */}
          <motion.div variants={staggerChild}>
            <SectionCard title={t('admin.review.documents')} icon={<FileText className="h-4 w-4" />}>
              {!application.documents || application.documents.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {t('admin.review.no_documents')}
                </p>
              ) : (
                <div className="space-y-2">
                  {application.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                        <div className="min-w-0">
                          <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{doc.name}</p>
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {(doc.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownload(doc.id, doc.name)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
                        style={{
                          borderColor: 'var(--border)',
                          color: 'var(--muted-foreground)',
                        }}
                      >
                        <Download className="h-3 w-3" />
                        {t('common.download')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </motion.div>

          {/* Review notes history */}
          {application.notes && (
            <motion.div variants={staggerChild}>
              <SectionCard title={t('admin.review.review_notes')} icon={<ChevronRight className="h-4 w-4" />}>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>
                  {application.notes}
                </p>
              </SectionCard>
            </motion.div>
          )}
        </motion.div>

        {/* Right: review panel */}
        <div>
          <ReviewPanel
            applicationId={application.id}
            currentStatus={application.status}
            onReviewed={setApplication}
          />
        </div>
      </div>
    </motion.div>
  );
}
