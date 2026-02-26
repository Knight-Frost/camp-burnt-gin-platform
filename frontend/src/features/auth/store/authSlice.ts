/**
 * authSlice.ts
 * Redux slice for authentication state.
 * Manages user, token, MFA state, and session metadata.
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '@/shared/types';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface AuthState {
  user: User | null;
  token: string | null;
  tokenExpiry: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaRequired: boolean;
  mfaVerified: boolean;
  sessionId: string | null;
  lastActivity: number | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  tokenExpiry: null,
  isAuthenticated: false,
  isLoading: true, // starts true — ProtectedRoute shows loader until resolved
  mfaRequired: false,
  mfaVerified: false,
  sessionId: null,
  lastActivity: null,
};

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Set the authenticated user and mark as authenticated */
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
      state.isAuthenticated = action.payload !== null;
    },

    /** Store the Bearer token and compute its expiry timestamp */
    setToken(
      state,
      action: PayloadAction<{ token: string; expiresIn?: number }>
    ) {
      state.token = action.payload.token;
      state.tokenExpiry = action.payload.expiresIn
        ? Date.now() + action.payload.expiresIn * 1000
        : null;
    },

    /** Signal that MFA is required before accessing the app */
    setMfaRequired(state, action: PayloadAction<boolean>) {
      state.mfaRequired = action.payload;
    },

    /** Signal that the user has completed MFA verification */
    setMfaVerified(state, action: PayloadAction<boolean>) {
      state.mfaVerified = action.payload;
    },

    /** Store the current session identifier */
    setSessionId(state, action: PayloadAction<string | null>) {
      state.sessionId = action.payload;
    },

    /** Update the last activity timestamp (for session timeout tracking) */
    updateLastActivity(state) {
      state.lastActivity = Date.now();
    },

    /** Manually control the loading flag */
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },

    /**
     * Called after redux-persist rehydration completes.
     * Sets isLoading to false so ProtectedRoute can evaluate auth state.
     */
    hydrateAuth(state) {
      state.isLoading = false;
    },

    /** Full state reset — called on logout or 401 */
    clearAuth() {
      return { ...initialState, isLoading: false };
    },
  },
});

export const {
  setUser,
  setToken,
  setMfaRequired,
  setMfaVerified,
  setSessionId,
  updateLastActivity,
  setLoading,
  hydrateAuth,
  clearAuth,
} = authSlice.actions;

export const authReducer = authSlice.reducer;
