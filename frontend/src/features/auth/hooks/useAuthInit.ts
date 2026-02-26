/**
 * useAuthInit.ts
 * Runs once on app mount. Validates the persisted auth token against the API.
 * On success: hydrates user state.
 * On failure: clears auth and redirects to login.
 */

import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setUser, clearAuth, hydrateAuth } from '@/features/auth/store/authSlice';
import { getAuthenticatedUser } from '@/features/auth/api/auth.api';

export function useAuthInit(): void {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const hasRun = useRef(false);

  useEffect(() => {
    // Guard: only run once per app lifecycle
    if (hasRun.current) return;
    hasRun.current = true;

    if (!token) {
      // No token in storage — skip API call, just finish loading
      dispatch(hydrateAuth());
      return;
    }

    getAuthenticatedUser()
      .then((user) => {
        dispatch(setUser(user));
        dispatch(hydrateAuth());
      })
      .catch(() => {
        // Token invalid or expired — clear all auth state
        dispatch(clearAuth());
      });
  }, [dispatch, token]);
}
