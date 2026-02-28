/**
 * ParentLayout.tsx
 * Layout for parent-role authenticated routes.
 * Role mismatch → redirects to the user's correct dashboard (never FORBIDDEN dead-end).
 */

import { Outlet, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  User,
  Settings,
  CalendarDays,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { DashboardShell } from './DashboardShell';
import { ROUTES } from '@/shared/constants/routes';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';
import type { NavItem } from './DashboardSidebar';

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    to: ROUTES.PARENT_DASHBOARD,    icon: LayoutDashboard },
  { label: 'Applications', to: ROUTES.PARENT_APPLICATIONS, icon: FileText },
  { label: 'Calendar',     to: ROUTES.PARENT_CALENDAR,     icon: CalendarDays },
  { label: 'Inbox',        to: '/parent/inbox',             icon: MessageSquare },
  { label: 'Profile',      to: '/parent/profile',           icon: User },
  { label: 'Settings',     to: '/parent/settings',          icon: Settings },
];

export function ParentLayout() {
  const user = useAppSelector((state) => state.auth.user);
  const isParent = user?.roles?.some((r) => r.name === 'parent') ?? false;

  if (!isParent) {
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
