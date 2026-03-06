/**
 * admin.api.ts — All admin-scoped API calls
 */

import { axiosInstance } from '@/api/axios.config';
import type { ApiResponse, PaginatedResponse } from '@/shared/types/api.types';
import type {
  Application, ApplicationReviewPayload, AuditLogEntry,
  Camp, Camper, CampSession, ProviderLink, User,
} from '@/features/admin/types/admin.types';

export async function getApplications(params?: { page?: number; status?: string; search?: string }): Promise<PaginatedResponse<Application>> {

  const { data } = await axiosInstance.get<PaginatedResponse<Application>>('/applications', { params });
  return data;
}
export async function getApplication(id: number): Promise<Application> {
  const { data } = await axiosInstance.get<ApiResponse<Application>>(`/applications/${id}`);
  return data.data;
}
export async function reviewApplication(id: number, payload: ApplicationReviewPayload): Promise<Application> {
  const { data } = await axiosInstance.post<ApiResponse<Application>>(`/applications/${id}/review`, payload);
  return data.data;
}
export async function deleteApplication(id: number): Promise<void> { await axiosInstance.delete(`/applications/${id}`); }

export async function getCampers(params?: { page?: number; search?: string; session_id?: number }): Promise<PaginatedResponse<Camper>> {
  const { data } = await axiosInstance.get<PaginatedResponse<Camper>>('/campers', { params });
  return data;
}
export async function getCamper(id: number): Promise<Camper> {
  const { data } = await axiosInstance.get<ApiResponse<Camper>>(`/campers/${id}`);
  return data.data;
}
export async function getCamperRiskSummary(id: number): Promise<unknown> {
  const { data } = await axiosInstance.get(`/campers/${id}/risk-summary`); return data.data;
}
export async function getCamperComplianceStatus(id: number): Promise<unknown> {
  const { data } = await axiosInstance.get(`/campers/${id}/compliance-status`); return data.data;
}

export async function getCamps(): Promise<Camp[]> {
  const { data } = await axiosInstance.get<ApiResponse<Camp[]>>('/camps'); return data.data;
}
export async function createCamp(payload: Omit<Camp, 'id' | 'created_at' | 'updated_at'>): Promise<Camp> {
  const { data } = await axiosInstance.post<ApiResponse<Camp>>('/camps', payload); return data.data;
}
export async function updateCamp(id: number, payload: Partial<Omit<Camp, 'id'>>): Promise<Camp> {
  const { data } = await axiosInstance.put<ApiResponse<Camp>>(`/camps/${id}`, payload); return data.data;
}
export async function deleteCamp(id: number): Promise<void> { await axiosInstance.delete(`/camps/${id}`); }

export async function getSessions(params?: { camp_id?: number }): Promise<CampSession[]> {
  const { data } = await axiosInstance.get<ApiResponse<CampSession[]>>('/sessions', { params }); return data.data;
}
export async function createSession(payload: Omit<CampSession, 'id' | 'created_at' | 'camp'>): Promise<CampSession> {
  const { data } = await axiosInstance.post<ApiResponse<CampSession>>('/sessions', payload); return data.data;
}
export async function updateSession(id: number, payload: Partial<Omit<CampSession, 'id'>>): Promise<CampSession> {
  const { data } = await axiosInstance.put<ApiResponse<CampSession>>(`/sessions/${id}`, payload); return data.data;
}
export async function deleteSession(id: number): Promise<void> { await axiosInstance.delete(`/sessions/${id}`); }

export interface ReportsSummary {
  total_campers: number;
  total_applications: number;
  accepted_applications: number;
  pending_applications: number;
  rejected_applications: number;
  applications_by_status: Record<string, number>;
  sessions: { id: number; name: string; capacity: number; enrolled: number }[];
}

export async function getReportsSummary(): Promise<ReportsSummary> {
  const { data } = await axiosInstance.get<ApiResponse<ReportsSummary>>('/reports/summary');
  return data.data;
}

type ReportType = 'applications' | 'accepted' | 'rejected' | 'mailing-labels' | 'id-labels';
export async function downloadReport(type: ReportType): Promise<void> {
  const response = await axiosInstance.get(`/reports/${type}`, {
    responseType: 'blob',
    headers: { Accept: 'text/csv, application/octet-stream, */*' },
  });
  const blob = response.data as Blob;
  // Guard: if server returned JSON error instead of CSV, throw rather than download garbage
  if (blob.type && blob.type.includes('application/json')) {
    throw new Error('Server returned an error response instead of CSV.');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}-report.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function getProviderLinks(): Promise<ProviderLink[]> {
  const { data } = await axiosInstance.get<ApiResponse<ProviderLink[]>>('/provider-links'); return data.data;
}
export async function createProviderLink(payload: { camper_id: number }): Promise<ProviderLink> {
  const { data } = await axiosInstance.post<ApiResponse<ProviderLink>>('/provider-links', payload); return data.data;
}
export async function revokeProviderLink(id: number): Promise<void> { await axiosInstance.post(`/provider-links/${id}/revoke`); }
export async function resendProviderLink(id: number): Promise<void> { await axiosInstance.post(`/provider-links/${id}/resend`); }

export async function getUsers(params?: { page?: number; search?: string; role?: string }): Promise<PaginatedResponse<User>> {
  const { data } = await axiosInstance.get<PaginatedResponse<User>>('/users', { params }); return data;
}
export async function updateUserRole(id: number, role: string): Promise<User> {
  const { data } = await axiosInstance.put<ApiResponse<User>>(`/users/${id}/role`, { role }); return data.data;
}
export async function deactivateUser(id: number): Promise<void> { await axiosInstance.post(`/users/${id}/deactivate`); }
export async function reactivateUser(id: number): Promise<void> { await axiosInstance.post(`/users/${id}/reactivate`); }

export async function getAuditLog(params?: { page?: number; search?: string; user_id?: number; action?: string; from?: string; to?: string }): Promise<PaginatedResponse<AuditLogEntry>> {
  const { data } = await axiosInstance.get<PaginatedResponse<AuditLogEntry>>('/audit-log', { params }); return data;
}

/** Alias used by AdminDashboardPage */
export const getAdminApplications = getApplications;
