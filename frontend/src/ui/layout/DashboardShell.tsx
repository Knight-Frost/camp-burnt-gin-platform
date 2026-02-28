/**
 * DashboardShell.tsx
 * Shared layout wrapper used by all four role-specific dashboard layouts.
 * Composes DashboardSidebar + DashboardHeader + content area.
 *
 * The dashboard uses a structured dark surface (no LivingBackground).
 * A subtle noise texture overlay provides depth without distraction.
 */

import { type ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

import { DashboardSidebar, type NavItem } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { fadeVariants } from '@/shared/constants/motion';

interface DashboardShellProps {
  navItems: NavItem[];
  pageTitle: string;
  children: ReactNode;
}

/** Derive a readable page title from the current pathname */
function deriveTitleFromPath(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean).pop() ?? 'dashboard';
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function DashboardShell({
  navItems,
  pageTitle,
  children,
}: DashboardShellProps) {
  const location = useLocation();
  const [currentTitle, setCurrentTitle] = useState(pageTitle);

  // Update title when route changes
  useEffect(() => {
    const derived = deriveTitleFromPath(location.pathname);
    setCurrentTitle(derived || pageTitle);
  }, [location.pathname, pageTitle]);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--dash-bg)' }}
    >
      {/* Sidebar */}
      <DashboardSidebar navItems={navItems} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <DashboardHeader title={currentTitle} />

        {/* Page content — inbox route gets full bleed (no padding, overflow-hidden) */}
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
