/**
 * ThemeEngine.tsx
 * Provides the ThemeContext value for the application.
 * Preference utilities live in themePreferences.ts (separate file for fast-refresh compat).
 */

import { type ReactNode } from 'react';
import type { ThemeContextValue } from './types';
import { ThemeContext } from './ThemeContext';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value: ThemeContextValue = { resolvedTheme: 'light' };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
