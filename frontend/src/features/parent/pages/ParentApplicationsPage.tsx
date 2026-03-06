/**
 * ParentApplicationsPage.tsx
 * Lists all applications for the current applicant's campers.
 * Supports filtering by status, sorting by date, and active/past grouping.
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

import { getApplications } from '@/features/parent/api/parent.api';
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

type ViewMode = 'all' | 'active' | 'past';
type SortOrder = 'newest' | 'oldest';

const ACTIVE_STATUSES: ApplicationStatus[] = ['draft', 'submitted', 'under_review', 'waitlisted'];
const PAST_STATUSES: ApplicationStatus[]   = ['accepted', 'rejected', 'withdrawn'];

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft:        'Draft',
  submitted:    'Submitted',
  under_review: 'Under Review',
  accepted:     'Accepted',
  rejected:     'Rejected',
  waitlisted:   'Waitlisted',
  withdrawn:    'Withdrawn',
};

function sortApps(apps: Application[], order: SortOrder): Application[] {
  return [...apps].sort((a, b) => {
    const dateA = new Date(a.submitted_at ?? a.created_at ?? '').getTime();
    const dateB = new Date(b.submitted_at ?? b.created_at ?? '').getTime();
    return order === 'newest' ? dateB - dateA : dateA - dateB;
  });
}

function AppCard({ app }: { app: Application }) {
  const navigate = useNavigate();
  return (
    <motion.li variants={staggerChildVariants} {...cardHoverMotion}>
      <div className="flex items-center justify-between gap-4 px-6 py-4">
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
          {(app.status === 'accepted' || app.status === 'rejected') && app.camper && (
            <button
              onClick={() =>
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

function AppGroup({
  title,
  apps,
}: {
  title: string;
  apps: Application[];
}) {
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

export function ParentApplicationsPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(false);
  const [view, setView]                 = useState<ViewMode>('all');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | ''>('');
  const [sortOrder, setSortOrder]       = useState<SortOrder>('newest');

  const load = () => {
    setLoading(true);
    setError(false);
    getApplications()
      .then(setApplications)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = applications;
    if (statusFilter) {
      list = list.filter((a) => a.status === statusFilter);
    } else if (view === 'active') {
      list = list.filter((a) => ACTIVE_STATUSES.includes(a.status));
    } else if (view === 'past') {
      list = list.filter((a) => PAST_STATUSES.includes(a.status));
    }
    return sortApps(list, sortOrder);
  }, [applications, statusFilter, view, sortOrder]);

  const activeApps = useMemo(
    () => filtered.filter((a) => ACTIVE_STATUSES.includes(a.status)),
    [filtered]
  );
  const pastApps = useMemo(
    () => filtered.filter((a) => PAST_STATUSES.includes(a.status)),
    [filtered]
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View toggle */}
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
                background: view === v ? 'var(--ember-orange)' : 'transparent',
                color: view === v ? '#fff' : 'var(--muted-foreground)',
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Status filter */}
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

        {/* Sort */}
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

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <SkeletonTable rows={5} />
        </div>
      ) : error ? (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <ErrorState onRetry={load} />
        </div>
      ) : filtered.length === 0 ? (
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
        <AnimatePresence mode="wait">
          <div className="flex flex-col gap-4">
            {view === 'all' && !statusFilter ? (
              <>
                <AppGroup title="Active Applications" apps={activeApps} />
                <AppGroup title="Past Applications" apps={pastApps} />
              </>
            ) : (
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
