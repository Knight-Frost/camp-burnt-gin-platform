/**
 * admin.types.ts
 * Type definitions scoped to the admin feature.
 */

export interface ApplicationReviewPayload {
  status: 'approved' | 'rejected' | 'under_review';
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
  created_at?: string;
}

export interface Application {
  id: number;
  camper_id: number;
  camp_session_id: number;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'waitlisted' | 'cancelled';
  notes?: string;
  submitted_at?: string;
  reviewed_at?: string;
  reviewer_id?: number;
  created_at: string;
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
  medical_record?: MedicalRecord;
  applications?: Application[];
}

export interface MedicalRecord {
  id: number;
  camper_id: number;
  primary_diagnosis?: string;
  allergies?: Allergy[];
  medications?: Medication[];
  diagnoses?: Diagnosis[];
  behavioral_profile?: BehavioralProfile;
  feeding_plan?: FeedingPlan;
  assistive_devices?: AssistiveDevice[];
  activity_permissions?: ActivityPermission[];
  emergency_contacts?: EmergencyContact[];
}

export interface Allergy {
  id: number;
  name: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  reaction?: string;
}

export interface Medication {
  id: number;
  name: string;
  dosage: string;
  frequency: string;
  route?: string;
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
  type: string;
  description?: string;
}

export interface ActivityPermission {
  id: number;
  activity: string;
  permitted: boolean;
  notes?: string;
}

export interface EmergencyContact {
  id: number;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface Document {
  id: number;
  name: string;
  mime_type: string;
  size: number;
  created_at: string;
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
