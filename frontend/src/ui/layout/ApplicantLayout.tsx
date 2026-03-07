/**
 * ApplicantLayout.tsx
 * Layout for applicant-role authenticated routes.
 * Role mismatch → redirects to the user's correct dashboard (never FORBIDDEN dead-end).
 */

import { Outlet, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  MessageSquare,
  User,
  Settings,
  CalendarDays,
  Megaphone,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store/hooks';
import { DashboardShell } from './DashboardShell';
import { ROUTES } from '@/shared/constants/routes';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';
import type { NavItem } from './DashboardSidebar';

export function ApplicantLayout() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  // Check normalized roles array first; fall back to flat role string (mirrors AdminLayout pattern)
  const isApplicant = Boolean(
    user?.roles?.some((r) => r.name === 'applicant') ||
    user?.role === 'applicant'
  );

  if (!isApplicant) {
    // Redirect to the user's actual dashboard instead of a dead-end Forbidden page
    const role = getPrimaryRole(user?.roles ?? []);
    return <Navigate to={getDashboardRoute(role)} replace />;
  }

  const navItems: NavItem[] = [
    { group: t('portal_nav.group_my_portal'),     label: t('portal_nav.dashboard'),     to: ROUTES.PARENT_DASHBOARD,     icon: LayoutDashboard },
    { group: t('portal_nav.group_my_portal'),     label: t('portal_nav.applications'),  to: ROUTES.PARENT_APPLICATIONS,  icon: FileText },
    { group: t('portal_nav.group_my_portal'),     label: t('portal_nav.documents'),     to: ROUTES.PARENT_DOCUMENTS,     icon: FolderOpen },
    { group: t('portal_nav.group_communication'), label: t('portal_nav.inbox'),         to: '/applicant/inbox',          icon: MessageSquare },
    { group: t('portal_nav.group_communication'), label: t('portal_nav.announcements'), to: ROUTES.PARENT_ANNOUNCEMENTS, icon: Megaphone },
    { group: t('portal_nav.group_operations'),    label: t('portal_nav.calendar'),      to: ROUTES.PARENT_CALENDAR,      icon: CalendarDays },
    { group: t('portal_nav.group_account'),       label: t('portal_nav.profile'),       to: '/applicant/profile',        icon: User },
    { group: t('portal_nav.group_account'),       label: t('portal_nav.settings'),      to: '/applicant/settings',       icon: Settings },
  ];

  return (
    <DashboardShell navItems={navItems} pageTitle={t('portal_nav.dashboard')}>
      <Outlet />
    </DashboardShell>
  );
}
