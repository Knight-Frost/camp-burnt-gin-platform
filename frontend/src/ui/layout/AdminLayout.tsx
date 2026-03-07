/**
 * AdminLayout.tsx
 * Layout for admin and super_admin role authenticated routes.
 * Role mismatch → redirects to the user's correct dashboard (never FORBIDDEN dead-end).
 */

import { Outlet, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  CalendarDays,
  BarChart3,
  MessageSquare,
  Settings,
  Megaphone,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store/hooks';
import { DashboardShell } from './DashboardShell';
import { ROUTES } from '@/shared/constants/routes';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';
import type { NavItem } from './DashboardSidebar';

export function AdminLayout() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  // Check roles array (normalized) OR flat role string (fallback for stale state)
  const hasAccess = Boolean(
    user?.roles?.some((r) => ['admin', 'super_admin'].includes(r.name)) ||
    ['admin', 'super_admin'].includes(user?.role ?? '')
  );

  if (!hasAccess) {
    // Redirect to the user's actual dashboard instead of a dead-end Forbidden page
    const role = getPrimaryRole(user?.roles ?? []);
    return <Navigate to={getDashboardRoute(role)} replace />;
  }

  const navItems: NavItem[] = [
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.dashboard'),      to: ROUTES.ADMIN_DASHBOARD,      icon: LayoutDashboard },
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.applications'),   to: ROUTES.ADMIN_APPLICATIONS,   icon: FileText },
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.campers'),        to: ROUTES.ADMIN_CAMPERS,        icon: Users },
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.sessions_camps'), to: ROUTES.ADMIN_SESSIONS,       icon: CalendarDays },
    { group: t('portal_nav.group_communication'), label: t('portal_nav.inbox'),          to: '/admin/inbox',              icon: MessageSquare },
    { group: t('portal_nav.group_communication'), label: t('portal_nav.announcements'),  to: ROUTES.ADMIN_ANNOUNCEMENTS,  icon: Megaphone },
    { group: t('portal_nav.group_operations'),    label: t('portal_nav.calendar'),       to: ROUTES.ADMIN_CALENDAR,       icon: CalendarDays },
    { group: t('portal_nav.group_operations'),    label: t('portal_nav.reports'),        to: ROUTES.ADMIN_REPORTS,        icon: BarChart3 },
    { group: t('portal_nav.group_system'),        label: t('portal_nav.settings'),       to: '/admin/settings',           icon: Settings },
  ];

  return (
    <DashboardShell navItems={navItems} pageTitle={t('portal_nav.dashboard')}>
      <Outlet />
    </DashboardShell>
  );
}
