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

  // Applicant (parent/guardian portal)
  PARENT_DASHBOARD: '/applicant/dashboard',
  PARENT_APPLICATIONS: '/applicant/applications',
  PARENT_APPLICATION_NEW: '/applicant/applications/new',
  PARENT_APPLICATION_DETAIL: (id: number | string) =>
    `/applicant/applications/${id}`,
  PARENT_DOCUMENTS: '/applicant/documents',
  PARENT_CALENDAR: '/applicant/calendar',
  PARENT_ANNOUNCEMENTS: '/applicant/announcements',

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
  MEDICAL_TREATMENT_LOGS: '/medical/treatments',
  MEDICAL_ANNOUNCEMENTS: '/medical/announcements',
  MEDICAL_RECORD_TREATMENTS: (id: number | string) => `/medical/records/${id}/treatments`,
  MEDICAL_RECORD_DOCUMENTS: (id: number | string) => `/medical/records/${id}/documents`,

  // Super Admin
  SUPER_ADMIN_DASHBOARD: '/super-admin/dashboard',
  SUPER_ADMIN_USERS: '/super-admin/users',
  SUPER_ADMIN_AUDIT: '/super-admin/audit',
  SUPER_ADMIN_FORMS: '/super-admin/forms',

  // Shared authenticated
  INBOX: '/inbox',
  PROFILE: '/profile',

  // Errors
  FORBIDDEN: '/forbidden',
  NOT_FOUND: '*',
} as const;
