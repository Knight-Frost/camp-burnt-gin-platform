/**
 * mfa-enforcement.test.ts
 *
 * MFA enforcement source-structure regression tests.
 *
 * These tests verify that the MFA enrollment gate is wired at both the
 * backend middleware level and the frontend ProtectedRoute level.  They
 * catch regressions where:
 *   - The MFA check is accidentally removed from ProtectedRoute
 *   - The mfa_setup_required flag is dropped from the axios error handler
 *   - The auth:mfa-setup-required event dispatch is removed
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = resolve(__dirname, '..');

function read(relPath: string): string {
  return readFileSync(resolve(SRC, relPath), 'utf-8');
}

describe('ProtectedRoute — MFA step-up gate (enrollment is optional)', () => {
  // MFA enrollment is no longer enforced at the frontend routing layer.
  // The backend EnsureMfaEnrolled middleware is the sole enforcement point.
  // ProtectedRoute only handles the MFA step-up check (re-verify session),
  // not the enrollment gate (has the user ever set up MFA at all).
  const src = read('core/auth/ProtectedRoute.tsx');

  test('enforces MFA step-up: redirects when mfaRequired && !mfaVerified', () => {
    expect(src).toContain('mfaRequired');
    expect(src).toContain('mfaVerified');
  });

  test('redirects unauthenticated users to login', () => {
    expect(src).toContain('ROUTES.LOGIN');
  });

  test('redirects to MFA verify route when step-up is required', () => {
    expect(src).toContain('ROUTES.MFA_VERIFY');
  });

  test('does not gate on mfa_enabled — enrollment is optional at the frontend', () => {
    // Enrollment enforcement is the backend's responsibility (EnsureMfaEnrolled middleware).
    // The frontend only shows a security notice banner on the profile page.
    expect(src).not.toContain('mfa_enabled === false');
  });

  test('does not import getUserRole or getProfileRoute — enrollment gate removed', () => {
    expect(src).not.toContain('getUserRole');
    expect(src).not.toContain('getProfileRoute');
  });

  test('renders child routes via Outlet when all checks pass', () => {
    expect(src).toContain('<Outlet />');
  });

  test('guards email verification — redirects unverified users', () => {
    expect(src).toContain('email_verified_at');
  });
});

describe('axios interceptor — mfa_setup_required propagation', () => {
  const src = read('api/axios.config.ts');

  test('recognises mfa_setup_required in 403 response body', () => {
    expect(src).toContain('mfa_setup_required');
  });

  test('dispatches auth:mfa-setup-required event to the window', () => {
    expect(src).toContain("'auth:mfa-setup-required'");
  });

  test('rejects with mfaSetupRequired flag so callers can surface targeted message', () => {
    expect(src).toContain('mfaSetupRequired: true');
  });
});

describe('ProfilePage — MFA setup required banner', () => {
  const src = read('features/profile/pages/ProfilePage.tsx');

  test('reads mfaSetupRequired from router location state', () => {
    expect(src).toContain('mfaSetupRequired');
  });

  test('conditionally renders the MFA setup required warning banner', () => {
    expect(src).toContain('mfaSetupRequired &&');
  });

  test('imports useLocation for router state access', () => {
    expect(src).toContain('useLocation');
  });
});

describe('Backend middleware — EnsureMfaEnrolled wiring', () => {
  // Verify the middleware source exists and contains the expected patterns.
  // This is a build-time (source) check, not a runtime check — the integration
  // tests in MfaEnrollmentEnforcementTest.php cover the runtime behaviour.
  const middlewarePath = resolve(
    __dirname,
    '../../../backend/camp-burnt-gin-api/app/Http/Middleware/EnsureMfaEnrolled.php'
  );
  const src = readFileSync(middlewarePath, 'utf-8');

  test('blocks admin users without mfa_enabled', () => {
    expect(src).toContain('isAdmin()');
    expect(src).toContain('mfa_enabled');
  });

  test('blocks medical providers without mfa_enabled', () => {
    expect(src).toContain('isMedicalProvider()');
  });

  test('returns mfa_setup_required flag in response body', () => {
    expect(src).toContain("'mfa_setup_required'");
  });

  test('returns HTTP 403 Forbidden (not 401)', () => {
    expect(src).toContain('HTTP_FORBIDDEN');
  });
});
