/**
 * roles.ts
 * Role name constants and helpers.
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  PARENT: 'parent',
  MEDICAL: 'medical',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<RoleName, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  parent: 'Parent',
  medical: 'Medical',
};

/** Roles that have admin-level access */
export const ADMIN_ROLES: RoleName[] = [ROLES.ADMIN, ROLES.SUPER_ADMIN];

/** Map a user's roles array to their primary role (highest privilege) */
export function getPrimaryRole(roles: { name: RoleName }[]): RoleName | null {
  const order: RoleName[] = [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.MEDICAL,
    ROLES.PARENT,
  ];
  for (const role of order) {
    if (roles.some((r) => r.name === role)) return role;
  }
  return null;
}

/** Get the default dashboard route for a role */
export function getDashboardRoute(role: RoleName | null): string {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return '/super-admin/dashboard';
    case ROLES.ADMIN:
      return '/admin/dashboard';
    case ROLES.MEDICAL:
      return '/medical/dashboard';
    case ROLES.PARENT:
      return '/parent/dashboard';
    default:
      return '/login';
  }
}

/** Get the profile route for a role */
export function getProfileRoute(role: RoleName | null): string {
  switch (role) {
    case ROLES.SUPER_ADMIN: return '/super-admin/profile';
    case ROLES.ADMIN:       return '/admin/profile';
    case ROLES.MEDICAL:     return '/medical/profile';
    case ROLES.PARENT:      return '/parent/profile';
    default:                return '/login';
  }
}
