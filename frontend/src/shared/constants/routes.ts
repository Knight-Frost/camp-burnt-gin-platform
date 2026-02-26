/**
 * routes.ts
 * All application route paths as typed constants.
 * Import from here instead of hardcoding path strings.
 */
export const ROUTES = {
  // Public
  HOME: '/',
  ABOUT: '/about',
  PROGRAMS: '/programs',
  CAMPERS: '/campers',
  APPLY: '/apply',
  STORIES: '/testimonials',
  GET_INVOLVED: '/get-involved',
  VIRTUAL_PROGRAM: '/virtual-program',

  // Auth
  LOGIN: '/login',
  REGISTER: '/register',
  MFA_VERIFY: '/mfa-verify',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // Parent
  PARENT_DASHBOARD: '/parent/dashboard',
  PARENT_APPLICATIONS: '/parent/applications',
  PARENT_APPLICATION_NEW: '/parent/applications/new',
  PARENT_APPLICATION_DETAIL: (id: number | string) =>
    `/parent/applications/${id}`,
  PARENT_CALENDAR: '/parent/calendar',

  // Admin
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_CAMPERS: '/admin/campers',
  ADMIN_CAMPER_DETAIL: (id: number | string) => `/admin/campers/${id}`,
  ADMIN_APPLICATIONS: '/admin/applications',
  ADMIN_APPLICATION_DETAIL: (id: number | string) =>
    `/admin/applications/${id}`,
  ADMIN_SESSIONS: '/admin/sessions',
  ADMIN_CAMPS: '/admin/camps',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_ANNOUNCEMENTS: '/admin/announcements',
  ADMIN_CALENDAR: '/admin/calendar',

  // Medical
  MEDICAL_DASHBOARD: '/medical/dashboard',
  MEDICAL_RECORDS: '/medical/records',
  MEDICAL_RECORD_DETAIL: (id: number | string) => `/medical/records/${id}`,

  // Super Admin
  SUPER_ADMIN_DASHBOARD: '/super-admin/dashboard',
  SUPER_ADMIN_USERS: '/super-admin/users',
  SUPER_ADMIN_AUDIT: '/super-admin/audit',
  SUPER_ADMIN_FORMS: '/super-admin/forms',

  // Shared authenticated
  INBOX: '/inbox',
  PROFILE: '/profile',

  // Provider access (standalone — no auth)
  PROVIDER_ACCESS: (token: string) => `/provider-access/${token}`,

  // Errors
  FORBIDDEN: '/forbidden',
  NOT_FOUND: '*',
} as const;
