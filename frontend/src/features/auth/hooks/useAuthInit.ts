/**
 * useAuthInit.ts
 * Runs once on app mount. Reads the auth token from sessionStorage and validates
 * it against the API.
 *
 * On success: populates Redux state with the validated user and token.
 * On failure: removes the stale token and clears auth state.
 *
 * Also installs a global listener for the 'auth:unauthorized' window event,
 * which the axios interceptor fires when any protected endpoint returns 401
 * mid-session (e.g. token expiry while browsing).
 */

import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { setUser, setToken, clearAuth, hydrateAuth } from '@/features/auth/store/authSlice';
import { getAuthenticatedUser } from '@/features/auth/api/auth.api';

export function useAuthInit(): void {
  const dispatch = useAppDispatch();

  // Listen for mid-session 401s fired by the axios response interceptor
  useEffect(() => {
    function handleUnauthorized() {
      sessionStorage.removeItem('auth_token');
      dispatch(clearAuth());
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [dispatch]);

  // On mount: read token from sessionStorage, validate with API, restore session
  useEffect(() => {
    const token = sessionStorage.getItem('auth_token');

    if (!token) {
      dispatch(hydrateAuth());
      return;
    }

    getAuthenticatedUser()
      .then((user) => {
        dispatch(setToken({ token }));
        dispatch(setUser(user));
        dispatch(hydrateAuth());
      })
      .catch(() => {
        sessionStorage.removeItem('auth_token');
        dispatch(clearAuth());
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
