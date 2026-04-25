/**
 * ApplicantDashboardPage.tsx
 *
 * Redesigned (Phase 12) for better information hierarchy:
 *  - Welcome header
 *  - Quick Actions moved near the top (after stats)
 *  - Announcements
 *  - Stat cards
 *  - Camper cards as primary operational section
 *  - Recent updates as compact, scannable list below
 *
 * Quick Actions moved up per UX review — parents should see what they can do
 * immediately without scrolling past the full content area.
 */

import { useEffect, useState, type ComponentType } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Users, FileText, Plus, ArrowRight, Calendar, Megaphone, Pin,
  Bell, MessageSquare, CheckCircle, Clock, AlertCircle, Upload, XCircle, Trash2, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';

import { getCampers, getApplications, getDrafts, getRequiredDocuments, getDocumentRequests, deleteCamper, deleteApplication, deleteDraft, type ApplicationDraft, type RequiredDocument, type DocumentRequestRecord } from '@/features/parent/api/applicant.api';
import { getConversations, type Conversation } from '@/features/messaging/api/messaging.api';
import { getAnnouncements, type Announcement } from '@/features/admin/api/announcements.api';
import type { Camper, Application } from '@/shared/types';
import { NewSessionModal, findBestSourceApp } from '@/features/parent/components/NewSessionModal';
import { useAppSelector } from '@/store/hooks';
import { ROUTES } from '@/shared/constants/routes';
import { StatCard } from '@/ui/components/StatCard';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EmptyState } from '@/ui/components/EmptyState';
import { ErrorState } from '@/ui/components/EmptyState';
import { SkeletonCard, SkeletonTable } from '@/ui/components/Skeletons';
import { Button } from '@/ui/components/Button';
import { PersonalGreeting } from '@/ui/components/PersonalGreeting';
import { HeroSlideshow } from '@/ui/components/HeroSlideshow';
import { Avatar } from '@/ui/components/Avatar';

export function ApplicantDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppSelector((state) => state.auth.user);

  const [localDraftName, setLocalDraftName]     = useState<string | null | undefined>(undefined); // undefined = not yet checked
  const [serverDrafts, setServerDrafts]         = useState<ApplicationDraft[]>([]);
  const [campers, setCampers]                   = useState<Camper[]>([]);
  const [applications, setApplications]         = useState<Application[]>([]);
  const [conversations, setConversations]       = useState<Conversation[]>([]);
  const [announcements, setAnnouncements]       = useState<Announcement[]>([]);
  const [requiredDocs, setRequiredDocs]         = useState<RequiredDocument[]>([]);
  const [documentRequests, setDocumentRequests] = useState<DocumentRequestRecord[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState(false);
  const [retryKey, setRetryKey]                 = useState(0);
  const [showDeleteDraftModal, setShowDeleteDraftModal] = useState(false);
  const [deleteLoading, setDeleteLoading]       = useState(false);

  // "Apply for a New Session" modal — camper-centric entry point.
  // Stores the target camper and (when available) the best prior application
  // ID for audit-trail linking. Set to null to close the modal.
  const [newSessionTarget, setNewSessionTarget] = useState<{
    camper: Camper;
    reappliedFromId?: number;
  } | null>(null);

  // Re-fetch conversations whenever a realtime message arrives so the
  // activity feed reflects new messages without a full page reload.
  useEffect(() => {
    function refreshConversations() {
      getConversations({ page: 1 })
        .then((res) => setConversations(res.data ?? []))
        .catch(() => { /* keep stale data on error */ });
    }
    window.addEventListener('realtime:message-arrived', refreshConversations);
    return () => window.removeEventListener('realtime:message-arrived', refreshConversations);
  }, []);

  // Silently re-fetch application data when a system notification arrives — this
  // covers the case where an admin has approved/rejected/waitlisted an application.
  // The applicant gets a NotificationCreated WebSocket event, which fires
  // notification:refresh. Without this, the camper status badge and stat cards
  // stay stale until the user manually reloads the page.
  useEffect(() => {
    function refreshApplicationData() {
      Promise.all([
        getApplications().catch(() => null),
        getRequiredDocuments().catch(() => null),
      ]).then(([appsResult, reqResult]) => {
        if (appsResult !== null) setApplications(appsResult);
        if (reqResult !== null) setRequiredDocs(reqResult);
      });
    }
    window.addEventListener('notification:refresh', refreshApplicationData);
    return () => window.removeEventListener('notification:refresh', refreshApplicationData);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(false);
    Promise.allSettled([
      getCampers(),
      getApplications(),
      getConversations({ page: 1 }),
      getAnnouncements(5),
      getRequiredDocuments(),
      getDocumentRequests(),
    ]).then(([cResult, aResult, convResult, annResult, reqResult, docReqResult]) => {
        if (cResult.status === 'rejected' && aResult.status === 'rejected') {
          setError(true);
          return;
        }
        setCampers(cResult.status === 'fulfilled' ? cResult.value : []);
        setApplications(aResult.status === 'fulfilled' ? aResult.value : []);
        if (convResult.status === 'fulfilled') {
          setConversations(convResult.value.data ?? []);
        }
        if (annResult.status === 'fulfilled') {
          setAnnouncements(annResult.value.data ?? []);
        }
        if (reqResult.status === 'fulfilled') {
          setRequiredDocs(reqResult.value);
        }
        if (docReqResult.status === 'fulfilled') {
          setDocumentRequests(docReqResult.value);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  // location.key changes on every navigation to this route, ensuring the camper
  // list is always fresh — this is the primary guard against stale state after
  // a deletion on another page (e.g. deleting a draft on ApplicationStartPage).
  }, [retryKey, location.key]);

  // Load server drafts to surface a "Continue" prompt on the dashboard.
  useEffect(() => {
    if (!user?.id) return;
    getDrafts()
      .then((drafts) => {
        setServerDrafts(drafts);
        setLocalDraftName(drafts.length > 0 ? (drafts[0].label ?? null) : null);
      })
      .catch(() => {
        // Fallback: try sessionStorage so the banner still shows if API fails
        try {
          const raw = sessionStorage.getItem(`cbg_app_draft_${user.id}`);
          if (!raw) { setLocalDraftName(null); return; }
          const parsed = JSON.parse(raw) as { s1?: { camper_first_name?: string; camper_last_name?: string } };
          const first = (parsed.s1?.camper_first_name ?? '').trim();
          const last  = (parsed.s1?.camper_last_name  ?? '').trim();
          setLocalDraftName(first || last ? `${first} ${last}`.trim() : null);
        } catch { setLocalDraftName(null); }
      });
  }, [user?.id]);

  const TERMINAL_STATUSES = ['rejected', 'withdrawn', 'cancelled'];

  async function handleDeleteCamper(camper: Camper) {
    if (!window.confirm(`Remove ${camper.full_name} from your account?\n\nThis cannot be undone.`)) return;
    try {
      await deleteCamper(camper.id);
      setCampers((prev) => prev.filter((c) => c.id !== camper.id));
      toast.success(`${camper.full_name} has been removed.`);
    } catch {
      toast.error('Could not remove this camper. Please try again.');
    }
  }

  function handleNavigateToDraft() {
    if (serverDrafts.length > 1) {
      navigate(ROUTES.PARENT_APPLICATIONS);
    } else if (serverDrafts.length === 1) {
      navigate(ROUTES.PARENT_APPLICATION_NEW, {
        state: {
          draftId: serverDrafts[0].id,
          ...(serverDrafts[0].application_id != null && {
            applicationId: serverDrafts[0].application_id,
          }),
        },
      });
    } else {
      navigate(ROUTES.PARENT_APPLICATION_NEW);
    }
  }

  async function handleDeleteDraftFromDashboard() {
    if (!serverDrafts[0]) return;
    setDeleteLoading(true);
    const draft = serverDrafts[0];
    try {
      await deleteDraft(draft.id);
      if (draft.application_id != null) {
        await deleteApplication(draft.application_id).catch(() => {});
      }
      setServerDrafts([]);
      setLocalDraftName(null);
      setShowDeleteDraftModal(false);
      toast.success('Draft deleted.');
    } catch (err: unknown) {
      const e = err as { status?: number };
      if (e?.status === 404) {
        setServerDrafts([]);
        setLocalDraftName(null);
        setShowDeleteDraftModal(false);
      } else {
        toast.error('Could not delete draft. Please try again.');
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  const pendingCount = applications.filter((a) => a.status === 'submitted' || a.status === 'under_review').length;
  const pendingDocsCount = (Array.isArray(requiredDocs) ? requiredDocs : []).filter((d) => d.status === 'pending').length;

  const activityFeed = buildActivityFeed(conversations, applications, campers, documentRequests, user?.id);

  if (error) return <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />;

  return (
    <>
    <div className="flex flex-col gap-6 max-w-5xl">

      {/* ── Liquid glass hero ────────────────────────────────── */}
      <div
        className="relative flex flex-col justify-end rounded-2xl overflow-hidden"
        style={{ minHeight: '340px' }}
      >
        <HeroSlideshow initialIndex={1} />
        <div className="relative z-10 p-6 lg:p-8">
          <PersonalGreeting
            user={user}
            // eslint-disable-next-line jsx-a11y/aria-role
            role="applicant"
            stats={{ camperCount: campers.length }}
          />
        </div>
      </div>

      {/* ── Document action alert ────────────────────────────── */}
      {!loading && pendingDocsCount > 0 && (
        <Link
          to={ROUTES.PARENT_DOCUMENTS}
          className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
          style={{ background: 'rgba(245,158,11,0.07)', borderColor: 'rgba(245,158,11,0.30)' }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#b45309' }} />
          <span className="text-sm font-medium" style={{ color: '#b45309' }}>
            {t('required_documents.dashboard_alert', { count: pendingDocsCount })}
          </span>
          <ArrowRight className="h-4 w-4 ml-auto flex-shrink-0" style={{ color: '#b45309' }} />
        </Link>
      )}

      {/* ── Stat cards ───────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={1} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div data-guide-anchor="dashboard.campers-card"><StatCard label={t('applicant.dashboard.stat_campers')} value={campers.length} icon={Users} delay={0} /></div>
          <div data-guide-anchor="dashboard.applications-card"><StatCard label={t('applicant.dashboard.stat_applications')} value={applications.length} icon={FileText} color="var(--night-sky-blue)" delay={0.1} /></div>
          <div data-guide-anchor="dashboard.pending-card"><StatCard label={t('applicant.dashboard.stat_pending')} value={pendingCount} icon={Calendar} color="var(--warm-amber)" delay={0.2} /></div>
        </div>
      )}

      {/* ── In-progress draft banner ─────────────────────────── */}
      {localDraftName !== undefined && localDraftName !== null && (
        <div
          data-guide-anchor="dashboard.draft-banner"
          className="w-full flex items-center gap-3 pl-4 pr-2 py-3 rounded-xl border"
          style={{ background: 'rgba(22,101,52,0.05)', borderColor: 'var(--ember-orange)' }}
        >
          <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />

          {/* Clickable content area — navigates to form or applications list */}
          <button
            type="button"
            onClick={handleNavigateToDraft}
            className="flex-1 min-w-0 text-left transition-colors hover:opacity-80"
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {serverDrafts.length > 1
                ? `${serverDrafts.length} draft applications in progress`
                : `Draft – ${localDraftName || 'Not Submitted'}`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {serverDrafts.length > 1 ? 'Click to view all drafts' : 'Not yet submitted · Saved to your account'}
            </p>
          </button>

          {/* Continue / View All pill */}
          <button
            type="button"
            onClick={handleNavigateToDraft}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-opacity hover:opacity-85"
            style={{ background: 'var(--ember-orange)', color: '#fff' }}
          >
            {serverDrafts.length > 1 ? 'View all' : 'Continue'}
          </button>

          {/* Delete icon — single-draft only; multi-draft users delete from the applications page */}
          {serverDrafts.length === 1 && (
            <button
              type="button"
              onClick={() => setShowDeleteDraftModal(true)}
              className="p-1.5 rounded-lg border transition-colors hover:bg-red-50 hover:border-red-300 flex-shrink-0"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              title="Delete draft"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* ── Quick Actions — moved near top ───────────────────── */}
      <div>
        <h3 className="font-headline font-semibold text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
          {t('applicant.dashboard.quick_actions')}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button data-guide-anchor="dashboard.start-application" as={Link} to={ROUTES.PARENT_APPLICATION_START} variant="primary" size="sm">
            <Plus className="h-4 w-4" />
            {t('applicant.dashboard.new_application')}
          </Button>
          <Button as={Link} to={ROUTES.PARENT_APPLICATIONS} variant="secondary" size="sm">
            {t('applicant.dashboard.view_all_applications')}
          </Button>
          <Button as={Link} to="/applicant/inbox" variant="secondary" size="sm">
            {t('applicant.dashboard.open_inbox')}
          </Button>
        </div>
      </div>

      {/* ── Announcements strip ──────────────────────────────── */}
      {!loading && announcements.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Megaphone className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
            <h3 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
              {t('applicant.dashboard.announcements')}
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className={`rounded-xl px-4 py-3 ${ann.is_urgent ? 'border' : 'glass-card'}`}
                style={ann.is_urgent ? {
                  background: 'rgba(220,38,38,0.05)',
                  borderColor: 'rgba(220,38,38,0.25)',
                } : undefined}
              >
                <div className="flex items-start gap-2 min-w-0">
                  {ann.is_pinned && <Pin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--ember-orange)' }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{ann.title}</p>
                      {ann.is_urgent && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' }}>
                          {t('applicant.dashboard.urgent')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 leading-relaxed line-clamp-2" style={{ color: 'var(--muted-foreground)' }}>
                      {ann.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── My Campers — primary content ─────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
            {t('applicant.dashboard.my_campers')}
          </h3>
          <Link
            to={ROUTES.PARENT_APPLICATION_START}
            className="flex items-center gap-1.5 text-sm font-medium hover:underline"
            style={{ color: 'var(--ember-orange)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('applicant.dashboard.new_application')}
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => <SkeletonCard key={i} lines={2} />)}
          </div>
        ) : campers.length === 0 ? (
          <div className="glass-panel rounded-2xl p-6">
            <EmptyState
              title={t('applicant.dashboard.no_campers_title')}
              description={t('applicant.dashboard.no_campers_desc')}
              action={{ label: t('applicant.dashboard.start_application'), onClick: () => navigate(ROUTES.PARENT_APPLICATION_START) }}
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {campers.map((camper) => {
              const camperApps = applications.filter((a) => a.camper_id === camper.id);
              const latestApp  = camperApps[0];
              // Find the session name from the most recent application
              const sessionName = latestApp?.session?.name ?? null;
              // Best prior application to use as reapplication audit source
              const sourceApp = findBestSourceApp(applications, camper.id);

              function openNewSessionModal() {
                setNewSessionTarget({
                  camper,
                  reappliedFromId: sourceApp?.id,
                });
              }

              return (
                <li key={camper.id}>
                  <div
                    className="glass-card rounded-2xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={camper.full_name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                          {camper.full_name}
                        </p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                          {camper.age ? `Age ${camper.age}` : ''}
                          {camper.age && sessionName ? ' · ' : ''}
                          {sessionName ?? ''}
                          {!camper.age && !sessionName ? (
                            t(camperApps.length === 1 ? 'applicant.dashboard.camper_age_apps_one' : 'applicant.dashboard.camper_age_apps_other', { age: camper.age, count: camperApps.length })
                          ) : null}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {latestApp && <StatusBadge status={latestApp.status} />}

                      {/* Delete button — only when no active applications */}
                      {camperApps.every((a) => TERMINAL_STATUSES.includes(a.status)) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCamper(camper)}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          style={{ color: 'var(--muted-foreground)' }}
                          aria-label={`Remove ${camper.full_name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}

                      {/* ── Primary reapplication entry point ──────────────────
                          Visible on every registered camper card. The modal
                          handles the case where no prior application exists
                          (reappliedFromId will be undefined → blank new app
                          with just camper info prefilled).
                          ──────────────────────────────────────────────────── */}
                      <button
                        type="button"
                        onClick={openNewSessionModal}
                        className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)] whitespace-nowrap"
                        style={{ borderColor: 'var(--ember-orange)', color: 'var(--ember-orange)' }}
                        aria-label={`Apply for a new session for ${camper.full_name}`}
                      >
                        <Plus className="h-3 w-3" />
                        New Session
                      </button>
                      {/* Mobile: icon-only variant */}
                      <button
                        type="button"
                        onClick={openNewSessionModal}
                        className="sm:hidden p-1.5 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                        style={{ borderColor: 'var(--ember-orange)', color: 'var(--ember-orange)' }}
                        aria-label={`Apply for a new session for ${camper.full_name}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>

                      <Link
                        to={ROUTES.PARENT_APPLICATIONS}
                        className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                        style={{ color: 'var(--muted-foreground)' }}
                        aria-label={`View applications for ${camper.full_name}`}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Recent Activity — interactive, navigable feed ─────── */}
      <div data-guide-anchor="dashboard.activity-feed">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
            {t('applicant.dashboard.recent_updates')}
          </h3>
          <Link
            to="/applicant/inbox"
            className="text-xs hover:underline flex items-center gap-1"
            style={{ color: 'var(--ember-orange)' }}
          >
            {t('applicant.dashboard.open_inbox')}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <SkeletonTable rows={3} />
        ) : activityFeed.length === 0 ? (
          <div className="glass-panel rounded-xl p-5 text-center">
            <Bell className="h-5 w-5 mx-auto mb-2" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {t('applicant.dashboard.no_updates')}
            </p>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl overflow-hidden divide-y">
            <ul>
              {activityFeed.map((item) => {
                const Icon = getActivityIcon(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigate(item.route)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-all duration-150 hover:bg-[var(--dash-nav-hover-bg)] hover:-translate-y-px"
                      style={{ background: item.accent ? 'rgba(22,163,74,0.04)' : 'transparent' }}
                    >
                      {/* Icon badge */}
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: item.accent ? 'rgba(22,163,74,0.12)' : 'rgba(0,0,0,0.05)',
                          color: item.accent ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${item.accent ? 'font-semibold' : 'font-medium'}`} style={{ color: 'var(--foreground)' }}>
                          {item.title}
                        </p>
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {item.subtitle}
                        </p>
                      </div>

                      {/* Timestamp + arrow */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

    </div>

    {/* ── "Apply for a New Session" modal — camper-centric primary entry ── */}
    {newSessionTarget && (
      <NewSessionModal
        camper={newSessionTarget.camper}
        reappliedFromId={newSessionTarget.reappliedFromId}
        existingApplications={applications}
        onClose={() => setNewSessionTarget(null)}
      />
    )}

    {/* ── Delete draft confirmation modal ── */}
    {showDeleteDraftModal && (
      <div
        role="button"
        tabIndex={-1}
        aria-label="Close dialog"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={() => setShowDeleteDraftModal(false)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setShowDeleteDraftModal(false); }}
      >
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-draft-dialog-title"
          className="w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(220,38,38,0.1)' }}
            >
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 id="delete-draft-dialog-title" className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Delete Draft Application
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                This will permanently delete this draft. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteDraftModal(false)}
              disabled={deleteLoading}
              className="text-sm px-4 py-2 rounded-xl border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { void handleDeleteDraftFromDashboard(); }}
              disabled={deleteLoading}
              className="text-sm px-4 py-2 rounded-xl font-medium transition-colors bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}

// ─── Activity feed ────────────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  type: 'message' | 'application' | 'document';
  iconKey: 'message' | 'file' | 'check' | 'x-circle' | 'clock' | 'upload' | 'alert';
  title: string;
  subtitle: string;
  timestamp: string;
  route: string;
  accent: boolean;
}

function buildActivityFeed(
  conversations: Conversation[],
  applications: Application[],
  campers: Camper[],
  documentRequests: DocumentRequestRecord[],
  currentUserId: number | undefined,
): ActivityItem[] {
  const items: ActivityItem[] = [];

  // Messages: show conversations where a staff member sent the most recent message,
  // active within the last 30 days. Shown regardless of read status so messages
  // don't vanish from Recent Updates the moment the user opens the inbox.
  const THIRTY_DAYS_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentConvs = conversations.filter((c) => {
    if (c.is_system_generated) return false;
    if (!c.last_message) return false;
    if (c.last_message.sender_id === currentUserId) return false;
    const lastActivity = new Date(c.last_message_at ?? c.updated_at).getTime();
    return lastActivity > THIRTY_DAYS_AGO;
  });
  const grouped = new Map<string, Conversation[]>();
  for (const conv of recentConvs) {
    const senderName = getConvSenderName(conv, currentUserId);
    if (!grouped.has(senderName)) grouped.set(senderName, []);
    grouped.get(senderName)!.push(conv);
  }
  for (const [senderName, convs] of grouped) {
    const latest = [...convs].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )[0];
    const count = convs.length;
    const hasUnread = convs.some((c) => c.unread_count > 0);
    items.push({
      id: `msg-${latest.id}`,
      type: 'message',
      iconKey: 'message',
      title: count > 1
        ? `${count} messages from ${senderName}`
        : hasUnread ? `New message from ${senderName}` : `Message from ${senderName}`,
      subtitle: latest.last_message?.body
        ? truncateText(stripHtml(latest.last_message.body), 60)
        : latest.subject ?? 'Open conversation',
      timestamp: latest.updated_at,
      route: '/applicant/inbox',
      accent: hasUnread,
    });
  }

  // Applications: most recently updated. Drafts are excluded — they have a
  // dedicated in-progress banner on the dashboard and must not appear as
  // "Application submitted" events since their status='submitted' is a
  // backend implementation detail, not a real submission action.
  for (const app of applications) {
    if (app.status === 'draft') continue;
    const camper = campers.find((c) => c.id === app.camper_id);
    const camperName = camper ? `${camper.first_name} ${camper.last_name}` : 'Camper';
    const sessionName = app.session?.name ?? null;
    const iconKey: ActivityItem['iconKey'] =
      app.status === 'approved'     ? 'check' :
      app.status === 'rejected'     ? 'x-circle' :
      app.status === 'under_review' ? 'clock' : 'file';
    items.push({
      id: `app-${app.id}`,
      type: 'application',
      iconKey,
      title: getApplicationTitle(app.status, camperName),
      subtitle: sessionName
        ? `${sessionName} · ${getStatusLabel(app.status)}`
        : getStatusLabel(app.status),
      timestamp: app.updated_at ?? app.created_at,
      route: ROUTES.PARENT_APPLICATION_DETAIL(app.id),
      accent: app.status === 'approved' || app.status === 'rejected',
    });
  }

  // Document requests
  for (const doc of documentRequests) {
    items.push({
      id: `doc-${doc.id}`,
      type: 'document',
      iconKey: doc.status === 'rejected' ? 'alert' : 'upload',
      title: getDocumentTitle(doc),
      subtitle: doc.instructions ?? `Requested by ${doc.requested_by_name}`,
      timestamp: doc.uploaded_at ?? doc.created_at,
      route: ROUTES.PARENT_DOCUMENTS,
      accent: doc.status === 'awaiting_upload' || doc.status === 'rejected',
    });
  }

  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);
}

function getConvSenderName(conv: Conversation, currentUserId: number | undefined): string {
  if (conv.last_message?.sender && conv.last_message.sender.id !== currentUserId) {
    return conv.last_message.sender.name;
  }
  const other = conv.participants.find((p) => p.id !== currentUserId);
  return other?.name ?? 'Staff';
}

function getApplicationTitle(status: string, camperName: string): string {
  switch (status) {
    case 'approved':     return `Application approved — ${camperName}`;
    case 'rejected':     return `Application not approved — ${camperName}`;
    case 'under_review': return `Application under review — ${camperName}`;
    case 'waitlisted':   return `Application waitlisted — ${camperName}`;
    case 'submitted':    return `Application submitted — ${camperName}`;
    default:             return `Application updated — ${camperName}`;
  }
}

function getDocumentTitle(doc: DocumentRequestRecord): string {
  const type = doc.document_type;
  switch (doc.status) {
    case 'awaiting_upload': return `Document required: ${type}`;
    case 'uploaded':        return `Document received: ${type}`;
    case 'under_review':    return `Document under review: ${type}`;
    case 'approved':        return `Document approved: ${type}`;
    case 'rejected':        return `Document rejected: ${type}`;
    case 'overdue':         return `Document overdue: ${type}`;
    default:                return `Document request: ${type}`;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'submitted':    return 'Pending review';
    case 'under_review': return 'Under review';
    case 'approved':     return 'Approved';
    case 'rejected':     return 'Not approved';
    case 'waitlisted':   return 'Waitlisted';
    case 'cancelled':    return 'Cancelled';
    case 'draft':        return 'Draft';
    default:             return status;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function truncateText(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max).trimEnd()}…` : str;
}

function getActivityIcon(item: ActivityItem): ComponentType<{ className?: string }> {
  switch (item.iconKey) {
    case 'message':  return MessageSquare;
    case 'check':    return CheckCircle;
    case 'x-circle': return XCircle;
    case 'clock':    return Clock;
    case 'upload':   return Upload;
    case 'alert':    return AlertCircle;
    default:         return FileText;
  }
}
