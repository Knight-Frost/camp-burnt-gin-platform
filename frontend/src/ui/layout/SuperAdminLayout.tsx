/**
 * SuperAdminLayout.tsx
 * Layout for super_admin role authenticated routes.
 * Role mismatch → redirects to the user's correct dashboard (never FORBIDDEN dead-end).
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
  ClipboardList,
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
  // Check roles array (normalized) OR flat role string (fallback for stale state)
  const hasAccess = Boolean(
    user?.roles?.some((r) => r.name === 'super_admin') ||
    user?.role === 'super_admin'
  );

  if (!hasAccess) {
    // Redirect to the user's actual dashboard instead of a dead-end Forbidden page
    const role = getPrimaryRole(user?.roles ?? []);
    return <Navigate to={getDashboardRoute(role)} replace />;
  }

  const navItems: NavItem[] = [
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.dashboard'),      to: ROUTES.SUPER_ADMIN_DASHBOARD, icon: LayoutDashboard },
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.applications'),   to: '/super-admin/applications',  icon: FileText },
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.campers'),        to: '/super-admin/campers',       icon: Shield },
    { group: t('portal_nav.group_primary'),       label: t('portal_nav.sessions_camps'), to: '/super-admin/sessions',      icon: CalendarDays },
    { group: t('portal_nav.group_communication'), label: t('portal_nav.inbox'),          to: '/super-admin/inbox',         icon: MessageSquare },
    { group: t('portal_nav.group_communication'), label: t('portal_nav.announcements'),  to: '/super-admin/announcements', icon: Megaphone },
    { group: t('portal_nav.group_communication'), label: 'Documents',                   to: '/super-admin/documents',     icon: FolderOpen },
    { group: t('portal_nav.group_operations'),    label: t('portal_nav.calendar'),       to: '/super-admin/calendar',      icon: CalendarDays },
    { group: t('portal_nav.group_operations'),    label: t('portal_nav.reports'),        to: '/super-admin/reports',       icon: BarChart3 },
  ];

  // System items are pinned to the bottom of the sidebar — always visible regardless of viewport height.
  const systemNavItems: NavItem[] = [
    { label: t('portal_nav.users_permissions'), to: ROUTES.SUPER_ADMIN_USERS, icon: Users },
    { label: t('portal_nav.audit_log'),         to: ROUTES.SUPER_ADMIN_AUDIT, icon: ScrollText },
    { label: t('portal_nav.form_templates'),    to: ROUTES.SUPER_ADMIN_FORMS, icon: ClipboardList },
    { label: t('portal_nav.settings'),          to: '/super-admin/settings',  icon: Settings },
  ];

  return (
    <DashboardShell navItems={navItems} pinnedBottomItems={systemNavItems} pageTitle={t('superadmin.dashboard.eyebrow')}>
      <Outlet />
    </DashboardShell>
  );
}
