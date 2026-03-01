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
  Settings,
  Megaphone,
  ClipboardList,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { DashboardShell } from './DashboardShell';
import { ROUTES } from '@/shared/constants/routes';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';
import type { NavItem } from './DashboardSidebar';

const NAV_ITEMS: NavItem[] = [
  { group: 'Primary',       label: 'Dashboard',        to: ROUTES.SUPER_ADMIN_DASHBOARD, icon: LayoutDashboard },
  { group: 'Primary',       label: 'Applications',     to: '/super-admin/applications',  icon: FileText },
  { group: 'Primary',       label: 'Campers',          to: '/super-admin/campers',       icon: Shield },
  { group: 'Primary',       label: 'Sessions & Camps', to: '/super-admin/sessions',      icon: CalendarDays },
  { group: 'Communication', label: 'Inbox',            to: '/super-admin/inbox',         icon: MessageSquare },
  { group: 'Communication', label: 'Announcements',    to: '/super-admin/announcements', icon: Megaphone },
  { group: 'Operations',    label: 'Calendar',         to: '/super-admin/calendar',      icon: CalendarDays },
  { group: 'Operations',    label: 'Reports',          to: '/super-admin/reports',       icon: BarChart3 },
];

// System items are pinned to the bottom of the sidebar — always visible regardless of viewport height.
const SYSTEM_NAV_ITEMS: NavItem[] = [
  { label: 'Manage Users & Permissions', to: ROUTES.SUPER_ADMIN_USERS, icon: Users },
  { label: 'Audit Log',                  to: ROUTES.SUPER_ADMIN_AUDIT, icon: ScrollText },
  { label: 'Form Templates',             to: ROUTES.SUPER_ADMIN_FORMS, icon: ClipboardList },
  { label: 'Settings',                   to: '/super-admin/settings',  icon: Settings },
];

export function SuperAdminLayout() {
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

  return (
    <DashboardShell navItems={NAV_ITEMS} pinnedBottomItems={SYSTEM_NAV_ITEMS} pageTitle="Super Admin">
      <Outlet />
    </DashboardShell>
  );
}
