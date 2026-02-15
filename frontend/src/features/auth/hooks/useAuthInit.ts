import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setLoading } from '../store/authSlice';

/**
 * Auth Initialization Hook
 *
 * Handles authentication state hydration on app startup.
 * This hook should be called once in the root App component.
 *
 * Flow:
 * 1. Redux persist rehydrates state from localStorage
 * 2. This hook checks if we have a token
 * 3. If token exists and is valid, optionally fetch fresh user profile
 * 4. Set isLoading = false to allow app to render
 *
 * Note: For MVP, we rely on persisted user state.
 * In production, add token validation and profile refresh here.
 */
export function useAuthInit() {
  const dispatch = useAppDispatch();
  const { token, isLoading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // Initialize auth state
    const initAuth = async () => {
      try {
        // TODO: In production, validate token and fetch fresh user profile
        // For now, we trust the persisted state
        if (token) {
          // Token exists - could validate/refresh here
          // const user = await fetchUserProfile();
          // dispatch(setUser(user));
        }
      } catch (error) {
        // If token is invalid, it will be handled by API interceptors
        console.error('Auth initialization error:', error);
      } finally {
        // Always set loading to false when done
        dispatch(setLoading(false));
      }
    };

    // Only run if still loading
    if (isLoading) {
      initAuth();
    }
  }, [dispatch, token, isLoading]);
}
