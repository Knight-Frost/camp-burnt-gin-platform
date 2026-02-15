import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import authReducer from '@/features/auth/store/authSlice';
import { phiProtectionMiddleware } from './middleware/phiProtection';
import { correlationIdMiddleware } from './middleware/correlationId';
import { persistConfig } from './persistConfig';

const rootReducer = combineReducers({
  auth: authReducer,
});

const persistedReducer = persistReducer(persistConfig as any, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER, 'auth/setToken', 'auth/setUser'],
        // Ignore these paths in the state for serialization checks
        ignoredPaths: ['auth.token', 'auth.tokenExpiry', '_persist'],
      },
    })
      .prepend(correlationIdMiddleware)
      .concat(phiProtectionMiddleware),
  devTools: import.meta.env.VITE_ENABLE_DEVTOOLS === 'true',
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
