/**
 * auth.api.ts
 * All authentication API calls.
 * Each function returns typed data or throws a typed error.
 */

import axiosInstance from '@/api/axios.config';
import type {
  AuthResponse,
  MFASetupResponse,
  MFAVerifyResponse,
  User,
  Role,
  ApiResponse,
} from '@/shared/types';

/**
 * Normalize a user object from the backend.
 * The backend returns `user.role` (single BelongsTo object) but the frontend
 * expects `user.roles` (array). Convert if needed.
 */
function normalizeUser(user: User & { role?: Role | string }): User {
  if (!user.roles?.length && user.role && typeof user.role === 'object') {
    return { ...user, roles: [user.role as Role] };
  }
  return user;
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}

/** POST /api/auth/login */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await axiosInstance.post<AuthResponse>(
    '/auth/login',
    payload
  );
  if (data.data?.user) {
    data.data.user = normalizeUser(data.data.user);
  }
  return data;
}

/** POST /api/auth/register */
export async function register(
  payload: RegisterPayload
): Promise<AuthResponse> {
  const { data } = await axiosInstance.post<AuthResponse>(
    '/auth/register',
    payload
  );
  if (data.data?.user) {
    data.data.user = normalizeUser(data.data.user);
  }
  return data;
}

/** POST /api/logout */
export async function logout(): Promise<void> {
  await axiosInstance.post('/logout');
}

/** POST /api/auth/forgot-password */
export async function forgotPassword(
  payload: ForgotPasswordPayload
): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.post<ApiResponse<null>>(
    '/auth/forgot-password',
    payload
  );
  return data;
}

/** POST /api/auth/reset-password */
export async function resetPassword(
  payload: ResetPasswordPayload
): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.post<ApiResponse<null>>(
    '/auth/reset-password',
    payload
  );
  return data;
}

/** GET /api/user — verify persisted token is still valid */
export async function getAuthenticatedUser(): Promise<User> {
  const { data } = await axiosInstance.get<ApiResponse<User>>('/user');
  return normalizeUser(data.data);
}

// ---------------------------------------------------------------------------
// MFA endpoints
// ---------------------------------------------------------------------------

/** POST /api/mfa/setup */
export async function setupMfa(): Promise<MFASetupResponse> {
  const { data } = await axiosInstance.post<MFASetupResponse>('/mfa/setup');
  return data;
}

/** POST /api/mfa/verify */
export async function verifyMfa(code: string): Promise<MFAVerifyResponse> {
  const { data } = await axiosInstance.post<MFAVerifyResponse>('/mfa/verify', {
    code,
  });
  return data;
}

/** POST /api/mfa/disable */
export async function disableMfa(): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.post<ApiResponse<null>>('/mfa/disable');
  return data;
}
