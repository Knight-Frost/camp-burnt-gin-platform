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

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FC, type FormEvent } from 'react';
import { toast } from 'sonner';
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
  User,
  FileCheck,
  Bell,
  CalendarClock,
  Trash2,
  RotateCcw,
  MoreVertical,
} from 'lucide-react';
import { format } from 'date-fns';

import {
  getDocumentRequestStats,
  getDocumentRequests,
  createDocumentRequest,
  approveDocumentRequest,
  rejectDocumentRequest,
  cancelDocumentRequest,
  remindDocumentRequest,
  extendDocumentRequestDeadline,
  requestDocumentReupload,
  getUsers,
  getAdminDocuments,
  verifyDocument,
  downloadAdminDocument,
  type AdminDocument,
  type DocumentRequest,
  type DocumentRequestStats,
  type DocumentRequestStatus,
} from '@/features/admin/api/admin.api';
import { axiosInstance } from '@/api/axios.config';
import { Button } from '@/ui/components/Button';
import { EmptyState, ErrorState } from '@/ui/components/EmptyState';
import { SkeletonTable } from '@/ui/components/Skeletons';

// ── Status badge helpers ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  DocumentRequestStatus,
  { label: string; bg: string; color: string; icon: FC<{ className?: string }> }
> = {
  awaiting_upload: { label: 'Awaiting Upload', bg: 'rgba(245,158,11,0.12)', color: '#b45309',              icon: Clock       },
  uploaded:        { label: 'Pending Review',  bg: 'rgba(59,130,246,0.12)', color: '#1d4ed8',              icon: FileCheck   },
  scanning:        { label: 'Processing',      bg: 'rgba(99,102,241,0.12)', color: '#4338ca',              icon: RefreshCw   },
  under_review:    { label: 'Under Review',    bg: 'rgba(234,179,8,0.12)',  color: '#a16207',              icon: Eye         },
  approved:        { label: 'Approved',        bg: 'rgba(5,150,105,0.10)', color: 'var(--forest-green)',   icon: CheckCircle },
  rejected:        { label: 'Rejected',        bg: 'rgba(239,68,68,0.12)', color: '#dc2626',               icon: XCircle     },
  overdue:         { label: 'Overdue',         bg: 'rgba(239,68,68,0.12)', color: '#dc2626',               icon: AlertCircle },
};

function StatusBadge({ status }: { status: DocumentRequestStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.awaiting_upload;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ── Metric card ────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-1 rounded-xl p-4 border text-left transition-colors"
      style={{
        background: active ? 'var(--ember-orange)' : 'var(--card)',
        borderColor: active ? 'var(--ember-orange)' : 'var(--border)',
        color: active ? '#fff' : 'var(--foreground)',
      }}
    >
      <span className="text-2xl font-bold font-headline">{value}</span>
      <span className="text-xs font-medium" style={{ color: active ? 'rgba(255,255,255,0.8)' : 'var(--muted-foreground)' }}>
        {label}
      </span>
    </button>
  );
}

// ── Request Document modal ─────────────────────────────────────────────────────

interface RequestDocumentModalProps {
  onClose: () => void;
  onCreated: (req: DocumentRequest) => void;
}

function RequestDocumentModal({ onClose, onCreated }: RequestDocumentModalProps) {
  const [parents, setParents]           = useState<{ id: number; name: string }[]>([]);
  const [children, setChildren]         = useState<{ id: number; name: string }[]>([]);
  const [loadingParents, setLoadingParents]   = useState(true);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [saving, setSaving]             = useState(false);

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
        setParents((res.data ?? []).map((u) => ({ id: u.id, name: u.name })));
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
    axiosInstance.get('/campers', { params: { user_id: Number(form.applicant_id) } })
      .then((res) => {
        const list = (res.data as any)?.data ?? res.data ?? [];
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.applicant_id]);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
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

  const inputCls = 'rounded-lg px-3 py-2.5 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)] w-full';
  const inputStyle = { background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' };
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
              Request Document
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              The parent/guardian will be notified via their inbox.
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
            <label htmlFor="doc-req-parent" className={labelCls} style={labelStyle}>Parent / Guardian *</label>
            {loadingParents ? (
              <div className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
            ) : (
              <select
                id="doc-req-parent"
                required
                value={form.applicant_id}
                onChange={(e) => set('applicant_id', e.target.value)}
                className={inputCls}
                style={inputStyle}
              >
                <option value="">Select parent/guardian…</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
              Select the parent/guardian, then choose which child this document is for.
            </p>
          </div>

          {/* Child — shown as soon as a parent is selected */}
          {form.applicant_id && (
            <div>
              <label htmlFor="doc-req-child" className={labelCls} style={labelStyle}>Child *</label>
              {loadingChildren ? (
                <div className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
              ) : (
                <select
                  id="doc-req-child"
                  required
                  value={form.camper_id}
                  onChange={(e) => set('camper_id', e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="">Select child…</option>
                  {children.length > 1 && (
                    <option value="all">All children</option>
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
            <label htmlFor="doc-req-type" className={labelCls} style={labelStyle}>Document Type *</label>
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
            <label htmlFor="doc-req-instructions" className={labelCls} style={labelStyle}>Instructions (optional)</label>
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
            <label htmlFor="doc-req-due-date" className={labelCls} style={labelStyle}>Due Date (optional)</label>
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
              Cancel
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={!canSubmit}
              loading={saving}
              className="flex items-center gap-1.5"
            >
              <InboxIcon className="h-3.5 w-3.5" />
              Send Request
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
            Reject Document
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
            You are rejecting <strong style={{ color: 'var(--foreground)' }}>{documentType}</strong>.
            The applicant will be notified and asked to resubmit.
          </p>
          <div>
            <label htmlFor="reject-reason" className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Reason (optional)
            </label>
            <textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. File is unreadable, wrong document type…"
              className="rounded-lg px-3 py-2.5 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)] w-full resize-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div
            className="flex items-center justify-end gap-3 pt-1 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" size="sm" type="submit" loading={saving} disabled={saving}>
              Reject
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
      setMenuPos({
        position: 'fixed',
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
        zIndex: 9999,
      });
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

  const inputCls = 'rounded-lg px-3 py-2.5 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)] w-full';
  const inputStyle = { background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' };

  return (
    <div role="button" tabIndex={0} aria-label="Close" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}>
      <div role="presentation" className="relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--card)' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Extend Deadline</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors">
            <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Set a new due date for <strong style={{ color: 'var(--foreground)' }}>{req.document_type}</strong>.
          </p>
          <div>
            <label htmlFor="extend-due-date" className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>New Due Date *</label>
            <input id="extend-due-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div className="flex items-center justify-end gap-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancel</Button>
            <Button size="sm" type="submit" loading={saving} disabled={saving || !date}>Extend Deadline</Button>
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
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Cancel Request</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors">
            <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Cancel the request for <strong style={{ color: 'var(--foreground)' }}>{req.document_type}</strong>? The applicant will be notified and this record will be removed.
          </p>
          <div className="flex items-center justify-end gap-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>Keep</Button>
            <Button variant="destructive" size="sm" loading={saving} disabled={saving} onClick={() => void handleConfirm()}>Cancel Request</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: 'All',             value: '' },
  { label: 'Awaiting Upload', value: 'awaiting_upload' },
  { label: 'Pending Review',  value: 'uploaded' },
  { label: 'Processing',      value: 'scanning' },
  { label: 'Under Review',    value: 'under_review' },
  { label: 'Approved',        value: 'approved' },
  { label: 'Rejected',        value: 'rejected' },
  { label: 'Overdue',         value: 'overdue' },
];

export function AdminDocumentsPage() {
  // ── Tab ─────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'requests' | 'uploads'>('requests');

  // ── Document Requests state ──────────────────────────────────────────────────
  const [stats, setStats]             = useState<DocumentRequestStats | null>(null);
  const [requests, setRequests]       = useState<DocumentRequest[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const [page, setPage]               = useState(1);
  const [lastPage, setLastPage]       = useState(1);
  const [total, setTotal]             = useState(0);

  // Filters
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // ── Uploaded Documents state ─────────────────────────────────────────────────
  const [uploads, setUploads]                 = useState<AdminDocument[]>([]);
  const [uploadsLoading, setUploadsLoading]   = useState(false);
  const [uploadsError, setUploadsError]       = useState(false);
  const [uploadsPage, setUploadsPage]         = useState(1);
  const [uploadsLastPage, setUploadsLastPage] = useState(1);
  const [uploadsTotal, setUploadsTotal]       = useState(0);
  const [uploadsSearch, setUploadsSearch]     = useState('');
  const [uploadsDebouncedSearch, setUploadsDebouncedSearch] = useState('');
  const [uploadsStatusFilter, setUploadsStatusFilter] = useState('');
  const [verifyingId, setVerifyingId]         = useState<number | null>(null);
  const uploadsSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [rejectTarget, setRejectTarget]         = useState<DocumentRequest | null>(null);
  const [extendTarget, setExtendTarget]         = useState<DocumentRequest | null>(null);
  const [cancelTarget, setCancelTarget]         = useState<DocumentRequest | null>(null);

  // Per-row action loading
  const [approvingId, setApprovingId]   = useState<number | null>(null);
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
  }, [statusFilter, debouncedSearch, page]);

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
    if (tab !== 'uploads') return;
    setUploadsLoading(true);
    setUploadsError(false);
    getAdminDocuments({
      page: uploadsPage,
      search: uploadsDebouncedSearch || undefined,
      verification_status: uploadsStatusFilter || undefined,
    })
      .then((r) => {
        setUploads(r.data);
        setUploadsLastPage(r.meta?.last_page ?? 1);
        setUploadsTotal(r.meta?.total ?? 0);
      })
      .catch(() => setUploadsError(true))
      .finally(() => setUploadsLoading(false));
  }, [tab, uploadsPage, uploadsDebouncedSearch, uploadsStatusFilter]);

  useEffect(() => { loadUploads(); }, [loadUploads]);

  async function handleVerifyDocument(doc: AdminDocument, status: 'approved' | 'rejected') {
    setVerifyingId(doc.id);
    try {
      const updated = await verifyDocument(doc.id, status);
      setUploads((prev) => prev.map((d) => d.id === doc.id ? updated : d));
      toast.success(`Document ${status}.`);
    } catch {
      toast.error('Action failed.');
    } finally {
      setVerifyingId(null);
    }
  }

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

  function handleMetricClick(status: string) {
    setStatusFilter((prev) => (prev === status ? '' : status));
    setPage(1);
  }

  async function handleApprove(req: DocumentRequest) {
    setApprovingId(req.id);
    try {
      const updated = await approveDocumentRequest(req.id);
      setRequests((prev) => prev.map((r) => r.id === req.id ? updated : r));
      toast.success('Document approved.');
      // Refresh stats
      getDocumentRequestStats().then(setStats).catch(() => {});
    } catch {
      toast.error('Approval failed.');
    } finally {
      setApprovingId(null);
    }
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
      toast.success('Reminder sent to applicant.');
    } catch {
      toast.error('Failed to send reminder.');
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
  const canReview = (status: DocumentRequestStatus) =>
    status === 'uploaded' || status === 'under_review';

  const canRemind = (status: DocumentRequestStatus) =>
    status === 'awaiting_upload' || status === 'overdue';

  const canReupload = (status: DocumentRequestStatus) =>
    status === 'rejected';

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

      <div className="flex flex-col gap-6 max-w-6xl">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
              Documents
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Manage document requests and review applicant-uploaded files.
            </p>
          </div>
          {tab === 'requests' && (
            <Button
              size="sm"
              onClick={() => setShowRequestModal(true)}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Request Document
            </Button>
          )}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--dash-bg)', border: '1px solid var(--border)' }}>
          {(['requests', 'uploads'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="px-4 py-1.5 text-sm font-medium rounded-lg transition-colors"
              style={{
                background: tab === t ? 'var(--card)' : 'transparent',
                color: tab === t ? 'var(--foreground)' : 'var(--muted-foreground)',
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {t === 'requests' ? 'Document Requests' : 'Uploaded Documents'}
            </button>
          ))}
        </div>

        {tab === 'uploads' && (
          <>
            {/* ── Uploads search bar ──────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                <input
                  type="text"
                  placeholder="Search by uploader name…"
                  value={uploadsSearch}
                  onChange={(e) => setUploadsSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>
              <div className="flex items-center gap-2">
                {[
                  { label: 'All',      value: '' },
                  { label: 'Pending',  value: 'pending' },
                  { label: 'Approved', value: 'approved' },
                  { label: 'Rejected', value: 'rejected' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setUploadsStatusFilter(opt.value); setUploadsPage(1); }}
                    className="text-xs px-3 py-2 rounded-lg border font-medium transition-colors"
                    style={{
                      background: uploadsStatusFilter === opt.value ? 'var(--ember-orange)' : 'var(--card)',
                      borderColor: uploadsStatusFilter === opt.value ? 'var(--ember-orange)' : 'var(--border)',
                      color: uploadsStatusFilter === opt.value ? '#fff' : 'var(--foreground)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Uploads table ───────────────────────────────────── */}
            <div className="glass-data rounded-2xl overflow-hidden">
              <div
                className="hidden md:grid gap-x-3 px-6 py-3 border-b text-xs font-semibold uppercase tracking-wide"
                style={{
                  gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) 110px 90px 110px',
                  borderColor: 'var(--border)',
                  color: 'var(--muted-foreground)',
                  background: 'var(--dash-bg)',
                }}
              >
                <span>File</span>
                <span>Uploaded By</span>
                <span>Document Type</span>
                <span>Scan</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>

              {uploadsLoading ? (
                <div className="p-4"><SkeletonTable rows={5} /></div>
              ) : uploadsError ? (
                <ErrorState onRetry={loadUploads} />
              ) : uploads.length === 0 ? (
                <EmptyState
                  title="No uploaded documents"
                  description={uploadsSearch || uploadsStatusFilter ? 'No documents match your filters.' : 'Applicants have not uploaded any documents yet.'}
                  icon={FileText}
                />
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {uploads.map((doc) => (
                    <li key={doc.id} className="hidden md:grid gap-x-3 px-6 py-3 items-center"
                      style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) 110px 90px 110px' }}>
                      {/* File name */}
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                        <span className="text-sm font-medium truncate" title={doc.file_name} style={{ color: 'var(--foreground)' }}>
                          {doc.file_name}
                        </span>
                      </div>
                      {/* Uploaded by */}
                      <span className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>
                        {doc.uploaded_by_name ?? '—'}
                      </span>
                      {/* Document type */}
                      <span className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>
                        {doc.document_type ?? '—'}
                      </span>
                      {/* Scan status */}
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium w-fit"
                        style={{
                          background: doc.scan_passed === true ? 'rgba(5,150,105,0.10)' : doc.scan_passed === false ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                          color: doc.scan_passed === true ? 'var(--forest-green)' : doc.scan_passed === false ? '#dc2626' : '#b45309',
                        }}>
                        {doc.scan_passed === true ? <CheckCircle className="h-3 w-3" /> : doc.scan_passed === false ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {doc.scan_passed === true ? 'Passed' : doc.scan_passed === false ? 'Failed' : 'Pending'}
                      </span>
                      {/* Verification status */}
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium w-fit"
                        style={{
                          background: doc.verification_status === 'approved' ? 'rgba(5,150,105,0.10)' : doc.verification_status === 'rejected' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                          color: doc.verification_status === 'approved' ? 'var(--forest-green)' : doc.verification_status === 'rejected' ? '#dc2626' : '#b45309',
                        }}>
                        {doc.verification_status === 'approved' ? <CheckCircle className="h-3 w-3" /> : doc.verification_status === 'rejected' ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {doc.verification_status === 'approved' ? 'Approved' : doc.verification_status === 'rejected' ? 'Rejected' : 'Pending'}
                      </span>
                      {/* Actions */}
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          title="Download"
                          onClick={() => void handleDownloadUpload(doc)}
                          className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {doc.verification_status === 'pending' && (
                          <>
                            <button
                              type="button"
                              title="Approve"
                              disabled={verifyingId === doc.id}
                              onClick={() => void handleVerifyDocument(doc, 'approved')}
                              className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors disabled:opacity-40"
                              style={{ color: 'var(--forest-green)' }}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Reject"
                              disabled={verifyingId === doc.id}
                              onClick={() => void handleVerifyDocument(doc, 'rejected')}
                              className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors disabled:opacity-40"
                              style={{ color: '#dc2626' }}
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ── Uploads pagination ──────────────────────────────── */}
            {uploadsLastPage > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {uploadsTotal} document{uploadsTotal !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" disabled={uploadsPage <= 1} onClick={() => setUploadsPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{uploadsPage} / {uploadsLastPage}</span>
                  <Button variant="ghost" size="sm" disabled={uploadsPage >= uploadsLastPage} onClick={() => setUploadsPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'requests' && (<>

        {/* ── Metrics bar ─────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <MetricCard label="Total"          value={stats.total}           active={statusFilter === ''}               onClick={() => handleMetricClick('')} />
            <MetricCard label="Awaiting Upload" value={stats.awaiting_upload} active={statusFilter === 'awaiting_upload'} onClick={() => handleMetricClick('awaiting_upload')} />
            <MetricCard label="Uploaded"        value={stats.uploaded}        active={statusFilter === 'uploaded'}        onClick={() => handleMetricClick('uploaded')} />
            <MetricCard label="Under Review"    value={stats.under_review}    active={statusFilter === 'under_review'}    onClick={() => handleMetricClick('under_review')} />
            <MetricCard label="Approved"        value={stats.approved}        active={statusFilter === 'approved'}        onClick={() => handleMetricClick('approved')} />
            <MetricCard label="Rejected"        value={stats.rejected}        active={statusFilter === 'rejected'}        onClick={() => handleMetricClick('rejected')} />
            <MetricCard label="Overdue"         value={stats.overdue}         active={statusFilter === 'overdue'}         onClick={() => handleMetricClick('overdue')} />
          </div>
        )}

        {/* ── Search + filter bar ──────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: 'var(--muted-foreground)' }}
            />
            <input
              type="text"
              placeholder="Search applicant, camper, or document type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                className="text-xs px-3 py-2 rounded-lg border font-medium transition-colors"
                style={{
                  background: statusFilter === opt.value ? 'var(--ember-orange)' : 'var(--card)',
                  borderColor: statusFilter === opt.value ? 'var(--ember-orange)' : 'var(--border)',
                  color: statusFilter === opt.value ? '#fff' : 'var(--foreground)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Requests table ───────────────────────────────────────── */}
        <div className="glass-data rounded-2xl overflow-hidden">

          {/* Table header */}
          <div
            className="hidden md:grid gap-x-3 px-6 py-3 border-b text-xs font-semibold uppercase tracking-wide"
            style={{
              gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1.3fr) 140px 100px 80px',
              borderColor: 'var(--border)',
              color: 'var(--muted-foreground)',
              background: 'var(--dash-bg)',
            }}
          >
            <span>Applicant</span>
            <span>Camper</span>
            <span>Document</span>
            <span>Status</span>
            <span>Due Date</span>
            <span className="text-right">Actions</span>
          </div>

          {loading ? (
            <div className="p-4">
              <SkeletonTable rows={6} />
            </div>
          ) : error ? (
            <ErrorState onRetry={load} />
          ) : requests.length === 0 ? (
            <EmptyState
              title="No document requests"
              description={
                statusFilter || debouncedSearch
                  ? 'No requests match your filters.'
                  : 'Click "Request Document" to create the first request.'
              }
              icon={FileText}
            />
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {requests.map((req) => (
                <li key={req.id}>
                  {(() => {
                    const hasDetails = !!(req.instructions || req.rejection_reason);

                    const btnCls = 'p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors disabled:opacity-40';

                    // Inline actions — max 2 icons to keep column at 80px
                    const inlineActions = canReview(req.status) ? (
                      <>
                        <button type="button" title="Approve"
                          disabled={approvingId === req.id}
                          onClick={() => void handleApprove(req)}
                          className={btnCls}
                          style={{ color: 'var(--forest-green)' }}>
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button type="button" title="Reject"
                          onClick={() => setRejectTarget(req)}
                          className={btnCls}
                          style={{ color: '#dc2626' }}>
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    ) : hasDetails ? (
                      <button type="button"
                        title={expandedRows.has(req.id) ? 'Hide details' : 'View details'}
                        onClick={() => toggleExpand(req.id)}
                        className={btnCls}
                        style={{ color: expandedRows.has(req.id) ? 'var(--ember-orange)' : 'var(--muted-foreground)' }}>
                        <Eye className="h-4 w-4" />
                      </button>
                    ) : null;

                    // Overflow menu items
                    const overflowItems: OverflowMenuItem[] = (() => {
                      const items: OverflowMenuItem[] = [];
                      if (canReview(req.status)) {
                        if (req.download_url) items.push({ label: 'Download file', icon: Download, onClick: () => void handleDownload(req) });
                        if (hasDetails) items.push({ label: 'View details', icon: Eye, onClick: () => toggleExpand(req.id) });
                      } else if (req.status === 'approved') {
                        if (req.download_url) items.push({ label: 'Download file', icon: Download, onClick: () => void handleDownload(req) });
                        if (hasDetails) items.push({ label: 'View details', icon: Eye, onClick: () => toggleExpand(req.id) });
                      } else if (canReupload(req.status)) {
                        items.push({ label: 'Request resubmission', icon: RotateCcw, onClick: () => void handleReupload(req), disabled: reuploadingId === req.id });
                        if (hasDetails) items.push({ label: 'View details', icon: Eye, onClick: () => toggleExpand(req.id) });
                      } else if (canRemind(req.status)) {
                        if (hasDetails) items.push({ label: 'View details', icon: Eye, onClick: () => toggleExpand(req.id) });
                        items.push({ label: 'Send reminder', icon: Bell, onClick: () => void handleRemind(req), disabled: remindingId === req.id });
                        items.push({ label: 'Extend deadline', icon: CalendarClock, onClick: () => setExtendTarget(req) });
                        items.push({ label: 'Cancel request', icon: Trash2, onClick: () => setCancelTarget(req), danger: true });
                      } else if (req.status === 'scanning') {
                        if (hasDetails) items.push({ label: 'View details', icon: Eye, onClick: () => toggleExpand(req.id) });
                      }
                      return items;
                    })();

                    return (
                      <div
                        className="hidden md:grid gap-x-3 px-6 py-3 items-center"
                        style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1.3fr) 140px 100px 80px' }}
                      >
                        {/* Applicant */}
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(22,101,52,0.10)' }}>
                            <User className="h-3 w-3" style={{ color: 'var(--forest-green)' }} />
                          </div>
                          <span className="text-sm font-medium truncate" title={req.applicant_name}
                            style={{ color: 'var(--foreground)' }}>
                            {req.applicant_name}
                          </span>
                        </div>

                        {/* Camper */}
                        <span className="text-sm truncate overflow-hidden" title={req.camper_name ?? undefined}
                          style={{ color: 'var(--muted-foreground)' }}>
                          {req.camper_name ?? '—'}
                        </span>

                        {/* Document — fixed-width icon container so text always starts at same position */}
                        <div className="flex items-center overflow-hidden min-w-0">
                          <span className="flex items-center justify-center flex-shrink-0" style={{ width: 20 }}>
                            <FileText className="h-3.5 w-3.5" style={{ color: 'var(--ember-orange)' }} />
                          </span>
                          <span className="text-sm font-medium truncate ml-1.5" title={req.document_type}
                            style={{ color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                            {req.document_type}
                          </span>
                        </div>

                        {/* Status */}
                        <div className="overflow-hidden">
                          <StatusBadge status={req.status} />
                        </div>

                        {/* Due date */}
                        <span className="text-sm whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                          {req.due_date ? format(new Date(req.due_date), 'MMM d, yyyy') : '—'}
                        </span>

                        {/* Actions — fixed 80px column, always right-aligned so icons anchor to the right edge */}
                        <div className="flex items-center justify-end gap-0.5 w-full">
                          {inlineActions}
                          <OverflowMenu items={overflowItems} />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Mobile fallback */}
                  <div className="md:hidden px-4 py-3 flex flex-col gap-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{req.applicant_name}</span>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{req.document_type}</span>
                    <StatusBadge status={req.status} />
                  </div>

                  {/* Instructions / rejection reason (collapsible secondary row) */}
                  {expandedRows.has(req.id) && (req.instructions || req.rejection_reason) && (
                    <div
                      className="px-6 pb-4 pt-1 text-xs rounded-b-lg border-t mx-0"
                      style={{ background: 'var(--dash-bg)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      {req.rejection_reason && (
                        <p className="font-medium" style={{ color: '#dc2626' }}>
                          <strong>Rejection reason:</strong> {req.rejection_reason}
                        </p>
                      )}
                      {req.instructions && (
                        <p className={req.rejection_reason ? 'mt-1' : ''}>
                          <strong style={{ color: 'var(--foreground)' }}>Instructions:</strong> {req.instructions}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Pagination ───────────────────────────────────────────── */}
        {lastPage > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {total} request{total !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {page} / {lastPage}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= lastPage}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        </>)}
      </div>
    </>
  );
}
