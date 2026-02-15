import { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { FullPageLoader } from '@/ui/components';

interface MedicalLayoutProps {
  children: ReactNode;
  title?: string;
}

/**
 * Medical Layout
 *
 * Role-based layout for medical provider users.
 * Enforces medical role access control.
 * Read-only access to medical records.
 */
export function MedicalLayout({ children, title }: MedicalLayoutProps) {
  const { user, isLoading } = useAppSelector((state) => state.auth);

  // Show loader during auth hydration to prevent false redirects
  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!user || user.role.name !== 'medical') {
    return <Navigate to="/forbidden" replace />;
  }

  return (
    <>
      <Helmet>
        <title>{title ? `${title} | Camp Burnt Gin Medical` : 'Camp Burnt Gin Medical'}</title>
      </Helmet>

      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        {/* Medical provider navigation will go here */}
        <main className="mx-auto max-w-7xl px-4 py-8">
          {children}
        </main>
      </div>
    </>
  );
}
