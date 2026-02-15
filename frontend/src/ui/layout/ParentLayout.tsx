import { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { FullPageLoader } from '@/ui/components';

interface ParentLayoutProps {
  children: ReactNode;
  title?: string;
}

/**
 * Parent Layout
 *
 * Role-based layout for parent users.
 * Enforces parent role access control.
 */
export function ParentLayout({ children, title }: ParentLayoutProps) {
  const { user, isLoading } = useAppSelector((state) => state.auth);

  // Show loader during auth hydration to prevent false redirects
  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!user || user.role.name !== 'parent') {
    return <Navigate to="/forbidden" replace />;
  }

  return (
    <>
      <Helmet>
        <title>{title ? `${title} | Camp Burnt Gin` : 'Camp Burnt Gin'}</title>
      </Helmet>

      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        {/* Parent-specific navigation will go here */}
        <main className="mx-auto max-w-7xl px-4 py-8">
          {children}
        </main>
      </div>
    </>
  );
}
