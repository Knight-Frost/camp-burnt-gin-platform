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
  Home,
  Shield,
  ScrollText,
  FileText,
  CalendarDays,
  BarChart3,
  MessageSquare,
  FolderOpen,
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

export function SuperAdminLayout() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);

  // Accept both the normalized roles array and the legacy flat role string.
  const hasAccess = Boolean(
    user?.roles?.some((r) => r.name === 'super_admin') ||
    user?.role === 'super_admin'
  );

  if (!hasAccess) {
    // Redirect to /forbidden rather than getDashboardRoute(role).
    // Same fix as AdminLayout — the old pattern silently routed stale-role
    // users into the applicant portal when role resolved to 'applicant'.
    return <Navigate to="/forbidden" replace />;
  }

  // All nav items in one flat array — grouped by section label.
  // String literals are used for group names and labels to guarantee they always
  // render regardless of i18n key availability.
  const navItems: NavItem[] = [
    // PRIMARY — core operational pages
    { group: 'Primary',       label: 'Dashboard',                    to: ROUTES.SUPER_ADMIN_DASHBOARD, icon: LayoutDashboard },
    { group: 'Primary',       label: 'Applications',                 to: '/super-admin/applications',  icon: FileText },
    { group: 'Primary',       label: 'Families',                     to: '/super-admin/families',      icon: Home },
    { group: 'Primary',       label: 'Camper Directory',             to: '/super-admin/campers',       icon: Shield },
    { group: 'Primary',       label: 'Sessions & Camps',             to: '/super-admin/sessions',      icon: CalendarDays },
    // COMMUNICATION
    { group: 'Communication', label: 'Inbox',                        to: '/super-admin/inbox',         icon: MessageSquare },
    { group: 'Communication', label: 'Announcements',                to: '/super-admin/announcements', icon: Megaphone },
    { group: 'Communication', label: 'Documents',                    to: '/super-admin/documents',     icon: FolderOpen },
    // OPERATIONS
    { group: 'Operations',    label: 'Calendar',                     to: '/super-admin/calendar',      icon: CalendarDays },
    { group: 'Operations',    label: 'Reports',                      to: '/super-admin/reports',       icon: BarChart3 },
    // SYSTEM — governance & configuration (super_admin exclusive)
    { group: 'System',        label: 'Manage Users & Permissions',   to: ROUTES.SUPER_ADMIN_USERS,         icon: Users },
    { group: 'System',        label: 'Audit Log',                    to: ROUTES.SUPER_ADMIN_AUDIT,         icon: ScrollText },
    { group: 'System',        label: 'Form Builder',                 to: ROUTES.SUPER_ADMIN_FORM_BUILDER,  icon: Layout },
    { group: 'System',        label: 'Settings',                     to: '/super-admin/settings',          icon: Settings },
  ];

  // No pinned bottom items — system items moved into the main nav under the 'System' group.
  const systemNavItems: NavItem[] = [];

  return (
    <SessionWorkspaceProvider>
      {/* SessionSelectorModal renders via portal; visibility driven by context state */}
      <SessionSelectorModal />
      <DashboardShell navItems={navItems} pinnedBottomItems={systemNavItems} pageTitle={t('superadmin.dashboard.eyebrow')}>
        <Outlet />
      </DashboardShell>
    </SessionWorkspaceProvider>
  );
}
