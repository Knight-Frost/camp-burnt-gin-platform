# Design System Architecture

## Overview

Camp Burnt Gin uses a **single source of truth** design token system built on CSS custom properties, exposed through Tailwind CSS utilities. This architecture ensures consistency, maintainability, and theme support across the entire application.

---

## Token System Architecture

### Authoritative Source

**CSS Variables**: `frontend/src/assets/styles/design-tokens.css`

All design tokens are defined as CSS custom properties with:
- **Light mode defaults** in `:root`
- **Dark mode overrides** in `.dark` class
- **Full Figma alignment** with design specifications
- **Automatic theme switching** via CSS variable resolution

### Integration Flow

```
design-tokens.css (CSS Variables)
    ↓
tailwind.config.ts (Tailwind Theme Extensions)
    ↓
Tailwind Utilities (bg-*, text-*, shadow-*, etc.)
    ↓
Components (React/TSX)
```

---

## Token Categories

### Colors

#### Semantic Colors
Defined as CSS variables, exposed via Tailwind:
- `--primary`, `--secondary`, `--accent`, `--destructive`
- `--background`, `--foreground`, `--card`, `--muted`
- `--border`, `--input`, `--ring`

**Usage:**
```tsx
<div className="bg-background text-foreground border-border" />
```

#### Brand Colors
Premium luminous accent colors for dark mode:
- `--ember-orange`: #f47242
- `--warm-amber`: #fbbf24
- `--forest-green`: #10b981
- `--night-sky-blue`: #60a5fa

**Usage:**
```tsx
<span className="text-warm-amber" />
<div className="bg-ember-orange/20" />
```

#### Status Colors
Full 50-900 scales for semantic status indicators:
- `brand-*`: Sky blue scale
- `success-*`: Green scale
- `warning-*`: Amber scale
- `info-*`: Blue scale
- `danger-*`: Red scale

**Usage:**
```tsx
<span className="bg-success-50 text-success-700 border-success-200" />
<div className="bg-warning-100 text-warning-800" />
```

#### Opacity Variants
Pre-defined overlay and glass effect colors:
- Light mode: `overlay-light`, `glass-overlay`, `glass-strong`, etc.
- Dark mode: `overlay-primary`, `glass-icon-bg`, `glass-footer-dark`, etc.

**Usage:**
```tsx
<div className="bg-overlay-primary border-border-ember" />
<div className="bg-glass-footer-dark backdrop-blur-glass" />
```

---

### Typography

#### Font Families
- `--font-headline`: 'Crimson Pro' (serif headlines)
- `--font-body`: 'Outfit' (sans-serif body text)

**Usage:**
```tsx
<h1 className="font-headline">Camp Burnt Gin</h1>
<p className="font-body">Welcome to our community.</p>
```

#### Font Sizes
Six-tier scale aligned with Figma:
- `--text-xs`: 0.9375rem (15px)
- `--text-sm`: 1.0625rem (17px)
- `--text-base`: 1.25rem (20px) - **Intentionally larger base**
- `--text-lg`: 1.625rem (26px)
- `--text-xl`: 2.25rem (36px)
- `--text-2xl`: 4rem (64px) - Hero text

**Usage:**
```tsx
<h1 className="text-2xl">Hero Heading</h1>
<p className="text-base">Body paragraph with larger base size.</p>
```

---

### Spacing

#### Named Spacing Tokens
Five-tier spacing scale:
- `--spacing-xs`: 0.5rem (8px)
- `--spacing-sm`: 1rem (16px)
- `--spacing-md`: 1.5rem (24px)
- `--spacing-lg`: 2rem (32px)
- `--spacing-xl`: 3rem (48px)

**Usage:**
```tsx
<div className="p-spacing-lg gap-spacing-md" />
```

**Note:** Standard Tailwind spacing (p-4, m-8, etc.) is also available for granular control.

---

### Shadows

#### Light Mode Shadows
- `--shadow-hero-panel`: Subtle hero section shadow
- `--shadow-card`: Standard card elevation
- `--shadow-light-button-primary`: Primary button shadow
- `--shadow-light-button-secondary`: Secondary button shadow
- `--shadow-light-icon`: Icon glow effect

#### Dark Mode Shadows
- `--shadow-ember-primary`: Ember orange glow (primary CTA)
- `--shadow-ember-secondary`: Subtle dark shadow
- `--shadow-amber-glow`: Amber luminous glow

**Usage:**
```tsx
<div className="shadow-hero-panel" />
<button className="shadow-ember-primary" />
```

**Theme Awareness:** Shadows automatically switch between light and dark variants based on theme.

---

### Border Radius

Calculated scale for consistency:
- `--radius-sm`: 6px
- `--radius-md`: 8px
- `--radius-lg`: 10px (base)
- `--radius-xl`: 14px
- `glass`: 1.5rem (24px) - for glassmorphism effects

**Usage:**
```tsx
<div className="rounded-lg" />
<div className="rounded-glass" />
```

---

### Motion & Transitions

#### Transition Durations
Design-driven animation timing:
- `hover`: 400ms - Hover state transitions
- `button`: 500ms - Button interactions
- `content`: 1200ms - Content reveal animations
- `hero`: 1400ms - Hero section animations
- `theme`: 1500ms - Theme toggle transitions

**Usage:**
```tsx
<div className="transition-all duration-hover" />
<motion.div transition={{ duration: 1.4 }}>...</motion.div>
```

#### Backdrop Blur
Glass effect layers:
- `glass`: 16px - Standard glass effect
- `glass-heavy`: 32px - Intense blur for overlays

**Usage:**
```tsx
<div className="backdrop-blur-glass" />
```

---

## Usage Guidelines

### 1. Prefer Tailwind Utilities

**✅ Good:**
```tsx
<div className="bg-brand-500 text-white shadow-hero-panel" />
```

**❌ Avoid:**
```tsx
import { colors } from '@/design-system/tokens';
<div style={{ backgroundColor: colors.brand[500] }} />
```

### 2. Use CSS Variables Directly When Needed

For values not exposed as Tailwind classes:

```tsx
<div style={{ backgroundColor: 'var(--overlay-primary)' }} />
```

### 3. Runtime Animations

Inline styles are acceptable for runtime-calculated values (e.g., dynamic transforms, Framer Motion):

```tsx
<motion.div
  style={{ x: scrollX }}
  animate={{ opacity: isVisible ? 1 : 0 }}
/>
```

### 4. Dark Mode

Use Tailwind's `dark:` variant for theme-aware styling:

```tsx
<div className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white" />
```

---

## Deprecated Files

### ⚠️ Do NOT Import From These Files

The following TypeScript token files are **deprecated** and marked for removal:

- ❌ `src/design-system/tokens/colors.ts`
- ❌ `src/design-system/tokens/elevation.ts`
- ❌ `src/design-system/tokens/glass.ts`
- ❌ `src/design-system/tokens/motion.ts`
- ❌ `src/design-system/tokens/spacing.ts`
- ❌ `src/design-system/tokens/typography.ts`
- ❌ `src/design-system/tokens/index.ts`

**Reason:** Design tokens are now managed exclusively via CSS variables in `design-tokens.css` and exposed through Tailwind utilities. The TypeScript token files represent a parallel, unmaintained system.

**Migration:** Use Tailwind classes instead. See migration guides in each deprecated file's header comment.

---

## Migration Status

### ✅ Completed Phases

1. **Phase 1:** Semantic color scales added to Tailwind config
2. **Phase 2:** Opacity token system implemented
3. **Phase 3:** Shadow system consolidated to CSS variables
4. **Phase 4:** Non-standard CSS removed and global transitions scoped
5. **Phase 5:** TypeScript token files marked as deprecated
6. **Phase 6:** LivingBackground gradient calculations optimized
7. **Phase 7:** Design system documentation created

### System Integrity Achieved

- ✅ All colors defined in CSS variables
- ✅ All shadows defined in CSS variables
- ✅ All opacity variants defined in CSS variables
- ✅ Tailwind config references CSS variables (single source of truth)
- ✅ Components use Tailwind utilities (no direct imports from deprecated tokens)
- ✅ Dark mode fully functional via CSS variable resolution
- ✅ No invalid Tailwind utility classes
- ✅ No invalid `@apply` usage
- ✅ Performance optimized (memoized gradient calculations)

---

## Adding New Tokens

To add new design tokens:

### 1. Define in CSS Variables

**File:** `frontend/src/assets/styles/design-tokens.css`

```css
:root {
  /* Light mode */
  --new-token-name: #value;
}

.dark {
  /* Dark mode override */
  --new-token-name: #dark-value;
}
```

### 2. Expose via Tailwind (if needed)

**File:** `frontend/tailwind.config.ts`

```typescript
extend: {
  colors: {
    'new-token': 'var(--new-token-name)',
  }
}
```

### 3. Use in Components

```tsx
<div className="bg-new-token text-white" />
```

Or directly:

```tsx
<div style={{ color: 'var(--new-token-name)' }} />
```

### 4. Update This Documentation

Add the new token to the appropriate category in this file.

---

## Build Configuration

### Tailwind CSS v4

Uses `@tailwindcss/postcss` package (Tailwind 4 architecture):

**File:** `frontend/postcss.config.js`
```javascript
{
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  }
}
```

### Vite Configuration

**File:** `frontend/vite.config.ts`
- Code splitting optimized for design system chunks
- CSS bundled separately
- Gzip compression enabled

### Performance Budget

Current bundle sizes (gzipped):
- CSS: ~3.7 KB (includes all design tokens)
- Landing page chunk: ~10 KB
- Total vendor chunks: ~130 KB

**Target:** Keep CSS under 5 KB gzipped

---

## Troubleshooting

### Unknown Utility Class Error

**Error:** `Cannot apply unknown utility class 'bg-*'`

**Solution:** Check that:
1. The color/token is defined in `design-tokens.css`
2. The token is exposed in `tailwind.config.ts` (if using as a Tailwind class)
3. The dev server was restarted after adding new tokens

### Dark Mode Not Working

**Solution:** Ensure the parent element has the `dark` class:
```tsx
<html className={isDark ? 'dark' : ''}>
```

### Custom Token Not Applying

**Solution:** Use CSS variable syntax directly:
```tsx
<div style={{ backgroundColor: 'var(--your-token)' }} />
```

Or add it to Tailwind config to use as a utility class.

---

## Resources

- **Tailwind CSS v4 Docs:** https://tailwindcss.com/
- **Framer Motion:** https://www.framer.com/motion/
- **CSS Custom Properties (MDN):** https://developer.mozilla.org/en-US/docs/Web/CSS/--*
- **Figma Design Tokens:** See `FIGMA_DESIGN_TOKENS.md` in project root

---

## Maintenance

### Regular Tasks

1. **Audit token usage:** Ensure no components bypass the design system
2. **Review deprecated files:** Check if TypeScript token files can be deleted
3. **Monitor bundle size:** Keep CSS under performance budget
4. **Update documentation:** Keep this file in sync with changes

### When to Refactor

- Adding more than 10 new tokens → Consider restructuring categories
- CSS file exceeds 500 lines → Consider splitting into modules
- Bundle size exceeds budget → Audit and optimize token usage

---

## Support

For questions or issues with the design system:

1. Check this documentation first
2. Review `design-tokens.css` for token definitions
3. Check `tailwind.config.ts` for Tailwind extensions
4. See individual component implementations for usage examples

---

**Last Updated:** February 2026 (Forensic Audit Phase 7)
**Maintained By:** Development Team
**Architecture:** Single Source of Truth (CSS Variables + Tailwind)
