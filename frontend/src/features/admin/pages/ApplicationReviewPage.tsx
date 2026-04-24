/**
 * ApplicationReviewPage.tsx
 *
 * Admin application review. Route: /admin/applications/:id (and the mirrored
 * /super-admin path). The page renders a SINGLE unified view of the
 * application driven entirely by the canonical ApplicationResource — the
 * same 11-section projection the applicant portal consumes. Every editable
 * section exposes a pencil button that routes the admin to the full
 * multi-section editor (AdminApplicationEditPage) scrolled to the matching
 * section via URL hash.
 *
 * Per-section in-place edit forms used to live in this file (Camper,
 * Emergency Contacts, Behavioral Profile, Narratives, inline JSX for
 * Medical Summary / Personal Care / Equipment / Activities / Documents /
 * Consents). Those are intentionally gone: they duplicated the canonical
 * rendering and drifted from it as the applicant portal evolved. One view,
 * one source of truth.
 *
 * What remains:
 *   - The top banners (incomplete-at-approval, paper packet, reapplication).
 *   - The header (name, status, stat cards).
 *   - The left column: <CanonicalApplicationSections role="admin" editable onEditSection=…>.
 *   - The right column: <ReviewPanel> (unchanged — approve/reject/waitlist/cancel).
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft, AlertTriangle, CheckCircle, XCircle, Clock, ListOrdered, Save,
} from 'lucide-react';

import {
  getApplicationCanonical,
  reviewApplication,
  updateApplication,
  checkApplicationCompleteness,
  verifyDocument,
  startApplicationReview,
} from '@/features/admin/api/admin.api';
import { format as formatDate } from 'date-fns';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { Button } from '@/ui/components/Button';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { axiosInstance } from '@/api/axios.config';
import { ROUTES } from '@/shared/constants/routes';
import type { Application, ApplicationCompleteness } from '@/features/admin/types/admin.types';
import { IncompleteApprovalModal } from '@/features/admin/components/IncompleteApprovalModal';
import {
  CanonicalApplicationSections,
  type CanonicalSectionKey,
} from '@/features/applications/components/CanonicalApplicationSections';
import { PaperApplicationReviewView } from '@/features/admin/components/PaperApplicationReviewView';
import { ReviewHistoryPanel } from '@/features/admin/components/review/ReviewHistoryPanel';
import { InlineRequestDocumentButton } from '@/features/admin/components/review/InlineRequestDocumentButton';
import type { ReviewerApplicationDocument } from '@/features/admin/api/admin.api';
import type { CanonicalApplicationPayload } from '@/shared/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Statuses where per-section edit pencils are hidden. Approved / rejected /
 * waitlisted still allow edits (with a warning on the edit page itself), so
 * they are NOT in this set — only truly final lifecycle states.
 */
const TERMINAL_STATUSES = new Set<Application['status']>(['cancelled', 'withdrawn']);

// ---------------------------------------------------------------------------
// ReviewPanel — right-column approve/reject/waitlist/cancel
// ---------------------------------------------------------------------------

// Shape of the compliance_details payload returned in a 422 from ApplicationService
// when DocumentEnforcementService blocks approval.
interface ComplianceDetails {
  missing_documents?: Array<{ document_type: string; description?: string }>;
  expired_documents?: Array<{ document_type: string }>;
  unverified_documents?: Array<{ document_type: string; verification_status?: string }>;
}

interface ReviewPanelProps {
  applicationId: number;
  currentStatus: Application['status'];
  isDraft: boolean;
  /** Pre-populated from application.notes so edits persist across page loads. */
  initialNotes?: string;
  /** Timestamp admin first claimed the review (Phase 1 soft-claim). Null until someone clicks Start Review. */
  reviewStartedAt?: string | null;
  /** Timestamp final decision was recorded (approve/reject/waitlist). */
  reviewedAt?: string | null;
  onReviewed: (updated: Application) => void;
}

function ReviewPanel({
  applicationId, currentStatus, isDraft,
  initialNotes = '',
  reviewStartedAt, reviewedAt, onReviewed,
}: ReviewPanelProps) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState(initialNotes);
  const [savingNotes, setSavingNotes] = useState(false);
  const notesDirty = notes !== initialNotes;
  const [submitting, setSubmitting] = useState<
    'approved' | 'rejected' | 'under_review' | 'waitlisted' | 'cancelled' | null
  >(null);
  const [completenessReport, setCompletenessReport] = useState<ApplicationCompleteness | null>(null);
  /** Opens the "are you sure?" modal before an actual cancel. Cancel is
   *  destructive (notifies the parent, deactivates the camper on reversal
   *  from Approved), so we gate it behind an explicit confirmation. */
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      await updateApplication(applicationId, { notes });
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  }

  /**
   * Non-approval actions proceed directly. Approval first checks completeness:
   * if gaps exist, we surface the warning modal; otherwise we approve.
   */
  async function handleReview(status: 'approved' | 'rejected' | 'under_review' | 'waitlisted' | 'cancelled') {
    if (status !== 'approved') {
      await submitReview(status);
      return;
    }
    setSubmitting('approved');
    try {
      const report = await checkApplicationCompleteness(applicationId);
      if (report.is_complete) {
        await submitReview('approved');
      } else {
        setSubmitting(null);
        setCompletenessReport(report);
      }
    } catch {
      setSubmitting(null);
      toast.error(t('admin.review.error'));
    }
  }

  async function handleOverrideApprove() {
    if (!completenessReport) return;
    setSubmitting('approved');
    try {
      const updated = await reviewApplication(applicationId, {
        status: 'approved',
        notes,
        override_incomplete: true,
        missing_summary: {
          missing_fields:       completenessReport.missing_fields,
          missing_documents:    completenessReport.missing_documents,
          unverified_documents: completenessReport.unverified_documents ?? [],
          missing_consents:     completenessReport.missing_consents,
        },
      });
      setCompletenessReport(null);
      onReviewed(updated);
      toast.success(t('admin.review.success', { status: 'approved' }));
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ?? t('admin.review.error'));
    } finally {
      setSubmitting(null);
    }
  }

  async function submitReview(status: 'approved' | 'rejected' | 'under_review' | 'waitlisted' | 'cancelled') {
    setSubmitting(status);
    try {
      const updated = await reviewApplication(applicationId, { status, notes });
      onReviewed(updated);
      toast.success(t('admin.review.success', { status }));
    } catch (err) {
      // When approving, the backend may block on DocumentEnforcementService even when
      // ApplicationCompletenessService said "complete". The 422 interceptor spreads the
      // response body directly onto the error, so compliance_details is a top-level key.
      // Open the override modal so the admin can see what's missing and approve anyway.
      if (status === 'approved') {
        const details = (err as { compliance_details?: ComplianceDetails }).compliance_details;
        if (details) {
          const toItem = (d: { document_type: string; description?: string }) => ({
            key: d.document_type,
            label: d.description ?? d.document_type,
            severity: 'high' as const,
          });
          setCompletenessReport({
            is_complete: false,
            missing_fields: [],
            missing_documents: (details.missing_documents ?? []).map(toItem),
            unverified_documents: (details.unverified_documents ?? []).map(
              (d) => ({ key: d.document_type, label: d.document_type, severity: 'high' as const }),
            ),
            missing_consents: [],
          });
          return;
        }
      }
      const msg = (err as { message?: string })?.message;
      toast.error(msg ?? t('admin.review.error'));
    } finally {
      setSubmitting(null);
    }
  }

  /**
   * Soft-claim the review. Hits POST /applications/{id}/start-review which
   * stamps review_started_by + review_started_at and transitions Submitted →
   * UnderReview in one atomic call. Distinct from the legacy "Mark Under
   * Review" path (reviewApplication with under_review) — that transitions
   * status but doesn't record WHO opened the review, which left the review-
   * history timeline missing its first event.
   */
  async function handleStartReview() {
    setSubmitting('under_review');
    try {
      const updated = await startApplicationReview(applicationId);
      onReviewed(updated);
      toast.success('Review started.');
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ?? 'Could not start review.');
    } finally {
      setSubmitting(null);
    }
  }

  // Cancelled + withdrawn are the lifecycle-terminal states, but only
  // cancelled is admin-reversible — the ReviewPanel renders a dedicated
  // branch per status below.

  return (
    <>
      {completenessReport && (
        <IncompleteApprovalModal
          completeness={completenessReport}
          submitting={submitting === 'approved'}
          onClose={() => setCompletenessReport(null)}
          onApprove={handleOverrideApprove}
        />
      )}

      {/* Cancel confirmation — destructive action guard. The optional
          notes textarea lets the admin capture a reason which is
          delivered verbatim in the parent's inbox message. The backdrop
          uses a button element so screen readers + keyboard users get
          the same dismiss affordance as a click outside. */}
      {cancelConfirmOpen && (
        // role="dialog" is the appropriate landmark here; jsx-a11y's
        // no-noninteractive-element-interactions doesn't recognise dialog as
        // interactive, but it semantically is per WAI-ARIA. The Escape-to-close
        // handler is a standard accessibility pattern for modals.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-confirm-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !submitting) setCancelConfirmOpen(false);
          }}
        >
          {/* Backdrop click-to-dismiss as a button so it's keyboard- and
              screen-reader-accessible; visually hidden via inset positioning. */}
          <button
            type="button"
            aria-label="Close cancel confirmation"
            onClick={() => { if (!submitting) setCancelConfirmOpen(false); }}
            disabled={!!submitting}
            className="absolute inset-0 w-full h-full cursor-default"
            style={{ background: 'rgba(0,0,0,0.45)', border: 0 }}
          />
          <div
            className="relative w-full max-w-md rounded-2xl p-6"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0"
                style={{ background: 'rgba(220,38,38,0.10)' }}
                aria-hidden="true"
              >
                <AlertTriangle className="h-5 w-5" style={{ color: '#b91c1c' }} />
              </div>
              <div className="min-w-0">
                <h3
                  id="cancel-confirm-title"
                  className="font-headline font-semibold text-base"
                  style={{ color: 'var(--foreground)' }}
                >
                  Cancel this application?
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  This sends the parent an inbox message informing them of the
                  cancellation. If this application is currently approved, the
                  camper will also be deactivated (unless they hold another
                  approved enrollment). You can reopen a cancelled application
                  later if needed.
                </p>
              </div>
            </div>
            <label
              htmlFor="cancel-confirm-notes"
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Reason for cancellation (optional — shown to the parent)
            </label>
            <textarea
              id="cancel-confirm-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Explain briefly so the parent has context."
              className="w-full rounded-lg px-3 py-2 text-sm resize-none border outline-none focus:ring-2 transition-all mb-4"
              style={{
                background: 'var(--input)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                onClick={() => setCancelConfirmOpen(false)}
                disabled={!!submitting}
                variant="ghost"
              >
                Keep Application
              </Button>
              <Button
                onClick={async () => {
                  await submitReview('cancelled');
                  setCancelConfirmOpen(false);
                }}
                loading={submitting === 'cancelled'}
                disabled={!!submitting}
                variant="primary"
                icon={<XCircle className="h-4 w-4" />}
                style={{ background: 'var(--destructive)', color: '#fff' }}
              >
                Cancel Application
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Sticky was moved to the right-column container so ALL reviewer
          panels scroll as one unit (see ApplicationReviewPage two-column
          layout). Leaving an inner sticky here would double-pin and hide the
          Request Document + Review History cards below it. */}
      <div className="glass-panel rounded-xl p-6">
        <h3 className="font-headline font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
          {t('admin.review.title')}
        </h3>

        <div className="mb-4">
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('admin.review.current_status')}
          </p>
          <StatusBadge status={currentStatus} />

          {/* Reviewer attribution.
              review_started_at: set by /start-review (soft-claim); tells
              reviewers "this application is being looked at" even before a
              final decision lands.
              reviewed_at: set on the final decision (approve/reject/waitlist).
              Names for both live in the adjacent ReviewHistoryPanel so we
              don't duplicate them here; timestamps alone give the reviewer
              the "is this fresh?" signal they need. */}
          {(reviewStartedAt || reviewedAt) && (
            <div className="mt-2 space-y-0.5">
              {reviewStartedAt && (
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Review started {formatDate(new Date(reviewStartedAt), 'MMM d, yyyy · h:mm a')}
                </p>
              )}
              {reviewedAt && (
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Decision recorded {formatDate(new Date(reviewedAt), 'MMM d, yyyy · h:mm a')}
                </p>
              )}
            </div>
          )}
        </div>

        {isDraft ? (
          <div
            className="rounded-lg p-4 text-sm"
            style={{ background: 'rgba(234,179,8,0.08)', color: '#b45309' }}
          >
            This application is an <strong>unsubmitted draft</strong>. The applicant has not yet
            submitted it. No review actions are available until it is submitted.
          </div>
        ) : currentStatus === 'cancelled' ? (
          <>
            <div
              className="rounded-lg p-4 text-sm mb-3"
              style={{ background: 'rgba(107,114,128,0.08)', color: 'var(--muted-foreground)' }}
            >
              This application was cancelled by camp staff. You can reopen it
              below — the application will return to under-review so a fresh
              decision can be made, and the parent will be notified.
            </div>
            <Button
              onClick={() => submitReview('under_review')}
              loading={submitting === 'under_review'}
              disabled={!!submitting}
              variant="primary"
              icon={<Clock className="h-4 w-4" />}
            >
              Reopen Application
            </Button>
          </>
        ) : currentStatus === 'withdrawn' ? (
          <div
            className="rounded-lg p-4 text-sm"
            style={{ background: 'rgba(107,114,128,0.08)', color: 'var(--muted-foreground)' }}
          >
            {t('admin.review.withdrawn_notice', 'This application was withdrawn by the parent and cannot be changed.')}
          </div>
        ) : (
          <>
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
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => void handleSaveNotes()}
                  disabled={!notesDirty || savingNotes}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  <Save className="h-3 w-3" />
                  {savingNotes ? 'Saving…' : 'Save Notes'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {currentStatus === 'submitted' && (
                <>
                  <div
                    className="rounded-lg px-3 py-2 text-xs"
                    style={{ background: 'rgba(107,114,128,0.08)', color: 'var(--muted-foreground)' }}
                  >
                    {t('admin.review.pending_notice')}
                  </div>
                  {/* "Start Review" soft-claim: stamps reviewer + timestamp
                      and transitions Submitted → UnderReview. A different
                      admin can still claim the application later (no lock). */}
                  <Button
                    onClick={() => void handleStartReview()}
                    loading={submitting === 'under_review'}
                    disabled={!!submitting}
                    variant="primary"
                    icon={<Clock className="h-4 w-4" />}
                  >
                    Start Review
                  </Button>
                </>
              )}

              {currentStatus === 'under_review' && (
                <>
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
                </>
              )}

              {currentStatus === 'approved' && (
                <>
                  <div
                    className="rounded-lg px-3 py-2 text-xs mb-1"
                    style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--ember-orange)' }}
                  >
                    {t('admin.review.approved_notice', 'This application is approved. Use the actions below to reverse the decision.')}
                  </div>
                  <Button
                    onClick={() => handleReview('rejected')}
                    loading={submitting === 'rejected'}
                    disabled={!!submitting}
                    variant="ghost"
                    icon={<XCircle className="h-4 w-4" />}
                    style={{ color: 'var(--destructive)' }}
                  >
                    {t('admin.review.reverse_decision', 'Reverse Decision')}
                  </Button>
                  <Button
                    onClick={() => setCancelConfirmOpen(true)}
                    loading={submitting === 'cancelled'}
                    disabled={!!submitting}
                    variant="ghost"
                    icon={<XCircle className="h-4 w-4" />}
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {t('admin.review.cancel_enrollment', 'Cancel Enrollment')}
                  </Button>
                </>
              )}

              {currentStatus === 'rejected' && (
                <>
                  <div
                    className="rounded-lg px-3 py-2 text-xs mb-1"
                    style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--destructive)' }}
                  >
                    {t('admin.review.rejected_notice', 'This application was rejected. You may re-approve if circumstances have changed.')}
                  </div>
                  <Button
                    onClick={() => handleReview('approved')}
                    loading={submitting === 'approved'}
                    disabled={!!submitting}
                    variant="primary"
                    icon={<CheckCircle className="h-4 w-4" />}
                  >
                    {t('admin.review.re_approve', 'Re-approve Application')}
                  </Button>
                </>
              )}

              {currentStatus === 'waitlisted' && (
                <>
                  <Button
                    onClick={() => handleReview('approved')}
                    loading={submitting === 'approved'}
                    disabled={!!submitting}
                    variant="primary"
                    icon={<CheckCircle className="h-4 w-4" />}
                  >
                    {t('admin.review.promote_from_waitlist', 'Approve (Promote)')}
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
                  <Button
                    onClick={() => setCancelConfirmOpen(true)}
                    loading={submitting === 'cancelled'}
                    disabled={!!submitting}
                    variant="ghost"
                    icon={<XCircle className="h-4 w-4" />}
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {t('admin.review.cancel_enrollment', 'Cancel Enrollment')}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
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
  const isSuperAdmin = location.pathname.startsWith('/super-admin');
  const applicationsPath = isSuperAdmin ? '/super-admin/applications' : '/admin/applications';

  const [application, setApplication] = useState<Application | null>(null);
  const [canonical, setCanonical] = useState<CanonicalApplicationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [verifyingDocId, setVerifyingDocId] = useState<number | null>(null);
  // Minimal shape covering both CanonicalDocument (digital flow) and
  // ReviewerApplicationDocument (paper flow) — only id + filename needed by the modal.
  const [rejectionTarget, setRejectionTarget] = useState<{ id: number; original_filename: string | null } | null>(null);

  /**
   * Monotonically-increasing counter that every document mutation on this
   * page bumps. Panels that care about compliance (required-docs,
   * reviewer-documents) subscribe via refreshKey prop and refetch when it
   * changes. This is the "no stale UI" guarantee after a verify/reject.
   * useState + an incrementing function is enough — a Redux store would be
   * overkill for a handful of panels.
   */
  const [documentRefreshKey, setDocumentRefreshKey] = useState(0);
  const bumpDocumentRefresh = () => setDocumentRefreshKey((n) => n + 1);
  const [rejectionReasonText, setRejectionReasonText] = useState('');

  /**
   * Fetch the full canonical payload. The server returns BOTH the legacy
   * `data` shape (used for the top-banner flags and header stat cards) AND
   * the canonical projection (used for the 11-section render). Single
   * round-trip. This is also the refetch path used after any edit side-trip
   * to keep the view in sync with the database.
   */
  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      const { data, canonical: projection } = await getApplicationCanonical(Number(id));
      setApplication(data);
      setCanonical(projection);
      setError(false);
    } catch {
      setError(true);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    refetch().finally(() => setLoading(false));
  }, [refetch]);

  // Re-fetch when the admin returns from the edit page (browser back / close)
  // so any edits they just made show up without a manual reload. Also bumps
  // documentRefreshKey so PaperApplicationReviewView pulls fresh docs — covers
  // the case where an applicant uploaded while the admin was on another tab.
  useEffect(() => {
    function onFocus() { refetch(); bumpDocumentRefresh(); }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  /** Route to AdminApplicationEditPage with the section anchor set. */
  const handleEditSection = useCallback(
    (sectionKey: CanonicalSectionKey) => {
      const base = isSuperAdmin
        ? ROUTES.SUPER_ADMIN_APPLICATION_EDIT(id!)
        : ROUTES.ADMIN_APPLICATION_EDIT(id!);
      navigate(`${base}#section-${sectionKey}`);
    },
    [id, isSuperAdmin, navigate],
  );

  // Minimal doc shape used by all three handlers below — compatible with both
  // CanonicalDocument (digital flow) and ReviewerApplicationDocument (paper flow).
  type MinimalDoc = { id: number; original_filename?: string | null };

  /** Blob preview — opens the document inline in a new tab. */
  async function handlePreviewDocument(doc: MinimalDoc) {
    try {
      const res = await axiosInstance.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const tab = window.open(url, '_blank');
      if (tab) {
        tab.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
      } else {
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    } catch {
      toast.error(t('common.download_error'));
    }
  }

  /** Blob download — forces a save-to-disk via a temporary anchor. */
  async function handleDownloadDocument(doc: MinimalDoc) {
    try {
      const res = await axiosInstance.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_filename ?? `document-${doc.id}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('common.download_error'));
    }
  }

  /** Inline approve from any document surface. Rejection gates through the reason modal. */
  async function handleVerifyDoc(doc: MinimalDoc, status: 'approved' | 'rejected') {
    if (status === 'rejected') {
      setRejectionReasonText('');
      setRejectionTarget({ id: doc.id, original_filename: doc.original_filename ?? null });
      return;
    }
    setVerifyingDocId(doc.id);
    try {
      await verifyDocument(doc.id, 'approved');
      await refetch();
      bumpDocumentRefresh();
      toast.success('Document approved.');
    } catch {
      toast.error('Failed to approve document. Please try again.');
    } finally {
      setVerifyingDocId(null);
    }
  }

  async function handleConfirmReject() {
    if (!rejectionTarget || !rejectionReasonText.trim()) return;
    const doc = rejectionTarget;
    setRejectionTarget(null);
    setVerifyingDocId(doc.id);
    try {
      await verifyDocument(doc.id, 'rejected', rejectionReasonText.trim());
      await refetch();
      bumpDocumentRefresh();
      toast.success('Document rejected. Applicant notified and may resubmit.');
    } catch {
      toast.error('Failed to reject document. Please try again.');
    } finally {
      setVerifyingDocId(null);
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

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

  if (error || !application || !canonical) {
    return (
      <EmptyState
        title={t('admin.review.not_found')}
        description={t('admin.review.not_found_desc')}
        action={{ label: t('common.go_back'), onClick: () => navigate(-1) }}
      />
    );
  }

  const camper = application.camper;
  const canEdit = !TERMINAL_STATUSES.has(application.status);

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

      {/* Incomplete-at-approval banner — shown whenever this application was force-approved with missing data. */}
      {application.is_incomplete_at_approval && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4 border text-sm"
          style={{ background: 'rgba(234,88,12,0.08)', borderColor: 'rgba(234,88,12,0.30)', color: 'var(--ember-orange)' }}
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>Approved with Missing Information</strong> — This application was approved
            by an admin despite missing fields, documents, or consents. Review the audit log for details.
          </span>
        </div>
      )}

      {/* Paper-intake banner — reviewers need to know at a glance whether
          this is a digital submission or a scanned/physical packet. */}
      {(application.submission_source === 'paper_self' || application.submission_source === 'paper_admin') && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4 border text-sm"
          style={{ background: 'rgba(234,88,12,0.08)', borderColor: 'rgba(234,88,12,0.30)', color: 'var(--ember-orange)' }}
        >
          <span className="text-base" aria-hidden="true">📄</span>
          <span>
            <strong>Paper Application</strong> —{' '}
            {application.submission_source === 'paper_self'
              ? 'The family uploaded their completed paper packet themselves. '
              : 'Staff received the physical packet and entered this record on the family\'s behalf. '}
            Signature and consents live on the physical form; the digital-only gate is relaxed for this application once the packet has been received and verified.
          </span>
        </div>
      )}

      {/* Reapplication banner — shown when this application replaced a prior one. */}
      {application.reapplied_from_id != null && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4 border text-sm"
          style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.25)', color: 'rgb(99,102,241)' }}
        >
          <span className="text-base">↩</span>
          <span>
            {t('admin.review.reapplication_banner')}{' '}
            <Link
              to={`${applicationsPath}/${application.reapplied_from_id}`}
              className="underline underline-offset-2 hover:opacity-80"
            >
              {t('admin.review.view_original')}
            </Link>
          </span>
        </div>
      )}

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {camper?.full_name ?? t('admin.review.unknown_camper')}
            </h1>
            {application.session && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {application.session.name}
              </p>
            )}
          </div>
          <StatusBadge status={application.status} />
        </div>

        {/* Stat cards — App Number | Submitted | Queue Position */}
        <div className="grid grid-cols-3 gap-3">
          <div
            className="rounded-xl px-4 py-3 border"
            style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)' }}
          >
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin.review.stat_app_number')}
            </p>
            <p className="text-sm font-mono font-semibold" style={{ color: 'var(--foreground)' }}>
              {application.application_number ?? `#${application.id}`}
            </p>
            {application.attended_before && (
              <p className="text-xs mt-1" style={{ color: 'var(--ember-orange)' }}>
                {t('admin.review.returning_camper')}
              </p>
            )}
          </div>

          <div
            className="rounded-xl px-4 py-3 border"
            style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)' }}
          >
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin.review.stat_submitted')}
            </p>
            {application.submitted_at ? (
              <>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {formatDistanceToNow(new Date(application.submitted_at), { addSuffix: true })}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {format(new Date(application.submitted_at), 'MMM d, yyyy')}
                </p>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t('common.not_submitted')}
              </p>
            )}
          </div>

          <div
            className="rounded-xl px-4 py-3 border"
            style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)' }}
          >
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin.review.stat_queue_position')}
            </p>
            {application.queue_position ? (
              <>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {t('admin.review.queue_position_value', {
                    position: application.queue_position.position,
                    total:    application.queue_position.total,
                  })}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {t('admin.review.queue_position_hint')}
                </p>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t('admin.review.queue_position_resolved')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: branches on submission_source.
              - Paper applications (paper_self / paper_admin) render the
                dedicated PaperApplicationReviewView — inline packet viewer,
                required-docs checklist, supporting docs list. The 11-section
                digital form is skipped because paper apps have no structured
                section data to render against (rendering it was the "empty
                form" bug the forensic audit flagged).
              - Digital applications fall through to the canonical 11-section
                view unchanged. */}
        <div className="lg:col-span-2">
          {application.submission_source === 'paper_self' || application.submission_source === 'paper_admin' ? (
            <PaperApplicationReviewView
              applicationId={application.id}
              refreshKey={documentRefreshKey}
              onPreviewDocument={(doc: ReviewerApplicationDocument) => handlePreviewDocument(doc)}
              onDownloadDocument={(doc: ReviewerApplicationDocument) => handleDownloadDocument(doc)}
              adminDocumentActions={canEdit ? {
                onVerify: (doc: ReviewerApplicationDocument) => handleVerifyDoc(doc, 'approved'),
                onReject: (doc: ReviewerApplicationDocument) => handleVerifyDoc(doc, 'rejected'),
                disabled: verifyingDocId !== null,
              } : undefined}
            />
          ) : (
            <CanonicalApplicationSections
              canonical={canonical}
              // The `role` prop is a component-level viewer-role discriminator,
              // not the WAI-ARIA `role` attribute. ESLint's a11y plugin can't
              // tell the difference and flags it as an invalid ARIA role.
              // eslint-disable-next-line jsx-a11y/aria-role
              role="admin"
              editable={canEdit}
              onEditSection={handleEditSection}
              onPreviewDocument={handlePreviewDocument}
              onDownloadDocument={handleDownloadDocument}
              adminDocumentActions={canEdit ? {
                onVerify: (doc) => handleVerifyDoc(doc, 'approved'),
                onReject: (doc) => handleVerifyDoc(doc, 'rejected'),
                disabled: verifyingDocId !== null,
              } : undefined}
            />
          )}
        </div>

        {/* Right: reviewer tools sidebar.
            The container itself is sticky on desktop with its own scroll
            overflow, so the entire sidebar (ReviewPanel + Request Document
            + Review History + any future panels) stays visible while the
            reviewer reads the long left-column form. Previously ReviewPanel
            alone was sticky, which caused the Request Document and Review
            History cards to disappear behind it on scroll.
            max-h uses the viewport minus the top offset so the inner
            overflow-y-auto kicks in only when the combined panel height
            exceeds the visible area. */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1">
          <ReviewPanel
            applicationId={application.id}
            currentStatus={application.status}
            isDraft={application.status === 'draft'}
            initialNotes={application.notes ?? ''}
            reviewStartedAt={application.review_started_at}
            reviewedAt={application.reviewed_at}
            onReviewed={(updated) => {
              setApplication(updated);
              // Full refetch brings the canonical projection back in sync
              // (status badges and compliance meta depend on it).
              refetch();
            }}
          />

          {/* Request a new supporting document from the applicant. */}
          {canEdit && camper && (
            <div
              className="rounded-xl border px-4 py-3"
              style={{ background: 'var(--glass-light)', borderColor: 'var(--border)' }}
            >
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                Request Document
              </p>
              <InlineRequestDocumentButton
                applicantId={camper.user_id}
                camperId={camper.id}
                applicationId={application.id}
                camperName={camper.full_name}
                onCreated={() => {
                  toast.success('Document request sent to applicant.');
                }}
              />
            </div>
          )}

          <ReviewHistoryPanel applicationId={application.id} />
        </div>
      </div>

      {/* Rejection reason modal */}
      {rejectionTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rejection-modal-title"
        >
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => setRejectionTarget(null)}
            className="absolute inset-0 w-full h-full cursor-default"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          />
          <div
            className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          >
            <h2
              id="rejection-modal-title"
              className="text-base font-semibold mb-1"
              style={{ color: 'var(--foreground)' }}
            >
              Reject Document
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
              The applicant will be notified and can resubmit.
              {rejectionTarget.original_filename && (
                <span className="block mt-1 font-medium" style={{ color: 'var(--foreground)' }}>
                  {rejectionTarget.original_filename}
                </span>
              )}
            </p>
            <div className="mb-5">
              <label
                htmlFor="rejection-reason"
                className="block text-xs font-medium mb-1"
                style={{ color: 'var(--foreground)' }}
              >
                Reason <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                id="rejection-reason"
                rows={3}
                value={rejectionReasonText}
                onChange={(e) => setRejectionReasonText(e.target.value)}
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
                onClick={() => setRejectionTarget(null)}
                className="px-4 py-2 rounded-lg text-sm border transition-opacity hover:opacity-70"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={!rejectionReasonText.trim() || verifyingDocId !== null}
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
