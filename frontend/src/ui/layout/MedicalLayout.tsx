/**
 * MedicalLayout.tsx
 *
 * Route layout wrapper for the medical portal (/medical/*).
 *
 * Phase 18 updates:
 *  - Renamed nav items for clarity (Phase 4)
 *  - Added Risk Management nav item (Phase 2)
 *  - Wraps children in MedicalSessionProvider for session-aware data (Phase 3)
 *  - Session indicator rendered in portal header area via provider
 */

import { Outlet, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  User,
  Settings,
  Inbox,
  Megaphone,
  AlertOctagon,
  ClipboardCheck,
  Stethoscope,
  BookOpen,
  BookMarked,
  ShieldAlert,
  Pill,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store/hooks';
import { DashboardShell } from './DashboardShell';
import { ROUTES } from '@/shared/constants/routes';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';
import type { NavItem } from './DashboardSidebar';
import { MedicalSessionProvider } from '@/features/medical/context/MedicalSessionContext';
import { MedicalSessionIndicator } from '@/features/medical/components/MedicalSessionIndicator';
import { useUnreadMessageCount } from '@/ui/context/MessagingCountContext';

export function MedicalLayout() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const { unreadSystemCount } = useUnreadMessageCount();

  const hasAccess = Boolean(
    user?.roles?.some((r) => ['medical', 'admin', 'super_admin'].includes(r.name)) ||
    ['medical', 'admin', 'super_admin'].includes(user?.role ?? '')
  );

  if (!hasAccess) {
    const role = getPrimaryRole(user?.roles ?? []);
    return <Navigate to={getDashboardRoute(role)} replace />;
  }

  // Phase 4: Renamed pages for operational clarity.
  // Phase 2: Risk Management added as a distinct nav section.
  const navItems: NavItem[] = [
    { label: t('portal_nav.dashboard'),              to: ROUTES.MEDICAL_DASHBOARD,        icon: LayoutDashboard },
    { label: t('medical.directory.nav_label'),       to: ROUTES.MEDICAL_DIRECTORY,        icon: BookMarked },
    { label: t('portal_nav.medical_records'),        to: ROUTES.MEDICAL_RECORD_TREATMENT, icon: BookOpen },

    // Clinical activity — renamed for operational clarity
    { label: t('portal_nav.incident_reporting'),     to: ROUTES.MEDICAL_INCIDENTS,        icon: AlertOctagon },
    { label: t('portal_nav.health_visits'),          to: ROUTES.MEDICAL_VISITS,           icon: Stethoscope },
    { label: t('portal_nav.treatments'),             to: '/medical/treatments',           icon: Pill },
    { label: t('portal_nav.follow_up_tasks'),        to: ROUTES.MEDICAL_FOLLOW_UPS,       icon: ClipboardCheck },

    // Risk management — configurable scoring (Phase 18)
    { label: t('portal_nav.risk_management'),        to: '/medical/risk-management',      icon: ShieldAlert },

    // Communication
    { label: t('portal_nav.announcements'),          to: ROUTES.MEDICAL_ANNOUNCEMENTS,   icon: Megaphone },
    { label: t('portal_nav.inbox'),                  to: '/medical/inbox',                icon: Inbox, dot: unreadSystemCount > 0 },

    // Account
    { label: t('portal_nav.profile'),               to: '/medical/profile',              icon: User },
    { label: t('portal_nav.settings'),              to: '/medical/settings',             icon: Settings },
  ];

  const sessionBar = (
    <div
      className="flex items-center justify-between px-6 py-2 border-b flex-shrink-0 lg:px-8"
      style={{ background: 'var(--glass-light, #fafafa)', borderColor: 'var(--border)' }}
    >
      <MedicalSessionIndicator />
    </div>
  );

  return (
    <MedicalSessionProvider>
      <DashboardShell navItems={navItems} pageTitle={t('medical.dashboard.title')} subHeader={sessionBar}>
        <Outlet />
      </DashboardShell>
    </MedicalSessionProvider>
  );
}
