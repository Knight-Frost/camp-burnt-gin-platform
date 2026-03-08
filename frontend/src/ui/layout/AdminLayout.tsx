/**
 * AdminLayout.tsx
 *
 * Purpose: Route layout wrapper for the admin portal (/admin/*).
 * Responsibilities:
 *   - Guards the route: verifies the logged-in user has the `admin` or
 *     `super_admin` role. If they don't, redirects them to their own dashboard
 *     instead of showing a dead-end Forbidden page.
 *   - Builds the nav item list for this portal and passes it to DashboardShell.
 *   - Renders <Outlet /> so React Router can inject the matched child page.
 *
 * Why check both `roles` array and flat `role` string?
 *   The Redux auth state may have been set by older code that stored a flat
 *   `role` string. Checking both prevents a logged-in admin from being
 *   accidentally redirected out due to stale state shape.
 */

import { Outlet, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  FolderOpen,
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

  // Accept both normalized roles array and legacy flat role string.
  const hasAccess = Boolean(
    user?.roles?.some((r) => ['admin', 'super_admin'].includes(r.name)) ||
    ['admin', 'super_admin'].includes(user?.role ?? '')
  );

  if (!hasAccess) {
    // Redirect to the user's actual dashboard instead of a dead-end Forbidden page.
    const role = getPrimaryRole(user?.roles ?? []);
    return <Navigate to={getDashboardRoute(role)} replace />;
  }

  // Nav items are defined here (inside the component) so they are translated
  // on every render, picking up any language change from i18next immediately.
  const navItems: NavItem[] = [
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.dashboard'),      to: ROUTES.ADMIN_DASHBOARD,      icon: LayoutDashboard },
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.applications'),   to: ROUTES.ADMIN_APPLICATIONS,   icon: FileText },
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.campers'),        to: ROUTES.ADMIN_CAMPERS,        icon: Users },
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.sessions_camps'), to: ROUTES.ADMIN_SESSIONS,       icon: CalendarDays },
    { group: t('portal_nav.group_communication'), label: t('portal_nav.inbox'),          to: '/admin/inbox',              icon: MessageSquare },
    { group: t('portal_nav.group_communication'), label: t('portal_nav.announcements'),  to: ROUTES.ADMIN_ANNOUNCEMENTS,  icon: Megaphone },
    // 'Documents' has no i18n key yet — kept as a string literal until the key is added.
    { group: t('portal_nav.group_communication'), label: 'Documents',                   to: ROUTES.ADMIN_DOCUMENTS,      icon: FolderOpen },
    { group: t('portal_nav.group_operations'),    label: t('portal_nav.calendar'),       to: ROUTES.ADMIN_CALENDAR,       icon: CalendarDays },
    { group: t('portal_nav.group_operations'),    label: t('portal_nav.reports'),        to: ROUTES.ADMIN_REPORTS,        icon: BarChart3 },
    { group: t('portal_nav.group_system'),        label: t('portal_nav.settings'),       to: '/admin/settings',           icon: Settings },
  ];

  return (
    // DashboardShell handles the sidebar + header layout; Outlet renders the matched child page.
    <DashboardShell navItems={navItems} pageTitle={t('portal_nav.dashboard')}>
      <Outlet />
    </DashboardShell>
  );
}
