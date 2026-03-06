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
  RoleName,
  ApiResponse,
} from '@/shared/types';

/**
 * Normalize a user object from the backend.
 *
 * The backend returns `user.role` as a BelongsTo object but the frontend
 * expects `user.roles` (Role[]) for RBAC checks in layout guards.
 *
 * Handles three shapes:
 *  1. Already normalized (roles array populated) — no-op.
 *  2. role is an embedded Role object (normal login/getUser response) —
 *     extract name string into `user.role` and build `roles` array.
 *  3. role is a flat string (defensive fallback) —
 *     build a minimal `roles` entry so guards don't fail.
 */
function normalizeUser(user: User & { role?: Role | string }): User {
  if (user.roles?.length) return user; // already normalized

  if (user.role && typeof user.role === 'object') {
    const roleObj = user.role as Role;
    // Flatten role to string AND populate roles array
    return { ...user, role: roleObj.name, roles: [roleObj] };
  }

  if (user.role && typeof user.role === 'string') {
    // Backend returned flat string — build a minimal roles entry
    const name = user.role as RoleName;
    return { ...user, roles: [{ id: 0, name, display_name: name }] };
  }

  return user;
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

export interface LoginPayload {
  email: string;
  password: string;
  mfa_code?: string;
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

// ---------------------------------------------------------------------------
// Email verification endpoints
// ---------------------------------------------------------------------------

export interface VerifyEmailPayload {
  id: string;
  hash: string;
  expires: string;
  signature: string;
}

/** POST /api/auth/email/verify */
export async function verifyEmail(
  payload: VerifyEmailPayload
): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.post<ApiResponse<null>>(
    '/auth/email/verify',
    payload
  );
  return data;
}

/** POST /api/auth/email/resend */
export async function resendVerificationEmail(): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.post<ApiResponse<null>>(
    '/auth/email/resend'
  );
  return data;
}
