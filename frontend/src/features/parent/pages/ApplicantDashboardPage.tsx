/**
 * ApplicantDashboardPage.tsx
 *
 * Purpose: Main home screen for parents (applicants) after login.
 * Responsibilities:
 *   - Fetch campers, applications, notifications, and announcements in parallel
 *   - Greet the user by first name from Redux auth state
 *   - Display pinned/urgent camp announcements at the top
 *   - Show three stat cards (total campers, total applications, pending count)
 *   - List camper cards with latest application status and a drill-down link
 *   - Show recent unread notifications with mark-as-read support
 *   - Provide quick-action buttons at the bottom (New Application, View All, Inbox)
 *
 * Plain-English: This is the "home base" for parents — the first page they see
 * after logging in, packed with everything they need to know about their kids'
 * camp applications at a glance.
 */

import { useEffect, useState, type ComponentType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, FileText, Plus, ArrowRight, Calendar, Megaphone, Pin, Bell, MessageSquare, CheckCircle, Clock } from 'lucide-react';

import { useTranslation } from 'react-i18next';
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
  scrollViewport,
  cardHoverMotion,
} from '@/shared/constants/motion';
import { formatDistanceToNow } from 'date-fns';

export function ApplicantDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Pull the logged-in user's name from Redux — no API call needed
  const user = useAppSelector((state) => state.auth.user);
  const [campers, setCampers] = useState<Camper[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Increment to trigger a re-fetch after an error (retryKey pattern)
  const [retryKey, setRetryKey] = useState(0);

  // Fetch all dashboard data at once using Promise.allSettled.
  // allSettled (vs. all) means a failed notification fetch won't hide the campers list.
  useEffect(() => {
    setLoading(true);
    setError(false);
    Promise.allSettled([getCampers(), getApplications(), getNotifications(), getAnnouncements(5)])
      .then(([cResult, aResult, nResult, annResult]) => {
        // Only show a full error screen if BOTH core resources (campers + applications) failed
        if (cResult.status === 'rejected' && aResult.status === 'rejected') {
          setError(true);
          return;
        }
        setCampers(cResult.status === 'fulfilled' ? cResult.value : []);
        setApplications(aResult.status === 'fulfilled' ? aResult.value : []);
        if (nResult.status === 'fulfilled') {
          // Show at most 5 notifications — the sidebar bell shows the full list
          setNotifications((nResult.value.data ?? []).slice(0, 5));
        }
        if (annResult.status === 'fulfilled') {
          setAnnouncements(annResult.value.data ?? []);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [retryKey]);

  // Extract first name from the full name stored in Redux for a friendly greeting
  const firstName = user?.name.split(' ')[0] ?? 'there';
  // Count applications that still need attention from the admin
  const pendingCount = applications.filter(
    (a) => a.status === 'pending' || a.status === 'under_review'
  ).length;

  // Mark a single notification read: fire API in background, update UI immediately
  const handleMarkRead = (id: string) => {
    markNotificationRead(id).catch(() => {/* non-critical */});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
  };

  // Mark all as read: fire API in background, stamp every unread notification locally
  const handleMarkAllRead = () => {
    markAllNotificationsRead().catch(() => {/* non-critical */});
    setNotifications((prev) =>
      // Only update notifications that don't already have a read_at timestamp
      prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() }))
    );
  };

  if (error) {
    return <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />;
  }

  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      {/* Welcome heading — scrolls in via scrollRevealVariants */}
      <motion.div
        variants={scrollRevealVariants}
        initial="hidden"
        animate="visible"
      >
        <p
          className="text-xs uppercase tracking-widest font-medium mb-1"
          style={{ color: 'var(--ember-orange)' }}
        >
          {t('applicant.dashboard.welcome_back')}
        </p>
        <h2
          className="text-2xl font-headline font-semibold"
          style={{ color: 'var(--foreground)' }}
        >
          {firstName}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {t('applicant.dashboard.subtitle')}
        </p>
      </motion.div>

      {/* Announcements strip — only rendered when there are announcements to show */}
      {!loading && announcements.length > 0 && (
        <motion.div variants={scrollRevealVariants} initial="hidden" animate="visible">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
            <h3 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
              {t('applicant.dashboard.announcements')}
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className="rounded-xl border px-5 py-4"
                style={{
                  // Urgent announcements get a subtle red tint to draw attention
                  background: ann.is_urgent ? 'rgba(220,38,38,0.05)' : 'var(--card)',
                  borderColor: ann.is_urgent ? 'rgba(220,38,38,0.25)' : 'var(--border)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {/* Pin icon shown when the announcement is pinned by admins */}
                      {ann.is_pinned && (
                        <Pin className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                      )}
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                        {ann.title}
                      </p>
                      {ann.is_urgent && (
                        <span className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' }}>
                          {t('applicant.dashboard.urgent')}
                        </span>
                      )}
                    </div>
                    {/* line-clamp-2 keeps long announcements from taking over the page */}
                    <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--muted-foreground)' }}>
                      {ann.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stat cards — skeleton placeholders shown while loading */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={1} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label={t('applicant.dashboard.stat_campers')}
            value={campers.length}
            icon={Users}
            delay={0}
          />
          <StatCard
            label={t('applicant.dashboard.stat_applications')}
            value={applications.length}
            icon={FileText}
            color="var(--night-sky-blue)"
            delay={0.1}
          />
          {/* Pending count uses amber to signal "needs attention" */}
          <StatCard
            label={t('applicant.dashboard.stat_pending')}
            value={pendingCount}
            icon={Calendar}
            color="var(--warm-amber)"
            delay={0.2}
          />
        </div>
      )}

      {/* Two-column layout: camper list (left) + notifications (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camper cards — each card shows the latest application status */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3
              className="font-headline font-semibold text-base"
              style={{ color: 'var(--foreground)' }}
            >
              {t('applicant.dashboard.my_campers')}
            </h3>
            <Link
              to={ROUTES.PARENT_APPLICATION_NEW}
              className="flex items-center gap-1.5 text-sm text-ember-orange hover:underline"
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
            <div
              className="rounded-2xl border p-6"
              style={{
                background: 'var(--card)',
                borderColor: 'var(--border)',
              }}
            >
              <EmptyState
                title={t('applicant.dashboard.no_campers_title')}
                description={t('applicant.dashboard.no_campers_desc')}
                action={{
                  label: t('applicant.dashboard.start_application'),
                  onClick: () => navigate(ROUTES.PARENT_APPLICATION_NEW),
                }}
              />
            </div>
          ) : (
            // Stagger each camper card so they animate in one after another
            <motion.ul
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-3"
            >
              {campers.map((camper) => {
                // Filter applications to only those belonging to this camper
                const camperApps = applications.filter(
                  (a) => a.camper_id === camper.id
                );
                // The first application in the list is assumed to be the most recent
                const latestApp = camperApps[0];

                return (
                  <motion.li
                    key={camper.id}
                    variants={staggerChildVariants}
                    // cardHoverMotion adds a subtle scale-up on hover
                    {...cardHoverMotion}
                  >
                    <div
                      className="rounded-2xl border p-5 flex items-center justify-between gap-4"
                      style={{
                        background: 'var(--card)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Initials avatar using the camper's first and last name initials */}
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-headline font-semibold text-sm"
                          style={{
                            background: 'rgba(22,163,74,0.12)',
                            color: 'var(--ember-orange)',
                          }}
                        >
                          {camper.first_name.charAt(0)}{camper.last_name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: 'var(--foreground)' }}
                          >
                            {camper.full_name}
                          </p>
                          {/* i18n plural key chooses "1 application" vs "N applications" */}
                          <p
                            className="text-xs"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            {t(camperApps.length === 1 ? 'applicant.dashboard.camper_age_apps_one' : 'applicant.dashboard.camper_age_apps_other', { age: camper.age, count: camperApps.length })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Status badge from the most recent application, if one exists */}
                        {latestApp && (
                          <StatusBadge status={latestApp.status} />
                        )}
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

        {/* Recent Updates / Notifications panel */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3
              className="font-headline font-semibold text-base"
              style={{ color: 'var(--foreground)' }}
            >
              {t('applicant.dashboard.recent_updates')}
            </h3>
            {/* "Mark all read" button only appears when at least one notification is unread */}
            {notifications.some((n) => !n.read_at) && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs hover:underline"
                style={{ color: 'var(--ember-orange)' }}
              >
                {t('applicant.dashboard.mark_all_read')}
              </button>
            )}
          </div>

          {loading ? (
            <SkeletonTable rows={4} />
          ) : notifications.length === 0 ? (
            <div
              className="rounded-xl border p-5 text-center"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <Bell className="h-5 w-5 mx-auto mb-2" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t('applicant.dashboard.no_updates')}
              </p>
            </div>
          ) : (
            <motion.ul
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-2"
            >
              {notifications.map((n) => {
                const isUnread = !n.read_at;
                // Pick an icon based on the notification type string from the server
                const Icon = getNotifIcon(n.type);
                return (
                  <motion.li
                    key={n.id}
                    variants={staggerChildVariants}
                    className="rounded-xl border p-4 cursor-pointer transition-colors"
                    style={{
                      // Unread notifications have a subtle green tint to stand out
                      background: isUnread ? 'rgba(22,163,74,0.06)' : 'var(--card)',
                      borderColor: isUnread ? 'rgba(22,163,74,0.20)' : 'var(--border)',
                    }}
                    // Clicking only fires when the notification is unread — avoids no-op clicks
                    onClick={() => isUnread && handleMarkRead(n.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon badge changes color based on read/unread state */}
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          background: isUnread ? 'rgba(22,163,74,0.12)' : 'rgba(0,0,0,0.05)',
                          color: isUnread ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Unread titles are bold; read titles are medium weight */}
                        <p
                          className={`text-sm mb-0.5 ${isUnread ? 'font-semibold' : 'font-medium'}`}
                          style={{ color: 'var(--foreground)' }}
                        >
                          {n.title || t('applicant.dashboard.notification_fallback')}
                        </p>
                        {n.message && (
                          <p
                            className="text-xs leading-relaxed mb-1"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            {n.message}
                          </p>
                        )}
                        {/* Relative time like "3 hours ago" instead of a raw timestamp */}
                        <p
                          className="text-xs"
                          style={{ color: 'var(--muted-foreground)', opacity: 0.7 }}
                        >
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {/* Orange dot indicator for unread — appears top-right of the card */}
                      {isUnread && (
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                          style={{ background: 'var(--ember-orange)' }}
                        />
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </div>
      </div>

      {/* Quick actions row — triggers scroll reveal when it enters the viewport */}
      <motion.div
        variants={scrollRevealVariants}
        initial="hidden"
        whileInView="visible"
        viewport={scrollViewport}
      >
        <h3
          className="font-headline font-semibold text-base mb-4"
          style={{ color: 'var(--foreground)' }}
        >
          {t('applicant.dashboard.quick_actions')}
        </h3>
        <div className="flex flex-wrap gap-3">
          <Button
            as={Link}
            to={ROUTES.PARENT_APPLICATION_NEW}
            variant="primary"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            {t('applicant.dashboard.new_application')}
          </Button>
          <Button
            as={Link}
            to={ROUTES.PARENT_APPLICATIONS}
            variant="secondary"
            size="sm"
          >
            {t('applicant.dashboard.view_all_applications')}
          </Button>
          <Button
            as={Link}
            to="/applicant/inbox"
            variant="secondary"
            size="sm"
          >
            {t('applicant.dashboard.open_inbox')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Maps a notification type string to a Lucide icon component for the notification feed
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
