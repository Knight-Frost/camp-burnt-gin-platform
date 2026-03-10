/**
 * SuperAdminLayout.tsx
 *
 * Purpose: Route layout wrapper for the super_admin portal (/super-admin/*).
 * Responsibilities:
 *   - Guards the route: verifies the logged-in user has the `super_admin` role.
 *     If they don't, redirects them to their own dashboard.
 *   - Builds TWO nav item arrays:
 *       1. navItems   — main scrollable nav (same sections as AdminLayout plus more).
 *       2. systemNavItems — pinned at the very bottom of the sidebar so User
 *          Management, Audit Log, Form Templates, and Settings are always visible.
 *   - Renders <Outlet /> so React Router can inject the matched child page.
 *
 * Why pinned bottom items?
 *   Super admins need quick access to User Management and Audit Log regardless
 *   of how many items the main nav contains or how tall the viewport is.
 *   The DashboardSidebar renders them outside the scrollable nav so they never
 *   scroll out of view.
 */

import { Outlet, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Shield,
  ScrollText,
  FileText,
  CalendarDays,
  BarChart3,
  MessageSquare,
  FolderOpen,
  Settings,
  Megaphone,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store/hooks';
import { DashboardShell } from './DashboardShell';
import { ROUTES } from '@/shared/constants/routes';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';
import type { NavItem } from './DashboardSidebar';

export function SuperAdminLayout() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);

  // Accept both the normalized roles array and the legacy flat role string.
  const hasAccess = Boolean(
    user?.roles?.some((r) => r.name === 'super_admin') ||
    user?.role === 'super_admin'
  );

  if (!hasAccess) {
    // Redirect to the user's actual dashboard instead of a dead-end Forbidden page.
    const role = getPrimaryRole(user?.roles ?? []);
    return <Navigate to={getDashboardRoute(role)} replace />;
  }

  // Main scrollable nav — same general structure as AdminLayout.
  const navItems: NavItem[] = [
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.dashboard'),      to: ROUTES.SUPER_ADMIN_DASHBOARD, icon: LayoutDashboard },
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.applications'),   to: '/super-admin/applications',  icon: FileText },
    // Shield icon for Campers signals that super_admin has elevated access to this area.
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.campers'),        to: '/super-admin/campers',       icon: Shield },
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.sessions_camps'), to: '/super-admin/sessions',      icon: CalendarDays },
    { group: t('portal_nav.group_communication'), label: t('portal_nav.inbox'),          to: '/super-admin/inbox',         icon: MessageSquare },
    { group: t('portal_nav.group_communication'), label: t('portal_nav.announcements'),  to: '/super-admin/announcements', icon: Megaphone },
    // 'Documents' has no i18n key yet — string literal until the key is added.
    { group: t('portal_nav.group_communication'), label: 'Documents',                   to: '/super-admin/documents',     icon: FolderOpen },
    { group: t('portal_nav.group_operations'),    label: t('portal_nav.calendar'),       to: '/super-admin/calendar',      icon: CalendarDays },
    { group: t('portal_nav.group_operations'),    label: t('portal_nav.reports'),        to: '/super-admin/reports',       icon: BarChart3 },
  ];

  // System items are pinned to the bottom of the sidebar — always visible regardless of viewport height.
  const systemNavItems: NavItem[] = [
    { label: t('portal_nav.users_permissions'), to: ROUTES.SUPER_ADMIN_USERS, icon: Users },
    { label: t('portal_nav.audit_log'),         to: ROUTES.SUPER_ADMIN_AUDIT, icon: ScrollText },
    { label: t('portal_nav.settings'),          to: '/super-admin/settings',  icon: Settings },
  ];

  return (
    // pinnedBottomItems renders systemNavItems outside the scrollable area.
    <DashboardShell navItems={navItems} pinnedBottomItems={systemNavItems} pageTitle={t('superadmin.dashboard.eyebrow')}>
      <Outlet />
    </DashboardShell>
  );
}
