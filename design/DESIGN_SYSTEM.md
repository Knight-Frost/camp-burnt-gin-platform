# Camp Burnt Gin Platform — Design Specification

> **Document Status: Informational — Historical Design Concept (Superseded)**
>
> This document captures the pre-implementation design concept and was the working specification during initial UI/UX planning. The final implemented system diverged significantly from this concept in several key areas:
>
> | Aspect | This Document (Concept) | Implemented System |
> |--------|------------------------|-------------------|
> | Color theme | Jet-black dark mode as flagship | Permanent light mode (no dark mode) |
> | Brand accent | Ember orange `#f47242` | Emerald green `#16a34a` |
> | Application type | Public landing page + auth pages | Portal-only (no landing page; `/` → `/login`) |
> | Background | Animated LivingBackground with particles | Static dashboard surfaces |
> | Navigation | Global floating nav bar | Role-based sidebar navigation within portals |
> | Theme switching | User-controlled dark/light toggle | Not implemented (light mode only) |
> | Tailwind version | v4 (Tailwind v4) | v3.4 |
> | Routing | React Router v7 Data Mode | React Router v6 declarative |
>
> **Authoritative references for the implemented design system:**
> - Token definitions: `frontend/src/assets/styles/design-tokens.css`
> - Design system documentation: `docs/frontend/DESIGN_SYSTEM.md`
> - Component catalog: `docs/frontend/COMPONENT_GUIDE.md`
> - Frontend implementation guide: `frontend/FRONTEND_GUIDE.md`
>
> This document is retained for historical reference and traceability of design decisions.

---

**Version:** 2.0
**Last Updated:** February 21, 2026
**Flagship Mode:** Jet-Black Dark Mode (concept — not implemented; see note above)
**Design Philosophy:** Calm, human, cinematic; emotionally safe with reduced cognitive load

---

## 1. Layout Hierarchy

### 1.1 Global Layout Structure

```
Root Container
├── LivingBackground (fixed, z-0)
│   ├── Gradient Layer (radial morphing gradients)
│   ├── Image Layer - Dual Crossfade System (campfire/evening priority)
│   ├── Texture Layer (subtle noise)
│   ├── AmbientParticles (canvas-based)
│   └── Vignette Layer (cinematic edge darkening)
├── Navigation (fixed top, z-50)
│   ├── Logo (left)
│   ├── Nav Items (center)
│   └── Language Toggle (right)
├── Main Content (relative, z-10)
│   └── Page Router
│       ├── Hero Section (min-h-screen, centered)
│       ├── Content Sections (max-w-7xl, centered)
│       └── Footer
└── PageTransition (AnimatePresence wrapper)
```

### 1.2 Section Breakdown

#### Hero Section
- **Container:** `min-h-screen flex items-center justify-center px-6 py-32`
- **Max Width:** `5xl` (1024px)
- **Alignment:** Center-aligned text and content
- **Z-Index:** `z-10` (above background)

#### Content Sections
- **Container:** `max-w-7xl mx-auto px-6 py-20`
- **Grid System:** CSS Grid or Flexbox
- **Gap:** `1.5rem` to `3rem` between elements

#### Authentication Pages
- **Container:** `min-h-screen flex items-center justify-center px-6 py-32`
- **Form Width:** `max-w-md` (448px)
- **Glass Panel:** `rounded-3xl p-10`

---

## 2. Typography System

### 2.1 Font Families

```css
--font-headline: 'Crimson Pro', Georgia, serif;
--font-body: 'Outfit', system-ui, -apple-system, sans-serif;
```

**Imports:**
```css
@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@500;600;700;800;900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');
```

### 2.2 Type Scale

```css
--text-xs: 0.9375rem;     /* 15px */
--text-sm: 1.0625rem;     /* 17px */
--text-base: 1.25rem;     /* 20px */
--text-lg: 1.625rem;      /* 26px */
--text-xl: 2.25rem;       /* 36px */
--text-2xl: 4rem;         /* 64px */
```

### 2.3 Semantic Typography

| Element | Font Family | Size | Weight | Line Height | Letter Spacing |
|---------|-------------|------|--------|-------------|----------------|
| **h1** | Crimson Pro | `var(--text-2xl)` 4rem | 700 | 1.2 | -0.022em |
| **h2** | Crimson Pro | `var(--text-xl)` 2.25rem | 700 | 1.3 | -0.022em |
| **h3** | Crimson Pro | `var(--text-lg)` 1.625rem | 600 | 1.4 | -0.022em |
| **h4** | Crimson Pro | `var(--text-base)` 1.25rem | 600 | 1.5 | -0.022em |
| **body** | Outfit | 16px (base) | 400 | 1.65 | -0.011em |
| **p** | Outfit | 16px | 400 | 1.7 | -0.011em |
| **button** | Crimson Pro | `var(--text-base)` 1.25rem | 500 | 1.5 | -0.011em |
| **label** | Outfit | `var(--text-base)` 1.25rem | 500 | 1.5 | -0.011em |
| **input** | Outfit | `var(--text-base)` 1.25rem | 400 | 1.5 | -0.011em |

### 2.4 Font Weight Variables

```css
/* Light Mode */
--font-weight-medium: 700;  /* MUCH HEAVIER for light mode */
--font-weight-normal: 600;  /* MUCH HEAVIER base weight */

/* Dark Mode */
--font-weight-medium: 500;
--font-weight-normal: 400;
```

### 2.5 Special Typography Effects

**Dark Mode Text Glow (h1, h2 only):**
```css
text-shadow: 0 0 40px rgba(255, 255, 255, 0.15), 
             0 0 20px rgba(255, 255, 255, 0.1);
```

### 2.6 Responsive Hero Text

**Dark Mode:**
```css
font-size: clamp(2.5rem, 7vw, 4.5rem);
```

**Light Mode:**
```css
font-size: clamp(2.75rem, 8vw, 5rem);
```

---

## 3. Spacing Scale

```css
--spacing-xs: 0.5rem;   /* 8px */
--spacing-sm: 1rem;     /* 16px */
--spacing-md: 1.5rem;   /* 24px */
--spacing-lg: 2rem;     /* 32px */
--spacing-xl: 3rem;     /* 48px */
```

### 3.1 Common Padding Values

| Component | Padding |
|-----------|---------|
| **Glass Panels** | `p-10` (2.5rem / 40px) |
| **Form Inputs** | `px-4 py-3` (16px / 12px) |
| **Buttons (Primary)** | `px-10 py-5` (40px / 20px) |
| **Buttons (Small)** | `px-4 py-2` (16px / 8px) |
| **Card Containers** | `p-8` to `p-12` (32px-48px) |
| **Section Padding** | `px-6 py-20` (24px / 80px) |
| **Hero Section** | `px-6 py-32` (24px / 128px) |

### 3.2 Gap/Spacing Values

| Context | Gap |
|---------|-----|
| **Form Fields** | `space-y-5` (1.25rem / 20px) |
| **Button Groups** | `gap-4` (1rem / 16px) |
| **Nav Items** | `gap-7` (1.75rem / 28px) |
| **Content Sections** | `py-20` (5rem / 80px) |

---

## 4. Grid System

### 4.1 Container Widths

```css
max-w-md: 448px;    /* Auth forms */
max-w-3xl: 768px;   /* Narrow content */
max-w-5xl: 1024px;  /* Hero sections */
max-w-6xl: 1152px;  /* Background panels */
max-w-7xl: 1280px;  /* Main content */
```

### 4.2 Responsive Breakpoints

| Breakpoint | Value | Usage |
|------------|-------|-------|
| **sm** | 640px | Mobile landscape |
| **md** | 768px | Tablet - Navigation toggle point |
| **lg** | 1024px | Desktop |
| **xl** | 1280px | Large desktop |

### 4.3 Grid Layout Examples

**Two-Column Form (First/Last Name):**
```css
grid grid-cols-1 md:grid-cols-2 gap-4
```

**Standard Content Grid:**
```css
grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6
```

---

## 5. Color Palette

### 5.1 Dark Mode (Flagship - Jet Black Cinematic)

#### Base Colors
```css
--background: #000000;              /* Pure jet black */
--foreground: #ffffff;              /* Crisp white text */
```

#### Navigation
```css
--nav-text: rgba(255, 255, 255, 0.9);
--nav-text-active: rgba(255, 255, 255, 1);
```

#### Card/Surface Colors
```css
--card: rgba(10, 10, 10, 0.85);              /* Dark glass - near-black */
--card-foreground: #ffffff;
--popover: rgba(5, 5, 5, 0.98);
--popover-foreground: #ffffff;
```

#### Semantic Colors
```css
--primary: #ffffff;                           /* Crisp white */
--primary-foreground: #000000;
--secondary: rgba(244, 114, 66, 0.2);        /* Ember orange background */
--secondary-foreground: #ffffff;
--muted: rgba(20, 20, 20, 0.8);              /* Very dark muted */
--muted-foreground: rgba(255, 255, 255, 0.7); /* High-contrast muted text */
--accent: rgba(251, 191, 36, 0.25);          /* Warm amber background */
--accent-foreground: #ffffff;
```

#### Luminous Accent Colors (Dark Mode)
```css
--ember-orange: #f47242;   /* Campfire ember - RGB(244, 114, 66) */
--warm-amber: #fbbf24;     /* Warm lantern glow - RGB(251, 191, 36) */
--forest-green: #10b981;   /* Night forest - RGB(16, 185, 129) */
--night-sky-blue: #60a5fa; /* Twilight sky - RGB(96, 165, 250) */
```

#### Borders & Inputs
```css
--border: rgba(255, 255, 255, 0.15);         /* Bright visible border */
--input: rgba(20, 20, 20, 0.6);
--ring: rgba(255, 255, 255, 0.3);            /* Focus ring */
```

#### Status Colors
```css
--destructive: rgba(248, 113, 113, 0.9);
--destructive-foreground: #ffffff;
```

### 5.2 Light Mode (Cool Neutral Clean)

#### Base Colors
```css
--background: #f8f7f4;                       /* Cool neutral parchment */
--foreground: #1a1a1a;                       /* Near-black */
```

#### Navigation
```css
--nav-text: rgba(26, 26, 26, 0.95);
--nav-text-active: rgba(26, 26, 26, 1);
```

#### Card/Surface Colors
```css
--card: rgba(255, 254, 252, 0.97);           /* Clean bone white */
--card-foreground: #1a1a1a;
--popover: #ffffff;
--popover-foreground: #1a1a1a;
```

#### Semantic Colors
```css
--primary: #1a1a1a;                          /* Near-black */
--primary-foreground: #ffffff;
--secondary: #64748b;                        /* Cool slate blue-gray */
--secondary-foreground: #1a1a1a;
--muted: #e8e6e3;                            /* Cool light gray */
--muted-foreground: #475569;                 /* Cool slate gray - WCAG AA+ */
--accent: #3b82f6;                           /* Cool blue accent */
--accent-foreground: #ffffff;
```

#### Borders & Inputs
```css
--border: rgba(71, 85, 105, 0.2);
--input: transparent;
--input-background: rgba(226, 232, 240, 0.6);
--switch-background: #64748b;
```

#### Status Colors
```css
--destructive: #dc2626;
--destructive-foreground: #ffffff;
```

### 5.3 Theme-Specific Camp Colors

```css
--camp-morning: #d5e8f2;
--camp-day: #e1f2e8;
--camp-afternoon: #f5ead9;
--camp-evening: #dbeafe;
--camp-night: #1e293b;
```

---

## 6. Border Radius Scale

```css
--radius: 0.625rem;  /* 10px - base radius */
```

### Computed Radius Values
```css
--radius-sm: calc(var(--radius) - 4px);  /* 6px */
--radius-md: calc(var(--radius) - 2px);  /* 8px */
--radius-lg: var(--radius);              /* 10px */
--radius-xl: calc(var(--radius) + 4px);  /* 14px */
```

### Component-Specific Radius

| Component | Radius |
|-----------|--------|
| **Buttons (Primary)** | `rounded-full` (9999px) |
| **Glass Panels** | `rounded-3xl` (1.5rem / 24px) |
| **Form Inputs** | `rounded-xl` (0.75rem / 12px) |
| **Cards** | `rounded-2xl` (1rem / 16px) |
| **Language Dropdown** | `rounded-xl` (0.75rem / 12px) |
| **Navigation Bar** | `rounded-full` (9999px) |
| **Validation Checkmarks** | `rounded-full` (9999px) |

---

## 7. Shadow and Blur Values

### 7.1 Dark Mode Shadows

#### Navigation (Scrolled)
```css
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8), 
            0 2px 8px rgba(244, 114, 66, 0.2), 
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
```

#### Navigation (Top)
```css
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
```

#### Glass Panels (Auth Pages)
```css
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 
            0 0 0 1px rgba(255, 255, 255, 0.1), 
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
```

#### Primary Button (Dark)
```css
box-shadow: 0 8px 32px rgba(244, 114, 66, 0.5), 
            0 0 40px rgba(244, 114, 66, 0.3), 
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
```

#### Card Variants (Dark)

**Default:**
```css
box-shadow: 0 20px 56px rgba(0, 0, 0, 0.75), 
            0 8px 28px rgba(244, 114, 66, 0.12), 
            inset 0 1px 1px rgba(255, 255, 255, 0.12), 
            inset 0 -1px 1px rgba(0, 0, 0, 0.3);
```

**Prominent:**
```css
box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8), 
            0 12px 32px rgba(244, 114, 66, 0.15), 
            inset 0 1px 1px rgba(255, 255, 255, 0.15), 
            inset 0 -1px 1px rgba(0, 0, 0, 0.5);
```

**Subtle:**
```css
box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6), 
            inset 0 1px 1px rgba(255, 255, 255, 0.08);
```

**Glass:**
```css
box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7), 
            0 8px 24px rgba(251, 191, 36, 0.1), 
            inset 0 1px 1px rgba(255, 255, 255, 0.12);
```

### 7.2 Light Mode Shadows

#### Primary Button (Light)
```css
box-shadow: 0 8px 32px rgba(26, 26, 26, 0.25), 
            0 4px 16px rgba(26, 26, 26, 0.15);
```

#### Glass Panels (Light)
```css
box-shadow: 0 20px 80px rgba(26, 26, 26, 0.08);
```

#### Card Variants (Light)

**Default:**
```css
box-shadow: 0 12px 48px rgba(26, 26, 26, 0.1), 
            0 4px 16px rgba(26, 26, 26, 0.08);
```

**Prominent:**
```css
box-shadow: 0 20px 60px rgba(26, 26, 26, 0.12), 
            0 8px 24px rgba(26, 26, 26, 0.08);
```

### 7.3 Backdrop Blur Values

| Component | Blur Amount |
|-----------|-------------|
| **Navigation** | `backdrop-blur-xl` (24px) |
| **Glass Panels** | `blur(20px)` |
| **Cards (Dark)** | `backdrop-blur-xl` (24px) |
| **Language Dropdown** | `blur(16px)` |
| **Buttons (Primary)** | `blur(16px)` |
| **Validation Panels** | `blur(12px)` |

### 7.4 Focus Ring Shadows

**Warm Amber Focus:**
```css
box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.15);
border-color: rgba(251, 191, 36, 0.5);
```

---

## 8. Animation Specifications

### 8.1 Global Theme Transitions

```css
/* Root elements */
transition: background-color 1.5s cubic-bezier(0.25, 0.1, 0.25, 1),
            color 1.5s cubic-bezier(0.25, 0.1, 0.25, 1);

/* All elements */
* {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-duration: 1.2s;
  transition-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
}

/* Fast transitions for interactive elements */
button, a, input, textarea {
  transition-duration: 0.5s;
}
```

### 8.2 Page Entry Animations

#### Standard Fade-Up
```typescript
initial={{ opacity: 0, y: 30 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
```

#### Hero Section Entry
```typescript
initial={{ opacity: 0, y: 40 }}
animate={{ opacity: 1, y: 0 }}
transition={{ 
  duration: 1.4, 
  delay: 0.2, /* stagger with 0.2s increments */
  ease: [0.25, 0.1, 0.25, 1] 
}
```

#### Navigation Entry
```typescript
initial={{ opacity: 0, y: -20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
```

### 8.3 Background Animations

#### Living Background System

**Gradient Morphing:**
- **Duration:** 8 seconds
- **Easing:** `cubic-bezier(0.25, 0.1, 0.25, 1)`
- **Cycle:** 40 seconds per full gradient phase
- **Type:** Radial gradient with position animation (20-50% horizontal, 30-70% vertical)

**Image Crossfade (Dual-Layer):**
- **Interval:** 12 seconds between image changes
- **Transition Duration:** 2.2 seconds
- **Easing:** `cubic-bezier(0.4, 0, 0.2, 1)`
- **Mechanism:** Previous layer fades out (opacity 1→0) while current layer fades in (opacity 0→1)

**Parallax Scroll:**
- **Image Layer:** Y-axis movement `0%` to `15%` over scroll progress
- **Gradient Layer:** Y-axis movement `0%` to `8%` over scroll progress

**Image Opacity (Scroll-Based):**
- **Dark Mode:** `[0.45, 0.50, 0.55, 0.6]` mapped to scroll progress `[0, 0.3, 0.7, 1]`
- **Light Mode:** `[0.08, 0.10, 0.12, 0.14]` mapped to scroll progress `[0, 0.3, 0.7, 1]`

**Vignette Animation:**
- **Duration:** 2 seconds
- **Easing:** `cubic-bezier(0.25, 0.1, 0.25, 1)`

#### Ambient Particles

**Particle System:**
- **Count:** 30 particles
- **Size:** Random 1-3px
- **Speed:** `(Math.random() - 0.5) * 0.2` (X and Y)
- **Opacity:** Random 0.1-0.4
- **Color:** `rgba(255, 255, 255, {opacity})`
- **Animation:** Continuous canvas-based movement with screen wrapping
- **Entry:** 3-second fade-in with ease curve

### 8.4 Interactive Animations

#### Button Hover/Tap
```typescript
whileHover={{ scale: 1.02 }} /* or 1.03 for primary */
whileTap={{ scale: 0.98 }}
```

#### Navigation Active Indicator
```typescript
<motion.div
  layoutId="activeNav"
  transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
/>
```

#### Input Focus
```css
transition: all 0.3s ease;
/* On focus */
background-color: rgba(255, 255, 255, 0.12);
border-color: rgba(251, 191, 36, 0.5);
box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.15);
```

#### Dropdown Menu
```typescript
initial={{ opacity: 0, y: -10 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -10 }}
transition={{ duration: 0.2 }}
```

#### Password Validation Feedback
```typescript
initial={{ opacity: 0, y: -10 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.3 }}
```

### 8.5 Easing Curves

| Name | Curve | Usage |
|------|-------|-------|
| **Primary** | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Page transitions, gradients, vignettes |
| **Natural** | `cubic-bezier(0.4, 0, 0.2, 1)` | Image crossfades |
| **Smooth Out** | `ease-out` | Navigation background changes |

### 8.6 Duration Standards

| Type | Duration |
|------|----------|
| **Micro Interactions** | 200-300ms |
| **Input Focus** | 300ms |
| **Button Hover** | 500ms |
| **Navigation Transitions** | 600-700ms |
| **Theme Transitions** | 1.2s (1.5s for root) |
| **Page Entry** | 1.2-1.4s |
| **Vignette Morph** | 2s |
| **Image Crossfade** | 2.2s |
| **Ambient Particle Entry** | 3s |
| **Gradient Morph** | 8s |
| **Image Rotation Interval** | 12s |
| **Gradient Phase Cycle** | 40s |

---

## 9. Component Structure and Variants

### 9.1 Card Component

**Variants:**
1. **default** - Standard content card
2. **prominent** - High-emphasis card with stronger shadows
3. **subtle** - Low-emphasis background card
4. **glass** - Frosted glass aesthetic

**Dark Mode Specs:**

| Variant | Background | Border | Box Shadow |
|---------|------------|--------|------------|
| **default** | `rgba(12, 12, 12, 0.85)` | `1px solid rgba(255, 255, 255, 0.18)` | See Section 7.1 |
| **prominent** | `rgba(15, 15, 15, 0.9)` | `1px solid rgba(255, 255, 255, 0.2)` | See Section 7.1 |
| **subtle** | `rgba(8, 8, 8, 0.7)` | `1px solid rgba(255, 255, 255, 0.1)` | See Section 7.1 |
| **glass** | `rgba(10, 10, 10, 0.75)` | `1px solid rgba(255, 255, 255, 0.15)` | See Section 7.1 |

**Light Mode Specs:**

| Variant | Background | Border | Box Shadow |
|---------|------------|--------|------------|
| **default** | `rgba(255, 255, 255, 0.97)` | `1px solid rgba(26, 26, 26, 0.12)` | See Section 7.2 |
| **prominent** | `rgba(255, 255, 255, 0.98)` | `1px solid rgba(26, 26, 26, 0.12)` | See Section 7.2 |
| **subtle** | `rgba(252, 252, 252, 0.96)` | `1px solid rgba(26, 26, 26, 0.1)` | See Section 7.2 |
| **glass** | `rgba(255, 255, 255, 0.97)` | `1px solid rgba(26, 26, 26, 0.11)` | See Section 7.2 |

**Additional:** Dark mode cards include `backdrop-blur-xl` class

### 9.2 Navigation Component

**Structure:**
```
Fixed Container (z-50)
└── Glass Bar (rounded-full, max-w-7xl)
    ├── Logo (left)
    ├── Nav Items (center, hidden on mobile)
    └── Language Toggle (right)
```

**States:**
- **Top of Page (not scrolled):**
  - Background: `rgba(5, 5, 5, 0.75)`
  - Shadow: `0 4px 16px rgba(0, 0, 0, 0.6)`
  
- **Scrolled:**
  - Background: `rgba(8, 8, 8, 0.95)`
  - Shadow: `0 8px 32px rgba(0, 0, 0, 0.8), 0 2px 8px rgba(244, 114, 66, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)`

**Active Indicator:**
- Animated underline with `layoutId="activeNav"`
- Color: `rgba(255, 255, 255, 1)`
- Glow: `0 0 8px rgba(255, 255, 255, 0.3)`

### 9.3 Button Component

**Primary Button (Dark Mode):**
```css
background-color: rgba(244, 114, 66, 0.25);
color: #ffffff;
font-size: 1.0625rem;
font-weight: 600;
border-radius: 9999px;
padding: 1.25rem 2.5rem; /* py-5 px-10 */
border: 1px solid rgba(244, 114, 66, 0.4);
backdrop-filter: blur(16px);
box-shadow: 0 8px 32px rgba(244, 114, 66, 0.5), 
            0 0 40px rgba(244, 114, 66, 0.3), 
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
```

**Secondary Button (Dark Mode):**
```css
background-color: rgba(15, 15, 15, 0.8);
color: rgba(255, 255, 255, 0.95);
font-size: 1.0625rem;
font-weight: 600;
border-radius: 9999px;
padding: 1.25rem 2.5rem;
box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6), 
            inset 0 1px 0 rgba(255, 255, 255, 0.15), 
            0 0 0 1px rgba(255, 255, 255, 0.15);
```

**Primary Button (Light Mode):**
```css
background-color: rgba(26, 26, 26, 0.95);
color: #ffffff;
font-size: 1.125rem;
font-weight: 600;
border-radius: 9999px;
padding: 1.25rem 2.5rem;
border: 1px solid rgba(26, 26, 26, 0.3);
box-shadow: 0 8px 32px rgba(26, 26, 26, 0.25), 
            0 4px 16px rgba(26, 26, 26, 0.15);
```

### 9.4 Form Input Component

**Default State:**
```css
background-color: rgba(255, 255, 255, 0.08);
border: 1px solid rgba(255, 255, 255, 0.15);
color: rgba(255, 255, 255, 0.95);
border-radius: 0.75rem; /* rounded-xl */
padding: 0.75rem 1rem; /* py-3 px-4 */
transition: all 0.3s ease;
```

**Focus State:**
```css
background-color: rgba(255, 255, 255, 0.12);
border-color: rgba(251, 191, 36, 0.5);
box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.15);
```

### 9.5 Glass Panel Component (Auth Pages)

```css
background-color: rgba(15, 15, 15, 0.85);
backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.15);
border-radius: 1.5rem; /* rounded-3xl */
padding: 2.5rem; /* p-10 */
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 
            0 0 0 1px rgba(255, 255, 255, 0.1), 
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
```

### 9.6 Language Toggle Component

**Button:**
```css
background-color: rgba(255, 255, 255, 0.08);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.12);
border-radius: 9999px;
padding: 0.5rem 1rem; /* py-2 px-4 */
```

**Dropdown:**
```css
background-color: rgba(15, 15, 15, 0.95);
backdrop-filter: blur(16px);
border: 1px solid rgba(255, 255, 255, 0.15);
border-radius: 0.75rem; /* rounded-xl */
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
min-width: 120px;
```

**Active Language Item:**
```css
background-color: rgba(251, 191, 36, 0.15);
color: #fbbf24;
```

### 9.7 Password Validation Component

**Container:**
```css
background-color: rgba(10, 10, 10, 0.6);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: 0.75rem; /* rounded-xl */
padding: 1rem; /* p-4 */
margin-top: 0.75rem; /* mt-3 */
```

**Checkmark (Valid):**
```css
background-color: rgba(34, 197, 94, 0.2);
border: 1px solid rgba(34, 197, 94, 0.4);
color: rgba(34, 197, 94, 0.95);
```

**Checkmark (Invalid):**
```css
background-color: rgba(239, 68, 68, 0.2);
border: 1px solid rgba(239, 68, 68, 0.4);
color: rgba(239, 68, 68, 0.6);
```

### 9.8 HIPAA Security Notice

```css
border-top: 1px solid rgba(255, 255, 255, 0.08);
padding-top: 1.5rem; /* pt-6 */
margin-top: 2rem; /* mt-8 */
font-size: 0.75rem; /* text-xs */
color: rgba(255, 255, 255, 0.5);
text-align: center;
line-height: 1.7;
```

---

## 10. Design Tokens (Internal System)

### 10.1 Color Tokens (Tailwind v4 Integration)

All CSS custom properties are mapped through the `@theme inline` directive:

```css
--color-background: var(--background);
--color-foreground: var(--foreground);
--color-card: var(--card);
--color-card-foreground: var(--card-foreground);
--color-popover: var(--popover);
--color-popover-foreground: var(--popover-foreground);
--color-primary: var(--primary);
--color-primary-foreground: var(--primary-foreground);
--color-secondary: var(--secondary);
--color-secondary-foreground: var(--secondary-foreground);
--color-muted: var(--muted);
--color-muted-foreground: var(--muted-foreground);
--color-accent: var(--accent);
--color-accent-foreground: var(--accent-foreground);
--color-destructive: var(--destructive);
--color-destructive-foreground: var(--destructive-foreground);
--color-border: var(--border);
--color-input: var(--input);
--color-input-background: var(--input-background);
--color-ring: var(--ring);
```

### 10.2 Sidebar Tokens

```css
--color-sidebar: var(--sidebar);
--color-sidebar-foreground: var(--sidebar-foreground);
--color-sidebar-primary: var(--sidebar-primary);
--color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
--color-sidebar-accent: var(--sidebar-accent);
--color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
--color-sidebar-border: var(--sidebar-border);
--color-sidebar-ring: var(--sidebar-ring);
```

**Dark Mode Values:**
```css
--sidebar: rgba(0, 0, 0, 0.98);
--sidebar-foreground: #ffffff;
--sidebar-primary: #f47242;
--sidebar-primary-foreground: #ffffff;
--sidebar-accent: rgba(20, 20, 20, 0.8);
--sidebar-accent-foreground: rgba(255, 255, 255, 0.9);
--sidebar-border: rgba(255, 255, 255, 0.15);
--sidebar-ring: rgba(255, 255, 255, 0.3);
```

### 10.3 Chart Tokens

**Dark Mode:**
```css
--chart-1: oklch(0.488 0.243 264.376);
--chart-2: oklch(0.696 0.17 162.48);
--chart-3: oklch(0.769 0.188 70.08);
--chart-4: oklch(0.627 0.265 303.9);
--chart-5: oklch(0.645 0.246 16.439);
```

**Light Mode:**
```css
--chart-1: oklch(0.646 0.222 41.116);
--chart-2: oklch(0.6 0.118 184.704);
--chart-3: oklch(0.398 0.07 227.392);
--chart-4: oklch(0.828 0.189 84.429);
--chart-5: oklch(0.769 0.188 70.08);
```

### 10.4 Radius Tokens

```css
--radius-sm: calc(var(--radius) - 4px);  /* 6px */
--radius-md: calc(var(--radius) - 2px);  /* 8px */
--radius-lg: var(--radius);              /* 10px */
--radius-xl: calc(var(--radius) + 4px);  /* 14px */
```

---

## 11. Living Background System (Detailed Specification)

### 11.1 Image Priority System

**Array Order (Prioritized):**
1. **Evening/Night Imagery (Indices 0-7):** Campfires, twilight, evening programs, lantern glow
2. **Day Imagery (Indices 8-12):** Arts & crafts, teamwork, swimming, games

**Rotation:** Sequential, loops infinitely every 12 seconds

### 11.2 Gradient Color Morphing

**Dark Mode Gradient Colors:**
- **Base (Scroll 0%):**
  - Color 1: `rgb(0, 0, 0)` → `rgb(8, 5, 5)` (timePhase blend)
  - Color 2: `rgb(0, 0, 0)` → `rgb(10, 8, 8)` (timePhase blend)
  - Color 3: `rgb(5, 5, 5)` → `rgb(10, 10, 12)` (timePhase blend)

- **Deep Scroll (100%):**
  - Color 1: `rgb(5, 8, 12)` → `rgb(12, 8, 6)` (timePhase blend)
  - Color 2: `rgb(8, 12, 18)` → `rgb(15, 12, 10)` (timePhase blend)
  - Color 3: `rgb(12, 15, 22)` → `rgb(18, 20, 28)` (timePhase blend)

**Light Mode Gradient Colors:**
- **Base (Scroll 0%):**
  - Color 1: `rgb(235, 220, 195)` → `rgb(220, 190, 155)` (timePhase blend)
  - Color 2: `rgb(245, 230, 205)` → `rgb(230, 200, 165)` (timePhase blend)
  - Color 3: `rgb(250, 235, 210)` → `rgb(225, 200, 170)` (timePhase blend)

- **Deep Scroll (100%):**
  - Color 1: `rgb(195, 165, 130)` → `rgb(175, 140, 105)` (timePhase blend)
  - Color 2: `rgb(210, 180, 145)` → `rgb(190, 155, 120)` (timePhase blend)
  - Color 3: `rgb(205, 175, 140)` → `rgb(180, 150, 115)` (timePhase blend)

**Gradient Position:**
```javascript
`radial-gradient(ellipse at ${20 + gradientPhase * 30}% ${30 + gradientPhase * 40}%, ...)`
// Ranges: 20-50% horizontal, 30-70% vertical
```

### 11.3 Vignette Specifications

**Dark Mode:**
```css
background: radial-gradient(circle at center, 
                            transparent 0%, 
                            rgba(0, 0, 0, 0.6) 100%);
```

**Light Mode:**
```css
background: radial-gradient(circle at center, 
                            transparent 0%, 
                            rgba(90, 74, 56, 0.15) 100%);
```

### 11.4 Texture Layer

**SVG Noise Pattern:**
```svg
data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E
  %3Cfilter id='noise'%3E
    %3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E
  %3C/filter%3E
  %3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E
%3C/svg%3E
```
**Opacity:** `0.15`

### 11.5 Layer Stack (Bottom to Top)

1. **Gradient Layer** (animated radial gradient)
2. **Previous Image** (fading out)
3. **Current Image** (fading in)
4. **Texture Layer** (static noise)
5. **Ambient Particles** (canvas)
6. **Vignette** (animated radial gradient)

---

## 12. Accessibility & Performance

### 12.1 WCAG Compliance

- **Minimum Contrast:** WCAG AA+ for all text
- **Muted Text (Dark):** `rgba(255, 255, 255, 0.7)` meets AA on dark backgrounds
- **Muted Text (Light):** `#475569` meets AA+ on light backgrounds

### 12.2 Reduced Motion (Not Implemented)

**Future Consideration:** Respect `prefers-reduced-motion` by disabling:
- Background image crossfades
- Gradient morphing
- Particle animations
- Parallax scrolling

### 12.3 Performance Optimizations

- **Image Preloading:** All background images loaded upfront
- **Canvas-Based Particles:** GPU-accelerated via requestAnimationFrame
- **CSS Containment:** Fixed backgrounds with `inset-0` positioning
- **Backdrop Blur:** Hardware-accelerated where supported

---

## 13. Platform-Specific Considerations

### 13.1 Responsive Behavior

- **Mobile (<768px):** Navigation collapses, single-column layouts
- **Tablet (768-1024px):** Adaptive grid, expanded navigation
- **Desktop (>1024px):** Full multi-column layouts, hover states active

### 13.2 Dark Mode Priority

- **Default Theme:** Dark mode is flagship
- **Theme Toggle:** User preference persisted via ThemeContext
- **Image Selection:** Evening/campfire imagery prioritized for dark aesthetic

### 13.3 Cognitive Load Reduction

- **Slow Animations:** 8-40 second cycles prevent distraction
- **Low Image Opacity:** Light mode uses 0.08-0.14 to reduce background interference
- **Consistent Spacing:** Predictable rhythm reduces mental parsing
- **Clear Hierarchy:** High contrast between foreground and background

---

## 14. Implementation Notes

### 14.1 Technology Stack

- **Framework:** React 18 with TypeScript
- **Animation:** Framer Motion (motion/react)
- **Routing:** React Router v7 (Data Mode)
- **Styling:** Tailwind CSS v4
- **Fonts:** Google Fonts (Crimson Pro, Outfit)

### 14.2 Critical Files

| File | Purpose |
|------|---------|
| `/src/styles/theme.css` | Design tokens, CSS variables |
| `/src/styles/fonts.css` | Font imports |
| `/src/app/components/LivingBackground.tsx` | Background animation system |
| `/src/app/components/Navigation.tsx` | Navigation bar |
| `/src/app/components/Card.tsx` | Card component variants |
| `/src/app/contexts/ThemeContext.tsx` | Theme state management |

### 14.3 Custom Variant System

```css
@custom-variant dark (&:is(.dark *));
```
Enables Tailwind's `.dark` mode with class-based activation.

---

## 15. Change Log

### Version 2.0 (Current)
- **2026-02-21:** Finalized jet-black dark mode as flagship experience
- **2026-02-21:** Implemented dual-layer background crossfade system
- **2026-02-21:** Added HIPAA security notices to auth pages
- **2026-02-20:** Completed anti-whitewash redesign for light mode

### Version 1.0
- Initial platform design with light mode priority
- Basic glassmorphism system
- Standard animation timings

---

**End of Specification**
