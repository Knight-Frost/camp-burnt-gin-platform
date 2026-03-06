/**
 * AdminDashboardPage.tsx
 * Admin overview — application stats, review queue, enrollment per session, unread messages.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Users, CheckCircle, XCircle, Clock, ArrowRight, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

import { getAdminApplications, getCamps } from '@/features/admin/api/admin.api';
import { getUnreadCount } from '@/features/messaging/api/messaging.api';
import type { Application, Camp } from '@/features/admin/types/admin.types';
import { ROUTES } from '@/shared/constants/routes';
import { StatCard } from '@/ui/components/StatCard';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { SkeletonCard, SkeletonTable } from '@/ui/components/Skeletons';
import { ErrorState } from '@/ui/components/EmptyState';
import {
  staggerContainerVariants,
  staggerChildVariants,
  scrollRevealVariants,
} from '@/shared/constants/motion';

export function AdminDashboardPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [camps, setCamps]               = useState<Camp[]>([]);
  const [unread, setUnread]             = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      getAdminApplications().then((res) => res.data),
      getCamps().catch(() => [] as Camp[]),
      getUnreadCount().catch(() => 0),
    ])
      .then(([apps, campsData, unreadCount]) => {
        setApplications(apps);
        setCamps(campsData);
        setUnread(unreadCount);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [retryKey]);

  const stats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === 'pending').length,
    accepted: applications.filter((a) => a.status === 'approved').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  };

  const reviewQueue = applications
    .filter((a) => a.status === 'pending' || a.status === 'under_review')
    .slice(0, 10);

  // Build enrollment rows from camps → sessions
  const sessionRows = camps.flatMap((c) =>
    (c.sessions ?? []).map((s) => ({
      id: s.id,
      name: `${c.name} — ${s.name ?? `Session ${s.id}`}`,
      enrolled: s.enrolled_count ?? 0,
      capacity: s.capacity ?? 0,
    }))
  ).slice(0, 8);

  if (error) return <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />;

  return (
    <div className="max-w-6xl space-y-16">

      {/* ── Stats row ───────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-8">
          {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} lines={1} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-8">
          <StatCard label="Total applications" value={stats.total} icon={FileText} delay={0} />
          <StatCard label="Pending review" value={stats.pending} icon={Clock} color="var(--warm-amber)" delay={0.05} />
          <StatCard label="Accepted" value={stats.accepted} icon={CheckCircle} color="var(--forest-green)" delay={0.1} />
          <StatCard label="Rejected" value={stats.rejected} icon={XCircle} color="var(--destructive)" delay={0.15} />
          <Link to="/admin/inbox" className="block group">
            <div
              className="rounded-2xl border p-7 flex items-start gap-5 transition-shadow hover:shadow-md h-full"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div
                className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: unread > 0 ? 'rgba(22,163,74,0.12)' : 'rgba(0,0,0,0.05)' }}
              >
                <MessageSquare
                  className="h-5 w-5"
                  style={{ color: unread > 0 ? 'var(--ember-orange)' : 'var(--muted-foreground)' }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-3xl font-headline font-semibold"
                  style={{ color: unread > 0 ? 'var(--ember-orange)' : 'var(--foreground)' }}
                >
                  {unread}
                </p>
                <p className="text-sm mt-1 leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                  Unread messages
                </p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* ── Pending Review ──────────────────────────────────── */}
      <motion.section variants={scrollRevealVariants} initial="hidden" animate="visible">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
              Pending Review
            </h2>
            <p className="text-sm mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
              Applications awaiting your decision
            </p>
          </div>
          <Link
            to={ROUTES.ADMIN_APPLICATIONS}
            className="text-sm font-medium hover:underline flex items-center gap-1.5 mt-0.5 flex-shrink-0"
            style={{ color: 'var(--ember-orange)' }}
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div
          className="rounded-2xl border overflow-hidden shadow-sm"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {loading ? (
            <div className="p-8"><SkeletonTable rows={5} /></div>
          ) : reviewQueue.length === 0 ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <CheckCircle
                  className="h-10 w-10 mx-auto mb-4"
                  style={{ color: 'var(--forest-green)', opacity: 0.65 }}
                />
                <p className="text-base font-medium" style={{ color: 'var(--foreground)' }}>
                  All caught up
                </p>
                <p className="text-sm mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  No applications pending review.
                </p>
              </div>
            </div>
          ) : (
            <motion.ul
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="divide-y"
              style={{ borderColor: 'var(--border)' }}
            >
              {reviewQueue.map((app) => (
                <motion.li key={app.id} variants={staggerChildVariants}>
                  <Link
                    to={ROUTES.ADMIN_APPLICATION_DETAIL(app.id)}
                    className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(22,163,74,0.1)' }}
                      >
                        <Users className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                          {app.camper?.full_name ?? `Camper #${app.camper_id}`}
                        </p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                          {app.session?.name ?? `Session #${app.session_id}`}
                          {app.submitted_at && (
                            <> &middot; {format(new Date(app.submitted_at), 'MMM d, yyyy')}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StatusBadge status={app.status} />
                      <ArrowRight className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>
      </motion.section>

      {/* ── Session Enrollment ──────────────────────────────── */}
      <motion.section variants={scrollRevealVariants} initial="hidden" animate="visible">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
              Session Enrollment
            </h2>
            <p className="text-sm mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
              Current capacity across all camp sessions
            </p>
          </div>
          <Link
            to={ROUTES.ADMIN_SESSIONS}
            className="text-sm font-medium hover:underline flex items-center gap-1.5 mt-0.5 flex-shrink-0"
            style={{ color: 'var(--ember-orange)' }}
          >
            Manage <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div
          className="rounded-2xl border overflow-hidden shadow-sm"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {loading ? (
            <div className="p-8"><SkeletonTable rows={4} /></div>
          ) : sessionRows.length === 0 ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <p className="text-base font-medium" style={{ color: 'var(--foreground)' }}>
                  No sessions found
                </p>
                <p className="text-sm mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  Sessions will appear here once created.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {sessionRows.map((row) => {
                const pct = row.capacity > 0 ? Math.min((row.enrolled / row.capacity) * 100, 100) : 0;
                const isFull = pct >= 100;
                const isNearFull = pct >= 80;
                const barColor = isFull ? 'var(--destructive)' : isNearFull ? 'var(--warm-amber)' : 'var(--forest-green)';

                return (
                  <div key={row.id} className="px-6 py-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium truncate flex-1 mr-4" style={{ color: 'var(--foreground)' }}>
                        {row.name}
                      </p>
                      <span
                        className="text-xs font-medium tabular-nums flex-shrink-0"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        {row.enrolled} / {row.capacity}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.section>

    </div>
  );
}
