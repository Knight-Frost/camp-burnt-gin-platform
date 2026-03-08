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
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, FileText, Plus, ArrowRight, Calendar, Megaphone, Pin,
  Bell, MessageSquare, CheckCircle, Clock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

import { getCampers, getApplications } from '@/features/parent/api/applicant.api';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/features/admin/api/notifications.api';
import { getAnnouncements, type Announcement } from '@/features/admin/api/announcements.api';
import type { Camper, Application, Notification } from '@/shared/types';
import { useAppSelector } from '@/store/hooks';
import { ROUTES } from '@/shared/constants/routes';
import { StatCard } from '@/ui/components/StatCard';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EmptyState } from '@/ui/components/EmptyState';
import { ErrorState } from '@/ui/components/EmptyState';
import { SkeletonCard, SkeletonTable } from '@/ui/components/Skeletons';
import { Button } from '@/ui/components/Button';
import {
  staggerContainerVariants,
  staggerChildVariants,
  scrollRevealVariants,
  cardHoverMotion,
} from '@/shared/constants/motion';

export function ApplicantDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);

  const [campers, setCampers]             = useState<Camper[]>([]);
  const [applications, setApplications]   = useState<Application[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(false);
  const [retryKey, setRetryKey]           = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    Promise.allSettled([getCampers(), getApplications(), getNotifications(), getAnnouncements(5)])
      .then(([cResult, aResult, nResult, annResult]) => {
        if (cResult.status === 'rejected' && aResult.status === 'rejected') {
          setError(true);
          return;
        }
        setCampers(cResult.status === 'fulfilled' ? cResult.value : []);
        setApplications(aResult.status === 'fulfilled' ? aResult.value : []);
        if (nResult.status === 'fulfilled') {
          setNotifications((nResult.value.data ?? []).slice(0, 5));
        }
        if (annResult.status === 'fulfilled') {
          setAnnouncements(annResult.value.data ?? []);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [retryKey]);

  const firstName    = user?.name.split(' ')[0] ?? 'there';
  const pendingCount = applications.filter((a) => a.status === 'pending' || a.status === 'under_review').length;

  const handleMarkRead = (id: string) => {
    markNotificationRead(id).catch(() => {/* non-critical */});
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead().catch(() => {/* non-critical */});
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
  };

  if (error) return <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />;

  return (
    <div className="flex flex-col gap-6 max-w-5xl">

      {/* ── Welcome header ───────────────────────────────────── */}
      <motion.div variants={scrollRevealVariants} initial="hidden" animate="visible">
        <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--ember-orange)' }}>
          {t('applicant.dashboard.welcome_back')}
        </p>
        <h2 className="text-2xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
          {firstName}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {t('applicant.dashboard.subtitle')}
        </p>
      </motion.div>

      {/* ── Stat cards ───────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={1} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label={t('applicant.dashboard.stat_campers')} value={campers.length} icon={Users} delay={0} />
          <StatCard label={t('applicant.dashboard.stat_applications')} value={applications.length} icon={FileText} color="var(--night-sky-blue)" delay={0.1} />
          <StatCard label={t('applicant.dashboard.stat_pending')} value={pendingCount} icon={Calendar} color="var(--warm-amber)" delay={0.2} />
        </div>
      )}

      {/* ── Quick Actions — moved near top ───────────────────── */}
      <div>
        <h3 className="font-headline font-semibold text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
          {t('applicant.dashboard.quick_actions')}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button as={Link} to={ROUTES.PARENT_APPLICATION_NEW} variant="primary" size="sm">
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
        <motion.div variants={scrollRevealVariants} initial="hidden" animate="visible">
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
                className="rounded-xl border px-4 py-3"
                style={{
                  background: ann.is_urgent ? 'rgba(220,38,38,0.05)' : 'var(--card)',
                  borderColor: ann.is_urgent ? 'rgba(220,38,38,0.25)' : 'var(--border)',
                }}
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
        </motion.div>
      )}

      {/* ── My Campers — primary content ─────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
            {t('applicant.dashboard.my_campers')}
          </h3>
          <Link
            to={ROUTES.PARENT_APPLICATION_NEW}
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
          <div className="rounded-2xl border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <EmptyState
              title={t('applicant.dashboard.no_campers_title')}
              description={t('applicant.dashboard.no_campers_desc')}
              action={{ label: t('applicant.dashboard.start_application'), onClick: () => navigate(ROUTES.PARENT_APPLICATION_NEW) }}
            />
          </div>
        ) : (
          <motion.ul
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-3"
          >
            {campers.map((camper) => {
              const camperApps = applications.filter((a) => a.camper_id === camper.id);
              const latestApp  = camperApps[0];
              // Find the session name from the most recent application
              const sessionName = latestApp?.session?.name ?? null;

              return (
                <motion.li key={camper.id} variants={staggerChildVariants} {...cardHoverMotion}>
                  <div
                    className="rounded-2xl border p-4 flex items-center justify-between gap-4"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-headline font-semibold text-sm"
                        style={{ background: 'rgba(22,163,74,0.12)', color: 'var(--ember-orange)' }}
                      >
                        {camper.first_name.charAt(0)}{camper.last_name.charAt(0)}
                      </div>
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
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </div>

      {/* ── Recent Updates — compact scannable list ───────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
            {t('applicant.dashboard.recent_updates')}
          </h3>
          {notifications.some((n) => !n.read_at) && (
            <button onClick={handleMarkAllRead} className="text-xs hover:underline" style={{ color: 'var(--ember-orange)' }}>
              {t('applicant.dashboard.mark_all_read')}
            </button>
          )}
        </div>

        {loading ? (
          <SkeletonTable rows={3} />
        ) : notifications.length === 0 ? (
          <div className="rounded-xl border p-5 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <Bell className="h-5 w-5 mx-auto mb-2" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {t('applicant.dashboard.no_updates')}
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl border overflow-hidden divide-y"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <motion.ul variants={staggerContainerVariants} initial="hidden" animate="visible">
              {notifications.map((n) => {
                const isUnread = !n.read_at;
                const Icon = getNotifIcon(n.type);
                return (
                  <motion.li
                    key={n.id}
                    variants={staggerChildVariants}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                    style={{
                      background: isUnread ? 'rgba(22,163,74,0.04)' : 'transparent',
                      borderColor: 'var(--border)',
                    }}
                    onClick={() => isUnread && handleMarkRead(n.id)}
                  >
                    {/* Icon */}
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isUnread ? 'rgba(22,163,74,0.12)' : 'rgba(0,0,0,0.05)',
                        color: isUnread ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isUnread ? 'font-semibold' : 'font-medium'}`} style={{ color: 'var(--foreground)' }}>
                        {n.title || t('applicant.dashboard.notification_fallback')}
                      </p>
                      {n.message && (
                        <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                          {n.message}
                        </p>
                      )}
                    </div>

                    {/* Time + unread dot */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {format(new Date(n.created_at), 'MMM d')}
                      </span>
                      {isUnread && (
                        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--ember-orange)' }} />
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNotifIcon(type: string): ComponentType<{ className?: string }> {
  switch (type) {
    case 'application_submitted':
    case 'application_status_changed':
      return FileText;
    case 'new_message':
    case 'new_conversation':
      return MessageSquare;
    case 'application_approved':
      return CheckCircle;
    case 'application_status_changed_pending':
    case 'deadline':
      return Clock;
    default:
      return Bell;
  }
}
