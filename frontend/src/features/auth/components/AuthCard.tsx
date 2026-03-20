/**
 * AuthCard.tsx
 * Clean institutional card container for all authentication pages.
 * White card, generous spacing, readable font sizes.
 */

import type { ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  /** Amber accent bar rendered beneath the title (register page) */
  accentBar?: boolean;
  children: ReactNode;
  /** Footer links rendered inside the card below a divider */
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export function AuthCard({
  title,
  subtitle,
  accentBar,
  children,
  footer,
  maxWidth = 'md',
}: AuthCardProps) {
  return (
    <div className={`w-full ${maxWidthMap[maxWidth]}`}>
      <div
        className="bg-white rounded-2xl border px-10 py-10"
        style={{
          borderColor: '#d1dce8',
          boxShadow: '0 4px 32px rgba(30,58,110,0.10)',
        }}
      >
        {/* Card header */}
        <div className="mb-8">
          <h1
            className="font-bold leading-tight"
            style={{ fontSize: '2rem', color: '#166534' }}
          >
            {title}
          </h1>
          {accentBar && (
            <div
              className="w-16 rounded-full mt-2.5 mb-4"
              style={{ height: '3px', background: '#f59e0b' }}
            />
          )}
          {subtitle && (
            <p
              className="leading-relaxed mt-2"
              style={{ fontSize: '1rem', color: '#6b7280' }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* Page-specific content */}
        {children}

        {/* Footer links — inside card with divider */}
        {footer && (
          <div className="mt-7">
            <hr style={{ borderColor: '#e2e8f0' }} />
            <div
              className="mt-5 text-center"
              style={{ fontSize: '0.9375rem', color: '#6b7280' }}
            >
              {footer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
