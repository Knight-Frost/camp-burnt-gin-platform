/**
 * medical.api.ts
 *
 * Medical dashboard API calls: records, camper list, sub-resources.
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
} from '@/features/admin/types/admin.types';

export async function getMedicalCampers(params?: { search?: string; page?: number }): Promise<PaginatedResponse<Camper>> {
  const { data } = await axiosInstance.get<PaginatedResponse<Camper>>('/campers', { params });
  return data;
}

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

// Sub-resources — all follow same CRUD pattern
export async function getAllergies(medicalRecordId: number): Promise<Allergy[]> {
  const { data } = await axiosInstance.get<ApiResponse<Allergy[]>>(`/allergies`, {
    params: { medical_record_id: medicalRecordId },
  });
  return data.data;
}

export async function getMedications(medicalRecordId: number): Promise<Medication[]> {
  const { data } = await axiosInstance.get<ApiResponse<Medication[]>>(`/medications`, {
    params: { medical_record_id: medicalRecordId },
  });
  return data.data;
}

export async function getDiagnoses(medicalRecordId: number): Promise<Diagnosis[]> {
  const { data } = await axiosInstance.get<ApiResponse<Diagnosis[]>>(`/diagnoses`, {
    params: { medical_record_id: medicalRecordId },
  });
  return data.data;
}

export async function getEmergencyContacts(camperId: number): Promise<EmergencyContact[]> {
  const { data } = await axiosInstance.get<ApiResponse<EmergencyContact[]>>(`/emergency-contacts`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function getActivityPermissions(camperId: number): Promise<ActivityPermission[]> {
  const { data } = await axiosInstance.get<ApiResponse<ActivityPermission[]>>(`/activity-permissions`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function getBehavioralProfile(camperId: number): Promise<BehavioralProfile | null> {
  const { data } = await axiosInstance.get<ApiResponse<BehavioralProfile | null>>(`/behavioral-profiles`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function getFeedingPlan(camperId: number): Promise<FeedingPlan | null> {
  const { data } = await axiosInstance.get<ApiResponse<FeedingPlan | null>>(`/feeding-plans`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function getAssistiveDevices(camperId: number): Promise<AssistiveDevice[]> {
  const { data } = await axiosInstance.get<ApiResponse<AssistiveDevice[]>>(`/assistive-devices`, {
    params: { camper_id: camperId },
  });
  return data.data;
}
