import { type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';
import { MotionConfig } from 'framer-motion';
import { store, persistor } from '@/store';
import { ErrorBoundary } from './ErrorBoundary';
import { ThemeProvider } from '@/theme/useTheme';

interface AppProvidersProps {
  children: ReactNode;
}

function PersistLoader() {
  return (
    <div
      className="flex h-screen items-center justify-center"
      style={{ background: 'var(--background)' }}
    >
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
        style={{ borderColor: 'var(--ember-orange)', borderTopColor: 'transparent' }}
      />
    </div>
  );
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    // data-cbg-app: scope CSS prefers-reduced-motion overrides to app surfaces only
    <div data-cbg-app style={{ display: 'contents' }}>
      {/* MotionConfig: Framer Motion respects OS prefers-reduced-motion automatically */}
      <MotionConfig reducedMotion="user">
        <ErrorBoundary>
          <HelmetProvider>
            <ThemeProvider>
              <Provider store={store}>
                <PersistGate loading={<PersistLoader />} persistor={persistor}>
                  {children}
                  <Toaster
                    position="top-right"
                    richColors
                    closeButton
                    duration={4000}
                  />
                </PersistGate>
              </Provider>
            </ThemeProvider>
          </HelmetProvider>
        </ErrorBoundary>
      </MotionConfig>
    </div>
  );
}
