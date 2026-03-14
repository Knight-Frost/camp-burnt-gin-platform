/**
 * useAuthInit.ts — App-startup authentication hydration hook
 *
 * Called once in App.tsx when the app first mounts. It handles the common scenario
 * where a user refreshes the page — they have a valid token saved in localStorage
 * but Redux is empty because page refresh wipes in-memory state.
 *
 * What it does:
 * 1. Registers a global listener for the 'auth:unauthorized' custom window event.
 *    The axios interceptor fires this event when any protected API request gets a
 *    401 mid-session (e.g. the token silently expired while the user was browsing).
 * 2. On mount, reads the token from localStorage and calls GET /api/user to
 *    validate it. If valid, restores the Redux auth state so the user stays logged in.
 *    If invalid or absent, clears auth state and lets ProtectedRoute redirect to /login.
 *
 * The eslint-disable comment on the second useEffect is intentional — that effect
 * should only ever run once on mount, not re-run when dispatch changes.
 */

import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { setUser, setToken, clearAuth, hydrateAuth } from '@/features/auth/store/authSlice';
import { getAuthenticatedUser } from '@/features/auth/api/auth.api';

export function useAuthInit(): void {
  const dispatch = useAppDispatch();
  // Guards against firing multiple simultaneous re-validations when multiple
  // API calls return 401 at the same time (e.g., on a page with several fetches).
  const isRevalidating = useRef(false);

  // Effect 1: Listen for mid-session 401s fired by the axios response interceptor.
  // Rather than immediately destroying the session, first re-validate with GET /api/user.
  // This prevents a single misconfigured endpoint (or a transient 401) from logging
  // the user out when their token is actually still valid.
  useEffect(() => {
    function handleUnauthorized() {
      // De-duplicate: if a re-validation is already in flight, ignore this event.
      if (isRevalidating.current) return;
      isRevalidating.current = true;

      getAuthenticatedUser()
        .then((user) => {
          // Token is valid — the 401 came from a specific endpoint, not the session.
          // Keep the user logged in and update the user object in case it drifted.
          dispatch(setUser(user));
        })
        .catch(() => {
          // Confirmed: the token itself is invalid. Clear everything and redirect to login.
          localStorage.removeItem('auth_token');
          dispatch(clearAuth());
        })
        .finally(() => {
          isRevalidating.current = false;
        });
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    // Cleanup: remove the listener when the component unmounts to avoid memory leaks
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [dispatch]);

  // Effect 2: On mount, restore the session if a token exists in localStorage
  useEffect(() => {
    const token = localStorage.getItem('auth_token');

    // No stored token — nothing to restore, mark hydration complete immediately
    if (!token) {
      dispatch(hydrateAuth());
      return;
    }

    // Token found — validate it with the API to ensure it's still active.
    // Uses a retry loop: transient failures (network errors, 5xx) retry up to 2 times
    // before giving up, keeping isLoading true during retries so ProtectedRoute shows
    // a spinner rather than immediately redirecting to /login.
    let cancelled = false;

    function tryValidate(retryCount: number) {
      getAuthenticatedUser()
        .then((user) => {
          if (cancelled) return;
          dispatch(setToken({ token: token as string }));
          dispatch(setUser(user));
          dispatch(hydrateAuth());
        })
        .catch(() => {
          if (cancelled) return;
          // If the token was removed, the axios interceptor already fired
          // auth:unauthorized (a real 401) — clear auth and redirect to login.
          if (!localStorage.getItem('auth_token')) {
            dispatch(clearAuth());
            return;
          }
          // Transient failure: retry with a 2-second delay, keeping the spinner
          // visible so the user is not immediately kicked to /login.
          if (retryCount < 2) {
            setTimeout(() => tryValidate(retryCount + 1), 2000);
          } else {
            // Retries exhausted — stop loading. isAuthenticated stays false so
            // ProtectedRoute redirects to /login. The token remains in localStorage,
            // so the next page load will attempt validation again.
            dispatch(hydrateAuth());
          }
        });
    }

    tryValidate(0);
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
