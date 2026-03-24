/**
 * AuthLayout.tsx
 * Layout for unauthenticated auth flows.
 * Institutional gradient background with brand top bar. No navigation.
 *
 * Redirects already-authenticated users to their dashboard so login/register
 * pages are never visible to a logged-in session.
 */

import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';

export function AuthLayout() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const isLoading      = useAppSelector((s) => s.auth.isLoading);
  const user           = useAppSelector((s) => s.auth.user);
  const location       = useLocation();

  // Once auth is resolved and the user is authenticated, redirect to their
  // dashboard. This handles both:
  //  • a fresh login (dispatches from LoginPage trigger this re-render), and
  //  • visiting /login while already holding a valid session.
  // The `from` state is passed through so ProtectedRoute can send the user to
  // the page they originally tried to reach.
  //
  // Only redirect to the dashboard if the user is fully authenticated AND
  // their email is verified. Unverified users need to stay on auth pages
  // (verify-email, login) — redirecting them away creates an infinite loop
  // with ProtectedRoute, which sends unverified users back to /verify-email.
  const emailVerified = Boolean(user?.email_verified_at);

  if (!isLoading && isAuthenticated && user && emailVerified) {
    const role = getPrimaryRole(user.roles ?? []);
    // Guard: if role is unresolved, don't redirect — avoids infinite loop when
    // getDashboardRoute(null) returns '/login' while isAuthenticated is true.
    if (role !== null) {
      const intended     = (location.state as { from?: string } | null)?.from;
      const dashboard    = getDashboardRoute(role);
      const portalPrefix = '/' + dashboard.split('/')[1];
      const dest = intended && intended.startsWith(portalPrefix) ? intended : dashboard;
      return <Navigate to={dest} replace />;
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(160deg, #f0f5fb 0%, #e4eef8 60%, #d8e8f5 100%)',
      }}
    >
      {/* Brand top bar */}
      <div className="w-full h-1.5 flex-shrink-0" style={{ background: '#166534' }} />

      {/* Centred content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:px-6">
        <Outlet />
      </div>

      {/* Bottom footer bar */}
      <div
        className="w-full py-3 text-center flex-shrink-0"
        style={{ borderTop: '1px solid #d1dce8' }}
      >
        <p className="text-xs" style={{ color: '#94a3b8' }}>
          Camp Burnt Gin — Secure Portal
        </p>
      </div>
    </div>
  );
}
