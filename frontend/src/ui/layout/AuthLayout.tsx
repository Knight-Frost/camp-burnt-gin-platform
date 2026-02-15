import { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
}

/**
 * Authentication Layout
 *
 * Purpose: Layout shell for authentication pages (login, register, MFA)
 *
 * FR Traceability:
 * - FR-1: User registration
 * - FR-2: User login with MFA support
 * - FR-3: Password reset
 * - FR-32: Mobile-responsive forms
 *
 * Subsystem: User Management Subsystem (Section 5.2.4)
 *
 * Security: Pre-authentication state, no sensitive data exposure
 * Session: 60-minute timeout (HIPAA compliance)
 */
export function AuthLayout({ children, title }: AuthLayoutProps) {
  return (
    <>
      <Helmet>
        <title>{title ? `${title} | Camp Burnt Gin` : 'Camp Burnt Gin'}</title>
      </Helmet>

      <div className="flex min-h-screen items-center justify-center bg-neutral-900 px-4 py-12">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </>
  );
}
