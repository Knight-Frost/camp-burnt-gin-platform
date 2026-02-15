export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  PARENT: 'parent',
  MEDICAL: 'medical',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
