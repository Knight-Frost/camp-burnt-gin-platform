/**
 * providers.tsx — Global provider wrapper
 *
 * Wraps every page in the app with all the shared "context" systems it needs.
 * Providers are nested like Russian dolls — each one adds a capability that
 * all child components can use.
 *
 * Order (outermost → innermost):
 * 1. ErrorBoundary  — catches unexpected crashes and shows a friendly error screen
 * 2. HelmetProvider — lets pages safely set <title> and <meta> tags
 * 3. ThemeProvider  — manages light/dark theme tokens
 * 4. Provider       — makes the Redux store available everywhere via useAppSelector/Dispatch
 * 5. Toaster        — displays toast notification pop-ups in the top-right corner
 */

import { type ReactNode } from 'react';
// Provider connects the Redux store to all React components
import { Provider } from 'react-redux';
// HelmetProvider enables async-safe <Helmet> head tag management
import { HelmetProvider } from 'react-helmet-async';
// Toaster renders the global toast notification stack
import { Toaster } from 'sonner';
import { store } from '@/store';
import { ErrorBoundary } from './ErrorBoundary';
import { ThemeProvider } from '@/theme/useTheme';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    // data-cbg-app: a CSS attribute that scopes prefers-reduced-motion overrides
    // to only affect app surfaces (not marketing pages or iframes)
    // display:contents means this div has no visual effect — it's invisible to layout
    <div data-cbg-app style={{ display: 'contents' }}>
      {/* ErrorBoundary catches any JavaScript crash below this point */}
      <ErrorBoundary>
        {/* HelmetProvider lets child components set <head> tags safely */}
        <HelmetProvider>
          {/* ThemeProvider reads user theme preference and applies CSS token values */}
          <ThemeProvider>
            {/* Provider makes the Redux store accessible to all components */}
            <Provider store={store}>
              {children}
              {/* Toaster renders toast messages; richColors adds green/red styling */}
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
    </div>
  );
}
