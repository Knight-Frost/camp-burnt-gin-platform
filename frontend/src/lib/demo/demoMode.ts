/**
 * demoMode.ts — Demo Mode configuration
 *
 * When VITE_DEMO_MODE=true, the app bypasses login entirely and injects a mock
 * admin user into the Redux auth store. This allows external tools (Stitch, etc.)
 * to access and analyse the full UI without authentication.
 *
 * ACTIVATION:
 *   vite --mode demo       (uses .env.demo)
 *   VITE_DEMO_MODE=true    (inline env override)
 *
 * REVERTING:
 *   Remove VITE_DEMO_MODE or set it to anything other than 'true'.
 *   All demo mode branches are behind this single flag — no other code is affected.
 *
 * HIPAA NOTE:
 *   The mock user contains NO real PHI. It is a synthetic admin identity used
 *   only to satisfy the frontend auth state shape. No real data is exposed.
 */

import type { User } from '@/shared/types';

/**
 * True when the app is running in demo mode.
 * Evaluated at build time — tree-shaken away in non-demo builds.
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

/**
 * Synthetic admin user injected into Redux state in demo mode.
 * This is NOT a real user. No backend account exists for this identity.
 */
export const DEMO_USER: User = {
  id: 9999,
  name: 'Demo Admin',
  preferred_name: 'Demo',
  email: 'demo@campburntgin.dev',
  email_verified_at: '2026-01-01T00:00:00.000Z',
  phone: null,
  avatar_path: null,
  avatar_url: null,
  address_line_1: null,
  address_line_2: null,
  city: null,
  state: null,
  postal_code: null,
  country: null,
  mfa_enabled: false,
  role: 'admin',
  roles: [{ id: 2, name: 'admin', display_name: 'Administrator' }],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};
