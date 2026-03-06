/**
 * medical.api.ts
 *
 * Medical portal API calls: records, sub-resources (read + write), treatment logs, documents.
 */

import { axiosInstance } from '@/api/axios.config';
import type { ApiResponse, PaginatedResponse } from '@/shared/types/api.types';
import type {
  Camper,
  MedicalRecord,
  Allergy,
  Medication,
  Diagnosis,
  BehavioralProfile,
  FeedingPlan,
  AssistiveDevice,
  ActivityPermission,
  EmergencyContact,
  Document,
} from '@/features/admin/types/admin.types';

// ─── Camper list ──────────────────────────────────────────────────────────────

export async function getMedicalCampers(params?: { search?: string; page?: number }): Promise<PaginatedResponse<Camper>> {
  const { data } = await axiosInstance.get<PaginatedResponse<Camper>>('/campers', { params });
  return data;
}

// ─── Medical record ───────────────────────────────────────────────────────────

export async function getMedicalRecords(params?: { page?: number; camper_id?: number }): Promise<PaginatedResponse<MedicalRecord>> {
  const { data } = await axiosInstance.get<PaginatedResponse<MedicalRecord>>('/medical-records', { params });
  return data;
}

export async function getMedicalRecord(id: number): Promise<MedicalRecord> {
  const { data } = await axiosInstance.get<ApiResponse<MedicalRecord>>(`/medical-records/${id}`);
  return data.data;
}

export async function getMedicalRecordByCamper(camperId: number): Promise<MedicalRecord> {
  const { data } = await axiosInstance.get<PaginatedResponse<MedicalRecord>>('/medical-records', {
    params: { camper_id: camperId },
  });
  return data.data[0];
}

export async function updateMedicalRecord(id: number, payload: Partial<MedicalRecord>): Promise<MedicalRecord> {
  const { data } = await axiosInstance.put<ApiResponse<MedicalRecord>>(`/medical-records/${id}`, payload);
  return data.data;
}

// ─── Allergies ────────────────────────────────────────────────────────────────

export async function getAllergies(medicalRecordId: number): Promise<Allergy[]> {
  const { data } = await axiosInstance.get<ApiResponse<Allergy[]>>(`/allergies`, {
    params: { medical_record_id: medicalRecordId },
  });
  return data.data;
}

export async function getAllergiesByCamper(camperId: number): Promise<Allergy[]> {
  const { data } = await axiosInstance.get<ApiResponse<Allergy[]>>(`/allergies`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function createAllergy(payload: { camper_id: number; allergen: string; severity: string; reaction?: string; treatment?: string }): Promise<Allergy> {
  const { data } = await axiosInstance.post<ApiResponse<Allergy>>('/allergies', payload);
  return data.data;
}

export async function updateAllergy(id: number, payload: Partial<{ allergen: string; severity: string; reaction: string; treatment: string }>): Promise<Allergy> {
  const { data } = await axiosInstance.put<ApiResponse<Allergy>>(`/allergies/${id}`, payload);
  return data.data;
}

// ─── Medications ──────────────────────────────────────────────────────────────

export async function getMedications(medicalRecordId: number): Promise<Medication[]> {
  const { data } = await axiosInstance.get<ApiResponse<Medication[]>>(`/medications`, {
    params: { medical_record_id: medicalRecordId },
  });
  return data.data;
}

export async function getMedicationsByCamper(camperId: number): Promise<Medication[]> {
  const { data } = await axiosInstance.get<ApiResponse<Medication[]>>(`/medications`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function createMedication(payload: { camper_id: number; name: string; dosage: string; frequency: string; purpose?: string; notes?: string }): Promise<Medication> {
  const { data } = await axiosInstance.post<ApiResponse<Medication>>('/medications', payload);
  return data.data;
}

export async function updateMedication(id: number, payload: Partial<{ name: string; dosage: string; frequency: string; purpose: string; notes: string }>): Promise<Medication> {
  const { data } = await axiosInstance.put<ApiResponse<Medication>>(`/medications/${id}`, payload);
  return data.data;
}

// ─── Diagnoses ────────────────────────────────────────────────────────────────

export async function getDiagnoses(medicalRecordId: number): Promise<Diagnosis[]> {
  const { data } = await axiosInstance.get<ApiResponse<Diagnosis[]>>(`/diagnoses`, {
    params: { medical_record_id: medicalRecordId },
  });
  return data.data;
}

export async function getDiagnosesByCamper(camperId: number): Promise<Diagnosis[]> {
  const { data } = await axiosInstance.get<ApiResponse<Diagnosis[]>>(`/diagnoses`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function createDiagnosis(payload: { camper_id: number; name: string; icd_code?: string; notes?: string }): Promise<Diagnosis> {
  const { data } = await axiosInstance.post<ApiResponse<Diagnosis>>('/diagnoses', payload);
  return data.data;
}

export async function updateDiagnosis(id: number, payload: Partial<{ name: string; icd_code: string; notes: string }>): Promise<Diagnosis> {
  const { data } = await axiosInstance.put<ApiResponse<Diagnosis>>(`/diagnoses/${id}`, payload);
  return data.data;
}

// ─── Emergency contacts ───────────────────────────────────────────────────────

export async function getEmergencyContacts(camperId: number): Promise<EmergencyContact[]> {
  const { data } = await axiosInstance.get<ApiResponse<EmergencyContact[]>>(`/emergency-contacts`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

// ─── Activity permissions ─────────────────────────────────────────────────────

export async function getActivityPermissions(camperId: number): Promise<ActivityPermission[]> {
  const { data } = await axiosInstance.get<ApiResponse<ActivityPermission[]>>(`/activity-permissions`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function updateActivityPermission(id: number, payload: Partial<{ activity: string; permitted: boolean; notes: string }>): Promise<ActivityPermission> {
  const { data } = await axiosInstance.put<ApiResponse<ActivityPermission>>(`/activity-permissions/${id}`, payload);
  return data.data;
}

// ─── Behavioral profile ───────────────────────────────────────────────────────

export async function getBehavioralProfile(camperId: number): Promise<BehavioralProfile | null> {
  const { data } = await axiosInstance.get<ApiResponse<BehavioralProfile | null>>(`/behavioral-profiles`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function updateBehavioralProfile(id: number, payload: Partial<BehavioralProfile>): Promise<BehavioralProfile> {
  const { data } = await axiosInstance.put<ApiResponse<BehavioralProfile>>(`/behavioral-profiles/${id}`, payload);
  return data.data;
}

export async function createBehavioralProfile(payload: { camper_id: number } & Partial<BehavioralProfile>): Promise<BehavioralProfile> {
  const { data } = await axiosInstance.post<ApiResponse<BehavioralProfile>>('/behavioral-profiles', payload);
  return data.data;
}

// ─── Feeding plan ─────────────────────────────────────────────────────────────

export async function getFeedingPlan(camperId: number): Promise<FeedingPlan | null> {
  const { data } = await axiosInstance.get<ApiResponse<FeedingPlan | null>>(`/feeding-plans`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function updateFeedingPlan(id: number, payload: Partial<FeedingPlan>): Promise<FeedingPlan> {
  const { data } = await axiosInstance.put<ApiResponse<FeedingPlan>>(`/feeding-plans/${id}`, payload);
  return data.data;
}

export async function createFeedingPlan(payload: { camper_id: number } & Partial<FeedingPlan>): Promise<FeedingPlan> {
  const { data } = await axiosInstance.post<ApiResponse<FeedingPlan>>('/feeding-plans', payload);
  return data.data;
}

// ─── Assistive devices ────────────────────────────────────────────────────────

export async function getAssistiveDevices(camperId: number): Promise<AssistiveDevice[]> {
  const { data } = await axiosInstance.get<ApiResponse<AssistiveDevice[]>>(`/assistive-devices`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function createAssistiveDevice(payload: { camper_id: number; type: string; description?: string }): Promise<AssistiveDevice> {
  const { data } = await axiosInstance.post<ApiResponse<AssistiveDevice>>('/assistive-devices', payload);
  return data.data;
}

export async function updateAssistiveDevice(id: number, payload: Partial<{ type: string; description: string }>): Promise<AssistiveDevice> {
  const { data } = await axiosInstance.put<ApiResponse<AssistiveDevice>>(`/assistive-devices/${id}`, payload);
  return data.data;
}

// ─── Treatment logs ───────────────────────────────────────────────────────────

export interface TreatmentLog {
  id: number;
  camper_id: number;
  recorded_by: number;
  recorder?: { id: number; name: string };
  camper?: { id: number; full_name: string };
  treatment_date: string;
  treatment_time?: string;
  type: TreatmentType;
  title: string;
  description: string;
  outcome?: string;
  follow_up_required: boolean;
  follow_up_notes?: string;
  created_at: string;
  updated_at: string;
}

export type TreatmentType =
  | 'medication_administered'
  | 'first_aid'
  | 'observation'
  | 'emergency'
  | 'other';

export interface StoreTreatmentLogPayload {
  camper_id: number;
  treatment_date: string;
  treatment_time?: string;
  type: TreatmentType;
  title: string;
  description: string;
  outcome?: string;
  follow_up_required?: boolean;
  follow_up_notes?: string;
}

export async function getTreatmentLogs(params?: {
  camper_id?: number;
  from?: string;
  to?: string;
  type?: TreatmentType;
  page?: number;
}): Promise<PaginatedResponse<TreatmentLog>> {
  const { data } = await axiosInstance.get<PaginatedResponse<TreatmentLog>>('/treatment-logs', { params });
  return data;
}

export async function createTreatmentLog(payload: StoreTreatmentLogPayload): Promise<TreatmentLog> {
  const { data } = await axiosInstance.post<ApiResponse<TreatmentLog>>('/treatment-logs', payload);
  return data.data;
}

export async function updateTreatmentLog(id: number, payload: Partial<StoreTreatmentLogPayload>): Promise<TreatmentLog> {
  const { data } = await axiosInstance.put<ApiResponse<TreatmentLog>>(`/treatment-logs/${id}`, payload);
  return data.data;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export interface UploadDocumentPayload {
  file: File;
  documentable_type: 'App\\Models\\Camper' | 'App\\Models\\MedicalRecord';
  documentable_id: number;
  document_type?: string;
}

export async function getCamperDocuments(camperId: number): Promise<PaginatedResponse<Document>> {
  const { data } = await axiosInstance.get<PaginatedResponse<Document>>('/documents', {
    params: { documentable_type: 'App\\Models\\Camper', documentable_id: camperId },
  });
  return data;
}

export async function uploadDocument(payload: UploadDocumentPayload): Promise<Document> {
  const form = new FormData();
  form.append('file', payload.file);
  form.append('documentable_type', payload.documentable_type);
  form.append('documentable_id', String(payload.documentable_id));
  if (payload.document_type) {
    form.append('document_type', payload.document_type);
  }

  const { data } = await axiosInstance.post<ApiResponse<Document>>('/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function downloadDocument(id: number): Promise<Blob> {
  const { data } = await axiosInstance.get(`/documents/${id}/download`, { responseType: 'blob' });
  return data;
}
