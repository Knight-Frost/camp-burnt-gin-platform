/**
 * admin.types.ts
 * Type definitions scoped to the admin feature.
 */

export interface ApplicationReviewPayload {
  status: 'approved' | 'rejected' | 'under_review' | 'waitlisted';
  notes?: string;
}

export interface Camp {
  id: number;
  name: string;
  location: string;
  description?: string;
  sessions?: CampSession[];
  created_at?: string;
  updated_at?: string;
}

export interface CampSession {
  id: number;
  camp_id: number;
  camp?: Camp;
  name: string;
  start_date: string;
  end_date: string;
  capacity: number;
  enrolled_count?: number;
  remaining_capacity?: number;
  is_active?: boolean;
  /** Date-derived status computed by the backend: active | upcoming | completed */
  status?: 'active' | 'upcoming' | 'completed';
  registration_opens_at?: string;
  registration_closes_at?: string;
  min_age?: number;
  max_age?: number;
  created_at?: string;
}

export interface Application {
  id: number;
  camper_id: number;
  camp_session_id: number;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'cancelled' | 'waitlisted' | 'withdrawn' | 'draft';
  notes?: string;
  submitted_at?: string;
  reviewed_at?: string;
  reviewer_id?: number;
  signed_at?: string;
  signature_name?: string;
  created_at: string;
  updated_at?: string;
  camper?: Camper;
  session?: CampSession;
  documents?: Document[];
}

export interface Camper {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string;
  gender?: string;
  tshirt_size?: string;
  created_at: string;
  user?: { id: number; name: string; email: string };
  medical_record?: MedicalRecord;
  emergency_contacts?: EmergencyContact[];
  behavioral_profile?: BehavioralProfile;
  feeding_plan?: FeedingPlan;
  assistive_devices?: AssistiveDevice[];
  activity_permissions?: ActivityPermission[];
  applications?: Application[];
}

export interface MedicalRecord {
  id: number;
  camper_id: number;
  primary_diagnosis?: string;
  physician_name?: string;
  physician_phone?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  special_needs?: string;
  dietary_restrictions?: string;
  notes?: string;
  has_seizures?: boolean;
  last_seizure_date?: string;
  seizure_description?: string;
  has_neurostimulator?: boolean;
  allergies?: Allergy[];
  medications?: Medication[];
  diagnoses?: Diagnosis[];
}

export interface Allergy {
  id: number;
  name: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  reaction?: string;
  treatment?: string;
}

export interface Medication {
  id: number;
  name: string;
  dosage: string;
  frequency: string;
  route?: string;
  purpose?: string;
  notes?: string;
}

export interface Diagnosis {
  id: number;
  name: string;
  icd_code?: string;
  notes?: string;
}

export interface BehavioralProfile {
  id: number;
  triggers?: string;
  de_escalation_strategies?: string;
  communication_style?: string;
  notes?: string;
}

export interface FeedingPlan {
  id: number;
  method: string;
  restrictions?: string;
  notes?: string;
}

export interface AssistiveDevice {
  id: number;
  device_type: string;
  requires_transfer_assistance?: boolean;
  notes?: string;
}

export interface ActivityPermission {
  id: number;
  activity_name: string;
  permission_level: 'yes' | 'no' | 'restricted';
  restriction_notes?: string;
}

export interface EmergencyContact {
  id: number;
  name: string;
  relationship: string;
  phone_primary: string;
  phone_secondary?: string;
  phone?: string;
  email?: string;
  is_primary?: boolean;
  is_authorized_pickup?: boolean;
}

export interface Document {
  id: number;
  file_name: string;
  name?: string;
  document_type: string | null;
  mime_type: string;
  size: number;
  created_at: string;
  url: string;
}

export interface ProviderLink {
  id: number;
  camper_id: number;
  camper?: Camper;
  token: string;
  expires_at: string;
  used_at?: string;
  revoked_at?: string;
  created_at: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  read_at?: string;
  created_at: string;
  data?: Record<string, unknown>;
}

export interface AuditLogEntry {
  id: number;
  request_id?: string;
  user_id: number | null;
  user?: { id: number; name: string; email: string } | null;
  event_type?: string;
  category?: string;
  action: string;
  description?: string | null;
  human_description?: string;
  auditable_type: string | null;
  auditable_id: number | null;
  entity_label?: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  email_verified_at?: string;
  mfa_enabled?: boolean;
  created_at: string;
}

// ─── Family Management Types ────────────────────────────────────────────────
// These types power the 3-level family-first admin IA:
//   FamilyCamperSummary  → used in FamilyCard (Level 1 summary cards)
//   FamilyCard           → one item in the GET /families paginated list
//   FamilyWorkspaceCamperApplication → one application row in the workspace
//   FamilyWorkspaceCamper → one child card in the family workspace (Level 2)
//   FamilyWorkspace      → full family workspace data (Level 2)

export interface FamilyCamperSummary {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string;
  gender?: string;
  applications_count: number;
  latest_application?: {
    id: number;
    status: Application['status'];
    submitted_at?: string | null;
    session_name?: string | null;
    session_id?: number | null;
  } | null;
}

export interface FamilyCard {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  created_at: string;
  campers_count: number;
  campers: FamilyCamperSummary[];
  active_applications_count: number;
  application_statuses: Application['status'][];
}

export interface FamilyWorkspaceApplication {
  id: number;
  status: Application['status'];
  submitted_at?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  camp_session_id: number;
  session?: {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    is_active?: boolean;
  } | null;
}

export interface FamilyWorkspaceCamper {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string;
  gender?: string | null;
  tshirt_size?: string | null;
  created_at: string;
  applications: FamilyWorkspaceApplication[];
}

export interface FamilyWorkspace {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  created_at: string;
  campers: FamilyWorkspaceCamper[];
}

export interface SessionDashboardStats {
  session: {
    id: number;
    name: string;
    camp: string | null;
    start_date: string;
    end_date: string;
    is_active: boolean;
  };
  capacity_stats: {
    capacity: number;
    enrolled: number;
    remaining: number;
    fill_percentage: number;
    is_at_capacity: boolean;
  };
  application_stats: {
    total_submitted: number;
    pending: number;
    under_review: number;
    approved: number;
    rejected: number;
    waitlisted: number;
    cancelled: number;
    acceptance_rate: number;
  };
  recent_applications: Array<{
    id: number;
    camper_name: string | null;
    status: string;
    submitted_at: string | null;
  }>;
  age_distribution: Record<string, number>;
  gender_distribution: Record<string, number>;
}
