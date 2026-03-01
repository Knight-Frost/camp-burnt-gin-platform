/**
 * store/index.ts
 * Redux store configuration with redux-persist and HIPAA-required middleware.
 */

import { configureStore } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage/session';
import { authReducer } from '@/features/auth/store/authSlice';
import { phiProtectionMiddleware } from './middleware/phiProtection';

// ---------------------------------------------------------------------------
// Persist config — only the auth slice is persisted
// ---------------------------------------------------------------------------

const authPersistConfig = {
  key: 'auth',
  storage,
  whitelist: ['user', 'token', 'tokenExpiry', 'mfaRequired', 'mfaVerified', 'sessionId'],
};

const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const store = configureStore({
  reducer: {
    auth: persistedAuthReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(phiProtectionMiddleware),
  devTools: import.meta.env.VITE_ENABLE_DEVTOOLS === 'true',
});

export const persistor = persistStore(store);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
