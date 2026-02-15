import { createBrowserRouter, RouteObject } from 'react-router-dom';
import { lazy, Suspense, ReactNode } from 'react';
import { ProtectedRoute } from './ProtectedRoute';
import { SuperAdminLayout } from '@/ui/layout/SuperAdminLayout';
import { AdminLayout } from '@/ui/layout/AdminLayout';
import { ParentLayout } from '@/ui/layout/ParentLayout';
import { MedicalLayout } from '@/ui/layout/MedicalLayout';

// Landing page (lazy-loaded, code-split)
const LandingPage = lazy(() =>
  import('@/features/public/landing/pages/LandingPage').then((module) => ({
    default: module.LandingPage,
  }))
);

// Placeholder page components (to be implemented in later phases)
const LoginPage = () => <div>Login Page - Placeholder</div>;
const RegisterPage = () => <div>Register Page - Placeholder</div>;
const MfaVerifyPage = () => <div>MFA Verification Page - Placeholder</div>;
const ForbiddenPage = () => <div>403 Forbidden - You do not have permission to access this resource.</div>;
const NotFoundPage = () => <div>404 Not Found - The page you are looking for does not exist.</div>;

// Landing page loading skeleton
const LandingPageSkeleton = () => (
  <div className="flex h-screen items-center justify-center bg-white dark:bg-neutral-900">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
  </div>
);

/**
 * Route Helper: Wraps a page component with ProtectedRoute + Layout
 *
 * This ensures consistent route structure:
 * 1. Authentication check (ProtectedRoute)
 * 2. Role enforcement (Layout)
 * 3. Page content
 *
 * No redundant RoleGuard needed - layouts enforce role boundaries.
 */
function withLayout(
  Layout: React.ComponentType<{ children: ReactNode; title?: string }>,
  Page: ReactNode,
  title?: string
): ReactNode {
  return (
    <ProtectedRoute>
      <Layout title={title}>{Page}</Layout>
    </ProtectedRoute>
  );
}

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/',
    element: (
      <Suspense fallback={<LandingPageSkeleton />}>
        <LandingPage />
      </Suspense>
    ),
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/mfa-verify',
    element: <MfaVerifyPage />,
  },

  // Super Admin routes (super_admin only)
  {
    path: '/super-admin',
    element: withLayout(SuperAdminLayout, <div>Super Admin Dashboard - Placeholder</div>, 'Dashboard'),
  },
  {
    path: '/super-admin/users',
    element: withLayout(SuperAdminLayout, <div>User Management - Placeholder</div>, 'User Management'),
  },

  // Admin routes (super_admin + admin)
  {
    path: '/admin',
    element: withLayout(AdminLayout, <div>Admin Dashboard - Placeholder</div>, 'Dashboard'),
  },
  {
    path: '/admin/campers',
    element: withLayout(AdminLayout, <div>Camper Management - Placeholder</div>, 'Camper Management'),
  },

  // Parent routes (parent only)
  {
    path: '/parent',
    element: withLayout(ParentLayout, <div>Parent Dashboard - Placeholder</div>, 'Dashboard'),
  },
  {
    path: '/parent/applications',
    element: withLayout(ParentLayout, <div>Applications - Placeholder</div>, 'Applications'),
  },

  // Medical routes (medical only)
  {
    path: '/medical',
    element: withLayout(MedicalLayout, <div>Medical Dashboard - Placeholder</div>, 'Dashboard'),
  },
  {
    path: '/medical/records',
    element: withLayout(MedicalLayout, <div>Medical Records - Placeholder</div>, 'Medical Records'),
  },

  // Error routes
  {
    path: '/forbidden',
    element: <ForbiddenPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
] as RouteObject[]);
