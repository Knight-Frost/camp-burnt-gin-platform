/**
 * ParentLayout.tsx
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
import { useAppSelector } from '@/store/hooks';
import { DashboardShell } from './DashboardShell';
import { ROUTES } from '@/shared/constants/routes';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';
import type { NavItem } from './DashboardSidebar';

const NAV_ITEMS: NavItem[] = [
  { group: 'My Portal',     label: 'Dashboard',     to: ROUTES.PARENT_DASHBOARD,     icon: LayoutDashboard },
  { group: 'My Portal',     label: 'Applications',  to: ROUTES.PARENT_APPLICATIONS,  icon: FileText },
  { group: 'My Portal',     label: 'Documents',     to: ROUTES.PARENT_DOCUMENTS,     icon: FolderOpen },
  { group: 'Communication', label: 'Inbox',         to: '/applicant/inbox',          icon: MessageSquare },
  { group: 'Communication', label: 'Announcements', to: ROUTES.PARENT_ANNOUNCEMENTS, icon: Megaphone },
  { group: 'Operations',    label: 'Calendar',      to: ROUTES.PARENT_CALENDAR,      icon: CalendarDays },
  { group: 'Account',       label: 'Profile',       to: '/applicant/profile',        icon: User },
  { group: 'Account',       label: 'Settings',      to: '/applicant/settings',       icon: Settings },
];

export function ParentLayout() {
  const user = useAppSelector((state) => state.auth.user);
  const isApplicant = user?.roles?.some((r) => r.name === 'applicant') ?? false;

  if (!isApplicant) {
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
