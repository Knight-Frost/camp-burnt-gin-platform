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
 * 4. MFA not enrolled?     → Admin/medical/super_admin users who have mfa_enabled=false are
 *                            redirected to their portal profile page to set up MFA before
 *                            accessing any protected resource. Only fires when mfa_enabled is
 *                            explicitly false (not undefined/null — those mean "unknown").
 * 5. Email unverified?     → Redirect to /verify-email pending screen.
 * 6. All clear             → Render the matched child route via <Outlet />.
 *
 * <Outlet /> is a React Router concept — it renders whatever child route matched the URL.
 */

import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { ROUTES } from '@/shared/constants/routes';
import { FullPageLoader } from '@/ui/components/FullPageLoader';

/** Roles that must have MFA enrolled before accessing any protected page. */
const MFA_REQUIRED_ROLES = ['admin', 'super_admin', 'medical'] as const;

/** Returns the portal-specific profile path for a given role name. */
function getProfileRouteForRole(roleName: string): string {
  if (roleName === 'super_admin') return '/super-admin/profile';
  if (roleName === 'medical')     return '/medical/profile';
  if (roleName === 'admin')       return '/admin/profile';
  return ROUTES.PROFILE;
}

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
  // state.from lets LoginPage redirect back after a successful login
  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // Check 3: Account requires MFA step-up but user hasn't completed it yet
  if (mfaRequired && !mfaVerified) {
    return <Navigate to={ROUTES.MFA_VERIFY} replace />;
  }

  // Check 4: MFA enrollment gate for privileged roles.
  // admin/super_admin/medical users must have MFA enrolled before accessing the app.
  // Only redirect when mfa_enabled is explicitly false — undefined/null means the user
  // record hasn't loaded fully yet, so we let it through rather than flashing a redirect.
  if (user && user.mfa_enabled === false) {
    const primaryRole = user.role ?? user.roles?.[0]?.name ?? '';
    const requiresMfa = (MFA_REQUIRED_ROLES as readonly string[]).includes(primaryRole);
    if (requiresMfa) {
      const profileRoute = getProfileRouteForRole(primaryRole);
      // Don't redirect if they're already on their profile page — avoids a redirect loop
      if (location.pathname !== profileRoute) {
        return (
          <Navigate
            to={profileRoute}
            state={{ mfaSetupRequired: true }}
            replace
          />
        );
      }
    }
  }

  // Check 5: Email not yet verified — all protected API routes require a verified email.
  // Redirect to the pending-verification screen rather than letting dashboard calls fail.
  if (user && !user.email_verified_at) {
    return <Navigate to="/verify-email?pending=true" replace />;
  }

  // All checks passed — render the nested child route
  return <Outlet />;
}
