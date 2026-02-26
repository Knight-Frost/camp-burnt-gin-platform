/**
 * DashboardSidebar.tsx
 * Fixed sidebar navigation for all authenticated dashboard layouts.
 *
 * Features:
 * - Framer Motion stagger entry on mount
 * - Shared layout animation for active nav indicator (layoutId="dashNav")
 * - Role label pill
 * - User info + logout at bottom
 * - Collapsible on mobile
 */

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Menu, X, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { logout } from '@/features/auth/api/auth.api';
import { clearAuth } from '@/features/auth/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { ROLE_LABELS, getPrimaryRole } from '@/shared/constants/roles';
import { ROUTES } from '@/shared/constants/routes';
import {
  sidebarVariants,
  fastStaggerContainerVariants,
  fastStaggerChildVariants,
  fadeVariants,
} from '@/shared/constants/motion';
import { cn } from '@/shared/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

interface DashboardSidebarProps {
  navItems: NavItem[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardSidebar({ navItems }: DashboardSidebarProps) {
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

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
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

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Dashboard navigation">
        <motion.ul
          variants={fastStaggerContainerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-1"
        >
          {navItems.map((item) => (
            <motion.li key={item.to} variants={fastStaggerChildVariants}>
              <NavLink
                to={item.to}
                end={item.to.split('/').length <= 2}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm',
                    'transition-colors duration-200 group',
                    isActive
                      ? 'font-medium'
                      : 'font-normal'
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
                    {/* Active background */}
                    {isActive && (
                      <motion.div
                        layoutId="dashNav"
                        className="absolute inset-0 rounded-xl"
                        style={{ background: 'var(--dash-nav-active-bg)' }}
                        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
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
                        'relative z-10 h-4 w-4 flex-shrink-0 transition-colors',
                        isActive ? 'text-ember-orange' : 'text-current'
                      )}
                    />
                    <span className="relative z-10">{item.label}</span>
                  </>
                )}
              </NavLink>
            </motion.li>
          ))}
        </motion.ul>
      </nav>

      {/* User info + logout */}
      <div
        className="px-3 py-4 border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          {/* Avatar */}
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
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-200 hover:bg-[var(--dash-nav-hover-bg)]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <span>{isLoggingOut ? 'Signing out...' : 'Sign out'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        variants={sidebarVariants}
        initial="hidden"
        animate="visible"
        className="hidden lg:flex flex-col w-[280px] flex-shrink-0 border-r h-screen sticky top-0"
        style={{
          background: 'var(--dash-sidebar-bg)',
          borderColor: 'var(--dash-sidebar-border)',
        }}
        aria-label="Sidebar"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile toggle button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
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
      </motion.button>

      {/* Mobile sidebar overlay */}
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
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
