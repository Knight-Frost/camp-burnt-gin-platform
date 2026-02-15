import { ReactNode } from 'react';
import { usePermission } from './usePermission';
import { Permission } from './permissionMap';

interface AuthorityGuardProps {
  children: ReactNode;
  requires: Permission | Permission[];
  mode?: 'any' | 'all';
  fallback?: ReactNode;
}

export function AuthorityGuard({
  children,
  requires,
  mode = 'any',
  fallback = null,
}: AuthorityGuardProps) {
  const { hasAnyPermission, hasAllPermissions } = usePermission();

  const perms = Array.isArray(requires) ? requires : [requires];

  const hasAccess = mode === 'all' ? hasAllPermissions(perms) : hasAnyPermission(perms);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
