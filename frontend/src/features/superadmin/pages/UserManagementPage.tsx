/**
 * UserManagementPage.tsx
 *
 * Full user table with role assignment and activate/deactivate.
 * Route: /super-admin/users
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Search, ChevronLeft, ChevronRight, UserCheck, UserX, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

import { getUsers, updateUserRole, deactivateUser, reactivateUser } from '@/features/admin/api/admin.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { pageEntry, staggerContainer, staggerChild } from '@/shared/constants/motion';
import type { User } from '@/features/admin/types/admin.types';
import type { PaginatedResponse } from '@/shared/types/api.types';

const ROLES = ['parent', 'admin', 'medical', 'super_admin'];

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  super_admin: { bg: 'rgba(22,163,74,0.12)', text: 'var(--ember-orange)' },
  admin:       { bg: 'rgba(96,165,250,0.12)', text: 'var(--night-sky-blue)' },
  medical:     { bg: 'rgba(5,150,105,0.12)', text: 'var(--forest-green)' },
  parent:      { bg: 'rgba(22,163,74,0.1)',  text: 'var(--ember-orange)' },
};

interface UserFilters {
  search:     string;
  roleFilter: string;
  page:       number;
}

export function UserManagementPage() {
  const { t } = useTranslation();

  const [response, setResponse] = useState<PaginatedResponse<User> | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [filters, setFilters]   = useState<UserFilters>({ search: '', roleFilter: '', page: 1 });
  const [updating, setUpdating]         = useState<number | null>(null);
  const [confirmUser, setConfirmUser]   = useState<User | null>(null);

  const setSearch     = (search: string)     => setFilters((f) => ({ ...f, search,     page: 1 }));
  const setRoleFilter = (roleFilter: string) => setFilters((f) => ({ ...f, roleFilter, page: 1 }));
  const setPage       = (page: number)       => setFilters((f) => ({ ...f, page }));

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getUsers({
        page:   filters.page,
        search: filters.search || undefined,
        role:   filters.roleFilter || undefined,
      });
      setResponse(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  async function handleRoleChange(userId: number, role: string) {
    setUpdating(userId);
    try {
      const updated = await updateUserRole(userId, role);
      setResponse((prev) =>
        prev ? { ...prev, data: prev.data.map((u) => (u.id === userId ? updated : u)) } : prev
      );
      toast.success(t('superadmin.users.role_updated'));
    } catch {
      toast.error(t('common.save_error'));
    } finally {
      setUpdating(null);
    }
  }

  async function handleToggleActive(user: User) {
    setUpdating(user.id);
    try {
      const isActive = !!user.email_verified_at;
      if (isActive) {
        await deactivateUser(user.id);
      } else {
        await reactivateUser(user.id);
      }
      await fetchUsers();
      toast.success(t(isActive ? 'superadmin.users.deactivated' : 'superadmin.users.activated'));
    } catch {
      toast.error(t('common.save_error'));
    } finally {
      setUpdating(null);
    }
  }

  return (
    <motion.div variants={pageEntry} initial="hidden" animate="visible" className="p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('superadmin.users.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {response && t('superadmin.users.subtitle', { total: response.meta.total })}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div
          className="flex items-center gap-2 flex-1 max-w-sm rounded-lg px-3 py-2 border"
          style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
        >
          <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('superadmin.users.search_placeholder')}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--foreground)' }}
          />
        </div>
        <select
          value={filters.roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm border outline-none"
          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <option value="">{t('superadmin.users.all_roles')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r} style={{ background: 'var(--card)' }}>
              {r.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeletons.Row key={i} />)}</div>
      ) : error ? (
        <EmptyState
          title={t('common.error_loading')}
          description={t('common.try_again')}
          action={{ label: t('common.retry'), onClick: fetchUsers }}
        />
      ) : !response || response.data.length === 0 ? (
        <EmptyState title={t('superadmin.users.empty_title')} description={t('superadmin.users.empty_desc')} />
      ) : (
        <>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--border)' }}
          >
            <div
              className="grid grid-cols-12 px-4 py-3 text-xs font-medium uppercase tracking-wide border-b"
              style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              <div className="col-span-3">{t('superadmin.users.col_name')}</div>
              <div className="col-span-3">{t('superadmin.users.col_email')}</div>
              <div className="col-span-2">{t('superadmin.users.col_role')}</div>
              <div className="col-span-2">{t('superadmin.users.col_joined')}</div>
              <div className="col-span-2 text-right">{t('superadmin.users.col_actions')}</div>
            </div>

            {response.data.map((user) => {
              const roleStyle = ROLE_COLORS[user.role] ?? ROLE_COLORS['parent'];
              return (
                <motion.div
                  key={user.id}
                  variants={staggerChild}
                  className="grid grid-cols-12 items-center px-4 py-3.5 border-b last:border-b-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="col-span-3">
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{user.name}</p>
                  </div>
                  <div className="col-span-3">
                    <p className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>{user.email}</p>
                  </div>
                  <div className="col-span-2">
                    {updating === user.id ? (
                      <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                        style={{ borderColor: 'var(--ember-orange)', borderTopColor: 'transparent' }} />
                    ) : (
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="text-xs px-2 py-1 rounded-full border-0 outline-none font-medium"
                        style={{ background: roleStyle.bg, color: roleStyle.text, cursor: 'pointer' }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r} style={{ background: 'var(--card)', color: 'var(--foreground)' }}>
                            {r.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {format(new Date(user.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button
                      onClick={() => setConfirmUser(user)}
                      disabled={updating === user.id}
                      className="p-1.5 rounded transition-colors disabled:opacity-40"
                      title={user.email_verified_at ? t('superadmin.users.deactivate') : t('superadmin.users.activate')}
                    >
                      {user.email_verified_at
                        ? <UserX className="h-4 w-4" style={{ color: 'var(--destructive)' }} />
                        : <UserCheck className="h-4 w-4" style={{ color: 'var(--forest-green)' }} />
                      }
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {response.meta.last_page > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {t('common.pagination', {
                  from: (filters.page - 1) * response.meta.per_page + 1,
                  to: Math.min(filters.page * response.meta.per_page, response.meta.total),
                  total: response.meta.total,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(filters.page - 1)} disabled={filters.page === 1}
                  className="p-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>
                  <ChevronLeft className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
                </button>
                <span className="text-sm px-2" style={{ color: 'var(--foreground)' }}>
                  {filters.page} / {response.meta.last_page}
                </span>
                <button onClick={() => setPage(filters.page + 1)} disabled={filters.page === response.meta.last_page}
                  className="p-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>
                  <ChevronRight className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirmation dialog */}
      {confirmUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.40)' }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border p-6 shadow-2xl"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: confirmUser.email_verified_at ? 'rgba(220,38,38,0.10)' : 'rgba(22,163,74,0.10)' }}>
                <AlertTriangle className="h-4.5 w-4.5"
                  style={{ color: confirmUser.email_verified_at ? 'var(--destructive)' : 'var(--forest-green)' }} />
              </div>
              <div>
                <p id="confirm-dialog-title" className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {confirmUser.email_verified_at
                    ? t('superadmin.users.deactivate_confirm_title', { name: confirmUser.name })
                    : t('superadmin.users.activate_confirm_title',   { name: confirmUser.name })}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {confirmUser.email_verified_at
                    ? t('superadmin.users.deactivate_confirm_body')
                    : t('superadmin.users.activate_confirm_body')}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmUser(null)}
                className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => { const u = confirmUser; setConfirmUser(null); void handleToggleActive(u); }}
                className="px-4 py-2 text-sm rounded-lg font-medium transition-colors"
                style={{
                  background: confirmUser.email_verified_at ? 'var(--destructive)' : 'var(--forest-green)',
                  color: '#ffffff',
                }}
              >
                {confirmUser.email_verified_at ? t('superadmin.users.deactivate') : t('superadmin.users.activate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
