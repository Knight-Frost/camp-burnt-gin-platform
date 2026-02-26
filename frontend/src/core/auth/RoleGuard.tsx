import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { RoleName } from '@/shared/constants/roles';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: RoleName[];
  fallback?: ReactNode;
  redirectTo?: string;
}

export function RoleGuard({
  children,
  allowedRoles,
  fallback,
  redirectTo = '/forbidden',
}: RoleGuardProps) {
  const user = useAppSelector((state) => state.auth.user);
  const roleName = user?.role ?? user?.roles?.[0]?.name;

  if (!user || !roleName) {
    return <Navigate to="/login" replace />;
  }

  // super_admin inherits admin permissions
  const effectiveRoles = roleName === 'super_admin' ? ['super_admin', 'admin'] : [roleName];

  const hasAccess = allowedRoles.some((role) =>
    effectiveRoles.includes(role as 'super_admin' | 'admin')
  );

  if (!hasAccess) {
    return fallback ? <>{fallback}</> : <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
