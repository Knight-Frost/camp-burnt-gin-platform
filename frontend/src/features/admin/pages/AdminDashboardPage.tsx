/**
 * AdminDashboardPage.tsx
 *
 * Redesigned (Phase 12) for operational clarity:
 *  - Meaningful header with context and quick actions
 *  - Localization-resilient stat cards
 *  - Pending Review queue is the primary focus
 *  - Status badges with clear hierarchy
 *  - Session enrollment as secondary section
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Users, CheckCircle, XCircle, Clock,
  ArrowRight, MessageSquare, Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

import { getAdminApplications, getCamps } from '@/features/admin/api/admin.api';
import { getUnreadCount } from '@/features/messaging/api/messaging.api';
import type { Application, Camp } from '@/features/admin/types/admin.types';
import { useAppSelector } from '@/store/hooks';
import { ROUTES } from '@/shared/constants/routes';
import { StatCard } from '@/ui/components/StatCard';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { SkeletonCard, SkeletonTable } from '@/ui/components/Skeletons';
import { ErrorState } from '@/ui/components/EmptyState';
import { BackgroundSlideshow } from '@/ui/components/BackgroundSlideshow';
import { PersonalGreeting } from '@/ui/components/PersonalGreeting';

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);

  const [applications, setApplications] = useState<Application[]>([]);
  const [camps, setCamps]               = useState<Camp[]>([]);
  const [unread, setUnread]             = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
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
    total:    applications.length,
    pending:  applications.filter((a) => a.status === 'pending' || a.status === 'under_review').length,
    accepted: applications.filter((a) => a.status === 'approved').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  };

  const reviewQueue = applications
    .filter((a) => a.status === 'pending' || a.status === 'under_review')
    .slice(0, 10);

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
    <div className="max-w-6xl space-y-8">

      {/* ── Liquid glass hero ────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl" style={{ minHeight: '200px' }}>
        <BackgroundSlideshow />
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.30) 100%)' }}
        />
        {/* Quick actions float top-right inside the hero */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Link
            to={ROUTES.ADMIN_APPLICATIONS}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.35)',
              color: '#fff',
              textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          >
            <FileText className="h-4 w-4" />
            {t('admin.dashboard.all_applications')}
          </Link>
          <Link
            to="/admin/inbox"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors relative"
            style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.35)',
              color: '#fff',
              textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          >
            <MessageSquare className="h-4 w-4" />
            {t('portal_nav.inbox')}
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-semibold"
                style={{ background: 'var(--destructive)', color: '#fff', fontSize: '10px' }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
        </div>
        <div className="relative z-10 p-6 flex items-end" style={{ minHeight: '200px' }}>
          <PersonalGreeting
            user={user}
            role="admin"
            stats={{ pendingCount: stats.pending, unreadCount: unread }}
          />
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} lines={1} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label={t('admin.dashboard.stat_total')}
            value={stats.total}
            icon={FileText}
            delay={0}
          />
          <StatCard
            label={t('admin.dashboard.stat_pending')}
            value={stats.pending}
            icon={Clock}
            color="var(--warm-amber)"
            delay={0.05}
          />
          <StatCard
            label={t('admin.dashboard.stat_accepted')}
            value={stats.accepted}
            icon={CheckCircle}
            color="var(--forest-green)"
            delay={0.1}
          />
          <StatCard
            label={t('admin.dashboard.stat_rejected')}
            value={stats.rejected}
            icon={XCircle}
            color="var(--destructive)"
            delay={0.15}
          />
          {/* Unread messages — clickable stat card */}
          <Link to="/admin/inbox" className="block group">
            <div
              className="rounded-2xl border p-4 sm:p-5 flex items-start gap-3 min-w-0 transition-shadow hover:shadow-md h-full"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: unread > 0 ? 'rgba(22,163,74,0.12)' : 'rgba(0,0,0,0.05)' }}
              >
                <MessageSquare className="h-5 w-5" style={{ color: unread > 0 ? 'var(--ember-orange)' : 'var(--muted-foreground)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-headline font-semibold leading-none" style={{ color: unread > 0 ? 'var(--ember-orange)' : 'var(--foreground)' }}>
                  {unread}
                </p>
                <p className="text-xs sm:text-sm mt-1.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                  {t('admin.dashboard.stat_unread')}
                </p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* ── Pending work alert ───────────────────────────────── */}
      {!loading && stats.pending > 0 && (
        <div
          className="rounded-xl border px-4 py-3 flex items-center justify-between gap-4"
          style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)', borderLeftWidth: '3px', borderLeftColor: 'var(--warm-amber)' }}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 flex-shrink-0" style={{ color: '#b45309' }} />
            <p className="text-sm font-medium" style={{ color: '#b45309' }}>
              {stats.pending} application{stats.pending !== 1 ? 's' : ''} awaiting review
            </p>
          </div>
          <Link
            to={ROUTES.ADMIN_APPLICATIONS}
            className="flex-shrink-0 flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: '#b45309' }}
          >
            {t('common.view_all')} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* ── Pending Review queue ─────────────────────────────── */}
      <section>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('admin.dashboard.review_queue_title')}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin.dashboard.review_queue_subtitle')}
            </p>
          </div>
          <Link
            to={ROUTES.ADMIN_APPLICATIONS}
            className="text-sm font-medium hover:underline flex items-center gap-1.5 mt-0.5 flex-shrink-0"
            style={{ color: 'var(--ember-orange)' }}
          >
            {t('common.view_all')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          {loading ? (
            <div className="p-6"><SkeletonTable rows={5} /></div>
          ) : reviewQueue.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <CheckCircle className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--forest-green)', opacity: 0.65 }} />
                <p className="text-base font-medium" style={{ color: 'var(--foreground)' }}>
                  {t('admin.dashboard.all_caught_up')}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {t('admin.dashboard.no_pending')}
                </p>
                <Link
                  to={ROUTES.ADMIN_APPLICATION_DETAIL('new')}
                  className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium"
                  style={{ color: 'var(--ember-orange)' }}
                >
                  <Plus className="h-4 w-4" />
                  {t('admin.dashboard.new_application')}
                </Link>
              </div>
            </div>
          ) : (
            <ul
              className="divide-y"
              style={{ borderColor: 'var(--border)' }}
            >
              {reviewQueue.map((app) => (
                <li key={app.id}>
                  <Link
                    to={ROUTES.ADMIN_APPLICATION_DETAIL(app.id)}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(22,163,74,0.1)' }}>
                        <Users className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                          {app.camper?.full_name ?? `Camper #${app.camper_id}`}
                        </p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                          {app.session?.name ?? `Session #${app.session?.id ?? '?'}`}
                          {app.submitted_at && (
                            <> &middot; {format(new Date(app.submitted_at), 'MMM d, yyyy')}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={app.status} />
                      <ArrowRight className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Session Enrollment ───────────────────────────────── */}
      <section>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('admin.dashboard.enrollment_title')}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin.dashboard.enrollment_subtitle')}
            </p>
          </div>
          <Link
            to={ROUTES.ADMIN_SESSIONS}
            className="text-sm font-medium hover:underline flex items-center gap-1.5 mt-0.5 flex-shrink-0"
            style={{ color: 'var(--ember-orange)' }}
          >
            {t('admin.dashboard.manage_sessions')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          {loading ? (
            <div className="p-6"><SkeletonTable rows={4} /></div>
          ) : sessionRows.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {t('admin.dashboard.no_sessions')}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {t('admin.dashboard.no_sessions_desc')}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {sessionRows.map((row) => {
                const pct        = row.capacity > 0 ? Math.min((row.enrolled / row.capacity) * 100, 100) : 0;
                const isFull     = pct >= 100;
                const isNearFull = pct >= 80;
                const barColor   = isFull ? 'var(--destructive)' : isNearFull ? 'var(--warm-amber)' : 'var(--forest-green)';

                return (
                  <div key={row.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium truncate flex-1 mr-4" style={{ color: 'var(--foreground)' }}>
                        {row.name}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isFull && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' }}>
                            Full
                          </span>
                        )}
                        {isNearFull && !isFull && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.10)', color: '#b45309' }}>
                            Almost full
                          </span>
                        )}
                        <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                          {row.enrolled} / {row.capacity}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
