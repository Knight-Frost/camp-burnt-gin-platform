/**
 * profile.api.ts
 *
 * User profile: view, update, MFA setup/disable, pre-fill data.
 */

import { axiosInstance } from '@/api/axios.config';
import type { ApiResponse } from '@/shared/types/api.types';
import type { User } from '@/shared/types/user.types';

export interface ProfileUpdatePayload {
  name?: string;
  email?: string;
}

export interface MfaSetupResponse {
  secret: string;
  qr_code_url: string;
}

export interface DisableMfaPayload {
  code: string;
  password: string;
}

export interface PreFillData {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
}

export async function getProfile(): Promise<User> {
  const { data } = await axiosInstance.get<ApiResponse<User>>('/profile');
  return data.data;
}

export async function updateProfile(payload: ProfileUpdatePayload): Promise<User> {
  const { data } = await axiosInstance.put<ApiResponse<User>>('/profile', payload);
  return data.data;
}

export async function setupMfa(): Promise<MfaSetupResponse> {
  const { data } = await axiosInstance.post<ApiResponse<MfaSetupResponse>>('/mfa/setup');
  return data.data;
}

export async function verifyMfaSetup(code: string): Promise<void> {
  await axiosInstance.post('/mfa/verify', { code });
}

export async function disableMfa(payload: DisableMfaPayload): Promise<void> {
  await axiosInstance.post('/mfa/disable', payload);
}

export async function getPreFillData(): Promise<PreFillData> {
  const { data } = await axiosInstance.get<ApiResponse<PreFillData>>('/profile/prefill');
  return data.data;
}
