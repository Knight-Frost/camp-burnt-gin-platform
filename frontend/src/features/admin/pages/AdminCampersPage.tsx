/**
 * AdminCampersPage.tsx
 *
 * Purpose: A searchable, paginated table of all registered campers for admins.
 * Route: /admin/campers (also shared by super-admin at /super-admin/campers)
 *
 * Responsibilities:
 *  - Fetch a paginated list of campers from the API.
 *  - Let admins search by name; page resets to 1 when the search term changes.
 *  - Display each camper's DOB, assigned session, a risk/compliance indicator, and a View link.
 *  - Works for both /admin and /super-admin prefixes — detects which from the URL.
 *
 * Plain-English summary:
 *  This is a directory of every camper in the system. You can type a name in the
 *  search box and the list narrows down. Click any row to see the full camper profile.
 *  The page number resets whenever you change the search so you always start at page 1.
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { format } from 'date-fns';

import { getCampers } from '@/features/admin/api/admin.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import type { Camper } from '@/features/admin/types/admin.types';
import type { PaginatedResponse } from '@/shared/types/api.types';

export function AdminCampersPage() {
  const { t } = useTranslation();
  const location = useLocation();

  // Detect whether we're inside /super-admin or /admin to build correct detail links.
  const camperBase = location.pathname.startsWith('/super-admin') ? '/super-admin/campers' : '/admin/campers';

  // ── State ──────────────────────────────────────────────────────────────────

  // The server returns a PaginatedResponse with a `data` array and `meta` (total, page info).
  const [response, setResponse] = useState<PaginatedResponse<Camper> | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  // Consolidated filters — single object prevents the double-fetch race that occurs when
  // search changes reset `page` via a separate useEffect (which would fire fetchCampers twice).
  const [filters, setFilters]   = useState({ search: '', page: 1 });
  // retryKey is incremented by the error-state retry button to re-trigger the fetch effect.
  const [retryKey, setRetryKey] = useState(0);

  // searchInput is the controlled input value; `filters.search` is the debounced API value.
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Search input handler with debounce ────────────────────────────────────

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Reset to page 1 atomically with the new search term — single state update,
      // single fetchCampers reference change, single API call.
      setFilters({ search: value, page: 1 });
    }, 300);
  }

  // ── Data fetching ──────────────────────────────────────────────────────────

  // Inline async effect with a cancelled flag so setState is never called on an unmounted
  // component (e.g. when the user switches tabs quickly mid-flight).
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!cancelled) setLoading(true);
      if (!cancelled) setError(false);
      try {
        const data = await getCampers({ page: filters.page, search: filters.search || undefined });
        if (!cancelled) setResponse(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    // Cleanup: ignore the in-flight response if the component unmounts before it settles.
    return () => { cancelled = true; };
  }, [filters, retryKey]); // Depend on data, not the callback reference.

  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('admin.campers.title')}
        </h1>
        {/* Show the total camper count from the paginated meta once loaded. */}
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {response && t('admin.campers.subtitle', { total: response.meta.total })}
        </p>
      </div>

      {/* Search box */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2 border mb-6 max-w-sm"
        style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
      >
        <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
        <input
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t('admin.campers.search_placeholder')}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--foreground)' }}
        />
      </div>

      {/* Conditional rendering: loading → error → empty → table */}
      {loading ? (
        // Show skeleton rows while the API call is in flight.
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeletons.Row key={i} />)}
        </div>
      ) : error ? (
        <EmptyState
          title={t('common.error_loading')}
          description={t('common.try_again')}
          action={{ label: t('common.retry'), onClick: () => setRetryKey((k) => k + 1) }}
        />
      ) : !response || response.data.length === 0 ? (
        <EmptyState title={t('admin.campers.empty_title')} description={t('admin.campers.empty_desc')} />
      ) : (
        <>
          {/* Camper table */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Table header row */}
            <div
              className="grid grid-cols-12 px-4 py-3 text-xs font-medium uppercase tracking-wide border-b"
              style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              <div className="col-span-4">{t('admin.campers.col_name')}</div>
              <div className="col-span-2">{t('admin.campers.col_dob')}</div>
              <div className="col-span-3">{t('admin.campers.col_session')}</div>
              <div className="col-span-2">{t('admin.campers.col_risk')}</div>
              <div className="col-span-1" />
            </div>

            {/* One row per camper */}
            {response.data.map((camper) => {
              // Take the first (most recent) application to show session info.
              const latestApp = camper.applications?.[0];
              return (
                <div
                  key={camper.id}
                  className="grid grid-cols-12 items-center px-4 py-3.5 border-b last:border-b-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="col-span-4">
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {camper.full_name}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {camper.date_of_birth
                        ? format(new Date(camper.date_of_birth), 'MMM d, yyyy')
                        : t('common.not_provided')}
                    </p>
                  </div>
                  <div className="col-span-3">
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {latestApp?.session?.name ?? t('common.none')}
                    </p>
                  </div>
                  <div className="col-span-2">
                    {/* Links to the camper detail page, using the correct prefix for the portal. */}
                    <Link
                      to={`${camperBase}/${camper.id}`}
                      className="inline-flex items-center gap-1 text-xs"
                      style={{ color: 'var(--night-sky-blue)' }}
                    >
                      <Shield className="h-3 w-3" />
                      {t('admin.campers.view_risk')}
                    </Link>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Link
                      to={`${camperBase}/${camper.id}`}
                      className="text-xs px-2.5 py-1 rounded border transition-colors"
                      style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      {t('common.view')}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination controls — only show when there is more than one page. */}
          {response.meta.last_page > 1 && (
            <div className="flex items-center justify-between mt-4">
              {/* Shows "1–15 of 42" style text. */}
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {t('common.pagination', {
                  from: (filters.page - 1) * response.meta.per_page + 1,
                  to: Math.min(filters.page * response.meta.per_page, response.meta.total),
                  total: response.meta.total,
                })}
              </p>
              <div className="flex items-center gap-2">
                {/* Previous page — disabled on page 1. */}
                <button
                  onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                  disabled={filters.page === 1}
                  className="p-1.5 rounded-lg border disabled:opacity-40"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <ChevronLeft className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
                </button>
                <span className="text-sm px-2" style={{ color: 'var(--foreground)' }}>
                  {filters.page} / {response.meta.last_page}
                </span>
                {/* Next page — disabled on the last page. */}
                <button
                  onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                  disabled={filters.page === response.meta.last_page}
                  className="p-1.5 rounded-lg border disabled:opacity-40"
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
