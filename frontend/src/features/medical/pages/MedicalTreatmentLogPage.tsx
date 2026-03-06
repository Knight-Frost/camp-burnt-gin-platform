/**
 * MedicalTreatmentLogPage.tsx
 *
 * Treatment log for a single camper. Camp medical staff can view all
 * intervention records and add new ones.
 *
 * Route: /medical/records/:camperId/treatments
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Plus, ClipboardList, AlertCircle,
  Pill, Eye, Wrench, Siren, MoreHorizontal,
  ChevronDown, ChevronUp, Loader2, Save, X,
} from 'lucide-react';

import {
  getTreatmentLogs,
  createTreatmentLog,
  type TreatmentLog,
  type TreatmentType,
} from '@/features/medical/api/medical.api';
import { getCamper } from '@/features/admin/api/admin.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { pageEntry, staggerContainer, staggerChild } from '@/shared/constants/motion';
import type { Camper } from '@/features/admin/types/admin.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<TreatmentType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  medication_administered: {
    label: 'Medication Administered',
    icon: <Pill className="h-3.5 w-3.5" />,
    color: 'var(--night-sky-blue)',
    bg: 'rgba(96,165,250,0.12)',
  },
  first_aid: {
    label: 'First Aid',
    icon: <Wrench className="h-3.5 w-3.5" />,
    color: 'var(--warm-amber)',
    bg: 'rgba(22,163,74,0.10)',
  },
  observation: {
    label: 'Observation',
    icon: <Eye className="h-3.5 w-3.5" />,
    color: 'var(--forest-green)',
    bg: 'rgba(5,150,105,0.10)',
  },
  emergency: {
    label: 'Emergency',
    icon: <Siren className="h-3.5 w-3.5" />,
    color: 'var(--destructive)',
    bg: 'rgba(220,38,38,0.12)',
  },
  other: {
    label: 'Other',
    icon: <MoreHorizontal className="h-3.5 w-3.5" />,
    color: 'var(--muted-foreground)',
    bg: 'var(--muted)',
  },
};

function TypeBadge({ type }: { type: TreatmentType }) {
  const meta = TYPE_META[type] ?? TYPE_META.other;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

function FollowUpBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' }}
    >
      <AlertCircle className="h-3 w-3" />
      Follow-up required
    </span>
  );
}

// ─── Expandable log entry ─────────────────────────────────────────────────────

function LogEntry({ log }: { log: TreatmentLog }) {
  const [open, setOpen] = useState(false);
  const date = new Date(log.treatment_date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const time = log.treatment_time
    ? new Date(`1970-01-01T${log.treatment_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: log.type === 'emergency' ? 'rgba(220,38,38,0.3)' : 'var(--border)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-4 px-5 py-4 text-left transition-colors"
        style={{ background: 'var(--glass-medium)' }}
      >
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: TYPE_META[log.type]?.bg ?? 'var(--muted)', color: TYPE_META[log.type]?.color ?? 'var(--muted-foreground)' }}>
            {TYPE_META[log.type]?.icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{log.title}</p>
            {log.follow_up_required && <FollowUpBadge />}
          </div>
          <div className="flex items-center gap-3">
            <TypeBadge type={log.type} />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {date}{time && ` · ${time}`}
            </span>
            {log.recorder && (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                by {log.recorder.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t"
            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
          >
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Description</p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{log.description}</p>
              </div>
              {log.outcome && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Outcome</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{log.outcome}</p>
                </div>
              )}
              {log.follow_up_required && log.follow_up_notes && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--destructive)' }}>Follow-up Notes</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{log.follow_up_notes}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Add log form ─────────────────────────────────────────────────────────────

const INITIAL_FORM = {
  treatment_date: new Date().toISOString().slice(0, 10),
  treatment_time: '',
  type: '' as TreatmentType | '',
  title: '',
  description: '',
  outcome: '',
  follow_up_required: false,
  follow_up_notes: '',
};

const BASE_INPUT = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40";
const INPUT_STYLE = { background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' };

function AddLogForm({
  camperId,
  onSaved,
  onClose,
}: {
  camperId: number;
  onSaved: (log: TreatmentLog) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (k: keyof typeof form) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.type || !form.title || !form.description || !form.treatment_date) {
      setError('Please fill in all required fields.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const log = await createTreatmentLog({
        camper_id: camperId,
        treatment_date: form.treatment_date,
        treatment_time: form.treatment_time || undefined,
        type: form.type as TreatmentType,
        title: form.title,
        description: form.description,
        outcome: form.outcome || undefined,
        follow_up_required: form.follow_up_required,
        follow_up_notes: form.follow_up_notes || undefined,
      });
      onSaved(log);
    } catch {
      setError('Failed to save treatment log. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const TYPE_OPTIONS: { value: TreatmentType; label: string }[] = [
    { value: 'medication_administered', label: 'Medication Administered' },
    { value: 'first_aid',               label: 'First Aid' },
    { value: 'observation',             label: 'Observation' },
    { value: 'emergency',               label: 'Emergency' },
    { value: 'other',                   label: 'Other' },
  ];

  return (
    <motion.div
      className="rounded-2xl border p-6"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-headline text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          Record Treatment / Intervention
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)]" style={{ color: 'var(--muted-foreground)' }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Date <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <input
              type="date"
              className={BASE_INPUT}
              style={INPUT_STYLE}
              value={form.treatment_date}
              onChange={(e) => setField('treatment_date')(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Time</label>
            <input
              type="time"
              className={BASE_INPUT}
              style={INPUT_STYLE}
              value={form.treatment_time}
              onChange={(e) => setField('treatment_time')(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            Type <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <select className={BASE_INPUT} style={INPUT_STYLE} value={form.type} onChange={(e) => setField('type')(e.target.value)}>
            <option value="">Select type…</option>
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            Title <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <input
            type="text"
            className={BASE_INPUT}
            style={INPUT_STYLE}
            value={form.title}
            onChange={(e) => setField('title')(e.target.value)}
            placeholder="Brief summary of the intervention"
            maxLength={255}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            Description <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <textarea
            className={BASE_INPUT}
            style={INPUT_STYLE}
            rows={4}
            value={form.description}
            onChange={(e) => setField('description')(e.target.value)}
            placeholder="Describe what occurred and what was done…"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Outcome</label>
          <textarea
            className={BASE_INPUT}
            style={INPUT_STYLE}
            rows={2}
            value={form.outcome}
            onChange={(e) => setField('outcome')(e.target.value)}
            placeholder="How did the camper respond?"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="follow_up"
            type="checkbox"
            checked={form.follow_up_required}
            onChange={(e) => setField('follow_up_required')(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="follow_up" className="text-sm" style={{ color: 'var(--foreground)' }}>
            Follow-up required
          </label>
        </div>

        {form.follow_up_required && (
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Follow-up Notes</label>
            <textarea
              className={BASE_INPUT}
              style={INPUT_STYLE}
              rows={2}
              value={form.follow_up_notes}
              onChange={(e) => setField('follow_up_notes')(e.target.value)}
            />
          </div>
        )}

        {error && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--destructive)' }}>
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--ember-orange)', color: '#fff' }}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Record
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MedicalTreatmentLogPage() {
  const { t } = useTranslation();
  const { camperId } = useParams<{ camperId: string }>();

  // camperId is only present when navigating from /medical/records/:camperId/treatments.
  // When accessed from the global /medical/treatments nav link, it is undefined.
  const id = camperId ? Number(camperId) : null;
  const hasCamper = id !== null && !isNaN(id);

  const [camper, setCamper] = useState<Camper | null>(null);
  const [logs, setLogs] = useState<TreatmentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      if (hasCamper) {
        const [c, l] = await Promise.all([
          getCamper(id!),
          getTreatmentLogs({ camper_id: id! }),
        ]);
        setCamper(c);
        setLogs(l.data);
      } else {
        const l = await getTreatmentLogs();
        setLogs(l.data);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [hasCamper, id, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const handleSaved = (log: TreatmentLog) => {
    setLogs((prev) => [log, ...prev]);
    setShowForm(false);
  };

  return (
    <motion.div variants={pageEntry} initial="hidden" animate="visible" className="p-6 max-w-4xl">

      {/* Back — only shown when viewing a specific camper's log */}
      {hasCamper && (
        <Link
          to={`/medical/records/${id}`}
          className="inline-flex items-center gap-2 text-sm mb-6 transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('medical.record.back_to_record')}
        </Link>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(22,163,74,0.1)' }}>
              <ClipboardList className="h-3.5 w-3.5" style={{ color: 'var(--ember-orange)' }} />
            </div>
            <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('medical.treatments.title')}
            </h1>
          </div>
          {camper && (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {camper.full_name}
            </p>
          )}
        </div>

        {hasCamper && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--ember-orange)', color: '#fff' }}
          >
            <Plus className="h-4 w-4" />
            {t('medical.treatments.add')}
          </button>
        )}
      </div>

      {/* Form — only available when a specific camper is in context */}
      <AnimatePresence>
        {hasCamper && showForm && (
          <div className="mb-6">
            <AddLogForm
              camperId={id!}
              onSaved={handleSaved}
              onClose={() => setShowForm(false)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeletons.Card key={i} />)}
        </div>
      ) : error ? (
        <EmptyState
          title={t('common.error_loading')}
          description={t('common.try_again')}
          action={{ label: t('common.retry'), onClick: () => setRetryKey((k) => k + 1) }}
        />
      ) : logs.length === 0 ? (
        <EmptyState
          title={t('medical.treatments.empty_title')}
          description={t('medical.treatments.empty_desc')}
        />
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
          {logs.map((log) => (
            <motion.div key={log.id} variants={staggerChild}>
              <LogEntry log={log} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
