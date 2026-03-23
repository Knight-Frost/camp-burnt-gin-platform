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
  Home,
  FileText,
  FolderOpen,
  CalendarDays,
  BarChart3,
  MessageSquare,
  Settings,
  Megaphone,
  Layout,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store/hooks';
import { DashboardShell } from './DashboardShell';
import { ROUTES } from '@/shared/constants/routes';
import type { NavItem } from './DashboardSidebar';
import { SessionWorkspaceProvider } from '@/features/sessions/context/SessionWorkspaceContext';
import { SessionSelectorModal } from '@/features/sessions/components/SessionSelectorModal';

export function AdminLayout() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);

  // Accept both normalized roles array and legacy flat role string.
  const hasAccess = Boolean(
    user?.roles?.some((r) => ['admin', 'super_admin'].includes(r.name)) ||
    ['admin', 'super_admin'].includes(user?.role ?? '')
  );

  if (!hasAccess) {
    // Redirect to /forbidden rather than getDashboardRoute(role).
    // The old pattern was the root cause of "admin portal turns into applicant
    // portal": if Redux role resolved to 'applicant' (stale state or cross-tab
    // contamination), the admin was silently routed into the applicant portal.
    return <Navigate to="/forbidden" replace />;
  }

  // Nav items are defined here (inside the component) so they are translated
  // on every render, picking up any language change from i18next immediately.
  const navItems: NavItem[] = [
    // PRIMARY — core operational pages
    { group: 'Primary',       label: 'Dashboard',        to: ROUTES.ADMIN_DASHBOARD,     icon: LayoutDashboard },
    { group: 'Primary',       label: 'Applications',     to: ROUTES.ADMIN_APPLICATIONS,  icon: FileText },
    { group: 'Primary',       label: 'Families',         to: ROUTES.ADMIN_FAMILIES,      icon: Home },
    { group: 'Primary',       label: 'Camper Directory', to: ROUTES.ADMIN_CAMPERS,       icon: Users },
    { group: 'Primary',       label: 'Sessions & Camps', to: ROUTES.ADMIN_SESSIONS,      icon: CalendarDays },
    // COMMUNICATION
    { group: 'Communication', label: 'Inbox',            to: '/admin/inbox',             icon: MessageSquare },
    { group: 'Communication', label: 'Announcements',    to: ROUTES.ADMIN_ANNOUNCEMENTS, icon: Megaphone },
    { group: 'Communication', label: 'Documents',        to: ROUTES.ADMIN_DOCUMENTS,     icon: FolderOpen },
    // OPERATIONS
    { group: 'Operations',    label: 'Calendar',         to: ROUTES.ADMIN_CALENDAR,      icon: CalendarDays },
    { group: 'Operations',    label: 'Reports',          to: ROUTES.ADMIN_REPORTS,       icon: BarChart3 },
    // SYSTEM — governance & configuration
    { group: 'System',        label: 'Form Builder',               to: '/admin/form-builder',  icon: Layout },
    { group: 'System',        label: 'Settings',                   to: '/admin/settings',      icon: Settings },
  ];

  return (
    <SessionWorkspaceProvider>
      {/* SessionSelectorModal renders via portal; visibility driven by context state */}
      <SessionSelectorModal />
      <DashboardShell navItems={navItems} pageTitle={t('portal_nav.dashboard')}>
        <Outlet />
      </DashboardShell>
    </SessionWorkspaceProvider>
  );
}
