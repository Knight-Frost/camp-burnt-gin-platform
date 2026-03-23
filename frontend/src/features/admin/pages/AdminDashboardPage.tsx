/**
 * AdminDashboardPage.tsx
 *
 * Dashboard v2 — structural + intelligence redesign:
 *  - System Overview: backend-driven global stats (ReportsSummary)
 *  - Sessions: full-width capacity banner with color-coded fill
 *  - Needs Attention: priority engine — oldest pending first, urgency-scored
 *  - Recent Activity: audit log filtered to meaningful events only
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Users, CheckCircle, XCircle, Clock,
  ArrowRight, MessageSquare, AlertTriangle,
  TrendingUp, Activity, ChevronRight,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useTranslation } from 'react-i18next';

import {
  getAdminApplications,
  getCamps,
  getReportsSummary,
  getAuditLog,
  type ReportsSummary,
} from '@/features/admin/api/admin.api';
import { getUnreadCount } from '@/features/messaging/api/messaging.api';
import type { Application, Camp, AuditLogEntry } from '@/features/admin/types/admin.types';
import { useAppSelector } from '@/store/hooks';
import { ROUTES } from '@/shared/constants/routes';
import { SkeletonCard, SkeletonTable } from '@/ui/components/Skeletons';
import { ErrorState } from '@/ui/components/EmptyState';
import { PersonalGreeting } from '@/ui/components/PersonalGreeting';
import { SessionsCarousel, type SessionCardData } from '@/ui/components/SessionsCarousel';
import { HeroSlideshow } from '@/ui/components/HeroSlideshow';

// ─── Urgency scoring ──────────────────────────────────────────────────────────

type UrgencyLevel = 'critical' | 'high' | 'normal';

function getUrgency(submittedAt: string | undefined): UrgencyLevel {
  if (!submittedAt) return 'normal';
  const days = differenceInDays(new Date(), new Date(submittedAt));
  if (days >= 5) return 'critical';
  if (days >= 2) return 'high';
  return 'normal';
}

const URGENCY_STYLES: Record<UrgencyLevel, { dot: string; label: string; labelStyle: React.CSSProperties }> = {
  critical: {
    dot: 'var(--destructive)',
    label: 'Needs review',
    labelStyle: { color: '#6d28d9', background: 'rgba(109,40,217,0.08)' },
  },
  high: {
    dot: '#d97706',
    label: 'Needs review',
    labelStyle: { color: '#6d28d9', background: 'rgba(109,40,217,0.08)' },
  },
  normal: {
    dot: 'var(--muted-foreground)',
    label: '',
    labelStyle: {},
  },
};

// ─── Activity icon mapping ─────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, typeof FileText> = {
  approved: CheckCircle,
  rejected: XCircle,
  submitted: FileText,
  waitlisted: Clock,
  uploaded: TrendingUp,
};

function activityIcon(action: string) {
  const lower = action.toLowerCase();
  for (const [key, Icon] of Object.entries(ACTIVITY_ICONS)) {
    if (lower.includes(key)) return Icon;
  }
  return Activity;
}

function activityColor(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('approved')) return 'var(--forest-green)';
  if (lower.includes('rejected') || lower.includes('denied')) return 'var(--destructive)';
  if (lower.includes('waitlisted')) return '#d97706';
  return 'var(--ember-orange)';
}

// ─── Meaningful activity filter ───────────────────────────────────────────────

const MEANINGFUL_ACTIONS = ['submitted', 'approved', 'rejected', 'waitlisted', 'upload', 'review'];

function isMeaningfulEvent(entry: AuditLogEntry): boolean {
  const text = ((entry.human_description ?? '') + ' ' + (entry.action ?? '')).toLowerCase();
  return MEANINGFUL_ACTIONS.some((kw) => text.includes(kw));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);

  const [summary,      setSummary]      = useState<ReportsSummary | null>(null);
  const [pendingApps,  setPendingApps]  = useState<Application[]>([]);
  const [camps,        setCamps]        = useState<Camp[]>([]);
  const [unread,       setUnread]       = useState(0);
  const [activity,     setActivity]     = useState<AuditLogEntry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(false);
  const [retryKey,     setRetryKey]     = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      getReportsSummary(),
      getAdminApplications().then((res) => res.data),
      getCamps().catch(() => [] as Camp[]),
      getUnreadCount().catch(() => 0),
      getAuditLog({ per_page: 20 }).catch(() => ({ data: [] as AuditLogEntry[] })),
    ])
      .then(([rptSummary, apps, campsData, unreadCount, auditPage]) => {
        setSummary(rptSummary);
        // Needs Attention: pending + under_review, sorted oldest-first (most urgent)
        const actionable = apps
          .filter((a) => a.status === 'pending' || a.status === 'under_review')
          .sort((a, b) => {
            const da = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
            const db = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
            return da - db; // oldest first
          })
          .slice(0, 5);
        setPendingApps(actionable);
        setCamps(campsData);
        setUnread(unreadCount);
        const meaningful = (auditPage.data ?? [])
          .filter(isMeaningfulEvent)
          .slice(0, 6);
        setActivity(meaningful);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [retryKey]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const stats = {
    total:      summary?.total_applications ?? 0,
    pending:    summary?.pending_applications ?? 0,
    accepted:   summary?.accepted_applications ?? 0,
    rejected:   summary?.rejected_applications ?? 0,
    waitlisted: summary?.applications_by_status?.['waitlisted'] ?? 0,
  };

  // Only explicitly active sessions — no past/archived/inactive
  const sessionCards: SessionCardData[] = camps.flatMap((c) =>
    (c.sessions ?? [])
      .filter((s) => s.is_active === true)
      .map((s) => ({
        id:          s.id,
        campName:    c.name,
        sessionName: s.name ?? `Session ${s.id}`,
        enrolled:    s.enrolled_count ?? 0,
        capacity:    s.capacity ?? 0,
      }))
  );

  if (error) return <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />;

  return (
    <div className="max-w-6xl space-y-8">

      {/* ── Liquid glass hero ────────────────────────────────── */}
      <div
        className="relative flex flex-col justify-end rounded-2xl overflow-hidden"
        style={{ minHeight: '340px' }}
      >
        <HeroSlideshow initialIndex={0} />
        {/* Quick actions float top-right */}
        <div className="absolute top-4 right-0 z-10 flex gap-2">
          <Link
            to={ROUTES.ADMIN_APPLICATIONS}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: 'rgba(255,255,255,0.14)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.32)',
              color: '#fff',
              textShadow: '0 1px 3px rgba(0,0,0,0.35)',
            }}
          >
            <FileText className="h-4 w-4" />
            {t('admin.dashboard.all_applications')}
          </Link>
          <Link
            to="/admin/inbox"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors relative"
            style={{
              background: 'rgba(255,255,255,0.14)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.32)',
              color: '#fff',
              textShadow: '0 1px 3px rgba(0,0,0,0.35)',
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
        <div className="relative z-10 p-6 lg:p-8">
          <PersonalGreeting
            user={user}
            role="admin"
            stats={{ pendingCount: stats.pending, unreadCount: unread }}
          />
        </div>
      </div>

      {/* ── 1. System Overview ───────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            System Overview
          </h2>
          <Link
            to={ROUTES.ADMIN_REPORTS}
            className="text-xs font-medium flex items-center gap-1 hover:underline"
            style={{ color: 'var(--ember-orange)' }}
          >
            Full report <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} lines={1} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Total */}
            <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,0,0,0.05)' }}>
                <Users className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-headline font-semibold leading-none" style={{ color: 'var(--foreground)' }}>
                  {stats.total}
                </p>
                <p className="text-xs mt-1.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                  Total applications
                </p>
              </div>
            </div>

            {/* Pending */}
            <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.10)' }}>
                <Clock className="h-4 w-4" style={{ color: '#d97706' }} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-headline font-semibold leading-none" style={{ color: stats.pending > 0 ? '#b45309' : 'var(--foreground)' }}>
                  {stats.pending}
                </p>
                <p className="text-xs mt-1.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                  Awaiting review
                </p>
              </div>
            </div>

            {/* Accepted */}
            <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(22,163,74,0.10)' }}>
                <CheckCircle className="h-4 w-4" style={{ color: 'var(--forest-green)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-headline font-semibold leading-none" style={{ color: 'var(--foreground)' }}>
                  {stats.accepted}
                </p>
                <p className="text-xs mt-1.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                  Accepted
                </p>
              </div>
            </div>

            {/* Rejected */}
            <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(220,38,38,0.08)' }}>
                <XCircle className="h-4 w-4" style={{ color: 'var(--destructive)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-headline font-semibold leading-none" style={{ color: 'var(--foreground)' }}>
                  {stats.rejected}
                </p>
                <p className="text-xs mt-1.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                  Rejected
                </p>
              </div>
            </div>

            {/* Waitlisted */}
            <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(234,88,12,0.10)' }}>
                <TrendingUp className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-headline font-semibold leading-none" style={{ color: 'var(--foreground)' }}>
                  {stats.waitlisted}
                </p>
                <p className="text-xs mt-1.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                  Waitlisted
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 2. Sessions ──────────────────────────────────────── */}
      <SessionsCarousel
        sessions={sessionCards}
        sessionDetailRoute={ROUTES.ADMIN_SESSION_DETAIL}
        manageRoute={ROUTES.ADMIN_SESSIONS}
        loading={loading}
      />

      {/* ── 3 + 4. Two-column grid: Needs Attention + Recent Activity ── */}
      <div className="grid lg:grid-cols-5 gap-6">

        {/* ── 3. Needs Attention (3/5 width) ────────────────── */}
        <section className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: '#d97706' }} />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                Needs Attention
              </h2>
            </div>
            <Link
              to={ROUTES.ADMIN_APPLICATIONS}
              className="text-xs font-medium flex items-center gap-1 hover:underline"
              style={{ color: 'var(--ember-orange)' }}
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-6"><SkeletonTable rows={4} /></div>
            ) : pendingApps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(22,163,74,0.10)' }}>
                  <CheckCircle className="h-5 w-5" style={{ color: 'var(--forest-green)' }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>All caught up</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>No applications awaiting review</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {pendingApps.map((app) => {
                  const urgency = getUrgency(app.submitted_at);
                  const style   = URGENCY_STYLES[urgency];
                  const days    = app.submitted_at
                    ? differenceInDays(new Date(), new Date(app.submitted_at))
                    : null;

                  const name = app.camper?.full_name ?? `Camper #${app.camper_id}`;

                  const timeRef = days === null
                    ? ''
                    : days === 0
                    ? 'today'
                    : days === 1
                    ? '1 day ago'
                    : `${days} days ago`;

                  const eventSentence = app.status === 'under_review'
                    ? timeRef
                      ? `submitted an application ${timeRef} — now under review`
                      : 'submitted an application — now under review'
                    : timeRef
                    ? `submitted an application ${timeRef}`
                    : 'submitted an application';

                  return (
                    <li key={app.id}>
                      <Link
                        to={ROUTES.ADMIN_APPLICATION_DETAIL(app.id)}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--dash-nav-hover-bg)] transition-colors group"
                      >
                        {/* Urgency dot */}
                        <div
                          className="flex-shrink-0 w-2.5 h-2.5 rounded-full mt-0.5"
                          style={{ background: style.dot }}
                        />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                            {name}
                          </p>
                          <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                            {eventSentence}
                          </p>
                        </div>

                        {/* Right side — urgency label only for high/critical */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {urgency !== 'normal' && (
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded"
                              style={style.labelStyle}
                            >
                              {style.label}
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 opacity-30 group-hover:opacity-60 transition-opacity" style={{ color: 'var(--foreground)' }} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ── 4. Recent Activity (2/5 width) ────────────────── */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                Recent Activity
              </h2>
            </div>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-5"><SkeletonTable rows={5} /></div>
            ) : activity.length === 0 ? (
              <div className="flex items-center justify-center py-14">
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No recent activity</p>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {activity.map((entry) => {
                  const Icon  = activityIcon(entry.action);
                  const color = activityColor(entry.action);
                  const label = entry.human_description ?? entry.action;

                  return (
                    <li key={entry.id} className="px-4 py-3 flex items-start gap-3">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${color}14` }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-snug" style={{ color: 'var(--foreground)' }}>
                          {label}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {entry.user?.name && (
                            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              {entry.user.name}
                            </span>
                          )}
                          {entry.created_at && (
                            <span className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.7 }}>
                              · {format(new Date(entry.created_at), 'MMM d, h:mm a')}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

    </div>
  );
}
