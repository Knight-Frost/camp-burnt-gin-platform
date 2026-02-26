import { createContext, useContext } from 'react';
import type { ThemeContextValue } from './types';

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext must be used within <ThemeProvider>');
  return ctx;
}
