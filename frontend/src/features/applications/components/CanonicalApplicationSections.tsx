/** Maps canonical activity slugs to human-readable labels for display. */
const ACTIVITY_SLUG_LABELS: Record<string, string> = {
  sports_games: 'Sports & Games',
  arts_crafts:  'Arts & Crafts',
  nature:       'Nature Activities',
  fine_arts:    'Fine Arts',
  swimming:     'Swimming',
  boating:      'Boating',
  camp_out:     'Camp Out',
};
function activityLabel(name: string): string {
  return ACTIVITY_SLUG_LABELS[name] ?? name;
}

/**
 * CanonicalApplicationSections — single source of truth for rendering a
 * submitted application in the portal UIs.
 *
 * Both the applicant detail page and the admin review page render their
 * read-only section blocks from this component. Because the two portals
 * consume the same React component against the same canonical payload,
 * they cannot show divergent truth for the same row — which is the class
 * of bug documented in the "Expired vs Uploaded" screenshots.
 *
 * All 11 sections are ALWAYS structurally present (even if empty), so
 * applicants and admins see a consistent, complete picture of the
 * submitted application.
 */
import { format } from 'date-fns';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle,
  FileText,
  Heart,
  Pill,
  User as UserIcon,
  ShieldCheck,
  Accessibility,
  Utensils,
  Activity as ActivityIcon,
  Brain,
  Home,
  MessageSquare,
  Download,
  Eye,
  XCircle,
  Pencil,
} from 'lucide-react';

import type {
  CanonicalApplicationPayload,
  CanonicalDocument,
} from '@/shared/types';

/** Viewer role — drives which of the two labels on each doc/issue we render. */
export type CanonicalViewerRole = 'admin' | 'applicant';

/**
 * Stable identifiers for the 11 canonical sections. Used as the argument to
 * `onEditSection` so the page can route the viewer to the edit flow for a
 * specific section (e.g. `/admin/applications/:id/edit#section-narratives`).
 *
 * `consents` is not editable (consents are signed by the parent at submit
 * time), but it is included so the enumerated key set stays exhaustive.
 */
export type CanonicalSectionKey =
  | 'camper'
  | 'health'
  | 'behavior'
  | 'equipment'
  | 'diet'
  | 'personal_care'
  | 'activities'
  | 'medications'
  | 'narratives'
  | 'documents'
  | 'consents';

interface Props {
  canonical: CanonicalApplicationPayload;
  role: CanonicalViewerRole;
  /** Called when the viewer clicks "Preview" on a document row. Optional. */
  onPreviewDocument?: (doc: CanonicalDocument) => void;
  /** Called when the viewer clicks "Download" on a document row. Optional. */
  onDownloadDocument?: (doc: CanonicalDocument) => void;
  /** Optional per-row admin actions (Verify/Reject). Ignored when role=applicant. */
  adminDocumentActions?: {
    onVerify: (doc: CanonicalDocument) => void;
    onReject: (doc: CanonicalDocument) => void;
    disabled?: boolean;
  };
  /**
   * When true, every editable section renders a pencil "Edit" button that
   * invokes `onEditSection(key)`. The canonical component does not own edit
   * state itself — it hands off to the page so the page can route to the
   * full-form editor (e.g. AdminApplicationEditPage) scrolled to the right
   * section. Consents remain read-only regardless of this flag.
   */
  editable?: boolean;
  /** Called when the viewer clicks the edit button on a section. */
  onEditSection?: (sectionKey: CanonicalSectionKey) => void;
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

/**
 * Shape of the backend validation status for a single section. Derived
 * from `canonical.meta.validation.sections[key]`. The component renders a
 * ✅ / ⚠️ / ❌ pill from this — never from a local judgment.
 */
type SectionStatus = {
  isComplete: boolean;
  /** True when missing list contains at least one high-severity entry. */
  isBlocking: boolean;
};

function SectionStatusPill({ status }: { status: SectionStatus | undefined }) {
  if (!status) return null;
  const { isComplete, isBlocking } = status;
  const [label, bg, color, icon] = isComplete
    ? ['Complete', 'rgba(22,163,74,0.10)', '#15803d', <CheckCircle key="c" className="h-3 w-3" />]
    : isBlocking
      ? ['Required', 'rgba(220,38,38,0.10)', '#dc2626', <XCircle key="x" className="h-3 w-3" />]
      : ['Needs review', 'rgba(234,88,12,0.10)', '#c2410c', <AlertTriangle key="a" className="h-3 w-3" />];
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
      style={{ background: bg, color }}
      aria-label={`Section status: ${label}`}
    >
      {icon}
      {label}
    </span>
  );
}

function SectionCard({
  title,
  icon,
  children,
  onEdit,
  anchorId,
  status,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  /** Shows a pencil "Edit" button in the header when provided. */
  onEdit?: () => void;
  /** DOM id on the outer section — enables URL-hash deep linking. */
  anchorId?: string;
  /** Backend-computed section status for the header pill. Undefined = hide pill. */
  status?: SectionStatus;
}) {
  return (
    <section
      id={anchorId}
      className="rounded-2xl border"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <header
        className="flex items-center gap-2 px-5 py-3 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--dash-bg)' }}
      >
        <span style={{ color: 'var(--muted-foreground)' }}>{icon}</span>
        <h3 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
          {title}
        </h3>
        <SectionStatusPill status={status} />
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            <Pencil style={{ width: 11, height: 11 }} />
            Edit
          </button>
        ) : null}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const empty = value === null || value === undefined || value === '' || value === false;
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </p>
      <p
        className="text-sm mt-0.5 break-words"
        style={{ color: empty ? 'var(--muted-foreground)' : 'var(--foreground)' }}
      >
        {empty ? '—' : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
      </p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-sm italic" style={{ color: 'var(--muted-foreground)' }}>
      {text}
    </p>
  );
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return String(value);
  return format(d, 'MMM d, yyyy');
}

function fmtDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return String(value);
  return format(d, 'MMM d, yyyy h:mma');
}

function titleCase(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Top-level compliance summary ────────────────────────────────────────────

/**
 * Renders the top-of-page validation summary. Reads from the server-side
 * engine (`meta.validation`) — NOT from a local is-anything-missing check.
 * Shows the engine state (READY / BLOCKED / INCOMPLETE / SUBMITTED-with-
 * drift) and the flat list of blocking issues + warnings. If anyone is
 * tempted to write a local "all on file" green check, don't — this
 * component is the ONLY place that renders the summary, and it renders
 * only what the backend says.
 */
function ComplianceSummary({
  validation,
  compliance,
  role,
}: {
  validation: CanonicalApplicationPayload['meta']['validation'] | undefined;
  compliance: CanonicalApplicationPayload['meta']['compliance'];
  role: CanonicalViewerRole;
}) {
  // Payloads without validation fall back to the old document-only block.
  if (!validation) {
    const issues = compliance.issues ?? [];
    if (issues.length === 0) {
      return (
        <div
          className="flex items-center gap-2 rounded-xl border px-4 py-3"
          style={{ background: 'rgba(22,163,74,0.06)', borderColor: 'rgba(22,163,74,0.25)' }}
        >
          <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#16a34a' }} />
          <p className="text-sm" style={{ color: '#15803d' }}>
            No compliance issues recorded.
          </p>
        </div>
      );
    }
    return (
      <div
        className="rounded-xl border p-4"
        style={{ background: 'rgba(220,38,38,0.04)', borderColor: 'rgba(220,38,38,0.2)' }}
      >
        <ul className="flex flex-col gap-2">
          {issues.map((issue, idx) => (
            <li key={`${issue.document_type}-${idx}`} className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#dc2626' }} />
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                {role === 'admin' ? issue.admin_label : issue.applicant_label}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const isGreen = validation.state === 'READY'
    || (validation.state === 'SUBMITTED' && validation.is_complete && validation.is_valid);

  if (isGreen) {
    return (
      <div
        className="flex items-center gap-2 rounded-xl border px-4 py-3"
        style={{ background: 'rgba(22,163,74,0.06)', borderColor: 'rgba(22,163,74,0.25)' }}
      >
        <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#16a34a' }} />
        <p className="text-sm" style={{ color: '#15803d' }}>
          {validation.state === 'SUBMITTED'
            ? 'Application submitted — no outstanding validation issues.'
            : 'Ready to submit — every required section is complete and valid.'}
        </p>
      </div>
    );
  }

  const [banner, border, titleColor] = validation.state === 'BLOCKED'
    ? ['rgba(220,38,38,0.06)', 'rgba(220,38,38,0.25)', '#b91c1c']
    : ['rgba(234,88,12,0.06)', 'rgba(234,88,12,0.25)', '#c2410c'];

  const title = (() => {
    if (validation.state === 'BLOCKED') {
      return role === 'admin'
        ? 'Compliance issues — approval blocked'
        : 'Action needed — these items are blocking submission';
    }
    if (validation.state === 'SUBMITTED') {
      return role === 'admin'
        ? 'Submitted — post-submit drift detected'
        : 'Submitted — but we noticed an issue that needs attention';
    }
    return role === 'admin'
      ? 'Not yet complete'
      : `${100 - validation.completion_percentage}% left to go`;
  })();

  const issues = [...validation.blocking_issues, ...validation.warnings];

  return (
    <div className="rounded-xl border p-4" style={{ background: banner, borderColor: border }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold" style={{ color: titleColor }}>
          {title}
        </h4>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--muted-foreground)' }}
        >
          {validation.completion_percentage}% complete
        </span>
      </div>
      {issues.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {issues.map((issue) => {
            // Scroll the matching section card into view. The section keys
            // align 1:1 with the anchorIds set on each SectionCard below.
            const jumpTo = () => {
              const target = document.getElementById(`section-${issue.section}`);
              if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            };
            return (
              <li key={`${issue.section}-${issue.key}`} className="flex items-start gap-2">
                {issue.severity === 'high' ? (
                  <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#dc2626' }} />
                ) : (
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: '#ea580c' }} />
                )}
                <button
                  type="button"
                  onClick={jumpTo}
                  className="text-left text-sm hover:underline"
                  style={{ color: 'var(--foreground)' }}
                >
                  <span
                    className="text-xs uppercase tracking-wide mr-2"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {issue.section.replace('_', ' ')}
                  </span>
                  {issue.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

// ─── Section 1: Camper (general info) ────────────────────────────────────────

function SectionCamper({
  camper,
  onEdit,
  anchorId,
  status,
}: {
  camper: Record<string, unknown>;
  onEdit?: () => void;
  anchorId?: string;
  status?: SectionStatus;
}) {
  return (
    <SectionCard
      title="Camper Information"
      icon={<UserIcon className="h-4 w-4" />}
      onEdit={onEdit}
      anchorId={anchorId}
      status={status}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Field label="Full name" value={camper.full_name as string | null} />
        <Field label="Preferred name" value={camper.preferred_name as string | null} />
        <Field label="Date of birth" value={fmtDate(camper.date_of_birth)} />
        <Field label="Gender" value={titleCase(camper.gender)} />
        <Field label="T-shirt size" value={camper.tshirt_size as string | null} />
        <Field label="County" value={camper.county as string | null} />
        <Field
          label="Interpreter needed"
          value={(camper.needs_interpreter as boolean) ? 'Yes' : 'No'}
        />
        <Field label="Preferred language" value={camper.preferred_language as string | null} />
        <Field label="Supervision level" value={titleCase(camper.supervision_level)} />
      </div>

      {Boolean(camper.applicant_address || camper.applicant_city) && (
        <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Applicant mailing address
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Street" value={camper.applicant_address as string | null} />
            <Field label="City" value={camper.applicant_city as string | null} />
            <Field label="State" value={camper.applicant_state as string | null} />
            <Field label="ZIP" value={camper.applicant_zip as string | null} />
          </div>
        </div>
      )}

      {/* Emergency contacts sub-block — always lives under Camper in the canonical shape. */}
      <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--muted-foreground)' }}>
          Emergency contacts
        </p>
        {(() => {
          const contacts = (camper.emergency_contacts ?? []) as Array<Record<string, unknown>>;
          if (contacts.length === 0) {
            return <Empty text="No emergency contacts on file." />;
          }
          return (
            <div className="flex flex-col gap-3">
              {contacts.map((c) => (
                <div
                  key={c.id as number}
                  className="rounded-lg border p-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {(c.is_guardian as boolean) && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(139,92,246,0.10)', color: '#6d28d9' }}
                      >
                        Guardian
                      </span>
                    )}
                    {(c.is_primary as boolean) && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(22,163,74,0.10)', color: '#15803d' }}
                      >
                        Primary
                      </span>
                    )}
                    {(c.is_authorized_pickup as boolean) && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(234,88,12,0.10)', color: '#c2410c' }}
                      >
                        Authorized pickup
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <Field label="Name" value={c.name as string | null} />
                    <Field label="Relationship" value={c.relationship as string | null} />
                    <Field label="Primary phone" value={c.phone_primary as string | null} />
                    <Field label="Secondary phone" value={c.phone_secondary as string | null} />
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </SectionCard>
  );
}

// ─── Section 2: Health ───────────────────────────────────────────────────────

function SectionHealth({
  health,
  onEdit,
  anchorId,
  status,
}: {
  health: Record<string, unknown>;
  onEdit?: () => void;
  anchorId?: string;
  status?: SectionStatus;
}) {
  const mr = (health.medical_record ?? null) as Record<string, unknown> | null;
  const diagnoses = (health.diagnoses ?? []) as Array<Record<string, unknown>>;
  const allergies = (health.allergies ?? []) as Array<Record<string, unknown>>;

  return (
    <SectionCard
      title="Health & Medical"
      icon={<Heart className="h-4 w-4" />}
      onEdit={onEdit}
      anchorId={anchorId}
      status={status}
    >
      {mr === null ? (
        <Empty text="No medical record on file." />
      ) : (
        <>
          {/* Physician + Insurance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Physician name" value={mr.physician_name as string | null} />
            <Field label="Physician phone" value={mr.physician_phone as string | null} />
            <Field label="Insurance provider" value={mr.insurance_provider as string | null} />
            <Field label="Insurance policy #" value={mr.insurance_policy_number as string | null} />
            <Field label="Insurance group" value={mr.insurance_group as string | null} />
            <Field label="Medicaid #" value={mr.medicaid_number as string | null} />
          </div>

          {/* Flags */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Has seizures" value={mr.has_seizures as boolean | undefined} />
            <Field
              label="Immunizations current"
              value={mr.immunizations_current as boolean | undefined}
            />
            <Field label="Last tetanus" value={fmtDate(mr.tetanus_date)} />
          </div>

          {/* Notes */}
          {(mr.special_needs || mr.dietary_restrictions || mr.notes || mr.mobility_notes) && (
            <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
              {mr.special_needs ? (
                <Field label="Special needs" value={mr.special_needs as string | null} />
              ) : null}
              {mr.dietary_restrictions ? (
                <Field
                  label="Dietary restrictions"
                  value={mr.dietary_restrictions as string | null}
                />
              ) : null}
              {mr.notes ? <Field label="Notes" value={mr.notes as string | null} /> : null}
              {mr.mobility_notes ? (
                <Field label="Mobility notes" value={mr.mobility_notes as string | null} />
              ) : null}
            </div>
          )}
        </>
      )}

      {/* Diagnoses */}
      <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
          Diagnoses
        </p>
        {diagnoses.length === 0 ? (
          <Empty text="None recorded." />
        ) : (
          <ul className="flex flex-col gap-2">
            {diagnoses.map((d) => (
              <li
                key={d.id as number}
                className="rounded-lg border p-3"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {(d.name as string) || '—'}
                  </p>
                  {d.severity_level ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(251,146,60,0.12)', color: '#c2410c' }}
                    >
                      {titleCase(d.severity_level)}
                    </span>
                  ) : null}
                </div>
                {d.description ? (
                  <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    {d.description as string}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Allergies */}
      <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
          Allergies
        </p>
        {allergies.length === 0 ? (
          <Empty text="None recorded." />
        ) : (
          <ul className="flex flex-col gap-2">
            {allergies.map((a) => (
              <li
                key={a.id as number}
                className="rounded-lg border p-3"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {(a.allergen as string) || '—'}
                  </p>
                  {a.severity ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background:
                          a.severity === 'life_threatening'
                            ? 'rgba(220,38,38,0.12)'
                            : a.severity === 'severe'
                              ? 'rgba(234,88,12,0.12)'
                              : 'rgba(251,191,36,0.12)',
                        color:
                          a.severity === 'life_threatening'
                            ? '#dc2626'
                            : a.severity === 'severe'
                              ? '#c2410c'
                              : '#a16207',
                      }}
                    >
                      {titleCase(a.severity)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Field label="Reaction" value={a.reaction as string | null} />
                  <Field label="Treatment" value={a.treatment as string | null} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Section 3: Behavior ─────────────────────────────────────────────────────

function SectionBehavior({
  behavior,
  onEdit,
  anchorId,
  status,
}: {
  behavior: Record<string, unknown> | null;
  onEdit?: () => void;
  anchorId?: string;
  status?: SectionStatus;
}) {
  if (behavior === null) {
    return (
      <SectionCard
        title="Behavioral Profile"
        icon={<Brain className="h-4 w-4" />}
        onEdit={onEdit}
        anchorId={anchorId}
        status={status}
      >
        <Empty text="No behavioral profile on file." />
      </SectionCard>
    );
  }

  const flagKeys = [
    'aggression',
    'self_abuse',
    'wandering_risk',
    'one_to_one_supervision',
    'developmental_delay',
    'sexual_behaviors',
    'interpersonal_behavior',
    'social_emotional',
    'functional_reading',
    'functional_writing',
    'independent_mobility',
    'verbal_communication',
    'social_skills',
    'behavior_plan',
  ];
  const textKeys = ['communication_methods', 'notes', 'functioning_age_level'];

  return (
    <SectionCard
      title="Behavioral Profile"
      icon={<Brain className="h-4 w-4" />}
      onEdit={onEdit}
      anchorId={anchorId}
      status={status}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {flagKeys
          .filter((k) => behavior[k] !== undefined)
          .map((k) => (
            <Field
              key={k}
              label={titleCase(k) ?? k}
              value={behavior[k] as boolean | undefined}
            />
          ))}
      </div>
      {textKeys.some((k) => behavior[k]) && (
        <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
          {textKeys.map((k) =>
            behavior[k] ? (
              <Field key={k} label={titleCase(k) ?? k} value={behavior[k] as string} />
            ) : null,
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 4: Equipment ───────────────────────────────────────────────────

function SectionEquipment({
  equipment,
  onEdit,
  anchorId,
  status,
}: {
  equipment: Record<string, unknown>;
  onEdit?: () => void;
  anchorId?: string;
  status?: SectionStatus;
}) {
  const devices = (equipment.assistive_devices ?? []) as Array<Record<string, unknown>>;
  return (
    <SectionCard
      title="Equipment & Assistive Devices"
      icon={<Accessibility className="h-4 w-4" />}
      onEdit={onEdit}
      anchorId={anchorId}
      status={status}
    >
      {devices.length === 0 ? (
        <Empty text="No assistive devices recorded." />
      ) : (
        <ul className="flex flex-col gap-2">
          {devices.map((d) => (
            <li
              key={d.id as number}
              className="rounded-lg border p-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {(d.device_type as string) || '—'}
              </p>
              <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field
                  label="Requires transfer assistance"
                  value={d.requires_transfer_assistance as boolean | undefined}
                />
                <Field label="Notes" value={d.notes as string | null} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ─── Section 5: Diet ─────────────────────────────────────────────────────────

function SectionDiet({
  diet,
  onEdit,
  anchorId,
  status,
}: {
  diet: Record<string, unknown> | null;
  onEdit?: () => void;
  anchorId?: string;
  status?: SectionStatus;
}) {
  if (diet === null) {
    return (
      <SectionCard
        title="Diet & Feeding"
        icon={<Utensils className="h-4 w-4" />}
        onEdit={onEdit}
        anchorId={anchorId}
        status={status}
      >
        <Empty text="No feeding plan on file." />
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title="Diet & Feeding"
      icon={<Utensils className="h-4 w-4" />}
      onEdit={onEdit}
      anchorId={anchorId}
      status={status}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Field label="Special diet" value={diet.special_diet as boolean | undefined} />
        <Field label="Diet description" value={diet.diet_description as string | null} />
        <Field label="G-tube" value={diet.g_tube as boolean | undefined} />
        <Field label="Formula" value={diet.formula as string | null} />
        <Field label="Amount per feeding" value={diet.amount_per_feeding as string | null} />
        <Field label="Feedings per day" value={diet.feedings_per_day as string | null} />
        <Field label="Feeding times" value={diet.feeding_times as string | null} />
        <Field label="Bolus only" value={diet.bolus_only as boolean | undefined} />
        <Field label="Texture modified" value={diet.texture_modified as boolean | undefined} />
        <Field label="Texture level" value={diet.texture_level as string | null} />
        <Field label="Fluid restriction" value={diet.fluid_restriction as boolean | undefined} />
        <Field label="Fluid details" value={diet.fluid_details as string | null} />
      </div>
      {diet.notes ? (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <Field label="Notes" value={diet.notes as string | null} />
        </div>
      ) : null}
    </SectionCard>
  );
}

// ─── Section 6: Personal Care ───────────────────────────────────────────────

function SectionPersonalCare({
  personalCare,
  onEdit,
  anchorId,
  status,
}: {
  personalCare: Record<string, unknown> | null;
  onEdit?: () => void;
  anchorId?: string;
  status?: SectionStatus;
}) {
  if (personalCare === null) {
    return (
      <SectionCard
        title="Personal Care"
        icon={<Home className="h-4 w-4" />}
        onEdit={onEdit}
        anchorId={anchorId}
        status={status}
      >
        <Empty text="No personal care plan on file." />
      </SectionCard>
    );
  }
  const sections: Array<{ group: string; pairs: Array<[string, string]> }> = [
    {
      group: 'Bathing',
      pairs: [
        ['Level', 'bathing_level'],
        ['Notes', 'bathing_notes'],
      ],
    },
    {
      group: 'Toileting (day)',
      pairs: [
        ['Level', 'toileting_level'],
        ['Notes', 'toileting_notes'],
      ],
    },
    {
      group: 'Toileting (night)',
      pairs: [
        ['Level', 'nighttime_toileting'],
        ['Notes', 'nighttime_notes'],
      ],
    },
    {
      group: 'Dressing',
      pairs: [
        ['Level', 'dressing_level'],
        ['Notes', 'dressing_notes'],
      ],
    },
    {
      group: 'Oral hygiene',
      pairs: [
        ['Level', 'oral_hygiene_level'],
        ['Notes', 'oral_hygiene_notes'],
      ],
    },
    {
      group: 'Positioning / transfers',
      pairs: [['Notes', 'positioning_notes']],
    },
    {
      group: 'Sleep routine',
      pairs: [['Notes', 'sleep_notes']],
    },
  ];

  return (
    <SectionCard
      title="Personal Care"
      icon={<Home className="h-4 w-4" />}
      onEdit={onEdit}
      anchorId={anchorId}
      status={status}
    >
      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
        {sections.map((s) => (
          <div key={s.group} className="py-3 first:pt-0 last:pb-0">
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
              {s.group}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {s.pairs.map(([label, key]) => (
                <Field
                  key={key}
                  label={label}
                  value={
                    typeof personalCare[key] === 'string'
                      ? (personalCare[key] as string)
                      : titleCase(personalCare[key])
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ─── Section 7: Activities ──────────────────────────────────────────────────

function SectionActivities({
  activities,
  onEdit,
  anchorId,
  status,
}: {
  activities: Record<string, unknown>;
  onEdit?: () => void;
  anchorId?: string;
  status?: SectionStatus;
}) {
  const permissions = (activities.permissions ?? []) as Array<Record<string, unknown>>;
  return (
    <SectionCard
      title="Activities & Permissions"
      icon={<ActivityIcon className="h-4 w-4" />}
      onEdit={onEdit}
      anchorId={anchorId}
      status={status}
    >
      {permissions.length === 0 ? (
        <Empty text="No activity permissions recorded." />
      ) : (
        <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
          {permissions.map((p) => (
            <div
              key={p.id as number}
              className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {activityLabel((p.activity_name as string) || '') || '—'}
                </p>
                {p.restriction_notes ? (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {p.restriction_notes as string}
                  </p>
                ) : null}
              </div>
              <span
                className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full"
                style={{
                  background:
                    p.permission_level === 'yes'
                      ? 'rgba(22,163,74,0.10)'
                      : p.permission_level === 'no'
                        ? 'rgba(220,38,38,0.10)'
                        : 'rgba(251,146,60,0.10)',
                  color:
                    p.permission_level === 'yes'
                      ? '#15803d'
                      : p.permission_level === 'no'
                        ? '#dc2626'
                        : '#c2410c',
                }}
              >
                {titleCase(p.permission_level) ?? '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 8: Medications ─────────────────────────────────────────────────

function SectionMedications({
  medications,
  onEdit,
  anchorId,
  status,
}: {
  medications: { list: Array<Record<string, unknown>> };
  onEdit?: () => void;
  anchorId?: string;
  status?: SectionStatus;
}) {
  const list = medications.list ?? [];
  return (
    <SectionCard
      title="Medications"
      icon={<Pill className="h-4 w-4" />}
      onEdit={onEdit}
      anchorId={anchorId}
      status={status}
    >
      {list.length === 0 ? (
        <Empty text="No medications recorded." />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((m) => (
            <li
              key={m.id as number}
              className="rounded-lg border p-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {(m.name as string) || '—'}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Field label="Dosage" value={m.dosage as string | null} />
                <Field label="Frequency" value={m.frequency as string | null} />
                <Field label="Purpose" value={m.purpose as string | null} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ─── Section 9: Narratives ──────────────────────────────────────────────────

function SectionNarratives({
  narratives,
  onEdit,
  anchorId,
  status,
}: {
  narratives: Record<string, string | null>;
  onEdit?: () => void;
  anchorId?: string;
  status?: SectionStatus;
}) {
  const entries: Array<[string, string]> = [
    ['Rustic environment', 'rustic_environment'],
    ['Staff suggestions', 'staff_suggestions'],
    ['Participation concerns', 'participation_concerns'],
    ['Camp benefit', 'camp_benefit'],
    ['Heat tolerance', 'heat_tolerance'],
    ['Transportation', 'transportation'],
    ['Additional info', 'additional_info'],
    ['Emergency protocols', 'emergency_protocols'],
  ];
  const hasAny = entries.some(([, k]) => narratives[k]);
  return (
    <SectionCard
      title="Narratives"
      icon={<MessageSquare className="h-4 w-4" />}
      onEdit={onEdit}
      anchorId={anchorId}
      status={status}
    >
      {!hasAny ? (
        <Empty text="No narrative responses recorded." />
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map(([label, key]) => (
            <div key={key}>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
                {label}
              </p>
              <p
                className="text-sm whitespace-pre-wrap"
                style={{
                  color: narratives[key]
                    ? 'var(--foreground)'
                    : 'var(--muted-foreground)',
                }}
              >
                {narratives[key] || '—'}
              </p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 10: Documents ──────────────────────────────────────────────────

function SectionDocuments({
  documents,
  role,
  onPreview,
  onDownload,
  adminActions,
  onEdit,
  anchorId,
  status,
}: {
  documents: { list: CanonicalDocument[] };
  role: CanonicalViewerRole;
  onPreview?: (doc: CanonicalDocument) => void;
  onDownload?: (doc: CanonicalDocument) => void;
  adminActions?: Props['adminDocumentActions'];
  onEdit?: () => void;
  anchorId?: string;
  status?: SectionStatus;
}) {
  const list = documents.list ?? [];
  return (
    <SectionCard
      title="Documents"
      icon={<FileText className="h-4 w-4" />}
      onEdit={onEdit}
      anchorId={anchorId}
      status={status}
    >
      {list.length === 0 ? (
        <Empty text="No documents uploaded." />
      ) : (
        <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
          {list.map((d) => {
            const label = role === 'admin' ? d.admin_label : d.applicant_label;
            const statusColor = (() => {
              switch (d.compliance_status) {
                case 'ok':
                  return { bg: 'rgba(22,163,74,0.10)', color: '#15803d' };
                case 'draft':
                  return { bg: 'rgba(234,88,12,0.10)', color: '#c2410c' };
                case 'expired':
                  return { bg: 'rgba(220,38,38,0.10)', color: '#dc2626' };
                case 'unverified':
                  return { bg: 'rgba(250,204,21,0.12)', color: '#a16207' };
                case 'incomplete_metadata':
                  return { bg: 'rgba(251,146,60,0.12)', color: '#c2410c' };
                case 'archived':
                  return { bg: 'rgba(107,114,128,0.10)', color: '#6b7280' };
                default:
                  return { bg: 'var(--border)', color: 'var(--muted-foreground)' };
              }
            })();

            return (
              <div
                key={d.id}
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {d.document_type_label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {d.original_filename ?? '—'}
                    {d.exam_date ? ` · Exam date: ${fmtDate(d.exam_date)}` : ''}
                    {d.expiration_date
                      ? ` · Expires: ${fmtDate(d.expiration_date)}`
                      : ''}
                    {d.submitted_at
                      ? ` · Submitted: ${fmtDateTime(d.submitted_at)}`
                      : ''}
                  </p>
                  <p
                    className="text-xs mt-1 inline-flex items-center px-2 py-0.5 rounded-full"
                    style={{ background: statusColor.bg, color: statusColor.color }}
                  >
                    {label}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {onPreview ? (
                    <button
                      type="button"
                      onClick={() => onPreview(d)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border"
                      style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                  ) : null}
                  {onDownload ? (
                    <button
                      type="button"
                      onClick={() => onDownload(d)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border"
                      style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                  ) : null}
                  {role === 'admin' && adminActions && d.compliance_status === 'unverified' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => adminActions.onVerify(d)}
                        disabled={adminActions.disabled}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                        style={{ background: 'rgba(22,163,74,0.10)', color: '#15803d' }}
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        onClick={() => adminActions.onReject(d)}
                        disabled={adminActions.disabled}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                        style={{ background: 'rgba(220,38,38,0.10)', color: '#dc2626' }}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 11: Consents ──────────────────────────────────────────────────

function SectionConsents({
  consents,
  anchorId,
  status,
}: {
  consents: Record<string, unknown>;
  anchorId?: string;
  status?: SectionStatus;
}) {
  const list = (consents.consents ?? []) as Array<Record<string, unknown>>;
  return (
    <SectionCard
      title="Consents & Signatures"
      icon={<ShieldCheck className="h-4 w-4" />}
      anchorId={anchorId}
      status={status}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Signed at" value={fmtDateTime(consents.signed_at)} />
        <Field label="Signature name" value={consents.signature_name as string | null} />
      </div>

      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--muted-foreground)' }}>
          Individual consents
        </p>
        {list.length === 0 ? (
          <Empty text="No individual consents recorded." />
        ) : (
          <ul className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {list.map((c) => (
              <li
                key={c.id as number}
                className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#16a34a' }} />
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                    {titleCase(c.consent_type) ?? '—'}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  <p>{(c.guardian_name as string) || '—'}</p>
                  <p>{fmtDateTime(c.signed_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────

export function CanonicalApplicationSections({
  canonical,
  role,
  onPreviewDocument,
  onDownloadDocument,
  adminDocumentActions,
  editable = false,
  onEditSection,
}: Props) {
  const s = canonical.sections;
  const validation = canonical.meta?.validation;

  // Helper: only return an onEdit callback for a section when the viewer can
  // edit AND the page has supplied a handler. Otherwise the pencil button is
  // not rendered and the section stays pure read-only.
  const edit = (key: CanonicalSectionKey): (() => void) | undefined =>
    editable && onEditSection ? () => onEditSection(key) : undefined;

  /**
   * Derives the per-section header pill from the backend engine output.
   * Returns `undefined` when the payload predates `meta.validation` (keeps
   * old responses rendering without a pill rather than falsely green).
   */
  const statusFor = (key: CanonicalSectionKey): SectionStatus | undefined => {
    if (!validation?.sections) return undefined;
    const section = validation.sections[key];
    if (!section) return undefined;
    const isBlocking = section.missing.some((m) => (m.severity ?? 'high') === 'high');
    return { isComplete: section.is_complete, isBlocking };
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Top-of-page summary. Reads from the validation engine — the only
          authoritative "is this complete" signal in the UI. */}
      <ComplianceSummary
        validation={validation}
        compliance={canonical.meta.compliance}
        role={role}
      />

      {/* Camp session header — lives outside the 11 sections but is always
          relevant context for both portals. */}
      {canonical.camp_session ? (
        <SectionCard title="Camp Session" icon={<Calendar className="h-4 w-4" />}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Session" value={canonical.camp_session.name} />
            <Field label="Start" value={fmtDate(canonical.camp_session.start_date)} />
            <Field label="End" value={fmtDate(canonical.camp_session.end_date)} />
          </div>
        </SectionCard>
      ) : null}

      {/* The 11 canonical sections, in a consistent order. The `anchorId`
          attribute lets callers deep-link to a section via URL hash. The
          `status` prop shows a ✅/⚠️/❌ pill driven by the backend engine. */}
      <SectionCamper camper={s.camper} onEdit={edit('camper')} anchorId="section-camper" status={statusFor('camper')} />
      <SectionHealth health={s.health} onEdit={edit('health')} anchorId="section-health" status={statusFor('health')} />
      <SectionBehavior behavior={s.behavior} onEdit={edit('behavior')} anchorId="section-behavior" status={statusFor('behavior')} />
      <SectionEquipment equipment={s.equipment} onEdit={edit('equipment')} anchorId="section-equipment" status={statusFor('equipment')} />
      <SectionDiet diet={s.diet} onEdit={edit('diet')} anchorId="section-diet" status={statusFor('diet')} />
      <SectionPersonalCare
        personalCare={s.personal_care}
        onEdit={edit('personal_care')}
        anchorId="section-personal_care"
        status={statusFor('personal_care')}
      />
      <SectionActivities activities={s.activities} onEdit={edit('activities')} anchorId="section-activities" status={statusFor('activities')} />
      <SectionMedications medications={s.medications} onEdit={edit('medications')} anchorId="section-medications" status={statusFor('medications')} />
      <SectionNarratives narratives={s.narratives} onEdit={edit('narratives')} anchorId="section-narratives" status={statusFor('narratives')} />
      <SectionDocuments
        documents={s.documents as { list: CanonicalDocument[] }}
        role={role}
        onPreview={onPreviewDocument}
        onDownload={onDownloadDocument}
        adminActions={adminDocumentActions}
        onEdit={edit('documents')}
        anchorId="section-documents"
        status={statusFor('documents')}
      />
      {/* Consents are signed by the parent at submit time and are not edited
          afterward — no pencil button even for admins. */}
      <SectionConsents consents={s.consents} anchorId="section-consents" status={statusFor('consents')} />
    </div>
  );
}
