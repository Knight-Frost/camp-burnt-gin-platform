export interface Role {
  id: number;
  name: 'super_admin' | 'admin' | 'parent' | 'medical';
}

export interface User {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
  mfa_enabled: boolean;
  mfa_verified_at: string | null;
  created_at: string;
  updated_at: string;
  role: Role;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface MFASetupResponse {
  secret: string;
  qr_code: string;
}
