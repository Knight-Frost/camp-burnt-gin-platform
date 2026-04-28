/**
 * AdminDocumentsPage.tsx
 *
 * Redesigned (Phase 13) as a full Document Request system.
 *
 * The page is built around admin-initiated document requests rather than
 * passively reviewing uploaded files.
 *
 * Full lifecycle:
 *   Admin requests document → Applicant receives inbox notification
 *   → Applicant uploads → Admin reviews → Admin approves or rejects
 *   → If rejected, request reopens for resubmission
 *
 * Features:
 *  - Dashboard metrics bar (7 statuses)
 *  - "+ Request Document" modal
 *  - Filterable / searchable requests table
 *  - Per-row review: Download, Approve, Reject
 *  - Reject modal with reason field
 *  - Status badges with full lifecycle colours
 */

import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties, type FC, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FileText,
  Plus,
  Search,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  X,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  InboxIcon,
  Bell,
  CalendarClock,
  Trash2,
  RotateCcw,
  MoreVertical,
  Archive,
  ArchiveRestore,
  Shield,
  ZoomIn,
  Filter,
  CloudUpload,
  FileCheck,
  ExternalLink,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

import {
  getDocumentRequestStats,
  getDocumentRequests,
  createDocumentRequest,
  rejectDocumentRequest,
  cancelDocumentRequest,
  remindDocumentRequest,
  extendDocumentRequestDeadline,
  requestDocumentReupload,
  getUsers,
  getAdminDocuments,
  downloadAdminDocument,
  deleteDocument,
  archiveDocument,
  restoreDocument,
  bulkRemindDocumentRequests,
  overrideDocument,
  reopenDocument,
  getCampers,
  type AdminDocument,
  type DocumentRequest,
  type DocumentRequestStats,
  type DocumentRequestStatus,
} from '@/features/admin/api/admin.api';
import { axiosInstance } from '@/api/axios.config';
import { useAppSelector } from '@/store/hooks';
import { Button } from '@/ui/components/Button';
import { Avatar, avatarBg } from '@/ui/components/Avatar';
import { DocumentStatusBadge } from '@/ui/components/DocumentStatusBadge';
import { EmptyState, ErrorState } from '@/ui/components/EmptyState';
import { getDocumentLabel } from '@/shared/constants/documentRequirements';
import { mapRequestStatus } from '@/shared/constants/documentStatuses';
import { ROUTES } from '@/shared/constants/routes';

// ── Status badge helpers ───────────────────────────────────────────────────────

// Thin adapter over the shared DocumentStatusBadge. Call sites pass the
// backend DocumentRequestStatus; the shared mapper translates to the
// canonical 8-state vocabulary so the DCC, reviewer page, and applicant page
// never drift on wording or color (see documentStatuses.ts).
function StatusBadge({ status }: { status: DocumentRequestStatus }) {
  return <DocumentStatusBadge status={mapRequestStatus(status)} />;
}

// ── Metric card ────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  subtitle,
  value,
  active,
  onClick,
  icon: Icon,
  dotBg,
  dotFg,
}: {
  label: string;
  subtitle: string;
  value: number;
  active: boolean;
  onClick: () => void;
  icon: FC<{ className?: string; style?: CSSProperties }>;
  dotBg: string;
  dotFg: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2.5 rounded-xl p-3.5 border text-left transition-all"
      style={{
        background: active ? 'rgba(34,197,94,0.08)' : 'var(--card)',
        borderColor: active ? 'rgba(34,197,94,0.30)' : 'var(--border)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        color: 'var(--foreground)',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)'; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: dotBg }}
        >
          <Icon className="h-4 w-4" style={{ color: dotFg }} />
        </div>
        <span className="text-xl font-semibold font-headline leading-none" style={{ color: 'var(--foreground)' }}>
          {value}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium leading-snug" style={{ color: 'var(--foreground)' }}>
          {label}
        </span>
        <span className="text-xs leading-snug" style={{ color: 'var(--muted-foreground)' }}>
          {subtitle}
        </span>
      </div>
    </button>
  );
}

// ── Numbered pagination ────────────────────────────────────────────────────────

function PageNumbers({
  page,
  lastPage,
  onPageChange,
}: {
  page: number;
  lastPage: number;
  onPageChange: (p: number) => void;
}) {
  // Build page window: first, last, current ± 1, with ellipsis gaps
  const pages: (number | '...')[] = [];
  if (lastPage <= 7) {
    for (let i = 1; i <= lastPage; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(lastPage - 1, page + 1); i++) pages.push(i);
    if (page < lastPage - 2) pages.push('...');
    pages.push(lastPage);
  }
  return (
    <div className="flex items-center gap-1">
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className="min-w-[32px] h-8 px-2 rounded-md text-sm font-medium transition-colors"
            style={{
              background: p === page ? 'var(--ember-orange)' : 'transparent',
              color: p === page ? '#fff' : 'var(--foreground)',
            }}
          >
            {p}
          </button>
        ),
      )}
    </div>
  );
}

// ── Relative-time helper ──────────────────────────────────────────────────────
// Returns a short human text + a CSS color hint for the status line in rows.

function relativeFromNow(dateString: string | null | undefined, status?: string): { text: string; color: string } {
  if (!dateString) return { text: '—', color: 'var(--muted-foreground)' };
  const date = new Date(dateString);
  const diffMs = date.getTime() - Date.now();
  const overdue = diffMs < 0;
  const dist = formatDistanceToNow(date, { addSuffix: false });

  if (status === 'approved') return { text: `Approved ${dist} ago`, color: 'var(--forest-green)' };
  if (status === 'rejected') return { text: `Rejected ${dist} ago`, color: '#6b7280' };
  if (overdue) return { text: `${dist} overdue`, color: '#dc2626' };
  return { text: `${dist} left`, color: '#d97706' };
}

// ── Document type → human-readable label ──────────────────────────────────────
//
// Maps the raw backend document_type values (snake_case strings) to clean,
// human-readable labels shown in the admin UI.  Unknown types fall back to a
// simple title-case transformation so new values never surface as raw snake_case.

// All document type labels now derive from the shared canonical module so admin
// and applicant views never drift apart. Admin-facing labels (e.g. "SC Immunization
// Certificate") are returned automatically when role='admin'.
function formatDocumentType(raw: string | null): string {
  if (!raw) return '—';
  return getDocumentLabel(raw, 'admin');
}

// ── ParentCombobox — searchable typeahead for parent/guardian selection ────────
//
// Replaces a <select> that doesn't scale past ~20 items. Handles:
//   - In-memory filter on name + email (no round-trip, instant feel)
//   - Keyboard navigation: ↑↓ to move, Enter to select, Escape to close
//   - mousedown + e.preventDefault() on items so blur doesn't collapse the
//     list before the click registers — the critical combobox timing trick
//   - Clear (×) button when a value is selected

interface ParentOption {
  id: number;
  name: string;
  email: string;
}

function ParentCombobox({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = 'Search by name or email…',
}: {
  options: ParentOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query,       setQuery]       = useState('');
  const [open,        setOpen]        = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLUListElement>(null);

  // Derive selection from value — no extra local state needed
  const selected = options.find((o) => String(o.id) === value) ?? null;

  // Filter on every keystroke — pure in-memory, no debounce needed for <500 items
  const filtered = query.trim()
    ? options.filter((o) => {
        const q = query.toLowerCase();
        return o.name.toLowerCase().includes(q) || o.email.toLowerCase().includes(q);
      })
    : options;

  // Reset highlight when results change (e.g. new query)
  useEffect(() => { setHighlighted(0); }, [query]);

  // Keep highlighted item visible while arrowing through the list
  useEffect(() => {
    if (!open || !listRef.current) return;
    (listRef.current.children[highlighted] as HTMLElement | undefined)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  function openAndFocus() {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleContainerClick() {
    // Clicking the container when something is selected clears and reopens search
    if (selected) { onChange(''); setQuery(''); }
    openAndFocus();
  }

  function selectOption(opt: ParentOption) {
    onChange(String(opt.id));
    setQuery('');
    setOpen(false);
  }

  function clearSelection(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) { setOpen(true); return; }
        setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (open && filtered[highlighted]) selectOption(filtered[highlighted]);
        else setOpen(true);
        break;
      case 'Escape':
        setOpen(false);
        setQuery('');
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  return (
    <div className="relative">
      {/* ── Input trigger ── */}
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="applicant-combobox-listbox"
        tabIndex={0}
        className="flex items-center rounded-lg border text-sm px-3 min-h-[42px] cursor-text gap-2"
        style={{
          background: open ? 'rgba(34,197,94,0.08)' : 'var(--input)',
          borderColor: open ? 'rgba(34,197,94,0.30)' : 'var(--border)',
          boxShadow: 'none',
          color: 'var(--foreground)',
          opacity: disabled ? 0.5 : 1,
        }}
        onClick={handleContainerClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleContainerClick(); }}
      >
        {selected && !open ? (
          /* SELECTED state — name text + clear × */
          <>
            <span className="flex-1 truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {selected.name}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={clearSelection}
                className="flex-shrink-0 rounded p-0.5 hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                title="Clear selection"
              >
                <X className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
              </button>
            )}
          </>
        ) : (
          /* SEARCH state — text input */
          <>
            <input
              ref={inputRef}
              type="text"
              role="searchbox"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={disabled}
              value={query}
              placeholder={placeholder}
              className="flex-1 bg-transparent outline-none text-sm min-w-0 py-2.5"
              style={{ color: 'var(--foreground)' }}
              onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
              onFocus={() => setOpen(true)}
              // 160ms delay: lets mousedown on a list item fire before blur collapses the list
              onBlur={() => setTimeout(() => setOpen(false), 160)}
              onKeyDown={handleKeyDown}
            />
            <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          </>
        )}
      </div>

      {/* ── Dropdown list ── */}
      {open && (
        <ul
          ref={listRef}
          id="applicant-combobox-listbox"
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-1.5 rounded-xl border overflow-y-auto"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
            maxHeight: '220px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          }}
        >
          {filtered.length === 0 ? (
            <li
              className="px-4 py-4 text-sm text-center"
              style={{ color: 'var(--muted-foreground)' }}
            >
              No results{query ? ` for "${query}"` : ''}
            </li>
          ) : (
            filtered.map((opt, idx) => (
              <li
                key={opt.id}
                role="option"
                aria-selected={String(opt.id) === value}
                // mousedown + preventDefault keeps focus on the input through selection
                onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
                onMouseEnter={() => setHighlighted(idx)}
                className="flex flex-col px-4 py-2.5 cursor-pointer"
                style={{
                  background: idx === highlighted ? 'var(--dash-nav-hover-bg)' : 'transparent',
                  color: 'var(--foreground)',
                }}
              >
                <span className="text-sm font-medium leading-snug">{opt.name}</span>
                <span className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {opt.email}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// ── Request Document modal ─────────────────────────────────────────────────────

interface RequestDocumentModalProps {
  onClose: () => void;
  onCreated: (req: DocumentRequest) => void;
}

function RequestDocumentModal({ onClose, onCreated }: RequestDocumentModalProps) {
  const { t } = useTranslation();
  const [parents, setParents]           = useState<ParentOption[]>([]);
  const [children, setChildren]         = useState<{ id: number; name: string }[]>([]);
  const [loadingParents, setLoadingParents]   = useState(true);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [saving, setSaving]             = useState(false);

  // Inline "Add Child" fallback — opens when a selected parent has no camper
  // on file. Posts to POST /campers with the parent's user_id set, then
  // refreshes the children dropdown and auto-selects the new row.
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [savingChild, setSavingChild]     = useState(false);
  const [newChildForm, setNewChildForm]   = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
  });

  const [form, setForm] = useState({
    applicant_id:  '',
    camper_id:     '',   // '' = not yet chosen, 'all' = all children, numeric string = specific child
    document_type: '',
    instructions:  '',
    due_date:      '',
  });

  // Load parent/guardian list on mount
  useEffect(() => {
    let cancelled = false;
    getUsers({ role: 'applicant', page: 1 })
      .then((res) => {
        if (cancelled) return;
        setParents((res.data ?? []).map((u) => ({ id: u.id, name: u.name, email: u.email })));
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = (err as { message?: string })?.message;
        toast.error(msg ? `Unable to load parents: ${msg}` : 'Unable to load parents. Please refresh and try again.');
      })
      .finally(() => { if (!cancelled) setLoadingParents(false); });
    return () => { cancelled = true; };
  }, []);

  // When parent changes, load their children and apply auto-selection
  useEffect(() => {
    if (!form.applicant_id) {
      setChildren([]);
      setForm((prev) => ({ ...prev, camper_id: '' }));
      return;
    }
    setLoadingChildren(true);
    setChildren([]);
    setForm((prev) => ({ ...prev, camper_id: '' }));
    // Parent changed — collapse any open "Add Child" form on the previous parent.
    setIsAddingChild(false);
    setNewChildForm({ first_name: '', last_name: '', date_of_birth: '' });
    axiosInstance.get('/campers', { params: { user_id: Number(form.applicant_id) } })
      .then((res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = (res.data as any)?.data ?? res.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: { id: number; name: string }[] = list.map((c: any) => ({
          id: c.id,
          name: `${c.first_name} ${c.last_name}`,
        }));
        setChildren(mapped);
        // Auto-select the only child; otherwise require explicit selection
        if (mapped.length === 1) {
          setForm((prev) => ({ ...prev, camper_id: String(mapped[0].id) }));
        }
      })
      .catch(() => setChildren([]))
      .finally(() => setLoadingChildren(false));

  }, [form.applicant_id]);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /**
   * Create a new Camper row for the currently-selected parent, then refresh
   * the Child dropdown and auto-select the new camper.
   *
   * This is the escape hatch for paper applications where a Camper might
   * not have been pre-created — or any other scenario where an admin needs
   * to add a child on the spot without leaving the document request flow.
   */
  async function handleAddChild(e: FormEvent) {
    e.preventDefault();
    if (!form.applicant_id) return;
    if (!newChildForm.first_name.trim() || !newChildForm.last_name.trim() || !newChildForm.date_of_birth) return;

    setSavingChild(true);
    try {
      const res = await axiosInstance.post('/campers', {
        user_id: Number(form.applicant_id),
        first_name: newChildForm.first_name.trim(),
        last_name: newChildForm.last_name.trim(),
        date_of_birth: newChildForm.date_of_birth,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = ((res.data as any)?.data ?? res.data) as { id: number; first_name: string; last_name: string } | undefined;
      if (!created?.id) {
        toast.error('Child created but no ID returned. Please refresh.');
        return;
      }
      const newOption = { id: created.id, name: `${created.first_name} ${created.last_name}` };
      setChildren((prev) => [...prev, newOption]);
      setForm((prev) => ({ ...prev, camper_id: String(newOption.id) }));
      setIsAddingChild(false);
      setNewChildForm({ first_name: '', last_name: '', date_of_birth: '' });
      toast.success(t('admin_extra.add_child_success', 'Child added.'));
    } catch (err) {
      // Surface the specific validation error when the backend returned one.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.response?.data?.message ?? (err as { message?: string })?.message;
      toast.error(msg ? `Failed to add child: ${msg}` : 'Failed to add child.');
    } finally {
      setSavingChild(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.applicant_id || !form.camper_id || !form.document_type.trim()) return;
    setSaving(true);
    try {
      // 'all' maps to null (all children for this parent); otherwise use the specific child id
      const camperId = form.camper_id === 'all' ? null : Number(form.camper_id);
      const req = await createDocumentRequest({
        applicant_id:  Number(form.applicant_id),
        camper_id:     camperId,
        document_type: form.document_type.trim(),
        instructions:  form.instructions.trim() || undefined,
        due_date:      form.due_date || undefined,
      });
      toast.success('Document request created and parent notified.');
      onCreated(req);
    } catch {
      toast.error('Failed to create document request.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'rounded-lg px-3 py-2.5 text-sm border outline-none focus:bg-[rgba(34,197,94,0.08)] bg-[var(--input)] w-full';
  const inputStyle = { borderColor: 'var(--border)', color: 'var(--foreground)' };
  const labelCls = 'text-xs font-medium block mb-1';
  const labelStyle = { color: 'var(--muted-foreground)' };

  const canSubmit =
    !saving &&
    !loadingParents &&
    !!form.applicant_id &&
    !!form.camper_id &&
    !!form.document_type.trim();

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Close"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
      <div
        role="presentation"
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--card)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('admin_extra.request_document_title', 'Request Document')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin_extra.request_document_subtitle', 'The parent/guardian will be notified via their inbox.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
          >
            <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 flex flex-col gap-4">
          {/* Parent / Guardian */}
          <div>
            <label htmlFor="doc-req-parent" className={labelCls} style={labelStyle}>{t('admin_extra.doc_form_parent', 'Parent / Guardian')} *</label>
            {loadingParents ? (
              <div className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
            ) : (
              <ParentCombobox
                options={parents}
                value={form.applicant_id}
                onChange={(id) => set('applicant_id', id)}
                placeholder={t('admin_extra.select_parent_placeholder', 'Search by name or email…')}
              />
            )}
            <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin_extra.select_parent_hint', 'Select the parent/guardian, then choose which child this document is for.')}
            </p>
          </div>

          {/* Child — shown as soon as a parent is selected.
              Three sub-states:
                - loading: skeleton
                - children exist: normal dropdown
                - no children: inline empty state with "Add Child" fallback so
                  admins can unblock themselves without leaving the modal.
                  Common with paper applicants whose Camper stub was removed
                  or never created. */}
          {form.applicant_id && (
            <div>
              <label htmlFor="doc-req-child" className={labelCls} style={labelStyle}>{t('admin_extra.doc_form_child', 'Child')} *</label>
              {loadingChildren ? (
                <div className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
              ) : children.length === 0 ? (
                <div
                  className="rounded-lg border p-3 flex flex-col gap-3"
                  style={{ background: 'rgba(234,88,12,0.06)', borderColor: 'rgba(234,88,12,0.25)' }}
                >
                  <p className="text-xs" style={{ color: '#9a3412' }}>
                    {t(
                      'admin_extra.no_children_for_parent',
                      "This parent has no children on file yet. Add one below to continue — you'll still need the parent's approval to collect the requested document.",
                    )}
                  </p>

                  {!isAddingChild ? (
                    <button
                      type="button"
                      onClick={() => setIsAddingChild(true)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2 self-start"
                      style={{ color: '#9a3412' }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t('admin_extra.add_child_cta', 'Add Child')}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder={t('admin_extra.add_child_first_name', 'First name')}
                          value={newChildForm.first_name}
                          onChange={(e) => setNewChildForm((p) => ({ ...p, first_name: e.target.value }))}
                          className={inputCls}
                          style={inputStyle}
                          disabled={savingChild}
                        />
                        <input
                          type="text"
                          placeholder={t('admin_extra.add_child_last_name', 'Last name')}
                          value={newChildForm.last_name}
                          onChange={(e) => setNewChildForm((p) => ({ ...p, last_name: e.target.value }))}
                          className={inputCls}
                          style={inputStyle}
                          disabled={savingChild}
                        />
                      </div>
                      <input
                        type="date"
                        aria-label={t('admin_extra.add_child_dob', 'Date of birth')}
                        value={newChildForm.date_of_birth}
                        onChange={(e) => setNewChildForm((p) => ({ ...p, date_of_birth: e.target.value }))}
                        className={inputCls}
                        style={inputStyle}
                        disabled={savingChild}
                        max={new Date().toISOString().slice(0, 10)}
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsAddingChild(false);
                            setNewChildForm({ first_name: '', last_name: '', date_of_birth: '' });
                          }}
                          disabled={savingChild}
                        >
                          {t('common.cancel', 'Cancel')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => void handleAddChild(e as unknown as FormEvent)}
                          loading={savingChild}
                          disabled={
                            savingChild
                            || !newChildForm.first_name.trim()
                            || !newChildForm.last_name.trim()
                            || !newChildForm.date_of_birth
                          }
                        >
                          {t('admin_extra.add_child_submit', 'Add Child')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <select
                  id="doc-req-child"
                  required
                  value={form.camper_id}
                  onChange={(e) => set('camper_id', e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="">{t('admin_extra.select_child_placeholder', 'Select child…')}</option>
                  {children.length > 1 && (
                    <option value="all">{t('admin_extra.all_children', 'All children')}</option>
                  )}
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Document Type */}
          <div>
            <label htmlFor="doc-req-type" className={labelCls} style={labelStyle}>{t('admin_extra.doc_form_type', 'Document Type')} *</label>
            <input
              id="doc-req-type"
              type="text"
              required
              placeholder="e.g. Immunization Record, Physician Sign-off…"
              value={form.document_type}
              onChange={(e) => set('document_type', e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </div>

          {/* Instructions */}
          <div>
            <label htmlFor="doc-req-instructions" className={labelCls} style={labelStyle}>{t('admin_extra.doc_form_instructions', 'Instructions (optional)')}</label>
            <textarea
              id="doc-req-instructions"
              rows={3}
              placeholder="What should the parent/guardian upload or include?"
              value={form.instructions}
              onChange={(e) => set('instructions', e.target.value)}
              className={inputCls + ' resize-none'}
              style={inputStyle}
            />
          </div>

          {/* Due Date */}
          <div>
            <label htmlFor="doc-req-due-date" className={labelCls} style={labelStyle}>{t('admin_extra.doc_form_due', 'Due Date (optional)')}</label>
            <input
              id="doc-req-due-date"
              type="date"
              value={form.due_date}
              onChange={(e) => set('due_date', e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-3 pt-2 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={!canSubmit}
              loading={saving}
              className="flex items-center gap-1.5"
            >
              <InboxIcon className="h-3.5 w-3.5" />
              {t('admin_extra.send_request', 'Send Request')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reject modal ───────────────────────────────────────────────────────────────

function RejectModal({
  requestId,
  documentType,
  onClose,
  onRejected,
}: {
  requestId: number;
  documentType: string;
  onClose: () => void;
  onRejected: (updated: DocumentRequest) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await rejectDocumentRequest(requestId, reason.trim() || undefined);
      toast.success('Document rejected. Applicant notified.');
      onRejected(updated);
    } catch {
      toast.error('Failed to reject document.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Close"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
      <div
        role="presentation"
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--card)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            {t('admin_extra.reject_document_title', 'Reject Document')}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
          >
            <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t('admin_extra.reject_document_body', 'You are rejecting')} <strong style={{ color: 'var(--foreground)' }}>{documentType}</strong>.
            {' '}{t('admin_extra.reject_document_notify', 'The applicant will be notified and asked to resubmit.')}
          </p>
          <div>
            <label htmlFor="reject-reason" className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin_extra.reject_reason_label', 'Reason (optional)')}
            </label>
            <textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. File is unreadable, wrong document type…"
              className="rounded-lg px-3 py-2.5 text-sm border outline-none focus:bg-[rgba(34,197,94,0.08)] bg-[var(--input)] w-full resize-none"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div
            className="flex items-center justify-end gap-3 pt-1 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
            <Button variant="destructive" size="sm" type="submit" loading={saving} disabled={saving}>
              {t('admin_extra.reject_button', 'Reject')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Overflow menu ─────────────────────────────────────────────────────────────

interface OverflowMenuItem {
  label: string;
  icon: FC<{ className?: string; style?: CSSProperties }>;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

function OverflowMenu({ items }: { items: OverflowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<CSSProperties>({});

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      // Estimate height: each item ~34px, tiny container padding
      const estimatedHeight = items.length * 34 + 4;
      const MENU_WIDTH = 200;
      const MARGIN = 8;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceRight = window.innerWidth - rect.left;

      const pos: CSSProperties = { position: 'fixed', zIndex: 9999 };

      // Vertical: open upward when there isn't enough room below
      if (spaceBelow < estimatedHeight + MARGIN) {
        pos.bottom = window.innerHeight - rect.top + 4;
      } else {
        pos.top = rect.bottom + 4;
      }

      // Horizontal: right-align to button when space allows, else left-align
      if (spaceRight >= MENU_WIDTH + MARGIN) {
        pos.right = window.innerWidth - rect.right;
      } else {
        pos.left = Math.max(MARGIN, rect.right - MENU_WIDTH);
      }

      setMenuPos(pos);
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="More actions"
        onClick={handleToggle}
        className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors flex-shrink-0"
        style={{ color: open ? 'var(--foreground)' : 'var(--muted-foreground)' }}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{
            ...menuPos,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: '188px',
            overflow: 'hidden',
          }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={() => { item.onClick(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[var(--dash-nav-hover-bg)] transition-colors text-left disabled:opacity-40"
                style={{ color: item.danger ? '#dc2626' : 'var(--foreground)' }}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: item.danger ? '#dc2626' : 'var(--muted-foreground)' }} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Extend Deadline modal ──────────────────────────────────────────────────────

function ExtendDeadlineModal({
  req,
  onClose,
  onExtended,
}: {
  req: DocumentRequest;
  onClose: () => void;
  onExtended: (updated: DocumentRequest) => void;
}) {
  const { t } = useTranslation();
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!date) return;
    setSaving(true);
    try {
      const updated = await extendDocumentRequestDeadline(req.id, date);
      toast.success('Deadline extended. Applicant notified.');
      onExtended(updated);
    } catch {
      toast.error('Failed to extend deadline.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'rounded-lg px-3 py-2.5 text-sm border outline-none focus:bg-[rgba(34,197,94,0.08)] bg-[var(--input)] w-full';
  const inputStyle = { borderColor: 'var(--border)', color: 'var(--foreground)' };

  return (
    <div role="button" tabIndex={0} aria-label="Close" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}>
      <div role="presentation" className="relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--card)' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('admin_extra.doc_extend_deadline', 'Extend Deadline')}</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors">
            <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t('admin_extra.extend_deadline_body', 'Set a new due date for')} <strong style={{ color: 'var(--foreground)' }}>{req.document_type}</strong>.
          </p>
          <div>
            <label htmlFor="extend-due-date" className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.extend_new_due_date', 'New Due Date')} *</label>
            <input id="extend-due-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div className="flex items-center justify-end gap-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
            <Button size="sm" type="submit" loading={saving} disabled={saving || !date}>{t('admin_extra.doc_extend_deadline', 'Extend Deadline')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Cancel Confirm modal ───────────────────────────────────────────────────────

function CancelConfirmModal({
  req,
  onClose,
  onConfirm,
}: {
  req: DocumentRequest;
  onClose: () => void;
  onConfirm: (req: DocumentRequest) => void;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    try {
      onConfirm(req);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="button" tabIndex={0} aria-label="Close" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}>
      <div role="presentation" className="relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--card)' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('admin_extra.doc_cancel_request', 'Cancel Request')}</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors">
            <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t('admin_extra.cancel_request_body', 'Cancel the request for')} <strong style={{ color: 'var(--foreground)' }}>{req.document_type}</strong>? {t('admin_extra.cancel_request_notify', 'The applicant will be notified and this record will be removed.')}
          </p>
          <div className="flex items-center justify-end gap-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>{t('admin_extra.keep_button', 'Keep')}</Button>
            <Button variant="destructive" size="sm" loading={saving} disabled={saving} onClick={() => void handleConfirm()}>{t('admin_extra.doc_cancel_request', 'Cancel Request')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Override Modal ─────────────────────────────────────────────────────────────

function OverrideModal({
  doc,
  onClose,
  onDone,
}: {
  doc: AdminDocument;
  onClose: () => void;
  onDone: (updated: AdminDocument) => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'approved' | 'rejected'>('approved');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (status === 'rejected' && !reason.trim()) return;
    setSaving(true);
    try {
      const updated = await overrideDocument(doc.id, status, reason.trim() || undefined);
      toast.success(t('admin_extra.override_success', 'Decision overridden'));
      onDone(updated);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.response?.status === 403) {
        toast.error(t('admin_extra.override_forbidden', 'You do not have permission to perform this action.'));
      } else {
        toast.error('Override failed.');
      }
    } finally {
      setSaving(false);
    }
  }

  const currentStatusLabel = doc.verification_status === 'approved'
    ? t('admin_extra.status_approved', 'Approved')
    : t('admin_extra.status_rejected', 'Rejected');

  return (
    <div role="button" tabIndex={0} aria-label="Close" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}>
      <div role="presentation" className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--card)' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('admin_extra.override_title', 'Override decision')}</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"><X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} /></button>
        </div>
        <form onSubmit={(e) => void handleConfirm(e)} className="p-5 flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t('admin_extra.override_body', 'This document was {{currentStatus}}. Set its status to:').replace('{{currentStatus}}', currentStatusLabel)}
          </p>
          <div className="flex gap-2">
            {(['approved', 'rejected'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className="flex-1 py-2 rounded-xl text-sm font-medium border transition-colors"
                style={{
                  background: status === s ? (s === 'approved' ? 'rgba(5,150,105,0.12)' : 'rgba(239,68,68,0.12)') : 'var(--card)',
                  borderColor: status === s ? (s === 'approved' ? 'var(--forest-green)' : '#dc2626') : 'var(--border)',
                  color: status === s ? (s === 'approved' ? 'var(--forest-green)' : '#dc2626') : 'var(--muted-foreground)',
                }}
              >
                {s === 'approved' ? t('admin_extra.bulk_approve', 'Approve') : t('admin_extra.bulk_reject', 'Reject')}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="override-reason" className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {status === 'rejected' ? `${t('admin_extra.bulk_reject_reason_label', 'Reason for rejection')} *` : 'Reason (optional)'}
            </label>
            <textarea
              id="override-reason"
              rows={3}
              required={status === 'rejected'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for this decision override…"
              className="rounded-lg px-3 py-2.5 text-sm border outline-none focus:bg-[rgba(34,197,94,0.08)] bg-[var(--input)] w-full resize-none"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <p className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.10)', color: '#b45309' }}>
            {t('admin_extra.override_audit_warning', 'This action is logged in the audit log.')}
          </p>
          <div className="flex items-center justify-end gap-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('common.cancel', 'Cancel')}</button>
            <button
              type="submit"
              disabled={saving || (status === 'rejected' && !reason.trim())}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-40"
              style={{ background: 'var(--ember-orange)' }}
            >
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin inline" /> : t('admin_extra.override_confirm', 'Confirm override')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reopen Modal ──────────────────────────────────────────────────────────────

function ReopenModal({
  doc,
  onClose,
  onDone,
}: {
  doc: AdminDocument;
  onClose: () => void;
  onDone: (updated: AdminDocument) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await reopenDocument(doc.id, reason.trim() || undefined);
      toast.success(t('admin_extra.reopen_success', 'Document reopened'));
      onDone(updated);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.response?.status === 403) {
        toast.error(t('admin_extra.override_forbidden', 'You do not have permission to perform this action.'));
      } else {
        toast.error('Reopen failed.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="button" tabIndex={0} aria-label="Close" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}>
      <div role="presentation" className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--card)' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('admin_extra.reopen_title', 'Reopen for review')}</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"><X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} /></button>
        </div>
        <form onSubmit={(e) => void handleConfirm(e)} className="p-5 flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.reopen_body', 'This document will return to the Submitted queue for review.')}</p>
          <div>
            <label htmlFor="reopen-reason" className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Reason (optional)</label>
            <textarea
              id="reopen-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for reopening…"
              className="rounded-lg px-3 py-2.5 text-sm border outline-none focus:bg-[rgba(34,197,94,0.08)] bg-[var(--input)] w-full resize-none"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <p className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.10)', color: '#b45309' }}>
            {t('admin_extra.override_audit_warning', 'This action is logged in the audit log.')}
          </p>
          <div className="flex items-center justify-end gap-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('common.cancel', 'Cancel')}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-40" style={{ background: 'var(--ember-orange)' }}>
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin inline" /> : t('admin_extra.reopen_confirm', 'Reopen')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

// ── URL persistence helpers ────────────────────────────────────────────────────
//
// Maps between the filter state and URL query string so refreshing the page
// preserves active filters. Only non-empty values are written to the URL.

type DateFieldType = 'submitted_at' | 'updated_at' | 'due_date';
type TabType = 'requests' | 'submitted' | 'reviewed';

interface AdvancedFiltersState {
  camperId: string;
  applicationNumber: string;  // String-not-number to match backend's CBG-YYYY-NNN format
  dateField: DateFieldType;
  from: string;
  to: string;
}

const DEFAULT_ADV_FILTERS: AdvancedFiltersState = {
  camperId: '',
  applicationNumber: '',
  dateField: 'updated_at',
  from: '',
  to: '',
};

function readFiltersFromUrl(sp: URLSearchParams): {
  tab: TabType;
  search: string;
  uploadsSearch: string;
  statusFilter: string;
  uploadsStatusFilter: string;
  page: number;
  uploadsPage: number;
  advancedFilters: AdvancedFiltersState;
} {
  const tab = (sp.get('tab') ?? 'requests') as TabType;
  return {
    tab,
    search: sp.get('search') ?? '',
    uploadsSearch: sp.get('uploadsSearch') ?? '',
    statusFilter: sp.get('statusFilter') ?? '',
    uploadsStatusFilter: sp.get('uploadsStatusFilter') ?? (tab === 'submitted' ? 'pending' : 'approved'),
    page: Number(sp.get('page') ?? '1') || 1,
    uploadsPage: Number(sp.get('uploadsPage') ?? '1') || 1,
    advancedFilters: {
      camperId: sp.get('camperId') ?? '',
      applicationNumber: sp.get('applicationNumber') ?? '',
      dateField: (sp.get('dateField') as DateFieldType) ?? 'updated_at',
      from: sp.get('from') ?? '',
      to: sp.get('to') ?? '',
    },
  };
}

export function AdminDocumentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAppSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';

  // Read initial state from URL params on first mount (initializer functions avoid hydration flicker)
  const urlInit = readFiltersFromUrl(searchParams);

  const STATUS_FILTER_OPTIONS: { label: string; value: string }[] = [
    { label: t('admin_extra.status_all',            'All'),             value: '' },
    { label: t('admin_extra.status_awaiting_upload','Awaiting Upload'), value: 'awaiting_upload' },
    { label: t('admin_extra.status_pending_review', 'Pending Review'),  value: 'uploaded' },
    { label: t('admin_extra.status_processing',     'Processing'),      value: 'scanning' },
    { label: t('admin_extra.status_under_review',   'Under Review'),    value: 'under_review' },
    { label: t('admin_extra.status_approved',       'Approved'),        value: 'approved' },
    { label: t('admin_extra.status_rejected',       'Rejected'),        value: 'rejected' },
    { label: t('admin_extra.status_overdue',        'Overdue'),         value: 'overdue' },
  ];

  // ── Tab ─────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<TabType>(() => urlInit.tab);

  // ── Document Requests state ──────────────────────────────────────────────────
  const [stats, setStats]             = useState<DocumentRequestStats | null>(null);
  const [requests, setRequests]       = useState<DocumentRequest[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const [page, setPage]               = useState(() => urlInit.page);
  const [lastPage, setLastPage]       = useState(1);
  const [total, setTotal]             = useState(0);

  // Filters
  const [search, setSearch]           = useState(() => urlInit.search);
  const [statusFilter, setStatusFilter] = useState(() => urlInit.statusFilter);

  // ── Uploaded Documents state ─────────────────────────────────────────────────
  const [uploads, setUploads]                 = useState<AdminDocument[]>([]);
  const [uploadsLoading, setUploadsLoading]   = useState(false);
  const [uploadsError, setUploadsError]       = useState(false);
  const [uploadsPage, setUploadsPage]         = useState(() => urlInit.uploadsPage);
  const [uploadsLastPage, setUploadsLastPage] = useState(1);
  const [uploadsTotal, setUploadsTotal]       = useState(0);
  const [uploadsSearch, setUploadsSearch]     = useState(() => urlInit.uploadsSearch);
  const [uploadsDebouncedSearch, setUploadsDebouncedSearch] = useState(() => urlInit.uploadsSearch);
  const [uploadsStatusFilter, setUploadsStatusFilter] = useState(() => urlInit.uploadsStatusFilter);
  // Whether the uploads tab is showing the archived view
  const [showArchived, setShowArchived]       = useState(false);
  // Per-row action loading for archive/restore/delete
  const [archivingId, setArchivingId]         = useState<number | null>(null);
  const [restoringId, setRestoringId]         = useState<number | null>(null);
  const [deletingId, setDeletingId]           = useState<number | null>(null);
  // Delete confirmation modal target
  const [deleteTarget, setDeleteTarget]       = useState<AdminDocument | null>(null);
  // Preview modal target + authenticated blob URL (Submitted Documents tab)
  const [previewDoc, setPreviewDoc]           = useState<AdminDocument | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl]   = useState<string | null>(null);
  const [previewLoading, setPreviewLoading]   = useState(false);
  // Preview modal for Document Requests tab
  const [previewReq, setPreviewReq]           = useState<DocumentRequest | null>(null);
  const [previewReqBlobUrl, setPreviewReqBlobUrl] = useState<string | null>(null);
  const [previewReqLoading, setPreviewReqLoading] = useState(false);
  const uploadsSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [rejectTarget, setRejectTarget]         = useState<DocumentRequest | null>(null);
  const [extendTarget, setExtendTarget]         = useState<DocumentRequest | null>(null);
  const [cancelTarget, setCancelTarget]         = useState<DocumentRequest | null>(null);

  // Per-row action loading
  const [remindingId, setRemindingId]   = useState<number | null>(null);
  const [reuploadingId, setReuploadingId] = useState<number | null>(null);

  // Expanded instructions per row
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  function toggleExpand(id: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  // ── Per-page ─────────────────────────────────────────────────────────────────
  const [perPage, setPerPage] = useState(10);

  // ── Camper filter dropdown (for filter panel) ────────────────────────────────
  const [camperOptions, setCamperOptions]               = useState<{ id: number; name: string }[]>([]);
  const [camperDropdownSearch, setCamperDropdownSearch] = useState('');
  const [camperDropdownOpen, setCamperDropdownOpen]     = useState(false);
  const [datePickerOpen, setDatePickerOpen]             = useState(false);

  // Load camper list once for the filter dropdown
  useEffect(() => {
    getCampers({ page: 1 })
      .then((r) => setCamperOptions((r.data ?? []).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}` }))))
      .catch(() => {});
  }, []);

  // ── Advanced filters ─────────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersState>(() => urlInit.advancedFilters);
  const [debouncedAdvFilters, setDebouncedAdvFilters] = useState<AdvancedFiltersState>(() => urlInit.advancedFilters);
  const advFilterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters = !!(advancedFilters.camperId || advancedFilters.applicationNumber || advancedFilters.from || advancedFilters.to);

  function setAdvFilter(field: keyof AdvancedFiltersState, value: string) {
    setAdvancedFilters((prev) => ({ ...prev, [field]: value }));
  }

  useEffect(() => {
    if (advFilterTimer.current) clearTimeout(advFilterTimer.current);
    advFilterTimer.current = setTimeout(() => {
      setDebouncedAdvFilters({ ...advancedFilters });
      setPage(1);
      setUploadsPage(1);
    }, 300);
    return () => { if (advFilterTimer.current) clearTimeout(advFilterTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancedFilters.camperId, advancedFilters.applicationNumber, advancedFilters.dateField, advancedFilters.from, advancedFilters.to]);

  function clearAdvancedFilters() {
    setAdvancedFilters(DEFAULT_ADV_FILTERS);
  }

  // ── Multi-select / Bulk (requests only — no bulk approve/reject) ──────────────
  const [requestsSelected, setRequestsSelected] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading]           = useState(false);

  function toggleSelectRequest(id: number) {
    setRequestsSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleSelectAllRequests() {
    if (requestsSelected.size === requests.length) {
      setRequestsSelected(new Set());
    } else {
      setRequestsSelected(new Set(requests.map((r) => r.id)));
    }
  }

  async function handleBulkRemind() {
    const ids = Array.from(requestsSelected);
    if (ids.length === 0) return;
    setBulkLoading(true);
    try {
      const res = await bulkRemindDocumentRequests(ids);
      const ok = res.successful.length;
      const fail = res.failed.length;
      if (fail === 0) {
        toast.success(`Reminder sent to ${ok} request${ok !== 1 ? 's' : ''}`);
      } else {
        toast.warning(`Reminder sent to ${ok} of ${ids.length} — ${fail} failed`);
      }
      setRequestsSelected(new Set());
    } catch {
      toast.error('Bulk remind failed.');
    } finally {
      setBulkLoading(false);
    }
  }

  // ── Override / Reopen modals ─────────────────────────────────────────────────
  const [overrideTarget, setOverrideTarget] = useState<AdminDocument | null>(null);
  const [reopenTarget, setReopenTarget]     = useState<AdminDocument | null>(null);

  function handleOverrideDone(updated: AdminDocument) {
    setUploads((prev) => prev.map((d) => d.id === updated.id ? updated : d));
    setOverrideTarget(null);
    loadUploads();
    getDocumentRequestStats().then(setStats).catch(() => {});
  }

  function handleReopenDone(updated: AdminDocument) {
    setUploads((prev) => prev.map((d) => d.id === updated.id ? updated : d));
    setReopenTarget(null);
    loadUploads();
    getDocumentRequestStats().then(setStats).catch(() => {});
  }

  // Debounced search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      getDocumentRequestStats(),
      getDocumentRequests({
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        page,
        camper_id: debouncedAdvFilters.camperId ? Number(debouncedAdvFilters.camperId) : undefined,
        application_number: debouncedAdvFilters.applicationNumber || undefined, // String-not-number to match backend's CBG-YYYY-NNN format
        date_field: debouncedAdvFilters.dateField,
        from: debouncedAdvFilters.from || undefined,
        to: debouncedAdvFilters.to || undefined,
      }),
    ])
      .then(([s, r]) => {
        setStats(s);
        setRequests(r.data);
        setLastPage(r.meta?.last_page ?? 1);
        setTotal(r.meta?.total ?? 0);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [statusFilter, debouncedSearch, page, debouncedAdvFilters]);

  useEffect(() => { load(); }, [load]);

  // Debounced search for uploads tab
  useEffect(() => {
    if (uploadsSearchTimer.current) clearTimeout(uploadsSearchTimer.current);
    uploadsSearchTimer.current = setTimeout(() => {
      setUploadsDebouncedSearch(uploadsSearch);
      setUploadsPage(1);
    }, 350);
    return () => { if (uploadsSearchTimer.current) clearTimeout(uploadsSearchTimer.current); };
  }, [uploadsSearch]);

  const loadUploads = useCallback(() => {
    if (tab !== 'submitted' && tab !== 'reviewed') return;
    setUploadsLoading(true);
    setUploadsError(false);
    getAdminDocuments({
      page: uploadsPage,
      search: uploadsDebouncedSearch || undefined,
      verification_status: uploadsStatusFilter || undefined,
      include_archived: showArchived || undefined,
      camper_id: debouncedAdvFilters.camperId ? Number(debouncedAdvFilters.camperId) : undefined,
      application_number: debouncedAdvFilters.applicationNumber || undefined, // String-not-number to match backend's CBG-YYYY-NNN format
      date_field: debouncedAdvFilters.dateField,
      from: debouncedAdvFilters.from || undefined,
      to: debouncedAdvFilters.to || undefined,
    })
      .then((r) => {
        setUploads(r.data);
        setUploadsLastPage(r.meta?.last_page ?? 1);
        setUploadsTotal(r.meta?.total ?? 0);
      })
      .catch(() => setUploadsError(true))
      .finally(() => setUploadsLoading(false));
  }, [tab, uploadsPage, uploadsDebouncedSearch, uploadsStatusFilter, showArchived, debouncedAdvFilters]);

  useEffect(() => { loadUploads(); }, [loadUploads]);

  // When the tab switches between submitted/reviewed, derive the status filter
  // automatically so the user never sees a stale filter from the previous tab.
  useEffect(() => {
    if (tab === 'submitted') {
      setUploadsStatusFilter('pending');
      setUploadsPage(1);
    } else if (tab === 'reviewed') {
      setUploadsStatusFilter('approved');
      setUploadsPage(1);
    }
  }, [tab]);

  // Fetch the file as an authenticated blob whenever the preview modal opens.
  // Iframes and <img> tags make bare browser requests with no Authorization header,
  // so we can't use the raw API URL directly — it would be rejected with 401/403.
  // Instead we fetch via axios (which carries the Sanctum Bearer token) and create
  // a local object URL the browser can load without needing server auth.
  useEffect(() => {
    if (!previewDoc) {
      // Modal closing — revoke the previous blob URL to free memory
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    downloadAdminDocument(previewDoc.id)
      .then((blob) => {
        if (cancelled) return;
        setPreviewBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (!cancelled) setPreviewBlobUrl(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewDoc]);

  // Same blob-fetch pattern for Document Request previews.
  useEffect(() => {
    if (!previewReq?.download_url) {
      if (previewReqBlobUrl) {
        URL.revokeObjectURL(previewReqBlobUrl);
        setPreviewReqBlobUrl(null);
      }
      return;
    }
    let cancelled = false;
    setPreviewReqLoading(true);
    const path = previewReq.download_url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '');
    axiosInstance.get<Blob>(path, { responseType: 'blob' })
      .then(({ data }) => {
        if (cancelled) return;
        setPreviewReqBlobUrl(URL.createObjectURL(data));
      })
      .catch(() => { if (!cancelled) setPreviewReqBlobUrl(null); })
      .finally(() => { if (!cancelled) setPreviewReqLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewReq]);

  async function handleDownloadUpload(doc: AdminDocument) {
    try {
      const blob = await downloadAdminDocument(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed.');
    }
  }

  async function handleArchiveDoc(doc: AdminDocument) {
    setArchivingId(doc.id);
    try {
      await archiveDocument(doc.id);
      // Remove from active list; it now lives in the archived view
      setUploads((prev) => prev.filter((d) => d.id !== doc.id));
      setUploadsTotal((t) => t - 1);
      toast.success('Document archived.');
    } catch {
      toast.error('Archive failed.');
    } finally {
      setArchivingId(null);
    }
  }

  async function handleRestoreDoc(doc: AdminDocument) {
    setRestoringId(doc.id);
    try {
      await restoreDocument(doc.id);
      // Remove from archived list; it's now active again
      setUploads((prev) => prev.filter((d) => d.id !== doc.id));
      setUploadsTotal((t) => t - 1);
      toast.success('Document restored to active view.');
    } catch {
      toast.error('Restore failed.');
    } finally {
      setRestoringId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeletingId(id);
    setDeleteTarget(null);
    try {
      await deleteDocument(id);
      setUploads((prev) => prev.filter((d) => d.id !== id));
      setUploadsTotal((t) => t - 1);
      toast.success('Document permanently deleted.');
    } catch {
      toast.error('Delete failed.');
    } finally {
      setDeletingId(null);
    }
  }

  function handleMetricClick(status: string) {
    setStatusFilter((prev) => (prev === status ? '' : status));
    setPage(1);
  }

  function handleRejected(updated: DocumentRequest) {
    setRequests((prev) => prev.map((r) => r.id === updated.id ? updated : r));
    setRejectTarget(null);
    getDocumentRequestStats().then(setStats).catch(() => {});
  }

  async function handleDownload(req: DocumentRequest) {
    if (!req.download_url) return;
    try {
      const path = req.download_url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '');
      const res = await axiosInstance.get(path, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = req.uploaded_file_name ?? 'document';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed.');
    }
  }

  function handleCreated(req: DocumentRequest) {
    setShowRequestModal(false);
    setRequests((prev) => [req, ...prev]);
    setTotal((t) => t + 1);
    getDocumentRequestStats().then(setStats).catch(() => {});
  }

  async function handleRemind(req: DocumentRequest) {
    setRemindingId(req.id);
    try {
      await remindDocumentRequest(req.id);
      toast.success('Reminder sent successfully.');
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ?? 'Failed to send reminder.');
    } finally {
      setRemindingId(null);
    }
  }

  async function handleReupload(req: DocumentRequest) {
    setReuploadingId(req.id);
    try {
      const updated = await requestDocumentReupload(req.id);
      setRequests((prev) => prev.map((r) => r.id === req.id ? updated : r));
      toast.success('Resubmission requested. Applicant notified.');
      getDocumentRequestStats().then(setStats).catch(() => {});
    } catch {
      toast.error('Failed to request resubmission.');
    } finally {
      setReuploadingId(null);
    }
  }

  function handleExtended(updated: DocumentRequest) {
    setRequests((prev) => prev.map((r) => r.id === updated.id ? updated : r));
    setExtendTarget(null);
    getDocumentRequestStats().then(setStats).catch(() => {});
  }

  async function handleCancel(req: DocumentRequest) {
    try {
      await cancelDocumentRequest(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      setTotal((t) => t - 1);
      setCancelTarget(null);
      toast.success('Document request cancelled.');
      getDocumentRequestStats().then(setStats).catch(() => {});
    } catch {
      toast.error('Failed to cancel request.');
    }
  }

  // Status → action rules
  const canRemind = (status: DocumentRequestStatus) =>
    status === 'awaiting_upload' || status === 'uploaded' || status === 'overdue';

  const canReupload = (status: DocumentRequestStatus) =>
    status === 'rejected';

  // ── URL persistence — debounced write of filter state to query string ────────
  const urlSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current);
    urlSyncTimer.current = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const set = (k: string, v: string) => { if (v) next.set(k, v); else next.delete(k); };
        set('tab', tab);
        set('search', tab === 'requests' ? search : '');
        set('uploadsSearch', tab !== 'requests' ? uploadsSearch : '');
        set('statusFilter', statusFilter);
        set('uploadsStatusFilter', uploadsStatusFilter);
        set('page', page > 1 ? String(page) : '');
        set('uploadsPage', uploadsPage > 1 ? String(uploadsPage) : '');
        set('camperId', advancedFilters.camperId);
        set('applicationNumber', advancedFilters.applicationNumber);
        set('dateField', advancedFilters.dateField !== 'updated_at' ? advancedFilters.dateField : '');
        set('from', advancedFilters.from);
        set('to', advancedFilters.to);
        return next;
      }, { replace: true });
    }, 400);
    return () => { if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search, uploadsSearch, statusFilter, uploadsStatusFilter, page, uploadsPage, advancedFilters]);

  // ── Date type label helper ────────────────────────────────────────────────────
  function dateFieldLabel(field: DateFieldType): string {
    if (field === 'submitted_at') return t('admin_extra.filter_date_submitted', 'Submitted Date');
    if (field === 'due_date')    return t('admin_extra.filter_date_due', 'Due Date');
    return t('admin_extra.filter_date_activity', 'Last Activity');
  }

  // ── Derived filter display values ─────────────────────────────────────────
  const selectedCamper = camperOptions.find((c) => String(c.id) === advancedFilters.camperId);
  const filteredCamperOptions = camperDropdownSearch.trim()
    ? camperOptions.filter((c) => c.name.toLowerCase().includes(camperDropdownSearch.toLowerCase()))
    : camperOptions;
  const dateRangeLabel = advancedFilters.from || advancedFilters.to
    ? [advancedFilters.from, advancedFilters.to].filter(Boolean).join(' – ')
    : t('admin_extra.filter_date_range', 'Date Range');
  const hasAnyFilter = hasActiveFilters || !!statusFilter || !!search || !!uploadsSearch;

  // Active status filter for the unified filter panel — maps to the active tab's filter
  const activeStatusFilter = tab === 'requests' ? statusFilter : uploadsStatusFilter;
  function setActiveStatusFilter(v: string) {
    if (tab === 'requests') { setStatusFilter(v); setPage(1); }
    else { setUploadsStatusFilter(v); setUploadsPage(1); }
  }

  // ── "Clear all" full reset ────────────────────────────────────────────────────
  function handleClearAllFilters() {
    clearAdvancedFilters();
    setStatusFilter('');
    setUploadsStatusFilter(tab === 'submitted' ? 'pending' : 'approved');
    setSearch('');
    setUploadsSearch('');
    setPage(1);
    setUploadsPage(1);
  }

  return (
    <>
      {showRequestModal && (
        <RequestDocumentModal
          onClose={() => setShowRequestModal(false)}
          onCreated={handleCreated}
        />
      )}
      {rejectTarget && (
        <RejectModal
          requestId={rejectTarget.id}
          documentType={rejectTarget.document_type}
          onClose={() => setRejectTarget(null)}
          onRejected={handleRejected}
        />
      )}
      {extendTarget && (
        <ExtendDeadlineModal
          req={extendTarget}
          onClose={() => setExtendTarget(null)}
          onExtended={handleExtended}
        />
      )}
      {cancelTarget && (
        <CancelConfirmModal
          req={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancel}
        />
      )}
      {overrideTarget && (
        <OverrideModal
          doc={overrideTarget}
          onClose={() => setOverrideTarget(null)}
          onDone={handleOverrideDone}
        />
      )}
      {reopenTarget && (
        <ReopenModal
          doc={reopenTarget}
          onClose={() => setReopenTarget(null)}
          onDone={handleReopenDone}
        />
      )}

      {/* ── Delete confirmation modal ──────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full" style={{ background: 'rgba(239,68,68,0.10)' }}>
                <Trash2 className="h-5 w-5" style={{ color: '#dc2626' }} />
              </span>
              <div>
                <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
                  Delete document?
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  <strong className="font-medium" style={{ color: 'var(--foreground)' }}>{deleteTarget.file_name}</strong>
                  {' '}will be permanently removed. This action cannot be undone.
                </p>
                <p className="text-xs mt-2 px-2 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.10)', color: '#b45309' }}>
                  Tip: Use Archive instead to hide the document without deleting it.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors"
                style={{ background: '#dc2626' }}
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Document preview modal ─────────────────────────────────────────── */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-lg)', maxHeight: '90vh' }}>
            {/* Preview header */}
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                  {previewDoc.file_name}
                </span>
                {previewDoc.documentable_name && (
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    — {previewDoc.documentable_name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  title="Download"
                  onClick={() => void handleDownloadUpload(previewDoc)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* Preview body */}
            <div className="flex-1 overflow-hidden" style={{ minHeight: 400 }}>
              {previewLoading ? (
                <div className="flex items-center justify-center h-full p-8" style={{ color: 'var(--muted-foreground)' }}>
                  <RefreshCw className="h-6 w-6 animate-spin opacity-50" />
                </div>
              ) : !previewBlobUrl ? (
                <div className="flex flex-col items-center justify-center gap-3 p-8" style={{ color: 'var(--muted-foreground)' }}>
                  <AlertCircle className="h-8 w-8 opacity-40" />
                  <p className="text-sm">Could not load preview.</p>
                  <button
                    type="button"
                    onClick={() => void handleDownloadUpload(previewDoc)}
                    className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border font-medium"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <Download className="h-4 w-4" />
                    Download instead
                  </button>
                </div>
              ) : previewDoc.mime_type === 'application/pdf' ? (
                <iframe
                  src={previewBlobUrl}
                  title={previewDoc.file_name}
                  className="w-full"
                  style={{ border: 'none', height: '70vh' }}
                />
              ) : previewDoc.mime_type.startsWith('image/') ? (
                <div className="flex items-center justify-center p-4 h-full" style={{ background: 'var(--dash-bg)' }}>
                  <img
                    src={previewBlobUrl}
                    alt={previewDoc.file_name}
                    className="max-w-full max-h-full object-contain rounded-lg"
                    style={{ maxHeight: '65vh' }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-8" style={{ color: 'var(--muted-foreground)' }}>
                  <FileText className="h-12 w-12 opacity-40" />
                  <p className="text-sm">Preview not available for this file type ({previewDoc.mime_type}).</p>
                  <button
                    type="button"
                    onClick={() => void handleDownloadUpload(previewDoc)}
                    className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border font-medium"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <Download className="h-4 w-4" />
                    Download to view
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Document Request preview modal ──────────────────────────────────── */}
      {previewReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-lg)', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                  {previewReq.uploaded_file_name ?? previewReq.document_type}
                </span>
                {previewReq.camper_name && (
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    — {previewReq.camper_name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  title="Download"
                  onClick={() => void handleDownload(previewReq)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewReq(null)}
                  className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden" style={{ minHeight: 400 }}>
              {previewReqLoading ? (
                <div className="flex items-center justify-center h-full p-8" style={{ color: 'var(--muted-foreground)' }}>
                  <RefreshCw className="h-6 w-6 animate-spin opacity-50" />
                </div>
              ) : !previewReqBlobUrl ? (
                <div className="flex flex-col items-center justify-center gap-3 p-8" style={{ color: 'var(--muted-foreground)' }}>
                  <AlertCircle className="h-8 w-8 opacity-40" />
                  <p className="text-sm">Could not load preview.</p>
                  <button
                    type="button"
                    onClick={() => void handleDownload(previewReq)}
                    className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border font-medium"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <Download className="h-4 w-4" />
                    Download instead
                  </button>
                </div>
              ) : /\.pdf$/i.test(previewReq.uploaded_file_name ?? '') ? (
                <iframe
                  src={previewReqBlobUrl}
                  title={previewReq.uploaded_file_name ?? 'document'}
                  className="w-full"
                  style={{ border: 'none', height: '70vh' }}
                />
              ) : /\.(jpe?g|png|gif|webp|svg)$/i.test(previewReq.uploaded_file_name ?? '') ? (
                <div className="flex items-center justify-center p-4 h-full" style={{ background: 'var(--dash-bg)' }}>
                  <img
                    src={previewReqBlobUrl}
                    alt={previewReq.uploaded_file_name ?? 'document'}
                    className="max-w-full max-h-full object-contain rounded-lg"
                    style={{ maxHeight: '65vh' }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-8" style={{ color: 'var(--muted-foreground)' }}>
                  <FileText className="h-12 w-12 opacity-40" />
                  <p className="text-sm">Preview not available for this file type.</p>
                  <button
                    type="button"
                    onClick={() => void handleDownload(previewReq)}
                    className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border font-medium"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <Download className="h-4 w-4" />
                    Download to view
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5 max-w-6xl">

        {/* ═══════════════════════════════════════════════════════════
            Zone 1 — Header: title/subtitle left | request button right
        ════════════════════════════════════════════════════════════ */}
        <div className="flex items-start justify-between gap-4">
          {/* LEFT: title + subtitle */}
          <div>
            <h2 className="text-2xl font-headline font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
              {t('admin_extra.documents_heading', 'Document Control Center')}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin_extra.documents_subheading', 'Manage document requests, submissions, and system-wide document activity.')}
            </p>
          </div>

          {/* RIGHT: Request Document button (anchor preserved) */}
          <div className="flex-shrink-0">
            <Button
              size="sm"
              onClick={() => setShowRequestModal(true)}
              className="flex items-center gap-1.5"
              data-guide-anchor="admin-documents.create-request-button"
            >
              <Plus className="h-4 w-4" />
              {t('admin_extra.request_document_button', 'Request Document')}
            </Button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            Zone 2 — Metric cards
        ════════════════════════════════════════════════════════════ */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4" data-guide-anchor="admin-documents.metric-cards">
            <MetricCard label={t('admin_extra.status_overdue','Overdue')}                subtitle={t('admin_extra.subtitle_overdue','Needs attention')}        value={stats.overdue}         active={statusFilter === 'overdue'}         onClick={() => handleMetricClick('overdue')}          icon={AlertCircle} dotBg="rgba(220,38,38,0.10)"   dotFg="#dc2626" />
            <MetricCard label={t('admin_extra.status_awaiting_upload','Awaiting Upload')} subtitle={t('admin_extra.subtitle_awaiting_upload','Action needed')}  value={stats.awaiting_upload} active={statusFilter === 'awaiting_upload'} onClick={() => handleMetricClick('awaiting_upload')}  icon={CloudUpload}  dotBg="rgba(245,158,11,0.10)"  dotFg="#d97706" />
            <MetricCard label={t('admin_extra.metric_uploaded','Submitted')}             subtitle={t('admin_extra.subtitle_submitted','Waiting review')}      value={stats.uploaded}        active={statusFilter === 'uploaded'}        onClick={() => handleMetricClick('uploaded')}         icon={FileCheck}   dotBg="rgba(37,99,235,0.10)"   dotFg="#2563eb" />
            <MetricCard label={t('admin_extra.status_under_review','Under Review')}      subtitle={t('admin_extra.subtitle_under_review','In progress')}       value={stats.under_review}    active={statusFilter === 'under_review'}    onClick={() => handleMetricClick('under_review')}     icon={Clock}       dotBg="rgba(124,58,237,0.10)"  dotFg="#7c3aed" />
            <MetricCard label={t('admin_extra.status_approved','Approved')}              subtitle={t('admin_extra.subtitle_approved','Completed')}            value={stats.approved}        active={statusFilter === 'approved'}        onClick={() => handleMetricClick('approved')}         icon={CheckCircle} dotBg="rgba(22,163,74,0.10)"   dotFg="var(--forest-green)" />
            <MetricCard label={t('admin_extra.status_rejected','Rejected')}              subtitle={t('admin_extra.subtitle_rejected','Returned')}             value={stats.rejected}        active={statusFilter === 'rejected'}        onClick={() => handleMetricClick('rejected')}         icon={XCircle}     dotBg="rgba(107,114,128,0.10)" dotFg="#6b7280" />
            <MetricCard label={t('admin_extra.metric_total','Total')}                   subtitle={t('admin_extra.subtitle_total','Across all statuses')}   value={stats.total}           active={statusFilter === ''}               onClick={() => handleMetricClick('')}                 icon={FileText}    dotBg="rgba(107,114,128,0.10)" dotFg="#6b7280" />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            Zone 5 — Bulk action bar (Requests tab only, Send Reminder)
        ════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {tab === 'requests' && requestsSelected.size > 0 && (
            <motion.div
              key="bulk-requests"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-between px-4 py-2.5 rounded-2xl"
              style={{ background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.25)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {requestsSelected.size} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={() => void handleBulkRemind()}
                  className="px-3 py-1.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
                  style={{ background: 'var(--ember-orange)', color: '#fff' }}
                >
                  {bulkLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin inline" /> : t('admin_extra.bulk_remind', 'Send Reminder')}
                </button>
                <button type="button" onClick={() => setRequestsSelected(new Set())} className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors" style={{ color: 'var(--muted-foreground)' }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════════════════════════════════════════════════
            Zone 3 — Combined row: [Filters] [Search ~320px] …… [Tabs]
        ════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between gap-4 flex-wrap" data-guide-anchor="admin-documents.search-filters">
          {/* Left group: Filters + Search */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Filters button */}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex items-center gap-2 h-12 px-4 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            >
              <Filter className="h-4 w-4" />
              {t('admin_extra.filters_button', 'Filters')}
            </button>

            {/* Search input — fixed medium width, wires to the active tab's search state */}
            <div className="relative w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
              <input
                type="text"
                placeholder={t('admin_extra.header_search_placeholder', 'Search camper, parent, or document…')}
                value={tab === 'requests' ? search : uploadsSearch}
                onChange={(e) => tab === 'requests' ? setSearch(e.target.value) : setUploadsSearch(e.target.value)}
                className="w-full h-12 pl-10 pr-4 rounded-lg border text-base outline-none transition-colors focus:bg-[rgba(34,197,94,0.08)] bg-[var(--input)]"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>
          </div>

          {/* Right group: Tabs anchored above the table */}
          <div className="flex items-center" data-guide-anchor="admin-documents.tabs">
            {([
              { key: 'requests',  label: t('admin_extra.tab_requests',  'Document Requests') },
              { key: 'submitted', label: t('admin_extra.tab_submitted', 'Submitted Documents') },
              { key: 'reviewed',  label: t('admin_extra.tab_reviewed',  'Reviewed / Processed') },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className="px-3 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap"
                style={{
                  color: tab === key ? 'var(--foreground)' : 'var(--muted-foreground)',
                  borderColor: tab === key ? 'var(--ember-orange)' : 'transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter inline panel — slides open when showFilters is true */}
        {showFilters && (
          <div className="rounded-xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>

            {/* Status dropdown */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                {t('admin_extra.filter_status', 'Status')}
              </label>
              <select
                value={activeStatusFilter}
                onChange={(e) => setActiveStatusFilter(e.target.value)}
                className="rounded-lg h-12 px-4 text-base border outline-none focus:bg-[rgba(34,197,94,0.08)] bg-[var(--input)]"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Camper dropdown with inline search */}
            <div className="flex flex-col gap-1 relative">
              <label className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                {t('admin_extra.filter_camper', 'Camper')}
              </label>
              <button
                type="button"
                onClick={() => setCamperDropdownOpen((v) => !v)}
                className="flex items-center justify-between rounded-lg h-12 px-4 text-base border outline-none text-left"
                style={{ background: 'var(--input)', borderColor: camperDropdownOpen ? 'var(--forest-green)' : 'var(--border)', color: 'var(--foreground)' }}
              >
                <span className="truncate">{selectedCamper ? selectedCamper.name : 'All Campers'}</span>
                <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${camperDropdownOpen ? 'rotate-90' : ''}`} style={{ color: 'var(--muted-foreground)' }} />
              </button>
              {camperDropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                  <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
                    <input
                      type="text"
                      placeholder="Filter campers…"
                      value={camperDropdownSearch}
                      onChange={(e) => setCamperDropdownSearch(e.target.value)}
                      className="w-full h-12 px-4 text-base rounded-lg outline-none focus:bg-[rgba(34,197,94,0.08)] bg-[var(--input)]"
                      style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
                    />
                  </div>
                  <ul className="max-h-48 overflow-y-auto">
                    <li>
                      <button type="button" onMouseDown={() => { setAdvFilter('camperId', ''); setCamperDropdownOpen(false); setCamperDropdownSearch(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--dash-nav-hover-bg)] transition-colors" style={{ color: !advancedFilters.camperId ? 'var(--ember-orange)' : 'var(--muted-foreground)' }}>
                        All Campers
                      </button>
                    </li>
                    {filteredCamperOptions.map((c) => (
                      <li key={c.id}>
                        <button type="button" onMouseDown={() => { setAdvFilter('camperId', String(c.id)); setCamperDropdownOpen(false); setCamperDropdownSearch(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--dash-nav-hover-bg)] transition-colors" style={{ color: advancedFilters.camperId === String(c.id) ? 'var(--ember-orange)' : 'var(--foreground)' }}>
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Date filter — combined date-type selector + range popover so the user
                always sees which column the From/To bounds apply to. Popover trigger
                reads "<Date Field> · From – To" (e.g. "Submitted Date · Apr 1 – Apr 24"). */}
            <div className="flex flex-col gap-1 relative">
              <label className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                {t('admin_extra.filter_date', 'Filter by date')}
              </label>
              <button
                type="button"
                onClick={() => setDatePickerOpen((v) => !v)}
                className="flex items-center justify-between rounded-lg h-12 px-4 text-base border outline-none text-left"
                style={{ background: 'var(--input)', borderColor: datePickerOpen ? 'var(--forest-green)' : 'var(--border)', color: (advancedFilters.from || advancedFilters.to) ? 'var(--foreground)' : 'var(--muted-foreground)' }}
              >
                <span className="truncate">
                  {(advancedFilters.from || advancedFilters.to)
                    ? `${dateFieldLabel(advancedFilters.dateField)} · ${dateRangeLabel}`
                    : t('admin_extra.filter_date_placeholder', 'Filter by date…')}
                </span>
                <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${datePickerOpen ? 'rotate-90' : ''}`} style={{ color: 'var(--muted-foreground)' }} />
              </button>
              {datePickerOpen && (
                <div className="absolute top-full left-0 z-20 mt-1 rounded-xl border p-3 flex flex-col gap-3" style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 240 }}>
                  {/* Date-type selector at the top so the From/To below are visually subordinate to it */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                      {t('admin_extra.filter_date_type', 'Filter on')}
                    </label>
                    <select
                      value={advancedFilters.dateField}
                      onChange={(e) => setAdvFilter('dateField', e.target.value)}
                      className="rounded-lg h-10 px-3 text-sm border outline-none focus:bg-[rgba(34,197,94,0.08)] bg-[var(--input)]"
                      style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    >
                      <option value="submitted_at">{t('admin_extra.filter_date_submitted', 'Submitted Date')}</option>
                      <option value="updated_at">{t('admin_extra.filter_date_activity', 'Last Activity')}</option>
                      {tab === 'requests' && (
                        <option value="due_date">{t('admin_extra.filter_date_due', 'Due Date')}</option>
                      )}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                      {t('admin_extra.filter_from_dynamic', 'From')} {dateFieldLabel(advancedFilters.dateField)}
                    </label>
                    <input type="date" value={advancedFilters.from} onChange={(e) => setAdvFilter('from', e.target.value)} className="rounded-lg h-10 px-3 text-sm border outline-none focus:bg-[rgba(34,197,94,0.08)] bg-[var(--input)]" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                      {t('admin_extra.filter_to_dynamic', 'To')} {dateFieldLabel(advancedFilters.dateField)}
                    </label>
                    <input type="date" value={advancedFilters.to} onChange={(e) => setAdvFilter('to', e.target.value)} className="rounded-lg h-10 px-3 text-sm border outline-none focus:bg-[rgba(34,197,94,0.08)] bg-[var(--input)]" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    {(advancedFilters.from || advancedFilters.to) ? (
                      <button type="button" onClick={() => { setAdvFilter('from', ''); setAdvFilter('to', ''); }} className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                        {t('admin_extra.filter_clear_dates', 'Clear dates')}
                      </button>
                    ) : <span />}
                    <button type="button" onClick={() => setDatePickerOpen(false)} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'var(--ember-orange)', color: '#fff' }}>
                      {t('admin_extra.filter_done', 'Done')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Application Number input */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                {t('admin_extra.filter_application', 'Application Number')}
              </label>
              <input
                type="text"
                placeholder={t('admin_extra.filter_application_placeholder', 'e.g. CBG-2026-001')}
                value={advancedFilters.applicationNumber}
                onChange={(e) => setAdvFilter('applicationNumber', e.target.value)}
                className="rounded-lg h-12 px-4 text-base border outline-none focus:bg-[rgba(34,197,94,0.08)] bg-[var(--input)]"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              />
            </div>

            {/* Archived toggle — only on submitted/reviewed tabs */}
            {(tab === 'submitted' || tab === 'reviewed') && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>View</span>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => { setShowArchived(false); setUploadsPage(1); }} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-medium transition-colors" style={{ background: !showArchived ? 'var(--ember-orange)' : 'var(--card)', borderColor: !showArchived ? 'var(--ember-orange)' : 'var(--border)', color: !showArchived ? '#fff' : 'var(--muted-foreground)' }}>
                    <FileText className="h-3.5 w-3.5" />Active
                  </button>
                  <button type="button" onClick={() => { setShowArchived(true); setUploadsPage(1); }} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-medium transition-colors" style={{ background: showArchived ? 'var(--ember-orange)' : 'var(--card)', borderColor: showArchived ? 'var(--ember-orange)' : 'var(--border)', color: showArchived ? '#fff' : 'var(--muted-foreground)' }}>
                    <Archive className="h-3.5 w-3.5" />Archived
                  </button>
                </div>
              </div>
            )}

            {/* Reviewed tab status pills — keep them accessible inside filter panel */}
            {tab === 'reviewed' && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Decision</span>
                <div className="flex items-center gap-1.5">
                  {[{ label: t('admin_extra.status_approved','Approved'), value: 'approved' }, { label: t('admin_extra.status_rejected','Rejected'), value: 'rejected' }].map((opt) => (
                    <button key={opt.value} type="button" onClick={() => { setUploadsStatusFilter(opt.value); setUploadsPage(1); }} className="text-xs px-3 py-2 rounded-lg border font-medium transition-colors" style={{ background: uploadsStatusFilter === opt.value ? 'var(--ember-orange)' : 'var(--card)', borderColor: uploadsStatusFilter === opt.value ? 'var(--ember-orange)' : 'var(--border)', color: uploadsStatusFilter === opt.value ? '#fff' : 'var(--foreground)' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            </div>{/* end grid */}

            {/* Clear all — below grid so it doesn't consume a column track */}
            {hasAnyFilter && (
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-xs font-medium px-3 py-2 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                >
                  {t('admin_extra.filter_clear_all', 'Clear all filters')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            Active filter chips strip
        ════════════════════════════════════════════════════════════ */}
        {(() => {
          // Build the list of active chips
          const activeSearch = tab === 'requests' ? search : uploadsSearch;
          const activeStatusVal = tab === 'requests' ? statusFilter : uploadsStatusFilter;
          // Human label for the active status value
          const statusLabel = STATUS_FILTER_OPTIONS.find((o) => o.value === activeStatusVal)?.label ?? activeStatusVal;
          // Human label for date range prefix
          const datePrefixLabel = dateFieldLabel(advancedFilters.dateField);

          type Chip = { key: string; label: string; onClear: () => void };
          const chips: Chip[] = [];

          if (activeStatusVal) {
            chips.push({
              key: 'status',
              label: `${t('admin_extra.chip_status', 'Status')}: ${statusLabel}`,
              onClear: () => setActiveStatusFilter(''),
            });
          }
          if (advancedFilters.camperId && selectedCamper) {
            chips.push({
              key: 'camper',
              label: `${t('admin_extra.chip_camper', 'Camper')}: ${selectedCamper.name}`,
              onClear: () => setAdvFilter('camperId', ''),
            });
          }
          if (advancedFilters.applicationNumber) {
            chips.push({
              key: 'appNumber',
              label: `${t('admin_extra.chip_application', 'Application')}: ${advancedFilters.applicationNumber}`,
              onClear: () => setAdvFilter('applicationNumber', ''),
            });
          }
          if (advancedFilters.from || advancedFilters.to) {
            const rangeText = [advancedFilters.from, advancedFilters.to].filter(Boolean).join(' – ');
            chips.push({
              key: 'dateRange',
              label: `${datePrefixLabel}: ${rangeText}`,
              onClear: () => { setAdvFilter('from', ''); setAdvFilter('to', ''); },
            });
          }
          if (activeSearch) {
            chips.push({
              key: 'search',
              label: `${t('admin_extra.chip_search', 'Search')}: "${activeSearch}"`,
              onClear: () => tab === 'requests' ? setSearch('') : setUploadsSearch(''),
            });
          }

          if (chips.length === 0) return null;

          return (
            <div className="flex items-center flex-wrap gap-2">
              {chips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                  style={{ background: 'var(--dash-bg)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                >
                  {chip.label}
                  <button
                    type="button"
                    aria-label={`Remove ${chip.key} filter`}
                    onClick={chip.onClear}
                    className="flex-shrink-0 rounded hover:bg-[var(--dash-nav-hover-bg)] transition-colors ml-0.5"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="text-xs font-medium px-2 py-1 rounded-md transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {t('admin_extra.filter_clear_all', 'Clear all filters')}
              </button>
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════
            Submitted / Reviewed tab content
        ════════════════════════════════════════════════════════════ */}
        {(tab === 'submitted' || tab === 'reviewed') && (
          <>
            {/* Uploads table */}
            <div className="overflow-x-auto">
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>

              {/* Sticky header row */}
              <div className="grid items-center gap-4 px-5 py-3 border-b text-xs font-semibold uppercase tracking-wide" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.5fr) minmax(80px, 0.6fr)', borderColor: 'var(--border)', background: 'var(--dash-bg)', color: 'var(--muted-foreground)' }}>
                <span className="min-w-0">{t('admin_extra.col_camper_parent','Camper / Parent')}</span>
                <span className="min-w-0">{t('admin_extra.col_document','Document')}</span>
                <span>{t('admin_extra.doc_col_status','Status')}</span>
                <span>{t('admin_extra.doc_col_last_activity','Last Activity')}</span>
                <span className="text-right">{t('admin_extra.doc_col_actions','Actions')}</span>
              </div>

              {uploadsLoading ? (
                <div className="p-4"><div className="h-64 flex items-center justify-center" style={{ color: 'var(--muted-foreground)' }}><RefreshCw className="h-5 w-5 animate-spin opacity-40" /></div></div>
              ) : uploadsError ? (
                <ErrorState onRetry={loadUploads} />
              ) : uploads.length === 0 ? (
                <EmptyState
                  title={tab === 'submitted' ? t('admin_extra.empty_no_submitted','No submitted documents awaiting review') : t('admin_extra.empty_no_reviewed','No reviewed documents yet')}
                  description={uploadsSearch || uploadsStatusFilter ? t('admin_extra.empty_no_filter_match','No documents match your filters.') : tab === 'submitted' ? t('admin_extra.empty_submitted_hint','Documents appear here as soon as applicants submit them.') : t('admin_extra.empty_reviewed_hint','Approved and rejected documents appear here.')}
                  icon={FileText}
                />
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {uploads.map((doc) => {
                    const camperName = doc.documentable_name ?? doc.uploaded_by_name ?? '—';
                    const parentName = doc.uploaded_by_name ?? '—';
                    const docSize = doc.size != null
                      ? (doc.size < 1024 * 1024 ? `${(doc.size / 1024).toFixed(0)} KB` : `${(doc.size / 1024 / 1024).toFixed(1)} MB`)
                      : null;
                    const dateRef = doc.submitted_at ?? doc.created_at;
                    const { text: relText, color: relColor } = relativeFromNow(dateRef, doc.verification_status);

                    // Context-aware overflow menu for document rows
                    const docOverflowItems: OverflowMenuItem[] = [];
                    docOverflowItems.push({ label: t('admin_extra.menu_view_document','View Document'), icon: ZoomIn, onClick: () => setPreviewDoc(doc) });
                    docOverflowItems.push({ label: t('admin_extra.menu_download','Download'), icon: Download, onClick: () => void handleDownloadUpload(doc) });
                    if (doc.application_id) {
                      docOverflowItems.push({
                        label: t('admin_extra.menu_open_application','Open Application'),
                        icon: ExternalLink,
                        onClick: () => navigate(isSuperAdmin ? ROUTES.SUPER_ADMIN_APPLICATION_EDIT(doc.application_id!) : ROUTES.ADMIN_APPLICATION_DETAIL(doc.application_id!)),
                      });
                    }
                    if (!showArchived) {
                      docOverflowItems.push({ label: t('admin_extra.menu_archive','Archive'), icon: Archive, onClick: () => void handleArchiveDoc(doc), disabled: archivingId === doc.id });
                    } else {
                      docOverflowItems.push({ label: t('admin_extra.menu_restore','Restore'), icon: ArchiveRestore, onClick: () => void handleRestoreDoc(doc), disabled: restoringId === doc.id });
                    }
                    if (isSuperAdmin && doc.verification_status !== 'pending') {
                      docOverflowItems.push({ label: t('admin_extra.menu_override','Override decision'), icon: Shield, onClick: () => setOverrideTarget(doc) });
                      docOverflowItems.push({ label: t('admin_extra.menu_reopen','Reopen for review'), icon: RotateCcw, onClick: () => setReopenTarget(doc) });
                    }
                    docOverflowItems.push({ label: t('admin_extra.menu_delete','Delete'), icon: Trash2, onClick: () => setDeleteTarget(doc), danger: true, disabled: deletingId === doc.id });

                    return (
                      <li key={doc.id} className="group grid items-center gap-4 px-5 py-4 border-b last:border-b-0 hover:bg-[var(--dash-nav-hover-bg)] transition-colors" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.5fr) minmax(80px, 0.6fr)' }}>

                        {/* Col 1: avatar + people */}
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={camperName} size="sm" fallbackColor={avatarBg(camperName)} />
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{camperName}</span>
                            <span className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                              {t('admin_extra.uploaded_by_label','Uploaded by:')} {parentName}
                            </span>
                            {doc.requested_by_name && (
                              <span className="text-[11px] truncate" style={{ color: 'var(--muted-foreground)' }} title={doc.requested_by_name}>
                                Requested by: {doc.requested_by_name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Col 2: document */}
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(234,88,12,0.08)' }}>
                            <FileText className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{formatDocumentType(doc.document_type)}</span>
                            {docSize && <span className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{doc.mime_type?.split('/')[1]?.toUpperCase() ?? 'FILE'} · {docSize}</span>}
                          </div>
                        </div>

                        {/* Col 3: status badge */}
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium self-start"
                            style={{ background: doc.verification_status === 'approved' ? 'rgba(5,150,105,0.10)' : doc.verification_status === 'rejected' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: doc.verification_status === 'approved' ? 'var(--forest-green)' : doc.verification_status === 'rejected' ? '#dc2626' : '#b45309' }}>
                            {doc.verification_status === 'approved' ? <CheckCircle className="h-3 w-3" /> : doc.verification_status === 'rejected' ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {doc.verification_status === 'approved' ? t('admin_extra.status_approved','Approved') : doc.verification_status === 'rejected' ? t('admin_extra.status_rejected','Rejected') : t('admin_extra.status_pending','Pending')}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium self-start"
                            title={doc.scan_passed === true ? 'Antivirus scan passed' : doc.scan_passed === false ? 'Antivirus scan failed' : 'Scan pending'}
                            style={{ background: doc.scan_passed === true ? 'rgba(5,150,105,0.10)' : doc.scan_passed === false ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: doc.scan_passed === true ? 'var(--forest-green)' : doc.scan_passed === false ? '#dc2626' : '#b45309' }}>
                            {doc.scan_passed === true ? <><Shield className="h-3 w-3" />{t('admin_extra.scan_passed','Clean')}</> : doc.scan_passed === false ? <><XCircle className="h-3 w-3" />{t('admin_extra.scan_failed','Threat')}</> : <><Clock className="h-3 w-3" />{t('admin_extra.scan_pending','Scanning')}</>}
                          </span>
                        </div>

                        {/* Col 4: last activity date */}
                        <div className="flex flex-col items-start">
                          <span className="text-sm whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                            {dateRef ? format(new Date(dateRef), 'MMM d, yyyy') : '—'}
                          </span>
                          <span className="text-xs" style={{ color: relColor }}>{relText}</span>
                        </div>

                        {/* Col 5: actions */}
                        <div className="flex items-center gap-0.5 justify-end">
                          <button type="button" title="Preview" onClick={() => setPreviewDoc(doc)} className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors" style={{ color: 'var(--muted-foreground)' }}>
                            <ZoomIn className="h-4 w-4" />
                          </button>
                          <OverflowMenu items={docOverflowItems} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            </div>

            {/* Uploads pagination — numbered */}
            {(uploadsLastPage > 1 || uploadsTotal > 0) && (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {uploadsTotal} document{uploadsTotal !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" disabled={uploadsPage <= 1} onClick={() => setUploadsPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <PageNumbers page={uploadsPage} lastPage={uploadsLastPage} onPageChange={setUploadsPage} />
                  <Button variant="ghost" size="sm" disabled={uploadsPage >= uploadsLastPage} onClick={() => setUploadsPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <select
                    value={perPage}
                    onChange={(e) => { setPerPage(Number(e.target.value)); setUploadsPage(1); }}
                    className="rounded-lg px-2 py-1.5 text-xs border outline-none"
                    style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n} per page</option>)}
                  </select>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════
            Requests tab content
        ════════════════════════════════════════════════════════════ */}
        {tab === 'requests' && (
          <>
            {/* Requests table — strict CSS grid layout */}
            <div className="overflow-x-auto">
            <div className="rounded-2xl overflow-hidden" data-guide-anchor="admin-documents.requests-table" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

              {/* Sticky header */}
              <div className="grid items-center gap-4 px-5 py-3 border-b text-xs font-semibold uppercase tracking-wide" style={{ gridTemplateColumns: '40px minmax(0, 2fr) minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.5fr) minmax(80px, 0.6fr)', borderColor: 'var(--border)', background: 'var(--dash-bg)', color: 'var(--muted-foreground)' }}>
                <div>
                  <input type="checkbox" aria-label="Select all requests" checked={requestsSelected.size > 0 && requestsSelected.size === requests.length} onChange={toggleSelectAllRequests} className="h-4 w-4 rounded cursor-pointer" style={{ accentColor: 'var(--ember-orange)' }} />
                </div>
                <span className="min-w-0">{t('admin_extra.col_camper_parent','Camper / Parent')}</span>
                <span className="min-w-0">{t('admin_extra.col_document','Document')}</span>
                <span data-guide-anchor="admin-documents.status-column">{t('admin_extra.doc_col_status','Status')}</span>
                <span>{t('admin_extra.col_due_date','Due Date')}</span>
                <span data-guide-anchor="admin-documents.last-activity-column">{t('admin_extra.col_last_activity','Last Activity')}</span>
                <span className="text-right" data-guide-anchor="admin-documents.actions-column">{t('admin_extra.doc_col_actions','Actions')}</span>
              </div>

              {loading ? (
                <div className="p-4"><div className="h-64 flex items-center justify-center" style={{ color: 'var(--muted-foreground)' }}><RefreshCw className="h-5 w-5 animate-spin opacity-40" /></div></div>
              ) : error ? (
                <ErrorState onRetry={load} />
              ) : requests.length === 0 ? (
                statusFilter || debouncedSearch ? (
                  <EmptyState title={t('admin_extra.empty_no_requests','No document requests')} description={t('admin_extra.empty_no_filter_match','No requests match your filters.')} icon={FileText} />
                ) : (
                  <EmptyState
                    title={t('admin_extra.empty_no_activity','No document activity yet')}
                    description={t('admin_extra.empty_activity_hint',"Use 'Request Document' to initiate document workflows.")}
                    icon={FileText}
                    action={{ label: t('admin_extra.request_document_button','Request Document'), onClick: () => setShowRequestModal(true) }}
                  />
                )
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {requests
                    .slice()
                    .sort((a, b) => {
                      const aName = (a.camper_name ?? '').toLowerCase();
                      const bName = (b.camper_name ?? '').toLowerCase();
                      if (aName !== bName) return aName.localeCompare(bName);
                      return (b.created_at ?? '').localeCompare(a.created_at ?? '');
                    })
                    .map((req) => {
                      const hasDetails = !!(req.instructions || req.rejection_reason);
                      const awaitingOrOverdue = canRemind(req.status);
                      const camperDisplayName = req.camper_name ?? req.applicant_name ?? '—';
                      const { text: relText, color: relColor } = relativeFromNow(req.due_date ?? req.created_at, req.status === 'approved' ? 'approved' : req.status === 'rejected' ? 'rejected' : undefined);

                      // Context-aware overflow menu for request rows
                      const overflowItems: OverflowMenuItem[] = [];
                      if (req.download_url) {
                        overflowItems.push({ label: t('admin_extra.menu_view_document','View Document'), icon: Eye, onClick: () => setPreviewReq(req) });
                        overflowItems.push({ label: t('admin_extra.menu_download','Download'), icon: Download, onClick: () => void handleDownload(req) });
                      }
                      if (req.application_id) {
                        overflowItems.push({
                          label: t('admin_extra.menu_open_review','Open Review Page'),
                          icon: ExternalLink,
                          onClick: () => navigate(isSuperAdmin ? ROUTES.SUPER_ADMIN_APPLICATION_DETAIL(req.application_id!) : ROUTES.ADMIN_APPLICATION_DETAIL(req.application_id!)),
                        });
                      }
                      if (canRemind(req.status)) {
                        overflowItems.push({ label: t('admin_extra.menu_send_reminder','Send Reminder'), icon: Bell, onClick: () => void handleRemind(req), disabled: remindingId === req.id });
                        overflowItems.push({ label: t('admin_extra.doc_extend_deadline','Extend Deadline'), icon: CalendarClock, onClick: () => setExtendTarget(req) });
                        overflowItems.push({ label: t('admin_extra.doc_cancel_request','Cancel Request'), icon: Trash2, onClick: () => setCancelTarget(req), danger: true });
                      }
                      if (canReupload(req.status)) {
                        overflowItems.push({ label: t('admin_extra.request_resubmission','Request Resubmission'), icon: RotateCcw, onClick: () => void handleReupload(req), disabled: reuploadingId === req.id });
                      }
                      if (hasDetails) {
                        overflowItems.push({ label: t('admin_extra.view_details','View Details'), icon: Eye, onClick: () => toggleExpand(req.id) });
                      }

                      return (
                        <Fragment key={req.id}>
                          {/* Row — strict 7-column grid */}
                          <li className="group grid items-center gap-4 px-5 py-4 border-b last:border-b-0 hover:bg-[var(--dash-nav-hover-bg)] transition-colors" style={{ gridTemplateColumns: '40px minmax(0, 2fr) minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.5fr) minmax(80px, 0.6fr)' }}>
                            {/* Col 1: Checkbox */}
                            <div>
                              <input
                                type="checkbox"
                                aria-label={`Select ${req.document_type}`}
                                checked={requestsSelected.has(req.id)}
                                onChange={() => toggleSelectRequest(req.id)}
                                className="h-4 w-4 rounded cursor-pointer transition-opacity"
                                style={{ accentColor: 'var(--ember-orange)', opacity: requestsSelected.has(req.id) || requestsSelected.size > 0 ? 1 : 0 }}
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={(e) => { if (!requestsSelected.has(req.id) && requestsSelected.size === 0) e.currentTarget.style.opacity = '0'; }}
                              />
                            </div>

                            {/* Col 2: Camper / Parent */}
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar name={camperDisplayName} size="sm" fallbackColor={avatarBg(camperDisplayName)} />
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{req.camper_name ?? req.applicant_name}</span>
                                <span className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>Parent: {req.applicant_name}</span>
                                {req.requested_by_name && (
                                  <span className="text-[11px] truncate" style={{ color: 'var(--muted-foreground)' }} title={req.requested_by_name}>
                                    Requested by: {req.requested_by_name}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Col 3: Document */}
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(234,88,12,0.08)' }}>
                                <FileText className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{req.document_type}</span>
                                {req.uploaded_file_name && (
                                  <span className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{req.uploaded_file_name}</span>
                                )}
                              </div>
                            </div>

                            {/* Col 4: Status badge */}
                            <div>
                              <StatusBadge status={req.status} />
                            </div>

                            {/* Col 5: Due date */}
                            <div className="flex flex-col items-start">
                              <span className="text-sm whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                                {req.due_date ? format(new Date(req.due_date), 'MMM d, yyyy') : '—'}
                              </span>
                              {req.due_date && <span className="text-xs" style={{ color: relColor }}>{relText}</span>}
                            </div>

                            {/* Col 6: Last activity */}
                            <div className="flex flex-col items-start">
                              {(() => {
                                const ref = req.reviewed_at ?? req.uploaded_at ?? req.created_at;
                                if (!ref) return <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>—</span>;
                                const verb =
                                  req.status === 'approved' ? t('admin_extra.activity_approved','Approved')
                                  : req.status === 'rejected' ? t('admin_extra.activity_rejected','Rejected')
                                  : req.status === 'under_review' ? t('admin_extra.activity_under_review','Under review')
                                  : (req.status === 'uploaded' || req.status === 'scanning') ? t('admin_extra.activity_submitted','Submitted')
                                  : t('admin_extra.activity_requested','Requested');
                                return (
                                  <>
                                    <span className="text-sm whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                                      {format(new Date(ref), 'MMM d, yyyy')}
                                    </span>
                                    <span className="text-xs whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                                      {verb} {formatDistanceToNow(new Date(ref), { addSuffix: true })}
                                    </span>
                                  </>
                                );
                              })()}
                            </div>

                            {/* Col 7: Actions */}
                            <div className="flex items-center gap-0.5 justify-end">
                              {/* Awaiting/overdue: Bell is always-visible primary action */}
                              {awaitingOrOverdue && (
                                <button type="button" title="Send reminder" disabled={remindingId === req.id} onClick={() => void handleRemind(req)} className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors" style={{ color: req.status === 'overdue' ? '#dc2626' : 'var(--ember-orange)' }}>
                                  <Bell className="h-4 w-4" />
                                </button>
                              )}
                              {/* View details toggle — for rows with instructions/rejection */}
                              {!awaitingOrOverdue && hasDetails && (
                                <button type="button" title={expandedRows.has(req.id) ? 'Hide details' : 'View details'} onClick={() => toggleExpand(req.id)} className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors" style={{ color: expandedRows.has(req.id) ? 'var(--ember-orange)' : 'var(--muted-foreground)' }}>
                                  <Eye className="h-4 w-4" />
                                </button>
                              )}
                              <OverflowMenu items={overflowItems} />
                            </div>
                          </li>

                          {/* Instructions / rejection detail row */}
                          {expandedRows.has(req.id) && (req.instructions || req.rejection_reason) && (
                            <li className="px-5 pb-4 pt-1 text-xs border-t" style={{ background: 'var(--dash-bg)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                              {req.rejection_reason && (
                                <p className="font-medium" style={{ color: '#dc2626' }}>
                                  <strong>{t('admin_extra.doc_rejection_reason','Rejection reason:')}</strong> {req.rejection_reason}
                                </p>
                              )}
                              {req.instructions && (
                                <p className={req.rejection_reason ? 'mt-1' : ''}>
                                  <strong style={{ color: 'var(--foreground)' }}>{t('admin_extra.instructions_label','Instructions:')}</strong> {req.instructions}
                                </p>
                              )}
                            </li>
                          )}

                          {/* Mobile fallback */}
                          <li className="md:hidden px-4 py-3 flex flex-col gap-1" style={{ display: 'none' }}>
                            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{req.applicant_name}</span>
                            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{req.document_type}</span>
                            <StatusBadge status={req.status} />
                          </li>
                        </Fragment>
                      );
                    })}
                </ul>
              )}
            </div>
            </div>

            {/* Requests pagination — numbered */}
            {(lastPage > 1 || total > 0) && (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {total} request{total !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <PageNumbers page={page} lastPage={lastPage} onPageChange={setPage} />
                  <Button variant="ghost" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <select
                    value={perPage}
                    onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                    className="rounded-lg px-2 py-1.5 text-xs border outline-none"
                    style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n} per page</option>)}
                  </select>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
