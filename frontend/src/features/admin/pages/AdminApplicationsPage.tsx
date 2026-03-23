/**
 * AdminApplicationsPage.tsx
 *
 * Purpose: Paginated, filterable list of all camp applications for admins.
 * Route: /admin/applications (also /super-admin/applications)
 *
 * Responsibilities:
 *  - Fetch a paginated list of applications from the API, with optional search & status filters.
 *  - Let admins search by camper name and filter by application status (pending, approved, etc.).
 *  - Show each application's camper name, session, submission date, status badge, and a Review link.
 *
 * Plain-English summary:
 *  This is the master list of every application. Admins can search or narrow by status to find
 *  specific applications quickly. All three filter values (search, status, page) are stored in one
 *  `filters` object so they always stay in sync and only trigger a single fetch when any of them change.
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Filter, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

import { getApplications } from '@/features/admin/api/admin.api';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import type { Application } from '@/features/admin/types/admin.types';
import type { PaginatedResponse } from '@/shared/types/api.types';
import { useSessionWorkspace } from '@/features/sessions/context/SessionWorkspaceContext';
import { SessionHeroBanner } from '@/features/sessions/components/SessionHeroBanner';

// All possible status filter values — 'all' means no filter is applied.
const STATUS_FILTERS = ['all', 'pending', 'under_review', 'approved', 'waitlisted', 'rejected', 'cancelled'] as const;

// Consolidated filter state — session scoping comes from the workspace context, not a dropdown.
interface Filters {
  search: string;
  status: string;
  page: number;
}

export function AdminApplicationsPage() {
  const { t } = useTranslation();
  const location = useLocation();

  // Build the correct link prefix depending on whether we're in admin or super-admin.
  const reviewBase = location.pathname.startsWith('/super-admin') ? '/super-admin/applications' : '/admin/applications';

  // Session workspace drives the scope of this page.
  // URL param ?camp_session_id=X takes precedence (deep-link from SessionDetailPage);
  // otherwise the global workspace session scopes the data.
  const sessionCtx = useSessionWorkspace();
  const urlParams  = new URLSearchParams(location.search);
  const urlSession = urlParams.get('camp_session_id');
  const workspaceSessionId = urlSession
    ? Number(urlSession)
    : (sessionCtx?.currentSession?.id ?? undefined);

  // ── State ──────────────────────────────────────────────────────────────────

  const [response, setResponse] = useState<PaginatedResponse<Application> | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [filters, setFilters]   = useState<Filters>({ search: '', status: 'all', page: 1 });
  const [retryKey, setRetryKey] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Filter helpers ─────────────────────────────────────────────────────────

  function setSearch(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: value, page: 1 }));
    }, 300);
  }
  const setStatus = (status: string) => setFilters((f) => ({ ...f, status, page: 1 }));
  const setPage   = (page: number)   => setFilters((f) => ({ ...f, page }));

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!cancelled) setLoading(true);
      if (!cancelled) setError(false);
      try {
        const data = await getApplications({
          page: filters.page,
          search: filters.search || undefined,
          status: filters.status === 'all' ? undefined : filters.status,
          camp_session_id: workspaceSessionId,
        });
        if (!cancelled) setResponse(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => { cancelled = true; };
  }, [filters, workspaceSessionId, retryKey]);

  return (
    <div className="p-6 max-w-7xl">
      {/* Session hero banner — unconditionally rendered.
          The component owns its own visibility: it returns null outside admin portals
          and switches between global and session mode internally.
          Never guarded here so it cannot be suppressed by a falsy context check. */}
      <div
        key={sessionCtx?.isGlobalMode ? 'global' : (sessionCtx?.currentSession?.id ?? 'loading')}
        className="-mt-6 -mx-6 lg:-mt-8 lg:-mx-8 mb-6"
      >
        <SessionHeroBanner />
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('admin.applications.title')}
        </h1>
        {/* Total count from meta — only shown once the first response arrives. */}
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {response && t('admin.applications.subtitle', { total: response.meta.total })}
        </p>
      </div>

      {/* Filters row: search box + status dropdown */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div
          className="flex items-center gap-2 flex-1 rounded-lg px-3 py-2 border"
          style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
        >
          <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={searchInput}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.applications.search_placeholder')}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--foreground)' }}
          />
        </div>

        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 border"
          style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
        >
          <Filter className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          <select
            value={filters.status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-transparent text-sm outline-none"
            style={{ color: 'var(--foreground)' }}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s} style={{ background: 'var(--card)' }}>
                {t(`admin.applications.filter_${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table: shows skeletons → error → empty state → rows */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeletons.Row key={i} />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title={t('common.error_loading')}
          description={t('common.try_again')}
          action={{ label: t('common.retry'), onClick: () => setRetryKey((k) => k + 1) }}
        />
      ) : !response || response.data.length === 0 ? (
        <EmptyState
          title={t('admin.applications.empty_title')}
          description={t('admin.applications.empty_desc')}
        />
      ) : (
        <>
          {/* Table container */}
          <div
            className="glass-data rounded-xl overflow-hidden"
          >
            {/* Column header */}
            <div
              className="grid grid-cols-12 px-4 py-3 text-xs font-medium uppercase tracking-wide border-b"
              style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              <div className="col-span-3">{t('admin.applications.col_camper')}</div>
              <div className="col-span-3">{t('admin.applications.col_session')}</div>
              <div className="col-span-2">{t('admin.applications.col_submitted')}</div>
              <div className="col-span-2">{t('admin.applications.col_status')}</div>
              <div className="col-span-2 text-right">{t('admin.applications.col_action')}</div>
            </div>

            {/* One row per application */}
            {response.data.map((app) => (
              <div
                key={app.id}
                className="grid grid-cols-12 items-center px-4 py-3.5 border-b last:border-b-0 transition-colors"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="col-span-3">
                  {/* Show full_name if the camper relation is loaded, else fall back to ID. */}
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {app.camper?.full_name ?? `Camper #${app.camper_id}`}
                  </p>
                </div>
                <div className="col-span-3">
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {app.session?.name ?? `Session #${app.camp_session_id}`}
                  </p>
                  {/* Show parent camp name as a sub-label if available. */}
                  {app.session?.camp && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {app.session.camp.name}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {app.submitted_at
                      ? format(new Date(app.submitted_at), 'MMM d, yyyy')
                      : t('common.not_submitted')}
                  </p>
                </div>
                <div className="col-span-2">
                  <StatusBadge status={app.status} />
                </div>
                <div className="col-span-2 flex justify-end">
                  {/* Review link navigates to the full ApplicationReviewPage for this application. */}
                  <Link
                    to={`${reviewBase}/${app.id}`}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all"
                    style={{
                      borderColor: 'var(--ember-orange)',
                      color: 'var(--ember-orange)',
                    }}
                  >
                    {t('common.review')}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination controls — hidden when everything fits on one page. */}
          {response.meta.last_page > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {t('common.pagination', {
                  from: (response.meta.current_page - 1) * response.meta.per_page + 1,
                  to: Math.min(response.meta.current_page * response.meta.per_page, response.meta.total),
                  total: response.meta.total,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(filters.page - 1)}
                  disabled={filters.page === 1}
                  className="p-1.5 rounded-lg border disabled:opacity-40 transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <ChevronLeft className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
                </button>
                <span className="text-sm px-2" style={{ color: 'var(--foreground)' }}>
                  {filters.page} / {response.meta.last_page}
                </span>
                <button
                  onClick={() => setPage(filters.page + 1)}
                  disabled={filters.page === response.meta.last_page}
                  className="p-1.5 rounded-lg border disabled:opacity-40 transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <ChevronRight className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
