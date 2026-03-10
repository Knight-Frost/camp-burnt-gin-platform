/**
 * applicant.api.ts
 * API calls for applicant-role users: sessions, campers, applications, documents.
 */

import axiosInstance from '@/api/axios.config';
import type {
  ApiResponse,
  PaginatedResponse,
  Camper,
  Application,
  Session,
} from '@/shared/types';

// ---------------------------------------------------------------------------
// Campers
// ---------------------------------------------------------------------------

export async function getCampers(): Promise<Camper[]> {
  const { data } = await axiosInstance.get<PaginatedResponse<Camper>>('/campers');
  return data.data ?? [];
}

export async function getCamper(id: number): Promise<Camper> {
  const { data } = await axiosInstance.get<ApiResponse<Camper>>(`/campers/${id}`);
  return data.data;
}

export interface CreateCamperPayload {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  tshirt_size: string;
}

export async function createCamper(
  payload: CreateCamperPayload
): Promise<Camper> {
  const { data } = await axiosInstance.post<ApiResponse<Camper>>(
    '/campers',
    payload
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export async function getApplications(): Promise<Application[]> {
  const { data } = await axiosInstance.get<PaginatedResponse<Application>>(
    '/applications'
  );
  return data.data ?? [];
}

export async function getApplication(id: number): Promise<Application> {
  const { data } = await axiosInstance.get<ApiResponse<Application>>(
    `/applications/${id}`
  );
  return data.data;
}

export interface CreateApplicationPayload {
  camper_id: number;
  session_id: number;
}

export async function createApplication(
  payload: CreateApplicationPayload
): Promise<Application> {
  const { data } = await axiosInstance.post<ApiResponse<Application>>(
    '/applications',
    payload
  );
  return data.data;
}

export async function signApplication(
  id: number,
  signatureName: string,
  signatureData: string
): Promise<Application> {
  const { data } = await axiosInstance.post<ApiResponse<Application>>(
    `/applications/${id}/sign`,
    { signature_name: signatureName, signature_data: signatureData }
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function getSessions(): Promise<Session[]> {
  const { data } = await axiosInstance.get<{ data: Session[] }>('/sessions');
  return data.data ?? [];
}

// ---------------------------------------------------------------------------
// Application submission resources
// ---------------------------------------------------------------------------

export interface CreateEmergencyContactPayload {
  camper_id: number;
  name: string;
  relationship: string;
  phone_primary: string;
  is_primary: boolean;
  is_authorized_pickup: boolean;
}

export async function createEmergencyContact(
  payload: CreateEmergencyContactPayload
): Promise<void> {
  await axiosInstance.post('/emergency-contacts', payload);
}

export interface CreateMedicalRecordPayload {
  camper_id: number;
  physician_name: string;
  physician_phone: string;
  insurance_provider: string;
  insurance_policy_number: string;
  special_needs?: string;
}

export async function createMedicalRecord(
  payload: CreateMedicalRecordPayload
): Promise<{ id: number }> {
  const { data } = await axiosInstance.post<{ data: { id: number } }>(
    '/medical-records',
    payload
  );
  return data.data;
}

export interface CreateDiagnosisPayload {
  camper_id: number;
  name: string;
  severity_level: string;
  notes?: string;
}

export async function createDiagnosis(
  payload: CreateDiagnosisPayload
): Promise<void> {
  await axiosInstance.post('/diagnoses', payload);
}

export interface CreateAllergyPayload {
  camper_id: number;
  allergen: string;
  severity: string;
  reaction?: string;
  treatment?: string;
}

export async function createAllergy(
  payload: CreateAllergyPayload
): Promise<void> {
  await axiosInstance.post('/allergies', payload);
}

export interface CreateBehavioralProfilePayload {
  camper_id: number;
  aggression: boolean;
  self_abuse: boolean;
  wandering_risk: boolean;
  one_to_one_supervision: boolean;
  developmental_delay: boolean;
  communication_methods?: string[];
  notes?: string;
}

export async function createBehavioralProfile(
  payload: CreateBehavioralProfilePayload
): Promise<void> {
  await axiosInstance.post('/behavioral-profiles', payload);
}

export interface CreateAssistiveDevicePayload {
  camper_id: number;
  device_type: string;
  requires_transfer_assistance: boolean;
  notes?: string;
}

export async function createAssistiveDevice(
  payload: CreateAssistiveDevicePayload
): Promise<void> {
  await axiosInstance.post('/assistive-devices', payload);
}

export interface CreateFeedingPlanPayload {
  camper_id: number;
  special_diet: boolean;
  diet_description?: string;
  g_tube: boolean;
  formula?: string;
  amount_per_feeding?: string;
  feedings_per_day?: number;
  feeding_times?: string[];
}

export async function createFeedingPlan(
  payload: CreateFeedingPlanPayload
): Promise<void> {
  await axiosInstance.post('/feeding-plans', payload);
}

export interface CreateMedicationPayload {
  camper_id: number;
  name: string;
  dosage: string;
  frequency: string;
  purpose?: string;
  prescribing_physician?: string;
  notes?: string;
}

export async function createMedication(
  payload: CreateMedicationPayload
): Promise<void> {
  await axiosInstance.post('/medications', payload);
}

export interface CreateActivityPermissionPayload {
  camper_id: number;
  activity_name: string;
  permission_level: string;
  notes?: string;
}

export async function createActivityPermission(
  payload: CreateActivityPermissionPayload
): Promise<void> {
  await axiosInstance.post('/activity-permissions', payload);
}

export async function uploadDocument(formData: FormData): Promise<void> {
  await axiosInstance.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// ---------------------------------------------------------------------------
// Documents (applicant portal)
// ---------------------------------------------------------------------------

export interface Document {
  id: number;
  file_name: string;
  document_type: string;
  mime_type: string;
  size: number;
  created_at: string;
  url: string;
}

export async function getDocuments(): Promise<Document[]> {
  const { data } = await axiosInstance.get<{ data: Document[] }>('/documents');
  return data.data ?? [];
}

export async function deleteDocument(id: number): Promise<void> {
  await axiosInstance.delete(`/documents/${id}`);
}

// ─── Required Documents (sent by admin) ──────────────────────────────────────

export interface RequiredDocument {
  id: number;
  original_file_name: string;
  instructions: string | null;
  status: 'pending' | 'submitted' | 'reviewed';
  created_at: string;
  download_url: string;
}

export async function getRequiredDocuments(): Promise<RequiredDocument[]> {
  const { data } = await axiosInstance.get('/applicant/documents');
  return data;
}

export async function submitCompletedDocument(id: number, file: File): Promise<RequiredDocument> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('applicant_document_id', String(id));
  const { data } = await axiosInstance.post('/applicant/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// ─── Document Requests (new request lifecycle system) ─────────────────────────

export type DocumentRequestStatus =
  | 'awaiting_upload'
  | 'uploaded'
  | 'scanning'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'overdue';

export interface DocumentRequestRecord {
  id: number;
  applicant_id: number;
  camper_id: number | null;
  camper_name: string | null;
  requested_by_admin_id: number;
  requested_by_name: string;
  document_type: string;
  instructions: string | null;
  status: DocumentRequestStatus;
  due_date: string | null;
  uploaded_file_name: string | null;
  uploaded_at: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  download_url: string | null;
  created_at: string;
}

export async function getDocumentRequests(): Promise<DocumentRequestRecord[]> {
  const { data } = await axiosInstance.get('/applicant/document-requests');
  return data;
}

export async function uploadDocumentRequest(id: number, file: File): Promise<DocumentRequestRecord> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await axiosInstance.post(`/applicant/document-requests/${id}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
