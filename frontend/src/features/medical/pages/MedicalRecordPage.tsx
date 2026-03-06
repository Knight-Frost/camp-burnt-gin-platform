/**
 * MedicalRecordPage.tsx
 *
 * Full medical record view for a single camper with editing capabilities
 * for camp medical staff. Organised into collapsible sections per record
 * type. Each section provides add and edit actions.
 *
 * Route: /medical/records/:camperId
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, AlertTriangle, Pill, Brain, Coffee,
  Clipboard, Wrench, Activity, Phone, ChevronDown, ChevronUp,
  Plus, ClipboardList, FileText, Edit2, X, Save, Loader2,
} from 'lucide-react';

import {
  getMedicalRecordByCamper,
  updateMedicalRecord,
  getAllergiesByCamper,
  createAllergy,
  updateAllergy,
  getMedicationsByCamper,
  createMedication,
  updateMedication,
  getDiagnosesByCamper,
  createDiagnosis,
  updateDiagnosis,
  getEmergencyContacts,
  getActivityPermissions,
  updateActivityPermission,
  getBehavioralProfile,
  updateBehavioralProfile,
  createBehavioralProfile,
  getFeedingPlan,
  updateFeedingPlan,
  createFeedingPlan,
  getAssistiveDevices,
  createAssistiveDevice,
  updateAssistiveDevice,
} from '@/features/medical/api/medical.api';
import { getCamper } from '@/features/admin/api/admin.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { pageEntry, staggerContainer, staggerChild } from '@/shared/constants/motion';
import type {
  Camper, MedicalRecord, Allergy, Medication, Diagnosis,
  EmergencyContact, ActivityPermission, BehavioralProfile,
  FeedingPlan, AssistiveDevice,
} from '@/features/admin/types/admin.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
      <p className="text-sm" style={{ color: 'var(--foreground)' }}>{value}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    'life-threatening': { bg: 'rgba(220,38,38,0.15)', text: 'var(--destructive)' },
    severe:   { bg: 'rgba(22,163,74,0.12)',  text: 'var(--ember-orange)' },
    moderate: { bg: 'rgba(96,165,250,0.12)',  text: 'var(--night-sky-blue)' },
    mild:     { bg: 'rgba(5,150,105,0.12)',  text: 'var(--forest-green)' },
  };
  const style = colors[severity] ?? { bg: 'var(--muted)', text: 'var(--muted-foreground)' };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: style.bg, color: style.text }}>
      {severity}
    </span>
  );
}

// ─── Modal overlay ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="rounded-2xl border p-6 w-full max-w-lg"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-headline text-base font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)]" style={{ color: 'var(--muted-foreground)' }}>
              <X className="h-4 w-4" />
            </button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Inline text field ────────────────────────────────────────────────────────

function Field({
  label, name, value, onChange, required, type = 'text', multiline,
}: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  required?: boolean; type?: string; multiline?: boolean;
}) {
  const base = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40";
  const style = { background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' };

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
        {label}{required && <span style={{ color: 'var(--destructive)' }}> *</span>}
      </label>
      {multiline ? (
        <textarea className={base} style={style} name={name} value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : (
        <input className={base} style={style} name={name} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function SelectField({
  label, name, value, onChange, options, required,
}: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
        {label}{required && <span style={{ color: 'var(--destructive)' }}> *</span>}
      </label>
      <select
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40"
        style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function SaveBtn({ loading, onClose }: { loading: boolean; onClose: () => void }) {
  return (
    <div className="flex items-center justify-end gap-3 mt-5">
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
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{ background: 'var(--ember-orange)', color: '#fff' }}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save
      </button>
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

interface MedSectionProps {
  title: string;
  icon: ReactNode;
  color: string;
  bg: string;
  defaultOpen?: boolean;
  children: ReactNode;
  empty?: boolean;
  emptyText?: string;
  onAdd?: () => void;
}

function MedSection({ title, icon, color, bg, defaultOpen = true, children, empty, emptyText, onAdd }: MedSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center" style={{ background: 'var(--glass-medium)' }}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex-1 flex items-center justify-between px-5 py-4 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: bg }}>
              <span style={{ color }}>{icon}</span>
            </div>
            <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{title}</span>
          </div>
          {open ? (
            <ChevronUp className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          ) : (
            <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          )}
        </button>
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1 px-4 py-4 text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--ember-orange)' }}
            title={`Add ${title}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          {empty ? (
            <p className="text-sm italic" style={{ color: 'var(--muted-foreground)' }}>{emptyText}</p>
          ) : children}
        </div>
      )}
    </div>
  );
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface RecordState {
  camper: Camper | null;
  record: MedicalRecord | null;
  allergies: Allergy[];
  medications: Medication[];
  diagnoses: Diagnosis[];
  contacts: EmergencyContact[];
  permissions: ActivityPermission[];
  behavioral: BehavioralProfile | null;
  feeding: FeedingPlan | null;
  devices: AssistiveDevice[];
}

type ModalType =
  | 'add-allergy' | 'edit-allergy'
  | 'add-medication' | 'edit-medication'
  | 'add-diagnosis' | 'edit-diagnosis'
  | 'edit-notes'
  | 'edit-behavioral'
  | 'edit-feeding'
  | 'add-device' | 'edit-device'
  | null;

// ─── Main page ────────────────────────────────────────────────────────────────

export function MedicalRecordPage() {
  const { t } = useTranslation();
  const { camperId } = useParams<{ camperId: string }>();
  const id = Number(camperId);

  const [state, setState] = useState<RecordState>({
    camper: null, record: null, allergies: [], medications: [],
    diagnoses: [], contacts: [], permissions: [],
    behavioral: null, feeding: null, devices: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [modal, setModal] = useState<ModalType>(null);
  const [editTarget, setEditTarget] = useState<number | null>(null);

  // Form state
  const [form, setForm] = useState<Record<string, string>>({});

  const closeModal = () => { setModal(null); setEditTarget(null); setForm({}); };

  const setField = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  // ─── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [camper, record, allergies, medications, diagnoses, contacts, permissions, behavioral, feeding, devices] = await Promise.all([
        getCamper(id),
        getMedicalRecordByCamper(id).catch(() => null),
        getAllergiesByCamper(id).catch(() => []),
        getMedicationsByCamper(id).catch(() => []),
        getDiagnosesByCamper(id).catch(() => []),
        getEmergencyContacts(id).catch(() => []),
        getActivityPermissions(id).catch(() => []),
        getBehavioralProfile(id).catch(() => null),
        getFeedingPlan(id).catch(() => null),
        getAssistiveDevices(id).catch(() => []),
      ]);
      setState({ camper, record, allergies, medications, diagnoses, contacts, permissions, behavioral, feeding, devices });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // ─── Modal openers ──────────────────────────────────────────────────────────

  const openEditAllergy = (a: Allergy) => {
    setEditTarget(a.id);
    setForm({ name: a.name, severity: a.severity, reaction: a.reaction ?? '' });
    setModal('edit-allergy');
  };

  const openEditMedication = (m: Medication) => {
    setEditTarget(m.id);
    setForm({ name: m.name, dosage: m.dosage, frequency: m.frequency, notes: m.notes ?? '' });
    setModal('edit-medication');
  };

  const openEditDiagnosis = (d: Diagnosis) => {
    setEditTarget(d.id);
    setForm({ name: d.name, icd_code: d.icd_code ?? '', notes: d.notes ?? '' });
    setModal('edit-diagnosis');
  };

  const openEditNotes = () => {
    const r = state.record;
    setForm({
      special_needs: r?.special_needs ?? '',
      dietary_restrictions: r?.dietary_restrictions ?? '',
      notes: r?.notes ?? '',
    });
    setModal('edit-notes');
  };

  const openEditBehavioral = () => {
    const b = state.behavioral;
    setForm({
      triggers: b?.triggers ?? '',
      de_escalation_strategies: b?.de_escalation_strategies ?? '',
      communication_style: b?.communication_style ?? '',
      notes: b?.notes ?? '',
    });
    setModal('edit-behavioral');
  };

  const openEditFeeding = () => {
    const f = state.feeding;
    setForm({ method: f?.method ?? '', restrictions: f?.restrictions ?? '', notes: f?.notes ?? '' });
    setModal('edit-feeding');
  };

  const openEditDevice = (d: AssistiveDevice) => {
    setEditTarget(d.id);
    setForm({ type: d.type, description: d.description ?? '' });
    setModal('edit-device');
  };

  // ─── Saves ──────────────────────────────────────────────────────────────────

  const handleAddAllergy = async () => {
    if (!form.name || !form.severity) return;
    setSaving(true);
    try {
      const a = await createAllergy({ camper_id: id, allergen: form.name, severity: form.severity, reaction: form.reaction });
      setState((s) => ({ ...s, allergies: [...s.allergies, a] }));
      closeModal();
    } finally { setSaving(false); }
  };

  const handleEditAllergy = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const a = await updateAllergy(editTarget, { allergen: form.name, severity: form.severity, reaction: form.reaction });
      setState((s) => ({ ...s, allergies: s.allergies.map((x) => x.id === editTarget ? a : x) }));
      closeModal();
    } finally { setSaving(false); }
  };

  const handleAddMedication = async () => {
    if (!form.name || !form.dosage || !form.frequency) return;
    setSaving(true);
    try {
      const m = await createMedication({ camper_id: id, name: form.name, dosage: form.dosage, frequency: form.frequency, notes: form.notes });
      setState((s) => ({ ...s, medications: [...s.medications, m] }));
      closeModal();
    } finally { setSaving(false); }
  };

  const handleEditMedication = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const m = await updateMedication(editTarget, { name: form.name, dosage: form.dosage, frequency: form.frequency, notes: form.notes });
      setState((s) => ({ ...s, medications: s.medications.map((x) => x.id === editTarget ? m : x) }));
      closeModal();
    } finally { setSaving(false); }
  };

  const handleAddDiagnosis = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const d = await createDiagnosis({ camper_id: id, name: form.name, icd_code: form.icd_code || undefined, notes: form.notes });
      setState((s) => ({ ...s, diagnoses: [...s.diagnoses, d] }));
      closeModal();
    } finally { setSaving(false); }
  };

  const handleEditDiagnosis = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const d = await updateDiagnosis(editTarget, { name: form.name, icd_code: form.icd_code || undefined, notes: form.notes });
      setState((s) => ({ ...s, diagnoses: s.diagnoses.map((x) => x.id === editTarget ? d : x) }));
      closeModal();
    } finally { setSaving(false); }
  };

  const handleEditNotes = async () => {
    if (!state.record) return;
    setSaving(true);
    try {
      const r = await updateMedicalRecord(state.record.id, {
        special_needs: form.special_needs || undefined,
        dietary_restrictions: form.dietary_restrictions || undefined,
        notes: form.notes || undefined,
      });
      setState((s) => ({ ...s, record: r }));
      closeModal();
    } finally { setSaving(false); }
  };

  const handleEditBehavioral = async () => {
    setSaving(true);
    try {
      if (state.behavioral) {
        const b = await updateBehavioralProfile(state.behavioral.id, form);
        setState((s) => ({ ...s, behavioral: b }));
      } else {
        const b = await createBehavioralProfile({ camper_id: id, ...form });
        setState((s) => ({ ...s, behavioral: b }));
      }
      closeModal();
    } finally { setSaving(false); }
  };

  const handleEditFeeding = async () => {
    if (!form.method) return;
    setSaving(true);
    try {
      if (state.feeding) {
        const f = await updateFeedingPlan(state.feeding.id, form);
        setState((s) => ({ ...s, feeding: f }));
      } else {
        const f = await createFeedingPlan({ camper_id: id, ...form });
        setState((s) => ({ ...s, feeding: f }));
      }
      closeModal();
    } finally { setSaving(false); }
  };

  const handleAddDevice = async () => {
    if (!form.type) return;
    setSaving(true);
    try {
      const d = await createAssistiveDevice({ camper_id: id, type: form.type, description: form.description });
      setState((s) => ({ ...s, devices: [...s.devices, d] }));
      closeModal();
    } finally { setSaving(false); }
  };

  const handleEditDevice = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const d = await updateAssistiveDevice(editTarget, { type: form.type, description: form.description });
      setState((s) => ({ ...s, devices: s.devices.map((x) => x.id === editTarget ? d : x) }));
      closeModal();
    } finally { setSaving(false); }
  };

  const handleToggleActivityPermission = async (p: ActivityPermission) => {
    setSaving(true);
    try {
      const updated = await updateActivityPermission(p.id, { permitted: !p.permitted });
      setState((s) => ({ ...s, permissions: s.permissions.map((x) => x.id === p.id ? updated : x) }));
    } finally { setSaving(false); }
  };

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeletons.Block height={32} width={200} />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeletons.Card key={i} />)}
        </div>
      </div>
    );
  }

  const { camper, record, allergies, medications, diagnoses, contacts, permissions, behavioral, feeding, devices } = state;

  const SEVERITY_OPTIONS = [
    { value: 'mild',            label: 'Mild' },
    { value: 'moderate',        label: 'Moderate' },
    { value: 'severe',          label: 'Severe' },
    { value: 'life-threatening', label: 'Life-Threatening' },
  ];

  return (
    <>
      <motion.div variants={pageEntry} initial="hidden" animate="visible" className="p-6 max-w-4xl">

        {/* Back + breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/medical/dashboard"
            className="inline-flex items-center gap-2 text-sm transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('medical.record.back')}
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to={`/medical/records/${id}/treatments`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              {t('medical.record.treatment_log')}
            </Link>
            <Link
              to={`/medical/records/${id}/documents`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
            >
              <FileText className="h-3.5 w-3.5" />
              {t('medical.record.documents')}
            </Link>
          </div>
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            {camper?.full_name ?? t('medical.record.unknown')}
          </h1>
          {record?.primary_diagnosis && (
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {record.primary_diagnosis}
            </p>
          )}
        </div>

        {/* Sections */}
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">

          {/* Allergies */}
          <motion.div variants={staggerChild}>
            <MedSection
              title={t('medical.record.allergies')}
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              color={allergies.some(a => a.severity === 'life-threatening') ? 'var(--destructive)' : 'var(--warm-amber)'}
              bg={allergies.some(a => a.severity === 'life-threatening') ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.10)'}
              empty={allergies.length === 0}
              emptyText={t('medical.record.no_allergies')}
              onAdd={() => { setForm({ name: '', severity: '', reaction: '' }); setModal('add-allergy'); }}
            >
              <div className="space-y-3">
                {allergies.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{a.name}</p>
                      {a.reaction && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{a.reaction}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={a.severity} />
                      <button onClick={() => openEditAllergy(a)} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)]" style={{ color: 'var(--muted-foreground)' }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </MedSection>
          </motion.div>

          {/* Medications */}
          <motion.div variants={staggerChild}>
            <MedSection
              title={t('medical.record.medications')}
              icon={<Pill className="h-3.5 w-3.5" />}
              color="var(--night-sky-blue)"
              bg="rgba(96,165,250,0.1)"
              empty={medications.length === 0}
              emptyText={t('medical.record.no_medications')}
              onAdd={() => { setForm({ name: '', dosage: '', frequency: '', notes: '' }); setModal('add-medication'); }}
            >
              <div className="space-y-3">
                {medications.map((m) => (
                  <div key={m.id} className="flex items-start justify-between gap-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm flex-1">
                      <p className="font-medium col-span-2" style={{ color: 'var(--foreground)' }}>{m.name}</p>
                      <p style={{ color: 'var(--muted-foreground)' }}>{t('medical.record.dosage')}: {m.dosage}</p>
                      <p style={{ color: 'var(--muted-foreground)' }}>{t('medical.record.frequency')}: {m.frequency}</p>
                      {m.notes && <p className="col-span-2 text-xs italic" style={{ color: 'var(--muted-foreground)' }}>{m.notes}</p>}
                    </div>
                    <button onClick={() => openEditMedication(m)} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)] flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </MedSection>
          </motion.div>

          {/* Diagnoses */}
          <motion.div variants={staggerChild}>
            <MedSection
              title={t('medical.record.diagnoses')}
              icon={<Clipboard className="h-3.5 w-3.5" />}
              color="var(--ember-orange)"
              bg="rgba(22,163,74,0.1)"
              empty={diagnoses.length === 0}
              emptyText={t('medical.record.no_diagnoses')}
              onAdd={() => { setForm({ name: '', icd_code: '', notes: '' }); setModal('add-diagnosis'); }}
            >
              <div className="space-y-2">
                {diagnoses.map((d) => (
                  <div key={d.id} className="flex items-start gap-3">
                    {d.icd_code && (
                      <span className="text-xs px-2 py-0.5 rounded font-mono flex-shrink-0 mt-0.5" style={{ background: 'rgba(22,163,74,0.1)', color: 'var(--ember-orange)' }}>
                        {d.icd_code}
                      </span>
                    )}
                    <div className="flex-1">
                      <p className="text-sm" style={{ color: 'var(--foreground)' }}>{d.name}</p>
                      {d.notes && <p className="text-xs mt-0.5 italic" style={{ color: 'var(--muted-foreground)' }}>{d.notes}</p>}
                    </div>
                    <button onClick={() => openEditDiagnosis(d)} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)] flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </MedSection>
          </motion.div>

          {/* Notes */}
          <motion.div variants={staggerChild}>
            <MedSection
              title={t('medical.record.notes')}
              icon={<Edit2 className="h-3.5 w-3.5" />}
              color="var(--muted-foreground)"
              bg="var(--muted)"
              empty={!record?.special_needs && !record?.dietary_restrictions && !record?.notes}
              emptyText={t('medical.record.no_notes')}
              onAdd={record ? openEditNotes : undefined}
            >
              <div className="space-y-3 text-sm">
                <FieldRow label={t('medical.record.special_needs')} value={record?.special_needs} />
                <FieldRow label={t('medical.record.dietary_restrictions')} value={record?.dietary_restrictions} />
                <FieldRow label={t('medical.record.general_notes')} value={record?.notes} />
              </div>
            </MedSection>
          </motion.div>

          {/* Behavioral Profile */}
          <motion.div variants={staggerChild}>
            <MedSection
              title={t('medical.record.behavioral')}
              icon={<Brain className="h-3.5 w-3.5" />}
              color="var(--forest-green)"
              bg="rgba(5,150,105,0.1)"
              empty={!behavioral}
              emptyText={t('medical.record.no_behavioral')}
              onAdd={openEditBehavioral}
            >
              {behavioral && (
                <div className="space-y-3 text-sm">
                  <FieldRow label={t('medical.record.triggers')} value={behavioral.triggers} />
                  <FieldRow label={t('medical.record.de_escalation')} value={behavioral.de_escalation_strategies} />
                  <FieldRow label={t('medical.record.communication')} value={behavioral.communication_style} />
                  <FieldRow label={t('common.notes')} value={behavioral.notes} />
                  <button onClick={openEditBehavioral} className="inline-flex items-center gap-1 text-xs mt-1" style={{ color: 'var(--ember-orange)' }}>
                    <Edit2 className="h-3 w-3" /> {t('common.edit')}
                  </button>
                </div>
              )}
            </MedSection>
          </motion.div>

          {/* Feeding Plan */}
          <motion.div variants={staggerChild}>
            <MedSection
              title={t('medical.record.feeding')}
              icon={<Coffee className="h-3.5 w-3.5" />}
              color="var(--warm-amber)"
              bg="rgba(22,163,74,0.1)"
              defaultOpen={false}
              empty={!feeding}
              emptyText={t('medical.record.no_feeding')}
              onAdd={openEditFeeding}
            >
              {feeding && (
                <div className="space-y-2 text-sm">
                  <FieldRow label={t('medical.record.method')} value={feeding.method} />
                  <FieldRow label={t('medical.record.restrictions')} value={feeding.restrictions} />
                  <FieldRow label={t('common.notes')} value={feeding.notes} />
                  <button onClick={openEditFeeding} className="inline-flex items-center gap-1 text-xs mt-1" style={{ color: 'var(--ember-orange)' }}>
                    <Edit2 className="h-3 w-3" /> {t('common.edit')}
                  </button>
                </div>
              )}
            </MedSection>
          </motion.div>

          {/* Assistive Devices */}
          <motion.div variants={staggerChild}>
            <MedSection
              title={t('medical.record.devices')}
              icon={<Wrench className="h-3.5 w-3.5" />}
              color="var(--night-sky-blue)"
              bg="rgba(96,165,250,0.1)"
              defaultOpen={false}
              empty={devices.length === 0}
              emptyText={t('medical.record.no_devices')}
              onAdd={() => { setForm({ type: '', description: '' }); setModal('add-device'); }}
            >
              <div className="space-y-2">
                {devices.map((d) => (
                  <div key={d.id} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{d.type}</p>
                      {d.description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{d.description}</p>}
                    </div>
                    <button onClick={() => openEditDevice(d)} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)]" style={{ color: 'var(--muted-foreground)' }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </MedSection>
          </motion.div>

          {/* Activity Permissions */}
          <motion.div variants={staggerChild}>
            <MedSection
              title={t('medical.record.activity_permissions')}
              icon={<Activity className="h-3.5 w-3.5" />}
              color="var(--forest-green)"
              bg="rgba(5,150,105,0.1)"
              defaultOpen={false}
              empty={permissions.length === 0}
              emptyText={t('medical.record.no_permissions')}
            >
              <div className="space-y-2">
                {permissions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>{p.activity}</p>
                    <button
                      onClick={() => handleToggleActivityPermission(p)}
                      disabled={saving}
                      className="text-xs px-2 py-0.5 rounded-full font-medium transition-opacity disabled:opacity-50"
                      style={{
                        background: p.permitted ? 'rgba(5,150,105,0.12)' : 'rgba(220,38,38,0.12)',
                        color: p.permitted ? 'var(--forest-green)' : 'var(--destructive)',
                      }}
                      title="Toggle permission"
                    >
                      {p.permitted ? t('common.permitted') : t('common.not_permitted')}
                    </button>
                  </div>
                ))}
              </div>
            </MedSection>
          </motion.div>

          {/* Emergency Contacts (read-only) */}
          <motion.div variants={staggerChild}>
            <MedSection
              title={t('medical.record.emergency_contacts')}
              icon={<Phone className="h-3.5 w-3.5" />}
              color="var(--destructive)"
              bg="rgba(220,38,38,0.10)"
              defaultOpen={false}
              empty={contacts.length === 0}
              emptyText={t('medical.record.no_contacts')}
            >
              <div className="space-y-4">
                {contacts.map((c) => (
                  <div key={c.id}>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{c.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {c.relationship} &middot; {c.phone}
                      {c.email && ` · ${c.email}`}
                    </p>
                  </div>
                ))}
              </div>
            </MedSection>
          </motion.div>

        </motion.div>
      </motion.div>

      {/* ─── Modals ───────────────────────────────────────────────────────────── */}

      {modal === 'add-allergy' && (
        <Modal title={t('medical.modal.add_allergy')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleAddAllergy(); }} className="space-y-4">
            <Field label={t('medical.modal.allergen')} name="name" value={form.name ?? ''} onChange={setField('name')} required />
            <SelectField label={t('medical.modal.severity')} name="severity" value={form.severity ?? ''} onChange={setField('severity')} options={SEVERITY_OPTIONS} required />
            <Field label={t('medical.modal.reaction')} name="reaction" value={form.reaction ?? ''} onChange={setField('reaction')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'edit-allergy' && (
        <Modal title={t('medical.modal.edit_allergy')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleEditAllergy(); }} className="space-y-4">
            <Field label={t('medical.modal.allergen')} name="name" value={form.name ?? ''} onChange={setField('name')} required />
            <SelectField label={t('medical.modal.severity')} name="severity" value={form.severity ?? ''} onChange={setField('severity')} options={SEVERITY_OPTIONS} required />
            <Field label={t('medical.modal.reaction')} name="reaction" value={form.reaction ?? ''} onChange={setField('reaction')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'add-medication' && (
        <Modal title={t('medical.modal.add_medication')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleAddMedication(); }} className="space-y-4">
            <Field label={t('medical.modal.med_name')} name="name" value={form.name ?? ''} onChange={setField('name')} required />
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('medical.record.dosage')} name="dosage" value={form.dosage ?? ''} onChange={setField('dosage')} required />
              <Field label={t('medical.record.frequency')} name="frequency" value={form.frequency ?? ''} onChange={setField('frequency')} required />
            </div>
            <Field label={t('common.notes')} name="notes" value={form.notes ?? ''} onChange={setField('notes')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'edit-medication' && (
        <Modal title={t('medical.modal.edit_medication')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleEditMedication(); }} className="space-y-4">
            <Field label={t('medical.modal.med_name')} name="name" value={form.name ?? ''} onChange={setField('name')} required />
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('medical.record.dosage')} name="dosage" value={form.dosage ?? ''} onChange={setField('dosage')} required />
              <Field label={t('medical.record.frequency')} name="frequency" value={form.frequency ?? ''} onChange={setField('frequency')} required />
            </div>
            <Field label={t('common.notes')} name="notes" value={form.notes ?? ''} onChange={setField('notes')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'add-diagnosis' && (
        <Modal title={t('medical.modal.add_diagnosis')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleAddDiagnosis(); }} className="space-y-4">
            <Field label={t('medical.modal.diagnosis_name')} name="name" value={form.name ?? ''} onChange={setField('name')} required />
            <Field label={t('medical.modal.icd_code')} name="icd_code" value={form.icd_code ?? ''} onChange={setField('icd_code')} />
            <Field label={t('common.notes')} name="notes" value={form.notes ?? ''} onChange={setField('notes')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'edit-diagnosis' && (
        <Modal title={t('medical.modal.edit_diagnosis')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleEditDiagnosis(); }} className="space-y-4">
            <Field label={t('medical.modal.diagnosis_name')} name="name" value={form.name ?? ''} onChange={setField('name')} required />
            <Field label={t('medical.modal.icd_code')} name="icd_code" value={form.icd_code ?? ''} onChange={setField('icd_code')} />
            <Field label={t('common.notes')} name="notes" value={form.notes ?? ''} onChange={setField('notes')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'edit-notes' && (
        <Modal title={t('medical.modal.edit_notes')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleEditNotes(); }} className="space-y-4">
            <Field label={t('medical.record.special_needs')} name="special_needs" value={form.special_needs ?? ''} onChange={setField('special_needs')} multiline />
            <Field label={t('medical.record.dietary_restrictions')} name="dietary_restrictions" value={form.dietary_restrictions ?? ''} onChange={setField('dietary_restrictions')} multiline />
            <Field label={t('medical.record.general_notes')} name="notes" value={form.notes ?? ''} onChange={setField('notes')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'edit-behavioral' && (
        <Modal title={state.behavioral ? t('medical.modal.edit_behavioral') : t('medical.modal.add_behavioral')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleEditBehavioral(); }} className="space-y-4">
            <Field label={t('medical.record.triggers')} name="triggers" value={form.triggers ?? ''} onChange={setField('triggers')} multiline />
            <Field label={t('medical.record.de_escalation')} name="de_escalation_strategies" value={form.de_escalation_strategies ?? ''} onChange={setField('de_escalation_strategies')} multiline />
            <Field label={t('medical.record.communication')} name="communication_style" value={form.communication_style ?? ''} onChange={setField('communication_style')} multiline />
            <Field label={t('common.notes')} name="notes" value={form.notes ?? ''} onChange={setField('notes')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'edit-feeding' && (
        <Modal title={state.feeding ? t('medical.modal.edit_feeding') : t('medical.modal.add_feeding')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleEditFeeding(); }} className="space-y-4">
            <Field label={t('medical.record.method')} name="method" value={form.method ?? ''} onChange={setField('method')} required />
            <Field label={t('medical.record.restrictions')} name="restrictions" value={form.restrictions ?? ''} onChange={setField('restrictions')} multiline />
            <Field label={t('common.notes')} name="notes" value={form.notes ?? ''} onChange={setField('notes')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'add-device' && (
        <Modal title={t('medical.modal.add_device')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleAddDevice(); }} className="space-y-4">
            <Field label={t('medical.modal.device_type')} name="type" value={form.type ?? ''} onChange={setField('type')} required />
            <Field label={t('common.description')} name="description" value={form.description ?? ''} onChange={setField('description')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'edit-device' && (
        <Modal title={t('medical.modal.edit_device')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleEditDevice(); }} className="space-y-4">
            <Field label={t('medical.modal.device_type')} name="type" value={form.type ?? ''} onChange={setField('type')} required />
            <Field label={t('common.description')} name="description" value={form.description ?? ''} onChange={setField('description')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}
    </>
  );
}
