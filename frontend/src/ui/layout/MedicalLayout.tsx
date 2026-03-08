/**
 * MedicalLayout.tsx
 * Layout for medical-role authenticated routes.
 * Role mismatch → redirects to the user's correct dashboard (never FORBIDDEN dead-end).
 */

import { Outlet, Navigate } from 'react-router-dom';
import { LayoutDashboard, User, Settings, Inbox, ClipboardList, Megaphone, AlertOctagon, ClipboardCheck, Stethoscope, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store/hooks';
import { DashboardShell } from './DashboardShell';
import { ROUTES } from '@/shared/constants/routes';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';
import type { NavItem } from './DashboardSidebar';

export function MedicalLayout() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const hasAccess = Boolean(
    user?.roles?.some((r) => ['medical', 'admin', 'super_admin'].includes(r.name)) ||
    ['medical', 'admin', 'super_admin'].includes(user?.role ?? '')
  );

  if (!hasAccess) {
    // Redirect to the user's actual dashboard instead of a dead-end Forbidden page
    const role = getPrimaryRole(user?.roles ?? []);
    return <Navigate to={getDashboardRoute(role)} replace />;
  }

  const navItems: NavItem[] = [
    { label: t('portal_nav.dashboard'),      to: ROUTES.MEDICAL_DASHBOARD,    icon: LayoutDashboard },
    { label: t('portal_nav.treatment_logs'),    to: '/medical/treatments',        icon: ClipboardList },
    { label: t('portal_nav.medical_records'),  to: ROUTES.MEDICAL_RECORD_TREATMENT, icon: BookOpen },
    { label: t('portal_nav.incidents'),      to: ROUTES.MEDICAL_INCIDENTS,     icon: AlertOctagon },
    { label: t('portal_nav.follow_ups'),     to: ROUTES.MEDICAL_FOLLOW_UPS,    icon: ClipboardCheck },
    { label: t('portal_nav.visits'),         to: ROUTES.MEDICAL_VISITS,        icon: Stethoscope },
    { label: t('portal_nav.announcements'),  to: ROUTES.MEDICAL_ANNOUNCEMENTS, icon: Megaphone },
    { label: t('portal_nav.inbox'),          to: '/medical/inbox',             icon: Inbox },
    { label: t('portal_nav.profile'),        to: '/medical/profile',           icon: User },
    { label: t('portal_nav.settings'),       to: '/medical/settings',          icon: Settings },
  ];

  return (
    <DashboardShell navItems={navItems} pageTitle={t('medical.dashboard.title')}>
      <Outlet />
    </DashboardShell>
  );
}
