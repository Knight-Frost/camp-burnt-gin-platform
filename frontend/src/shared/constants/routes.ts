export const ROUTES = {
  // Public
  LANDING: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  MEDICAL_PROVIDER_LINK: '/medical-link/:token',

  // Auth flows
  MFA_SETUP: '/mfa/setup',
  MFA_VERIFY: '/mfa/verify',

  // Universal authenticated
  DASHBOARD: '/dashboard',
  INBOX: '/inbox',
  NOTIFICATIONS: '/notifications',
  SETTINGS: '/settings',

  // Parent
  CAMPERS: '/campers',
  CAMPERS_NEW: '/campers/new',
  CAMPERS_DETAIL: '/campers/:id',
  APPLICATIONS: '/applications',
  APPLICATIONS_NEW: '/applications/new',
  APPLICATIONS_DETAIL: '/applications/:id',
  MEDICAL: '/medical/:camperId',
  DOCUMENTS: '/documents',

  // Admin
  ADMIN_DASHBOARD: '/admin',
  ADMIN_CAMPS: '/admin/camps',
  ADMIN_SESSIONS: '/admin/sessions',
  ADMIN_REVIEW: '/admin/review',
  ADMIN_REPORTS: '/admin/reports',

  // Super Admin
  SUPER_ADMIN_DASHBOARD: '/super-admin',
  SUPER_ADMIN_USERS: '/super-admin/users',
  SUPER_ADMIN_ROLES: '/super-admin/roles',
  SUPER_ADMIN_AUDIT: '/super-admin/audit-logs',
  SUPER_ADMIN_SECURITY: '/super-admin/security',
  SUPER_ADMIN_CONFIG: '/super-admin/config',

  // Error pages
  FORBIDDEN: '/forbidden',
  NOT_FOUND: '/404',
} as const;
