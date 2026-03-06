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
import { useAppDispatch } from '@/store/hooks';
import { setUser, clearAuth, hydrateAuth } from '@/features/auth/store/authSlice';
import { getAuthenticatedUser } from '@/features/auth/api/auth.api';
import { store, persistor } from '@/store';

export function useAuthInit(): void {
  const dispatch = useAppDispatch();
  const hasValidated = useRef(false);

  // Listen for mid-session 401s fired by the axios response interceptor
  useEffect(() => {
    function handleUnauthorized() {
      dispatch(clearAuth());
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [dispatch]);

  // Validate the persisted token AFTER redux-persist rehydration completes.
  // We must NOT read token from useAppSelector here — that would cause the
  // effect to run before rehydration (token=null) and set hasValidated=true,
  // preventing the actual persisted token from ever being checked.
  useEffect(() => {
    function validate() {
      if (hasValidated.current) return;
      hasValidated.current = true;

      const token = store.getState().auth.token;

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
    }

    // If already bootstrapped (e.g. hot reload with no session change), validate immediately
    if (persistor.getState().bootstrapped) {
      validate();
      return;
    }

    // Otherwise wait for rehydration to complete before reading the token
    const unsubscribe = persistor.subscribe(() => {
      if (persistor.getState().bootstrapped) {
        unsubscribe();
        validate();
      }
    });

    return unsubscribe;
  }, [dispatch]);
}
