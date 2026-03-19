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

export async function getCampers(params?: { page?: number; search?: string; session_id?: number; id?: number }): Promise<PaginatedResponse<Camper>> {
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
  applications_over_time: { month: string; count: number }[];
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

export async function getAuditLog(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  user_id?: number;
  action?: string;
  event_type?: string;
  entity_type?: string;
  from?: string;
  to?: string;
}): Promise<PaginatedResponse<AuditLogEntry>> {
  const { data } = await axiosInstance.get<PaginatedResponse<AuditLogEntry>>('/audit-log', { params });
  return data;
}

export async function exportAuditLog(params: {
  format: 'csv' | 'json';
  search?: string;
  user_id?: number;
  action?: string;
  event_type?: string;
  entity_type?: string;
  from?: string;
  to?: string;
}): Promise<void> {
  const response = await axiosInstance.get('/audit-log/export', { params, responseType: 'blob' });
  const ext      = params.format === 'json' ? 'json' : 'csv';
  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.${ext}`;
  const url      = URL.createObjectURL(response.data as Blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Alias used by AdminDashboardPage */
export const getAdminApplications = getApplications;

// ─── Documents (admin inbox) ──────────────────────────────────────────────────

export interface AdminDocument {
  id: number;
  file_name: string;
  document_type: string | null;
  mime_type: string;
  size: number;
  scan_passed: boolean | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  uploaded_by_name: string | null;
  documentable_name: string | null;
  created_at: string;
  url: string;
}

export async function getAdminDocuments(params?: {
  page?: number;
  search?: string;
  verification_status?: string;
  documentable_type?: string;
}): Promise<PaginatedResponse<AdminDocument>> {
  const { data } = await axiosInstance.get<PaginatedResponse<AdminDocument>>('/documents', { params });
  return data;
}

export async function verifyDocument(id: number, status: 'approved' | 'rejected'): Promise<AdminDocument> {
  const { data } = await axiosInstance.patch<{ data: AdminDocument }>(`/documents/${id}/verify`, { status });
  return data.data;
}

export async function downloadAdminDocument(id: number): Promise<Blob> {
  const { data } = await axiosInstance.get(`/documents/${id}/download`, { responseType: 'blob' });
  return data;
}

// ─── Applicant Documents ─────────────────────────────────────────────────────

export interface ApplicantDocumentRecord {
  id: number;
  applicant_id: number;
  applicant_name: string;
  uploaded_by_admin_id: number;
  admin_name: string;
  original_file_name: string;
  instructions: string | null;
  status: 'pending' | 'submitted' | 'reviewed';
  created_at: string;
  reviewed_at: string | null;
  download_original_url: string;
  download_submitted_url: string | null;
}

export const sendDocumentToApplicant = async (formData: FormData): Promise<ApplicantDocumentRecord> => {
  const { data } = await axiosInstance.post('/admin/documents/send', formData, {
    headers: { 'Content-Type': undefined },
  });
  return data;
};

export const getAdminApplicantDocuments = async (params?: {
  applicant_id?: number;
  status?: string;
  page?: number;
}): Promise<{ data: ApplicantDocumentRecord[]; meta: any }> => {
  const { data } = await axiosInstance.get('/admin/documents', { params });
  return data;
};

export const getAdminDocumentsForApplicant = async (applicantId: number): Promise<ApplicantDocumentRecord[]> => {
  const { data } = await axiosInstance.get(`/admin/documents/${applicantId}`);
  return data;
};

export const markApplicantDocumentReviewed = async (id: number): Promise<ApplicantDocumentRecord> => {
  const { data } = await axiosInstance.patch(`/admin/applicant-documents/${id}/review`);
  return data;
};

export const replaceApplicantDocument = async (id: number, formData: FormData): Promise<ApplicantDocumentRecord> => {
  const { data } = await axiosInstance.post(`/admin/applicant-documents/${id}/replace`, formData, {
    headers: { 'Content-Type': undefined },
  });
  return data;
};

// ─── Document Requests ────────────────────────────────────────────────────────

export type DocumentRequestStatus =
  | 'awaiting_upload'
  | 'uploaded'
  | 'scanning'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'overdue';

export interface DocumentRequest {
  id: number;
  applicant_id: number;
  applicant_name: string;
  application_id: number | null;
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
  reviewed_by_name: string | null;
  download_url: string | null;
  created_at: string;
}

export interface DocumentRequestStats {
  total: number;
  awaiting_upload: number;
  uploaded: number;
  under_review: number;
  approved: number;
  rejected: number;
  overdue: number;
}

export const getDocumentRequestStats = async (): Promise<DocumentRequestStats> => {
  const { data } = await axiosInstance.get('/document-requests/stats');
  return data;
};

export const getDocumentRequests = async (params?: {
  applicant_id?: number;
  camper_id?: number;
  status?: string;
  search?: string;
  page?: number;
}): Promise<{ data: DocumentRequest[]; meta: any }> => {
  const { data } = await axiosInstance.get('/document-requests', { params });
  return data;
};

export const getDocumentRequest = async (id: number): Promise<DocumentRequest> => {
  const { data } = await axiosInstance.get(`/document-requests/${id}`);
  return data;
};

export const createDocumentRequest = async (payload: {
  applicant_id: number;
  application_id?: number | null;
  camper_id?: number | null;
  document_type: string;
  instructions?: string;
  due_date?: string;
}): Promise<DocumentRequest> => {
  const { data } = await axiosInstance.post('/document-requests', payload);
  return data;
};

export const approveDocumentRequest = async (id: number): Promise<DocumentRequest> => {
  const { data } = await axiosInstance.patch(`/document-requests/${id}/approve`);
  return data;
};

export const rejectDocumentRequest = async (id: number, reason?: string): Promise<DocumentRequest> => {
  const { data } = await axiosInstance.patch(`/document-requests/${id}/reject`, { reason });
  return data;
};

export const downloadDocumentRequestFile = async (id: number): Promise<Blob> => {
  const { data } = await axiosInstance.get(`/document-requests/${id}/download`, { responseType: 'blob' });
  return data;
};

export const cancelDocumentRequest = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/document-requests/${id}`);
};

export const remindDocumentRequest = async (id: number): Promise<void> => {
  await axiosInstance.post(`/document-requests/${id}/remind`);
};

export const extendDocumentRequestDeadline = async (id: number, due_date: string): Promise<DocumentRequest> => {
  const { data } = await axiosInstance.patch(`/document-requests/${id}/extend`, { due_date });
  return data;
};

export const requestDocumentReupload = async (id: number): Promise<DocumentRequest> => {
  const { data } = await axiosInstance.patch(`/document-requests/${id}/reupload`);
  return data;
};

export const getSessionDashboard = async (id: number, signal?: AbortSignal): Promise<import('@/features/admin/types/admin.types').SessionDashboardStats> => {
  const { data } = await axiosInstance.get(`/sessions/${id}/dashboard`, { signal });
  return data;
};

export const archiveSession = async (id: number): Promise<void> => {
  await axiosInstance.post(`/sessions/${id}/archive`);
};
