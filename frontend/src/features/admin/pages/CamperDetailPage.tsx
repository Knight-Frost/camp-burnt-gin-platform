/**
 * CamperDetailPage.tsx
 *
 * Full camper profile for admins: personal info, medical record, session
 * history, emergency contacts, and linked application actions.
 * Route: /admin/campers/:id  |  /super-admin/campers/:id
 *
 * Medical data comes from separate endpoints (same pattern as MedicalRecordPage).
 */

import { useState, useEffect, type ReactNode } from 'react';
import { format } from 'date-fns';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, User, Heart, Phone, FileText, Activity, Shield, AlertTriangle,
} from 'lucide-react';

import { getCamper } from '@/features/admin/api/admin.api';
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
import { StatusBadge } from '@/ui/components/StatusBadge';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { pageEntry, staggerContainer, staggerChild } from '@/shared/constants/motion';
import type { Camper, MedicalRecord, Allergy, Medication, Diagnosis, EmergencyContact, ActivityPermission, BehavioralProfile, FeedingPlan, AssistiveDevice } from '@/features/admin/types/admin.types';

// ---------------------------------------------------------------------------
// Section card
// ---------------------------------------------------------------------------

interface SectionCardProps { title: string; icon: ReactNode; children: ReactNode }

function SectionCard({ title, icon, children }: SectionCardProps) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)', backdropFilter: 'blur(12px)' }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(22,163,74,0.12)' }}
        >
          <span style={{ color: 'var(--ember-orange)' }}>{icon}</span>
        </div>
        <h3 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
      <p className="text-sm" style={{ color: value ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
        {value ?? '—'}
      </p>
    </div>
  );
}

const SEVERITY_COLOR: Record<string, string> = {
  mild: '#f59e0b',
  moderate: '#f97316',
  severe: '#dc2626',
  'life-threatening': '#7f1d1d',
};

// ---------------------------------------------------------------------------
// Medical data state shape
// ---------------------------------------------------------------------------

interface MedData {
  record:              MedicalRecord | null;
  allergies:           Allergy[];
  medications:         Medication[];
  diagnoses:           Diagnosis[];
  behavioralProfile:   BehavioralProfile | null;
  feedingPlan:         FeedingPlan | null;
  assistiveDevices:    AssistiveDevice[];
  activityPermissions: ActivityPermission[];
  emergencyContacts:   EmergencyContact[];
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function CamperDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [camper, setCamper]         = useState<Camper | null>(null);
  const [med, setMed]               = useState<MedData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [medLoading, setMedLoading] = useState(true);
  const [error, setError]           = useState(false);

  const camperId = Number(id);

  // Fetch core camper data
  useEffect(() => {
    if (!camperId) return;
    setLoading(true);
    getCamper(camperId)
      .then(setCamper)
      .catch(() => {
        setError(true);
        toast.error('Failed to load camper record.');
      })
      .finally(() => setLoading(false));
  }, [camperId]);

  // Fetch medical data in parallel after camper loads
  useEffect(() => {
    if (!camperId) return;
    setMedLoading(true);

    const fetchMedical = async () => {
      // First get the medical record to get its ID for sub-resource calls
      const record = await getMedicalRecordByCamper(camperId).catch(() => null);

      const [
        allergies, medications, diagnoses,
        emergencyContacts, activityPermissions,
        behavioralProfile, feedingPlan, assistiveDevices,
      ] = await Promise.all([
        record ? getAllergies(record.id).catch(() => [])            : Promise.resolve([]),
        record ? getMedications(record.id).catch(() => [])          : Promise.resolve([]),
        record ? getDiagnoses(record.id).catch(() => [])            : Promise.resolve([]),
        getEmergencyContacts(camperId).catch(() => []),
        getActivityPermissions(camperId).catch(() => []),
        getBehavioralProfile(camperId).catch(() => null),
        getFeedingPlan(camperId).catch(() => null),
        getAssistiveDevices(camperId).catch(() => []),
      ]);

      setMed({ record, allergies, medications, diagnoses, emergencyContacts, activityPermissions, behavioralProfile, feedingPlan, assistiveDevices });
    };

    fetchMedical().finally(() => setMedLoading(false));
  }, [camperId]);

  const backPath       = window.location.pathname.startsWith('/super-admin') ? '/super-admin/campers' : '/admin/campers';
  const reviewBasePath = window.location.pathname.startsWith('/super-admin') ? '/super-admin/applications' : '/admin/applications';

  if (loading) {
    return (
      <div className="p-6 max-w-5xl space-y-4">
        <Skeletons.Row />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeletons.Card key={i} />)}
        </div>
      </div>
    );
  }

  if (error || !camper) {
    return (
      <div className="p-6 max-w-5xl">
        <EmptyState
          title="Camper not found"
          description="This camper record may have been removed or you do not have access."
          action={{ label: 'Back to campers', onClick: () => navigate(backPath) }}
        />
      </div>
    );
  }

  const age = camper.date_of_birth
    ? Math.floor((Date.now() - new Date(camper.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const applications = camper.applications ?? [];

  return (
    <motion.div variants={pageEntry} initial="hidden" animate="visible" className="p-6 max-w-5xl">

      {/* Back + header */}
      <div className="mb-6">
        <Link
          to={backPath}
          className="inline-flex items-center gap-1.5 text-sm mb-4 transition-opacity hover:opacity-70"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to campers
        </Link>
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-headline font-bold flex-shrink-0"
            style={{ background: 'rgba(22,163,74,0.12)', color: 'var(--ember-orange)' }}
          >
            {camper.first_name[0]}{camper.last_name[0]}
          </div>
          <div>
            <h1 className="font-headline text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {camper.full_name}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {age !== null ? `${age} years old` : ''}
              {age !== null && camper.gender ? ' · ' : ''}
              {camper.gender ?? ''}
            </p>
          </div>
        </div>
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">

        {/* Personal info */}
        <motion.div variants={staggerChild}>
          <SectionCard title="Personal Information" icon={<User className="h-4 w-4" />}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Date of Birth" value={camper.date_of_birth ? format(new Date(camper.date_of_birth), 'MMM d, yyyy') : '—'} />
              <Field label="Age"           value={age !== null ? `${age} years` : undefined} />
              <Field label="Gender"        value={camper.gender} />
              <Field label="T-Shirt Size"  value={camper.tshirt_size} />
            </div>
          </SectionCard>
        </motion.div>

        {/* Applications */}
        <motion.div variants={staggerChild}>
          <SectionCard title="Applications" icon={<FileText className="h-4 w-4" />}>
            {applications.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No applications on file.</p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {applications.map((app) => (
                  <div key={app.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {app.session?.name ?? `Session #${app.camp_session_id}`}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        Submitted {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StatusBadge status={app.status} />
                      <Link
                        to={`${reviewBasePath}/${app.id}`}
                        className="text-xs px-2.5 py-1 rounded border transition-colors hover:opacity-80"
                        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </motion.div>

        {/* Medical record */}
        <motion.div variants={staggerChild}>
          <SectionCard title="Medical Record" icon={<Heart className="h-4 w-4" />}>
            {medLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <Skeletons.Row key={i} />)}
              </div>
            ) : !med?.record ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No medical record on file.</p>
            ) : (
              <div className="space-y-5">
                {med.record.primary_diagnosis && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>Primary Diagnosis</p>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>{med.record.primary_diagnosis}</p>
                  </div>
                )}

                {med.diagnoses.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Diagnoses</p>
                    <div className="space-y-1.5">
                      {med.diagnoses.map((d) => (
                        <div key={d.id} className="flex items-center gap-2 text-sm">
                          <span style={{ color: 'var(--foreground)' }}>{d.name}</span>
                          {d.icd_code && (
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--glass-strong)', color: 'var(--muted-foreground)' }}>
                              {d.icd_code}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {med.allergies.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Allergies</p>
                    <div className="flex flex-wrap gap-2">
                      {med.allergies.map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border"
                          style={{
                            color: SEVERITY_COLOR[a.severity] ?? '#6b7280',
                            borderColor: SEVERITY_COLOR[a.severity] ?? '#6b7280',
                            background: `${SEVERITY_COLOR[a.severity] ?? '#6b7280'}14`,
                          }}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {a.name} — {a.severity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {med.medications.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Medications</p>
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {med.medications.map((m) => (
                        <div key={m.id} className="py-2 first:pt-0 last:pb-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{m.name}</p>
                            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{m.dosage} · {m.frequency}</p>
                          </div>
                          {m.notes && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{m.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {med.behavioralProfile && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Behavioral Profile</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {med.behavioralProfile.triggers && <Field label="Triggers" value={med.behavioralProfile.triggers} />}
                      {med.behavioralProfile.de_escalation_strategies && <Field label="De-escalation" value={med.behavioralProfile.de_escalation_strategies} />}
                      {med.behavioralProfile.communication_style && <Field label="Communication Style" value={med.behavioralProfile.communication_style} />}
                    </div>
                  </div>
                )}

                {med.feedingPlan && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Feeding Plan</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Method" value={med.feedingPlan.method} />
                      {med.feedingPlan.restrictions && <Field label="Restrictions" value={med.feedingPlan.restrictions} />}
                    </div>
                  </div>
                )}

                {!med.record.primary_diagnosis && med.diagnoses.length === 0 && med.allergies.length === 0 && med.medications.length === 0 && !med.behavioralProfile && !med.feedingPlan && (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Medical record exists but contains no entries.</p>
                )}
              </div>
            )}
          </SectionCard>
        </motion.div>

        {/* Emergency contacts */}
        <motion.div variants={staggerChild}>
          <SectionCard title="Emergency Contacts" icon={<Phone className="h-4 w-4" />}>
            {medLoading ? (
              <Skeletons.Row />
            ) : (med?.emergencyContacts ?? []).length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No emergency contacts on file.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {med!.emergencyContacts.map((ec) => (
                  <div
                    key={ec.id}
                    className="rounded-lg border p-3"
                    style={{ borderColor: 'var(--border)', background: 'var(--glass-strong)' }}
                  >
                    <p className="text-sm font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>{ec.name}</p>
                    <div className="space-y-0.5">
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        <span className="font-medium" style={{ color: 'var(--foreground)' }}>Relation:</span> {ec.relationship}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        <span className="font-medium" style={{ color: 'var(--foreground)' }}>Phone:</span> {ec.phone_primary}
                      </p>
                      {ec.phone_secondary && (
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          <span className="font-medium" style={{ color: 'var(--foreground)' }}>Phone 2:</span> {ec.phone_secondary}
                        </p>
                      )}
                      {ec.email && (
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          <span className="font-medium" style={{ color: 'var(--foreground)' }}>Email:</span> {ec.email}
                        </p>
                      )}
                      {ec.is_authorized_pickup && (
                        <p className="text-xs mt-1" style={{ color: 'var(--forest-green)' }}>Authorized for pickup</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </motion.div>

        {/* Activity permissions */}
        {!medLoading && (med?.activityPermissions ?? []).length > 0 && (
          <motion.div variants={staggerChild}>
            <SectionCard title="Activity Permissions" icon={<Activity className="h-4 w-4" />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {med!.activityPermissions.map((ap) => (
                  <div key={ap.id} className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: ap.permission_level === 'yes'
                          ? 'rgba(22,163,74,0.15)'
                          : ap.permission_level === 'restricted'
                          ? 'rgba(234,179,8,0.15)'
                          : 'rgba(220,38,38,0.12)',
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: ap.permission_level === 'yes'
                            ? 'var(--forest-green)'
                            : ap.permission_level === 'restricted'
                            ? '#ca8a04'
                            : '#dc2626',
                        }}
                      />
                    </span>
                    <div>
                      <span className="text-sm" style={{ color: 'var(--foreground)' }}>{ap.activity_name}</span>
                      <span className="ml-2 text-xs capitalize px-1.5 py-0.5 rounded"
                        style={{
                          background: ap.permission_level === 'yes'
                            ? 'rgba(22,163,74,0.1)'
                            : ap.permission_level === 'restricted'
                            ? 'rgba(234,179,8,0.1)'
                            : 'rgba(220,38,38,0.08)',
                          color: ap.permission_level === 'yes'
                            ? 'var(--forest-green)'
                            : ap.permission_level === 'restricted'
                            ? '#ca8a04'
                            : '#dc2626',
                        }}
                      >
                        {ap.permission_level === 'yes' ? 'Permitted' : ap.permission_level === 'no' ? 'Not Permitted' : 'Restricted'}
                      </span>
                      {ap.restriction_notes && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{ap.restriction_notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </motion.div>
        )}

        {/* Assistive devices */}
        {!medLoading && (med?.assistiveDevices ?? []).length > 0 && (
          <motion.div variants={staggerChild}>
            <SectionCard title="Assistive Devices" icon={<Shield className="h-4 w-4" />}>
              <div className="flex flex-wrap gap-2">
                {med!.assistiveDevices.map((d) => (
                  <span
                    key={d.id}
                    className="text-xs px-2.5 py-1 rounded-full border"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--glass-strong)' }}
                  >
                    {d.device_type}{d.notes ? ` — ${d.notes}` : ''}{d.requires_transfer_assistance ? ' (transfer assist)' : ''}
                  </span>
                ))}
              </div>
            </SectionCard>
          </motion.div>
        )}

      </motion.div>
    </motion.div>
  );
}
