/**
 * SuperAdminDashboardPage.tsx
 *
 * System-level overview for super admins.
 * Route: /super-admin
 */

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Users, Shield, FileText, Activity, ArrowRight } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { pageEntry, staggerContainer, staggerChild, cardHover } from '@/shared/constants/motion';

const QUICK_LINKS = [
  { to: '/super-admin/users',   icon: Users,    labelKey: 'superadmin.nav.users',     color: 'var(--ember-orange)',   bg: 'rgba(22,101,52,0.1)' },
  { to: '/admin/applications',  icon: FileText, labelKey: 'superadmin.nav.apps',      color: 'var(--night-sky-blue)', bg: 'rgba(96,165,250,0.1)' },
  { to: '/admin/campers',       icon: Users,    labelKey: 'superadmin.nav.campers',   color: 'var(--forest-green)',   bg: 'rgba(5,150,105,0.1)' },
  { to: '/super-admin/audit',   icon: Activity, labelKey: 'superadmin.nav.audit',     color: 'var(--ember-orange)',     bg: 'rgba(22,101,52,0.1)' },
];

export function SuperAdminDashboardPage() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);

  return (
    <motion.div variants={pageEntry} initial="hidden" animate="visible" className="p-6 max-w-5xl">
      {/* Greeting */}
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: 'var(--accent-label)' }}>
          {t('superadmin.dashboard.eyebrow')}
        </p>
        <h1 className="font-headline text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('superadmin.dashboard.greeting', { name: user?.name?.split(' ')[0] ?? 'Admin' })}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {t('superadmin.dashboard.subtitle')}
        </p>
      </div>

      {/* Quick links */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {QUICK_LINKS.map(({ to, icon: Icon, labelKey, color, bg }) => (
          <motion.div key={to} variants={staggerChild} whileHover={cardHover}>
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
                <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: bg }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <ArrowRight
                  className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color }}
                />
              </div>
              <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                {t(labelKey)}
              </p>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* Security notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
        className="rounded-xl border p-5 flex items-start gap-4"
        style={{
          background: 'rgba(22,101,52,0.06)',
          borderColor: 'rgba(22,101,52,0.15)',
        }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(22,101,52,0.12)' }}
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
      </motion.div>
    </motion.div>
  );
}
