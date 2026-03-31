/**
 * SuperAdminDashboardPage.tsx
 *
 * Dashboard v2 — structural + intelligence redesign:
 *  - System Overview: backend-driven global stats (ReportsSummary)
 *  - Sessions: full-width capacity banner with color-coded fill
 *  - Needs Attention: priority engine — pending apps + overdue docs, urgency-scored
 *  - Recent Activity: real events (applications, documents), filtered and de-emphasized
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, FileText, Activity, ArrowRight,
  AlertTriangle, CheckCircle, Clock, XCircle,
  TrendingUp, ChevronRight,
} from 'lucide-react';
import { differenceInDays, formatDistanceToNow } from 'date-fns';
import { useAppSelector } from '@/store/hooks';
import { PersonalGreeting } from '@/ui/components/PersonalGreeting';
import { SkeletonCard, SkeletonTable } from '@/ui/components/Skeletons';
import { ErrorState } from '@/ui/components/EmptyState';
import { SessionsCarousel, type SessionCardData } from '@/ui/components/SessionsCarousel';
import { HeroSlideshow } from '@/ui/components/HeroSlideshow';
import {
  getReportsSummary, getDocumentRequestStats, getApplications, getDocumentRequests,
  getCamps,
  type ReportsSummary, type DocumentRequestStats, type DocumentRequest,
} from '@/features/admin/api/admin.api';
import type { Application, Camp } from '@/features/admin/types/admin.types';
import { getUnreadCount } from '@/features/messaging/api/messaging.api';

// ─── Urgency scoring ──────────────────────────────────────────────────────────

type UrgencyLevel = 'critical' | 'high' | 'normal';

function getUrgency(submittedAt: string | undefined): UrgencyLevel {
  if (!submittedAt) return 'normal';
  const days = differenceInDays(new Date(), new Date(submittedAt));
  if (days >= 5) return 'critical';
  if (days >= 2) return 'high';
  return 'normal';
}

const URGENCY_DOT: Record<UrgencyLevel, string> = {
  critical: 'var(--destructive)',
  high: '#d97706',
  normal: 'var(--muted-foreground)',
};

const URGENCY_BADGE: Record<UrgencyLevel, React.CSSProperties> = {
  critical: { color: 'var(--destructive)', background: 'rgba(220,38,38,0.08)' },
  high:     { color: '#b45309',            background: 'rgba(245,158,11,0.08)' },
  normal:   { color: 'var(--muted-foreground)', background: 'rgba(0,0,0,0.05)' },
};

// ─── Activity icon + color mapping ────────────────────────────────────────────

function activityIcon(status: string): typeof FileText {
  switch (status) {
    case 'approved':     return CheckCircle;
    case 'rejected':     return XCircle;
    case 'waitlisted':   return Clock;
    case 'under_review': return Clock;
    default:             return FileText;
  }
}

function activityColor(status: string): string {
  switch (status) {
    case 'approved':     return 'var(--forest-green)';
    case 'rejected':     return 'var(--destructive)';
    case 'waitlisted':   return '#d97706';
    case 'under_review': return '#2563eb';
    default:             return 'var(--ember-orange)';
  }
}

function getActivityMessage(status: string, camperName: string): string {
  switch (status) {
    case 'approved':     return `${camperName}'s application was approved`;
    case 'rejected':     return `${camperName}'s application was not approved`;
    case 'waitlisted':   return `${camperName} was added to the waitlist`;
    case 'under_review': return `${camperName}'s application is under review`;
    case 'submitted':    return `New application submitted for ${camperName}`;
    default:             return `Application updated for ${camperName}`;
  }
}

// ─── Priority item type ───────────────────────────────────────────────────────

interface PriorityItem {
  id: string;
  label: string;
  sublabel: string;
  urgency: UrgencyLevel;
  daysAgo: number | null;
  to: string;
  status?: Application['status'];
}

// ─── Activity item type ───────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  camperName: string;
  subtitle: string;
  time: string;
  action: string;
  status: Application['status'];
  to: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SuperAdminDashboardPage() {
  useTranslation(); // reserved for future i18n strings
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);

  const [summary,      setSummary]      = useState<ReportsSummary | null>(null);
  const [docStats,     setDocStats]     = useState<DocumentRequestStats | null>(null);
  const [camps,        setCamps]        = useState<Camp[]>([]);
  const [pendingApps,  setPendingApps]  = useState<Application[]>([]);
  const [overdueDocs,  setOverdueDocs]  = useState<DocumentRequest[]>([]);
  const [recentApps,   setRecentApps]   = useState<Application[]>([]);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(false);
  const [retryKey,     setRetryKey]     = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);

    Promise.all([
      getReportsSummary(),
      getDocumentRequestStats().catch(() => null),
      getApplications({ page: 1 }).then((r) => r.data),
      getDocumentRequests({ page: 1 }).catch(() => ({ data: [] as DocumentRequest[] })),
      getUnreadCount().catch(() => 0),
      getCamps().catch(() => [] as Camp[]),
    ])
      .then(([rpt, docs, apps, docPage, unread, campsData]) => {
        setSummary(rpt);
        setDocStats(docs);
        setUnreadCount(unread);
        setCamps(campsData);

        // Needs Attention: submitted + under_review, oldest first
        const actionable = apps
          .filter((a) => a.status === 'submitted' || a.status === 'under_review')
          .sort((a, b) => {
            const da = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
            const db = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
            return da - db;
          })
          .slice(0, 4);
        setPendingApps(actionable);

        // Overdue document requests for Needs Attention
        const overdueList = (docPage.data ?? [])
          .filter((d: DocumentRequest) => d.status === 'overdue')
          .slice(0, 2);
        setOverdueDocs(overdueList);

        // Recent Activity: all active applications, most recently updated first
        const reviewed = apps
          .filter((a) => !['draft', 'cancelled'].includes(a.status))
          .sort((a, b) => {
            const aTime = a.reviewed_at ?? a.updated_at ?? a.submitted_at ?? a.created_at;
            const bTime = b.reviewed_at ?? b.updated_at ?? b.submitted_at ?? b.created_at;
            return new Date(bTime ?? 0).getTime() - new Date(aTime ?? 0).getTime();
          })
          .slice(0, 6);
        setRecentApps(reviewed);
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

  // Priority items: pending apps + overdue docs, sorted by urgency
  const priorityItems: PriorityItem[] = [
    ...pendingApps.map((a): PriorityItem => ({
      id:       `app-${a.id}`,
      label:    a.camper?.full_name ?? `Camper #${a.camper_id}`,
      sublabel: a.session?.name ?? `Session #${a.camp_session_id}`,
      urgency:  getUrgency(a.submitted_at),
      daysAgo:  a.submitted_at ? differenceInDays(new Date(), new Date(a.submitted_at)) : null,
      to:       `/super-admin/applications/${a.id}`,
      status:   a.status,
    })),
    ...overdueDocs.map((d): PriorityItem => ({
      id:       `doc-${d.id}`,
      label:    d.applicant_name ?? 'Unknown applicant',
      sublabel: d.document_type ?? 'a document',
      urgency:  'critical',
      daysAgo:  null,
      to:       '/super-admin/documents',
    })),
  ].sort((a, b) => {
    const order: Record<UrgencyLevel, number> = { critical: 0, high: 1, normal: 2 };
    return order[a.urgency] - order[b.urgency];
  }).slice(0, 5);

  // Activity feed from recently updated apps
  const activityFeed: ActivityItem[] = recentApps.map((a) => ({
    id:         `app-${a.id}`,
    camperName: a.camper?.full_name ?? `Camper #${a.camper_id}`,
    subtitle:   a.session?.name ?? `Session #${a.camp_session_id}`,
    time:       a.reviewed_at ?? a.updated_at ?? a.submitted_at ?? a.created_at,
    action:     a.status,
    status:     a.status,
    to:         `/super-admin/applications/${a.id}`,
  }));

  void navigate; // suppress unused warning — kept for future use

  if (error) return <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />;

  return (
    <div className="max-w-6xl space-y-8">

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div
        className="relative flex flex-col justify-end rounded-2xl overflow-hidden"
        style={{ minHeight: '340px' }}
      >
        <HeroSlideshow initialIndex={3} />
        <div className="relative z-10 p-6 lg:p-8">
          <PersonalGreeting
            user={user}
            // eslint-disable-next-line jsx-a11y/aria-role
            role="super_admin"
            stats={{
              pendingCount:    stats.pending    || undefined,
              unreadCount:     unreadCount      || undefined,
              docOverdueCount: (docStats?.overdue ?? 0) || undefined,
            }}
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
            to="/super-admin/reports"
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
                <p className="text-xs mt-1.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>Total applications</p>
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
                <p className="text-xs mt-1.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>Awaiting review</p>
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
                <p className="text-xs mt-1.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>Approved</p>
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
                <p className="text-xs mt-1.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>Rejected</p>
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
                <p className="text-xs mt-1.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>Waitlisted</p>
              </div>
            </div>

          </div>
        )}
      </section>

      {/* ── 2. Sessions ──────────────────────────────────────── */}
      <SessionsCarousel
        sessions={sessionCards}
        sessionDetailRoute={(id) => `/super-admin/sessions/${id}`}
        manageRoute="/super-admin/sessions"
        loading={loading}
      />

      {/* ── 3 + 4. Two-column grid ────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-6">

        {/* ── 3. Needs Attention (3/5) ──────────────────────── */}
        <section className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: '#d97706' }} />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                Needs Attention
              </h2>
            </div>
            <Link
              to="/super-admin/applications"
              className="text-xs font-medium flex items-center gap-1 hover:underline"
              style={{ color: 'var(--ember-orange)' }}
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-6"><SkeletonTable rows={4} /></div>
            ) : priorityItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(22,163,74,0.10)' }}>
                  <CheckCircle className="h-5 w-5" style={{ color: 'var(--forest-green)' }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>All caught up</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>No items require attention</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {priorityItems.map((item) => {
                  const isDoc = item.id.startsWith('doc-');

                  const timeRef = item.daysAgo === null
                    ? ''
                    : item.daysAgo === 0
                    ? 'today'
                    : item.daysAgo === 1
                    ? '1 day ago'
                    : `${item.daysAgo} days ago`;

                  const eventSentence = isDoc
                    ? `has not submitted the required document — ${item.sublabel}`
                    : item.status === 'under_review'
                      ? timeRef
                        ? `submitted an application ${timeRef} — now under review`
                        : 'submitted an application — now under review'
                      : timeRef
                      ? `submitted an application ${timeRef}`
                      : 'submitted an application';

                  return (
                    <li key={item.id}>
                      <Link
                        to={item.to}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--dash-nav-hover-bg)] transition-colors group"
                      >
                        {/* Urgency dot */}
                        <div
                          className="flex-shrink-0 w-2.5 h-2.5 rounded-full mt-0.5"
                          style={{ background: URGENCY_DOT[item.urgency] }}
                        />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                            {item.label}
                          </p>
                          <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                            {!isDoc && item.sublabel ? `${item.sublabel} · ` : ''}{eventSentence}
                          </p>
                        </div>

                        {/* Right — urgency label only for high/critical */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.urgency !== 'normal' && (
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded"
                              style={isDoc
                                ? URGENCY_BADGE.critical
                                : { color: '#6d28d9', background: 'rgba(109,40,217,0.08)' }
                              }
                            >
                              {isDoc ? 'Overdue' : 'Needs review'}
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

        {/* ── 4. Recent Activity (2/5) ──────────────────────── */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                Recent Activity
              </h2>
            </div>
            <Link
              to="/super-admin/applications"
              className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--ember-orange)', textDecoration: 'none' }}
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-5"><SkeletonTable rows={5} /></div>
            ) : activityFeed.length === 0 ? (
              <div className="flex items-center justify-center py-14">
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No recent activity</p>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {activityFeed.map((entry) => {
                  const Icon    = activityIcon(entry.action);
                  const color   = activityColor(entry.action);
                  const timeAgo = entry.time
                    ? formatDistanceToNow(new Date(entry.time), { addSuffix: true })
                    : null;
                  return (
                    <li key={entry.id}>
                      <Link
                        to={entry.to}
                        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                        style={{ textDecoration: 'none' }}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                          style={{ background: `${color}18` }}
                        >
                          <Icon className="h-4 w-4" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium leading-snug truncate" style={{ color: 'var(--foreground)' }}>
                            {getActivityMessage(entry.status, entry.camperName)}
                          </p>
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                            {entry.subtitle && `${entry.subtitle} · `}{timeAgo}
                          </p>
                        </div>
                        <ChevronRight
                          className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
                          style={{ color: 'var(--foreground)' }}
                        />
                      </Link>
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
