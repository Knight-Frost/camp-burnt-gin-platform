/**
 * store/index.ts
 * Redux store configuration with HIPAA-required middleware.
 * Auth token persistence is handled via localStorage directly (no redux-persist).
 */

import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from '@/features/auth/store/authSlice';
import { phiProtectionMiddleware } from './middleware/phiProtection';

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(phiProtectionMiddleware),
  devTools: import.meta.env.VITE_ENABLE_DEVTOOLS === 'true',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
