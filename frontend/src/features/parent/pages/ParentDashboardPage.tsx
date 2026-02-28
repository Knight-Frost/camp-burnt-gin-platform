/**
 * ParentDashboardPage.tsx
 * Main parent dashboard — shows camper summary cards, application statuses,
 * quick actions, and recent notifications.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, FileText, Plus, ArrowRight, Calendar, Megaphone, Pin } from 'lucide-react';

import { getCampers, getApplications } from '@/features/parent/api/parent.api';
import { getNotifications } from '@/features/admin/api/notifications.api';
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

export function ParentDashboardPage() {
  const user = useAppSelector((state) => state.auth.user);
  const [campers, setCampers] = useState<Camper[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    Promise.all([getCampers(), getApplications(), getNotifications(), getAnnouncements(5)])
      .then(([c, a, n, ann]) => {
        setCampers(c);
        setApplications(a);
        setNotifications(n.data.slice(0, 5));
        setAnnouncements(ann.data ?? []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [retryKey]);

  const firstName = user?.name.split(' ')[0] ?? 'there';
  const pendingCount = applications.filter(
    (a) => a.status === 'submitted' || a.status === 'under_review'
  ).length;

  if (error) {
    return <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />;
  }

  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      {/* Welcome */}
      <motion.div
        variants={scrollRevealVariants}
        initial="hidden"
        animate="visible"
      >
        <p
          className="text-xs uppercase tracking-widest font-medium mb-1"
          style={{ color: 'var(--ember-orange)' }}
        >
          Welcome back
        </p>
        <h2
          className="text-2xl font-headline font-semibold"
          style={{ color: 'var(--foreground)' }}
        >
          {firstName}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Manage your campers, applications, and communications from here.
        </p>
      </motion.div>

      {/* Announcements */}
      {!loading && announcements.length > 0 && (
        <motion.div variants={scrollRevealVariants} initial="hidden" animate="visible">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
            <h3 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
              Announcements
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className="rounded-xl border px-5 py-4"
                style={{
                  background: ann.is_urgent ? 'rgba(220,38,38,0.05)' : 'var(--card)',
                  borderColor: ann.is_urgent ? 'rgba(220,38,38,0.25)' : 'var(--border)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {ann.is_pinned && (
                        <Pin className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                      )}
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                        {ann.title}
                      </p>
                      {ann.is_urgent && (
                        <span className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' }}>
                          Urgent
                        </span>
                      )}
                    </div>
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

      {/* Stats row */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={1} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Registered campers"
            value={campers.length}
            icon={Users}
            delay={0}
          />
          <StatCard
            label="Total applications"
            value={applications.length}
            icon={FileText}
            color="var(--night-sky-blue)"
            delay={0.1}
          />
          <StatCard
            label="Pending review"
            value={pendingCount}
            icon={Calendar}
            color="var(--warm-amber)"
            delay={0.2}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campers */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3
              className="font-headline font-semibold text-base"
              style={{ color: 'var(--foreground)' }}
            >
              My Campers
            </h3>
            <Link
              to={ROUTES.PARENT_APPLICATION_NEW}
              className="flex items-center gap-1.5 text-sm text-ember-orange hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              New application
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
                title="No campers registered"
                description="Register your first camper to start an application."
                action={{
                  label: 'Start an application',
                  onClick: () => {},
                }}
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
                const camperApps = applications.filter(
                  (a) => a.camper_id === camper.id
                );
                const latestApp = camperApps[0];

                return (
                  <motion.li
                    key={camper.id}
                    variants={staggerChildVariants}
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
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-headline font-semibold text-sm"
                          style={{
                            background: 'rgba(22,101,52,0.12)',
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
                          <p
                            className="text-xs"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            Age {camper.age} &middot; {camperApps.length} application{camperApps.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
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

        {/* Recent notifications */}
        <div>
          <h3
            className="font-headline font-semibold text-base mb-4"
            style={{ color: 'var(--foreground)' }}
          >
            Recent Updates
          </h3>

          {loading ? (
            <SkeletonTable rows={4} />
          ) : notifications.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              No recent notifications.
            </p>
          ) : (
            <motion.ul
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-2"
            >
              {notifications.map((n) => (
                <motion.li
                  key={n.id}
                  variants={staggerChildVariants}
                  className="rounded-xl border p-4"
                  style={{
                    background: n.read_at ? 'var(--card)' : 'rgba(22,101,52,0.06)',
                    borderColor: n.read_at ? 'var(--border)' : 'rgba(22,101,52,0.15)',
                  }}
                >
                  <p
                    className="text-sm font-medium mb-0.5"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {n.title}
                  </p>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
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
          Quick Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          <Button
            as={Link}
            to={ROUTES.PARENT_APPLICATION_NEW}
            variant="primary"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            New application
          </Button>
          <Button
            as={Link}
            to={ROUTES.PARENT_APPLICATIONS}
            variant="secondary"
            size="sm"
          >
            View all applications
          </Button>
          <Button
            as={Link}
            to="/parent/inbox"
            variant="secondary"
            size="sm"
          >
            Open inbox
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
