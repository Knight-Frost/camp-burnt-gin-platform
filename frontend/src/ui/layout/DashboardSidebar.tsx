/**
 * DashboardSidebar.tsx
 * Fixed sidebar navigation for all authenticated dashboard layouts.
 *
 * Features:
 * - Static (no entry animation) — layout-stable across all route changes
 * - Active indicator via plain CSS — no layoutId, no FLIP animation
 * - Role label pill
 * - User info + logout at bottom
 * - Collapsible on mobile (animated drawer)
 *
 * Stability rules:
 * - No SidebarContent inner component — inlining prevents React re-mount on parent re-render
 * - React.memo prevents re-render when navItems reference is stable (module-level const)
 * - scrollbar-gutter: stable prevents scrollbar layout shift
 */

import { memo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Menu, X, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { logout } from '@/features/auth/api/auth.api';
import { clearAuth } from '@/features/auth/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { ROLE_LABELS, getPrimaryRole } from '@/shared/constants/roles';
import { ROUTES } from '@/shared/constants/routes';
import { fadeVariants } from '@/shared/constants/motion';
import { cn } from '@/shared/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Optional section group label (e.g. 'Primary', 'Communication', 'Operations', 'System') */
  group?: string;
}

interface DashboardSidebarProps {
  navItems: NavItem[];
  /**
   * Optional nav items pinned at the bottom of the sidebar (above user footer),
   * always visible regardless of viewport height. Use for critical System links
   * (e.g. User Management, Audit Log) so they are never hidden by scrolling.
   */
  pinnedBottomItems?: NavItem[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DashboardSidebar = memo(function DashboardSidebar({ navItems, pinnedBottomItems }: DashboardSidebarProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const primaryRole = getPrimaryRole(user?.roles ?? []);
  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole] : '';

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // Silently ignore logout errors — clear local state regardless
    } finally {
      dispatch(clearAuth());
      navigate(ROUTES.LOGIN, { replace: true });
      toast.success('Signed out successfully.');
    }
  };

  // ---------------------------------------------------------------------------
  // JSX fragments — these are React Elements (plain objects), NOT component
  // functions. They do NOT cause re-mount on re-render. Defined here so they
  // can be shared between desktop and mobile renders without duplication.
  // ---------------------------------------------------------------------------

  const brandHeader = (
    <div className="px-6 py-6 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--ember-orange)' }}
        >
          <span className="text-white font-headline font-bold text-sm">CB</span>
        </div>
        <div>
          <p
            className="text-sm font-headline font-semibold leading-tight"
            style={{ color: 'var(--foreground)' }}
          >
            Camp Burnt Gin
          </p>
          {roleLabel && (
            <span
              className="inline-block text-xs px-2 py-0.5 rounded-full mt-0.5 font-medium"
              style={{
                background: 'var(--overlay-primary)',
                color: 'var(--ember-orange)',
              }}
            >
              {roleLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const navList = (
    <nav
      className="flex-1 min-h-0 px-3 py-4 overflow-y-auto"
      style={{ scrollbarGutter: 'stable' }}
      aria-label="Dashboard navigation"
    >
      <ul className="flex flex-col gap-1">
        {navItems.map((item, i) => {
          const showHeader = item.group && item.group !== navItems[i - 1]?.group;
          return (
            <li key={item.to}>
              {showHeader && (
                <div
                  className="px-3 pt-4 pb-1 select-none pointer-events-none"
                  aria-hidden="true"
                >
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--muted-foreground)', opacity: 0.45 }}
                  >
                    {item.group}
                  </span>
                </div>
              )}
              <NavLink
                to={item.to}
                end={item.to.split('/').length <= 2}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm',
                    'transition-colors duration-150 group',
                    isActive ? 'font-medium' : 'font-normal hover:bg-[var(--dash-nav-hover-bg)]'
                  )
                }
                style={({ isActive }) =>
                  isActive
                    ? { color: 'var(--foreground)' }
                    : { color: 'var(--muted-foreground)' }
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active background — plain div, no animation */}
                    {isActive && (
                      <div
                        className="absolute inset-0 rounded-xl"
                        style={{ background: 'var(--dash-nav-active-bg)' }}
                      />
                    )}

                    {/* Active left accent */}
                    {isActive && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                        style={{ background: 'var(--ember-orange)' }}
                      />
                    )}

                    <item.icon
                      className={cn(
                        'relative z-10 h-4 w-4 flex-shrink-0',
                        isActive ? 'text-ember-orange' : 'text-current'
                      )}
                    />
                    <span className="relative z-10">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  // Pinned bottom nav — always visible above user footer, never scrolls off screen
  const pinnedNav = pinnedBottomItems && pinnedBottomItems.length > 0 ? (
    <div
      className="flex-shrink-0 px-3 py-2 border-t"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="px-3 pb-1 select-none pointer-events-none" aria-hidden="true">
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--muted-foreground)', opacity: 0.45 }}
        >
          System
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {pinnedBottomItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to.split('/').length <= 2}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm',
                  'transition-colors duration-150 group',
                  isActive ? 'font-medium' : 'font-normal hover:bg-[var(--dash-nav-hover-bg)]'
                )
              }
              style={({ isActive }) =>
                isActive
                  ? { color: 'var(--foreground)' }
                  : { color: 'var(--muted-foreground)' }
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div
                      className="absolute inset-0 rounded-xl"
                      style={{ background: 'var(--dash-nav-active-bg)' }}
                    />
                  )}
                  {isActive && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                      style={{ background: 'var(--ember-orange)' }}
                    />
                  )}
                  <item.icon
                    className={cn(
                      'relative z-10 h-4 w-4 flex-shrink-0',
                      isActive ? 'text-ember-orange' : 'text-current'
                    )}
                  />
                  <span className="relative z-10">{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  const userFooter = (
    <div
      className="px-3 py-4 border-t"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-3 px-3 py-2 mb-1">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium"
          style={{
            background: 'var(--overlay-primary)',
            color: 'var(--ember-orange)',
          }}
        >
          {user?.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{ color: 'var(--foreground)' }}
          >
            {user?.name}
          </p>
          <p
            className="text-xs truncate"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {user?.email}
          </p>
        </div>
      </div>

      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 hover:bg-[var(--dash-nav-hover-bg)]"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <LogOut className="h-4 w-4 flex-shrink-0" />
        <span>{isLoggingOut ? 'Signing out...' : 'Sign out'}</span>
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — static, never animates on route change */}
      <aside
        className="hidden lg:flex flex-col w-[280px] flex-shrink-0 border-r h-screen sticky top-0"
        style={{
          background: 'var(--dash-sidebar-bg)',
          borderColor: 'var(--dash-sidebar-border)',
        }}
        aria-label="Sidebar"
      >
        <div className="flex flex-col h-full">
          {brandHeader}
          {navList}
          {pinnedNav}
          {userFooter}
        </div>
      </aside>

      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-xl border"
        style={{
          background: 'var(--dash-sidebar-bg)',
          borderColor: 'var(--dash-sidebar-border)',
          color: 'var(--foreground)',
        }}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile sidebar overlay — animated on demand, does not affect desktop stability */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            />

            {/* Mobile sidebar panel */}
            <motion.aside
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col border-r"
              style={{
                background: 'var(--dash-sidebar-bg)',
                borderColor: 'var(--dash-sidebar-border)',
              }}
              aria-label="Mobile navigation"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex flex-col h-full">
                {brandHeader}
                {navList}
                {pinnedNav}
                {userFooter}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
});
