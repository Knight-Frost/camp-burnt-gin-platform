/**
 * useAuthInit.ts
 * Runs once on app mount. Validates the persisted auth token against the API.
 * On success: hydrates user state.
 * On failure: clears auth and redirects to login.
 *
 * Also installs a global listener for the 'auth:unauthorized' window event,
 * which the axios interceptor fires when any protected endpoint returns 401
 * mid-session (e.g. token expiry while browsing). Without this listener the
 * user is left in a broken state — requests fail but they are never redirected.
 */

import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setUser, clearAuth, hydrateAuth } from '@/features/auth/store/authSlice';
import { getAuthenticatedUser } from '@/features/auth/api/auth.api';

export function useAuthInit(): void {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const hasRun = useRef(false);

  // Listen for mid-session 401s fired by the axios response interceptor
  useEffect(() => {
    function handleUnauthorized() {
      dispatch(clearAuth());
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [dispatch]);

  // Validate the persisted token once on mount
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!token) {
      dispatch(hydrateAuth());
      return;
    }

    getAuthenticatedUser()
      .then((user) => {
        dispatch(setUser(user));
        dispatch(hydrateAuth());
      })
      .catch(() => {
        dispatch(clearAuth());
      });
  }, [dispatch, token]);
}
