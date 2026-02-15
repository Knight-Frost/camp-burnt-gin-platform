import { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { HelmetProvider } from 'react-helmet-async';
import { store, persistor } from '@/store';
import { ErrorBoundary } from './ErrorBoundary';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Loading component shown during Redux state rehydration
 */
function PersistLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-white dark:bg-neutral-900">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
    </div>
  );
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <Provider store={store}>
          <PersistGate loading={<PersistLoader />} persistor={persistor}>
            {children}
          </PersistGate>
        </Provider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}
