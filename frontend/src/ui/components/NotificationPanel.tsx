/**
 * NotificationPanel.tsx
 * Slide-out notifications panel triggered from DashboardHeader.
 * Fetches from GET /api/notifications. Supports mark-as-read.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/features/admin/api/notifications.api';
import type { Notification } from '@/shared/types';
import { slidePanelVariants, fadeVariants, backdropVariants } from '@/shared/constants/motion';
import { cn } from '@/shared/utils/cn';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getNotifications()
      .then((res) => setNotifications(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
    } catch {
      // ignore — state was optimistically not updated
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
      );
    } catch {
      // ignore — state was optimistically not updated
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-40 bg-transparent"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            variants={slidePanelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed top-0 right-0 h-full w-full max-w-sm z-50 flex flex-col border-l"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
              backdropFilter: 'blur(20px)',
            }}
            aria-label="Notifications"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-ember-orange" />
                <h2
                  className="font-headline font-semibold text-base"
                  style={{ color: 'var(--foreground)' }}
                >
                  Notifications
                </h2>
                {unreadCount > 0 && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                    style={{
                      background: 'var(--ember-orange)',
                      color: 'white',
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs flex items-center gap-1 hover:text-ember-orange transition-colors"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)]"
                  style={{ color: 'var(--muted-foreground)' }}
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col gap-3 p-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 rounded-xl animate-pulse"
                      style={{ background: 'rgba(0,0,0,0.06)' }}
                    />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <motion.div
                  variants={fadeVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-col items-center justify-center h-48 gap-3"
                >
                  <Bell className="h-8 w-8" style={{ color: 'var(--muted-foreground)' }} />
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    No notifications yet
                  </p>
                </motion.div>
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {notifications.map((notification) => (
                    <li key={notification.id}>
                      <button
                        className={cn(
                          'w-full text-left px-6 py-4 transition-colors hover:bg-[var(--dash-nav-hover-bg)]',
                          !notification.read_at && 'bg-white/[0.02]'
                        )}
                        onClick={() =>
                          !notification.read_at && void handleMarkRead(notification.id)
                        }
                      >
                      <div className="flex items-start gap-3">
                        {!notification.read_at && (
                          <div
                            className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                            style={{ background: 'var(--ember-orange)' }}
                          />
                        )}
                        <div className={cn('flex-1', notification.read_at && 'pl-[18px]')}>
                          <p
                            className={cn(
                              'text-sm mb-0.5',
                              !notification.read_at ? 'font-medium' : 'font-normal'
                            )}
                            style={{ color: 'var(--foreground)' }}
                          >
                            {notification.title}
                          </p>
                          <p
                            className="text-xs leading-relaxed mb-1.5"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            {notification.message}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
