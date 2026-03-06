/**
 * auth.api.ts
 * Authentication API calls with deterministic role normalization.
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
 * Normalize role names so frontend RBAC always receives valid values.
 *
 * Backend may return:
 * - role object
 * - role string
 * - roles array
 *
 * This function guarantees:
 * user.role → string
 * user.roles → Role[]
 */
function normalizeUser(user: User & { role?: Role | string }): User {
  let roleName: RoleName | null = null;

  // Extract role name
  if (typeof user.role === 'object' && user.role !== null) {
    roleName = user.role.name as RoleName;
  } else if (typeof user.role === 'string') {
    roleName = user.role as RoleName;
  } else if (user.roles?.length) {
    roleName = user.roles[0].name as RoleName;
  }

  // Normalize legacy 'parent' role name from backend → 'applicant'
  // Cast to string for comparison since 'parent' is not in the RoleName union
  if ((roleName as string) === 'parent') {
    roleName = 'applicant';
  }

  // Ensure roles array exists
  const roles: Role[] = roleName
    ? [{ id: user.roles?.[0]?.id ?? 0, name: roleName, display_name: roleName }]
    : [];

  return {
    ...user,
    role: roleName as RoleName,
    roles,
  };
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
  sessionStorage.removeItem('auth_token');
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

/** GET /api/user */
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