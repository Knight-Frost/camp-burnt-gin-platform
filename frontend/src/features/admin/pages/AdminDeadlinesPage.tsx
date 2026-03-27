/**
 * AdminDeadlinesPage.tsx
 *
 * Purpose: Central deadline management for admins and super admins.
 * Route:   /admin/deadlines
 *
 * Responsibilities:
 *  - List all deadlines (filterable by session, entity type, status)
 *  - Create targeted and session-wide deadlines
 *  - Extend deadlines with admin-provided reason
 *  - Manually complete (override) deadlines for individual applicants
 *  - Delete deadlines (auto-removes the linked calendar event via observer)
 *
 * Every deadline write automatically syncs to the calendar via DeadlineObserver.
 * No separate calendar management is needed from this page.
 */

import { useEffect, useState, type CSSProperties } from 'react';
import { Plus, Calendar, CheckCircle, Trash2, Edit2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

import {
  getDeadlines, createDeadline, createBulkSessionDeadline,
  extendDeadline, completeDeadline, deleteDeadline,
  type Deadline, type EntityType, type EnforcementMode,
} from '@/features/admin/api/deadlines.api';
import { DeadlineBadge } from '@/ui/components/DeadlineBadge';
import { Button } from '@/ui/components/Button';
import { SkeletonCard } from '@/ui/components/Skeletons';

// ── Types & constants ──────────────────────────────────────────────────────────

type ModalMode = 'create' | 'extend' | 'complete' | null;

interface CreateFormState {
  camp_session_id: string;
  entity_type: EntityType;
  entity_id: string;
  title: string;
  description: string;
  due_date: string;
  grace_period_days: string;
  is_enforced: boolean;
  enforcement_mode: EnforcementMode;
  is_visible_to_applicants: boolean;
  is_session_wide: boolean;
}

const DEFAULT_CREATE: CreateFormState = {
  camp_session_id: '',
  entity_type: 'document_request',
  entity_id: '',
  title: '',
  description: '',
  due_date: '',
  grace_period_days: '0',
  is_enforced: false,
  enforcement_mode: 'soft',
  is_visible_to_applicants: true,
  is_session_wide: false,
};

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  document_request:    'Document Request',
  application:         'Application',
  medical_requirement: 'Medical Requirement',
  session:             'Session',
};

// ── Styles ─────────────────────────────────────────────────────────────────────

function card(extra: CSSProperties = {}): CSSProperties {
  return {
    background:   'var(--card)',
    border:       '1px solid var(--border)',
    borderRadius: '12px',
    padding:      '20px 24px',
    ...extra,
  };
}

function inputStyle(): CSSProperties {
  return {
    width: '100%', padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(0,0,0,0.12)',
    fontSize: '0.9375rem',
    background: '#f9fafb',
    color: 'var(--foreground)',
    outline: 'none',
  };
}

function labelStyle(): CSSProperties {
  return { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: '4px' };
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AdminDeadlinesPage() {
  const [deadlines, setDeadlines]     = useState<Deadline[]>([]);
  const [loading, setLoading]         = useState(true);
  const [retryKey, setRetryKey]       = useState(0);
  const [modalMode, setModalMode]     = useState<ModalMode>(null);
  const [selectedDeadline, setSelected] = useState<Deadline | null>(null);
  const [saving, setSaving]           = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType]     = useState<EntityType | ''>('');

  // Create form
  const [createForm, setCreateForm] = useState<CreateFormState>(DEFAULT_CREATE);

  // Extend/complete forms
  const [extendDate, setExtendDate]     = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [completeReason, setCompleteReason] = useState('');

  // ── Data loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    getDeadlines({
      status:      filterStatus || undefined,
      entity_type: filterType || undefined,
    })
      .then((res) => setDeadlines(res.data))
      .catch(() => toast.error('Failed to load deadlines.'))
      .finally(() => setLoading(false));
  }, [retryKey, filterStatus, filterType]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!createForm.camp_session_id || !createForm.title || !createForm.due_date) {
      toast.error('Session, title, and due date are required.');
      return;
    }
    setSaving(true);
    try {
      if (createForm.is_session_wide) {
        await createBulkSessionDeadline({
          camp_session_id:          +createForm.camp_session_id,
          entity_type:              createForm.entity_type,
          title:                    createForm.title,
          description:              createForm.description || undefined,
          due_date:                 createForm.due_date,
          grace_period_days:        +createForm.grace_period_days,
          is_enforced:              createForm.is_enforced,
          enforcement_mode:         createForm.enforcement_mode,
          is_visible_to_applicants: createForm.is_visible_to_applicants,
        });
        toast.success('Session-wide deadline created and added to calendar.');
      } else {
        await createDeadline({
          camp_session_id:          +createForm.camp_session_id,
          entity_type:              createForm.entity_type,
          entity_id:                createForm.entity_id ? +createForm.entity_id : undefined,
          title:                    createForm.title,
          description:              createForm.description || undefined,
          due_date:                 createForm.due_date,
          grace_period_days:        +createForm.grace_period_days,
          is_enforced:              createForm.is_enforced,
          enforcement_mode:         createForm.enforcement_mode,
          is_visible_to_applicants: createForm.is_visible_to_applicants,
        });
        toast.success('Deadline created and added to calendar.');
      }
      setModalMode(null);
      setCreateForm(DEFAULT_CREATE);
      setRetryKey((k) => k + 1);
    } catch {
      toast.error('Failed to create deadline.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExtend() {
    if (!selectedDeadline || !extendDate || !extendReason) {
      toast.error('New date and reason are required.');
      return;
    }
    setSaving(true);
    try {
      await extendDeadline(selectedDeadline.id, { new_due_date: extendDate, reason: extendReason });
      toast.success('Deadline extended. Calendar event updated automatically.');
      setModalMode(null);
      setExtendDate('');
      setExtendReason('');
      setRetryKey((k) => k + 1);
    } catch {
      toast.error('Failed to extend deadline.');
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    if (!selectedDeadline || !completeReason) {
      toast.error('Reason is required.');
      return;
    }
    setSaving(true);
    try {
      await completeDeadline(selectedDeadline.id, completeReason);
      toast.success('Deadline marked complete. Applicant is now unblocked.');
      setModalMode(null);
      setCompleteReason('');
      setRetryKey((k) => k + 1);
    } catch {
      toast.error('Failed to complete deadline.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(deadline: Deadline) {
    if (!confirm(`Delete deadline "${deadline.title}"? The calendar event will also be removed.`)) return;
    try {
      await deleteDeadline(deadline.id);
      toast.success('Deadline and calendar event deleted.');
      setRetryKey((k) => k + 1);
    } catch {
      toast.error('Failed to delete deadline.');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const stats = {
    overdue:    deadlines.filter((d) => d.urgency_level === 'overdue').length,
    approaching: deadlines.filter((d) => d.urgency_level === 'approaching').length,
    total:      deadlines.length,
  };

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
            Deadline Management
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>
            Single source of truth — deadlines auto-sync to the calendar.
          </p>
        </div>
        <Button onClick={() => { setCreateForm(DEFAULT_CREATE); setModalMode('create'); }}>
          <Plus size={16} style={{ marginRight: '6px' }} /> New Deadline
        </Button>
      </div>

      {/* ── Stats strip ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Deadlines',  value: stats.total,      color: 'var(--foreground)' },
          { label: 'Approaching',      value: stats.approaching, color: '#b45309' },
          { label: 'Overdue',          value: stats.overdue,     color: '#dc2626' },
        ].map((s) => (
          <div key={s.label} style={card({ textAlign: 'center' })}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ ...inputStyle(), width: 'auto', minWidth: '140px' }}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="extended">Extended</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as EntityType | '')}
          style={{ ...inputStyle(), width: 'auto', minWidth: '180px' }}
        >
          <option value="">All Types</option>
          {(Object.entries(ENTITY_TYPE_LABELS) as [EntityType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* ── Deadline list ──────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : deadlines.length === 0 ? (
        <div style={{ ...card(), textAlign: 'center', padding: '48px', color: 'var(--muted-foreground)' }}>
          <Calendar size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p>No deadlines found. Create one to get started.</p>
          <p style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
            Each deadline automatically creates a calendar event.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {deadlines.map((d) => (
            <DeadlineRow
              key={d.id}
              deadline={d}
              onExtend={() => { setSelected(d); setExtendDate(''); setExtendReason(''); setModalMode('extend'); }}
              onComplete={() => { setSelected(d); setCompleteReason(''); setModalMode('complete'); }}
              onDelete={() => handleDelete(d)}
            />
          ))}
        </div>
      )}

      {/* ── Create Modal ───────────────────────────────────────────────────── */}
      {modalMode === 'create' && (
        <Modal title="New Deadline" onClose={() => setModalMode(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <FormField label="Session ID *">
              <input
                type="number"
                placeholder="Camp Session ID"
                value={createForm.camp_session_id}
                onChange={(e) => setCreateForm((f) => ({ ...f, camp_session_id: e.target.value }))}
                style={inputStyle()}
              />
            </FormField>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="session-wide"
                checked={createForm.is_session_wide}
                onChange={(e) => setCreateForm((f) => ({ ...f, is_session_wide: e.target.checked, entity_id: '' }))}
              />
              <label htmlFor="session-wide" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
                Session-wide (applies to all applicants in this session)
              </label>
            </div>

            <FormField label="Type *">
              <select
                value={createForm.entity_type}
                onChange={(e) => setCreateForm((f) => ({ ...f, entity_type: e.target.value as EntityType }))}
                style={inputStyle()}
              >
                {(Object.entries(ENTITY_TYPE_LABELS) as [EntityType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </FormField>

            {!createForm.is_session_wide && (
              <FormField label="Entity ID (leave blank for session-wide)">
                <input
                  type="number"
                  placeholder="Specific record ID"
                  value={createForm.entity_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, entity_id: e.target.value }))}
                  style={inputStyle()}
                />
              </FormField>
            )}

            <FormField label="Title *">
              <input
                placeholder="e.g. Medical Form Submission"
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                style={inputStyle()}
              />
            </FormField>

            <FormField label="Description">
              <textarea
                placeholder="Optional instructions for applicants"
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                style={{ ...inputStyle(), resize: 'vertical' }}
              />
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FormField label="Due Date *">
                <input
                  type="date"
                  value={createForm.due_date}
                  onChange={(e) => setCreateForm((f) => ({ ...f, due_date: e.target.value }))}
                  style={inputStyle()}
                />
              </FormField>
              <FormField label="Grace Period (days)">
                <input
                  type="number"
                  min="0" max="30"
                  value={createForm.grace_period_days}
                  onChange={(e) => setCreateForm((f) => ({ ...f, grace_period_days: e.target.value }))}
                  style={inputStyle()}
                />
              </FormField>
            </div>

            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '10px' }}>Enforcement</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={createForm.is_enforced}
                    onChange={(e) => setCreateForm((f) => ({ ...f, is_enforced: e.target.checked }))}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Enforce this deadline</span>
                </label>
                {createForm.is_enforced && (
                  <select
                    value={createForm.enforcement_mode}
                    onChange={(e) => setCreateForm((f) => ({ ...f, enforcement_mode: e.target.value as EnforcementMode }))}
                    style={{ ...inputStyle(), width: 'auto' }}
                  >
                    <option value="soft">Soft (warning only — upload still allowed)</option>
                    <option value="hard">Hard (block upload — HTTP 422)</option>
                  </select>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={createForm.is_visible_to_applicants}
                    onChange={(e) => setCreateForm((f) => ({ ...f, is_visible_to_applicants: e.target.checked }))}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Visible to applicants on their calendar and dashboard</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <Button variant="ghost" onClick={() => setModalMode(null)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating…' : 'Create Deadline'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Extend Modal ───────────────────────────────────────────────────── */}
      {modalMode === 'extend' && selectedDeadline && (
        <Modal title={`Extend: ${selectedDeadline.title}`} onClose={() => setModalMode(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
              Current due date: <strong>{format(parseISO(selectedDeadline.due_date), 'MMM d, yyyy')}</strong>
            </div>
            <FormField label="New Due Date *">
              <input
                type="date"
                value={extendDate}
                onChange={(e) => setExtendDate(e.target.value)}
                style={inputStyle()}
              />
            </FormField>
            <FormField label="Reason *">
              <textarea
                placeholder="Reason for extending this deadline"
                value={extendReason}
                onChange={(e) => setExtendReason(e.target.value)}
                rows={3}
                style={{ ...inputStyle(), resize: 'vertical' }}
              />
            </FormField>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button variant="ghost" onClick={() => setModalMode(null)}>Cancel</Button>
              <Button onClick={handleExtend} disabled={saving}>
                {saving ? 'Extending…' : 'Extend Deadline'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Complete Override Modal ────────────────────────────────────────── */}
      {modalMode === 'complete' && selectedDeadline && (
        <Modal title={`Override: ${selectedDeadline.title}`} onClose={() => setModalMode(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '10px 12px', background: 'rgba(217,119,6,0.08)', borderRadius: '8px', fontSize: '0.875rem' }}>
              Manually completing this deadline will unblock the applicant and remove enforcement.
              This action is logged to the audit trail.
            </div>
            <FormField label="Reason *">
              <textarea
                placeholder="Reason for manual completion (will be logged)"
                value={completeReason}
                onChange={(e) => setCompleteReason(e.target.value)}
                rows={3}
                style={{ ...inputStyle(), resize: 'vertical' }}
              />
            </FormField>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button variant="ghost" onClick={() => setModalMode(null)}>Cancel</Button>
              <Button onClick={handleComplete} disabled={saving}>
                {saving ? 'Completing…' : 'Mark Complete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DeadlineRow({
  deadline,
  onExtend,
  onComplete,
  onDelete,
}: {
  deadline: Deadline;
  onExtend: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           '16px',
        padding:       '14px 20px',
        background:    'var(--card)',
        border:        '1px solid var(--border)',
        borderRadius:  '10px',
        flexWrap:      'wrap',
      }}
    >
      {/* Urgency indicator */}
      <div style={{ width: '4px', height: '40px', borderRadius: '2px', background: URGENCY_COLORS[deadline.urgency_level], flexShrink: 0 }} />

      {/* Main info */}
      <div style={{ flex: 1, minWidth: '200px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--foreground)' }}>
          {deadline.title}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', background: 'rgba(0,0,0,0.05)', padding: '2px 7px', borderRadius: '4px' }}>
            {ENTITY_TYPE_LABELS[deadline.entity_type]}
            {deadline.entity_id !== null ? ` #${deadline.entity_id}` : ' · Session-wide'}
          </span>
          {deadline.is_enforced && (
            <span style={{ fontSize: '0.75rem', color: deadline.enforcement_mode === 'hard' ? '#dc2626' : '#b45309', fontWeight: 600 }}>
              {deadline.enforcement_mode === 'hard' ? '⛔ Hard block' : '⚠ Soft warning'}
            </span>
          )}
          {!deadline.is_visible_to_applicants && (
            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>· Internal only</span>
          )}
        </div>
      </div>

      {/* Badge */}
      <DeadlineBadge
        dueDate={deadline.due_date}
        urgencyLevel={deadline.urgency_level}
        compact
      />

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {deadline.status !== 'completed' && (
          <>
            <Button variant="ghost" size="sm" onClick={onExtend}>
              <Edit2 size={13} style={{ marginRight: '4px' }} /> Extend
            </Button>
            <Button variant="ghost" size="sm" onClick={onComplete}>
              <CheckCircle size={13} style={{ marginRight: '4px' }} /> Complete
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete} style={{ color: 'var(--destructive)' }}>
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--card)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle()}>{label}</label>
      {children}
    </div>
  );
}

const URGENCY_COLORS: Record<string, string> = {
  safe:       '#16a34a',
  approaching: '#d97706',
  overdue:    '#dc2626',
  completed:  '#9ca3af',
};
