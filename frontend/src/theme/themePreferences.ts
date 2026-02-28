/**
 * themePreferences.ts
 * Utility functions for reading and applying persistent theme preferences.
 * Separated from ThemeEngine.tsx to satisfy fast-refresh component isolation.
 */

const FONT_SCALE_KEY = 'cbg-font-scale';
const HIGH_CONTRAST_KEY = 'cbg-high-contrast';
const REDUCED_MOTION_KEY = 'cbg-reduced-motion';

export type FontScale = 'small' | 'default' | 'large' | 'xlarge';

export function applyFontScale(scale: FontScale) {
  document.documentElement.setAttribute('data-font-scale', scale);
  try { localStorage.setItem(FONT_SCALE_KEY, scale); } catch { /* noop */ }
}

export function applyHighContrast(enabled: boolean) {
  document.documentElement.setAttribute('data-high-contrast', String(enabled));
  try { localStorage.setItem(HIGH_CONTRAST_KEY, String(enabled)); } catch { /* noop */ }
}

export function applyReducedMotion(enabled: boolean) {
  document.documentElement.setAttribute('data-reduced-motion', String(enabled));
  try { localStorage.setItem(REDUCED_MOTION_KEY, String(enabled)); } catch { /* noop */ }
}

export function getSavedFontScale(): FontScale {
  try {
    const v = localStorage.getItem(FONT_SCALE_KEY);
    if (v === 'small' || v === 'default' || v === 'large' || v === 'xlarge') return v;
  } catch { /* noop */ }
  return 'default';
}

export function getSavedHighContrast(): boolean {
  try { return localStorage.getItem(HIGH_CONTRAST_KEY) === 'true'; } catch { return false; }
}

export function getSavedReducedMotion(): boolean {
  try { return localStorage.getItem(REDUCED_MOTION_KEY) === 'true'; } catch { return false; }
}
