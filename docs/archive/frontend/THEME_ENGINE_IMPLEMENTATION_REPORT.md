# Theme Engine Implementation Report

**Date:** 2026-02-22
**Branch:** frontend
**Backend modified:** No

---

## Overview

A Dynamic Environmental Theme Engine has been implemented across the entire frontend. This system replaces the previous single-mode (dark-only) approach with a centralized, performance-optimized theme provider supporting four modes and two seasonal palettes with full persistence.

---

## Files Created

| File | Purpose |
|------|---------|
| `src/theme/types.ts` | `Mode`, `Season`, `ThemeState`, `ThemeContextValue` type definitions |
| `src/theme/ThemeContext.ts` | React context instance + `useThemeContext` hook (isolated from component to satisfy react-refresh) |
| `src/theme/ThemeEngine.tsx` | `ThemeProvider` component — manages state, DOM mutation, system listener, auto-mode interval |
| `src/theme/gradients.ts` | Memoized gradient color pools + `getDynamicColors()` pure function |
| `src/theme/useTheme.ts` | Public barrel — re-exports `ThemeProvider`, `useThemeContext`, all types |
| `src/ui/components/ThemeControls.tsx` | Mode + season selector UI — glass-morphism, accessible, keyboard-operable |

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Added `data-theme`/`data-season` attributes to `<html>` + inline anti-flicker script |
| `src/assets/styles/design-tokens.css` | Added `[data-theme='light']` token overrides, `[data-season='summer/winter']` tonal adjustments, `.accent-shimmer` utility, compound season+theme selectors |
| `src/features/public/landing/hooks/useTheme.ts` | Replaced stub with backward-compatible wrapper around `useThemeContext`; re-exposes `isDark` convenience boolean |
| `src/features/public/landing/components/LivingBackground.tsx` | Replaced inline `getScrollBasedGradientColors()` with `getDynamicColors()` from gradient engine; vignette sourced from gradient pool |
| `src/features/public/landing/components/AmbientParticles.tsx` | Theme-aware particle color via `themeRef` (RAF loop reads ref; no teardown on theme change) |
| `src/app/providers.tsx` | Inserted `<ThemeProvider>` wrapping the Redux+Persist stack |
| `src/features/public/landing/components/LandingNav.tsx` | Theme-aware nav background, text, shadow, mobile overlay colors; added `<ThemeControls />` to desktop and mobile nav |

---

## State Architecture

```
ThemeContext (createContext)
  └── ThemeProvider (manages)
        ├── mode: Mode             ← persisted to localStorage['theme-mode']
        ├── season: Season         ← persisted to localStorage['theme-season']
        ├── resolvedTheme          ← derived from mode (+ system/time detection)
        └── resolvedSeason         ← 'summer' | 'winter' (auto-detected from month if season='auto')
```

`resolvedTheme` is written to:
- `document.documentElement.setAttribute('data-theme', ...)`
- `document.documentElement.classList.toggle('dark', ...)`

`resolvedSeason` is written to:
- `document.documentElement.setAttribute('data-season', ...)`

All CSS variables are derived from these two attributes.

---

## Mode Behavior

| Mode | Behavior |
|------|----------|
| `dark` | Always dark |
| `light` | Always light |
| `system` | Mirrors OS `prefers-color-scheme`; live `matchMedia` listener updates without reload |
| `auto` | Time-based: 5 am–8 pm → light, 8 pm–5 am → dark; recalculates every 60 seconds |

---

## Season Logic

```typescript
const month = new Date().getMonth(); // 0-indexed
season === 'auto'
  ? (month >= 4 && month <= 8 ? 'summer' : 'winter')  // May–September
  : season  // manual override
```

Season influences accent color warmth/coolness and background tint via `[data-season]` CSS overrides. It does not change the fundamental dark/light split.

---

## Gradient System

**File:** `src/theme/gradients.ts`

Four memoized gradient pools — one per `${resolvedTheme}-${resolvedSeason}` combination:

| Key | Character |
|-----|-----------|
| `dark-summer` | Jet black, warm ember undertones (campfire glow) |
| `dark-winter` | Jet black, cool starlit blue undertones |
| `light-summer` | Warm cream, golden-honey tones |
| `light-winter` | Cool silver-white, icy blue-grey tones |

Each pool defines RGB triplet pairs for three gradient positions × two scroll phases × two time phases. The `getDynamicColors()` function is a pure function — no allocations beyond small `number[]` intermediaries — called inside LivingBackground's RAF loop.

**Crossfade:** Framer Motion's `animate={{ background: ... }}` with `duration: 8` and custom cubic-bezier produces a 400–700 ms perceptual crossfade between gradient states. `willChange: 'background'` on the layer promotes to GPU compositor.

---

## Accent Shimmer

Applied to elements with `.accent-shimmer` utility class.

```css
@keyframes accent-shimmer {
  0%, 100% { background-position: 0% 50%; }
  50%       { background-position: 100% 50%; }
}

[data-theme='light'] .accent-shimmer { animation: accent-shimmer 5s ease-in-out infinite; }
[data-theme='dark']  .accent-shimmer { animation: none; }
```

Applied in `LandingNav` to the active page underline indicator. The shimmer runs only in light mode — in dark mode the indicator renders as a static white/ember line.

---

## Zero-Flicker Strategy

1. `index.html` contains an inline synchronous script that executes before first paint
2. Script reads `localStorage['theme-mode']` and `localStorage['theme-season']`
3. Resolves theme (including system and auto logic) immediately
4. Sets `data-theme`, `data-season`, and `dark` class on `<html>` synchronously
5. React `ThemeProvider` initializes state from the same localStorage keys — no mismatch, no flash

---

## Performance Safeguards

| Concern | Mitigation |
|---------|-----------|
| Full app re-render on theme change | Only CSS variables update via `[data-theme]` attribute; React state isolated in ThemeProvider subtree |
| LivingBackground re-render budget | Gradient colors computed in RAF loop; no new arrays created per render (module-level constants) |
| System mode memory leak | `matchMedia` listener removed on cleanup / when mode changes away from 'system' |
| Auto mode memory leak | `setInterval` cleared in useEffect cleanup and on mode change |
| GPU compositing | `willChange: 'background'` and `willChange: 'transform, opacity'` on animated layers |
| Canvas teardown on theme change | AmbientParticles reads theme from a `useRef` inside the RAF draw loop — canvas never re-created |

---

## CSS Token Architecture

Dark mode tokens live in `:root` (the default). Light mode overrides live in `[data-theme='light']`. Season tweaks live in `[data-season='summer/winter']`. Compound overrides (e.g. light+summer background tint) use `[data-theme='light'][data-season='summer']`.

All components that reference CSS custom properties (`var(--background)`, `var(--glass-overlay)`, etc.) automatically respond to theme/season changes with the 1.5 s transition declared on `:root`.

---

## Backend Status

**No backend files were modified.**
The theme engine is entirely a frontend concern: localStorage, CSS variables, DOM attributes, and React context.

---

## Build Verification

```
pnpm run lint        → 0 errors, 0 warnings
pnpm run type-check  → 0 errors
pnpm run build       → 0 errors, 2146 modules, built in 2.99s
```
