import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { FullPageLoader } from '@/ui/components';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, mfaRequired, mfaVerified } = useAppSelector((state) => state.auth);
  const location = useLocation();

  // Show loader during auth hydration to prevent false redirects
  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (mfaRequired && !mfaVerified) {
    return <Navigate to="/mfa-verify" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
