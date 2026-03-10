/**
 * AuditLogPage.tsx
 *
 * Phase 9 — Audit Log Redesign.
 *
 * Purpose: System audit log viewer for super admins — a chronological record
 *          of every significant action taken in the application.
 * Responsibilities:
 *   - Fetch paginated audit log entries with search + category/event_type/user/date filters
 *   - Render each entry as a timeline card with a category badge and expandable detail panel
 *   - Translate technical field names, HTTP methods, and status codes into plain English
 *   - Parse the user-agent string into a "Browser on OS" label
 *   - Show before/after diff blocks when an entry has old_values or new_values
 *   - Support CSV and JSON export of the currently filtered result set
 *
 * Plain-English: This page is like the security camera footage for the whole
 * system. Every time someone logs in, changes a record, or accesses medical
 * data, an entry appears here so super admins can investigate anything unusual.
 *
 * Route: /super-admin/audit
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
import type { AuditLogEntry } from '@/features/admin/types/admin.types';
import type { PaginatedResponse } from '@/shared/types/api.types';

// ─── Category definitions ─────────────────────────────────────────────────────

interface CategoryDef {
  label:  string;
  icon:   ElementType;
  color:  string;
  bg:     string;
}

// Maps server-side category strings to visual badge definitions
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

// Event type filter options that map to server-side event_type query param values
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

// Falls back to the System definition for any category not in the map
function getCategoryDef(category?: string): CategoryDef {
  return CATEGORIES[category ?? ''] ?? CATEGORIES.System;
}

// Converts snake_case / camelCase database field names to "Title Case" labels
function fieldLabel(key: string): string {
  return key
    .replace(/_id$/, ' ID')
    .replace(/_at$/, ' at')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Turns any field value into a displayable string, handling booleans and objects
function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Converts a before/after values object into an array of labeled display rows
function formatDiffEntries(obj: Record<string, unknown>): Array<{ key: string; label: string; value: string }> {
  return Object.entries(obj).map(([k, v]) => ({
    key: k,
    label: fieldLabel(k),
    value: formatFieldValue(k, v),
  }));
}

// ── Metadata interpreters ─────────────────────────────────────────────────────

// Maps HTTP method verbs to plain-English descriptions for non-technical users
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

// Translates HTTP status codes to plain-English results with a success/failure flag
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

// Maps Laravel route names to plain-English sentences shown in the metadata panel
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

// Falls back to converting "campers.show" → "campers › show" for unmapped routes
function routeLabel(route: string): string {
  return ROUTE_LABELS[route] ?? route.replace(/\./g, ' › ').replace(/-/g, ' ');
}

// Converts route params like { camper: 5 } → "Camper #5"
function formatRouteParams(params: unknown): string {
  if (!params || typeof params !== 'object') return '';
  return Object.entries(params as Record<string, unknown>)
    .map(([entity, id]) => `${entity.charAt(0).toUpperCase() + entity.slice(1)} #${id}`)
    .join(', ');
}

// Parses a raw user-agent string into "Chrome 120 on macOS" style readable text
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

// Consolidated filters — all in one object to avoid double-fetch race conditions
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

// Renders a color-coded pill with an icon and label for a given audit category
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
  // Local toggle for the expandable detail panel
  const [expanded, setExpanded] = useState(false);

  // Only show the expand chevron when there's actually something to show
  const hasDetails =
    (entry.old_values && Object.keys(entry.old_values).length > 0) ||
    (entry.new_values && Object.keys(entry.new_values).length > 0) ||
    (entry.metadata   && Object.keys(entry.metadata).length > 0)   ||
    entry.user_agent;

  // Prefer the server-generated human description, then fallback through less readable fields
  const displayText = entry.human_description || entry.description || entry.action;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {/* Main row — always visible */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Category icon in a colored badge */}
        <div
          className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 mt-0.5"
          style={{ background: getCategoryDef(entry.category).bg }}
        >
          {(() => {
            const Icon = getCategoryDef(entry.category).icon;
            return <Icon className="h-3.5 w-3.5" style={{ color: getCategoryDef(entry.category).color }} />;
          })()}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {/* Human-readable description + category badge */}
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-sm font-medium leading-snug flex-1" style={{ color: 'var(--foreground)' }}>
              {displayText}
            </p>
            <CategoryBadge category={entry.category} />
          </div>

          {/* Secondary metadata: user name, entity label, IP address */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {entry.user && (
              <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <User className="h-3 w-3" />
                {entry.user.name}
              </span>
            )}
            {/* entity_label is a human name like "Application" or "Camper" */}
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

        {/* Right column: timestamp + expand toggle */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {/* Full datetime shown on hover via the title attribute */}
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
          {/* Expand button only rendered when there are details to show */}
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
      {expanded && (
        <div
          className="px-4 pb-3 pt-1 border-t space-y-3"
          style={{ borderColor: 'var(--border)', background: 'rgba(248,249,250,0.6)' }}
        >
          {/* Before / After diff blocks when a record was changed */}
          {entry.old_values && Object.keys(entry.old_values).length > 0 && (
            <DiffBlock label="Before" rows={formatDiffEntries(entry.old_values)} variant="removed" />
          )}
          {entry.new_values && Object.keys(entry.new_values).length > 0 && (
            <DiffBlock label="After" rows={formatDiffEntries(entry.new_values)} variant="added" />
          )}

          {/* Metadata panel — translates route, method, status, params to readable text */}
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <MetadataPanel metadata={entry.metadata} />
          )}

          {/* Device info parsed from the user-agent header */}
          {entry.user_agent && (
            <div className="flex items-center gap-2">
              <Monitor className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {parseUserAgent(entry.user_agent)}
              </p>
            </div>
          )}

          {/* Request ID — useful as a support reference when investigating issues */}
          {entry.request_id && (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Reference ID: <span className="font-mono">{entry.request_id}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Renders a "Before" (red) or "After" (green) block showing field-by-field diff rows
function DiffBlock({
  label,
  rows,
  variant,
}: {
  label: string;
  rows: Array<{ key: string; label: string; value: string }>;
  variant: 'added' | 'removed';
}) {
  // Color palette differs between the before (red) and after (green) blocks
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
            {/* Fixed-width label column so values all align */}
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

// Translates technical metadata fields (route, method, status, params) to plain English rows
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

  // Any remaining keys not in the known set are displayed as generic labeled rows
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
            {/* Green for success, red for error, default color for neutral values */}
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
  // Controls the expandable advanced-filter panel
  const [showFilters, setShowFilters] = useState(false);
  // Consolidated filter object — any change resets page to 1
  const [filters, setFilters]       = useState<Filters>(DEFAULT_FILTERS);

  // searchInput is the controlled input value — updates instantly for UX.
  // filters.search is the debounced value that triggers an API call.
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generic filter updater — resets to page 1 for any filter except page itself.
  // For 'search' specifically, callers should use handleSearchChange() to get debouncing.
  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value, page: key !== 'page' ? 1 : (value as number) }));
  }

  // Debounced search handler — avoids firing an API call on every keystroke.
  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: value, page: 1 }));
    }, 300);
  }

  // True when any optional filter beyond search is active — used to tint the Filters button
  const hasActiveFilters = filters.event_type || filters.user_id || filters.from || filters.to;

  // Stable fetch function keyed to the filters object
  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = {
        page:       filters.page,
        per_page:   25,
        // Only pass params to the API when they have a value
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

  // Export uses the same active filters so the download matches what the admin sees
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
      // exportAuditLog handles its own blob download; silently fail here
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    setSearchInput('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setFilters(DEFAULT_FILTERS);
  }

  const entries = response?.data ?? [];
  const meta    = response?.meta;

  return (
    <div className="p-6 max-w-6xl">
      {/* Page header with export + filter toolbar */}
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

        {/* Export and filter action buttons */}
        <div className="flex items-center gap-2">
          {/* CSV export button — applies current filters to the download */}
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
          {/* JSON export button */}
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
          {/* Filters button tints green when any optional filter is active */}
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
            {/* Green dot indicates active filters at a glance */}
            {hasActiveFilters && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: '#16a34a' }}
              />
            )}
          </button>
          {/* Refresh button — useful when watching live activity */}
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

      {/* Always-visible search bar */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2 border mb-3"
        style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
      >
        <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
        <input
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search events, users, actions…"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--foreground)' }}
        />
        {/* Clear-X button appears only when the search field has text */}
        {searchInput && (
          <button
            onClick={() => {
              setSearchInput('');
              if (debounceRef.current) clearTimeout(debounceRef.current);
              setFilters((f) => ({ ...f, search: '', page: 1 }));
            }}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        )}
      </div>

      {/* Expandable advanced-filter panel */}
      {showFilters && (
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 p-4 rounded-xl border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {/* Category / event type filter */}
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

          {/* User ID filter — shows actions by a specific user */}
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

          {/* Date range: from */}
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

          {/* Date range: to */}
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

          {/* Clear all filters link — only shown when filters are active */}
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
      )}

      {/* Event timeline */}
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

      {/* Pagination controls */}
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
    </div>
  );
}
