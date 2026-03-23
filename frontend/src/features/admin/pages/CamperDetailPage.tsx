/**
 * CamperDetailPage.tsx
 *
 * Purpose: Full read-only camper profile for admins and super-admins.
 * Responsibilities:
 *   - Fetch core camper info (name, DOB, gender, t-shirt size, applications)
 *   - Separately fetch all medical sub-resources in parallel (allergies, meds, diagnoses, etc.)
 *   - Display everything in stacked SectionCards with consistent layout
 *   - Compute back/review base paths from the URL so the same component works
 *     under both /admin/... and /super-admin/... prefixes
 *
 * Plain-English: Think of this page like a binder tab in a camp counselor's
 * notebook — flip to a camper's name and instantly see their whole story:
 * medical needs, who to call in an emergency, and which activities they can join.
 */

import { useState, useEffect, type ReactNode } from 'react';
import { format } from 'date-fns';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, User, Heart, Phone, FileText, Activity, Shield, AlertTriangle, TrendingUp,
} from 'lucide-react';

import { getCamper, getCamperRiskSummary } from '@/features/admin/api/admin.api';
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
import type { Camper, MedicalRecord, Allergy, Medication, Diagnosis, EmergencyContact, ActivityPermission, BehavioralProfile, FeedingPlan, AssistiveDevice } from '@/features/admin/types/admin.types';

// ---------------------------------------------------------------------------
// Section card — reusable card with an icon and title header
// ---------------------------------------------------------------------------

interface SectionCardProps { title: string; icon: ReactNode; children: ReactNode }

// Wraps each data group (medical, contacts, etc.) in a consistent styled card.
function SectionCard({ title, icon, children }: SectionCardProps) {
  return (
    <div
      className="glass-panel rounded-xl p-5"
    >
      <div className="flex items-center gap-3 mb-4">
        {/* Colored icon badge — same visual language as the rest of the app */}
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

// A simple label + value pair. Shows an em-dash when value is absent.
function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
      {/* Dim the text when value is null/undefined so "—" feels intentionally empty */}
      <p className="text-sm" style={{ color: value ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
        {value ?? '—'}
      </p>
    </div>
  );
}

// Maps allergy severity → a color that communicates urgency at a glance.
// "life-threatening" uses a dark crimson to stand out from plain "severe".
const SEVERITY_COLOR: Record<string, string> = {
  mild: '#f59e0b',
  moderate: '#f97316',
  severe: '#dc2626',
  'life-threatening': '#7f1d1d',
};

// ---------------------------------------------------------------------------
// Medical data state shape — groups all 9 medical sub-resources in one object
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
// Main page component
// ---------------------------------------------------------------------------

export function CamperDetailPage() {
  // Pull the camper's numeric ID from the URL (e.g. /admin/campers/42 → id="42")
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [camper, setCamper]         = useState<Camper | null>(null);
  // All medical sub-resources live in one state object to avoid many useState calls
  const [med, setMed]               = useState<MedData | null>(null);
  // Risk assessment data fetched independently alongside camper data
  const [riskData, setRiskData]     = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  // Separate loading flag for medical data — it loads after core camper data
  const [medLoading, setMedLoading] = useState(true);
  const [error, setError]           = useState(false);

  // Convert the string route param to a number once; used in both useEffects
  const camperId = Number(id);

  // --- Effect 1: fetch core camper profile ---
  useEffect(() => {
    if (!camperId) return;
    let cancelled = false;

    const run = async () => {
      if (!cancelled) setLoading(true);
      try {
        const data = await getCamper(camperId);
        if (!cancelled) setCamper(data);
        // Fetch risk summary in parallel with camper — silently ignore failures
        getCamperRiskSummary(camperId).then(data => { if (!cancelled) setRiskData(data as any); }).catch(() => {});
      } catch {
        if (!cancelled) { setError(true); toast.error('Failed to load camper record.'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [camperId]);

  // --- Effect 2: fetch all medical data in parallel ---
  // Runs independently so medical info loads without waiting for camper details.
  useEffect(() => {
    if (!camperId) return;
    let cancelled = false;

    const run = async () => {
      if (!cancelled) setMedLoading(true);
      try {
        // Step 1: get the medical record to obtain its ID (needed for sub-resource endpoints)
        const record = await getMedicalRecordByCamper(camperId).catch(() => null);

        // Step 2: fire all remaining requests at the same time with Promise.all.
        // Each call falls back to [] or null on failure so a single 404 doesn't break the page.
        const [
          allergies, medications, diagnoses,
          emergencyContacts, activityPermissions,
          behavioralProfile, feedingPlan, assistiveDevices,
        ] = await Promise.all([
          record ? getAllergies(record.id).catch(() => [])            : Promise.resolve([]),
          record ? getMedications(record.id).catch(() => [])          : Promise.resolve([]),
          record ? getDiagnoses(record.id).catch(() => [])            : Promise.resolve([]),
          // Emergency contacts and activity permissions are keyed by camper ID, not record ID
          getEmergencyContacts(camperId).catch(() => []),
          getActivityPermissions(camperId).catch(() => []),
          getBehavioralProfile(camperId).catch(() => null),
          getFeedingPlan(camperId).catch(() => null),
          getAssistiveDevices(camperId).catch(() => []),
        ]);

        if (!cancelled) setMed({ record, allergies, medications, diagnoses, emergencyContacts, activityPermissions, behavioralProfile, feedingPlan, assistiveDevices });
      } catch {
        // individual failures already handled with .catch(() => []) above
      } finally {
        if (!cancelled) setMedLoading(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [camperId]);

  // Detect prefix from the current URL so back-navigation goes to the right portal
  const backPath       = window.location.pathname.startsWith('/super-admin') ? '/super-admin/campers' : '/admin/campers';
  const reviewBasePath = window.location.pathname.startsWith('/super-admin') ? '/super-admin/applications' : '/admin/applications';

  // Show skeleton cards while core camper data is loading
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

  // If the API returned an error or no camper data, show a helpful empty state
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

  // Calculate age in full years from DOB using millisecond arithmetic
  const age = camper.date_of_birth
    ? Math.floor((Date.now() - new Date(camper.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  // Default to empty array so `.map` below always works even if backend omits the field
  const applications = camper.applications ?? [];

  return (
    <div className="p-6 max-w-5xl">

      {/* Back link + camper avatar/name header */}
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
          {/* Initials avatar — a quick visual anchor for the camper's identity */}
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
            {/* Mid-dots separate age and gender — conditional to avoid orphaned separators */}
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {age !== null ? `${age} years old` : ''}
              {age !== null && camper.gender ? ' · ' : ''}
              {camper.gender ?? ''}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">

        {/* Personal Information card */}
        <SectionCard title="Personal Information" icon={<User className="h-4 w-4" />}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Date of Birth" value={camper.date_of_birth ? format(new Date(camper.date_of_birth), 'MMM d, yyyy') : '—'} />
            <Field label="Age"           value={age !== null ? `${age} years` : undefined} />
            <Field label="Gender"        value={camper.gender} />
            <Field label="T-Shirt Size"  value={camper.tshirt_size} />
          </div>
        </SectionCard>

        {/* Applications — lists every session the camper has applied for */}
        <SectionCard title="Applications" icon={<FileText className="h-4 w-4" />}>
          {applications.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No applications on file.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {applications.map((app) => (
                <div key={app.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {/* Fall back to a generic label if the session name was not eager-loaded */}
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {app.session?.name ?? `Session #${app.camp_session_id}`}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      Submitted {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={app.status} />
                    {/* Deep-link directly to the full application review page */}
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

        {/* Risk Assessment card — only shown once risk data has loaded */}
        {riskData && (
          <SectionCard title="Risk Assessment" icon={<TrendingUp className="h-4 w-4" />}>
            <div className="space-y-4">
              {/* Risk score row with color-coded badge */}
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>
                    Risk Score
                  </p>
                  {(() => {
                    const score = riskData.risk_score ?? 0;
                    const pct   = Math.min(100, Math.round(score));
                    const color = pct >= 67 ? '#dc2626' : pct >= 34 ? '#d97706' : '#166534';
                    const label = pct >= 67 ? 'High' : pct >= 34 ? 'Moderate' : 'Low';
                    return (
                      <span
                        className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full"
                        style={{ background: `${color}18`, color }}
                      >
                        {pct}% — {label}
                      </span>
                    );
                  })()}
                </div>

                {/* Supervision level */}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>
                    Supervision Level
                  </p>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                    {riskData.supervision_label ?? '—'}
                    {riskData.staffing_ratio ? (
                      <span className="ml-1.5 text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--glass-strong)', color: 'var(--muted-foreground)' }}>
                        {riskData.staffing_ratio}
                      </span>
                    ) : null}
                  </p>
                </div>

                {/* Medical complexity */}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>
                    Medical Complexity
                  </p>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                    {riskData.complexity_label ?? '—'}
                  </p>
                </div>
              </div>

              {/* Active flags */}
              {Array.isArray(riskData.flags) && riskData.flags.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>
                    Risk Flags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {riskData.flags.map((flag: string) => (
                      <span
                        key={flag}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border"
                        style={{ borderColor: 'rgba(220,38,38,0.35)', color: '#dc2626', background: 'rgba(220,38,38,0.07)' }}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {flag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Medical Record card — has its own medLoading state */}
        <SectionCard title="Medical Record" icon={<Heart className="h-4 w-4" />}>
            {medLoading ? (
              // Still fetching medical data — show skeleton rows inside the card
              <div className="space-y-2">
                {[1, 2].map((i) => <Skeletons.Row key={i} />)}
              </div>
            ) : !med?.record ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No medical record on file.</p>
            ) : (
              <div className="space-y-5">
                {/* Primary diagnosis is a single free-text field from the record itself */}
                {med.record.primary_diagnosis && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>Primary Diagnosis</p>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>{med.record.primary_diagnosis}</p>
                  </div>
                )}

                {/* Structured diagnoses from the diagnoses sub-resource, with ICD codes */}
                {med.diagnoses.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Diagnoses</p>
                    <div className="space-y-1.5">
                      {med.diagnoses.map((d) => (
                        <div key={d.id} className="flex items-center gap-2 text-sm">
                          <span style={{ color: 'var(--foreground)' }}>{d.name}</span>
                          {/* ICD code shown as a monospace pill — only rendered if present */}
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

                {/* Allergy chips — color-coded by severity for rapid triage */}
                {med.allergies.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Allergies</p>
                    <div className="flex flex-wrap gap-2">
                      {med.allergies.map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border"
                          style={{
                            // Look up the severity color; fall back to neutral grey if unknown
                            color: SEVERITY_COLOR[a.severity] ?? '#6b7280',
                            borderColor: SEVERITY_COLOR[a.severity] ?? '#6b7280',
                            // Hex + "14" = ~8% opacity tinted background
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

                {/* Medication list — dosage and frequency shown inline */}
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

                {/* Behavioral profile — triggers and strategies for staff awareness */}
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

                {/* Feeding plan — shows method and any dietary restrictions */}
                {med.feedingPlan && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Feeding Plan</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Method" value={med.feedingPlan.method} />
                      {med.feedingPlan.restrictions && <Field label="Restrictions" value={med.feedingPlan.restrictions} />}
                    </div>
                  </div>
                )}

                {/* Fallback message: record exists in the DB but has no sub-resource data yet */}
                {!med.record.primary_diagnosis && med.diagnoses.length === 0 && med.allergies.length === 0 && med.medications.length === 0 && !med.behavioralProfile && !med.feedingPlan && (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Medical record exists but contains no entries.</p>
                )}
              </div>
            )}
        </SectionCard>

        {/* Emergency Contacts — keyed by camper ID, not medical record ID */}
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
                      {/* Secondary phone is optional — only render if it exists */}
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
                      {/* Authorized pickup status is a legal flag — shown in green for clarity */}
                      {ec.is_authorized_pickup && (
                        <p className="text-xs mt-1" style={{ color: 'var(--forest-green)' }}>Authorized for pickup</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </SectionCard>

        {/* Activity Permissions — only rendered when there are entries to show */}
        {!medLoading && (med?.activityPermissions ?? []).length > 0 && (
          <SectionCard title="Activity Permissions" icon={<Activity className="h-4 w-4" />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {med!.activityPermissions.map((ap) => (
                  <div key={ap.id} className="flex items-start gap-2.5">
                    {/* Traffic-light dot: green = permitted, yellow = restricted, red = not permitted */}
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
                      {/* Human-readable label badge for the permission level */}
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
                      {/* Restriction notes appear below the badge when present */}
                      {ap.restriction_notes && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{ap.restriction_notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
          </SectionCard>
        )}

        {/* Assistive Devices — only shown when the camper has at least one device on file */}
        {!medLoading && (med?.assistiveDevices ?? []).length > 0 && (
          <SectionCard title="Assistive Devices" icon={<Shield className="h-4 w-4" />}>
              {/* Each device is rendered as a compact pill with optional notes inline */}
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
        )}

      </div>
    </div>
  );
}
