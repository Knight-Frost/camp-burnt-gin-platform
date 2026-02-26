/**
 * AuditLogPage.tsx
 *
 * Chronological audit log with user, action, and date filters.
 * Route: /super-admin/audit
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { format } from 'date-fns';

import { getAuditLog } from '@/features/admin/api/admin.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { pageEntry, staggerContainer, staggerChild } from '@/shared/constants/motion';
import type { AuditLogEntry } from '@/features/admin/types/admin.types';
import type { PaginatedResponse } from '@/shared/types/api.types';

export function AuditLogPage() {
  const { t } = useTranslation();

  const [response, setResponse] = useState<PaginatedResponse<AuditLogEntry> | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [search, setSearch]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [page, setPage]         = useState(1);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getAuditLog({
        page,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
      setResponse(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, dateFrom, dateTo]);

  useEffect(() => { void fetchLog(); }, [fetchLog]);
  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo]);

  const ACTION_COLORS: Record<string, string> = {
    created:  'var(--forest-green)',
    updated:  'var(--night-sky-blue)',
    deleted:  '#f87171',
    reviewed: 'var(--ember-orange)',
    login:    'var(--warm-amber)',
  };

  function getActionColor(action: string): string {
    for (const [key, color] of Object.entries(ACTION_COLORS)) {
      if (action.toLowerCase().includes(key)) return color;
    }
    return 'var(--muted-foreground)';
  }

  return (
    <motion.div variants={pageEntry} initial="hidden" animate="visible" className="p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('superadmin.audit.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {response && t('superadmin.audit.subtitle', { total: response.meta.total })}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div
          className="flex items-center gap-2 flex-1 max-w-xs rounded-lg px-3 py-2 border"
          style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
        >
          <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('superadmin.audit.search_placeholder')}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--foreground)' }}
          />
        </div>
        <input
          type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm border outline-none"
          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        />
        <input
          type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm border outline-none"
          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <Skeletons.Row key={i} />)}</div>
      ) : error ? (
        <EmptyState
          title={t('common.error_loading')}
          description={t('common.try_again')}
          action={{ label: t('common.retry'), onClick: fetchLog }}
        />
      ) : !response || response.data.length === 0 ? (
        <EmptyState title={t('superadmin.audit.empty_title')} description={t('superadmin.audit.empty_desc')} />
      ) : (
        <>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-1.5"
          >
            {response.data.map((entry) => (
              <motion.div
                key={entry.id}
                variants={staggerChild}
                className="flex items-start gap-4 rounded-xl px-4 py-3 border"
                style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)' }}
              >
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  <Activity className="h-3.5 w-3.5" style={{ color: getActionColor(entry.action) }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: `${getActionColor(entry.action)}18`,
                        color: getActionColor(entry.action),
                      }}
                    >
                      {entry.action}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {entry.auditable_type.replace('App\\Models\\', '')} #{entry.auditable_id}
                    </span>
                  </div>
                  {entry.user && (
                    <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                      {t('superadmin.audit.by')} {entry.user.name}
                      {entry.ip_address && ` · ${entry.ip_address}`}
                    </p>
                  )}
                </div>

                <p className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                  {format(new Date(entry.created_at), 'MMM d, HH:mm')}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {response.meta.last_page > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {t('common.pagination', {
                  from: (page - 1) * response.meta.per_page + 1,
                  to: Math.min(page * response.meta.per_page, response.meta.total),
                  total: response.meta.total,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
                  className="p-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>
                  <ChevronLeft className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
                </button>
                <span className="text-sm px-2" style={{ color: 'var(--foreground)' }}>
                  {page} / {response.meta.last_page}
                </span>
                <button onClick={() => setPage((p) => p + 1)} disabled={page === response.meta.last_page}
                  className="p-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>
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
