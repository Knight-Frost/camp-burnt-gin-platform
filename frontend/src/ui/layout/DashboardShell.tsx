/**
 * DashboardShell.tsx
 *
 * Purpose: The outermost layout wrapper shared by all four role-specific dashboards
 * (AdminLayout, ApplicantLayout, MedicalLayout, SuperAdminLayout).
 *
 * Responsibilities:
 *   - Composes DashboardSidebar + DashboardHeader + a scrollable content area.
 *   - Derives a human-readable page title from the current URL pathname so
 *     individual pages don't have to pass it in explicitly.
 *   - Gives the /inbox route special full-bleed treatment (no padding,
 *     overflow-hidden) because the messaging panel manages its own scroll.
 *
 * Layout structure:
 *   <div flex h-screen>            ← full-viewport row
 *     <DashboardSidebar />         ← fixed-width left column
 *     <div flex-col>               ← expanding right column
 *       <DashboardHeader />        ← sticky top bar
 *       <main overflow-y-auto>     ← scrollable page content
 *         {children}
 *       </main>
 *     </div>
 *   </div>
 */

import { type ReactNode, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

import { DashboardSidebar, type NavItem } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { fadeVariants } from '@/shared/constants/motion';

interface DashboardShellProps {
  navItems: NavItem[];
  pinnedBottomItems?: NavItem[];
  pageTitle: string;
  children: ReactNode;
}

/**
 * Converts a URL path segment into a readable title.
 * e.g. "/admin/medical-records" → "Medical Records"
 * Takes only the last segment so parent path parts are ignored.
 */
function deriveTitleFromPath(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean).pop() ?? 'dashboard';
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function DashboardShell({
  navItems,
  pinnedBottomItems,
  pageTitle,
  children,
}: DashboardShellProps) {
  const location = useLocation();

  // useMemo means deriveTitleFromPath only reruns when the URL changes — not on every render.
  const currentTitle = useMemo(
    () => deriveTitleFromPath(location.pathname) || pageTitle,
    [location.pathname, pageTitle]
  );

  return (
    // overflow-hidden on the outer div prevents any horizontal scroll from leaking out.
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--dash-bg)' }}
    >
      {/* Left sidebar — fixed width, never scrolls with the page content */}
      <DashboardSidebar navItems={navItems} pinnedBottomItems={pinnedBottomItems} />

      {/* Right column: header + scrollable content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Sticky top bar — shows page title, notifications, user menu */}
        <DashboardHeader title={currentTitle} />

        {/*
         * The inbox route gets special treatment:
         *   - No padding so the two-panel messaging layout can fill edge-to-edge.
         *   - overflow-hidden because the panels manage their own internal scroll.
         * All other routes get standard padding and an overflow-y-auto scroll container.
         */}
        {location.pathname.endsWith('/inbox') ? (
          <div className="flex-1 overflow-hidden" id="main-content" tabIndex={-1}>
            <motion.div
              key={location.pathname}
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              className="h-full"
            >
              {children}
            </motion.div>
          </div>
        ) : (
          // Standard page content area — key on pathname triggers re-animation on every route change.
          <main
            className="flex-1 overflow-y-auto p-6 lg:p-8"
            id="main-content"
            tabIndex={-1}
          >
            <motion.div
              key={location.pathname}
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
            >
              {children}
            </motion.div>
          </main>
        )}
      </div>
    </div>
  );
}
