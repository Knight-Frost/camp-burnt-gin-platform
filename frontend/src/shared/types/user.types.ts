/**
 * user.types.ts
 * Core user, role, and authentication type definitions.
 * Mirrors the Laravel backend's User model and Sanctum auth responses.
 */

// ---------------------------------------------------------------------------
// Role definitions
// ---------------------------------------------------------------------------

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  PARENT: 'applicant',
  MEDICAL: 'medical',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export interface Role {
  id: number;
  name: RoleName;
  display_name: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
  mfa_enabled: boolean;
  roles: Role[];
  /** Convenience: primary role name string (first role, or derived from roles array) */
  role?: string;
  created_at: string;
  updated_at: string;
}

/** Get the primary role name from a User object */
export function getUserRole(user: User): RoleName | undefined {
  if (user.role) return user.role as RoleName;
  return user.roles?.[0]?.name;
}

// ---------------------------------------------------------------------------
// Auth responses
// ---------------------------------------------------------------------------

export interface AuthResponse {
  message: string;
  data: {
    user: User;
    token: string;
    token_type: 'Bearer';
    expires_in?: number;
    mfa_required?: boolean;
  };
}

export interface MFASetupResponse {
  message: string;
  data: {
    secret: string;
    qr_code: string; // base64 data URI
  };
}

export interface MFAVerifyResponse {
  message: string;
  data: {
    verified: boolean;
  };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export interface ProfilePrefill {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}
