import { PersistConfig } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

/**
 * Redux Persist Configuration
 *
 * Persists auth state to localStorage to maintain authentication
 * across page refreshes and browser sessions.
 *
 * Security considerations:
 * - Tokens are stored in localStorage (consider httpOnly cookies for production)
 * - Use secure token rotation and refresh mechanisms
 * - Clear persisted state on explicit logout
 */
export const persistConfig: PersistConfig<any> = {
  key: 'camp-burnt-gin-root',
  version: 1,
  storage,
  // Only persist auth state
  whitelist: ['auth'],
  // Blacklist sensitive fields that should not persist
  blacklist: [],
};
