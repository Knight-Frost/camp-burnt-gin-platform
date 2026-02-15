import { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { FullPageLoader } from '@/ui/components';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

/**
 * Admin Layout
 *
 * Role-based layout for admin and super_admin users.
 * Enforces admin/super_admin role access control.
 * Note: super_admin inherits admin permissions (hierarchy: super_admin > admin)
 */
export function AdminLayout({ children, title }: AdminLayoutProps) {
  const { user, isLoading } = useAppSelector((state) => state.auth);

  // Show loader during auth hydration to prevent false redirects
  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!user || (user.role.name !== 'admin' && user.role.name !== 'super_admin')) {
    return <Navigate to="/forbidden" replace />;
  }

  return (
    <>
      <Helmet>
        <title>{title ? `${title} | Camp Burnt Gin Admin` : 'Camp Burnt Gin Admin'}</title>
      </Helmet>

      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        {/* Admin-specific navigation will go here */}
        <main className="mx-auto max-w-7xl px-4 py-8">
          {children}
        </main>
      </div>
    </>
  );
}
