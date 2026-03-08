/**
 * useAuthInit.ts — App-startup authentication hydration hook
 *
 * Called once in App.tsx when the app first mounts. It handles the common scenario
 * where a user refreshes the page — they have a valid token saved in sessionStorage
 * but Redux is empty because page refresh wipes in-memory state.
 *
 * What it does:
 * 1. Registers a global listener for the 'auth:unauthorized' custom window event.
 *    The axios interceptor fires this event when any protected API request gets a
 *    401 mid-session (e.g. the token silently expired while the user was browsing).
 * 2. On mount, reads the token from sessionStorage and calls GET /api/user to
 *    validate it. If valid, restores the Redux auth state so the user stays logged in.
 *    If invalid or absent, clears auth state and lets ProtectedRoute redirect to /login.
 *
 * The eslint-disable comment on the second useEffect is intentional — that effect
 * should only ever run once on mount, not re-run when dispatch changes.
 */

import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { setUser, setToken, clearAuth, hydrateAuth } from '@/features/auth/store/authSlice';
import { getAuthenticatedUser } from '@/features/auth/api/auth.api';

export function useAuthInit(): void {
  const dispatch = useAppDispatch();

  // Effect 1: Listen for mid-session 401s fired by the axios response interceptor.
  // If the server rejects a token during normal browsing, immediately log out.
  useEffect(() => {
    function handleUnauthorized() {
      // Remove the stale token from browser storage
      sessionStorage.removeItem('auth_token');
      // Reset the Redux auth state — ProtectedRoute will then redirect to /login
      dispatch(clearAuth());
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    // Cleanup: remove the listener when the component unmounts to avoid memory leaks
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [dispatch]);

  // Effect 2: On mount, restore the session if a token exists in sessionStorage
  useEffect(() => {
    const token = sessionStorage.getItem('auth_token');

    // No stored token — nothing to restore, mark hydration complete immediately
    if (!token) {
      dispatch(hydrateAuth());
      return;
    }

    // Token found — validate it with the API to ensure it's still active
    getAuthenticatedUser()
      .then((user) => {
        // Token is valid: restore auth state into Redux
        dispatch(setToken({ token }));
        dispatch(setUser(user));
        // Signal that hydration is complete — ProtectedRoute will now show the page
        dispatch(hydrateAuth());
      })
      .catch(() => {
        // Token is expired or revoked — clean up and force re-login
        sessionStorage.removeItem('auth_token');
        dispatch(clearAuth());
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
