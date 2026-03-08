/**
 * MedicalDashboardPage.tsx
 *
 * The medical staff's operational command center — the first screen they see
 * after logging in. It answers three questions at a glance:
 *   1. "How is our camp doing medically?" → Stats Bar (5 summary numbers)
 *   2. "What needs my attention right now?" → Alert Strip + Follow-up Tasks
 *   3. "Which camper do I need to look up?" → Searchable Camper Directory
 *
 * Data is loaded in two separate batches so the page can show partial content
 * quickly instead of making the user wait for everything at once.
 *
 * Route: /medical/dashboard
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Users,
  AlertTriangle,
  Pill,
  Shield,
  FileX,
  Search,
  ClipboardList,
  AlertOctagon,
  Stethoscope,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Zap,
} from 'lucide-react';

import {
  getMedicalStats,
  getMedicalCampers,
  getMedicalFollowUps,
  updateMedicalFollowUp,
} from '@/features/medical/api/medical.api';
import type {
  MedicalStats,
  MedicalFollowUp,
  TreatmentLog,
  MedicalIncident,
  MedicalVisit,
} from '@/features/medical/api/medical.api';
import { StatCard } from '@/ui/components/StatCard';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { ROUTES } from '@/shared/constants/routes';
import { pageEntry, staggerContainer, staggerChild } from '@/shared/constants/motion';
import type { Camper } from '@/features/admin/types/admin.types';
import type { PaginatedResponse } from '@/shared/types/api.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * relativeTime — converts a date string into a human-friendly "time ago" label.
 * Returns things like "5m ago", "2h ago", or "yesterday".
 */
function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  // Difference in whole seconds between now and the recorded time
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'yesterday';
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * isOverdue — returns true if a due date has completely passed.
 * Setting hours to 23:59:59 means something due "today" is NOT overdue yet.
 */
function isOverdue(dueDateStr: string): boolean {
  return new Date(dueDateStr).setHours(23, 59, 59, 999) < Date.now();
}

/**
 * formatDueDate — formats a date string as "Mon DD" (e.g. "Mar 15").
 * Used in the follow-up task list to show when something is due.
 */
function formatDueDate(dueDateStr: string): string {
  const d = new Date(dueDateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Unified activity item ─────────────────────────────────────────────────────

/** The three types of events that can appear in the Recent Activity feed */
type ActivityKind = 'treatment' | 'incident' | 'visit';

/**
 * ActivityItem — a normalized shape used by the activity feed.
 * The backend returns treatments, incidents, and visits in separate arrays,
 * but the feed needs them all in one list sorted by time.
 */
interface ActivityItem {
  id: number;
  kind: ActivityKind;
  camperId: number;
  camperName: string;
  title: string;
  timestamp: string;
}

/**
 * buildActivity — merges three separate activity lists from the stats API
 * into a single unified list, sorted newest-first, limited to 5 items.
 * This is purely a client-side transformation — no extra network requests.
 */
function buildActivity(stats: MedicalStats): ActivityItem[] {
  const items: ActivityItem[] = [];

  // Map each treatment log into the normalized ActivityItem shape
  for (const t of (stats.recent_activity.treatments ?? []) as TreatmentLog[]) {
    items.push({
      id: t.id,
      kind: 'treatment',
      camperId: t.camper_id,
      camperName: t.camper?.full_name ?? 'Unknown',
      title: t.title,
      timestamp: t.created_at,
    });
  }

  // Map each incident into the normalized ActivityItem shape
  for (const inc of (stats.recent_activity.incidents ?? []) as MedicalIncident[]) {
    items.push({
      id: inc.id,
      kind: 'incident',
      camperId: inc.camper_id,
      camperName: inc.camper?.full_name ?? 'Unknown',
      title: inc.title,
      timestamp: inc.created_at,
    });
  }

  // Map each health office visit into the normalized ActivityItem shape
  for (const v of (stats.recent_activity.visits ?? []) as MedicalVisit[]) {
    items.push({
      id: v.id,
      kind: 'visit',
      camperId: v.camper_id,
      camperName: v.camper?.full_name ?? 'Unknown',
      title: v.chief_complaint,
      timestamp: v.created_at,
    });
  }

  // Sort all items newest-first, then keep only the top 5
  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * ActivityIcon — shows a small colored icon that signals what type of event
 * an activity item is (treatment = green, incident = red, visit = blue).
 */
function ActivityIcon({ kind }: { kind: ActivityKind }) {
  if (kind === 'treatment') {
    return (
      <div
        className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
        style={{ background: 'rgba(22,163,74,0.10)' }}
      >
        <ClipboardList className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
      </div>
    );
  }
  if (kind === 'incident') {
    return (
      <div
        className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
        style={{ background: 'rgba(220,38,38,0.08)' }}
      >
        <AlertOctagon className="h-4 w-4" style={{ color: 'var(--destructive)' }} />
      </div>
    );
  }
  // Default: visit
  return (
    <div
      className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
      style={{ background: 'rgba(37,99,235,0.08)' }}
    >
      <Stethoscope className="h-4 w-4" style={{ color: 'var(--night-sky-blue)' }} />
    </div>
  );
}

/**
 * ActivityTypeBadge — a colored pill label ("Treatment", "Incident", "Visit")
 * that appears below the activity title so you can tell them apart at a glance.
 */
function ActivityTypeBadge({ kind }: { kind: ActivityKind }) {
  const { t } = useTranslation();
  // Each activity kind has its own color scheme defined here
  const configs: Record<ActivityKind, { label: string; bg: string; color: string }> = {
    treatment: {
      label: t('medical.dashboard.activity.type_treatment'),
      bg: 'rgba(22,163,74,0.10)',
      color: 'var(--ember-orange)',
    },
    incident: {
      label: t('medical.dashboard.activity.type_incident'),
      bg: 'rgba(220,38,38,0.08)',
      color: 'var(--destructive)',
    },
    visit: {
      label: t('medical.dashboard.activity.type_visit'),
      bg: 'rgba(37,99,235,0.08)',
      color: 'var(--night-sky-blue)',
    },
  };
  const cfg = configs[kind];
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

/**
 * PriorityBadge — colored pill showing a follow-up's priority level.
 * Colors escalate: low (green) → medium (amber) → high (orange) → urgent (red).
 */
function PriorityBadge({ priority }: { priority: MedicalFollowUp['priority'] }) {
  const { t } = useTranslation();
  const configs: Record<MedicalFollowUp['priority'], { bg: string; color: string }> = {
    urgent: { bg: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' },
    high:   { bg: 'rgba(234,88,12,0.10)',  color: '#ea580c' },
    medium: { bg: 'rgba(217,119,6,0.10)',  color: '#d97706' },
    low:    { bg: 'rgba(22,163,74,0.10)',  color: 'var(--ember-orange)' },
  };
  const cfg = configs[priority];
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {t(`medical.dashboard.followup.priority_${priority}`)}
    </span>
  );
}

// ─── Skeleton blocks ───────────────────────────────────────────────────────────

/**
 * StatsSkeleton — placeholder grid shown while the five stat cards are loading.
 * Prevents layout shift by matching the real grid's column count.
 */
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeletons.Card key={i} />
      ))}
    </div>
  );
}

/**
 * ActivitySkeleton — placeholder rows shown while the activity feed or
 * follow-up list is still loading. Each row pulses to signal loading.
 */
function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-xl animate-pulse"
          style={{ background: 'var(--muted)' }}
        />
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function MedicalDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Stats + follow-ups state
  const [stats, setStats]               = useState<MedicalStats | null>(null);
  const [followUps, setFollowUps]       = useState<MedicalFollowUp[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError]     = useState(false);
  // Incrementing this triggers a re-fetch without changing any other state
  const [statsRetryKey, setStatsRetryKey] = useState(0);
  // Tracks which follow-up is currently being marked complete (to disable its button)
  const [completingId, setCompletingId] = useState<number | null>(null);

  // Campers directory state
  const [camperResponse, setCamperResponse] = useState<PaginatedResponse<Camper> | null>(null);
  const [campersLoading, setCampersLoading] = useState(true);
  const [campersError, setCampersError]     = useState(false);
  const [camperRetryKey, setCamperRetryKey] = useState(0);
  const [search, setSearch]                 = useState('');
  const [camperPage, setCamperPage]         = useState(1);
  // Separate flag so "Load more" doesn't replace the whole grid with a spinner
  const [loadingMore, setLoadingMore]       = useState(false);

  // ── Fetch stats + open follow-ups in parallel ────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(false);
    try {
      // Kick off both requests at the same time instead of waiting for each in turn
      const [statsData, followUpData] = await Promise.all([
        getMedicalStats(),
        getMedicalFollowUps({ status: 'pending', page: 1 }),
      ]);
      setStats(statsData);
      // Also fetch in-progress follow-ups so the panel shows them too
      const inProgressData = await getMedicalFollowUps({ status: 'in_progress', page: 1 });
      // Merge both lists and sort: urgent first, then by due date ascending
      const merged = [...followUpData.data, ...inProgressData.data].sort((a, b) => {
        const priorityOrder: Record<MedicalFollowUp['priority'], number> = {
          urgent: 0, high: 1, medium: 2, low: 3,
        };
        const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pd !== 0) return pd;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
      setFollowUps(merged);
    } catch {
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Re-run fetchStats whenever the retry key changes (incremented on error or after completing a task)
  useEffect(() => { void fetchStats(); }, [fetchStats, statsRetryKey]);

  // ── Fetch campers ─────────────────────────────────────────────────────────────
  /**
   * fetchCampers — loads a page of campers from the API.
   * When `append` is true (Load More), new campers are added to the existing list
   * instead of replacing it, so the user doesn't lose their scroll position.
   */
  const fetchCampers = useCallback(async (page = 1, append = false) => {
    if (!append) setCampersLoading(true);
    else setLoadingMore(true);
    setCampersError(false);
    try {
      const data = await getMedicalCampers({ search: search || undefined, page });
      if (append && camperResponse) {
        // Prepend the existing campers to the new page results
        setCamperResponse({
          ...data,
          data: [...camperResponse.data, ...data.data],
        });
      } else {
        setCamperResponse(data);
      }
    } catch {
      setCampersError(true);
    } finally {
      setCampersLoading(false);
      setLoadingMore(false);
    }
  }, [search, camperRetryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to page 1 whenever the search term or retry key changes
  useEffect(() => {
    setCamperPage(1);
    void fetchCampers(1, false);
  }, [search, camperRetryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mark follow-up complete ───────────────────────────────────────────────────
  /**
   * handleMarkComplete — sends a PATCH to the API, then removes the item from
   * the local list immediately so it disappears without requiring a full reload.
   * Also refreshes the stats counts (overdue/due-today badges update).
   */
  const handleMarkComplete = useCallback(async (id: number) => {
    setCompletingId(id);
    try {
      await updateMedicalFollowUp(id, { status: 'completed' });
      // Remove the completed item from the visible list
      setFollowUps((prev) => prev.filter((f) => f.id !== id));
      // Trigger a stats refresh so the alert strip counts update
      setStatsRetryKey((k) => k + 1);
    } finally {
      setCompletingId(null);
    }
  }, []);

  // ── Load more campers ─────────────────────────────────────────────────────────
  /** handleLoadMore — increments the page counter and appends the next page. */
  const handleLoadMore = useCallback(() => {
    const nextPage = camperPage + 1;
    setCamperPage(nextPage);
    void fetchCampers(nextPage, true);
  }, [camperPage, fetchCampers]);

  // ── Derived data ──────────────────────────────────────────────────────────────
  // Build the merged activity feed from the stats object (client-side only)
  const activityItems = stats ? buildActivity(stats) : [];
  const overdueCount  = stats?.follow_ups.overdue ?? 0;
  const dueTodayCount = stats?.follow_ups.due_today ?? 0;
  // Only show the alert strip after stats have loaded and there's something to show
  const showAlertStrip = (overdueCount > 0 || dueTodayCount > 0) && !statsLoading;

  // True when the API says there are more camper pages available
  const hasMoreCampers =
    camperResponse &&
    camperResponse.meta.current_page < camperResponse.meta.last_page;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={pageEntry}
      initial="hidden"
      animate="visible"
      className="p-6 max-w-7xl space-y-6"
    >
      {/* Page header */}
      <div>
        <h1
          className="font-headline text-xl font-semibold"
          style={{ color: 'var(--foreground)' }}
        >
          {t('medical.dashboard.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {t('medical.dashboard.subtitle')}
        </p>
      </div>

      {/* ── SECTION 1: Stats Bar ────────────────────────────────────────────── */}
      {statsLoading ? (
        <StatsSkeleton />
      ) : statsError ? (
        // Error state with a retry button
        <div
          className="rounded-xl border p-4 flex items-center justify-between"
          style={{ background: 'rgba(220,38,38,0.05)', borderColor: 'rgba(220,38,38,0.2)' }}
        >
          <p className="text-sm" style={{ color: 'var(--destructive)' }}>
            {t('common.error_loading')}
          </p>
          <button
            onClick={() => setStatsRetryKey((k) => k + 1)}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--muted)]"
            style={{ color: 'var(--foreground)' }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('common.retry')}
          </button>
        </div>
      ) : stats ? (
        // Five stat cards that animate in one after another
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
        >
          <motion.div variants={staggerChild}>
            <StatCard
              label={t('medical.dashboard.stats.total_campers')}
              value={stats.campers.total}
              icon={Users}
              color="var(--ember-orange)"
              delay={0}
            />
          </motion.div>
          <motion.div variants={staggerChild}>
            <StatCard
              label={t('medical.dashboard.stats.severe_allergies')}
              value={stats.campers.with_severe_allergies}
              icon={AlertTriangle}
              color="var(--destructive)"
              delay={0.05}
            />
          </motion.div>
          <motion.div variants={staggerChild}>
            <StatCard
              label={t('medical.dashboard.stats.on_medications')}
              value={stats.campers.on_medications}
              icon={Pill}
              color="var(--night-sky-blue)"
              delay={0.1}
            />
          </motion.div>
          <motion.div variants={staggerChild}>
            <StatCard
              label={t('medical.dashboard.stats.active_restrictions')}
              value={stats.campers.with_active_restrictions}
              icon={Shield}
              color="#d97706"
              delay={0.15}
            />
          </motion.div>
          <motion.div variants={staggerChild}>
            <StatCard
              label={t('medical.dashboard.stats.missing_forms')}
              value={stats.campers.missing_medical_record}
              icon={FileX}
              color="var(--ember-orange)"
              delay={0.2}
            />
          </motion.div>
        </motion.div>
      ) : null}

      {/* ── SECTION 2: Alert Strip ──────────────────────────────────────────── */}
      {/* Only rendered when there are overdue or due-today follow-ups to act on */}
      {showAlertStrip && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-wrap gap-3"
        >
          {/* Red button for overdue tasks — clicking navigates to the follow-ups page */}
          {overdueCount > 0 && (
            <motion.button
              variants={staggerChild}
              onClick={() => navigate(ROUTES.MEDICAL_FOLLOW_UPS)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)', border: '1px solid rgba(220,38,38,0.20)' }}
            >
              <AlertOctagon className="h-4 w-4 flex-shrink-0" />
              {t('medical.dashboard.alert.overdue', { count: overdueCount })}
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </motion.button>
          )}
          {/* Amber button for items due today */}
          {dueTodayCount > 0 && (
            <motion.button
              variants={staggerChild}
              onClick={() => navigate(ROUTES.MEDICAL_FOLLOW_UPS)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: 'rgba(217,119,6,0.10)', color: '#d97706', border: '1px solid rgba(217,119,6,0.20)' }}
            >
              <Zap className="h-4 w-4 flex-shrink-0" />
              {t('medical.dashboard.alert.due_today', { count: dueTodayCount })}
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </motion.button>
          )}
        </motion.div>
      )}

      {/* ── SECTION 3: Two-column layout ───────────────────────────────────── */}
      {/* Left column takes 3/5 of the width, right column takes 2/5 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left: Recent Activity (60%) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('medical.dashboard.activity.title')}
            </h2>
          </div>

          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {statsLoading ? (
              <div className="p-4">
                <ActivitySkeleton />
              </div>
            ) : statsError ? (
              <div className="p-6">
                <EmptyState
                  title={t('common.error_loading')}
                  description={t('common.try_again')}
                  action={{ label: t('common.retry'), onClick: () => setStatsRetryKey((k) => k + 1) }}
                />
              </div>
            ) : activityItems.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title={t('medical.dashboard.activity.empty_title')}
                  description={t('medical.dashboard.activity.empty_desc')}
                />
              </div>
            ) : (
              // List of up to 5 activity items, each fading in with a stagger delay
              <motion.ul
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="divide-y"
                style={{ borderColor: 'var(--border)' }}
              >
                {activityItems.map((item) => (
                  <motion.li
                    key={`${item.kind}-${item.id}`}
                    variants={staggerChild}
                    className="flex items-start gap-3 p-4 hover:bg-[var(--muted)] transition-colors"
                  >
                    <ActivityIcon kind={item.kind} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        {/* Camper name links directly to their full medical record */}
                        <Link
                          to={ROUTES.MEDICAL_RECORD_DETAIL(item.camperId)}
                          className="text-sm font-medium hover:underline truncate"
                          style={{ color: 'var(--foreground)' }}
                        >
                          {item.camperName}
                        </Link>
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                          {relativeTime(item.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                        {item.title}
                      </p>
                      <div className="mt-1.5">
                        <ActivityTypeBadge kind={item.kind} />
                      </div>
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </div>
        </div>

        {/* Right: Follow-up Tasks (40%) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('medical.dashboard.followup.title')}
            </h2>
            {/* "View all" link goes to the dedicated follow-ups management page */}
            <Link
              to={ROUTES.MEDICAL_FOLLOW_UPS}
              className="text-xs font-medium flex items-center gap-1 hover:underline"
              style={{ color: 'var(--ember-orange)' }}
            >
              {t('common.view_all')}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {statsLoading ? (
              <div className="p-4">
                <ActivitySkeleton />
              </div>
            ) : statsError ? (
              <div className="p-6">
                <EmptyState
                  title={t('common.error_loading')}
                  description={t('common.try_again')}
                  action={{ label: t('common.retry'), onClick: () => setStatsRetryKey((k) => k + 1) }}
                />
              </div>
            ) : followUps.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title={t('medical.dashboard.followup.empty_title')}
                  description={t('medical.dashboard.followup.empty_desc')}
                />
              </div>
            ) : (
              <motion.ul
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="divide-y"
                style={{ borderColor: 'var(--border)' }}
              >
                {followUps.map((fu) => {
                  const overdue = isOverdue(fu.due_date);
                  const isCompleting = completingId === fu.id;
                  return (
                    <motion.li
                      key={fu.id}
                      variants={staggerChild}
                      className="p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <PriorityBadge priority={fu.priority} />
                        {/* Mark complete button — disabled while the API call is in flight */}
                        <button
                          onClick={() => void handleMarkComplete(fu.id)}
                          disabled={isCompleting}
                          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
                          style={{ color: 'var(--ember-orange)' }}
                          title={t('medical.dashboard.followup.mark_complete')}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {isCompleting
                            ? t('common.saving')
                            : t('medical.dashboard.followup.complete')}
                        </button>
                      </div>
                      <p className="text-sm font-medium leading-snug" style={{ color: 'var(--foreground)' }}>
                        {fu.title}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        {/* Camper name links to their medical record */}
                        <Link
                          to={ROUTES.MEDICAL_RECORD_DETAIL(fu.camper_id)}
                          className="text-xs hover:underline truncate"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          {fu.camper?.full_name ?? t('common.unknown')}
                        </Link>
                        {/* Due date turns red if the task is overdue */}
                        <span
                          className="text-xs flex-shrink-0 font-medium"
                          style={{ color: overdue ? 'var(--destructive)' : 'var(--muted-foreground)' }}
                        >
                          {overdue
                            ? t('medical.dashboard.followup.overdue_label', { date: formatDueDate(fu.due_date) })
                            : formatDueDate(fu.due_date)}
                        </span>
                      </div>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 4: Camper Medical Directory ────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-headline text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            {t('medical.dashboard.directory.title')}
          </h2>

          {/* Search box — typing here triggers a new server-side fetch automatically */}
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 border w-full sm:max-w-xs"
            style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
          >
            <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('medical.dashboard.search_placeholder')}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--foreground)' }}
            />
          </div>
        </div>

        {campersLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeletons.Card key={i} />)}
          </div>
        ) : campersError ? (
          <EmptyState
            title={t('common.error_loading')}
            description={t('common.try_again')}
            action={{ label: t('common.retry'), onClick: () => setCamperRetryKey((k) => k + 1) }}
          />
        ) : !camperResponse || camperResponse.data.length === 0 ? (
          <EmptyState
            title={t('medical.dashboard.empty_title')}
            description={t('medical.dashboard.empty_desc')}
          />
        ) : (
          <>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {camperResponse.data.map((camper: Camper) => {
                // Derive summary counts from the nested medical_record object
                const allergyCount = camper.medical_record?.allergies?.length ?? 0;
                const medCount     = camper.medical_record?.medications?.length ?? 0;
                // Life-threatening allergy flag changes the card's border color to red
                const hasLifeThreatening = camper.medical_record?.allergies?.some(
                  (a) => a.severity === 'life-threatening'
                );
                const primaryDx = camper.medical_record?.primary_diagnosis;

                return (
                  <motion.div key={camper.id} variants={staggerChild}>
                    <div
                      className="rounded-xl border overflow-hidden transition-shadow hover:shadow-md"
                      style={{
                        background: 'var(--glass-medium)',
                        // Cards with a life-threatening allergy get a thicker red left border
                        borderColor: hasLifeThreatening ? 'rgba(220,38,38,0.25)' : 'var(--border)',
                        borderLeftWidth: hasLifeThreatening ? '3px' : '1px',
                        borderLeftColor: hasLifeThreatening ? 'var(--destructive)' : 'var(--border)',
                        backdropFilter: 'blur(12px)',
                      }}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          {/* Icon changes to a red warning triangle for campers with life-threatening allergies */}
                          <div
                            className="flex items-center justify-center w-9 h-9 rounded-xl"
                            style={{
                              background: hasLifeThreatening
                                ? 'rgba(220,38,38,0.10)'
                                : 'rgba(22,163,74,0.10)',
                            }}
                          >
                            {hasLifeThreatening
                              ? <AlertTriangle className="h-4 w-4" style={{ color: 'var(--destructive)' }} />
                              : <Stethoscope className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
                            }
                          </div>
                        </div>

                        <p className="font-medium text-sm mb-1" style={{ color: 'var(--foreground)' }}>
                          {camper.full_name}
                        </p>

                        {/* Show the camper's primary diagnosis if one exists */}
                        {primaryDx && (
                          <p className="text-xs mb-3 truncate" style={{ color: 'var(--muted-foreground)' }}>
                            {primaryDx}
                          </p>
                        )}

                        {/* Summary pills for allergies and medications */}
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                          {allergyCount > 0 && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: hasLifeThreatening
                                  ? 'rgba(220,38,38,0.10)'
                                  : 'rgba(22,163,74,0.08)',
                                color: hasLifeThreatening
                                  ? 'var(--destructive)'
                                  : 'var(--ember-orange)',
                              }}
                            >
                              {allergyCount} {t('medical.dashboard.allergies')}
                            </span>
                          )}
                          {medCount > 0 && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: 'rgba(37,99,235,0.08)',
                                color: 'var(--night-sky-blue)',
                              }}
                            >
                              {medCount} {t('medical.dashboard.meds')}
                            </span>
                          )}

                        </div>

                        {/* Two action buttons: full record view, and emergency quick view */}
                        <div className="flex items-center gap-2">
                          <Link
                            to={ROUTES.MEDICAL_RECORD_DETAIL(camper.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg transition-colors hover:bg-[var(--muted)]"
                            style={{
                              color: 'var(--foreground)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {t('medical.dashboard.directory.view_record')}
                          </Link>
                          {/* Emergency view link — color matches severity (red if life-threatening) */}
                          <Link
                            to={ROUTES.MEDICAL_RECORD_EMERGENCY(camper.id)}
                            className="flex items-center justify-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                            style={{
                              background: hasLifeThreatening
                                ? 'rgba(220,38,38,0.10)'
                                : 'rgba(22,163,74,0.10)',
                              color: hasLifeThreatening
                                ? 'var(--destructive)'
                                : 'var(--ember-orange)',
                              border: `1px solid ${hasLifeThreatening ? 'rgba(220,38,38,0.20)' : 'rgba(22,163,74,0.15)'}`,
                            }}
                            title={t('medical.dashboard.directory.emergency_view')}
                          >
                            <Zap className="h-3 w-3" />
                            {t('medical.dashboard.directory.emergency')}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Load more button — only appears when there is a next page */}
            {hasMoreCampers && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
                  style={{
                    color: 'var(--foreground)',
                    borderColor: 'var(--border)',
                    background: 'var(--card)',
                  }}
                >
                  {loadingMore ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    t('medical.dashboard.directory.load_more')
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
