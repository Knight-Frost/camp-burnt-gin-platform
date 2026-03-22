/**
 * SuperAdminDashboardPage.tsx
 *
 * Purpose: System-level home screen for super admins.
 * Responsibilities:
 *   - Greet the super admin by first name (from Redux auth state)
 *   - Render a grid of quick-link cards to the four main super-admin sections
 *   - Show a HIPAA/compliance security notice at the bottom
 *
 * Plain-English: This is the command center for the most powerful user role.
 * It's intentionally simple — just shortcuts to the tools they use most and
 * a reminder that they're handling sensitive data.
 *
 * Route: /super-admin
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Users, Shield, FileText, Activity, ArrowRight } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { BackgroundSlideshow } from '@/ui/components/BackgroundSlideshow';
import { PersonalGreeting } from '@/ui/components/PersonalGreeting';

// Static list of quick-link cards — no API call needed, just navigation shortcuts
const QUICK_LINKS = [
  { to: '/super-admin/users',         icon: Users,    labelKey: 'superadmin.nav.users',     color: 'var(--ember-orange)',   bg: 'rgba(22,163,74,0.1)' },
  { to: '/super-admin/applications',  icon: FileText, labelKey: 'superadmin.nav.apps',      color: 'var(--night-sky-blue)', bg: 'rgba(96,165,250,0.1)' },
  { to: '/super-admin/campers',       icon: Users,    labelKey: 'superadmin.nav.campers',   color: 'var(--forest-green)',   bg: 'rgba(5,150,105,0.1)' },
  { to: '/super-admin/audit',         icon: Activity, labelKey: 'superadmin.nav.audit',     color: 'var(--ember-orange)',   bg: 'rgba(22,163,74,0.1)' },
];

export function SuperAdminDashboardPage() {
  const { t } = useTranslation();
  // Pull the user's name from Redux — no API call needed since it was stored at login
  const user = useAppSelector((state) => state.auth.user);

  return (
    <div className="p-6 max-w-5xl">
      {/* ── Liquid glass hero ────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl mb-8" style={{ minHeight: '200px' }}>
        <BackgroundSlideshow />
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.30) 100%)' }}
        />
        <div className="relative z-10 p-6 flex items-end" style={{ minHeight: '200px' }}>
          <PersonalGreeting user={user} role="super_admin" />
        </div>
      </div>

      {/* Quick-link card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {QUICK_LINKS.map(({ to, icon: Icon, labelKey, color, bg }) => (
          <div key={to}>
            <Link
              to={to}
              className="flex flex-col gap-3 rounded-xl border p-5 transition-all group"
              style={{
                background: 'var(--glass-medium)',
                borderColor: 'var(--border)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div className="flex items-center justify-between">
                {/* Color-coded icon badge matching the section's brand color */}
                <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: bg }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                {/* Arrow only appears on hover via group-hover — subtle affordance */}
                <ArrowRight
                  className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color }}
                />
              </div>
              <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                {t(labelKey)}
              </p>
            </Link>
          </div>
        ))}
      </div>

      {/* HIPAA / compliance security notice */}
      <div
        className="rounded-xl border p-5 flex items-start gap-4"
        style={{
          background: 'rgba(22,163,74,0.06)',
          borderColor: 'rgba(22,163,74,0.15)',
        }}
      >
        {/* Shield icon reinforces the security/compliance theme */}
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(22,163,74,0.12)' }}
        >
          <Shield className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {t('superadmin.dashboard.hipaa_notice_title')}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('superadmin.dashboard.hipaa_notice_body')}
          </p>
        </div>
      </div>
    </div>
  );
}
