/**
 * camp.types.ts
 * Domain types for camps, sessions, campers, applications, and medical data.
 */

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface Session {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  capacity: number;
  enrolled_count: number;
  available_spots: number;
  status: 'open' | 'closed' | 'waitlist' | 'cancelled' | 'upcoming' | 'active' | 'completed';
  age_min?: number;
  age_max?: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Campers
// ---------------------------------------------------------------------------

export interface Camper {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string;
  age: number;
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'other';
  tshirt_size: 'YS' | 'YM' | 'YL' | 'AS' | 'AM' | 'AL' | 'AXL' | 'A2XL';
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface RiskSummary {
  camper_id: number;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  flags: string[];
  last_updated: string;
}

export interface ComplianceStatus {
  camper_id: number;
  medical_record_complete: boolean;
  documents_complete: boolean;
  application_signed: boolean;
  missing_items: string[];
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'waitlisted'
  | 'withdrawn';

// ---------------------------------------------------------------------------
// Official Form Templates
// ---------------------------------------------------------------------------

/** The four official form types served from storage/app/forms. */
export type OfficialFormTypeKey =
  | 'english_application'
  | 'spanish_application'
  | 'medical_form'
  | 'cyshcn_form';

/**
 * Metadata for a downloadable official form template.
 * Returned by GET /api/form-templates (authenticated) and GET /api/forms (public).
 */
export interface OfficialFormTemplate {
  id: OfficialFormTypeKey;
  label: string;
  description: string;
  download_filename: string;
  /** document_type value stored in documents table when this form is uploaded */
  document_type: string;
  requires_medical_signature: boolean;
  available: boolean;
  /** Reserved for future CDN/signed-URL delivery. Not returned by current API. */
  url?: string;
}

/**
 * Canonical per-document compliance metadata computed server-side by
 * ApplicationDocumentResource. Frontends MUST render from these fields
 * directly and must not recompute is_expired / compliance_status locally.
 * That local recomputation is what produced the admin-vs-applicant
 * divergent-truth bug.
 */
export interface CanonicalDocument {
  id: number;
  document_type: string;
  document_type_label: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
  submitted_at: string | null;
  verification_status: string | null;
  expiration_date: string | null;
  exam_date: string | null;
  is_submitted: boolean;
  is_verified: boolean;
  is_expired: boolean;
  is_archived: boolean;
  is_incomplete_metadata: boolean;
  /** Single ground-truth status: 'ok' | 'draft' | 'expired' | 'unverified' | 'incomplete_metadata' | 'archived'. */
  compliance_status: string;
  admin_label: string;
  applicant_label: string;
  visible_to_admin: boolean;
}

/**
 * Compliance issue as exposed in meta.compliance.issues. Each issue has
 * role-appropriate labels — admin frontends render admin_label, applicant
 * frontends render applicant_label.
 */
export interface CanonicalComplianceIssue {
  category: 'missing' | 'expired' | 'unverified' | 'incomplete_metadata';
  document_type: string;
  document_id?: number;
  expiration_date?: string | null;
  exam_date?: string | null;
  admin_label: string;
  applicant_label: string;
}

/**
 * Canonical 11-section projection returned alongside `data` in the GET
 * /api/applications/{id} response (under key `canonical`). Both admin and
 * applicant frontends render from this shape — same sections, same document
 * labels, same compliance issues — with role-appropriate label selection.
 */
/**
 * Per-section validation result from ApplicationCompletenessService.
 * Each section has a boolean is_complete and a list of missing entries
 * with a key, label, and severity. Frontends render ✅ / ⚠️ / ❌ purely
 * from `is_complete` and the severity of the missing entries.
 */
export interface CanonicalValidationSection {
  is_complete: boolean;
  missing: Array<{ key: string; label: string; severity: 'high' | 'medium' | 'low' | string }>;
  errors: Array<{ key: string; label: string; severity: string }>;
}

/**
 * The full validation engine output. Backend is the single source of
 * truth for completeness, validity, and submission-readiness. Every
 * completion-signal pixel in the UI must derive from this block.
 */
export interface CanonicalValidationMeta {
  state: 'INCOMPLETE' | 'BLOCKED' | 'READY' | 'SUBMITTED';
  is_complete: boolean;
  is_valid: boolean;
  sections: Record<string, CanonicalValidationSection>;
  documents: {
    missing: Array<Record<string, unknown>>;
    expired: Array<Record<string, unknown>>;
    incomplete: Array<Record<string, unknown>>;
    unverified: Array<Record<string, unknown>>;
  };
  missing_consents: Array<{ key: string; label: string; severity: string }>;
  blocking_issues: Array<{ section: string; key: string; label: string; severity: string }>;
  warnings: Array<{ section: string; key: string; label: string; severity: string }>;
  completion_percentage: number;
  submission_source: string;
  paper_substitutes_digital: boolean;
}

export interface CanonicalApplicationPayload {
  id: number;
  status: ApplicationStatus;
  submitted_at: string | null;
  signed_at: string | null;
  signature_name: string | null;
  camp_session_id: number | null;
  second_session_id: number | null;
  camp_session: { id: number; name: string; start_date: string | null; end_date: string | null } | null;
  second_session: { id: number; name: string; start_date: string | null; end_date: string | null } | null;
  submission_source: string | null;
  sections: {
    camper: Record<string, unknown>;
    health: Record<string, unknown>;
    behavior: Record<string, unknown> | null;
    equipment: Record<string, unknown>;
    diet: Record<string, unknown> | null;
    personal_care: Record<string, unknown> | null;
    activities: Record<string, unknown>;
    medications: { list: Array<Record<string, unknown>> };
    narratives: Record<string, string | null>;
    documents: { list: CanonicalDocument[] };
    consents: Record<string, unknown>;
  };
  meta: {
    /**
     * Full engine output — state, per-section is_complete, blocking
     * issues, completion percentage. Frontends should render every
     * completion-related signal from this block. See backend
     * ApplicationCompletenessService.
     */
    validation: CanonicalValidationMeta;
    compliance: {
      is_compliant: boolean;
      required_documents: Array<Record<string, unknown>>;
      missing_documents: Array<Record<string, unknown>>;
      expired_documents: Array<Record<string, unknown>>;
      unverified_documents: Array<Record<string, unknown>>;
      incomplete_documents: Array<Record<string, unknown>>;
      issues: CanonicalComplianceIssue[];
    };
  };
}

export interface Application {
  id: number;
  camper_id: number;
  camper?: Camper;
  session_id: number;
  session?: Session;
  status: ApplicationStatus;
  reapplied_from_id?: number | null;
  notes?: string;
  review_notes?: string;
  reviewed_by?: number;
  reviewed_at?: string;
  /** Soft-claim: admin who opened the review. Distinct from reviewed_by (final decision). */
  review_started_by?: number | null;
  /** Timestamp when review was opened. Null until an admin clicks Start Review. */
  review_started_at?: string | null;
  signed_at?: string;
  signature_name?: string;
  submitted_at?: string;
  /**
   * How this application entered the system:
   *   - 'digital'     — parent completed the 10-section web form
   *   - 'paper_self'  — parent uploaded a scanned paper packet themselves
   *   - 'paper_admin' — staff received a physical packet and entered the record
   *
   * Drives UI treatment: paper-intake banners, relaxed completeness gate, and
   * the applicant-facing paper-packet status section. Absent for legacy rows
   * submitted before the column existed; treat `undefined` as `'digital'`.
   */
  submission_source?: 'digital' | 'paper_self' | 'paper_admin' | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Medical Records (CYSHCN sub-resources)
// ---------------------------------------------------------------------------

export interface MedicalRecord {
  id: number;
  camper_id: number;
  is_active?: boolean;
  primary_diagnosis?: string;
  secondary_diagnoses?: string[];
  physician_name?: string;
  physician_phone?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  created_at: string;
  updated_at: string;
}

export interface Allergy {
  id: number;
  camper_id: number;
  allergen: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
  treatment: string;
  epi_pen_required: boolean;
}

export interface Medication {
  id: number;
  camper_id: number;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  prescribing_physician: string;
  purpose: string;
  requires_refrigeration: boolean;
  self_administered: boolean;
}

export interface Diagnosis {
  id: number;
  camper_id: number;
  condition: string;
  icd_code?: string;
  diagnosed_date?: string;
  notes?: string;
}

export interface BehavioralProfile {
  id: number;
  camper_id: number;
  triggers?: string;
  calming_strategies?: string;
  behavioral_supports?: string;
  communication_style?: string;
  sensory_considerations?: string;
}

export interface FeedingPlan {
  id: number;
  camper_id: number;
  diet_type?: string;
  texture_modification?: string;
  fluid_consistency?: string;
  allergies_restrictions?: string;
  feeding_method?: string;
  notes?: string;
}

export interface AssistiveDevice {
  id: number;
  camper_id: number;
  device_type: string;
  description: string;
  required_for_mobility: boolean;
  notes?: string;
}

export interface ActivityPermission {
  id: number;
  camper_id: number;
  activity: string;
  permitted: boolean;
  modifications?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface Document {
  id: number;
  camper_id?: number;
  user_id: number;
  filename: string;
  original_filename: string;
  name?: string;
  mime_type: string;
  size: number;
  document_type?: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Provider Links
// ---------------------------------------------------------------------------

export interface ProviderLink {
  id: number;
  camper_id: number;
  camper?: Camper;
  token: string;
  provider_name?: string;
  provider_email?: string;
  expires_at: string;
  used_at?: string;
  revoked_at?: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface Notification {
  /** UUID string — Laravel database notifications use UUID primary keys. */
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read_at?: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

export interface Conversation {
  id: number;
  subject: string;
  participants: ConversationParticipant[];
  last_message?: Message;
  unread_count: number;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: number;
  name: string;
  email: string;
  roles: string[];
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender?: ConversationParticipant;
  body: string;
  attachments?: Document[];
  read_by: number[];
  created_at: string;
  updated_at: string;
}
