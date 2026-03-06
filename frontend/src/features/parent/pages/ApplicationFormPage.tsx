/**
 * ApplicationFormPage.tsx
 *
 * Full Camp Burnt Gin CYSHCN Camper Application — 10-section accordion form.
 * Replaces the legacy 6-step wizard with a free-navigation, auto-saving system.
 *
 * Route: /applicant/applications/new
 *
 * Architecture:
 * - State: single FormState object, mirrored to localStorage on every change
 * - Auto-save: debounced 3 s write to "cbg_app_draft"
 * - Layout: 260 px left sidebar (section nav) + right accordion main
 * - Free navigation: user may open any section at any time
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Fragment,
  type ChangeEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  User,
  Heart,
  Brain,
  Accessibility,
  Utensils,
  ShieldCheck,
  Activity,
  Pill,
  Upload,
  PenLine,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  AlertTriangle,
  Save,
  Calendar,
  RefreshCw,
} from 'lucide-react';

import {
  getSessions,
  createCamper,
  createApplication,
  createEmergencyContact,
  createMedicalRecord,
  createDiagnosis,
  createAllergy,
  createBehavioralProfile,
  createAssistiveDevice,
  createFeedingPlan,
  createMedication,
  createActivityPermission,
  uploadDocument,
  signApplication,
} from '@/features/parent/api/parent.api';
import { ROUTES } from '@/shared/constants/routes';
import type { Session } from '@/shared/types';
import { Button } from '@/ui/components/Button';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRAFT_KEY = 'cbg_app_draft';
const AUTOSAVE_DELAY = 3000; // 3 s

const STATES_US = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const COMMUNICATION_METHODS = [
  'Verbal speech',
  'AAC device',
  'Sign language',
  'Picture symbols',
  'Gestures',
  'Written text',
  'Eye gaze',
];

const DEVICE_TYPES = [
  'Wheelchair (manual)',
  'Wheelchair (power)',
  'Walker',
  'Crutches',
  'Cane',
  'CPAP / BiPAP',
  'Hearing aid',
  'Glasses / contacts',
  'Prosthetic limb',
  'Orthotics / AFOs',
  'Gait trainer',
  'Other',
];

const TEXTURE_LEVELS = [
  'Regular',
  'Minced & moist',
  'Minced',
  'Puréed',
  'Liquidised',
  'Thin liquids',
  'Slightly thick',
  'Mildly thick',
  'Moderately thick',
  'Extremely thick',
];

// ---------------------------------------------------------------------------
// FormState type
// ---------------------------------------------------------------------------

interface Allergy {
  allergen: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life_threatening' | '';
  epi_pen: boolean;
}

interface DiagnosisEntry {
  condition: string;
  notes: string;
}

interface DeviceEntry {
  device_type: string;
  requires_transfer: boolean;
  notes: string;
}

/** Metadata for a user-selected document (File object stored in docFilesRef, not in state) */
type DocSlot = { file_name: string; size: number; mime: string } | null;

type SignatureType = 'drawn' | 'typed';

interface MedicationEntry {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  reason: string;
  physician: string;
  self_admin: boolean;
  refrigeration: boolean;
  notes: string;
}

export interface FormState {
  /** Section 1 — General Information */
  s1: {
    camper_first_name: string;
    camper_last_name: string;
    camper_dob: string;
    camper_gender: string;
    camper_preferred_name: string;
    county: string;
    g1_name: string;
    g1_relationship: string;
    g1_phone_home: string;
    g1_phone_cell: string;
    g1_email: string;
    g1_address: string;
    g1_city: string;
    g1_state: string;
    g1_zip: string;
    g2_name: string;
    g2_relationship: string;
    g2_phone_cell: string;
    g2_email: string;
    ec_name: string;
    ec_relationship: string;
    ec_phone: string;
    session_id: number | '';
    needs_interpreter: boolean;
    preferred_language: string;
  };
  /** Section 2 — Health & Medical */
  s2: {
    insurance_provider: string;
    insurance_policy: string;
    insurance_group: string;
    medicaid_number: string;
    physician_name: string;
    physician_phone: string;
    physician_address: string;
    diagnoses: DiagnosisEntry[];
    allergies: Allergy[];
    has_seizures: boolean | '';
    last_seizure_date: string;
    seizure_description: string;
    has_neurostimulator: boolean | '';
    immunizations_current: boolean | '';
    tetanus_date: string;
  };
  /** Section 3 — Development & Behavior */
  s3: {
    aggression: boolean;
    self_abuse: boolean;
    wandering: boolean;
    one_to_one: boolean;
    developmental_delay: boolean;
    functional_reading: boolean;
    functional_writing: boolean;
    independent_mobility: boolean;
    verbal_communication: boolean;
    social_skills: boolean;
    behavior_plan: boolean;
    communication_methods: string[];
    behavior_notes: string;
  };
  /** Section 4 — Equipment & Mobility */
  s4: {
    devices: DeviceEntry[];
    uses_cpap: boolean;
    cpap_notes: string;
    mobility_notes: string;
  };
  /** Section 5 — Diet & Feeding */
  s5: {
    special_diet: boolean;
    diet_description: string;
    texture_modified: boolean;
    texture_level: string;
    fluid_restriction: boolean;
    fluid_details: string;
    g_tube: boolean;
    formula: string;
    amount_per_feeding: string;
    feedings_per_day: string;
    feeding_times: string;
    bolus_only: boolean;
    feeding_notes: string;
  };
  /** Section 6 — Personal Care */
  s6: {
    bathing_level: string;
    bathing_notes: string;
    toileting_level: string;
    toileting_notes: string;
    nighttime_toileting: boolean;
    nighttime_notes: string;
    dressing_level: string;
    dressing_notes: string;
    oral_hygiene_level: string;
    positioning_notes: string;
    sleep_notes: string;
  };
  /** Section 7 — Activities & Permissions */
  s7: {
    swimming:       { level: string; notes: string };
    hiking:         { level: string; notes: string };
    horseback:      { level: string; notes: string };
    rock_climbing:  { level: string; notes: string };
    sports:         { level: string; notes: string };
    arts_crafts:    { level: string; notes: string };
    field_trips:    { level: string; notes: string };
  };
  /** Section 8 — Medications */
  s8: {
    no_medications: boolean;
    medications: MedicationEntry[];
  };
  /** Section 9 — Required Documents */
  s9: {
    immunization:  DocSlot;
    medical_exam:  DocSlot;
    insurance_card: DocSlot;
    cpap_waiver:   DocSlot;
    seizure_plan:  DocSlot;
    gtube_plan:    DocSlot;
  };
  /** Section 10 — Consents & Signatures */
  s10: {
    consent_medical:    boolean;
    consent_photo:      boolean;
    consent_liability:  boolean;
    consent_medication: boolean;
    consent_hipaa:      boolean;
    signed_name:        string;
    signed_date:        string;
    signature_type:     SignatureType;
    signature_data:     string; // base64 PNG (drawn) or '' (typed-only)
  };
  /** Meta */
  meta: {
    activeSection: number;
    lastSaved: number;
  };
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: FormState = {
  s1: {
    camper_first_name: '',
    camper_last_name: '',
    camper_dob: '',
    camper_gender: '',
    camper_preferred_name: '',
    county: '',
    g1_name: '',
    g1_relationship: '',
    g1_phone_home: '',
    g1_phone_cell: '',
    g1_email: '',
    g1_address: '',
    g1_city: '',
    g1_state: 'SC',
    g1_zip: '',
    g2_name: '',
    g2_relationship: '',
    g2_phone_cell: '',
    g2_email: '',
    ec_name: '',
    ec_relationship: '',
    ec_phone: '',
    session_id: '',
    needs_interpreter: false,
    preferred_language: '',
  },
  s2: {
    insurance_provider: '',
    insurance_policy: '',
    insurance_group: '',
    medicaid_number: '',
    physician_name: '',
    physician_phone: '',
    physician_address: '',
    diagnoses: [],
    allergies: [],
    has_seizures: '',
    last_seizure_date: '',
    seizure_description: '',
    has_neurostimulator: '',
    immunizations_current: '',
    tetanus_date: '',
  },
  s3: {
    aggression: false,
    self_abuse: false,
    wandering: false,
    one_to_one: false,
    developmental_delay: false,
    functional_reading: false,
    functional_writing: false,
    independent_mobility: false,
    verbal_communication: false,
    social_skills: false,
    behavior_plan: false,
    communication_methods: [],
    behavior_notes: '',
  },
  s4: {
    devices: [],
    uses_cpap: false,
    cpap_notes: '',
    mobility_notes: '',
  },
  s5: {
    special_diet: false,
    diet_description: '',
    texture_modified: false,
    texture_level: '',
    fluid_restriction: false,
    fluid_details: '',
    g_tube: false,
    formula: '',
    amount_per_feeding: '',
    feedings_per_day: '',
    feeding_times: '',
    bolus_only: false,
    feeding_notes: '',
  },
  s6: {
    bathing_level: '',
    bathing_notes: '',
    toileting_level: '',
    toileting_notes: '',
    nighttime_toileting: false,
    nighttime_notes: '',
    dressing_level: '',
    dressing_notes: '',
    oral_hygiene_level: '',
    positioning_notes: '',
    sleep_notes: '',
  },
  s7: {
    swimming:      { level: '', notes: '' },
    hiking:        { level: '', notes: '' },
    horseback:     { level: '', notes: '' },
    rock_climbing: { level: '', notes: '' },
    sports:        { level: '', notes: '' },
    arts_crafts:   { level: '', notes: '' },
    field_trips:   { level: '', notes: '' },
  },
  s8: { no_medications: false, medications: [] },
  s9: {
    immunization:  null,
    medical_exam:  null,
    insurance_card: null,
    cpap_waiver:   null,
    seizure_plan:  null,
    gtube_plan:    null,
  },
  s10: {
    consent_medical:    false,
    consent_photo:      false,
    consent_liability:  false,
    consent_medication: false,
    consent_hipaa:      false,
    signed_name:        '',
    signed_date:        '',
    signature_type:     'typed',
    signature_data:     '',
  },
  meta: { activeSection: 0, lastSaved: 0 },
};

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

interface SectionDef {
  id: number;
  key: keyof FormState;
  label: string;
  shortLabel: string;
  icon: typeof User;
}

const SECTIONS: SectionDef[] = [
  { id: 0, key: 's1', label: 'General Information',        shortLabel: 'General Info',   icon: User          },
  { id: 1, key: 's2', label: 'Health & Medical',            shortLabel: 'Health',         icon: Heart         },
  { id: 2, key: 's3', label: 'Development & Behavior',      shortLabel: 'Behavior',       icon: Brain         },
  { id: 3, key: 's4', label: 'Equipment & Mobility',        shortLabel: 'Equipment',      icon: Accessibility },
  { id: 4, key: 's5', label: 'Diet & Feeding',              shortLabel: 'Diet',           icon: Utensils      },
  { id: 5, key: 's6', label: 'Personal Care',               shortLabel: 'Personal Care',  icon: ShieldCheck   },
  { id: 6, key: 's7', label: 'Activities & Permissions',    shortLabel: 'Activities',     icon: Activity      },
  { id: 7, key: 's8', label: 'Medications',                 shortLabel: 'Medications',    icon: Pill          },
  { id: 8, key: 's9', label: 'Required Documents',          shortLabel: 'Documents',      icon: Upload        },
  { id: 9, key: 's10', label: 'Consents & Signatures',      shortLabel: 'Consents',       icon: PenLine       },
];

// ---------------------------------------------------------------------------
// Section completion
// ---------------------------------------------------------------------------

type SectionStatus = 'complete' | 'partial' | 'empty';

function getSectionStatus(sectionId: number, form: FormState): SectionStatus {
  switch (sectionId) {
    case 0: {
      const { s1 } = form;
      const required = [
        s1.camper_first_name, s1.camper_last_name, s1.camper_dob, s1.camper_gender,
        s1.g1_name, s1.g1_phone_cell, s1.ec_name, s1.ec_phone,
      ];
      const filled = required.filter(Boolean).length;
      if (filled === 0) return 'empty';
      const sessionFilled = s1.session_id !== '';
      if (filled === required.length && sessionFilled) return 'complete';
      return 'partial';
    }
    case 1: {
      const { s2 } = form;
      const required = [s2.insurance_provider, s2.physician_name];
      const hasSeizureAnswer = s2.has_seizures !== '';
      const hasImmunizationAnswer = s2.immunizations_current !== '';
      const filled = required.filter(Boolean).length;
      if (filled === 0 && !hasSeizureAnswer) return 'empty';
      if (filled === required.length && hasSeizureAnswer && hasImmunizationAnswer) return 'complete';
      return 'partial';
    }
    case 2: {
      return 'complete'; // all items default to false — valid answers
    }
    case 3: {
      return 'complete'; // no required devices
    }
    case 4: {
      const { s5 } = form;
      const gTubeAnswered = !s5.g_tube || (s5.formula !== '' && s5.amount_per_feeding !== '');
      if (gTubeAnswered) return 'complete';
      return 'partial';
    }
    case 5: {
      const { s6 } = form;
      const levels = [s6.bathing_level, s6.toileting_level, s6.dressing_level, s6.oral_hygiene_level];
      const filled = levels.filter(Boolean).length;
      if (filled === 0) return 'empty';
      if (filled === levels.length) return 'complete';
      return 'partial';
    }
    case 6: {
      const { s7 } = form;
      const activities = Object.values(s7) as { level: string; notes: string }[];
      const answered = activities.filter((a) => a.level !== '').length;
      if (answered === 0) return 'empty';
      if (answered === activities.length) return 'complete';
      return 'partial';
    }
    case 7: {
      const { s8 } = form;
      if (s8.no_medications) return 'complete';
      if (s8.medications.length === 0) return 'empty';
      const allFilled = s8.medications.every((m) => m.name.trim() !== '' && m.dosage.trim() !== '');
      return allFilled ? 'complete' : 'partial';
    }
    case 8: {
      const { s9 } = form;
      const hasCpap  = form.s4.devices.some((d) => d.device_type.includes('CPAP'));
      const hasSeizures = form.s2.has_seizures === true;
      const hasGtube = form.s5.g_tube === true;
      const required: (keyof typeof s9)[] = ['immunization', 'medical_exam', 'insurance_card'];
      if (hasCpap)      required.push('cpap_waiver');
      if (hasSeizures)  required.push('seizure_plan');
      if (hasGtube)     required.push('gtube_plan');
      const uploaded = required.filter((k) => s9[k] !== null).length;
      if (uploaded === 0) return 'empty';
      if (uploaded === required.length) return 'complete';
      return 'partial';
    }
    case 9: {
      const { s10 } = form;
      const allConsents = s10.consent_medical && s10.consent_photo && s10.consent_liability
        && s10.consent_medication && s10.consent_hipaa;
      const hasSigned = s10.signed_name.trim() !== '' && s10.signed_date !== '';
      if (!s10.consent_medical && !s10.consent_photo && !s10.consent_liability
          && !s10.consent_medication && !s10.consent_hipaa && s10.signed_name === '') {
        return 'empty';
      }
      if (allConsents && hasSigned) return 'complete';
      return 'partial';
    }
    default:
      return 'empty';
  }
}

function countMissing(form: FormState): number {
  let missing = 0;
  for (let i = 0; i <= 9; i++) {
    const st = getSectionStatus(i, form);
    if (st !== 'complete') missing++;
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
      {children}
      {required && <span className="ml-1 text-xs" style={{ color: 'var(--destructive)' }}>*</span>}
    </label>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  className = '',
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg px-4 py-3 text-sm border outline-none transition-colors focus:ring-1 focus:ring-[var(--ember-orange)] min-h-[48px] ${className}`}
      style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
    />
  );
}

function SelectInput({
  id,
  value,
  onChange,
  children,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      className="w-full rounded-lg px-4 py-3 text-sm border outline-none transition-colors focus:ring-1 focus:ring-[var(--ember-orange)] min-h-[48px]"
      style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
    >
      {children}
    </select>
  );
}

function TextArea({
  value,
  onChange,
  placeholder = '',
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none resize-none transition-colors focus:ring-1 focus:ring-[var(--ember-orange)]"
      style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
    />
  );
}

function YesNoField({
  label,
  value,
  onChange,
  id,
}: {
  label: string;
  value: boolean | '';
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <span className="text-sm flex-1 mr-4" style={{ color: 'var(--foreground)' }}>{label}</span>
      <div className="flex items-center gap-4 flex-shrink-0">
        {(['yes', 'no'] as const).map((opt) => {
          const isYes = opt === 'yes';
          const active = value !== '' && (isYes ? value === true : value === false);
          return (
            <label
              key={opt}
              htmlFor={`${id}_${opt}`}
              className="flex items-center gap-1.5 cursor-pointer"
            >
              <input
                id={`${id}_${opt}`}
                type="radio"
                name={id}
                checked={active}
                onChange={() => onChange(isYes)}
                className="sr-only"
              />
              <span
                className="w-16 text-center text-xs font-medium py-1 rounded-full border transition-all"
                style={{
                  background: active
                    ? isYes
                      ? 'rgba(22,163,74,0.12)'
                      : 'rgba(220,38,38,0.08)'
                    : 'var(--card)',
                  borderColor: active
                    ? isYes
                      ? 'var(--ember-orange)'
                      : 'var(--destructive)'
                    : 'var(--border)',
                  color: active
                    ? isYes
                      ? 'var(--ember-orange)'
                      : 'var(--destructive)'
                    : 'var(--muted-foreground)',
                }}
              >
                {opt === 'yes' ? 'Yes' : 'No'}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      {children}
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-widest mb-4 pb-2 border-b" style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>
      {children}
    </h4>
  );
}

function FormRow({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  const gridClass = cols === 1 ? 'grid-cols-1' : cols === 3 ? 'grid-cols-1 xl:grid-cols-3' : 'grid-cols-1 xl:grid-cols-2';
  return <div className={`grid ${gridClass} gap-y-6 gap-x-6`}>{children}</div>;
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Section 1 — General Information
// ---------------------------------------------------------------------------

function Section1({
  data,
  sessions,
  onChange,
}: {
  data: FormState['s1'];
  sessions: Session[];
  onChange: (patch: Partial<FormState['s1']>) => void;
}) {
  const set = (field: keyof FormState['s1']) => (v: string | boolean) =>
    onChange({ [field]: v } as Partial<FormState['s1']>);

  return (
    <div className="flex flex-col gap-6 p-8">

      {/* Camper Info */}
      <SectionCard>
        <SubHeading>Camper information</SubHeading>
        <FormRow>
          <div>
            <FieldLabel required>First name</FieldLabel>
            <TextInput value={data.camper_first_name} onChange={set('camper_first_name')} placeholder="First name" />
          </div>
          <div>
            <FieldLabel required>Last name</FieldLabel>
            <TextInput value={data.camper_last_name} onChange={set('camper_last_name')} placeholder="Last name" />
          </div>
        </FormRow>
        <FormRow>
          <div>
            <FieldLabel required>Date of birth</FieldLabel>
            <TextInput type="date" value={data.camper_dob} onChange={set('camper_dob')} />
          </div>
          <div>
            <FieldLabel required>Gender</FieldLabel>
            <SelectInput value={data.camper_gender} onChange={set('camper_gender')}>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non_binary">Non-binary</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
              <option value="other">Other</option>
            </SelectInput>
          </div>
        </FormRow>
        <FormRow>
          <div>
            <FieldLabel>Preferred name (nickname)</FieldLabel>
            <TextInput value={data.camper_preferred_name} onChange={set('camper_preferred_name')} placeholder="Optional" />
          </div>
          <div>
            <FieldLabel>County of residence</FieldLabel>
            <TextInput value={data.county} onChange={set('county')} placeholder="County" />
          </div>
        </FormRow>
      </SectionCard>

      {/* Guardian 1 */}
      <SectionCard>
        <SubHeading>Primary guardian / parent</SubHeading>
        <FormRow>
          <div>
            <FieldLabel required>Full name</FieldLabel>
            <TextInput value={data.g1_name} onChange={set('g1_name')} placeholder="Full legal name" />
          </div>
          <div>
            <FieldLabel>Relationship to camper</FieldLabel>
            <TextInput value={data.g1_relationship} onChange={set('g1_relationship')} placeholder="e.g. Mother, Father, Guardian" />
          </div>
        </FormRow>
        <FormRow cols={3}>
          <div>
            <FieldLabel>Home phone</FieldLabel>
            <TextInput type="tel" value={data.g1_phone_home} onChange={set('g1_phone_home')} placeholder="(xxx) xxx-xxxx" />
          </div>
          <div>
            <FieldLabel required>Cell phone</FieldLabel>
            <TextInput type="tel" value={data.g1_phone_cell} onChange={set('g1_phone_cell')} placeholder="(xxx) xxx-xxxx" />
          </div>
          <div>
            <FieldLabel>Email</FieldLabel>
            <TextInput type="email" value={data.g1_email} onChange={set('g1_email')} placeholder="email@example.com" />
          </div>
        </FormRow>
        <div>
          <FieldLabel>Street address</FieldLabel>
          <TextInput value={data.g1_address} onChange={set('g1_address')} placeholder="123 Main St" />
        </div>
        <FormRow cols={3}>
          <div>
            <FieldLabel>City</FieldLabel>
            <TextInput value={data.g1_city} onChange={set('g1_city')} placeholder="City" />
          </div>
          <div>
            <FieldLabel>State</FieldLabel>
            <SelectInput value={data.g1_state} onChange={set('g1_state')}>
              {STATES_US.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>ZIP code</FieldLabel>
            <TextInput value={data.g1_zip} onChange={set('g1_zip')} placeholder="00000" />
          </div>
        </FormRow>
      </SectionCard>

      {/* Guardian 2 (optional) */}
      <SectionCard>
        <SubHeading>Secondary guardian / parent (optional)</SubHeading>
        <FormRow>
          <div>
            <FieldLabel>Full name</FieldLabel>
            <TextInput value={data.g2_name} onChange={set('g2_name')} placeholder="Full legal name" />
          </div>
          <div>
            <FieldLabel>Relationship to camper</FieldLabel>
            <TextInput value={data.g2_relationship} onChange={set('g2_relationship')} placeholder="Relationship" />
          </div>
        </FormRow>
        <FormRow>
          <div>
            <FieldLabel>Cell phone</FieldLabel>
            <TextInput type="tel" value={data.g2_phone_cell} onChange={set('g2_phone_cell')} placeholder="(xxx) xxx-xxxx" />
          </div>
          <div>
            <FieldLabel>Email</FieldLabel>
            <TextInput type="email" value={data.g2_email} onChange={set('g2_email')} placeholder="email@example.com" />
          </div>
        </FormRow>
      </SectionCard>

      {/* Emergency Contact */}
      <SectionCard>
        <SubHeading>Emergency contact (other than guardians above)</SubHeading>
        <FormRow>
          <div>
            <FieldLabel required>Full name</FieldLabel>
            <TextInput value={data.ec_name} onChange={set('ec_name')} placeholder="Full name" />
          </div>
          <div>
            <FieldLabel>Relationship</FieldLabel>
            <TextInput value={data.ec_relationship} onChange={set('ec_relationship')} placeholder="Relationship" />
          </div>
        </FormRow>
        <div className="max-w-xs">
          <FieldLabel required>Phone number</FieldLabel>
          <TextInput type="tel" value={data.ec_phone} onChange={set('ec_phone')} placeholder="(xxx) xxx-xxxx" />
        </div>
      </SectionCard>

      {/* Session & Language */}
      <SectionCard>
        <SubHeading>Camp session</SubHeading>
        {sessions.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Loading available sessions…
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => {
              const selected = data.session_id === session.id;
              return (
                <label
                  key={session.id}
                  className="flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all"
                  style={{
                    background: selected ? 'rgba(22,163,74,0.06)' : 'var(--card)',
                    borderColor: selected ? 'var(--ember-orange)' : 'var(--border)',
                  }}
                >
                  <input
                    type="radio"
                    checked={selected}
                    onChange={() => onChange({ session_id: session.id })}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {session.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      <Calendar className="h-3 w-3" />
                      {new Date(session.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' – '}
                      {new Date(session.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      <span className="ml-2">{session.available_spots} spots open</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        <div className="border-t pt-4 flex flex-col gap-3" style={{ borderColor: 'var(--border)' }}>
          <SubHeading>Language & interpreter</SubHeading>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.needs_interpreter}
              onChange={(e) => onChange({ needs_interpreter: e.target.checked })}
            />
            <span className="text-sm" style={{ color: 'var(--foreground)' }}>
              An interpreter is needed to communicate with our family
            </span>
          </label>
          {data.needs_interpreter && (
            <div className="max-w-xs">
              <FieldLabel>Preferred language</FieldLabel>
              <TextInput value={data.preferred_language} onChange={set('preferred_language')} placeholder="e.g. Spanish, ASL" />
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Health & Medical
// ---------------------------------------------------------------------------

function Section2({
  data,
  onChange,
}: {
  data: FormState['s2'];
  onChange: (patch: Partial<FormState['s2']>) => void;
}) {
  function addDiagnosis() {
    onChange({ diagnoses: [...data.diagnoses, { condition: '', notes: '' }] });
  }

  function removeDiagnosis(i: number) {
    onChange({ diagnoses: data.diagnoses.filter((_, idx) => idx !== i) });
  }

  function updateDiagnosis(i: number, field: keyof DiagnosisEntry, value: string) {
    const updated = data.diagnoses.map((d, idx) =>
      idx === i ? { ...d, [field]: value } : d
    );
    onChange({ diagnoses: updated });
  }

  function addAllergy() {
    onChange({
      allergies: [...data.allergies, { allergen: '', reaction: '', severity: '', epi_pen: false }],
    });
  }

  function removeAllergy(i: number) {
    onChange({ allergies: data.allergies.filter((_, idx) => idx !== i) });
  }

  function updateAllergy(i: number, field: keyof Allergy, value: string | boolean) {
    const updated = data.allergies.map((a, idx) =>
      idx === i ? { ...a, [field]: value } : a
    );
    onChange({ allergies: updated });
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Insurance */}
      <SectionCard>
        <SubHeading>Insurance information</SubHeading>
        <FormRow>
          <div>
            <FieldLabel required>Insurance provider</FieldLabel>
            <TextInput value={data.insurance_provider} onChange={(v) => onChange({ insurance_provider: v })} placeholder="e.g. BlueCross, Medicaid" />
          </div>
          <div>
            <FieldLabel>Policy / member ID number</FieldLabel>
            <TextInput value={data.insurance_policy} onChange={(v) => onChange({ insurance_policy: v })} placeholder="Policy number" />
          </div>
        </FormRow>
        <FormRow>
          <div>
            <FieldLabel>Group number</FieldLabel>
            <TextInput value={data.insurance_group} onChange={(v) => onChange({ insurance_group: v })} placeholder="Group number" />
          </div>
          <div>
            <FieldLabel>Medicaid number (if applicable)</FieldLabel>
            <TextInput value={data.medicaid_number} onChange={(v) => onChange({ medicaid_number: v })} placeholder="Medicaid number" />
          </div>
        </FormRow>
      </SectionCard>

      {/* Physician */}
      <SectionCard>
        <SubHeading>Primary physician</SubHeading>
        <FormRow>
          <div>
            <FieldLabel required>Physician name</FieldLabel>
            <TextInput value={data.physician_name} onChange={(v) => onChange({ physician_name: v })} placeholder="Dr. First Last" />
          </div>
          <div>
            <FieldLabel>Physician phone</FieldLabel>
            <TextInput type="tel" value={data.physician_phone} onChange={(v) => onChange({ physician_phone: v })} placeholder="(xxx) xxx-xxxx" />
          </div>
        </FormRow>
        <div>
          <FieldLabel>Practice address</FieldLabel>
          <TextInput value={data.physician_address} onChange={(v) => onChange({ physician_address: v })} placeholder="Street address, city, state" />
        </div>
      </SectionCard>

      {/* Diagnoses */}
      <SectionCard>
        <div className="flex items-center justify-between">
          <SubHeading>Diagnoses / medical conditions</SubHeading>
          <button
            type="button"
            onClick={addDiagnosis}
            className="flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: 'var(--ember-orange)' }}
          >
            <Plus className="h-3 w-3" /> Add diagnosis
          </button>
        </div>
        {data.diagnoses.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            No diagnoses added. Click "Add diagnosis" if applicable.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.diagnoses.map((d, i) => (
              <div
                key={i}
                className="rounded-xl border p-3.5 flex flex-col gap-3"
                style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
              >
                <FormRow>
                  <div>
                    <FieldLabel>Condition / diagnosis</FieldLabel>
                    <TextInput value={d.condition} onChange={(v) => updateDiagnosis(i, 'condition', v)} placeholder="e.g. Autism Spectrum Disorder" />
                  </div>
                  <div>
                    <FieldLabel>Notes</FieldLabel>
                    <TextInput value={d.notes} onChange={(v) => updateDiagnosis(i, 'notes', v)} placeholder="Any relevant details" />
                  </div>
                </FormRow>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeDiagnosis(i)}
                    className="flex items-center gap-1 text-xs"
                    style={{ color: 'var(--destructive)' }}
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Allergies */}
      <SectionCard>
        <div className="flex items-center justify-between">
          <SubHeading>Allergies</SubHeading>
          <button
            type="button"
            onClick={addAllergy}
            className="flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: 'var(--ember-orange)' }}
          >
            <Plus className="h-3 w-3" /> Add allergy
          </button>
        </div>
        {data.allergies.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            No allergies added. Click "Add allergy" if applicable.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.allergies.map((a, i) => (
              <div
                key={i}
                className="rounded-xl border p-3.5 flex flex-col gap-3"
                style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
              >
                <FormRow>
                  <div>
                    <FieldLabel>Allergen</FieldLabel>
                    <TextInput value={a.allergen} onChange={(v) => updateAllergy(i, 'allergen', v)} placeholder="e.g. Peanuts, Bee stings" />
                  </div>
                  <div>
                    <FieldLabel>Reaction</FieldLabel>
                    <TextInput value={a.reaction} onChange={(v) => updateAllergy(i, 'reaction', v)} placeholder="Describe reaction" />
                  </div>
                </FormRow>
                <FormRow>
                  <div>
                    <FieldLabel>Severity</FieldLabel>
                    <SelectInput value={a.severity} onChange={(v) => updateAllergy(i, 'severity', v)}>
                      <option value="">Select severity</option>
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                      <option value="life_threatening">Life-threatening</option>
                    </SelectInput>
                  </div>
                  <div className="flex items-center gap-2 self-end pb-1">
                    <input
                      id={`epi_pen_${i}`}
                      type="checkbox"
                      checked={a.epi_pen}
                      onChange={(e) => updateAllergy(i, 'epi_pen', e.target.checked)}
                    />
                    <label htmlFor={`epi_pen_${i}`} className="text-sm cursor-pointer" style={{ color: 'var(--foreground)' }}>
                      Epi-pen required
                    </label>
                  </div>
                </FormRow>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeAllergy(i)}
                    className="flex items-center gap-1 text-xs"
                    style={{ color: 'var(--destructive)' }}
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Seizures & Neurostimulator */}
      <SectionCard>
        <SubHeading>Seizure history</SubHeading>
        <div className="flex flex-col">
          <YesNoField
            id="has_seizures"
            label="Does your camper have a history of seizures?"
            value={data.has_seizures}
            onChange={(v) => onChange({ has_seizures: v })}
          />
          <YesNoField
            id="has_neurostimulator"
            label="Does your camper have a neurostimulator / VNS?"
            value={data.has_neurostimulator}
            onChange={(v) => onChange({ has_neurostimulator: v })}
          />
        </div>
        {data.has_seizures === true && (
          <div className="flex flex-col gap-4 pt-2">
            <FormRow>
              <div>
                <FieldLabel>Date of last seizure</FieldLabel>
                <TextInput type="date" value={data.last_seizure_date} onChange={(v) => onChange({ last_seizure_date: v })} />
              </div>
            </FormRow>
            <div>
              <FieldLabel>Describe seizure type / pattern</FieldLabel>
              <TextArea value={data.seizure_description} onChange={(v) => onChange({ seizure_description: v })} placeholder="Describe the type, duration, and any warning signs" />
            </div>
            <div
              className="flex items-start gap-2 rounded-lg p-3 text-xs"
              style={{ background: 'rgba(251,191,36,0.10)', color: '#92400e', border: '1px solid rgba(251,191,36,0.30)' }}
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              A Seizure Action Plan is required in Section 9 (Required Documents).
            </div>
          </div>
        )}
      </SectionCard>

      {/* Immunizations */}
      <SectionCard>
        <SubHeading>Immunizations</SubHeading>
        <div className="flex flex-col">
          <YesNoField
            id="immunizations_current"
            label="Is your camper current on all required immunizations?"
            value={data.immunizations_current}
            onChange={(v) => onChange({ immunizations_current: v })}
          />
        </div>
        <div className="max-w-xs">
          <FieldLabel>Date of last tetanus / Tdap booster</FieldLabel>
          <TextInput type="date" value={data.tetanus_date} onChange={(v) => onChange({ tetanus_date: v })} />
        </div>
        <div
          className="flex items-start gap-2 rounded-lg p-3 text-xs"
          style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--ember-orange)', border: '1px solid rgba(22,163,74,0.20)' }}
        >
          <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          An SC Immunization Certificate is required in Section 9 (Required Documents).
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Development & Behavior
// ---------------------------------------------------------------------------

const BEHAVIOR_ITEMS: { key: keyof FormState['s3']; label: string }[] = [
  { key: 'aggression',            label: 'Exhibits aggression toward others (hitting, biting, kicking)' },
  { key: 'self_abuse',            label: 'Exhibits self-injurious behavior' },
  { key: 'wandering',             label: 'Has a wandering / elopement risk' },
  { key: 'one_to_one',            label: 'Requires one-to-one supervision at all times' },
  { key: 'developmental_delay',   label: 'Has a documented developmental delay' },
  { key: 'functional_reading',    label: 'Reads at a functional level' },
  { key: 'functional_writing',    label: 'Writes at a functional level' },
  { key: 'independent_mobility',  label: 'Moves independently (walks without assistance)' },
  { key: 'verbal_communication',  label: 'Communicates verbally' },
  { key: 'social_skills',         label: 'Demonstrates age-appropriate social skills with peers' },
  { key: 'behavior_plan',         label: 'Has a current behavioral support or intervention plan' },
];

function Section3({
  data,
  onChange,
}: {
  data: FormState['s3'];
  onChange: (patch: Partial<FormState['s3']>) => void;
}) {
  function toggleMethod(method: string) {
    const current = data.communication_methods;
    if (current.includes(method)) {
      onChange({ communication_methods: current.filter((m) => m !== method) });
    } else {
      onChange({ communication_methods: [...current, method] });
    }
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <SectionCard>
        <SubHeading>Behavioral indicators</SubHeading>
        <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
          Answer Yes or No for each item. These help us plan appropriate support and supervision.
        </p>
        <div className="flex flex-col">
          {BEHAVIOR_ITEMS.map((item) => (
            <YesNoField
              key={item.key}
              id={item.key}
              label={item.label}
              value={data[item.key] as boolean}
              onChange={(v) => onChange({ [item.key]: v } as Partial<FormState['s3']>)}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <SubHeading>Communication methods (select all that apply)</SubHeading>
        <div className="flex flex-wrap gap-2">
          {COMMUNICATION_METHODS.map((m) => {
            const active = data.communication_methods.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMethod(m)}
                className="px-3 py-1.5 text-xs rounded-full border font-medium transition-all"
                style={{
                  background: active ? 'rgba(22,163,74,0.12)' : 'var(--card)',
                  borderColor: active ? 'var(--ember-orange)' : 'var(--border)',
                  color: active ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard>
        <SubHeading>Additional behavioral notes</SubHeading>
        <TextArea
          value={data.behavior_notes}
          onChange={(v) => onChange({ behavior_notes: v })}
          placeholder="Describe any triggers, strategies that help, or other important behavioral context…"
          rows={4}
        />
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 4 — Equipment & Mobility
// ---------------------------------------------------------------------------

function Section4({
  data,
  onChange,
}: {
  data: FormState['s4'];
  onChange: (patch: Partial<FormState['s4']>) => void;
}) {
  function addDevice() {
    onChange({ devices: [...data.devices, { device_type: '', requires_transfer: false, notes: '' }] });
  }

  function removeDevice(i: number) {
    onChange({ devices: data.devices.filter((_, idx) => idx !== i) });
  }

  function updateDevice(i: number, field: keyof DeviceEntry, value: string | boolean) {
    const updated = data.devices.map((d, idx) =>
      idx === i ? { ...d, [field]: value } : d
    );
    onChange({ devices: updated });
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <SectionCard>
        <div className="flex items-center justify-between">
          <SubHeading>Assistive devices & equipment</SubHeading>
          <button
            type="button"
            onClick={addDevice}
            className="flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: 'var(--ember-orange)' }}
          >
            <Plus className="h-3 w-3" /> Add device
          </button>
        </div>
        {data.devices.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            No assistive devices. Click "Add device" if your camper uses any equipment.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.devices.map((d, i) => (
              <div
                key={i}
                className="rounded-xl border p-3.5 flex flex-col gap-3"
                style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
              >
                <div>
                  <FieldLabel>Device / equipment type</FieldLabel>
                  <SelectInput value={d.device_type} onChange={(v) => updateDevice(i, 'device_type', v)}>
                    <option value="">Select type</option>
                    {DEVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Notes (e.g. settings, restrictions)</FieldLabel>
                  <TextInput value={d.notes} onChange={(v) => updateDevice(i, 'notes', v)} placeholder="Any relevant details" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={d.requires_transfer}
                      onChange={(e) => updateDevice(i, 'requires_transfer', e.target.checked)}
                    />
                    <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                      Requires staff assistance for transfer / use
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => removeDevice(i)}
                    className="flex items-center gap-1 text-xs"
                    style={{ color: 'var(--destructive)' }}
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
                {d.device_type === 'CPAP / BiPAP' && (
                  <div
                    className="flex items-start gap-2 rounded-lg p-3 text-xs"
                    style={{ background: 'rgba(251,191,36,0.10)', color: '#92400e', border: '1px solid rgba(251,191,36,0.30)' }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    A CPAP waiver is required in Section 9 (Required Documents).
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <SubHeading>Mobility notes</SubHeading>
        <TextArea
          value={data.mobility_notes}
          onChange={(v) => onChange({ mobility_notes: v })}
          placeholder="Describe any specific mobility needs, accessibility requirements, or terrain restrictions…"
          rows={3}
        />
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 5 — Diet & Feeding
// ---------------------------------------------------------------------------

function Section5({
  data,
  onChange,
}: {
  data: FormState['s5'];
  onChange: (patch: Partial<FormState['s5']>) => void;
}) {
  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Special Diet */}
      <SectionCard>
        <SubHeading>Dietary restrictions</SubHeading>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.special_diet}
            onChange={(e) => onChange({ special_diet: e.target.checked })}
          />
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>
            This camper requires a special diet
          </span>
        </label>
        {data.special_diet && (
          <div>
            <FieldLabel required>Describe dietary needs</FieldLabel>
            <TextArea
              value={data.diet_description}
              onChange={(v) => onChange({ diet_description: v })}
              placeholder="e.g. Gluten-free, dairy-free, no red meat, kosher, halal…"
              rows={3}
            />
          </div>
        )}
      </SectionCard>

      {/* Texture & Fluid */}
      <SectionCard>
        <SubHeading>Texture & fluid modifications</SubHeading>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.texture_modified}
            onChange={(e) => onChange({ texture_modified: e.target.checked })}
          />
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>
            Food textures must be modified (IDDSI standard)
          </span>
        </label>
        {data.texture_modified && (
          <div className="max-w-xs">
            <FieldLabel>Texture / consistency level</FieldLabel>
            <SelectInput value={data.texture_level} onChange={(v) => onChange({ texture_level: v })}>
              <option value="">Select texture level</option>
              {TEXTURE_LEVELS.map((t) => <option key={t} value={t}>{t}</option>)}
            </SelectInput>
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={data.fluid_restriction}
            onChange={(e) => onChange({ fluid_restriction: e.target.checked })}
          />
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>
            Fluid intake must be restricted or thickened
          </span>
        </label>
        {data.fluid_restriction && (
          <div>
            <FieldLabel>Details</FieldLabel>
            <TextInput value={data.fluid_details} onChange={(v) => onChange({ fluid_details: v })} placeholder="Describe fluid restriction or thickening requirements" />
          </div>
        )}
      </SectionCard>

      {/* G-Tube */}
      <SectionCard>
        <SubHeading>Tube feeding (G-tube / NG-tube)</SubHeading>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.g_tube}
            onChange={(e) => onChange({ g_tube: e.target.checked })}
          />
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>
            This camper receives nutrition via G-tube or NG-tube
          </span>
        </label>
        {data.g_tube && (
          <div className="flex flex-col gap-4 pt-1">
            <FormRow>
              <div>
                <FieldLabel required>Formula / formula name</FieldLabel>
                <TextInput value={data.formula} onChange={(v) => onChange({ formula: v })} placeholder="e.g. Pediasure, Compleat Pediatric" />
              </div>
              <div>
                <FieldLabel required>Amount per feeding</FieldLabel>
                <TextInput value={data.amount_per_feeding} onChange={(v) => onChange({ amount_per_feeding: v })} placeholder="e.g. 240 mL" />
              </div>
            </FormRow>
            <FormRow>
              <div>
                <FieldLabel>Number of feedings per day</FieldLabel>
                <TextInput value={data.feedings_per_day} onChange={(v) => onChange({ feedings_per_day: v })} placeholder="e.g. 4" />
              </div>
              <div>
                <FieldLabel>Scheduled feeding times</FieldLabel>
                <TextInput value={data.feeding_times} onChange={(v) => onChange({ feeding_times: v })} placeholder="e.g. 8am, 12pm, 5pm, 9pm" />
              </div>
            </FormRow>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={data.bolus_only}
                onChange={(e) => onChange({ bolus_only: e.target.checked })}
              />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>Bolus feeding only (not continuous)</span>
            </label>
            <div
              className="flex items-start gap-2 rounded-lg p-3 text-xs"
              style={{ background: 'rgba(251,191,36,0.10)', color: '#92400e', border: '1px solid rgba(251,191,36,0.30)' }}
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              A G-Tube / Feeding Action Plan is required in Section 9 (Required Documents).
            </div>
          </div>
        )}
        <div>
          <FieldLabel>Additional feeding notes</FieldLabel>
          <TextArea
            value={data.feeding_notes}
            onChange={(v) => onChange({ feeding_notes: v })}
            placeholder="Any other feeding-related information staff should know…"
            rows={2}
          />
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Section 6 — Personal Care
// ---------------------------------------------------------------------------

const ASSISTANCE_LEVELS = [
  { value: 'independent', label: 'Independent' },
  { value: 'assisted',    label: 'Needs assistance' },
  { value: 'dependent',   label: 'Fully dependent on staff' },
];

function AssistanceLevelSelect({
  id,
  label,
  value,
  onChange,
  notes,
  onNotesChange,
  notesPlaceholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  notesPlaceholder?: string;
}) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{label}</p>
      <div className="flex gap-2 flex-wrap">
        {ASSISTANCE_LEVELS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="px-3 py-1.5 text-xs rounded-full border font-medium transition-all"
              style={{
                background: active ? 'rgba(22,163,74,0.12)' : 'var(--input)',
                borderColor: active ? 'var(--ember-orange)' : 'var(--border)',
                color: active ? 'var(--ember-orange)' : 'var(--muted-foreground)',
              }}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {value && (
        <TextInput
          id={`${id}_notes`}
          value={notes}
          onChange={onNotesChange}
          placeholder={notesPlaceholder ?? 'Any specific notes for staff (optional)'}
        />
      )}
    </div>
  );
}

function Section6({
  data,
  onChange,
}: {
  data: FormState['s6'];
  onChange: (patch: Partial<FormState['s6']>) => void;
}) {
  return (
    <div className="flex flex-col gap-6 p-8">
      <div
        className="flex items-start gap-2 rounded-lg p-3 text-xs"
        style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--ember-orange)', border: '1px solid rgba(22,163,74,0.20)' }}
      >
        <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        For each area, select the level of assistance your camper requires. Add notes for any specific care protocols staff should follow.
      </div>

      <AssistanceLevelSelect
        id="bathing"
        label="Bathing / showering"
        value={data.bathing_level}
        onChange={(v) => onChange({ bathing_level: v })}
        notes={data.bathing_notes}
        onNotesChange={(v) => onChange({ bathing_notes: v })}
        notesPlaceholder="e.g. Needs seat, uses handheld shower, max temp 100°F"
      />

      <AssistanceLevelSelect
        id="toileting"
        label="Toileting (daytime)"
        value={data.toileting_level}
        onChange={(v) => onChange({ toileting_level: v })}
        notes={data.toileting_notes}
        onNotesChange={(v) => onChange({ toileting_notes: v })}
        notesPlaceholder="e.g. Uses grab bars, wears pull-ups, catheter"
      />

      <SectionCard>
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Nighttime toileting</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.nighttime_toileting}
            onChange={(e) => onChange({ nighttime_toileting: e.target.checked })}
          />
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>
            Camper needs help with toileting during the night
          </span>
        </label>
        {data.nighttime_toileting && (
          <TextInput
            value={data.nighttime_notes}
            onChange={(v) => onChange({ nighttime_notes: v })}
            placeholder="Describe nighttime routine or waking schedule"
          />
        )}
      </SectionCard>

      <AssistanceLevelSelect
        id="dressing"
        label="Dressing & undressing"
        value={data.dressing_level}
        onChange={(v) => onChange({ dressing_level: v })}
        notes={data.dressing_notes}
        onNotesChange={(v) => onChange({ dressing_notes: v })}
        notesPlaceholder="e.g. Can manage buttons, needs help with shoes, adaptive clothing"
      />

      <AssistanceLevelSelect
        id="oral_hygiene"
        label="Oral hygiene (brushing teeth)"
        value={data.oral_hygiene_level}
        onChange={(v) => onChange({ oral_hygiene_level: v })}
        notes={''}
        onNotesChange={() => {}}
        notesPlaceholder="e.g. Electric toothbrush, special toothpaste, staff must supervise"
      />

      <SectionCard>
        <SubHeading>Positioning & transfers</SubHeading>
        <TextArea
          value={data.positioning_notes}
          onChange={(v) => onChange({ positioning_notes: v })}
          placeholder="Describe any specific positioning, transfer techniques, or lifting requirements staff must know…"
          rows={3}
        />
      </SectionCard>

      <SectionCard>
        <SubHeading>Sleep routine & special needs</SubHeading>
        <TextArea
          value={data.sleep_notes}
          onChange={(v) => onChange({ sleep_notes: v })}
          placeholder="e.g. Must sleep on left side, uses CPAP, needs white noise, usual bedtime, waking patterns…"
          rows={3}
        />
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 7 — Activities & Permissions
// ---------------------------------------------------------------------------

type ActivityLevel = 'yes' | 'no' | 'restricted' | '';

interface ActivityDef {
  key: keyof FormState['s7'];
  label: string;
  description: string;
}

const ACTIVITIES: ActivityDef[] = [
  {
    key: 'swimming',
    label: 'Swimming & water activities',
    description: 'Includes pool swimming, water play, and water-based recreational activities.',
  },
  {
    key: 'hiking',
    label: 'Hiking & nature trails',
    description: 'Includes outdoor walking trails, nature hikes, and uneven terrain.',
  },
  {
    key: 'horseback',
    label: 'Horseback riding',
    description: 'Therapeutic and recreational horseback riding with certified instructors.',
  },
  {
    key: 'rock_climbing',
    label: 'Rock climbing & rappelling',
    description: 'Includes climbing wall and low ropes elements with safety equipment.',
  },
  {
    key: 'sports',
    label: 'Team sports & group games',
    description: 'Includes adapted sports, ball games, and cooperative group activities.',
  },
  {
    key: 'arts_crafts',
    label: 'Arts & crafts',
    description: 'Includes painting, sculpture, sensory art, and creative workshops.',
  },
  {
    key: 'field_trips',
    label: 'Field trips & off-campus activities',
    description: 'Supervised excursions to community locations or off-site events.',
  },
];

function ActivityRow({
  activity,
  data,
  onChange,
}: {
  activity: ActivityDef;
  data: { level: string; notes: string };
  onChange: (patch: { level?: string; notes?: string }) => void;
}) {
  const level = data.level as ActivityLevel;

  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3"
      style={{
        background: 'var(--card)',
        borderColor: level === 'no' ? 'rgba(220,38,38,0.20)' : level === 'yes' ? 'rgba(22,163,74,0.15)' : 'var(--border)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{activity.label}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{activity.description}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {(['yes', 'restricted', 'no'] as ActivityLevel[]).map((opt) => {
            if (!opt) return null;
            const active = level === opt;
            const colors: Record<string, { bg: string; border: string; text: string }> = {
              yes:        { bg: 'rgba(22,163,74,0.12)',  border: 'var(--ember-orange)', text: 'var(--ember-orange)' },
              restricted: { bg: 'rgba(251,191,36,0.12)', border: '#d97706',             text: '#d97706' },
              no:         { bg: 'rgba(220,38,38,0.08)',  border: 'var(--destructive)',  text: 'var(--destructive)' },
            };
            const c = colors[opt];
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange({ level: opt })}
                className="text-xs px-2.5 py-1 rounded-full border font-medium transition-all capitalize"
                style={{
                  background: active ? c.bg : 'var(--input)',
                  borderColor: active ? c.border : 'var(--border)',
                  color: active ? c.text : 'var(--muted-foreground)',
                }}
                aria-pressed={active}
              >
                {opt === 'restricted' ? 'With limits' : opt === 'yes' ? 'Permitted' : 'Not permitted'}
              </button>
            );
          })}
        </div>
      </div>
      {(level === 'restricted' || level === 'no') && (
        <div>
          <FieldLabel>{level === 'restricted' ? 'Describe limitations or required accommodations' : 'Reason (optional)'}</FieldLabel>
          <TextArea
            value={data.notes}
            onChange={(v) => onChange({ notes: v })}
            placeholder={
              level === 'restricted'
                ? 'e.g. May swim in shallow end only with 1:1 ratio, must wear life vest at all times'
                : 'e.g. Medical contraindication due to seizure history'
            }
            rows={2}
          />
        </div>
      )}
    </div>
  );
}

function Section7({
  data,
  onChange,
}: {
  data: FormState['s7'];
  onChange: (patch: Partial<FormState['s7']>) => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div
        className="flex items-start gap-2 rounded-lg p-3 text-xs"
        style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--ember-orange)', border: '1px solid rgba(22,163,74,0.20)' }}
      >
        <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        For each activity, select whether your camper may participate fully, with limitations, or not at all. "With limits" requires a description.
      </div>

      {ACTIVITIES.map((activity) => {
        const key = activity.key;
        return (
          <ActivityRow
            key={key}
            activity={activity}
            data={data[key] as { level: string; notes: string }}
            onChange={(patch) =>
              onChange({
                [key]: { ...(data[key] as object), ...patch },
              } as Partial<FormState['s7']>)
            }
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 8 — Medications
// ---------------------------------------------------------------------------

const MEDICATION_ROUTES = ['Oral', 'Injectable', 'Topical', 'Inhaled', 'Transdermal', 'Nasal', 'Optic', 'Otic', 'Rectal', 'Other'];
const MEDICATION_FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 4 hours', 'Every 6 hours', 'Every 8 hours', 'As needed (PRN)', 'Weekly', 'Other'];

function newMedication(): MedicationEntry {
  return {
    id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '', dosage: '', frequency: '', route: '', reason: '',
    physician: '', self_admin: false, refrigeration: false, notes: '',
  };
}

function Section8({ data, onChange }: {
  data: FormState['s8'];
  onChange: (patch: Partial<FormState['s8']>) => void;
}) {
  function addMed() {
    onChange({ medications: [...data.medications, newMedication()] });
  }

  function removeMed(id: string) {
    onChange({ medications: data.medications.filter((m) => m.id !== id) });
  }

  function updateMed(id: string, patch: Partial<MedicationEntry>) {
    onChange({
      medications: data.medications.map((m) => m.id === id ? { ...m, ...patch } : m),
    });
  }

  return (
    <div className="p-5 flex flex-col gap-5">
      {/* No medications checkbox */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          className="w-4 h-4 rounded"
          checked={data.no_medications}
          onChange={(e) => onChange({ no_medications: e.target.checked, medications: e.target.checked ? [] : data.medications })}
        />
        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Camper takes no medications
          </span>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Check this if the camper does not require any medications at camp.
          </p>
        </div>
      </label>

      {!data.no_medications && (
        <>
          {data.medications.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
              No medications added yet. Use the button below to add each medication.
            </p>
          )}

          {data.medications.map((med, idx) => (
            <div
              key={med.id}
              className="rounded-xl border p-4 flex flex-col gap-3"
              style={{ borderColor: 'var(--border)', background: 'var(--glass-light, #fafafa)' }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--ember-orange)' }}>
                  Medication {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeMed(med.id)}
                  className="p-1 rounded hover:bg-red-50 transition-colors"
                  style={{ color: 'var(--destructive)' }}
                  title="Remove medication"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Row 1: name + dosage */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    Medication name *
                  </label>
                  <TextInput
                    placeholder="e.g. Metformin"
                    value={med.name}
                    onChange={(v) => updateMed(med.id, { name: v })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    Dosage *
                  </label>
                  <TextInput
                    placeholder="e.g. 500 mg"
                    value={med.dosage}
                    onChange={(v) => updateMed(med.id, { dosage: v })}
                  />
                </div>
              </div>

              {/* Row 2: frequency + route */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    Frequency
                  </label>
                  <SelectInput value={med.frequency} onChange={(v) => updateMed(med.id, { frequency: v })}>
                    <option value="">Select frequency</option>
                    {MEDICATION_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </SelectInput>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    Route
                  </label>
                  <SelectInput value={med.route} onChange={(v) => updateMed(med.id, { route: v })}>
                    <option value="">Select route</option>
                    {MEDICATION_ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </SelectInput>
                </div>
              </div>

              {/* Row 3: reason + prescribing physician */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    Reason / condition treated
                  </label>
                  <TextInput
                    placeholder="e.g. Type 2 diabetes"
                    value={med.reason}
                    onChange={(v) => updateMed(med.id, { reason: v })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    Prescribing physician
                  </label>
                  <TextInput
                    placeholder="Dr. Smith"
                    value={med.physician}
                    onChange={(v) => updateMed(med.id, { physician: v })}
                  />
                </div>
              </div>

              {/* Flags */}
              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded"
                    checked={med.self_admin}
                    onChange={(e) => updateMed(med.id, { self_admin: e.target.checked })}
                  />
                  <span className="text-xs" style={{ color: 'var(--foreground)' }}>Camper self-administers</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded"
                    checked={med.refrigeration}
                    onChange={(e) => updateMed(med.id, { refrigeration: e.target.checked })}
                  />
                  <span className="text-xs" style={{ color: 'var(--foreground)' }}>Requires refrigeration</span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  Administration notes (optional)
                </label>
                <TextArea
                  placeholder="Special instructions, side effects to watch for, etc."
                  value={med.notes}
                  onChange={(v) => updateMed(med.id, { notes: v })}
                  rows={2}
                />
              </div>
            </div>
          ))}

          <Button variant="secondary" size="sm" onClick={addMed} className="self-start">
            <Plus className="h-3.5 w-3.5" />
            Add medication
          </Button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 9 — Required Documents
// ---------------------------------------------------------------------------

const DOC_DEFS: {
  key: keyof FormState['s9'];
  label: string;
  description: string;
  required: boolean;
  accept: string;
}[] = [
  { key: 'immunization',  label: 'Immunization Record',    description: 'Current immunization history from physician.', required: true,  accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'medical_exam',  label: 'Medical Examination',    description: 'Physical exam completed within the past 12 months.', required: true, accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'insurance_card', label: 'Insurance Card',        description: 'Front and back of insurance card.', required: true, accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'cpap_waiver',   label: 'CPAP/BiPAP Waiver',      description: 'Required if camper uses a CPAP or BiPAP device.', required: false, accept: '.pdf' },
  { key: 'seizure_plan',  label: 'Seizure Action Plan',    description: 'Required if camper has a seizure history.', required: false, accept: '.pdf' },
  { key: 'gtube_plan',    label: 'G-Tube Care Plan',       description: 'Required if camper receives tube feedings.', required: false, accept: '.pdf' },
];

function DocumentUploader({
  docKey,
  label,
  description,
  required,
  accept,
  slot,
  onSelect,
  onRemove,
}: {
  docKey: string;
  label: string;
  description: string;
  required: boolean;
  accept: string;
  slot: DocSlot;
  onSelect: (key: string, file: File, slot: DocSlot) => void;
  onRemove: (key: string) => void;
}) {
  const inputId = `doc-upload-${docKey}`;
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-2"
      style={{
        borderColor: slot ? 'rgba(22,163,74,0.35)' : 'var(--border)',
        background: slot ? 'rgba(22,163,74,0.03)' : 'var(--glass-light, #fafafa)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{label}</span>
            {required ? (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(22,163,74,0.10)', color: 'var(--ember-orange)' }}>Required</span>
            ) : (
              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--glass-medium, #f3f4f6)', color: 'var(--muted-foreground)' }}>Conditional</span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{description}</p>
        </div>
        {slot && (
          <button
            type="button"
            onClick={() => onRemove(docKey)}
            className="p-1 rounded hover:bg-red-50 transition-colors flex-shrink-0"
            style={{ color: 'var(--destructive)' }}
            title="Remove document"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {slot ? (
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
          <span className="text-xs truncate" style={{ color: 'var(--foreground)' }}>{slot.file_name}</span>
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
            ({(slot.size / 1024).toFixed(0)} KB)
          </span>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dashed transition-colors hover:bg-[var(--dash-nav-hover-bg)] self-start"
          style={{ borderColor: 'var(--border)' }}
        >
          <Upload className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Choose file</span>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>PDF, JPG, PNG</span>
          <input
            id={inputId}
            type="file"
            className="sr-only"
            accept={accept}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              onSelect(docKey, file, { file_name: file.name, size: file.size, mime: file.type });
              e.target.value = '';
            }}
          />
        </label>
      )}
    </div>
  );
}

function Section9({
  data,
  hasCpap,
  hasSeizures,
  hasGtube,
  onChange,
  onFileSelect,
}: {
  data: FormState['s9'];
  hasCpap: boolean;
  hasSeizures: boolean;
  hasGtube: boolean;
  onChange: (patch: Partial<FormState['s9']>) => void;
  onFileSelect: (key: string, file: File, slot: DocSlot) => void;
}) {
  const conditionalFlags: Record<string, boolean> = {
    cpap_waiver: hasCpap,
    seizure_plan: hasSeizures,
    gtube_plan: hasGtube,
  };

  const visibleDocs = DOC_DEFS.filter((d) =>
    d.required || conditionalFlags[d.key]
  );

  function handleRemove(key: string) {
    onChange({ [key]: null } as Partial<FormState['s9']>);
  }

  function handleSelect(key: string, file: File, slot: DocSlot) {
    onFileSelect(key, file, slot);
    onChange({ [key]: slot } as Partial<FormState['s9']>);
  }

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Info banner */}
      <div
        className="rounded-xl px-4 py-3 flex gap-3"
        style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.18)' }}
      >
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
            Documents are required before submission
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Upload all required documents. Conditional documents are shown based on your earlier responses.
            Accepted formats: PDF, JPG, PNG. Max 10 MB per file.
          </p>
        </div>
      </div>

      {visibleDocs.map((doc) => (
        <DocumentUploader
          key={doc.key}
          docKey={doc.key}
          label={doc.label}
          description={doc.description}
          required={doc.required}
          accept={doc.accept}
          slot={data[doc.key]}
          onSelect={handleSelect}
          onRemove={handleRemove}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 10 — Consents & Signatures
// ---------------------------------------------------------------------------

const CONSENT_DEFS: { key: keyof Pick<FormState['s10'], 'consent_medical'|'consent_photo'|'consent_liability'|'consent_medication'|'consent_hipaa'>; title: string; body: string }[] = [
  {
    key: 'consent_medical',
    title: 'Medical Treatment Authorization',
    body: 'I authorize Camp Burnt Gin and its staff to seek and consent to emergency medical, dental, surgical, or hospital care for my child if I cannot be reached in time. I understand that every effort will be made to contact me before medical treatment is administered.',
  },
  {
    key: 'consent_photo',
    title: 'Photo & Media Release',
    body: 'I grant Camp Burnt Gin permission to photograph and/or record my child during camp activities. These images may be used in camp publications, website, social media, and promotional materials. No personally identifying information will be shared without additional consent.',
  },
  {
    key: 'consent_liability',
    title: 'Liability Waiver & Release',
    body: 'I acknowledge that participation in camp activities involves inherent risks. I voluntarily assume these risks and release Camp Burnt Gin, its directors, staff, and volunteers from liability for any injury, illness, or loss arising from my child\'s participation, except in cases of gross negligence.',
  },
  {
    key: 'consent_medication',
    title: 'Medication Administration Consent',
    body: 'I authorize Camp Burnt Gin nursing staff to administer medications listed in Section 8 of this application according to the instructions provided. I certify that all medications are in their original labeled containers and that the information provided is accurate.',
  },
  {
    key: 'consent_hipaa',
    title: 'HIPAA Privacy Acknowledgment',
    body: 'I acknowledge receipt of Camp Burnt Gin\'s Notice of Privacy Practices. I understand that protected health information about my child may be used and disclosed as described in that notice for treatment, payment, and health care operations.',
  },
];

function SignaturePad({
  onCapture,
  onClear,
}: {
  onCapture: (dataUrl: string) => void;
  onClear: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing  = useRef(false);
  const hasStrokes = useRef(false);

  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.strokeStyle = 'var(--foreground)';
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStrokes.current = true;
  }

  function endDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (hasStrokes.current && canvasRef.current) {
      onCapture(canvasRef.current.toDataURL('image/png'));
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokes.current = false;
    onClear();
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={480}
        height={120}
        className="w-full rounded-lg border touch-none"
        style={{ borderColor: 'var(--border)', background: '#fafafa', cursor: 'crosshair' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <button
        type="button"
        onClick={clearCanvas}
        className="text-xs self-end hover:underline"
        style={{ color: 'var(--muted-foreground)' }}
      >
        Clear signature
      </button>
    </div>
  );
}

function Section10({
  data,
  onChange,
}: {
  data: FormState['s10'];
  onChange: (patch: Partial<FormState['s10']>) => void;
}) {
  const today = new Date().toISOString().split('T')[0];

  const allConsents = data.consent_medical && data.consent_photo && data.consent_liability
    && data.consent_medication && data.consent_hipaa;

  return (
    <div className="p-5 flex flex-col gap-6">
      {/* Consent blocks */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
          Read and acknowledge each item
        </p>
        {CONSENT_DEFS.map((c) => (
          <label
            key={c.key}
            className="flex gap-3 cursor-pointer rounded-xl border p-4 transition-colors"
            style={{
              borderColor: data[c.key] ? 'rgba(22,163,74,0.35)' : 'var(--border)',
              background:  data[c.key] ? 'rgba(22,163,74,0.03)' : 'var(--glass-light, #fafafa)',
            }}
          >
            <input
              type="checkbox"
              className="w-4 h-4 mt-0.5 flex-shrink-0 rounded"
              checked={data[c.key]}
              onChange={(e) => onChange({ [c.key]: e.target.checked } as Partial<FormState['s10']>)}
            />
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{c.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{c.body}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Signature section — only show once all consents are checked */}
      {allConsents && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border p-5 flex flex-col gap-4"
          style={{ borderColor: 'var(--border)', background: 'var(--glass-light, #fafafa)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Guardian signature
          </p>

          {/* Signature type toggle */}
          <div className="flex gap-2">
            {(['drawn', 'typed'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ signature_type: t, signature_data: '' })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                style={{
                  borderColor: data.signature_type === t ? 'var(--ember-orange)' : 'var(--border)',
                  background:  data.signature_type === t ? 'rgba(22,163,74,0.08)' : 'transparent',
                  color:       data.signature_type === t ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                }}
              >
                {t === 'drawn' ? 'Draw signature' : 'Type name instead'}
              </button>
            ))}
          </div>

          {data.signature_type === 'drawn' ? (
            <SignaturePad
              onCapture={(d) => onChange({ signature_data: d })}
              onClear={() => onChange({ signature_data: '' })}
            />
          ) : (
            <div className="flex flex-col gap-2">
              <TextInput
                placeholder="Type your full legal name"
                value={data.signed_name}
                onChange={(v) => onChange({ signed_name: v })}
              />
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Typing your name constitutes a legally binding electronic signature.
              </p>
            </div>
          )}

          {/* Printed name + date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                Printed name *
              </label>
              <TextInput
                placeholder="Guardian full legal name"
                value={data.signed_name}
                onChange={(v) => onChange({ signed_name: v })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                Date *
              </label>
              <TextInput
                type="date"
                value={data.signed_date || today}
                onChange={(v) => onChange({ signed_date: v })}
              />
            </div>
          </div>

          {data.signed_name.trim() && data.signed_date && (
            <div
              className="rounded-lg px-3 py-2 flex items-center gap-2"
              style={{ background: 'rgba(22,163,74,0.08)' }}
            >
              <Check className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
              <p className="text-xs" style={{ color: 'var(--ember-orange)' }}>
                Signed by <strong>{data.signed_name}</strong> on {data.signed_date}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {!allConsents && (
        <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
          Please acknowledge all consent items above before signing.
        </p>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({
  currentStep,
  form,
  onJump,
}: {
  currentStep: number;
  form: FormState;
  onJump: (step: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap" role="navigation" aria-label="Application steps">
      {SECTIONS.map((section, i) => {
        const status = getSectionStatus(i, form);
        const isActive = i === currentStep;
        const isComplete = status === 'complete';
        return (
          <Fragment key={section.id}>
            {i > 0 && (
              <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--border)' }} />
            )}
            <button
              type="button"
              onClick={() => onJump(i)}
              className="flex items-center gap-1 text-xs transition-colors rounded px-1 py-0.5 hover:bg-[var(--dash-nav-hover-bg)]"
              style={{
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--ember-orange)' : isComplete ? 'var(--ember-orange)' : 'var(--muted-foreground)',
              }}
            >
              {isComplete && !isActive && <Check className="h-3 w-3 flex-shrink-0" />}
              {section.shortLabel}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ApplicationFormPage() {
  const navigate = useNavigate();

  // ── State ─────────────────────────────────────────────────────────────────

  const [form, setForm] = useState<FormState>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FormState;
        return { ...INITIAL_STATE, ...parsed, meta: { ...INITIAL_STATE.meta, ...parsed.meta } };
      }
    } catch {
      /* ignore */
    }
    return INITIAL_STATE;
  });

  const [sessions, setSessions]         = useState<Session[]>([]);
  const [currentStep, setCurrentStep]   = useState<number>(form.meta.activeSection);
  const [isSaving, setIsSaving]         = useState(false);
  const [lastSavedAt, setLastSavedAt]   = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Holds actual File objects for document uploads — not serialized to localStorage */
  const docFilesRef = useRef<Record<string, File | null>>({});

  // ── Load sessions ──────────────────────────────────────────────────────────

  useEffect(() => {
    getSessions().then(setSessions).catch(() => {});
  }, []);

  // ── Auto-save to localStorage ──────────────────────────────────────────────

  const persistDraft = useCallback((state: FormState) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
      setLastSavedAt(new Date());
    } catch {
      /* quota exceeded — silently ignore */
    }
  }, []);

  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      setIsSaving(true);
      persistDraft(form);
      setIsSaving(false);
    }, AUTOSAVE_DELAY);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [form, persistDraft]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function updateSection<K extends keyof FormState>(key: K, patch: Partial<FormState[K]>) {
    setForm((prev) => ({
      ...prev,
      [key]: { ...(prev[key] as object), ...(patch as object) },
    }));
  }

  function goToStep(step: number) {
    setCurrentStep(step);
    setForm((prev) => ({ ...prev, meta: { ...prev.meta, activeSection: step } }));
  }

  function handleClearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setForm(INITIAL_STATE);
    setCurrentStep(0);
    toast.success('Draft cleared.');
  }

  function handleSaveDraft() {
    persistDraft(form);
    toast.success('Draft saved.');
  }

  async function handleSubmit() {
    if (countMissing(form) > 0) {
      toast.error('Please complete all sections before submitting.');
      return;
    }
    if (!form.s1.session_id) {
      toast.error('Please select a camp session in Section 1.');
      return;
    }

    setIsSubmitting(true);
    const tid = toast.loading('Submitting application…');

    try {
      // ── Step 1: Create camper ─────────────────────────────────────────────
      const camper = await createCamper({
        first_name:    form.s1.camper_first_name,
        last_name:     form.s1.camper_last_name,
        date_of_birth: form.s1.camper_dob,
        gender:        form.s1.camper_gender,
        tshirt_size:   '',
      });
      const camperId = camper.id;

      // ── Step 2: Emergency contact ─────────────────────────────────────────
      if (form.s1.ec_name.trim()) {
        await createEmergencyContact({
          camper_id:            camperId,
          name:                 form.s1.ec_name,
          relationship:         form.s1.ec_relationship,
          phone_primary:        form.s1.ec_phone,
          is_primary:           true,
          is_authorized_pickup: false,
        });
      }

      // ── Step 3: Medical record ────────────────────────────────────────────
      await createMedicalRecord({
        camper_id:               camperId,
        physician_name:          form.s2.physician_name,
        physician_phone:         form.s2.physician_phone,
        insurance_provider:      form.s2.insurance_provider,
        insurance_policy_number: form.s2.insurance_policy,
        special_needs:           form.s3.behavior_notes || undefined,
      });

      // ── Step 4: Diagnoses ─────────────────────────────────────────────────
      for (const dx of form.s2.diagnoses) {
        if (!dx.condition.trim()) continue;
        await createDiagnosis({
          camper_id:      camperId,
          name:           dx.condition,
          severity_level: 'moderate',
          notes:          dx.notes || undefined,
        });
      }

      // ── Step 5: Allergies ─────────────────────────────────────────────────
      for (const al of form.s2.allergies) {
        if (!al.allergen.trim()) continue;
        await createAllergy({
          camper_id: camperId,
          allergen:  al.allergen,
          severity:  al.severity || 'moderate',
          reaction:  al.reaction || undefined,
          treatment: al.epi_pen ? 'Epi-pen available' : undefined,
        });
      }

      // ── Step 6: Behavioral profile ────────────────────────────────────────
      await createBehavioralProfile({
        camper_id:              camperId,
        aggression:             form.s3.aggression === true,
        self_abuse:             form.s3.self_abuse  === true,
        wandering_risk:         form.s3.wandering   === true,
        one_to_one_supervision: form.s3.one_to_one  === true,
        developmental_delay:    form.s3.developmental_delay === true,
        communication_methods:  form.s3.communication_methods.length
                                  ? form.s3.communication_methods : undefined,
        notes: form.s3.behavior_notes || undefined,
      });

      // ── Step 7: Assistive devices ─────────────────────────────────────────
      for (const dev of form.s4.devices) {
        if (!dev.device_type.trim()) continue;
        await createAssistiveDevice({
          camper_id:                    camperId,
          device_type:                  dev.device_type,
          requires_transfer_assistance: dev.requires_transfer,
          notes:                        dev.notes || undefined,
        });
      }

      // ── Step 8: Feeding plan ──────────────────────────────────────────────
      if (form.s5.special_diet || form.s5.g_tube) {
        await createFeedingPlan({
          camper_id:          camperId,
          special_diet:       form.s5.special_diet,
          diet_description:   form.s5.diet_description || undefined,
          g_tube:             form.s5.g_tube,
          formula:            form.s5.formula || undefined,
          amount_per_feeding: form.s5.amount_per_feeding || undefined,
          feedings_per_day:   form.s5.feedings_per_day
                                ? parseInt(form.s5.feedings_per_day, 10) : undefined,
          feeding_times:      form.s5.feeding_times
                                ? form.s5.feeding_times.split(',').map((t) => t.trim()).filter(Boolean)
                                : undefined,
        });
      }

      // ── Step 9: Medications ───────────────────────────────────────────────
      if (!form.s8.no_medications) {
        for (const med of form.s8.medications) {
          if (!med.name.trim()) continue;
          await createMedication({
            camper_id:             camperId,
            name:                  med.name,
            dosage:                med.dosage,
            frequency:             med.frequency,
            purpose:               med.reason || undefined,
            prescribing_physician: med.physician || undefined,
            notes: [
              med.route         ? `Route: ${med.route}` : '',
              med.self_admin    ? 'Self-administers' : '',
              med.refrigeration ? 'Requires refrigeration' : '',
              med.notes,
            ].filter(Boolean).join('; ') || undefined,
          });
        }
      }

      // ── Step 10: Activity permissions ─────────────────────────────────────
      const activityMap: Record<keyof typeof form.s7, string> = {
        swimming:      'Swimming',
        hiking:        'Hiking',
        horseback:     'Horseback Riding',
        rock_climbing: 'Rock Climbing',
        sports:        'Team Sports',
        arts_crafts:   'Arts & Crafts',
        field_trips:   'Field Trips',
      };
      const levelMap: Record<string, string> = {
        'Permitted':     'yes',
        'With limits':   'restricted',
        'Not permitted': 'no',
      };
      for (const [key, activityName] of Object.entries(activityMap)) {
        const entry = form.s7[key as keyof typeof form.s7];
        if (!entry.level) continue;
        const permLevel = levelMap[entry.level] ?? 'yes';
        await createActivityPermission({
          camper_id:        camperId,
          activity_name:    activityName,
          permission_level: permLevel,
          notes:            entry.notes || undefined,
        });
      }

      // ── Step 11: Create application ───────────────────────────────────────
      const application = await createApplication({
        camper_id:  camperId,
        session_id: Number(form.s1.session_id),
      });
      const applicationId = application.id;

      // ── Step 12: Upload documents ─────────────────────────────────────────
      const docTypeLabels: Record<string, string> = {
        immunization:   'Immunization Record',
        medical_exam:   'Medical Examination',
        insurance_card: 'Insurance Card',
        cpap_waiver:    'CPAP Waiver',
        seizure_plan:   'Seizure Action Plan',
        gtube_plan:     'G-Tube Care Plan',
      };
      for (const [key, slot] of Object.entries(form.s9)) {
        if (!slot) continue;
        const file = docFilesRef.current[key];
        if (!file) continue;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('documentable_type', 'App\\Models\\Application');
        fd.append('documentable_id', String(applicationId));
        fd.append('document_type', docTypeLabels[key] ?? key);
        await uploadDocument(fd);
      }

      // ── Step 13: Sign application ─────────────────────────────────────────
      await signApplication(applicationId, form.s10.signed_name);

      // ── Success ───────────────────────────────────────────────────────────
      toast.dismiss(tid);
      toast.success('Application submitted successfully!');
      localStorage.removeItem(DRAFT_KEY);
      navigate(ROUTES.PARENT_APPLICATIONS);

    } catch (err: unknown) {
      toast.dismiss(tid);
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg ?? 'Submission failed. Please check your entries and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const missing = countMissing(form);
  const canSubmit = missing === 0;

  const hasCpap = form.s4.devices.some((d) => d.device_type === 'CPAP / BiPAP');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full" style={{ background: 'var(--dash-bg)' }}>
      <div className="max-w-4xl mx-auto px-6 py-16">

        {/* ── Page header ───────────────────────────────── */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className="font-headline text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>
              New Camper Application
            </h1>
            <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>
              Camp Burnt Gin — CYSHCN Application
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isSaving && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <RefreshCw className="h-3 w-3 animate-spin" /> Saving…
              </span>
            )}
            {!isSaving && lastSavedAt && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <Save className="h-3 w-3" />
                Saved {lastSavedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
            <Button
              onClick={handleSaveDraft}
              variant="secondary"
              size="sm"
              className="flex items-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              Save Draft
            </Button>
            <button
              type="button"
              onClick={handleClearDraft}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              Clear draft
            </button>
            <Button
              onClick={() => navigate(ROUTES.PARENT_APPLICATIONS)}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>

        {/* ── Progress summary ──────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {10 - missing} of 10 sections complete
            </span>
            <span className="text-sm" style={{ color: missing === 0 ? 'var(--ember-orange)' : 'var(--muted-foreground)' }}>
              {missing === 0 ? 'Ready to submit' : `${missing} section${missing === 1 ? '' : 's'} remaining`}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(5, Math.round(((10 - missing) / 10) * 100))}%`,
                background: 'var(--ember-orange)',
              }}
            />
          </div>
        </div>

        {/* ── Step indicator ────────────────────────────── */}
        <StepIndicator currentStep={currentStep} form={form} onJump={goToStep} />

        {/* ── Section content ─────────────────────────── */}
        <div className="mt-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <div className="mb-8">
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Step {currentStep + 1} of {SECTIONS.length}
                </p>
                <h2 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
                  {SECTIONS[currentStep].label}
                </h2>
              </div>

              {currentStep === 0 && (
                <Section1
                  data={form.s1}
                  sessions={sessions}
                  onChange={(patch) => updateSection('s1', patch)}
                />
              )}
              {currentStep === 1 && (
                <Section2
                  data={form.s2}
                  onChange={(patch) => updateSection('s2', patch)}
                />
              )}
              {currentStep === 2 && (
                <Section3
                  data={form.s3}
                  onChange={(patch) => updateSection('s3', patch)}
                />
              )}
              {currentStep === 3 && (
                <Section4
                  data={form.s4}
                  onChange={(patch) => updateSection('s4', patch)}
                />
              )}
              {currentStep === 4 && (
                <Section5
                  data={form.s5}
                  onChange={(patch) => updateSection('s5', patch)}
                />
              )}
              {currentStep === 5 && (
                <Section6
                  data={form.s6}
                  onChange={(patch) => updateSection('s6', patch)}
                />
              )}
              {currentStep === 6 && (
                <Section7
                  data={form.s7}
                  onChange={(patch) => updateSection('s7', patch)}
                />
              )}
              {currentStep === 7 && (
                <Section8
                  data={form.s8}
                  onChange={(patch) => updateSection('s8', patch)}
                />
              )}
              {currentStep === 8 && (
                <Section9
                  data={form.s9}
                  hasCpap={form.s4.devices.some((d) => d.device_type.includes('CPAP'))}
                  hasSeizures={form.s2.has_seizures === true}
                  hasGtube={form.s5.g_tube === true}
                  onChange={(patch) => updateSection('s9', patch)}
                  onFileSelect={(key, file) => { docFilesRef.current[key] = file; }}
                />
              )}
              {currentStep === 9 && (
                <Section10
                  data={form.s10}
                  onChange={(patch) => updateSection('s10', patch)}
                />
              )}

              {/* Document warnings — shown on Documents step */}
              {currentStep === 8 && (hasCpap || form.s2.has_seizures === true || form.s5.g_tube) && (
                <div
                  className="mt-6 rounded-2xl border p-4 flex flex-col gap-2"
                  style={{ background: 'rgba(251,191,36,0.06)', borderColor: 'rgba(251,191,36,0.25)' }}
                >
                  <p className="text-xs font-semibold flex items-center gap-2" style={{ color: '#92400e' }}>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Additional documents required
                  </p>
                  <ul className="text-xs space-y-1 ml-5" style={{ color: '#92400e', listStyleType: 'disc' }}>
                    {form.s2.has_seizures === true && <li>Seizure Action Plan</li>}
                    {form.s5.g_tube && <li>G-Tube / Feeding Action Plan</li>}
                    {hasCpap && <li>CPAP Waiver</li>}
                  </ul>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Step navigation ──────────────────────────── */}
        <div
          className="flex items-center justify-between mt-16 pt-8 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            type="button"
            onClick={() => goToStep(currentStep - 1)}
            disabled={currentStep === 0}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ color: 'var(--foreground)' }}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {currentStep < SECTIONS.length - 1 ? (
            <Button
              onClick={() => goToStep(currentStep + 1)}
              className="flex items-center gap-2 px-6"
            >
              Save &amp; Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={!canSubmit || isSubmitting}
              className="flex items-center gap-2 px-6"
            >
              Submit Application
            </Button>
          )}
        </div>

        {/* Submit shortcut — visible on non-final steps when all sections complete */}
        {canSubmit && currentStep < SECTIONS.length - 1 && (
          <div className="flex justify-center mt-6">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--ember-orange)' }}
            >
              All sections complete — submit now
            </button>
          </div>
        )}

        <p className="text-xs text-center mt-10 pb-4" style={{ color: 'var(--muted-foreground)' }}>
          All information is encrypted and stored securely in accordance with HIPAA regulations.
        </p>
      </div>
    </div>
  );
}
