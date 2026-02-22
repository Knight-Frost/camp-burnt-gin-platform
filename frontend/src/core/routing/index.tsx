import { createBrowserRouter, RouteObject } from 'react-router-dom';
import { lazy, Suspense, ReactNode } from 'react';
import { ProtectedRoute } from './ProtectedRoute';
import { SuperAdminLayout } from '@/ui/layout/SuperAdminLayout';
import { AdminLayout } from '@/ui/layout/AdminLayout';
import { ParentLayout } from '@/ui/layout/ParentLayout';
import { MedicalLayout } from '@/ui/layout/MedicalLayout';
import { PublicLayout } from '@/app/layouts/PublicLayout';

// Public pages (lazy-loaded, code-split)
const LandingPage = lazy(() =>
  import('@/features/public/landing/pages/LandingPage').then((module) => ({
    default: module.LandingPage,
  }))
);
const AboutPage = lazy(() =>
  import('@/app/pages/AboutPage').then((module) => ({
    default: module.AboutPage,
  }))
);
const ProgramsPage = lazy(() =>
  import('@/app/pages/ProgramsPage').then((module) => ({
    default: module.ProgramsPage,
  }))
);
const CampersPage = lazy(() =>
  import('@/app/pages/CampersPage').then((module) => ({
    default: module.CampersPage,
  }))
);
const ApplyPage = lazy(() =>
  import('@/app/pages/ApplyPage').then((module) => ({
    default: module.ApplyPage,
  }))
);
const StoriesPage = lazy(() =>
  import('@/app/pages/StoriesPage').then((module) => ({
    default: module.StoriesPage,
  }))
);
const GetInvolvedPage = lazy(() =>
  import('@/app/pages/GetInvolvedPage').then((module) => ({
    default: module.GetInvolvedPage,
  }))
);
const CbgNMePage = lazy(() =>
  import('@/app/pages/CbgNMePage').then((module) => ({
    default: module.CbgNMePage,
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
  // Public routes — all share the PublicLayout (LivingBackground + Nav + Footer)
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/',
        element: (
          <Suspense fallback={<LandingPageSkeleton />}>
            <LandingPage />
          </Suspense>
        ),
      },
      {
        path: '/about',
        element: (
          <Suspense fallback={<LandingPageSkeleton />}>
            <AboutPage />
          </Suspense>
        ),
      },
      {
        path: '/programs',
        element: (
          <Suspense fallback={<LandingPageSkeleton />}>
            <ProgramsPage />
          </Suspense>
        ),
      },
      {
        path: '/campers',
        element: (
          <Suspense fallback={<LandingPageSkeleton />}>
            <CampersPage />
          </Suspense>
        ),
      },
      {
        path: '/apply',
        element: (
          <Suspense fallback={<LandingPageSkeleton />}>
            <ApplyPage />
          </Suspense>
        ),
      },
      {
        path: '/testimonials',
        element: (
          <Suspense fallback={<LandingPageSkeleton />}>
            <StoriesPage />
          </Suspense>
        ),
      },
      {
        path: '/get-involved',
        element: (
          <Suspense fallback={<LandingPageSkeleton />}>
            <GetInvolvedPage />
          </Suspense>
        ),
      },
      {
        path: '/virtual-program',
        element: (
          <Suspense fallback={<LandingPageSkeleton />}>
            <CbgNMePage />
          </Suspense>
        ),
      },
    ],
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
