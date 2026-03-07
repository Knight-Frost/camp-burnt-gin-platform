/**
 * index.tsx — Core routing
 *
 * Portal-only architecture. Entry point: /login.
 * / redirects to /login. No public marketing pages.
 * Every page is React.lazy() wrapped via withSuspense().
 * Protected routes use ProtectedRoute + RoleGuard + role-specific layout.
 * /role/dashboard aliases each portal root for cleaner URLs post-login.
 */

import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';

import { PageSkeleton } from '@/app/components/PageSkeleton';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import { RoleGuard } from '@/core/auth/RoleGuard';
import { ROLES } from '@/shared/constants/roles';

import { AuthLayout }       from '@/app/layouts/AuthLayout';
import { AdminLayout }      from '@/ui/layout/AdminLayout';
import { SuperAdminLayout } from '@/ui/layout/SuperAdminLayout';
import { ApplicantLayout }  from '@/ui/layout/ApplicantLayout';
import { MedicalLayout }    from '@/ui/layout/MedicalLayout';

function withSuspense<T extends object>(Component: ComponentType<T>) {
  return function SuspenseWrapped(props: T) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Component {...props} />
      </Suspense>
    );
  };
}

// ─── Utility pages ────────────────────────────────────────────────────────────
const NotFoundPage  = withSuspense(lazy(() => import('@/app/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage }))));
const ForbiddenPage = withSuspense(lazy(() => import('@/app/pages/ForbiddenPage').then(m => ({ default: m.ForbiddenPage }))));

// ─── Auth pages ───────────────────────────────────────────────────────────────
const LoginPage          = withSuspense(lazy(() => import('@/app/pages/LoginPage').then(m => ({ default: m.LoginPage }))));
const RegisterPage       = withSuspense(lazy(() => import('@/app/pages/RegisterPage').then(m => ({ default: m.RegisterPage }))));
const MfaVerifyPage      = withSuspense(lazy(() => import('@/app/pages/MfaVerifyPage').then(m => ({ default: m.MfaVerifyPage }))));
const ForgotPasswordPage = withSuspense(lazy(() => import('@/app/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage }))));
const ResetPasswordPage  = withSuspense(lazy(() => import('@/app/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage }))));
const VerifyEmailPage    = withSuspense(lazy(() => import('@/app/pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage }))));

// ─── Applicant pages ──────────────────────────────────────────────────────────
const ApplicantDocumentsPage       = withSuspense(lazy(() => import('@/features/parent/pages/ApplicantDocumentsPage').then(m => ({ default: m.ApplicantDocumentsPage }))));
const ApplicantDashboardPage       = withSuspense(lazy(() => import('@/features/parent/pages/ApplicantDashboardPage').then(m => ({ default: m.ApplicantDashboardPage }))));
const ApplicantApplicationsPage    = withSuspense(lazy(() => import('@/features/parent/pages/ApplicantApplicationsPage').then(m => ({ default: m.ApplicantApplicationsPage }))));
const ApplicationFormPage          = withSuspense(lazy(() => import('@/features/parent/pages/ApplicationFormPage').then(m => ({ default: m.ApplicationFormPage }))));
const ApplicantApplicationDetailPage = withSuspense(lazy(() => import('@/features/parent/pages/ApplicantApplicationDetailPage').then(m => ({ default: m.ApplicantApplicationDetailPage }))));
const ParentCalendarPage           = withSuspense(lazy(() => import('@/features/parent/pages/ParentCalendarPage').then(m => ({ default: m.ParentCalendarPage }))));
const ParentAnnouncementsPage      = withSuspense(lazy(() => import('@/features/parent/pages/ParentAnnouncementsPage').then(m => ({ default: m.ParentAnnouncementsPage }))));

// ─── Admin pages ──────────────────────────────────────────────────────────────
const AdminDashboardPage      = withSuspense(lazy(() => import('@/features/admin/pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage }))));
const AdminApplicationsPage   = withSuspense(lazy(() => import('@/features/admin/pages/AdminApplicationsPage').then(m => ({ default: m.AdminApplicationsPage }))));
const ApplicationReviewPage   = withSuspense(lazy(() => import('@/features/admin/pages/ApplicationReviewPage').then(m => ({ default: m.ApplicationReviewPage }))));
const AdminCampersPage        = withSuspense(lazy(() => import('@/features/admin/pages/AdminCampersPage').then(m => ({ default: m.AdminCampersPage }))));
const CamperDetailPage        = withSuspense(lazy(() => import('@/features/admin/pages/CamperDetailPage').then(m => ({ default: m.CamperDetailPage }))));
const AdminSessionsPage       = withSuspense(lazy(() => import('@/features/admin/pages/AdminSessionsPage').then(m => ({ default: m.AdminSessionsPage }))));
const AdminReportsPage        = withSuspense(lazy(() => import('@/features/admin/pages/AdminReportsPage').then(m => ({ default: m.AdminReportsPage }))));
const AdminAnnouncementsPage  = withSuspense(lazy(() => import('@/features/admin/pages/AdminAnnouncementsPage').then(m => ({ default: m.AdminAnnouncementsPage }))));
const AdminCalendarPage       = withSuspense(lazy(() => import('@/features/admin/pages/AdminCalendarPage').then(m => ({ default: m.AdminCalendarPage }))));

// ─── Medical pages ────────────────────────────────────────────────────────────
const MedicalDashboardPage     = withSuspense(lazy(() => import('@/features/medical/pages/MedicalDashboardPage').then(m => ({ default: m.MedicalDashboardPage }))));
const MedicalRecordPage        = withSuspense(lazy(() => import('@/features/medical/pages/MedicalRecordPage').then(m => ({ default: m.MedicalRecordPage }))));
const MedicalTreatmentLogPage  = withSuspense(lazy(() => import('@/features/medical/pages/MedicalTreatmentLogPage').then(m => ({ default: m.MedicalTreatmentLogPage }))));
const MedicalDocumentsPage     = withSuspense(lazy(() => import('@/features/medical/pages/MedicalDocumentsPage').then(m => ({ default: m.MedicalDocumentsPage }))));
const MedicalIncidentsPage     = withSuspense(lazy(() => import('@/features/medical/pages/MedicalIncidentsPage').then(m => ({ default: m.MedicalIncidentsPage }))));
const MedicalFollowUpsPage     = withSuspense(lazy(() => import('@/features/medical/pages/MedicalFollowUpsPage').then(m => ({ default: m.MedicalFollowUpsPage }))));
const MedicalVisitsPage        = withSuspense(lazy(() => import('@/features/medical/pages/MedicalVisitsPage').then(m => ({ default: m.MedicalVisitsPage }))));
const MedicalEmergencyViewPage = withSuspense(lazy(() => import('@/features/medical/pages/MedicalEmergencyViewPage').then(m => ({ default: m.MedicalEmergencyViewPage }))));

// ─── Super admin pages ────────────────────────────────────────────────────────
const SuperAdminDashboardPage = withSuspense(lazy(() => import('@/features/superadmin/pages/SuperAdminDashboardPage').then(m => ({ default: m.SuperAdminDashboardPage }))));
const UserManagementPage      = withSuspense(lazy(() => import('@/features/superadmin/pages/UserManagementPage').then(m => ({ default: m.UserManagementPage }))));
const AuditLogPage            = withSuspense(lazy(() => import('@/features/superadmin/pages/AuditLogPage').then(m => ({ default: m.AuditLogPage }))));
const FormManagementPage      = withSuspense(lazy(() => import('@/features/superadmin/pages/FormManagementPage').then(m => ({ default: m.FormManagementPage }))));

// ─── Shared pages ─────────────────────────────────────────────────────────────
const InboxPage    = withSuspense(lazy(() => import('@/features/messaging/pages/InboxPage').then(m => ({ default: m.InboxPage }))));
const ProfilePage  = withSuspense(lazy(() => import('@/features/profile/pages/ProfilePage').then(m => ({ default: m.ProfilePage }))));
const SettingsPage = withSuspense(lazy(() => import('@/features/profile/pages/SettingsPage').then(m => ({ default: m.SettingsPage }))));

export const router = createBrowserRouter([

  // Root → login redirect
  { path: '/', element: <Navigate to="/login" replace /> },

  // Utility pages — standalone
  { path: '/forbidden', element: <ForbiddenPage /> },
  { path: '*',          element: <NotFoundPage /> },

  // ─── Auth routes (unauthenticated) ─────────────────────────────────────────
  {
    element: <AuthLayout />,
    children: [
      { path: '/login',            element: <LoginPage /> },
      { path: '/register',         element: <RegisterPage /> },
      { path: '/mfa-verify',       element: <MfaVerifyPage /> },
      { path: '/forgot-password',  element: <ForgotPasswordPage /> },
      { path: '/reset-password',   element: <ResetPasswordPage /> },
      { path: '/verify-email',     element: <VerifyEmailPage /> },
    ],
  },

  // ─── Applicant portal ──────────────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [{
      element: <RoleGuard allowedRoles={[ROLES.APPLICANT]}><Outlet /></RoleGuard>,
      children: [{
        element: <ApplicantLayout />,
        children: [
          { path: '/applicant',                     element: <Navigate to="/applicant/dashboard" replace /> },
          { path: '/applicant/dashboard',           element: <ApplicantDashboardPage /> },
          { path: '/applicant/applications',        element: <ApplicantApplicationsPage /> },
          { path: '/applicant/applications/new',    element: <ApplicationFormPage /> },
          { path: '/applicant/applications/:id',    element: <ApplicantApplicationDetailPage /> },
          { path: '/applicant/documents',           element: <ApplicantDocumentsPage /> },
          { path: '/applicant/announcements',       element: <ParentAnnouncementsPage /> },
          { path: '/applicant/calendar',            element: <ParentCalendarPage /> },
          { path: '/applicant/inbox',               element: <InboxPage /> },
          { path: '/applicant/profile',             element: <ProfilePage /> },
          { path: '/applicant/settings',            element: <SettingsPage /> },
        ],
      }],
    }],
  },

  // ─── Admin portal ──────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [{
      element: <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.SUPER_ADMIN]}><Outlet /></RoleGuard>,
      children: [{
        element: <AdminLayout />,
        children: [
          { path: '/admin',                     element: <Navigate to="/admin/dashboard" replace /> },
          { path: '/admin/dashboard',           element: <AdminDashboardPage /> },
          { path: '/admin/applications',        element: <AdminApplicationsPage /> },
          { path: '/admin/applications/:id',    element: <ApplicationReviewPage /> },
          { path: '/admin/campers',             element: <AdminCampersPage /> },
          { path: '/admin/campers/:id',         element: <CamperDetailPage /> },
          { path: '/admin/sessions',            element: <AdminSessionsPage /> },
          { path: '/admin/reports',             element: <AdminReportsPage /> },
          { path: '/admin/announcements',       element: <AdminAnnouncementsPage /> },
          { path: '/admin/calendar',            element: <AdminCalendarPage /> },
          { path: '/admin/inbox',               element: <InboxPage /> },
          { path: '/admin/profile',             element: <ProfilePage /> },
          { path: '/admin/settings',            element: <SettingsPage /> },
        ],
      }],
    }],
  },

  // ─── Medical portal ────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [{
      element: <RoleGuard allowedRoles={[ROLES.MEDICAL]}><Outlet /></RoleGuard>,
      children: [{
        element: <MedicalLayout />,
        children: [
          { path: '/medical',                                      element: <Navigate to="/medical/dashboard" replace /> },
          { path: '/medical/dashboard',                          element: <MedicalDashboardPage /> },
          { path: '/medical/records/:camperId',                  element: <MedicalRecordPage /> },
          { path: '/medical/records/:camperId/treatments',       element: <MedicalTreatmentLogPage /> },
          { path: '/medical/records/:camperId/documents',        element: <MedicalDocumentsPage /> },
          { path: '/medical/treatments',                         element: <MedicalTreatmentLogPage /> },
          { path: '/medical/incidents',                          element: <MedicalIncidentsPage /> },
          { path: '/medical/follow-ups',                         element: <MedicalFollowUpsPage /> },
          { path: '/medical/visits',                             element: <MedicalVisitsPage /> },
          { path: '/medical/records/:camperId/incidents',        element: <MedicalIncidentsPage /> },
          { path: '/medical/records/:camperId/visits',           element: <MedicalVisitsPage /> },
          { path: '/medical/records/:camperId/emergency',        element: <MedicalEmergencyViewPage /> },
          { path: '/medical/announcements',                      element: <ParentAnnouncementsPage /> },
          { path: '/medical/inbox',                              element: <InboxPage /> },
          { path: '/medical/profile',                            element: <ProfilePage /> },
          { path: '/medical/settings',                           element: <SettingsPage /> },
        ],
      }],
    }],
  },

  // ─── Super admin portal ────────────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [{
      element: <RoleGuard allowedRoles={[ROLES.SUPER_ADMIN]}><Outlet /></RoleGuard>,
      children: [{
        element: <SuperAdminLayout />,
        children: [
          { path: '/super-admin',                      element: <Navigate to="/super-admin/dashboard" replace /> },
          { path: '/super-admin/dashboard',            element: <SuperAdminDashboardPage /> },
          { path: '/super-admin/users',                element: <UserManagementPage /> },
          { path: '/super-admin/audit',                element: <AuditLogPage /> },
          { path: '/super-admin/forms',                element: <FormManagementPage /> },
          { path: '/super-admin/applications',         element: <AdminApplicationsPage /> },
          { path: '/super-admin/applications/:id',     element: <ApplicationReviewPage /> },
          { path: '/super-admin/campers',              element: <AdminCampersPage /> },
          { path: '/super-admin/campers/:id',          element: <CamperDetailPage /> },
          { path: '/super-admin/sessions',             element: <AdminSessionsPage /> },
          { path: '/super-admin/reports',              element: <AdminReportsPage /> },
          { path: '/super-admin/announcements',        element: <AdminAnnouncementsPage /> },
          { path: '/super-admin/calendar',             element: <AdminCalendarPage /> },
          { path: '/super-admin/inbox',                element: <InboxPage /> },
          { path: '/super-admin/profile',              element: <ProfilePage /> },
          { path: '/super-admin/settings',             element: <SettingsPage /> },
        ],
      }],
    }],
  },
]);
