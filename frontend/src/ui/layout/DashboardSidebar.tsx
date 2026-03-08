/**
 * DashboardSidebar.tsx
 *
 * Purpose: The fixed left-hand navigation sidebar used across all authenticated
 * dashboard layouts (admin, applicant, medical, super_admin).
 *
 * Responsibilities:
 *   - Renders a brand header with the user's role pill.
 *   - Renders the main scrollable nav list, grouped by section headers.
 *   - Optionally renders a pinned "System" nav section at the bottom that is
 *     always visible regardless of viewport height (never scrolled off-screen).
 *   - Renders a user avatar + name + logout button at the very bottom.
 *   - On mobile, the sidebar hides behind a hamburger button and slides in as
 *     an animated drawer when opened.
 *
 * Stability notes (important for avoiding flicker/re-mount bugs):
 *   - Wrapped in React.memo — only re-renders when navItems reference changes.
 *   - Brand header, nav list, pinned nav, and user footer are built as plain
 *     JSX elements (not sub-components) so React never unmounts/remounts them
 *     during a parent re-render.
 *   - Active nav indicator uses a plain CSS div instead of Framer Motion's
 *     layoutId to prevent FLIP animation jank on route changes.
 *   - scrollbar-gutter: stable prevents the scrollbar appearing/disappearing
 *     from causing a layout shift in the nav area.
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

/** Shape of a single navigation item passed in from the role-specific layouts. */
export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Optional group name — consecutive items sharing a group name are rendered under one header. */
  group?: string;
}

interface DashboardSidebarProps {
  navItems: NavItem[];
  /**
   * Items pinned at the very bottom of the sidebar, above the user footer.
   * They never scroll out of view — ideal for high-priority system links
   * like User Management and Audit Log in the super_admin portal.
   */
  pinnedBottomItems?: NavItem[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// memo() prevents re-renders when the parent re-renders but navItems hasn't changed.
export const DashboardSidebar = memo(function DashboardSidebar({ navItems, pinnedBottomItems }: DashboardSidebarProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  // Read the logged-in user from Redux to display their name, email, and role pill.
  const user = useAppSelector((state) => state.auth.user);
  // Mobile drawer open/close state.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const primaryRole = getPrimaryRole(user?.roles ?? []);
  // Human-readable role label (e.g. "Administrator") for the badge under the brand name.
  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole] : '';

  /**
   * Calls the logout API, then always clears local auth state regardless of whether
   * the server-side call succeeded. This ensures the user is signed out even if
   * the request times out or the server returns an error.
   */
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
  // JSX fragments shared between desktop and mobile renders.
  // These are plain React elements (not component functions), so React never
  // treats them as separate component instances — no unmount/remount on re-render.
  // ---------------------------------------------------------------------------

  /** Top of the sidebar: "CB" logo mark + app name + role pill */
  const brandHeader = (
    <div className="px-6 py-6 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-3">
        {/* "CB" monogram — colored square that acts as a quick brand identifier */}
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
          {/* Role pill — only renders if the user has an identifiable role */}
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

  /**
   * Main scrollable nav list.
   * Group headers appear whenever a nav item's `group` value changes from the
   * previous item — this creates visual sections without any extra data structure.
   */
  const navList = (
    <nav
      className="flex-1 min-h-0 px-3 py-4 overflow-y-auto"
      // scrollbar-gutter: stable reserves space for the scrollbar so the nav
      // width never jumps when the scrollbar appears or disappears.
      style={{ scrollbarGutter: 'stable' }}
      aria-label="Dashboard navigation"
    >
      <ul className="flex flex-col gap-1">
        {navItems.map((item, i) => {
          // Show a section header whenever the group label changes.
          const showHeader = item.group && item.group !== navItems[i - 1]?.group;
          return (
            <li key={item.to}>
              {showHeader && (
                // Section group label — purely decorative, hidden from screen readers.
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
              {/*
               * NavLink applies the `isActive` callback when the current URL
               * matches `item.to`. `end` is true for top-level routes so that
               * e.g. /admin/dashboard doesn't also activate /admin.
               */}
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
                    {/* Active state background highlight — plain div, no animation, no layout shift */}
                    {isActive && (
                      <div
                        className="absolute inset-0 rounded-xl"
                        style={{ background: 'var(--dash-nav-active-bg)' }}
                      />
                    )}

                    {/* Thin orange left accent bar — visual indicator of the active route */}
                    {isActive && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                        style={{ background: 'var(--ember-orange)' }}
                      />
                    )}

                    {/* Route icon — orange when active, inherits muted color otherwise */}
                    <item.icon
                      className={cn(
                        'relative z-10 h-4 w-4 flex-shrink-0',
                        isActive ? 'text-ember-orange' : 'text-current'
                      )}
                    />
                    {/* z-10 ensures the label text sits above the active background div */}
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

  /**
   * Pinned bottom section — "System" items that must always be visible.
   * These sit between the scrollable nav and the user footer, outside the
   * scroll container, so they can never scroll out of view.
   */
  const pinnedNav = pinnedBottomItems && pinnedBottomItems.length > 0 ? (
    <div
      className="flex-shrink-0 px-3 py-2 border-t"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* "System" group header — always the same label for pinned items */}
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
            {/* Same NavLink pattern as the main nav list */}
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

  /**
   * User info strip + sign-out button at the very bottom of the sidebar.
   * The avatar is the first letter of the user's name (no image upload needed).
   */
  const userFooter = (
    <div
      className="px-3 py-4 border-t"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Avatar + name + email row */}
      <div className="flex items-center gap-3 px-3 py-2 mb-1">
        {/* Initial-based avatar — e.g. "J" for "Jane Smith" */}
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
          {/* truncate prevents long names from breaking the sidebar width */}
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

      {/* Sign-out button — disabled while the logout API call is in flight */}
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
      {/* ── Desktop sidebar ─────────────────────────────────────────────────────
          sticky top-0 keeps the sidebar fixed while the main content scrolls.
          Hidden on mobile (hidden lg:flex) — the hamburger button shows instead. */}
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

      {/* ── Mobile hamburger button ─────────────────────────────────────────────
          Only visible below the lg breakpoint. Tapping opens the drawer. */}
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

      {/* ── Mobile sidebar drawer ───────────────────────────────────────────────
          AnimatePresence lets the drawer animate out smoothly before unmounting. */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Semi-transparent backdrop — clicking it closes the drawer */}
            <motion.div
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            />

            {/* Drawer panel — slides in from the left */}
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
              {/* Close button in the top-right corner of the drawer */}
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
              {/* Same content as the desktop sidebar — reuses the shared fragments */}
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
