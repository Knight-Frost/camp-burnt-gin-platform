/**
 * parent.api.ts
 * API calls for parent-role users: campers, applications.
 */

import axiosInstance from '@/api/axios.config';
import type {
  ApiResponse,
  PaginatedResponse,
  Camper,
  Application,
} from '@/shared/types';

// ---------------------------------------------------------------------------
// Campers
// ---------------------------------------------------------------------------

export async function getCampers(): Promise<Camper[]> {
  const { data } = await axiosInstance.get<PaginatedResponse<Camper>>('/campers');
  return data.data;
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
  return data.data;
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
  signatureName: string
): Promise<Application> {
  const { data } = await axiosInstance.post<ApiResponse<Application>>(
    `/applications/${id}/sign`,
    { signature_name: signatureName }
  );
  return data.data;
}
