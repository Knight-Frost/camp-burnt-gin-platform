import { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';

interface PublicLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

/**
 * Public Layout
 *
 * Purpose: Layout shell for unauthenticated public pages
 *
 * FR Traceability:
 * - FR-33: Public marketing/information site
 * - FR-32: Mobile-responsive design
 *
 * Subsystem: User Management Subsystem (Section 5.2.4)
 *
 * Security: No authentication required
 * Accessibility: WCAG 2.1 AA compliant
 */
export function PublicLayout({ children, title, description }: PublicLayoutProps) {
  return (
    <>
      <Helmet>
        <title>{title ? `${title} | Camp Burnt Gin` : 'Camp Burnt Gin'}</title>
        {description && <meta name="description" content={description} />}
      </Helmet>

      <div className="min-h-screen bg-background">
        {children}
      </div>
    </>
  );
}
