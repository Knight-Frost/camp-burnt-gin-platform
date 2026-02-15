import { useAppSelector } from '@/store/hooks';
import { ROLE_PERMISSIONS, Permission } from './permissionMap';
import { RoleName } from '@/shared/constants/roles';

export function usePermission() {
  const user = useAppSelector((state) => state.auth.user);
  const roleName = user?.role?.name;

  const permissions = roleName && roleName in ROLE_PERMISSIONS
    ? ROLE_PERMISSIONS[roleName as RoleName]
    : [];

  const hasPermission = (permission: Permission): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (perms: Permission[]): boolean => {
    return perms.some((p) => permissions.includes(p));
  };

  const hasAllPermissions = (perms: Permission[]): boolean => {
    return perms.every((p) => permissions.includes(p));
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}
