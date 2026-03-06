/**
 * AuditLogPage.tsx
 *
 * Phase 9 — Audit Log Redesign.
 *
 * Presents the system audit log as a structured, human-readable activity
 * timeline. Features include:
 *
 *   - Human-readable event descriptions (generated server-side)
 *   - Event category badges (Authentication, Messaging, Applications, etc.)
 *   - Expandable detail panels with before/after values and metadata
 *   - Filters: search, category, entity type, user ID, date range
 *   - Export: CSV and JSON downloads
 *   - Pagination with summary counts
 *
 * Route: /super-admin/audit
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Download, Filter, X, User, Globe, Monitor,
  Shield, MessageSquare, FileText, Bell, Stethoscope,
  Settings, FolderOpen, LogIn, RefreshCw,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { ElementType } from 'react';

import { getAuditLog, exportAuditLog } from '@/features/admin/api/admin.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { pageEntry } from '@/shared/constants/motion';
import type { AuditLogEntry } from '@/features/admin/types/admin.types';
import type { PaginatedResponse } from '@/shared/types/api.types';

// ─── Category definitions ─────────────────────────────────────────────────────

interface CategoryDef {
  label:  string;
  icon:   ElementType;
  color:  string;
  bg:     string;
}

const CATEGORIES: Record<string, CategoryDef> = {
  Authentication: { label: 'Authentication', icon: LogIn,          color: '#2563eb', bg: 'rgba(37,99,235,0.10)'  },
  Messaging:      { label: 'Messaging',      icon: MessageSquare,  color: '#16a34a', bg: 'rgba(22,163,74,0.10)'  },
  Applications:   { label: 'Applications',   icon: FileText,       color: '#d97706', bg: 'rgba(217,119,6,0.10)'  },
  Notifications:  { label: 'Notifications',  icon: Bell,           color: '#7c3aed', bg: 'rgba(124,58,237,0.10)' },
  Security:       { label: 'Security',       icon: Shield,         color: '#dc2626', bg: 'rgba(220,38,38,0.10)'  },
  Medical:        { label: 'Medical',        icon: Stethoscope,    color: '#0891b2', bg: 'rgba(8,145,178,0.10)'  },
  Administrative: { label: 'Administrative', icon: Settings,       color: '#6b7280', bg: 'rgba(107,114,128,0.10)'},
  Documents:      { label: 'Documents',      icon: FolderOpen,     color: '#0369a1', bg: 'rgba(3,105,161,0.10)'  },
  System:         { label: 'System',         icon: Settings,       color: '#6b7280', bg: 'rgba(107,114,128,0.10)'},
};

const EVENT_TYPES = [
  { value: '',               label: 'All categories'    },
  { value: 'authentication', label: 'Authentication'    },
  { value: 'auth',           label: 'Auth'              },
  { value: 'message',        label: 'Messaging'         },
  { value: 'conversation',   label: 'Conversations'     },
  { value: 'application',    label: 'Applications'      },
  { value: 'notification',   label: 'Notifications'     },
  { value: 'security',       label: 'Security'          },
  { value: 'phi_access',     label: 'Medical / PHI'     },
  { value: 'admin_action',   label: 'Administrative'    },
  { value: 'document',       label: 'Documents'         },
  { value: 'user',           label: 'System / User'     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryDef(category?: string): CategoryDef {
  return CATEGORIES[category ?? ''] ?? CATEGORIES.System;
}

/** Convert snake_case / camelCase field names to "Title Case" labels */
function fieldLabel(key: string): string {
  return key
    .replace(/_id$/, ' ID')
    .replace(/_at$/, ' at')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a single field value for display */
function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Format before/after diff objects as labeled rows */
function formatDiffEntries(obj: Record<string, unknown>): Array<{ key: string; label: string; value: string }> {
  return Object.entries(obj).map(([k, v]) => ({
    key: k,
    label: fieldLabel(k),
    value: formatFieldValue(k, v),
  }));
}

// ── Metadata interpreters ─────────────────────────────────────────────────────

const HTTP_METHOD_LABELS: Record<string, string> = {
  GET:    'Viewed / Retrieved',
  POST:   'Created or submitted',
  PUT:    'Updated (full)',
  PATCH:  'Updated',
  DELETE: 'Deleted',
};

function httpMethodLabel(method: string): string {
  return HTTP_METHOD_LABELS[method?.toUpperCase()] ?? method;
}

function httpStatusLabel(status: number): { text: string; ok: boolean } {
  if (status >= 200 && status < 300) return { text: 'Success',           ok: true  };
  if (status === 400)                return { text: 'Bad request',        ok: false };
  if (status === 401)                return { text: 'Not authenticated',  ok: false };
  if (status === 403)                return { text: 'Access denied',      ok: false };
  if (status === 404)                return { text: 'Record not found',   ok: false };
  if (status === 422)                return { text: 'Validation failed',  ok: false };
  if (status >= 500)                 return { text: 'Server error',       ok: false };
  return { text: `Code ${status}`, ok: false };
}

const ROUTE_LABELS: Record<string, string> = {
  'campers.show':            'Viewed a camper profile',
  'campers.index':           'Browsed the camper list',
  'campers.store':           'Created a camper record',
  'campers.update':          'Updated a camper record',
  'campers.destroy':         'Deleted a camper record',
  'applications.show':       'Viewed an application',
  'applications.index':      'Browsed applications',
  'applications.store':      'Submitted an application',
  'applications.update':     'Updated an application',
  'applications.destroy':    'Deleted an application',
  'medical-records.show':    'Viewed a medical record',
  'medical-records.index':   'Browsed medical records',
  'medical-records.update':  'Updated a medical record',
  'sessions.show':           'Viewed a camp session',
  'sessions.index':          'Browsed camp sessions',
  'sessions.store':          'Created a camp session',
  'sessions.update':         'Updated a camp session',
  'sessions.destroy':        'Deleted a camp session',
  'users.show':              'Viewed a user profile',
  'users.index':             'Browsed the user list',
  'users.update':            'Updated a user record',
  'conversations.show':      'Opened a conversation',
  'conversations.store':     'Started a new conversation',
  'messages.store':          'Sent a message',
  'audit-log.index':         'Browsed the audit log',
  'documents.show':          'Viewed a document',
  'documents.store':         'Uploaded a document',
  'documents.destroy':       'Deleted a document',
};

function routeLabel(route: string): string {
  return ROUTE_LABELS[route] ?? route.replace(/\./g, ' › ').replace(/-/g, ' ');
}

function formatRouteParams(params: unknown): string {
  if (!params || typeof params !== 'object') return '';
  return Object.entries(params as Record<string, unknown>)
    .map(([entity, id]) => `${entity.charAt(0).toUpperCase() + entity.slice(1)} #${id}`)
    .join(', ');
}

/** Parse a raw user-agent string into a readable "Browser on OS" label */
function parseUserAgent(ua: string): string {
  let browser = 'Unknown browser';
  if (ua.includes('Edg/')) {
    const v = ua.match(/Edg\/([\d]+)/)?.[1] ?? '';
    browser = `Edge ${v}`;
  } else if (ua.includes('Chrome/')) {
    const v = ua.match(/Chrome\/([\d]+)/)?.[1] ?? '';
    browser = `Chrome ${v}`;
  } else if (ua.includes('Firefox/')) {
    const v = ua.match(/Firefox\/([\d]+)/)?.[1] ?? '';
    browser = `Firefox ${v}`;
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const v = ua.match(/Version\/([\d]+)/)?.[1] ?? '';
    browser = `Safari ${v}`;
  }

  let os = '';
  if (ua.includes('Windows NT'))      os = 'Windows';
  else if (ua.includes('Mac OS X'))   os = 'macOS';
  else if (ua.includes('Android'))    os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux'))      os = 'Linux';

  return os ? `${browser.trim()} on ${os}` : browser.trim();
}

// ─── Filters state ────────────────────────────────────────────────────────────

interface Filters {
  search:     string;
  event_type: string;
  user_id:    string;
  from:       string;
  to:         string;
  page:       number;
}

const DEFAULT_FILTERS: Filters = {
  search: '', event_type: '', user_id: '', from: '', to: '', page: 1,
};

// ─── CategoryBadge ────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category?: string }) {
  const def  = getCategoryDef(category);
  const Icon = def.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
      style={{ background: def.bg, color: def.color }}
    >
      <Icon className="h-3 w-3" />
      {def.label}
    </span>
  );
}

// ─── AuditEntry row ───────────────────────────────────────────────────────────

function AuditEntryRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  const hasDetails =
    (entry.old_values && Object.keys(entry.old_values).length > 0) ||
    (entry.new_values && Object.keys(entry.new_values).length > 0) ||
    (entry.metadata   && Object.keys(entry.metadata).length > 0)   ||
    entry.user_agent;

  const displayText = entry.human_description || entry.description || entry.action;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Category icon dot */}
        <div
          className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 mt-0.5"
          style={{ background: getCategoryDef(entry.category).bg }}
        >
          {(() => {
            const Icon = getCategoryDef(entry.category).icon;
            return <Icon className="h-3.5 w-3.5" style={{ color: getCategoryDef(entry.category).color }} />;
          })()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Description + badge */}
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-sm font-medium leading-snug flex-1" style={{ color: 'var(--foreground)' }}>
              {displayText}
            </p>
            <CategoryBadge category={entry.category} />
          </div>

          {/* Meta row: user · entity · IP · time */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {entry.user && (
              <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <User className="h-3 w-3" />
                {entry.user.name}
              </span>
            )}
            {entry.entity_label && entry.auditable_id && (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {entry.entity_label} #{entry.auditable_id}
              </span>
            )}
            {entry.ip_address && (
              <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <Globe className="h-3 w-3" />
                {entry.ip_address}
              </span>
            )}
          </div>
        </div>

        {/* Right: timestamp + expand toggle */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <time
            className="text-xs tabular-nums"
            style={{ color: 'var(--muted-foreground)' }}
            title={format(new Date(entry.created_at), 'PPpp')}
          >
            {format(new Date(entry.created_at), 'MMM d, HH:mm')}
          </time>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
          </span>
          {hasDetails && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 p-1 rounded transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
              title={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded
                ? <ChevronUp   className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
                : <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
              }
            </button>
          )}
        </div>
      </div>

      {/* Expandable detail panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-3 pt-1 border-t space-y-3"
              style={{ borderColor: 'var(--border)', background: 'rgba(248,249,250,0.6)' }}
            >
              {/* Before / After values */}
              {entry.old_values && Object.keys(entry.old_values).length > 0 && (
                <DiffBlock label="Before" rows={formatDiffEntries(entry.old_values)} variant="removed" />
              )}
              {entry.new_values && Object.keys(entry.new_values).length > 0 && (
                <DiffBlock label="After" rows={formatDiffEntries(entry.new_values)} variant="added" />
              )}

              {/* Metadata — parsed into human-readable rows */}
              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <MetadataPanel metadata={entry.metadata} />
              )}

              {/* Device / browser info */}
              {entry.user_agent && (
                <div className="flex items-center gap-2">
                  <Monitor className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {parseUserAgent(entry.user_agent)}
                  </p>
                </div>
              )}

              {/* Reference ID — only meaningful as a support reference */}
              {entry.request_id && (
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Reference ID: <span className="font-mono">{entry.request_id}</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Before / After diff block — renders labeled field rows instead of raw JSON */
function DiffBlock({
  label,
  rows,
  variant,
}: {
  label: string;
  rows: Array<{ key: string; label: string; value: string }>;
  variant: 'added' | 'removed';
}) {
  const colors = {
    added:   { border: 'rgba(22,163,74,0.30)',  bg: 'rgba(22,163,74,0.04)',  header: '#166534' },
    removed: { border: 'rgba(220,38,38,0.30)',  bg: 'rgba(220,38,38,0.04)', header: '#991b1b' },
  }[variant];

  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: colors.border }}>
      <div className="px-3 py-1 text-xs font-semibold" style={{ background: colors.bg, color: colors.header }}>
        {label}
      </div>
      <div className="divide-y" style={{ borderColor: colors.border }}>
        {rows.map(({ key, label: lbl, value }) => (
          <div key={key} className="flex items-start gap-3 px-3 py-1.5">
            <span className="text-xs font-medium flex-shrink-0 w-36" style={{ color: 'var(--muted-foreground)' }}>
              {lbl}
            </span>
            <span className="text-xs break-all" style={{ color: 'var(--foreground)' }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Metadata panel — translates technical route/method/status keys to plain English */
function MetadataPanel({ metadata }: { metadata: Record<string, unknown> }) {
  const rows: Array<{ label: string; value: string; ok?: boolean }> = [];

  if (metadata.route) {
    rows.push({ label: 'Action performed', value: routeLabel(String(metadata.route)) });
  }
  if (metadata.method) {
    rows.push({ label: 'Request type', value: httpMethodLabel(String(metadata.method)) });
  }
  if (metadata.status) {
    const { text, ok } = httpStatusLabel(Number(metadata.status));
    rows.push({ label: 'Result', value: text, ok });
  }
  if (metadata.route_parameters && typeof metadata.route_parameters === 'object') {
    const formatted = formatRouteParams(metadata.route_parameters);
    if (formatted) rows.push({ label: 'Record accessed', value: formatted });
  }

  // Any remaining unknown keys
  const knownKeys = new Set(['route', 'method', 'status', 'route_parameters']);
  for (const [k, v] of Object.entries(metadata)) {
    if (!knownKeys.has(k)) {
      rows.push({ label: fieldLabel(k), value: formatFieldValue(k, v) });
    }
  }

  if (rows.length === 0) return null;

  return (
    <div
      className="rounded-lg overflow-hidden border"
      style={{ borderColor: 'rgba(107,114,128,0.25)' }}
    >
      <div
        className="px-3 py-1 text-xs font-semibold"
        style={{ background: 'rgba(107,114,128,0.06)', color: '#374151' }}
      >
        Details
      </div>
      <div className="divide-y" style={{ borderColor: 'rgba(107,114,128,0.12)' }}>
        {rows.map(({ label, value, ok }) => (
          <div key={label} className="flex items-start gap-3 px-3 py-1.5">
            <span className="text-xs font-medium flex-shrink-0 w-36" style={{ color: 'var(--muted-foreground)' }}>
              {label}
            </span>
            <span
              className="text-xs"
              style={{ color: ok === false ? '#dc2626' : ok === true ? '#166534' : 'var(--foreground)' }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AuditLogPage() {
  const [response, setResponse]     = useState<PaginatedResponse<AuditLogEntry> | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters]       = useState<Filters>(DEFAULT_FILTERS);

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value, page: key !== 'page' ? 1 : (value as number) }));
  }

  const hasActiveFilters = filters.event_type || filters.user_id || filters.from || filters.to;

  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = {
        page:       filters.page,
        per_page:   25,
        search:     filters.search   || undefined,
        event_type: filters.event_type || undefined,
        user_id:    filters.user_id ? Number(filters.user_id) : undefined,
        from:       filters.from    || undefined,
        to:         filters.to      || undefined,
      };
      const data = await getAuditLog(params);
      setResponse(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void fetchLog(); }, [fetchLog]);

  async function handleExport(format: 'csv' | 'json') {
    setExporting(true);
    try {
      await exportAuditLog({
        format,
        search:     filters.search     || undefined,
        event_type: filters.event_type || undefined,
        user_id:    filters.user_id ? Number(filters.user_id) : undefined,
        from:       filters.from       || undefined,
        to:         filters.to         || undefined,
      });
    } catch {
      // Toast is not imported here to keep this page self-contained;
      // silently fail — user can retry from the button.
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  const entries     = response?.data ?? [];
  const meta        = response?.meta;

  return (
    <motion.div
      variants={pageEntry}
      initial="hidden"
      animate="visible"
      className="p-6 max-w-6xl"
    >
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Activity Log
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {meta?.total != null
              ? `${meta.total.toLocaleString()} events recorded`
              : 'Full record of system activity and security events'}
          </p>
        </div>

        {/* Export + filter buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExport('csv')}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--dash-nav-hover-bg)] disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => void handleExport('json')}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--dash-nav-hover-bg)] disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{
              borderColor: hasActiveFilters ? '#16a34a' : 'var(--border)',
              color: hasActiveFilters ? '#16a34a' : 'var(--foreground)',
              background: hasActiveFilters ? 'rgba(22,163,74,0.08)' : undefined,
            }}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasActiveFilters && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: '#16a34a' }}
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => void fetchLog()}
            disabled={loading}
            className="p-1.5 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)] disabled:opacity-40"
            style={{ borderColor: 'var(--border)' }}
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
      </div>

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2 border mb-3"
        style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
      >
        <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
        <input
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          placeholder="Search events, users, actions…"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--foreground)' }}
        />
        {filters.search && (
          <button onClick={() => updateFilter('search', '')} aria-label="Clear search">
            <X className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        )}
      </div>

      {/* ── Expandable filter panel ────────────────────────────────────────── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            key="filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 p-4 rounded-xl border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              {/* Category */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  Category
                </label>
                <select
                  value={filters.event_type}
                  onChange={(e) => updateFilter('event_type', e.target.value)}
                  className="w-full text-sm rounded-lg px-2 py-1.5 border outline-none"
                  style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* User ID */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  User ID
                </label>
                <input
                  type="number"
                  value={filters.user_id}
                  onChange={(e) => updateFilter('user_id', e.target.value)}
                  placeholder="Any user"
                  className="w-full text-sm rounded-lg px-2 py-1.5 border outline-none"
                  style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>

              {/* From */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  From date
                </label>
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) => updateFilter('from', e.target.value)}
                  className="w-full text-sm rounded-lg px-2 py-1.5 border outline-none"
                  style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>

              {/* To */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  To date
                </label>
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => updateFilter('to', e.target.value)}
                  className="w-full text-sm rounded-lg px-2 py-1.5 border outline-none"
                  style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>

              {/* Clear filters */}
              {hasActiveFilters && (
                <div className="col-span-2 sm:col-span-4 flex justify-end">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-medium hover:underline"
                    style={{ color: '#dc2626' }}
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Event timeline ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => <Skeletons.Row key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Could not load the activity log
          </p>
          <button
            onClick={() => void fetchLog()}
            className="text-sm font-medium px-4 py-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ color: '#16a34a' }}
          >
            Try again
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            No events found
          </p>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {filters.search || hasActiveFilters
              ? 'Try adjusting your search or filters.'
              : 'Activity will appear here as the system is used.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <AuditEntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {meta.from != null && meta.to != null
              ? `Showing ${meta.from.toLocaleString()}–${meta.to.toLocaleString()} of ${meta.total.toLocaleString()} events`
              : `Page ${filters.page} of ${meta.last_page}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateFilter('page', filters.page - 1)}
              disabled={filters.page === 1}
              className="p-1.5 rounded-lg border disabled:opacity-40 transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ borderColor: 'var(--border)' }}
            >
              <ChevronLeft className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
            </button>
            <span className="text-sm px-2 tabular-nums" style={{ color: 'var(--foreground)' }}>
              {filters.page} / {meta.last_page}
            </span>
            <button
              onClick={() => updateFilter('page', filters.page + 1)}
              disabled={filters.page === meta.last_page}
              className="p-1.5 rounded-lg border disabled:opacity-40 transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ borderColor: 'var(--border)' }}
            >
              <ChevronRight className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
