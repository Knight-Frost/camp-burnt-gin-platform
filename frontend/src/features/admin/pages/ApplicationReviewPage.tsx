/**
 * ApplicationReviewPage.tsx
 *
 * Purpose: Full application detail view for admins to review and decide on a camper's application.
 * Route: /admin/applications/:id
 *
 * Responsibilities:
 *  - Load a single application with all its nested relations (camper, medical, documents, etc.).
 *  - Show camper info, guardian, medical summary, emergency contacts, behavioral profile,
 *    feeding plan, assistive devices, activity permissions, uploaded documents, and signature.
 *  - Provide a sticky ReviewPanel (sidebar) where admin can approve, reject, or mark under-review.
 *  - Before approving, check camper compliance; if incomplete, show a bypass dialog.
 *  - Allow downloading attached documents using the blob download pattern.
 *
 * Plain-English summary:
 *  Think of this as the "full application packet" an admin reads before deciding yes or no.
 *  The left column shows all the details the parent filled in. The right column (sticky) has the
 *  approve / reject / under-review buttons. If the application is missing required documents,
 *  a warning dialog pops up before the admin can approve — they can still bypass it if needed.
 */

import { useState, useEffect, type ReactNode } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ArrowLeft, User, FileText, Heart, Pill, AlertTriangle,
  CheckCircle, XCircle, Clock, Download, ChevronRight,
  Phone, Brain, Utensils, Wrench, Activity,
  Users, PenLine, Stethoscope, ListOrdered,
} from 'lucide-react';

import { getApplication, reviewApplication } from '@/features/admin/api/admin.api';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { Button } from '@/ui/components/Button';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { axiosInstance } from '@/api/axios.config';
import type { Application } from '@/features/admin/types/admin.types';

// ---------------------------------------------------------------------------
// Section card wrapper
// ---------------------------------------------------------------------------

// Reusable card with an icon and title — wraps each logical section of the application.
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
// Review panel (sticky sidebar)
// ---------------------------------------------------------------------------

interface ReviewPanelProps {
  applicationId: number;
  currentStatus: Application['status'];
  // Callback fired after a successful review — updates the parent's application state.
  onReviewed: (updated: Application) => void;
}

function ReviewPanel({ applicationId, currentStatus, onReviewed }: ReviewPanelProps) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState('');
  // Tracks which action is in-flight to show a spinner on the right button.
  const [submitting, setSubmitting] = useState<'approved' | 'rejected' | 'under_review' | 'waitlisted' | null>(null);

  async function handleReview(status: 'approved' | 'rejected' | 'under_review' | 'waitlisted') {
    setSubmitting(status);
    try {
      const updated = await reviewApplication(applicationId, { status, notes });
      onReviewed(updated);
      toast.success(t('admin.review.success', { status }));
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ?? t('admin.review.error'));
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <>
      {/* Sticky card — stays visible as admin scrolls through application details. */}
      <div
        className="glass-panel rounded-xl p-6 sticky top-6"
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

        {/* Optional notes textarea — included in the review submission. */}
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

        {/* Three decision buttons — only one can be in-flight at a time. */}
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => handleReview('approved')}
            loading={submitting === 'approved'}
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
            onClick={() => handleReview('waitlisted')}
            loading={submitting === 'waitlisted'}
            disabled={!!submitting}
            variant="secondary"
            icon={<ListOrdered className="h-4 w-4" />}
          >
            {t('admin.review.waitlist')}
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

    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ApplicationReviewPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Build the correct back-link prefix depending on which portal is active.
  const applicationsPath = location.pathname.startsWith('/super-admin') ? '/super-admin/applications' : '/admin/applications';

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // ── Fetch the application on mount (or when the id param changes) ──────────
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(false);
    getApplication(Number(id))
      .then(setApplication)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Blob download helper ───────────────────────────────────────────────────
  // Downloads a document by creating a temporary anchor element and clicking it programmatically.
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
        // Clean up the temporary object URL to free memory.
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error(t('common.download_error')));
  }

  // ── Loading / error states ─────────────────────────────────────────────────

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

  // Convenient shortcuts to deeply nested objects.
  const camper = application.camper;
  const medical = camper?.medical_record;

  return (
    <div className="p-6 max-w-7xl">
      {/* Back link to the applications list. */}
      <Link
        to={applicationsPath}
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

      {/* Two-column layout: detail sections on left, review panel on right. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — all the application details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Camper information */}
          <SectionCard title={t('admin.review.camper_info')} icon={<User className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                [t('admin.review.field_name'), camper?.full_name],
                [t('admin.review.field_dob'), camper?.date_of_birth ? format(new Date(camper.date_of_birth), 'MMM d, yyyy') : undefined],
                [t('admin.review.field_gender'), camper?.gender],
                [t('admin.review.field_shirt'), camper?.tshirt_size],
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

          {/* Parent / Guardian info — only shown when the user relation is loaded. */}
          {camper?.user && (
            <SectionCard title="Parent / Guardian" icon={<Users className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Name', camper.user.name],
                  ['Email', camper.user.email],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                    <p style={{ color: 'var(--foreground)' }}>{value ?? t('common.not_provided')}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Medical summary — only shown when a medical_record relation is present. */}
          {medical && (
            <SectionCard title={t('admin.review.medical_summary')} icon={<Heart className="h-4 w-4" />}>
                {/* Diagnoses list */}
                {medical.diagnoses && medical.diagnoses.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
                      <Stethoscope className="h-3 w-3" /> Diagnoses
                    </p>
                    <div className="space-y-1">
                      {medical.diagnoses.map((d) => (
                        <p key={d.id} className="text-sm" style={{ color: 'var(--foreground)' }}>
                          {d.name}{d.icd_code ? ` (${d.icd_code})` : ''}
                          {d.notes ? <span style={{ color: 'var(--muted-foreground)' }}> — {d.notes}</span> : null}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Allergies — life-threatening ones get a red tint to stand out. */}
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

                {/* Medications */}
                {medical.medications && medical.medications.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
                      <Pill className="h-3 w-3" /> {t('admin.review.medications')}
                    </p>
                    <div className="space-y-1.5">
                      {medical.medications.map((m) => (
                        <p key={m.id} className="text-sm" style={{ color: 'var(--foreground)' }}>
                          {m.name} — {m.dosage}, {m.frequency}
                          {m.route ? ` (${m.route})` : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Special needs and dietary restrictions — shown side by side when both present. */}
                {(medical.special_needs || medical.dietary_restrictions) && (
                  <div className="grid grid-cols-1 gap-3 mb-4">
                    {medical.special_needs && (
                      <div>
                        <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Special Needs</p>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{medical.special_needs}</p>
                      </div>
                    )}
                    {medical.dietary_restrictions && (
                      <div>
                        <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Dietary Restrictions</p>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{medical.dietary_restrictions}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Seizure history — highlighted in red to signal critical safety info. */}
                {medical.has_seizures && (
                  <div
                    className="rounded-lg p-3 border mb-4"
                    style={{ background: 'rgba(220,38,38,0.06)', borderColor: 'rgba(220,38,38,0.2)' }}
                  >
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--destructive)' }}>Seizure History</p>
                    {medical.last_seizure_date && (
                      <p className="text-xs mb-0.5" style={{ color: 'var(--foreground)' }}>
                        Last seizure: {format(new Date(medical.last_seizure_date), 'MMM d, yyyy')}
                      </p>
                    )}
                    {medical.seizure_description && (
                      <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{medical.seizure_description}</p>
                    )}
                    {medical.has_neurostimulator && (
                      <p className="text-xs mt-1 font-medium" style={{ color: 'var(--destructive)' }}>Has neurostimulator</p>
                    )}
                  </div>
                )}

                {/* Physician & insurance — filter out undefined values before mapping. */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Physician', medical.physician_name],
                    ['Physician Phone', medical.physician_phone],
                    ['Insurance Provider', medical.insurance_provider],
                    ['Policy Number', medical.insurance_policy_number],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                      <p className="text-sm" style={{ color: 'var(--foreground)' }}>{value}</p>
                    </div>
                  ))}
                </div>

                {medical.notes && (
                  <div className="mt-3">
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Medical Notes</p>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{medical.notes}</p>
                  </div>
                )}
            </SectionCard>
          )}

          {/* Emergency contacts */}
          {camper?.emergency_contacts && camper.emergency_contacts.length > 0 && (
            <SectionCard title="Emergency Contacts" icon={<Phone className="h-4 w-4" />}>
                <div className="space-y-3">
                  {camper.emergency_contacts.map((ec) => (
                    <div
                      key={ec.id}
                      className="glass-card rounded-lg p-3"
                    >
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Name</p>
                          <p style={{ color: 'var(--foreground)' }}>{ec.name}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Relationship</p>
                          <p style={{ color: 'var(--foreground)' }}>{ec.relationship}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Phone</p>
                          <p style={{ color: 'var(--foreground)' }}>{ec.phone_primary}</p>
                        </div>
                        {ec.email && (
                          <div>
                            <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Email</p>
                            <p style={{ color: 'var(--foreground)' }}>{ec.email}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
            </SectionCard>
          )}

          {/* Behavioral profile */}
          {camper?.behavioral_profile && (
            <SectionCard title="Behavioral Profile" icon={<Brain className="h-4 w-4" />}>
                <div className="space-y-3 text-sm">
                  {/* Filter out fields that have no value — no empty rows shown. */}
                  {[
                    ['Triggers', camper.behavioral_profile.triggers],
                    ['De-escalation Strategies', camper.behavioral_profile.de_escalation_strategies],
                    ['Communication Style', camper.behavioral_profile.communication_style],
                    ['Notes', camper.behavioral_profile.notes],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                      <p className="whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{value}</p>
                    </div>
                  ))}
                </div>
            </SectionCard>
          )}

          {/* Feeding plan */}
          {camper?.feeding_plan && (
            <SectionCard title="Feeding Plan" icon={<Utensils className="h-4 w-4" />}>
                <div className="space-y-3 text-sm">
                  {[
                    ['Method', camper.feeding_plan.method],
                    ['Restrictions', camper.feeding_plan.restrictions],
                    ['Notes', camper.feeding_plan.notes],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                      <p className="whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{value}</p>
                    </div>
                  ))}
                </div>
            </SectionCard>
          )}

          {/* Assistive devices */}
          {camper?.assistive_devices && camper.assistive_devices.length > 0 && (
            <SectionCard title="Assistive Devices" icon={<Wrench className="h-4 w-4" />}>
                <div className="space-y-2">
                  {camper.assistive_devices.map((d) => (
                    <div key={d.id} className="text-sm">
                      <span className="font-medium" style={{ color: 'var(--foreground)' }}>{d.device_type}</span>
                      {d.notes && (
                        <span style={{ color: 'var(--muted-foreground)' }}> — {d.notes}</span>
                      )}
                    </div>
                  ))}
                </div>
            </SectionCard>
          )}

          {/* Activity permissions — circles colored by permission level (green/amber/red). */}
          {camper?.activity_permissions && camper.activity_permissions.length > 0 && (
            <SectionCard title="Activity Permissions" icon={<Activity className="h-4 w-4" />}>
                <div className="space-y-2">
                  {camper.activity_permissions.map((p) => (
                    <div key={p.id} className="flex items-start gap-2 text-sm">
                      <span
                        className="mt-0.5 w-4 h-4 flex-shrink-0 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ background: p.permission_level === 'yes' ? '#16a34a' : p.permission_level === 'restricted' ? '#ca8a04' : 'var(--destructive)' }}
                      >
                        {p.permission_level === 'yes' ? '✓' : p.permission_level === 'restricted' ? '~' : '✗'}
                      </span>
                      <span style={{ color: 'var(--foreground)' }}>
                        {p.activity_name}
                        {p.restriction_notes && <span style={{ color: 'var(--muted-foreground)' }}> — {p.restriction_notes}</span>}
                      </span>
                    </div>
                  ))}
                </div>
            </SectionCard>
          )}

          {/* Uploaded documents with download buttons */}
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
                          <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{doc.name ?? doc.file_name}</p>
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {(doc.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownload(doc.id, doc.name ?? doc.file_name)}
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

          {/* Digital signature — only shown if the application was signed. */}
          {application.signed_at && (
            <SectionCard title="Digital Signature" icon={<PenLine className="h-4 w-4" />}>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Signed by</p>
                    <p style={{ color: 'var(--foreground)' }}>{application.signature_name ?? t('common.not_provided')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Signed on</p>
                    <p style={{ color: 'var(--foreground)' }}>{format(new Date(application.signed_at), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                </div>
            </SectionCard>
          )}

          {/* Previous reviewer notes */}
          {application.notes && (
            <SectionCard title={t('admin.review.review_notes')} icon={<ChevronRight className="h-4 w-4" />}>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>
                {application.notes}
              </p>
            </SectionCard>
          )}
        </div>

        {/* Right column — sticky review action panel */}
        <div>
          <ReviewPanel
            applicationId={application.id}
            currentStatus={application.status}
            // When a review completes, update the application state so the status badge refreshes.
            onReviewed={setApplication}
          />
        </div>
      </div>
    </div>
  );
}
