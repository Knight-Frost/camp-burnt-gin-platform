import { useThemeContext } from '@/theme/useTheme';

/**
 * Convenience wrapper — exposes resolvedTheme plus isDark boolean.
 * isDark is always false (app is permanently light mode).
 */
export function useTheme() {
  const ctx = useThemeContext();
  return { ...ctx, isDark: false };
}
