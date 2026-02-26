/**
 * AuthLayout.tsx
 * Layout for unauthenticated auth flows.
 * Institutional gradient background with brand top bar. No navigation.
 */

import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(160deg, #f0f5fb 0%, #e4eef8 60%, #d8e8f5 100%)',
      }}
    >
      {/* Brand top bar */}
      <div className="w-full h-1.5 flex-shrink-0" style={{ background: '#1e3a6e' }} />

      {/* Centred content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:px-6">
        <Outlet />
      </div>

      {/* Bottom footer bar */}
      <div
        className="w-full py-3 text-center flex-shrink-0"
        style={{ borderTop: '1px solid #d1dce8' }}
      >
        <p className="text-xs" style={{ color: '#94a3b8' }}>
          Camp Burnt Gin — Secure Portal
        </p>
      </div>
    </div>
  );
}
