/**
 * index.tsx — Core routing
 *
 * Portal-only architecture. Entry point: /login.
 * / redirects to /login. No public marketing pages.
 * Every page is React.lazy() wrapped via withSuspense().
 * Protected routes use ProtectedRoute + role-specific layout via nested routes.
 * /role/dashboard aliases each portal root for cleaner URLs post-login.
 */

import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { PageSkeleton } from '@/app/components/PageSkeleton';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';

import { AuthLayout }       from '@/app/layouts/AuthLayout';
import { AdminLayout }      from '@/ui/layout/AdminLayout';
import { SuperAdminLayout } from '@/ui/layout/SuperAdminLayout';
import { ParentLayout }     from '@/ui/layout/ParentLayout';
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

// ─── Parent pages ─────────────────────────────────────────────────────────────
const ParentDashboardPage    = withSuspense(lazy(() => import('@/features/parent/pages/ParentDashboardPage').then(m => ({ default: m.ParentDashboardPage }))));
const ParentApplicationsPage = withSuspense(lazy(() => import('@/features/parent/pages/ParentApplicationsPage').then(m => ({ default: m.ParentApplicationsPage }))));
const ApplicationFormPage    = withSuspense(lazy(() => import('@/features/parent/pages/ApplicationFormPage').then(m => ({ default: m.ApplicationFormPage }))));
const ParentCalendarPage     = withSuspense(lazy(() => import('@/features/parent/pages/ParentCalendarPage').then(m => ({ default: m.ParentCalendarPage }))));

// ─── Admin pages ──────────────────────────────────────────────────────────────
const AdminDashboardPage      = withSuspense(lazy(() => import('@/features/admin/pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage }))));
const AdminApplicationsPage   = withSuspense(lazy(() => import('@/features/admin/pages/AdminApplicationsPage').then(m => ({ default: m.AdminApplicationsPage }))));
const ApplicationReviewPage   = withSuspense(lazy(() => import('@/features/admin/pages/ApplicationReviewPage').then(m => ({ default: m.ApplicationReviewPage }))));
const AdminCampersPage        = withSuspense(lazy(() => import('@/features/admin/pages/AdminCampersPage').then(m => ({ default: m.AdminCampersPage }))));
const AdminSessionsPage       = withSuspense(lazy(() => import('@/features/admin/pages/AdminSessionsPage').then(m => ({ default: m.AdminSessionsPage }))));
const AdminReportsPage        = withSuspense(lazy(() => import('@/features/admin/pages/AdminReportsPage').then(m => ({ default: m.AdminReportsPage }))));
const AdminAnnouncementsPage  = withSuspense(lazy(() => import('@/features/admin/pages/AdminAnnouncementsPage').then(m => ({ default: m.AdminAnnouncementsPage }))));
const AdminCalendarPage       = withSuspense(lazy(() => import('@/features/admin/pages/AdminCalendarPage').then(m => ({ default: m.AdminCalendarPage }))));

// ─── Medical pages ────────────────────────────────────────────────────────────
const MedicalDashboardPage = withSuspense(lazy(() => import('@/features/medical/pages/MedicalDashboardPage').then(m => ({ default: m.MedicalDashboardPage }))));
const MedicalRecordPage    = withSuspense(lazy(() => import('@/features/medical/pages/MedicalRecordPage').then(m => ({ default: m.MedicalRecordPage }))));

// ─── Super admin pages ────────────────────────────────────────────────────────
const SuperAdminDashboardPage = withSuspense(lazy(() => import('@/features/superadmin/pages/SuperAdminDashboardPage').then(m => ({ default: m.SuperAdminDashboardPage }))));
const UserManagementPage      = withSuspense(lazy(() => import('@/features/superadmin/pages/UserManagementPage').then(m => ({ default: m.UserManagementPage }))));
const AuditLogPage            = withSuspense(lazy(() => import('@/features/superadmin/pages/AuditLogPage').then(m => ({ default: m.AuditLogPage }))));
const FormManagementPage      = withSuspense(lazy(() => import('@/features/superadmin/pages/FormManagementPage').then(m => ({ default: m.FormManagementPage }))));

// ─── Shared pages ─────────────────────────────────────────────────────────────
const InboxPage    = withSuspense(lazy(() => import('@/features/messaging/pages/InboxPage').then(m => ({ default: m.InboxPage }))));
const ProfilePage  = withSuspense(lazy(() => import('@/features/profile/pages/ProfilePage').then(m => ({ default: m.ProfilePage }))));
const SettingsPage = withSuspense(lazy(() => import('@/features/profile/pages/SettingsPage').then(m => ({ default: m.SettingsPage }))));

// ─── Standalone pages ─────────────────────────────────────────────────────────
const ProviderAccessPage = withSuspense(lazy(() => import('@/features/provider/pages/ProviderAccessPage').then(m => ({ default: m.ProviderAccessPage }))));

export const router = createBrowserRouter([

  // Root → login redirect
  { path: '/', element: <Navigate to="/login" replace /> },

  // Provider access — standalone, no layout
  { path: '/provider-access/:token', element: <ProviderAccessPage /> },

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
    ],
  },

  // ─── Parent portal ─────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [{
      element: <ParentLayout />,
      children: [
        { path: '/parent',                    element: <Navigate to="/parent/dashboard" replace /> },
        { path: '/parent/dashboard',          element: <ParentDashboardPage /> },
        { path: '/parent/applications',       element: <ParentApplicationsPage /> },
        { path: '/parent/applications/new',   element: <ApplicationFormPage /> },
        { path: '/parent/calendar',           element: <ParentCalendarPage /> },
        { path: '/parent/inbox',              element: <InboxPage /> },
        { path: '/parent/profile',            element: <ProfilePage /> },
        { path: '/parent/settings',           element: <SettingsPage /> },
      ],
    }],
  },

  // ─── Admin portal ──────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [{
      element: <AdminLayout />,
      children: [
        { path: '/admin',                     element: <Navigate to="/admin/dashboard" replace /> },
        { path: '/admin/dashboard',           element: <AdminDashboardPage /> },
        { path: '/admin/applications',        element: <AdminApplicationsPage /> },
        { path: '/admin/applications/:id',    element: <ApplicationReviewPage /> },
        { path: '/admin/campers',             element: <AdminCampersPage /> },
        { path: '/admin/sessions',            element: <AdminSessionsPage /> },
        { path: '/admin/reports',             element: <AdminReportsPage /> },
        { path: '/admin/announcements',       element: <AdminAnnouncementsPage /> },
        { path: '/admin/calendar',            element: <AdminCalendarPage /> },
        { path: '/admin/inbox',               element: <InboxPage /> },
        { path: '/admin/profile',             element: <ProfilePage /> },
        { path: '/admin/settings',            element: <SettingsPage /> },
      ],
    }],
  },

  // ─── Medical portal ────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [{
      element: <MedicalLayout />,
      children: [
        { path: '/medical',                   element: <Navigate to="/medical/dashboard" replace /> },
        { path: '/medical/dashboard',         element: <MedicalDashboardPage /> },
        { path: '/medical/records/:camperId', element: <MedicalRecordPage /> },
        { path: '/medical/profile',           element: <ProfilePage /> },
        { path: '/medical/settings',          element: <SettingsPage /> },
      ],
    }],
  },

  // ─── Super admin portal ────────────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
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
        { path: '/super-admin/sessions',             element: <AdminSessionsPage /> },
        { path: '/super-admin/reports',              element: <AdminReportsPage /> },
        { path: '/super-admin/announcements',        element: <AdminAnnouncementsPage /> },
        { path: '/super-admin/calendar',             element: <AdminCalendarPage /> },
        { path: '/super-admin/inbox',                element: <InboxPage /> },
        { path: '/super-admin/profile',              element: <ProfilePage /> },
        { path: '/super-admin/settings',             element: <SettingsPage /> },
      ],
    }],
  },
]);
