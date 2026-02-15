import { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { FullPageLoader } from '@/ui/components';

interface SuperAdminLayoutProps {
  children: ReactNode;
  title?: string;
}

/**
 * Super Admin Layout
 *
 * Role-based layout for super_admin users ONLY.
 * Enforces super_admin role access control.
 * Highest privilege tier - system governance and delegation.
 */
export function SuperAdminLayout({ children, title }: SuperAdminLayoutProps) {
  const { user, isLoading } = useAppSelector((state) => state.auth);

  // Show loader during auth hydration to prevent false redirects
  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!user || user.role.name !== 'super_admin') {
    return <Navigate to="/forbidden" replace />;
  }

  return (
    <>
      <Helmet>
        <title>{title ? `${title} | Camp Burnt Gin Super Admin` : 'Camp Burnt Gin Super Admin'}</title>
      </Helmet>

      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        {/* Super admin navigation will go here */}
        <main className="mx-auto max-w-7xl px-4 py-8">
          {children}
        </main>
      </div>
    </>
  );
}
