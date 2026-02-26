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
import { useAppSelector } from '@/store/hooks';
import { DashboardShell } from './DashboardShell';
import { ROUTES } from '@/shared/constants/routes';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';
import type { NavItem } from './DashboardSidebar';

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',        to: ROUTES.ADMIN_DASHBOARD,      icon: LayoutDashboard },
  { label: 'Applications',     to: ROUTES.ADMIN_APPLICATIONS,   icon: FileText },
  { label: 'Campers',          to: ROUTES.ADMIN_CAMPERS,        icon: Users },
  { label: 'Sessions & Camps', to: ROUTES.ADMIN_SESSIONS,       icon: CalendarDays },
  { label: 'Announcements',    to: ROUTES.ADMIN_ANNOUNCEMENTS,  icon: Megaphone },
  { label: 'Calendar',         to: ROUTES.ADMIN_CALENDAR,       icon: CalendarDays },
  { label: 'Reports',          to: ROUTES.ADMIN_REPORTS,        icon: BarChart3 },
  { label: 'Inbox',            to: '/admin/inbox',               icon: MessageSquare },
  { label: 'Settings',         to: '/admin/settings',            icon: Settings },
];

export function AdminLayout() {
  const user = useAppSelector((state) => state.auth.user);
  const hasAccess = user?.roles.some((r) => ['admin', 'super_admin'].includes(r.name));

  if (!hasAccess) {
    // Redirect to the user's actual dashboard instead of a dead-end Forbidden page
    const role = getPrimaryRole(user?.roles ?? []);
    return <Navigate to={getDashboardRoute(role)} replace />;
  }

  return (
    <DashboardShell navItems={NAV_ITEMS} pageTitle="Dashboard">
      <Outlet />
    </DashboardShell>
  );
}
