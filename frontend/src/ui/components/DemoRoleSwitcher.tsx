/**
 * DemoRoleSwitcher.tsx — Demo mode role switcher UI
 *
 * Renders only when isDemoMode === true. In production builds this component
 * returns null immediately and is tree-shaken away with isDemoMode.
 *
 * Behavior:
 *   - Shows the current demo role in a compact dropdown
 *   - On role change: writes to localStorage, updates Redux auth state,
 *     and navigates to the correct portal — no page reload required
 *
 * Placement: Rendered inside DashboardSidebar's brand header area.
 * It is always visible in demo mode regardless of which portal is active.
 */

import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/store/hooks';
import { setUser } from '@/features/auth/store/authSlice';
import {
  isDemoMode,
  getDemoUser,
  setDemoRole,
  currentDemoRole,
} from '@/config/runtime';
import { getDashboardRoute, ROLE_LABELS } from '@/shared/constants/roles';
import type { RoleName } from '@/shared/constants/roles';

const DEMO_ROLE_OPTIONS: { value: RoleName; label: string }[] = [
  { value: 'super_admin', label: ROLE_LABELS.super_admin },
  { value: 'admin',       label: ROLE_LABELS.admin },
  { value: 'applicant',   label: ROLE_LABELS.applicant },
  { value: 'medical',     label: ROLE_LABELS.medical },
];

export function DemoRoleSwitcher() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Not in demo mode — render nothing. This check is on a build-time constant
  // so bundlers can eliminate the component entirely in non-demo production builds.
  if (!isDemoMode) return null;

  const activeRole = currentDemoRole();

  function handleRoleChange(e: ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value as RoleName;

    // 1. Persist to localStorage (synchronous)
    setDemoRole(newRole);

    // 2. Update Redux auth state — all role-dependent UI re-renders immediately.
    //    getDemoUser() reads the updated localStorage value just written above.
    dispatch(setUser(getDemoUser()));

    // 3. Navigate to the correct portal for the new role.
    //    React Router batches this with the Redux update — the RoleGuard at
    //    the destination route will see the new user object and pass through.
    navigate(getDashboardRoute(newRole), { replace: true });
  }

  return (
    <div
      className="mt-3 rounded-lg px-3 py-2.5"
      style={{
        background: 'rgba(234, 88, 12, 0.10)',
        border: '1px solid rgba(234, 88, 12, 0.25)',
      }}
    >
      {/* Demo mode indicator badge */}
      <div className="flex items-center gap-1.5 mb-2">
        {/* Pulsing dot — draws attention without being obtrusive */}
        <span
          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
          style={{ background: 'var(--ember-orange)' }}
        />
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--ember-orange)' }}
        >
          Demo Mode
        </span>
      </div>

      {/* Role selector */}
      <label
        htmlFor="demo-role-select"
        className="block text-[11px] font-medium mb-1"
        style={{ color: 'var(--muted-foreground)' }}
      >
        Active role
      </label>
      <select
        id="demo-role-select"
        value={activeRole}
        onChange={handleRoleChange}
        className="w-full text-xs rounded-md px-2 py-1.5 outline-none cursor-pointer"
        style={{
          background: 'var(--card)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
        }}
      >
        {DEMO_ROLE_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
