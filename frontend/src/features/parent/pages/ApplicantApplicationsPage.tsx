/**
 * ApplicantApplicationsPage.tsx
 *
 * Purpose: Lists all applications for the current applicant's campers.
 * Responsibilities:
 *   - Fetch all applications from the API on mount
 *   - Detect a locally-saved draft in localStorage and surface a "Continue" card
 *   - Allow filtering by view mode (all / active / past) and by specific status
 *   - Sort the filtered list newest-first or oldest-first
 *   - Render applications in grouped sections: Drafts, Active, Past
 *   - Offer a "Re-apply" button on resolved applications that pre-fills camper info
 *
 * Plain-English: This is the parent's filing cabinet — every application they've
 * ever started or submitted lives here, organized so the ones that still need
 * attention are easy to find at the top.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  FileText,
  ArrowRight,
  Calendar,
  RefreshCw,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import { format } from 'date-fns';

import { getApplications } from '@/features/parent/api/applicant.api';
import type { Application, ApplicationStatus } from '@/shared/types';
import type { CamperInfoValues } from '@/features/parent/schemas/application.schema';
import { ROUTES } from '@/shared/constants/routes';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EmptyState } from '@/ui/components/EmptyState';
import { ErrorState } from '@/ui/components/EmptyState';
import { SkeletonTable } from '@/ui/components/Skeletons';
import { Button } from '@/ui/components/Button';
import {
  staggerContainerVariants,
  staggerChildVariants,
  cardHoverMotion,
} from '@/shared/constants/motion';

// localStorage key where ApplicationFormPage auto-saves in-progress drafts
const LOCAL_DRAFT_KEY = 'cbg_app_draft';

type ViewMode = 'all' | 'active' | 'past';
type SortOrder = 'newest' | 'oldest';

// Statuses that mean the application is still in flight and needs monitoring
const ACTIVE_STATUSES: ApplicationStatus[] = ['pending', 'under_review', 'waitlisted'];
// Statuses that mean the process is finished (one way or another)
const PAST_STATUSES: ApplicationStatus[]   = ['approved', 'rejected', 'withdrawn', 'cancelled'];

// Human-readable labels for each machine status value used in the filter dropdown
const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft:        'Draft',
  pending:      'Pending',
  under_review: 'Under Review',
  approved:     'Approved',
  rejected:     'Rejected',
  waitlisted:   'Waitlisted',
  withdrawn:    'Withdrawn',
  cancelled:    'Cancelled',
};

// Sort a copy of the list so we never mutate the original state array
function sortApps(apps: Application[], order: SortOrder): Application[] {
  return [...apps].sort((a, b) => {
    // Fall back to created_at if the application hasn't been submitted yet
    const dateA = new Date(a.submitted_at ?? a.created_at ?? '').getTime();
    const dateB = new Date(b.submitted_at ?? b.created_at ?? '').getTime();
    return order === 'newest' ? dateB - dateA : dateA - dateB;
  });
}

// Single application row — a card that links to the detail page
function AppCard({ app }: { app: Application }) {
  const navigate = useNavigate();
  return (
    <motion.li variants={staggerChildVariants} {...cardHoverMotion}>
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        {/* The entire left side is a link to the detail page */}
        <Link
          to={ROUTES.PARENT_APPLICATION_DETAIL(app.id)}
          className="flex items-center gap-4 min-w-0 flex-1 hover:bg-[var(--dash-nav-hover-bg)] rounded-lg transition-colors -mx-2 px-2 py-1"
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(96,165,250,0.1)' }}
          >
            <FileText className="h-4 w-4" style={{ color: 'var(--night-sky-blue)' }} />
          </div>
          <div className="min-w-0">
            {/* Fall back to a generic label if the camper was not eager-loaded */}
            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
              {app.camper?.full_name ?? `Camper #${app.camper_id}`}
            </p>
            <div
              className="flex items-center gap-2 text-xs mt-0.5"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <Calendar className="h-3 w-3" />
              <span>{app.session?.name ?? `Session #${app.session_id}`}</span>
              {app.submitted_at && (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span>Submitted {format(new Date(app.submitted_at), 'MMM d, yyyy')}</span>
                </>
              )}
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-3 flex-shrink-0">
          <StatusBadge status={app.status} />
          {/* Re-apply button shown only when the application reached a terminal state */}
          {(app.status === 'approved' || app.status === 'rejected' || app.status === 'cancelled') && app.camper && (
            <button
              onClick={() =>
                // Navigate to the new application form and pre-fill camper details
                navigate(ROUTES.PARENT_APPLICATION_NEW, {
                  state: {
                    prefill: {
                      first_name:    app.camper!.first_name,
                      last_name:     app.camper!.last_name,
                      date_of_birth: app.camper!.date_of_birth,
                      gender:        app.camper!.gender as CamperInfoValues['gender'],
                      tshirt_size:   app.camper!.tshirt_size as CamperInfoValues['tshirt_size'],
                    } satisfies Partial<CamperInfoValues>,
                  },
                })
              }
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors hover:border-[var(--ember-orange)]"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              title="Re-apply with same camper info"
            >
              <RefreshCw className="h-3 w-3" />
              Re-apply
            </button>
          )}
          <Link to={ROUTES.PARENT_APPLICATION_DETAIL(app.id)}>
            <ArrowRight className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </Link>
        </div>
      </div>
    </motion.li>
  );
}

// A labeled section card grouping a set of application rows under a title
function AppGroup({
  title,
  apps,
}: {
  title: string;
  apps: Application[];
}) {
  // Render nothing when there are no apps in this group — avoids empty section headers
  if (apps.length === 0) return null;
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div
        className="px-6 py-3 border-b"
        style={{ background: 'var(--dash-bg)', borderColor: 'var(--border)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
          {title}
        </span>
        {/* Count badge next to the section title */}
        <span
          className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          {apps.length}
        </span>
      </div>
      <motion.ul
        variants={staggerContainerVariants}
        initial="hidden"
        animate="visible"
        className="divide-y"
        style={{ borderColor: 'var(--border)' }}
      >
        {apps.map((app) => <AppCard key={app.id} app={app} />)}
      </motion.ul>
    </div>
  );
}

// Special card shown when a localStorage draft is detected (not yet submitted to the server)
function LocalDraftCard({ camperName }: { camperName: string | null }) {
  const navigate = useNavigate();
  return (
    // Ember-orange border draws the eye to this unfinished draft
    <div
      className="flex items-center justify-between gap-4 px-6 py-4 rounded-2xl border"
      style={{ background: 'var(--card)', borderColor: 'var(--ember-orange)' }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(22,101,52,0.10)' }}
        >
          <FileText className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {/* Show the camper name parsed from the draft, or a generic label */}
            {camperName ? `Draft — ${camperName}` : 'Application draft (in progress)'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Saved locally · Not yet submitted
          </p>
        </div>
      </div>
      {/* "Continue" navigates back to the form, which re-hydrates from localStorage */}
      <Button size="sm" onClick={() => navigate(ROUTES.PARENT_APPLICATION_NEW)}>
        Continue
      </Button>
    </div>
  );
}

export function ApplicantApplicationsPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(false);
  // View mode: 'all' shows all groups, 'active' only in-flight, 'past' only resolved
  const [view, setView]                 = useState<ViewMode>('all');
  // Specific status filter (overrides view mode when set)
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | ''>('');
  const [sortOrder, setSortOrder]       = useState<SortOrder>('newest');
  // Holds camper name parsed from localStorage draft if one exists
  const [localDraft, setLocalDraft]     = useState<{ camperName: string | null } | null>(null);

  // On mount, try to read the local draft key and extract the camper's name
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { s1?: { camper_first_name?: string; camper_last_name?: string } };
      const first = (parsed.s1?.camper_first_name ?? '').trim();
      const last  = (parsed.s1?.camper_last_name  ?? '').trim();
      setLocalDraft({ camperName: first || last ? `${first} ${last}`.trim() : null });
    } catch { /* ignore corrupt draft */ }
  }, []);

  // Fetch all applications; the load function is also passed to ErrorState for retry
  const load = () => {
    setLoading(true);
    setError(false);
    getApplications()
      .then(setApplications)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Derive the filtered + sorted list without modifying state directly (useMemo)
  const filtered = useMemo(() => {
    let list = applications;
    if (statusFilter === 'draft') {
      // Drafts are flagged via is_draft rather than having a unique status value
      list = list.filter((a) => a.is_draft === true);
    } else if (statusFilter) {
      list = list.filter((a) => a.status === statusFilter && !a.is_draft);
    } else if (view === 'active') {
      list = list.filter((a) => ACTIVE_STATUSES.includes(a.status) && !a.is_draft);
    } else if (view === 'past') {
      list = list.filter((a) => PAST_STATUSES.includes(a.status));
    }
    return sortApps(list, sortOrder);
  }, [applications, statusFilter, view, sortOrder]);

  // Pre-split the filtered list into three groups for the sectioned "all" view
  const draftApps = useMemo(
    () => filtered.filter((a) => a.is_draft === true),
    [filtered]
  );
  const activeApps = useMemo(
    () => filtered.filter((a) => ACTIVE_STATUSES.includes(a.status) && !a.is_draft),
    [filtered]
  );
  const pastApps = useMemo(
    () => filtered.filter((a) => PAST_STATUSES.includes(a.status)),
    [filtered]
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
            Applications
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Track the status of your camper applications.
          </p>
        </div>
        <Button as={Link} to={ROUTES.PARENT_APPLICATION_NEW} size="sm">
          <Plus className="h-4 w-4" />
          New application
        </Button>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View mode toggle — clears status filter when switching modes */}
        <div
          className="flex rounded-xl border p-0.5"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {(['all', 'active', 'past'] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setView(v); setStatusFilter(''); }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg capitalize transition-colors"
              style={{
                // Highlighted button gets the brand color; inactive buttons are transparent
                background: view === v ? 'var(--ember-orange)' : 'transparent',
                color: view === v ? '#fff' : 'var(--muted-foreground)',
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Status dropdown — selecting a status overrides the view mode grouping */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | '')}
            className="appearance-none text-xs pl-3 pr-7 py-1.5 rounded-xl border outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3" style={{ color: 'var(--muted-foreground)' }} />
        </div>

        {/* Sort order dropdown */}
        <div className="relative">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="appearance-none text-xs pl-3 pr-7 py-1.5 rounded-xl border outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3" style={{ color: 'var(--muted-foreground)' }} />
        </div>

        {/* Reset button appears only when a non-default filter is active */}
        {(statusFilter || view !== 'all') && (
          <button
            type="button"
            onClick={() => { setStatusFilter(''); setView('all'); setSortOrder('newest'); }}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* Main content area */}
      {loading ? (
        <div className="rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <SkeletonTable rows={5} />
        </div>
      ) : error ? (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <ErrorState onRetry={load} />
        </div>
      ) : filtered.length === 0 && !(statusFilter === 'draft' && localDraft) ? (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <EmptyState
            title={applications.length === 0 ? 'No applications yet' : 'No matching applications'}
            description={
              applications.length === 0
                ? 'Submit an application to register a camper for a session.'
                : 'Try adjusting the filters to see more results.'
            }
            icon={FileText}
            action={
              applications.length === 0
                ? { label: 'Start your first application', onClick: () => navigate(ROUTES.PARENT_APPLICATION_NEW) }
                : undefined
            }
          />
        </div>
      ) : (
        // AnimatePresence lets the list animate out when filters change
        <AnimatePresence mode="wait">
          <div className="flex flex-col gap-4">
            {view === 'all' && !statusFilter ? (
              // Default grouped view: Drafts → Active → Past sections
              <>
                {(draftApps.length > 0 || localDraft) && (
                  <div className="flex flex-col gap-3">
                    <div className="px-1">
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                        Drafts
                      </span>
                    </div>
                    {/* LocalDraftCard appears first when a localStorage draft exists */}
                    {localDraft && <LocalDraftCard camperName={localDraft.camperName} />}
                    {draftApps.length > 0 && (
                      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                        <motion.ul
                          variants={staggerContainerVariants}
                          initial="hidden"
                          animate="visible"
                          className="divide-y"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          {draftApps.map((app) => <AppCard key={app.id} app={app} />)}
                        </motion.ul>
                      </div>
                    )}
                  </div>
                )}
                <AppGroup title="Active Applications" apps={activeApps} />
                <AppGroup title="Past Applications" apps={pastApps} />
              </>
            ) : statusFilter === 'draft' ? (
              // When "Draft" is selected in the status filter, show local draft + server drafts
              <div className="flex flex-col gap-3">
                {localDraft && <LocalDraftCard camperName={localDraft.camperName} />}
                {filtered.length > 0 && (
                  <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <motion.ul
                      variants={staggerContainerVariants}
                      initial="hidden"
                      animate="visible"
                      className="divide-y"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      {filtered.map((app) => <AppCard key={app.id} app={app} />)}
                    </motion.ul>
                  </div>
                )}
              </div>
            ) : (
              // Flat list when a specific status or view mode filter is active
              <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <motion.ul
                  variants={staggerContainerVariants}
                  initial="hidden"
                  animate="visible"
                  className="divide-y"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {filtered.map((app) => <AppCard key={app.id} app={app} />)}
                </motion.ul>
              </div>
            )}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
