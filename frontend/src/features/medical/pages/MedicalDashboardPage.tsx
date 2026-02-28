/**
 * MedicalDashboardPage.tsx
 *
 * Medical provider dashboard: camper list with quick search,
 * links to individual medical records.
 * Route: /medical
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, Heart, AlertTriangle, ArrowRight } from 'lucide-react';

import { getMedicalCampers } from '@/features/medical/api/medical.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { pageEntry, staggerContainer, staggerChild } from '@/shared/constants/motion';
import type { Camper } from '@/features/admin/types/admin.types';
import type { PaginatedResponse } from '@/shared/types/api.types';

export function MedicalDashboardPage() {
  const { t } = useTranslation();

  const [response, setResponse]   = useState<PaginatedResponse<Camper> | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [search, setSearch]       = useState('');

  const fetchCampers = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getMedicalCampers({ search: search || undefined });
      setResponse(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { void fetchCampers(); }, [fetchCampers]);

  return (
    <motion.div variants={pageEntry} initial="hidden" animate="visible" className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('medical.dashboard.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {t('medical.dashboard.subtitle')}
        </p>
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2.5 border mb-6 max-w-sm"
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

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeletons.Card key={i} />)}
        </div>
      ) : error ? (
        <EmptyState
          title={t('common.error_loading')}
          description={t('common.try_again')}
          action={{ label: t('common.retry'), onClick: fetchCampers }}
        />
      ) : !response || response.data.length === 0 ? (
        <EmptyState title={t('medical.dashboard.empty_title')} description={t('medical.dashboard.empty_desc')} />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {response.data.map((camper) => {
            const allergyCount = camper.medical_record?.allergies?.length ?? 0;
            const medCount     = camper.medical_record?.medications?.length ?? 0;
            const hasHighRisk  = camper.medical_record?.allergies?.some(
              (a) => a.severity === 'life-threatening'
            );

            return (
              <motion.div key={camper.id} variants={staggerChild}>
                <Link
                  to={`/medical/records/${camper.id}`}
                  className="block rounded-xl border p-5 transition-all group"
                  style={{
                    background: 'var(--glass-medium)',
                    borderColor: hasHighRisk ? 'rgba(220,38,38,0.3)' : 'var(--border)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="flex items-center justify-center w-9 h-9 rounded-xl"
                      style={{ background: hasHighRisk ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.1)' }}
                    >
                      {hasHighRisk
                        ? <AlertTriangle className="h-4 w-4" style={{ color: 'var(--destructive)' }} />
                        : <Heart className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
                      }
                    </div>
                    <ArrowRight
                      className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--ember-orange)' }}
                    />
                  </div>

                  <p className="font-medium text-sm mb-1" style={{ color: 'var(--foreground)' }}>
                    {camper.full_name}
                  </p>

                  {camper.medical_record?.primary_diagnosis && (
                    <p className="text-xs mb-2 truncate" style={{ color: 'var(--muted-foreground)' }}>
                      {camper.medical_record.primary_diagnosis}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2">
                    {allergyCount > 0 && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: hasHighRisk ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.1)',
                          color: hasHighRisk ? 'var(--destructive)' : 'var(--warm-amber)',
                        }}
                      >
                        {allergyCount} {t('medical.dashboard.allergies')}
                      </span>
                    )}
                    {medCount > 0 && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(96,165,250,0.1)', color: 'var(--night-sky-blue)' }}
                      >
                        {medCount} {t('medical.dashboard.meds')}
                      </span>
                    )}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
