/**
 * MedicalLayout.tsx
 * Layout for medical-role authenticated routes.
 * Role mismatch → redirects to the user's correct dashboard (never FORBIDDEN dead-end).
 */

import { Outlet, Navigate } from 'react-router-dom';
import { LayoutDashboard, User, Settings } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { DashboardShell } from './DashboardShell';
import { ROUTES } from '@/shared/constants/routes';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';
import type { NavItem } from './DashboardSidebar';

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: ROUTES.MEDICAL_DASHBOARD, icon: LayoutDashboard },
  { label: 'Profile',   to: '/medical/profile',        icon: User },
  { label: 'Settings',  to: '/medical/settings',       icon: Settings },
];

export function MedicalLayout() {
  const user = useAppSelector((state) => state.auth.user);
  const hasAccess = user?.roles.some((r) =>
    ['medical', 'admin', 'super_admin'].includes(r.name)
  );

  if (!hasAccess) {
    // Redirect to the user's actual dashboard instead of a dead-end Forbidden page
    const role = getPrimaryRole(user?.roles ?? []);
    return <Navigate to={getDashboardRoute(role)} replace />;
  }

  return (
    <DashboardShell navItems={NAV_ITEMS} pageTitle="Medical Dashboard">
      <Outlet />
    </DashboardShell>
  );
}
