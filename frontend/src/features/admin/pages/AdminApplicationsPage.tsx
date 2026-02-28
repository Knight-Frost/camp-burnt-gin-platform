/**
 * AdminApplicationsPage.tsx
 *
 * Paginated, filterable list of all applications for admins.
 * Route: /admin/applications
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, Filter, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

import { getApplications } from '@/features/admin/api/admin.api';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { pageEntry, staggerContainer, staggerChild } from '@/shared/constants/motion';
import type { Application } from '@/features/admin/types/admin.types';
import type { PaginatedResponse } from '@/shared/types/api.types';

const STATUS_FILTERS = ['all', 'pending', 'submitted', 'under_review', 'accepted', 'rejected'] as const;

interface Filters {
  search: string;
  status: string;
  page: number;
}

export function AdminApplicationsPage() {
  const { t } = useTranslation();

  const [response, setResponse] = useState<PaginatedResponse<Application> | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [filters, setFilters]   = useState<Filters>({ search: '', status: 'all', page: 1 });

  // Helpers — reset page to 1 whenever a non-pagination filter changes
  const setSearch = (search: string) => setFilters((f) => ({ ...f, search, page: 1 }));
  const setStatus = (status: string) => setFilters((f) => ({ ...f, status, page: 1 }));
  const setPage   = (page: number)   => setFilters((f) => ({ ...f, page }));

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getApplications({
        page: filters.page,
        search: filters.search || undefined,
        status: filters.status === 'all' ? undefined : filters.status,
      });
      setResponse(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void fetchApplications(); }, [fetchApplications]);

  return (
    <motion.div
      variants={pageEntry}
      initial="hidden"
      animate="visible"
      className="p-6 max-w-7xl"
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('admin.applications.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {response && t('admin.applications.subtitle', { total: response.meta.total })}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div
          className="flex items-center gap-2 flex-1 rounded-lg px-3 py-2 border"
          style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
        >
          <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={filters.search}
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

      {/* Table */}
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
          action={{ label: t('common.retry'), onClick: fetchApplications }}
        />
      ) : !response || response.data.length === 0 ? (
        <EmptyState
          title={t('admin.applications.empty_title')}
          description={t('admin.applications.empty_desc')}
        />
      ) : (
        <>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Table header */}
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

            {/* Rows */}
            {response.data.map((app) => (
              <motion.div
                key={app.id}
                variants={staggerChild}
                className="grid grid-cols-12 items-center px-4 py-3.5 border-b last:border-b-0 transition-colors"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="col-span-3">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {app.camper?.full_name ?? `Camper #${app.camper_id}`}
                  </p>
                </div>
                <div className="col-span-3">
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {app.session?.name ?? `Session #${app.session_id}`}
                  </p>
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
                  <Link
                    to={`/admin/applications/${app.id}`}
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
              </motion.div>
            ))}
          </motion.div>

          {/* Pagination */}
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
    </motion.div>
  );
}
