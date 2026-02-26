/**
 * DashboardHeader.tsx
 * Top header bar for all authenticated dashboard layouts.
 * Shows: page title, notification bell, settings link, user dropdown.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, User, LogOut, Settings } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { toast } from 'sonner';

import { logout } from '@/features/auth/api/auth.api';
import { clearAuth } from '@/features/auth/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { getNotifications } from '@/features/admin/api/notifications.api';
import { NotificationPanel } from '@/ui/components/NotificationPanel';
import { ROUTES } from '@/shared/constants/routes';
import { getPrimaryRole, getProfileRoute } from '@/shared/constants/roles';
import { dropdownVariants } from '@/shared/constants/motion';

interface DashboardHeaderProps {
  title: string;
}

/** Derive settings route from current prefix */
function getSettingsRoute(pathname: string): string {
  if (pathname.startsWith('/super-admin')) return '/super-admin/settings';
  if (pathname.startsWith('/admin')) return '/admin/settings';
  if (pathname.startsWith('/medical')) return '/medical/settings';
  return '/parent/settings';
}

export function DashboardHeader({ title }: DashboardHeaderProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppSelector((state) => state.auth.user);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const profileRoute = getProfileRoute(getPrimaryRole(user?.roles ?? []));
  const settingsRoute = getSettingsRoute(location.pathname);

  useEffect(() => {
    getNotifications()
      .then((res) => {
        const unread = res.data.filter((n) => !n.read_at).length;
        setUnreadCount(unread);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // ignore logout API errors
    }
    dispatch(clearAuth());
    navigate(ROUTES.LOGIN, { replace: true });
    toast.success('Signed out successfully.');
  };

  return (
    <>
      <header
        className="h-16 flex items-center justify-between px-6 border-b flex-shrink-0"
        style={{
          background: 'var(--dash-header-bg)',
          borderColor: 'var(--dash-sidebar-border)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Page title */}
        <h1
          className="text-base font-headline font-semibold"
          style={{ color: 'var(--foreground)' }}
        >
          {title}
        </h1>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          {/* Settings gear */}
          <Link
            to={settingsRoute}
            className="p-2 rounded-xl transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>

          {/* Notification bell */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setNotifOpen(true)}
            className="relative p-2 rounded-xl transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full"
                style={{ background: 'var(--ember-orange)' }}
                aria-hidden="true"
              />
            )}
          </motion.button>

          {/* User dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors ml-1"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                  background: 'transparent',
                }}
                aria-label="User menu"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                  style={{
                    background: 'var(--overlay-primary)',
                    color: 'var(--ember-orange)',
                  }}
                >
                  {user?.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm hidden sm:block">{user?.name.split(' ')[0]}</span>
              </motion.button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={8} asChild>
                <motion.div
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="w-52 rounded-xl border p-1.5 z-50"
                  style={{
                    background: 'var(--popover)',
                    borderColor: 'var(--border)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  {/* User info */}
                  <div
                    className="px-3 py-2 mb-1 border-b"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                      {user?.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                      {user?.email}
                    </p>
                  </div>

                  <DropdownMenu.Item asChild>
                    <Link
                      to={profileRoute}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors"
                      style={{ color: 'var(--foreground)' }}
                    >
                      <User className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                      Profile
                    </Link>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item asChild>
                    <Link
                      to={settingsRoute}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors"
                      style={{ color: 'var(--foreground)' }}
                    >
                      <Settings className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                      Settings
                    </Link>
                  </DropdownMenu.Item>

                  <DropdownMenu.Separator
                    className="my-1 h-px"
                    style={{ background: 'var(--border)' }}
                  />

                  <DropdownMenu.Item asChild>
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors"
                      style={{ color: 'var(--destructive)' }}
                    >
                      <LogOut className="h-4 w-4 flex-shrink-0" />
                      {isLoggingOut ? 'Signing out...' : 'Sign out'}
                    </button>
                  </DropdownMenu.Item>
                </motion.div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {/* Notification panel */}
      <NotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
      />
    </>
  );
}
