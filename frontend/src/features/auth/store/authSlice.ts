import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '@/shared/types/user.types';

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
  isLoading: true, // Start as loading to prevent false redirects
  mfaRequired: false,
  mfaVerified: false,
  sessionId: null,
  lastActivity: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    setToken: (state, action: PayloadAction<{ token: string; expiresIn: number }>) => {
      state.token = action.payload.token;
      state.tokenExpiry = Date.now() + action.payload.expiresIn * 1000;
    },
    setMfaRequired: (state, action: PayloadAction<boolean>) => {
      state.mfaRequired = action.payload;
    },
    setMfaVerified: (state, action: PayloadAction<boolean>) => {
      state.mfaVerified = action.payload;
    },
    setSessionId: (state, action: PayloadAction<string | null>) => {
      state.sessionId = action.payload;
    },
    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    hydrateAuth: (state) => {
      // This will be called after persistence rehydration
      // If we have a token but no user, we should fetch user profile
      state.isLoading = false;
    },
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.tokenExpiry = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.mfaRequired = false;
      state.mfaVerified = false;
      state.sessionId = null;
      state.lastActivity = null;
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

export default authSlice.reducer;
