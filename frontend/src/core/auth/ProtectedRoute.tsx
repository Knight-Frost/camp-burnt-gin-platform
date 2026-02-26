/**
 * ProtectedRoute.tsx
 * Guards all authenticated routes.
 *
 * Logic:
 * 1. Show FullPageLoader while auth is hydrating (isLoading = true)
 * 2. Redirect to /login if not authenticated (preserves intended destination)
 * 3. Redirect to /mfa-verify if MFA is required but not yet verified
 * 4. Render children if all checks pass
 */

import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { ROUTES } from '@/shared/constants/routes';
import { FullPageLoader } from '@/ui/components/FullPageLoader';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, mfaRequired, mfaVerified } =
    useAppSelector((state) => state.auth);
  const location = useLocation();

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  if (mfaRequired && !mfaVerified) {
    return <Navigate to={ROUTES.MFA_VERIFY} replace />;
  }

  return <Outlet />;
}
