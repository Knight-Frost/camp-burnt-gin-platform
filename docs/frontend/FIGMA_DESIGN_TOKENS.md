# Figma Design Token Specification

**Document Version:** 1.1
**Last Updated:** 2026-03-01
**Source:** `frontend/src/assets/styles/design-tokens.css` (canonical implementation)
**Figma Reference:** Figma Designs/Landing page/src/styles/theme.css

> **Note:** The authoritative implementation of all design tokens is the CSS file `frontend/src/assets/styles/design-tokens.css`. This document provides Figma-source context. For the current token values, always refer to the CSS file directly.

---

## 1. Executive Summary

This document defines the authoritative design token specification extracted from the Figma Landing page export. All frontend implementations must adhere to these values without deviation. Design tokens are organized into typography, spacing, color, shadow, blur, animation, and border radius systems.

---

## 2. Purpose and Scope

### 2.1 Purpose

This specification serves as the single source of truth for all visual design values in the Camp Burnt Gin frontend application. It provides exact CSS variable definitions, numeric values, and implementation guidance for maintaining design consistency.

### 2.2 Scope

- Typography system (fonts, scale, weights, letter spacing, line height)
- Spacing scale
- Color system (light mode and dark mode)
- Shadow system
- Blur and backdrop effects
- Animation curves and durations
- Border radius values
- Component-specific patterns

---

## 3. Typography System

### 3.1 Font Families

```css
--font-headline: 'Crimson Pro', Georgia, serif;
--font-body: 'Outfit', system-ui, -apple-system, sans-serif;
```

**Google Fonts Import Requirements:**

- Crimson Pro: weights 500, 600, 700, 800, 900
- Outfit: weights 400, 500, 600, 700

**Import URL:**
```html
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@500;600;700;800;900&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### 3.2 Typography Scale

| Token Name | CSS Variable | Rem Value | Pixel Equivalent | Usage |
|------------|--------------|-----------|------------------|-------|
| text-xs | --text-xs | 0.9375rem | 15px | Smallest text elements |
| text-sm | --text-sm | 1.0625rem | 17px | Small body text |
| text-base | --text-base | 1.25rem | 20px | Base body text (primary) |
| text-lg | --text-lg | 1.625rem | 26px | Large body text |
| text-xl | --text-xl | 2.25rem | 36px | Section headings |
| text-2xl | --text-2xl | 4rem | 64px | Hero headlines |

**Base Font Size:** 16px (defined at root)

### 3.3 Font Weights

**Light Mode:**

```css
--font-weight-medium: 700;
--font-weight-normal: 600;
```

**Dark Mode:**

```css
--font-weight-medium: 500;
--font-weight-normal: 400;
```

### 3.4 Typography Properties

**Body Text:**
```css
font-family: var(--font-body);
line-height: 1.65;
letter-spacing: -0.011em;
```

**Headlines (h1-h6):**
```css
font-family: var(--font-headline);
letter-spacing: -0.022em;
```

**Paragraph Text:**
```css
line-height: 1.7;
```

### 3.5 Dark Mode Text Effects

**Headlines (h1, h2):**
```css
text-shadow: 0 0 40px rgba(255, 255, 255, 0.15), 0 0 20px rgba(255, 255, 255, 0.1);
```

### 3.6 Heading Size Specifications

| Element | Font Size | Font Weight | Line Height |
|---------|-----------|-------------|-------------|
| h1 | var(--text-2xl) | 700 | 1.2 |
| h2 | var(--text-xl) | 700 | 1.3 |
| h3 | var(--text-lg) | 600 | 1.4 |
| h4 | var(--text-base) | 600 | 1.5 |

---

## 4. Spacing System

### 4.1 Spacing Scale

| Token Name | CSS Variable | Rem Value | Pixel Equivalent |
|------------|--------------|-----------|------------------|
| spacing-xs | --spacing-xs | 0.5rem | 8px |
| spacing-sm | --spacing-sm | 1rem | 16px |
| spacing-md | --spacing-md | 1.5rem | 24px |
| spacing-lg | --spacing-lg | 2rem | 32px |
| spacing-xl | --spacing-xl | 3rem | 48px |

### 4.2 Section Padding Standards

**Major Sections:**
- Vertical: 8rem (128px) - Tailwind class `py-32`
- Horizontal: 1.5rem (24px) - Tailwind class `px-6`

**Content Containers:**
- Maximum width: 72rem (1152px) - Tailwind class `max-w-6xl`
- Centered: `mx-auto`

---

## 5. Color System

### 5.1 Light Mode Color Tokens

```css
--background: #f8f7f4;
--foreground: #1a1a1a;
--card: rgba(255, 254, 252, 0.97);
--card-foreground: #1a1a1a;
--popover: #ffffff;
--popover-foreground: #1a1a1a;
--primary: #1a1a1a;
--primary-foreground: #ffffff;
--secondary: #64748b;
--secondary-foreground: #1a1a1a;
--muted: #e8e6e3;
--muted-foreground: #475569;
--accent: #3b82f6;
--accent-foreground: #ffffff;
--destructive: #dc2626;
--destructive-foreground: #ffffff;
--border: rgba(71, 85, 105, 0.2);
--input: transparent;
--input-background: rgba(226, 232, 240, 0.6);
--switch-background: #64748b;
```

**Navigation-Specific Colors:**
```css
--nav-text: rgba(26, 26, 26, 0.95);
--nav-text-active: rgba(26, 26, 26, 1);
```

**Camp Time-of-Day Colors:**
```css
--camp-morning: #d5e8f2;
--camp-day: #e1f2e8;
--camp-afternoon: #f5ead9;
--camp-evening: #dbeafe;
--camp-night: #1e293b;
```

### 5.2 Dark Mode Color Tokens

```css
--background: #000000;
--foreground: #ffffff;
--card: rgba(10, 10, 10, 0.85);
--card-foreground: #ffffff;
--popover: rgba(5, 5, 5, 0.98);
--popover-foreground: #ffffff;
--primary: #ffffff;
--primary-foreground: #000000;
--secondary: rgba(244, 114, 66, 0.2);
--secondary-foreground: #ffffff;
--muted: rgba(20, 20, 20, 0.8);
--muted-foreground: rgba(255, 255, 255, 0.7);
--accent: rgba(251, 191, 36, 0.25);
--accent-foreground: #ffffff;
--destructive: rgba(248, 113, 113, 0.9);
--destructive-foreground: #ffffff;
--border: rgba(255, 255, 255, 0.15);
--input: rgba(20, 20, 20, 0.6);
--ring: rgba(255, 255, 255, 0.3);
```

**Navigation-Specific Colors:**
```css
--nav-text: rgba(255, 255, 255, 0.9);
--nav-text-active: rgba(255, 255, 255, 1);
```

**Luminous Accent Colors:**
```css
--ember-orange: #f47242;
--warm-amber: #fbbf24;
--forest-green: #10b981;
--night-sky-blue: #60a5fa;
```

---

## 6. Shadow System

### 6.1 Light Mode Shadows

**Hero Panel:**
```css
box-shadow: 0 20px 80px rgba(26, 26, 26, 0.08);
```

**Primary Button:**
```css
box-shadow: 0 8px 32px rgba(26, 26, 26, 0.25), 0 4px 16px rgba(26, 26, 26, 0.15);
```

**Secondary Button:**
```css
box-shadow: 0 4px 24px rgba(26, 26, 26, 0.12), 0 2px 12px rgba(26, 26, 26, 0.08);
```

**Value Icons:**
```css
box-shadow: 0 8px 24px rgba(200, 149, 110, 0.2), 0 0 0 1px rgba(200, 149, 110, 0.25);
```

**Image Cards:**
```css
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
```

### 6.2 Dark Mode Shadows

**Primary Button (Ember Glow):**
```css
box-shadow: 0 8px 32px rgba(244, 114, 66, 0.5),
            0 0 40px rgba(244, 114, 66, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
border: 1px solid rgba(244, 114, 66, 0.4);
```

**Secondary Button (Glass Effect):**
```css
box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.15),
            0 0 0 1px rgba(255, 255, 255, 0.15);
border: 1px solid rgba(255, 255, 255, 0.15);
```

**Value Icons (Amber Glow):**
```css
box-shadow: 0 12px 32px rgba(251, 191, 36, 0.35),
            0 0 24px rgba(251, 191, 36, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
```

### 6.3 Proposed Shadow Token Names

| Token Name | Theme | Usage |
|------------|-------|-------|
| shadow-hero-panel | light | Hero section background panel |
| shadow-button-primary-light | light | Primary CTA buttons |
| shadow-button-secondary-light | light | Secondary action buttons |
| shadow-icon-light | light | Value/feature icons |
| shadow-card | both | Image and content cards |
| shadow-button-primary-dark | dark | Primary CTA buttons with ember glow |
| shadow-button-secondary-dark | dark | Secondary buttons with glass effect |
| shadow-icon-dark | dark | Icons with amber glow |

---

## 7. Blur and Backdrop Effects

### 7.1 Backdrop Blur Values

**Dark Mode:**
```css
backdrop-filter: blur(16px);
```

**Light Mode:**
```css
backdrop-filter: none;
```

### 7.2 Implementation Rule

Blur effects are applied exclusively in dark mode. Light mode maintains clean, high-contrast appearance without blur.

---

## 8. Border Radius System

### 8.1 Border Radius Scale

```css
--radius: 0.625rem; /* 10px base */
--radius-sm: calc(var(--radius) - 4px);  /* 6px */
--radius-md: calc(var(--radius) - 2px);  /* 8px */
--radius-lg: var(--radius);              /* 10px */
--radius-xl: calc(var(--radius) + 4px);  /* 14px */
```

### 8.2 Component-Specific Radius

| Component | Radius Value | Tailwind Class |
|-----------|--------------|----------------|
| Buttons | 9999px | rounded-full |
| Cards | 24px | rounded-3xl |
| Panels | 24px | rounded-3xl |

---

## 9. Animation System

### 9.1 Easing Curve

**Primary Easing (All Animations):**
```css
cubic-bezier(0.25, 0.1, 0.25, 1)
```

### 9.2 Duration Scale

| Duration Name | Value | Usage |
|---------------|-------|-------|
| Element Hover | 0.4s | Icon and small element hover states |
| Button Interaction | 0.5s | Button hover and focus states |
| Content Animation | 1.2s | Fade-in and slide animations for content |
| Hero Animation | 1.4s | Hero section entrance animations |
| Theme Transition | 1.5s | Light/dark mode switching |

### 9.3 Transition Specifications

**Root and Theme Toggle:**
```css
transition: background-color 1.5s cubic-bezier(0.25, 0.1, 0.25, 1),
            color 1.5s cubic-bezier(0.25, 0.1, 0.25, 1);
```

**Universal Elements:**
```css
transition-property: background-color, border-color, color, fill, stroke;
transition-duration: 1.2s;
transition-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
```

**Interactive Elements (button, a, input, textarea):**
```css
transition-duration: 0.5s;
```

---

## 10. Layout Grid System

### 10.1 Maximum Width Containers

| Max Width | Rem Value | Pixel Equivalent | Tailwind Class | Usage |
|-----------|-----------|------------------|----------------|-------|
| Narrow | 48rem | 768px | max-w-3xl | Body text, narrow content |
| Medium | 56rem | 896px | max-w-4xl | Image sections |
| Wide | 64rem | 1024px | max-w-5xl | Hero content |
| Full | 72rem | 1152px | max-w-6xl | Section containers |

### 10.2 Responsive Breakpoints

```css
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
```

---

## 11. Component Pattern Specifications

### 11.1 Primary Button (Dark Mode)

```tsx
backgroundColor: 'rgba(244, 114, 66, 0.25)'
color: '#ffffff'
fontSize: '1.125rem'
fontWeight: 600
padding: '1.25rem 2.5rem'
boxShadow: '0 8px 32px rgba(244, 114, 66, 0.5), 0 0 40px rgba(244, 114, 66, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
border: '1px solid rgba(244, 114, 66, 0.4)'
borderRadius: '9999px'
backdropFilter: 'blur(16px)'
```

### 11.2 Primary Button (Light Mode)

```tsx
backgroundColor: 'rgba(26, 26, 26, 0.95)'
color: '#ffffff'
fontSize: '1.125rem'
fontWeight: 600
padding: '1.25rem 2.5rem'
boxShadow: '0 8px 32px rgba(26, 26, 26, 0.25), 0 4px 16px rgba(26, 26, 26, 0.15)'
border: '1px solid rgba(26, 26, 26, 0.3)'
borderRadius: '9999px'
backdropFilter: 'none'
```

### 11.3 Secondary Button (Dark Mode)

```tsx
backgroundColor: 'rgba(15, 15, 15, 0.8)'
color: 'rgba(255, 255, 255, 0.95)'
fontSize: '1.125rem'
fontWeight: 600
padding: '1.25rem 2.5rem'
boxShadow: '0 4px 24px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.15)'
border: '1px solid rgba(255, 255, 255, 0.15)'
borderRadius: '9999px'
backdropFilter: 'blur(16px)'
```

### 11.4 Secondary Button (Light Mode)

```tsx
backgroundColor: 'rgba(255, 255, 255, 0.95)'
color: 'rgba(26, 26, 26, 1)'
fontSize: '1.125rem'
fontWeight: 600
padding: '1.25rem 2.5rem'
boxShadow: '0 4px 24px rgba(26, 26, 26, 0.12), 0 2px 12px rgba(26, 26, 26, 0.08)'
border: '1px solid rgba(26, 26, 26, 0.15)'
borderRadius: '9999px'
backdropFilter: 'none'
```

### 11.5 Icon Container (Dark Mode)

```tsx
width: '4rem'
height: '4rem'
backgroundColor: 'rgba(251, 191, 36, 0.2)'
boxShadow: '0 12px 32px rgba(251, 191, 36, 0.35), 0 0 24px rgba(251, 191, 36, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
borderRadius: '9999px'
backdropFilter: 'blur(16px)'
```

### 11.6 Icon Container (Light Mode)

```tsx
width: '4rem'
height: '4rem'
backgroundColor: 'rgba(232, 215, 187, 0.9)'
boxShadow: '0 8px 24px rgba(200, 149, 110, 0.2), 0 0 0 1px rgba(200, 149, 110, 0.25)'
borderRadius: '9999px'
```

---

## 12. CSS Variable Mapping Strategy

### 12.1 Tailwind Configuration Integration

All design tokens should be mapped to Tailwind configuration as follows:

**Typography:**
```typescript
fontSize: {
  xs: 'var(--text-xs)',
  sm: 'var(--text-sm)',
  base: 'var(--text-base)',
  lg: 'var(--text-lg)',
  xl: 'var(--text-xl)',
  '2xl': 'var(--text-2xl)',
}
```

**Spacing:**
```typescript
spacing: {
  'xs': 'var(--spacing-xs)',
  'sm': 'var(--spacing-sm)',
  'md': 'var(--spacing-md)',
  'lg': 'var(--spacing-lg)',
  'xl': 'var(--spacing-xl)',
}
```

**Colors:**
```typescript
colors: {
  background: 'var(--background)',
  foreground: 'var(--foreground)',
  primary: 'var(--primary)',
  secondary: 'var(--secondary)',
  muted: 'var(--muted)',
  accent: 'var(--accent)',
  'ember-orange': 'var(--ember-orange)',
  'warm-amber': 'var(--warm-amber)',
}
```

### 12.2 CSS Custom Property File Structure

Create a dedicated `design-tokens.css` file importing into the global stylesheet:

```css
@layer base {
  :root {
    /* Typography tokens */
    --text-xs: 0.9375rem;
    --text-sm: 1.0625rem;
    /* ... */

    /* Spacing tokens */
    --spacing-xs: 0.5rem;
    /* ... */

    /* Color tokens (light mode) */
    --background: #f8f7f4;
    /* ... */
  }

  .dark {
    /* Color tokens (dark mode) */
    --background: #000000;
    /* ... */
  }
}
```

---

## 13. Token Naming Conventions

### 13.1 General Rules

1. Use kebab-case for all token names
2. Prefix tokens with their category (text-, spacing-, color-)
3. Use semantic names over descriptive names where possible
4. Theme-specific values use the same variable name with theme-based overrides

### 13.2 Examples

**Correct:**
- `--text-base`
- `--spacing-lg`
- `--ember-orange`

**Incorrect:**
- `--textBase` (camelCase)
- `--large-spacing` (reversed order)
- `--orange-for-ember-buttons` (overly descriptive)

---

## 14. Maintenance and Versioning

### 14.1 Change Control

Any modification to design tokens must:

1. Update this specification document
2. Update CSS custom property definitions
3. Update Tailwind configuration
4. Verify no breaking changes in existing components
5. Update version number and last updated date

### 14.2 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-14 | Initial specification extracted from Figma export |

---

## 15. Conclusion

This specification provides a complete, authoritative definition of all design tokens for the Camp Burnt Gin landing page. Implementation teams must adhere strictly to these values to maintain design consistency and visual fidelity with the Figma design source.
