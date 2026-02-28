/**
 * MedicalRecordPage.tsx
 *
 * Full medical record view for a single camper.
 * Organised into collapsible sections per record type.
 * Route: /medical/records/:camperId
 */

import { useState, useEffect, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, AlertTriangle, Pill, Brain, Coffee,
  Clipboard, Wrench, Activity, Phone, ChevronDown, ChevronUp,
} from 'lucide-react';

import {
  getMedicalRecordByCamper,
  getAllergies,
  getMedications,
  getDiagnoses,
  getEmergencyContacts,
  getActivityPermissions,
  getBehavioralProfile,
  getFeedingPlan,
  getAssistiveDevices,
} from '@/features/medical/api/medical.api';
import { getCamper } from '@/features/admin/api/admin.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { pageEntry, staggerContainer, staggerChild } from '@/shared/constants/motion';
import type {
  Camper, MedicalRecord, Allergy, Medication, Diagnosis,
  EmergencyContact, ActivityPermission, BehavioralProfile,
  FeedingPlan, AssistiveDevice,
} from '@/features/admin/types/admin.types';

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

interface MedSectionProps {
  title: string;
  icon: ReactNode;
  color: string;
  bg: string;
  defaultOpen?: boolean;
  children: ReactNode;
  empty?: boolean;
  emptyText?: string;
}

function MedSection({ title, icon, color, bg, defaultOpen = true, children, empty, emptyText }: MedSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)' }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors"
        style={{ background: 'var(--glass-medium)' }}
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

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    'life-threatening': { bg: 'rgba(220,38,38,0.15)', text: 'var(--destructive)' },
    'severe':           { bg: 'rgba(22,101,52,0.12)',  text: 'var(--ember-orange)' },
    'moderate':         { bg: 'rgba(96,165,250,0.12)',  text: 'var(--night-sky-blue)' },
    'mild':             { bg: 'rgba(5,150,105,0.12)',  text: 'var(--forest-green)' },
  };
  const style = colors[severity] ?? { bg: 'var(--muted)', text: 'var(--muted-foreground)' };

  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: style.bg, color: style.text }}
    >
      {severity}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

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

export function MedicalRecordPage() {
  const { t } = useTranslation();
  const { camperId } = useParams<{ camperId: string }>();

  const [state, setState] = useState<RecordState>({
    camper: null, record: null, allergies: [], medications: [],
    diagnoses: [], contacts: [], permissions: [],
    behavioral: null, feeding: null, devices: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!camperId) return;
    const id = Number(camperId);

    Promise.all([
      getCamper(id),
      getMedicalRecordByCamper(id).catch(() => null),
      getAllergies(id).catch(() => []),
      getMedications(id).catch(() => []),
      getDiagnoses(id).catch(() => []),
      getEmergencyContacts(id).catch(() => []),
      getActivityPermissions(id).catch(() => []),
      getBehavioralProfile(id).catch(() => null),
      getFeedingPlan(id).catch(() => null),
      getAssistiveDevices(id).catch(() => []),
    ]).then(([camper, record, allergies, medications, diagnoses, contacts, permissions, behavioral, feeding, devices]) => {
      setState({ camper, record, allergies, medications, diagnoses, contacts, permissions, behavioral, feeding, devices });
    }).finally(() => setLoading(false));
  }, [camperId]);

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

  return (
    <motion.div variants={pageEntry} initial="hidden" animate="visible" className="p-6 max-w-4xl">
      <Link
        to="/medical"
        className="inline-flex items-center gap-2 text-sm mb-6 transition-colors"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ArrowLeft className="h-4 w-4" />
        {t('medical.record.back')}
      </Link>

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

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">

        {/* Allergies */}
        <motion.div variants={staggerChild}>
          <MedSection
            title={t('medical.record.allergies')}
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            color={allergies.some(a => a.severity === 'life-threatening') ? 'var(--destructive)' : 'var(--warm-amber)'}
            bg={allergies.some(a => a.severity === 'life-threatening') ? 'rgba(220,38,38,0.12)' : 'rgba(22,101,52,0.10)'}
            empty={allergies.length === 0}
            emptyText={t('medical.record.no_allergies')}
          >
            <div className="space-y-3">
              {allergies.map((a) => (
                <div key={a.id} className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{a.name}</p>
                    {a.reaction && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{a.reaction}</p>}
                  </div>
                  <SeverityBadge severity={a.severity} />
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
          >
            <div className="space-y-3">
              {medications.map((m) => (
                <div key={m.id} className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <p className="font-medium col-span-2" style={{ color: 'var(--foreground)' }}>{m.name}</p>
                  <p style={{ color: 'var(--muted-foreground)' }}>{t('medical.record.dosage')}: {m.dosage}</p>
                  <p style={{ color: 'var(--muted-foreground)' }}>{t('medical.record.frequency')}: {m.frequency}</p>
                  {m.notes && <p className="col-span-2 text-xs italic" style={{ color: 'var(--muted-foreground)' }}>{m.notes}</p>}
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
            bg="rgba(22,101,52,0.1)"
            empty={diagnoses.length === 0}
            emptyText={t('medical.record.no_diagnoses')}
          >
            <div className="space-y-2">
              {diagnoses.map((d) => (
                <div key={d.id} className="flex items-start gap-3">
                  {d.icd_code && (
                    <span
                      className="text-xs px-2 py-0.5 rounded font-mono flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(22,101,52,0.1)', color: 'var(--ember-orange)' }}
                    >
                      {d.icd_code}
                    </span>
                  )}
                  <div>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>{d.name}</p>
                    {d.notes && <p className="text-xs mt-0.5 italic" style={{ color: 'var(--muted-foreground)' }}>{d.notes}</p>}
                  </div>
                </div>
              ))}
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
          >
            {behavioral && (
              <div className="space-y-3 text-sm">
                {behavioral.triggers && (
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>{t('medical.record.triggers')}</p>
                    <p style={{ color: 'var(--foreground)' }}>{behavioral.triggers}</p>
                  </div>
                )}
                {behavioral.de_escalation_strategies && (
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>{t('medical.record.de_escalation')}</p>
                    <p style={{ color: 'var(--foreground)' }}>{behavioral.de_escalation_strategies}</p>
                  </div>
                )}
                {behavioral.communication_style && (
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>{t('medical.record.communication')}</p>
                    <p style={{ color: 'var(--foreground)' }}>{behavioral.communication_style}</p>
                  </div>
                )}
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
            bg="rgba(22,101,52,0.1)"
            defaultOpen={false}
            empty={!feeding}
            emptyText={t('medical.record.no_feeding')}
          >
            {feeding && (
              <div className="space-y-2 text-sm">
                <p><span className="font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('medical.record.method')}: </span>
                  <span style={{ color: 'var(--foreground)' }}>{feeding.method}</span></p>
                {feeding.restrictions && (
                  <p><span className="font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('medical.record.restrictions')}: </span>
                    <span style={{ color: 'var(--foreground)' }}>{feeding.restrictions}</span></p>
                )}
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
          >
            <div className="space-y-2">
              {devices.map((d) => (
                <div key={d.id}>
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{d.type}</p>
                  {d.description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{d.description}</p>}
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
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: p.permitted ? 'rgba(5,150,105,0.12)' : 'rgba(220,38,38,0.12)',
                      color: p.permitted ? 'var(--forest-green)' : 'var(--destructive)',
                    }}
                  >
                    {p.permitted ? t('common.permitted') : t('common.not_permitted')}
                  </span>
                </div>
              ))}
            </div>
          </MedSection>
        </motion.div>

        {/* Emergency Contacts */}
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
  );
}
