/**
 * roles.ts
 * Role name constants and helpers.
 */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  APPLICANT: 'applicant',
  MEDICAL: 'medical',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<RoleName, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  applicant: 'Applicant',
  medical: 'Medical',
};

/** Roles that have admin-level access */
export const ADMIN_ROLES: RoleName[] = [
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
];

/**
 * Determine a user's primary role.
 * Always returns the highest privilege role if one exists.
 */
export function getPrimaryRole(
  roles?: { name: RoleName }[]
): RoleName | null {

  if (!roles || roles.length === 0) {
    return null;
  }

  const priority: RoleName[] = [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.MEDICAL,
    ROLES.APPLICANT,
  ];

  for (const role of priority) {
    if (roles.some((r) => r.name === role)) {
      return role;
    }
  }

  return null;
}

/**
 * Get dashboard route for role
 */
export function getDashboardRoute(role: RoleName | null): string {

  if (!role) {
    return '/login';
  }

  const routes: Record<RoleName, string> = {
    super_admin: '/super-admin/dashboard',
    admin: '/admin/dashboard',
    medical: '/medical/dashboard',
    applicant: '/applicant/dashboard',
  };

  return routes[role];
}

/**
 * Get profile route for role
 */
export function getProfileRoute(role: RoleName | null): string {

  if (!role) {
    return '/login';
  }

  const routes: Record<RoleName, string> = {
    super_admin: '/super-admin/profile',
    admin: '/admin/profile',
    medical: '/medical/profile',
    applicant: '/applicant/profile',
  };

  return routes[role];
}