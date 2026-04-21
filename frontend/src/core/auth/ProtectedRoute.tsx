/**
 * ProtectedRoute.tsx — Authentication gate for all private pages
 *
 * This component wraps every portal route tree. It acts like a security checkpoint —
 * users must pass all checks before they can see the page content.
 *
 * Check order (fail = redirect immediately, don't evaluate further):
 * 1. Still loading?        → Show a full-page spinner (auth is being hydrated from sessionStorage).
 * 2. Not logged in?        → Redirect to /login, preserving where the user was trying to go
 *                            so they can be sent there after a successful login.
 * 3. MFA incomplete?       → Redirect to /mfa-verify so the user completes two-factor auth.
 * 4. Email unverified?     → Redirect to /verify-email pending screen.
 * 5. All clear             → Render the matched child route via <Outlet />.
 *
 * Note: MFA enrollment is optional. Users with mfa_enabled=false see a security notice
 * banner on their profile page but are not blocked from navigating the portal.
 *
 * <Outlet /> is a React Router concept — it renders whatever child route matched the URL.
 */

import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { ROUTES } from '@/shared/constants/routes';
import { FullPageLoader } from '@/ui/components/FullPageLoader';


export function ProtectedRoute() {
  // Read auth state from Redux — this is the single source of truth for login status
  const { isAuthenticated, isLoading, mfaRequired, mfaVerified, user } =
    useAppSelector((state) => state.auth);
  // useLocation tells us which URL the user is currently trying to visit
  const location = useLocation();

  // Check 1: Auth hydration is still in progress — show spinner and wait
  if (isLoading) {
    return <FullPageLoader />;
  }

  // Check 2: No valid session — redirect to login and remember the intended destination
  // state.from lets LoginPage redirect back after a successful login.
  // Include location.search so query params (e.g. ?conversationId=1) survive the round-trip.
  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  }

  // Check 3: Account requires MFA step-up but user hasn't completed it yet
  if (mfaRequired && !mfaVerified) {
    return <Navigate to={ROUTES.MFA_VERIFY} replace />;
  }

  // Check 4: (MFA enrollment enforcement removed — MFA is optional. The profile page
  // shows a security notice banner when mfa_enabled is false, but users are free to
  // navigate the portal without enrolling.)

  // Check 5: Email not yet verified — all protected API routes require a verified email.
  // Redirect to the pending-verification screen rather than letting dashboard calls fail.
  if (user && !user.email_verified_at) {
    return <Navigate to="/verify-email?pending=true" replace />;
  }

  // All checks passed — render the nested child route
  return <Outlet />;
}
