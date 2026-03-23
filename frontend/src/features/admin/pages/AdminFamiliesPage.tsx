/**
 * AdminFamiliesPage.tsx
 *
 * Level 1 of the family-first admin IA.
 * Route: /admin/families (also /super-admin/families)
 *
 * Purpose:
 *   Give admins a clean, scannable overview of all registered guardian accounts
 *   (families). Each card summarises the guardian, their campers, and the state
 *   of active applications — without overloading the screen with detail.
 *
 * Design principles:
 *   - Progressive disclosure: summary only at this level; drill into Family Workspace for detail.
 *   - Family is the primary object here, not the individual camper.
 *   - No repeated session text or status labels per row — grouped naturally at family level.
 *   - Premium, calm, enterprise-grade aesthetic.
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Search, Users, ChevronLeft, ChevronRight, ArrowRight,
} from 'lucide-react';

import { getFamilies } from '@/features/admin/api/admin.api';
import { Avatar } from '@/ui/components/Avatar';
import { EmptyState } from '@/ui/components/EmptyState';
import type { FamilyCard } from '@/features/admin/types/admin.types';
import type { PaginatedResponse } from '@/shared/types/api.types';
import { useSessionWorkspace } from '@/features/sessions/context/SessionWorkspaceContext';
import { SessionHeroBanner } from '@/features/sessions/components/SessionHeroBanner';

// ─── Status badge ────────────────────────────────────────────────────────────

type AppStatus = FamilyCard['application_statuses'][number];

const STATUS_CONFIG: Record<AppStatus, { bg: string; color: string; label: string }> = {
  pending:      { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'Pending' },
  under_review: { bg: 'rgba(37,99,235,0.12)',   color: '#2563eb', label: 'Under Review' },
  approved:     { bg: 'rgba(22,163,74,0.12)',   color: '#16a34a', label: 'Approved' },
  rejected:     { bg: 'rgba(220,38,38,0.12)',   color: '#dc2626', label: 'Rejected' },
  waitlisted:   { bg: 'rgba(234,88,12,0.12)',   color: '#ea580c', label: 'Waitlisted' },
  cancelled:    { bg: 'rgba(107,114,128,0.10)', color: '#9ca3af', label: 'Cancelled' },
  withdrawn:    { bg: 'rgba(107,114,128,0.10)', color: '#9ca3af', label: 'Withdrawn' },
  draft:        { bg: 'rgba(107,114,128,0.10)', color: '#9ca3af', label: 'Draft' },
};

function StatusChip({ status }: { status: AppStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Age helper ──────────────────────────────────────────────────────────────

function ageFromDob(dob: string): number {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ─── Summary stat card ───────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      className="glass-card rounded-xl px-5 py-4"
    >
      <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </p>
      <p className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
        {value}
      </p>
    </div>
  );
}

// ─── Family card ─────────────────────────────────────────────────────────────

function FamilyCardItem({ family, detailBase }: { family: FamilyCard; detailBase: string }) {
  const activeStatuses: AppStatus[] = ['pending', 'under_review', 'waitlisted', 'approved'];
  const activeStatusSet = new Set(
    family.application_statuses.filter((s) => activeStatuses.includes(s))
  );

  return (
    <div
      className="glass-panel rounded-xl flex flex-col"
    >
      {/* Card header — guardian identity */}
      <div
        className="px-5 pt-5 pb-4 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Avatar name={family.name} size="md" />
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                {family.name}
              </p>
            </div>
            <p className="text-xs truncate mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {family.email}
            </p>
            {(family.city || family.state) && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {[family.city, family.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(22,101,52,0.10)', color: '#166534' }}
            >
              {family.campers_count} {family.campers_count === 1 ? 'camper' : 'campers'}
            </span>
            {family.active_applications_count > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(37,99,235,0.10)', color: '#2563eb' }}
              >
                {family.active_applications_count} active
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Camper previews */}
      <div className="px-5 py-4 flex-1 space-y-3">
        {family.campers.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            No campers registered yet.
          </p>
        ) : (
          family.campers.map((camper) => (
            <div key={camper.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                  {camper.full_name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {camper.date_of_birth
                    ? `Age ${ageFromDob(camper.date_of_birth)}`
                    : 'Age unknown'}
                  {camper.gender ? ` · ${camper.gender}` : ''}
                </p>
              </div>
              <div className="flex-shrink-0">
                {camper.latest_application ? (
                  <StatusChip status={camper.latest_application.status} />
                ) : (
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    No application
                  </span>
                )}
              </div>
            </div>
          ))
        )}

        {/* Unique status summary (if more than one distinct active status) */}
        {activeStatusSet.size > 1 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {[...activeStatusSet].map((s) => (
              <StatusChip key={s} status={s} />
            ))}
          </div>
        )}
      </div>

      {/* Card footer — open family CTA */}
      <div
        className="px-5 py-3 border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <Link
          to={`${detailBase}/${family.id}`}
          className="flex items-center justify-between w-full text-sm font-medium transition-colors group"
          style={{ color: '#166534' }}
        >
          <span>Open Family</span>
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function AdminFamiliesPage() {
  const location = useLocation();
  const isSuperAdmin = location.pathname.startsWith('/super-admin');
  const detailBase   = isSuperAdmin ? '/super-admin/families' : '/admin/families';

  // Session scoping comes from the workspace context — no per-page dropdown.
  const sessionCtx = useSessionWorkspace();
  const workspaceSessionId = sessionCtx?.currentSession?.id;

  // ── State ──────────────────────────────────────────────────────────────────
  const [response, setResponse]   = useState<PaginatedResponse<FamilyCard> | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [filters, setFilters]     = useState({
    search: '', status: '', multi_camper: false, page: 1,
  });
  const [retryKey, setRetryKey]   = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: value, page: 1 }));
    }, 300);
  }

  // ── Data fetching ──────────────────────────────────────────────────────────

  // Re-fetches when filters change OR when the workspace session changes.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) { setLoading(true); setError(false); }
      try {
        const data = await getFamilies({
          page:         filters.page,
          search:       filters.search || undefined,
          // Session scoping comes from workspace context — not from a dropdown.
          session_id:   workspaceSessionId,
          status:       filters.status || undefined,
          multi_camper: filters.multi_camper || undefined,
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

  // ── Derived summary stats ──────────────────────────────────────────────────
  // These are computed from the current page's data as a quick overview.
  // They reflect the filtered result set, not the entire database.
  const totalFamilies     = response?.meta.total ?? 0;
  const totalCampers      = response?.data.reduce((acc, f) => acc + f.campers_count, 0) ?? 0;
  const totalActive       = response?.data.reduce((acc, f) => acc + f.active_applications_count, 0) ?? 0;
  const multiCamperCount  = response?.data.filter((f) => f.campers_count >= 2).length ?? 0;

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

      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Families
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Guardian accounts and their registered campers
        </p>
      </div>

      {/* Summary stat cards — shown once data loads */}
      {response && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Families" value={totalFamilies} />
          <StatCard label="Campers" value={totalCampers} />
          <StatCard label="Active Applications" value={totalActive} />
          <StatCard label="Multi-Camper" value={multiCamperCount} />
        </div>
      )}

      {/* Filter row */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Search */}
        <div
          className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm rounded-lg px-3 py-2 border"
          style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
        >
          <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by guardian or child name…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--foreground)' }}
          />
        </div>

        {/* Status filter */}
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 border"
          style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
        >
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
            className="bg-transparent text-sm outline-none"
            style={{ color: 'var(--foreground)' }}
          >
            <option value="" style={{ background: 'var(--card)' }}>All Statuses</option>
            <option value="pending"      style={{ background: 'var(--card)' }}>Pending</option>
            <option value="under_review" style={{ background: 'var(--card)' }}>Under Review</option>
            <option value="approved"     style={{ background: 'var(--card)' }}>Approved</option>
            <option value="waitlisted"   style={{ background: 'var(--card)' }}>Waitlisted</option>
            <option value="rejected"     style={{ background: 'var(--card)' }}>Rejected</option>
          </select>
        </div>

        {/* Multi-camper toggle */}
        <button
          onClick={() => setFilters((f) => ({ ...f, multi_camper: !f.multi_camper, page: 1 }))}
          className="flex items-center gap-2 rounded-lg px-3 py-2 border text-sm font-medium transition-colors"
          style={{
            background: filters.multi_camper ? 'rgba(22,101,52,0.10)' : 'var(--input)',
            borderColor: filters.multi_camper ? '#166534' : 'var(--border)',
            color: filters.multi_camper ? '#166534' : 'var(--muted-foreground)',
          }}
        >
          <Users className="h-4 w-4" />
          Multi-camper
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border h-56 animate-pulse"
              style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)' }}
            />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Failed to load families"
          description="There was a problem fetching family data. Please try again."
          action={{ label: 'Retry', onClick: () => setRetryKey((k) => k + 1) }}
        />
      ) : !response || response.data.length === 0 ? (
        <EmptyState
          title={filters.search || workspaceSessionId || filters.status || filters.multi_camper
            ? 'No families match your filters'
            : 'No families yet'}
          description={filters.search || workspaceSessionId || filters.status || filters.multi_camper
            ? 'Try adjusting your search or filters.'
            : 'Registered guardian accounts will appear here once parents sign up.'}
        />
      ) : (
        <>
          {/* Family cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {response.data.map((family) => (
              <FamilyCardItem key={family.id} family={family} detailBase={detailBase} />
            ))}
          </div>

          {/* Pagination */}
          {response.meta.last_page > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {(filters.page - 1) * response.meta.per_page + 1}–
                {Math.min(filters.page * response.meta.per_page, response.meta.total)} of{' '}
                {response.meta.total} families
              </p>
              <div className="flex items-center gap-2">
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
