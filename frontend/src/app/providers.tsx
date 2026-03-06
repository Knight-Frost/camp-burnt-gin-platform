import { type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';
import { MotionConfig } from 'framer-motion';
import { store } from '@/store';
import { ErrorBoundary } from './ErrorBoundary';
import { ThemeProvider } from '@/theme/useTheme';

interface AppProvidersProps {
  children: ReactNode;
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
                {children}
                <Toaster
                  position="top-right"
                  richColors
                  closeButton
                  duration={4000}
                />
              </Provider>
            </ThemeProvider>
          </HelmetProvider>
        </ErrorBoundary>
      </MotionConfig>
    </div>
  );
}
