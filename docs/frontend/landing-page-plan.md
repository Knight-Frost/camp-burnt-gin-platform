# Landing Page Plan
## Camp Burnt Gin Application Software

**Document Type:** Landing Page Architecture Plan — Planning Phase Reference
**Project:** Camp Burnt Gin — Public Marketing Surface
**Companion Documents:** Frontend Architecture Plan v1.0.0 | Frontend Development Plan v1.0.0
**Version:** 1.0.0
**Date:** February 13, 2026
**Status:** Informational — Planning Reference

> **Note:** This document was produced during the design planning phase. The implementation has been completed. For the current system state, refer to [frontend/FRONTEND_GUIDE.md](../../frontend/FRONTEND_GUIDE.md). This document is preserved for traceability and academic reference.
>
> **Note:** The system no longer includes a public-facing landing page. The application is portal-only; `/` redirects to `/login`.

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Relationship to the Authenticated Application](#2-relationship-to-the-authenticated-application)
3. [Landing Page Architecture](#3-landing-page-architecture)
4. [Section Architecture & Content Specification](#4-section-architecture--content-specification)
5. [Visual Design Language](#5-visual-design-language)
6. [Motion & Animation System](#6-motion--animation-system)
7. [Navigation Architecture](#7-navigation-architecture)
8. [Project Structure](#8-project-structure)
9. [Routing Integration](#9-routing-integration)
10. [SEO & Metadata Architecture](#10-seo--metadata-architecture)
11. [Performance Architecture](#11-performance-architecture)
12. [Accessibility Requirements](#12-accessibility-requirements)
13. [Responsive Design Specification](#13-responsive-design-specification)
14. [Development Phase — Landing Page](#14-development-phase--landing-page)
15. [Testing Checklist](#15-testing-checklist)
16. [Definition of Done](#16-definition-of-done)
17. [Architectural Decision Record](#17-architectural-decision-record)

---

## 1. Purpose & Scope

The Camp Burnt Gin landing page is the public face of the platform — the first surface any prospective family encounters before an account exists. It is a marketing and conversion surface, not an application surface.

**Primary responsibilities:**
- Communicate Camp Burnt Gin's mission, values, and program identity
- Surface upcoming session dates, eligibility, and availability in an accessible, clear format
- Build trust and emotional connection with families evaluating the program
- Drive qualified visitors toward the `/register` entry point with confidence
- Perform with excellence on Core Web Vitals and first-impression metrics
- Be fully accessible and functional without JavaScript (progressive enhancement)

**Out of scope for this surface:**
- Authentication flows (these live in the authenticated application)
- Redux store, Axios instance, or any PHI-adjacent infrastructure
- Role-based rendering or access control
- Any API calls beyond optional static camp session data fetch

---

## 2. Relationship to the Authenticated Application

The landing page co-exists within the same Vite project as the authenticated application. The two surfaces share:

| Shared Resource | How It Is Shared |
|----------------|-----------------|
| Design token system (CSS custom properties) | `assets/styles/globals.css` — imported by both |
| Typography (Syne, Plus Jakarta Sans) | Font loading in `index.html` |
| Glassmorphism components (`GlassCard`, `GlassPanel`) | `components/glass/` — imported by landing feature |
| Motion constants and variants | `constants/motion.ts` — imported by landing feature |
| Atom components (Button, Badge) | `components/atoms/` — used in CTA and session cards |

The two surfaces are strictly isolated from each other:

| Isolated Concern | Landing Page | Authenticated App |
|-----------------|-------------|-------------------|
| Redux store | Never imported | Always used |
| Axios instance | Never imported | Always used |
| Auth hooks | Never imported | Always used |
| PHI data | Never present | Fully governed |
| Vite chunk | `landing-page.[hash].js` | `app.[hash].js` |

A Vite chunk boundary enforces that the landing page bundle never pulls in authenticated-application dependencies, keeping the public page lightweight and independently deployable if needed in the future.

```
Router (React Router)
│
├── /              → LandingPage        [landing-page chunk — no auth deps]
├── /login         → LoginPage          [app chunk — auth deps]
├── /register      → RegisterPage       [app chunk — auth deps]
└── /dashboard     → DashboardPage      [app chunk — auth + PHI deps]
```

---

## 3. Landing Page Architecture

### 3.1 Technical Constraints

| Constraint | Requirement |
|-----------|-------------|
| Bundle size | Max 60 KB gzipped for landing-page chunk |
| LCP (Largest Contentful Paint) | < 2.0 seconds |
| CLS (Cumulative Layout Shift) | < 0.05 |
| FID / INP | < 100ms |
| Lighthouse score | > 95 (performance), > 90 (accessibility, SEO) |
| API calls | None by default; optional single fetch for live session data |
| State management | Local React state only |
| Authentication awareness | Authenticated users visiting `/` see landing page normally; nav CTA changes to "Go to Dashboard" |

### 3.2 Rendering Strategy

The landing page renders as a standard client-side React component. All content is either statically embedded or pulled from a lightweight configuration object. If live session data is required (e.g., real-time availability counts), a single public API endpoint can be fetched without authentication — this is the only permitted network call from the landing page.

```typescript
// features/landing/config/sessions.config.ts
// Static session data — updated per registration cycle
// Avoids API call for non-critical content
export const SESSIONS: SessionConfig[] = [
  {
    id: 1,
    name: 'Summer Session A',
    dates: 'June 9–14, 2026',
    ageRange: '7–16',
    eligibility: 'Children with special health care needs',
    availability: 'open',  // 'open' | 'limited' | 'waitlist' | 'full'
  },
  // ...
];
```

### 3.3 Authentication State Awareness

The landing page reads authentication state from the Redux store solely to adjust the navigation CTA — it never renders protected content, never triggers protected routes, and never accesses PHI.

```typescript
// features/landing/components/LandingNav.tsx
const { isAuthenticated } = useAppSelector(state => state.auth);

// CTA behavior:
// Unauthenticated → "Apply Now" → /register
// Authenticated   → "Go to Dashboard" → /dashboard
```

---

## 4. Section Architecture & Content Specification

The landing page is composed of full-viewport-width sections arranged vertically. Each section is a self-contained component responsible for its own layout, content, spacing, and entrance animation.

```
LandingPage.tsx
│
├── <LandingNav />
├── <HeroSection />
├── <MissionSection />
├── <SessionsSection />
├── <HowItWorksSection />
├── <TestimonialsSection />        (optional — rendered if testimonials exist)
├── <FAQSection />
├── <CTASection />
└── <LandingFooter />
```

### 4.1 LandingNav

**Purpose:** Primary navigation for the public surface. Communicates brand identity and provides fast access to key sections and the primary CTA.

**Behavior:**
- On load: fully transparent background, logo and links visible over hero background
- On scroll (threshold: 80px): transitions to frosted glass panel (`backdrop-filter: blur(16px)`) with subtle border
- Scroll transition: smooth, 300ms ease
- Mobile: collapses to hamburger menu with animated slide-down drawer

**Content:**
- Left: Camp Burnt Gin logo + wordmark
- Center: Anchor navigation links — About, Sessions, How It Works, FAQ
- Right: CTA button — "Apply Now" (primary) or "Go to Dashboard" (if authenticated)

**Technical notes:**
- Implemented with `position: sticky; top: 0; z-index: 50`
- Intersection Observer on `HeroSection` triggers the glass transition
- Anchor links use smooth scroll (`scroll-behavior: smooth` or JS `scrollIntoView`)

### 4.2 HeroSection

**Purpose:** The first and most important section. Creates an immediate emotional impression and communicates the core value proposition in under five seconds.

**Layout:** Full viewport height (`100dvh`). Content vertically centered with slight upward offset for visual balance. Background fills the entire viewport.

**Background Treatment:**
- Primary layer: animated gradient mesh using CSS `@keyframes` or Motion — slow, gentle movement of two or three color stops across the brand palette (deep navy, sky blue, warm amber accent)
- Secondary layer: subtle noise/grain texture overlay at 4–6% opacity for depth and tactility
- The effect creates a living, breathing backdrop that is visually rich without being distracting

**Content structure (centered, max-width 800px):**

```
[Pre-headline badge]     "Applications Now Open — Summer 2026"
[Primary headline]       "Where Every Child
                          Discovers Their Strength"
[Subheadline]            "Camp Burnt Gin provides week-long residential
                          camp experiences for children with special
                          health care needs. Because every child deserves
                          an extraordinary summer."
[CTA group]              [ Apply Now → /register ]  [ Learn More ↓ ]
[Scroll indicator]       Animated chevron pointing down
```

**Headline animation:** Each word of the primary headline enters with a staggered upward fade (50ms stagger per word) using Motion `AnimatePresence`.

### 4.3 MissionSection

**Purpose:** Establishes credibility, communicates the depth of the program, and connects emotionally with the families making this decision.

**Layout:** Two-column at desktop (statistics left, copy right). Single column on mobile (copy first, statistics below).

**Left column — Statistics:**
Three animated stat blocks, each with:
- Large number (count-up animation on viewport entry via Intersection Observer)
- Descriptor label beneath

Example stats:
```
30+          150+          100%
Years of     Campers       Volunteer-
Experience   Each Summer   Powered Staff
```

**Right column — Mission copy:**
- Section heading: "Our Mission"
- Two to three paragraphs of mission-focused copy
- Decorative vertical accent bar in brand color on left edge

**Background:** Subtle solid or very lightly tinted surface — not glass, not a gradient. This section breathes after the hero.

### 4.4 SessionsSection

**Purpose:** The most conversion-critical informational section. Families need to see dates, eligibility, and availability before deciding to register.

**Layout:** Section heading centered, then a responsive grid of `SessionCard` components.

**Grid:** 3 columns at desktop, 2 at tablet, 1 at mobile.

**SessionCard component (GlassCard base):**

```
┌──────────────────────────────────────┐
│  [Session Badge]  "Summer Session A" │
│                                      │
│  Dates:       June 9–14, 2026        │
│  Ages:        7–16 years             │
│  Eligibility: Children with special  │
│               health care needs      │
│                                      │
│  [Availability Badge]   Open         │
│                                      │
│  [ Apply for This Session → ]        │
└──────────────────────────────────────┘
```

**Availability badge color logic:**

| Status | Color | Label |
|--------|-------|-------|
| `open` | Success green | Open |
| `limited` | Warning amber | Limited Spots |
| `waitlist` | Info blue | Join Waitlist |
| `full` | Neutral gray | Session Full |

**Interaction:** "Apply for This Session" button navigates to `/register` and may optionally pass the session ID as a query parameter (`/register?session=1`) so the registration form can pre-select the session.

### 4.5 HowItWorksSection

**Purpose:** Removes friction by demystifying the registration process. Parents who understand the steps are significantly more likely to start.

**Layout:** Horizontal row of three steps at desktop, vertical stack on mobile.

**Content:**

```
Step 1                  Step 2                  Step 3
Create Your Account     Complete Your Child's   Submit Your Application
                        Profile
Register with your      Add your child's        Review and digitally
email and set up        basic information       sign the application.
your secure account.    and medical details.    We'll notify you of
                                                the decision.
[ Arrow connecting steps — hidden on mobile ]
```

Each step is a GlassCard with:
- Large step number (display font, brand color, low opacity as decorative element)
- Icon (Lucide React)
- Step title (bold)
- One to two sentence description

**Entrance:** Cards stagger in from left to right as the section enters the viewport.

### 4.6 TestimonialsSection

**Purpose:** Social proof from families who have participated. Rendered conditionally — only if testimonial data is present in the config.

**Layout:** Horizontally scrollable carousel using `embla-carousel-react` (already in the project's package.json). Three cards visible at desktop, one at mobile.

**TestimonialCard (GlassCard base):**
```
"Coming to Camp Burnt Gin was the first time our daughter
 felt completely herself around other kids."

— Sarah M., Parent of a 2024 Camper
```

### 4.7 FAQSection

**Purpose:** Proactively answers the questions that would otherwise prevent a family from registering.

**Layout:** Centered column, max-width 720px. Radix Accordion for accessible open/close behavior.

**Suggested FAQ topics:**
- Who is eligible to attend Camp Burnt Gin?
- What does the application process involve?
- Is there a cost to attend?
- What medical information is required?
- How long does the review process take?
- What happens if a session is full?
- Can I apply to multiple sessions?

**Accordion animation:** `AnimatePresence` with `height` layout animation for smooth expand/collapse.

### 4.8 CTASection

**Purpose:** The final conversion push before the footer. Families who have scrolled this far are interested — give them a compelling, friction-free path to register.

**Layout:** Full-width section with a bold, centered layout. Gradient or glass background that visually separates it from the FAQ.

**Content:**
```
[Headline]   "Ready to Give Your Child an Unforgettable Summer?"
[Subtext]    "Applications for Summer 2026 are open now.
              Spots fill quickly — don't miss the chance."
[CTA]        [ Apply Now → ]
[Sub-CTA]    Questions? Contact us at info@campburntgin.org
```

**Visual treatment:** Dark gradient background (contrasts with the rest of the page) with large, centered typography. The CTA button should be the largest, most visually prominent button on the entire page.

### 4.9 LandingFooter

**Purpose:** Provides utility navigation, legal information, and contact details.

**Content columns:**

| Column | Content |
|--------|---------|
| Brand | Logo, tagline, brief one-liner |
| Navigate | About, Sessions, How It Works, FAQ |
| Account | Register, Log In, Contact |
| Legal | Privacy Policy, Terms of Service, Accessibility Statement |

**Bottom bar:** Copyright line, social media icons (if applicable).

**Visual:** Solid dark background — no glass. Clean, minimal, professional.

---

## 5. Visual Design Language

### 5.1 Design Direction

The landing page aesthetic merges the warmth and energy of an outdoor camp experience with the precision and trust of a HIPAA-regulated medical platform. The result is a design that feels:

- Warm and welcoming — this is a place for children and families
- Trustworthy and professional — this is a regulated medical program
- Modern and distinctive — this surpasses every competitor's dated website

**Governing aesthetic:** Refined maximalism. Generous space, bold typography, rich background treatments, and purposeful glassmorphism — but always in service of clarity, never chaos.

### 5.2 Color Application on the Landing Page

The landing page uses the same design token system as the authenticated app (`assets/styles/globals.css`), with the following landing-specific conventions:

| Section | Background Treatment |
|---------|---------------------|
| Hero | Animated gradient mesh (navy → sky blue → warm accent) |
| Mission | Very lightly tinted surface, nearly white (light) / near-black (dark) |
| Sessions | Subtle gradient background behind glass cards |
| How It Works | Clean white / dark surface — no gradient |
| Testimonials | Soft gradient, slightly warmer tone |
| FAQ | Clean white / dark surface |
| CTA | Deep brand navy with high contrast |
| Footer | Darkest surface, near-black |

### 5.3 Typography on the Landing Page

The landing page leans harder into the display font than the authenticated application:

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Hero headline | Syne | 800 | `clamp(2.5rem, 6vw, 5rem)` |
| Section headings | Syne | 700 | `clamp(1.75rem, 3vw, 2.5rem)` |
| Step/card headings | Plus Jakarta Sans | 600 | `1.25rem` |
| Body copy | Plus Jakarta Sans | 400 | `1rem` / `1.125rem` |
| Stat numbers | Syne | 800 | `3rem` |
| Nav links | Plus Jakarta Sans | 500 | `0.9rem` |
| Badge labels | Plus Jakarta Sans | 600 | `0.75rem` |

`clamp()` ensures fluid typography that scales gracefully between mobile and desktop without breakpoint jumps.

### 5.4 Glassmorphism on the Landing Page

Glass components are used more liberally on the landing page than in the authenticated app, because the landing page is designed specifically to have rich background layers behind the cards.

Every section that uses GlassCards provides a visual background layer (gradient, image, or pattern) so the frosted glass effect is visible and meaningful. Sections with solid backgrounds use solid-surfaced cards instead of glass to maintain visual variety and avoid the effect becoming monotonous.

---

## 6. Motion & Animation System

The landing page shares the motion token system from `constants/motion.ts` but applies it in a cinematic, scroll-driven way rather than the interaction-driven way of the authenticated application.

### 6.1 Scroll-Triggered Entrance Animations

Every section uses an Intersection Observer (via a shared `useInView` hook) to trigger entrance animations when the section scrolls into the viewport. Animations fire once and do not repeat on scroll-out.

```typescript
// hooks/useInView.ts
import { useEffect, useRef, useState } from 'react';

export function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}
```

### 6.2 Animation Inventory

| Element | Animation | Trigger | Duration |
|---------|-----------|---------|----------|
| Hero headline words | Stagger up-fade, 50ms per word | Page load | 600ms total |
| Hero subheadline | Fade up | 300ms after headline | 400ms |
| Hero CTA buttons | Fade up, slight scale | 500ms after headline | 350ms |
| Nav glass transition | Background + border crossfade | Scroll past 80px | 300ms |
| Mission stat numbers | Count-up from 0 | Section enters viewport | 1200ms |
| Mission copy | Fade up | Section enters viewport | 400ms |
| Session cards | Stagger fade-up, 80ms per card | Section enters viewport | 400ms each |
| Step cards | Stagger fade from left, 100ms per card | Section enters viewport | 350ms each |
| Testimonial carousel | Slide on drag/click | User interaction | 300ms spring |
| FAQ accordion items | Height expand/collapse | User click | 250ms ease |
| CTA section | Scale up + fade in | Section enters viewport | 500ms spring |
| Background gradient mesh | Slow continuous drift | Always | Loop, 12s |

### 6.3 Reduced Motion Compliance

All entrance animations check `useMotion().reduce`. When reduced motion is active:
- Stagger delays are set to 0
- Transform animations (translateY, scale) are disabled
- Opacity transitions remain (these are safe per WCAG 2.3.3)
- Count-up numbers snap to their final value immediately
- Background gradient mesh animation is paused

---

## 7. Navigation Architecture

### 7.1 LandingNav vs AppShell Header

The landing page uses its own `LandingNav` component — it does not use the `AppShell` header from the authenticated application. These are intentionally separate:

| Concern | LandingNav | AppShell Header |
|---------|-----------|----------------|
| Background | Transparent → glass on scroll | Always glass/solid |
| Links | Anchor scroll links (About, Sessions, FAQ) | Route navigation links |
| Right side | "Apply Now" / "Go to Dashboard" | Notifications, Inbox, User menu |
| Mobile | Hamburger + slide drawer | Hamburger + sidebar toggle |
| Redux | Auth state check only (CTA label) | Full auth state |

### 7.2 Mobile Navigation Drawer

On mobile (< 768px), the center anchor links collapse into a slide-down drawer triggered by a hamburger button. The drawer:
- Slides down with a spring animation (not a fade)
- Closes on link click, backdrop click, or Escape key
- Is accessible: focus trap active when open, focus returns to hamburger on close
- Uses `aria-expanded` and `aria-controls` for screen reader support

### 7.3 Anchor Link Scroll Behavior

Section IDs are assigned to each major section:

```
#hero          → HeroSection
#about         → MissionSection
#sessions      → SessionsSection
#how-it-works  → HowItWorksSection
#faq           → FAQSection
```

Smooth scrolling is achieved via `element.scrollIntoView({ behavior: 'smooth', block: 'start' })` with a 80px offset to account for the sticky nav height.

---

## 8. Project Structure

The landing page is a self-contained feature module within the `features/` directory:

```
src/
└── features/
    └── landing/
        ├── components/
        │   ├── LandingNav.tsx              # Sticky nav, glass on scroll, mobile drawer
        │   ├── HeroSection.tsx             # Full-viewport hero
        │   ├── MissionSection.tsx          # Mission + animated stats
        │   ├── SessionsSection.tsx         # Session cards grid
        │   ├── SessionCard.tsx             # Individual session card
        │   ├── HowItWorksSection.tsx       # 3-step process
        │   ├── StepCard.tsx                # Individual step card
        │   ├── TestimonialsSection.tsx     # Testimonials carousel
        │   ├── TestimonialCard.tsx         # Individual testimonial
        │   ├── FAQSection.tsx              # Accordion FAQ
        │   ├── CTASection.tsx              # Final CTA
        │   └── LandingFooter.tsx           # Footer
        ├── config/
        │   ├── sessions.config.ts          # Session data (static or fetched)
        │   ├── faq.config.ts               # FAQ questions and answers
        │   └── testimonials.config.ts      # Testimonial content
        ├── hooks/
        │   └── useScrolledPast.ts          # Detects scroll past threshold (for nav)
        └── pages/
            └── LandingPage.tsx             # Root page component, assembles sections
```

**Isolation contract:** Nothing in `features/landing/` may import from:
- `features/auth/`
- `features/campers/`
- `features/applications/`
- `features/medical/`
- `features/documents/`
- `features/inbox/`
- `features/admin/`
- `store/` (except `store/hooks.ts` for the auth CTA check only)
- `api/axios.config.ts`

---

## 9. Routing Integration

The landing page is registered at the root route in `router/index.tsx`. It uses a `LandingRoute` wrapper instead of `PublicRoute` — unlike auth pages, the landing page does not redirect authenticated users away. An authenticated parent visiting the home page should see the landing page normally; the nav simply shows "Go to Dashboard" instead of "Apply Now."

```typescript
// router/index.tsx (excerpt)
const LandingPage = lazy(() => import('@/features/landing/pages/LandingPage'));

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<LandingPageSkeleton />}>
        <LandingPage />
      </Suspense>
    ),
  },
  {
    path: '/login',
    element: <PublicRoute><LoginPage /></PublicRoute>,
  },
  // ... authenticated routes
]);
```

The `LandingPageSkeleton` fallback is a minimal static HTML/CSS skeleton of the hero section — it prevents a blank flash on initial load while the chunk is parsed.

---

## 10. SEO & Metadata Architecture

The landing page is the only page in this project with meaningful SEO requirements. All other routes are behind authentication and are not indexed.

### 10.1 Meta Tag Strategy

Install `react-helmet-async` to manage `<head>` content declaratively:

```typescript
// features/landing/pages/LandingPage.tsx
import { Helmet } from 'react-helmet-async';

<Helmet>
  <title>Camp Burnt Gin — Summer Camp for Children with Special Health Care Needs</title>
  <meta name="description" content="Camp Burnt Gin provides week-long residential camp experiences for children with special health care needs. Apply now for Summer 2026." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://www.campburntgin.org/" />
</Helmet>
```

### 10.2 Open Graph Tags

```html
<meta property="og:title" content="Camp Burnt Gin — Summer Camp for Children with Special Health Care Needs" />
<meta property="og:description" content="Apply now for Summer 2026. Week-long residential camp for children with special health care needs." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://www.campburntgin.org/" />
<meta property="og:image" content="https://www.campburntgin.org/og-image.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

### 10.3 Structured Data (JSON-LD)

Add a `CampingTrip` or `Event` schema for each session to improve search result richness:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Camp Burnt Gin",
  "url": "https://www.campburntgin.org",
  "description": "Residential summer camp for children with special health care needs",
  "sameAs": []
}
</script>
```

### 10.4 Robots & Sitemap

- All authenticated routes (`/dashboard`, `/campers`, `/applications`, etc.) must be in `robots.txt` as `Disallow`
- Only `/` (landing page), `/login`, and `/register` are `Allow`
- A `sitemap.xml` with only the public routes is generated at build time or served statically

```
# robots.txt
User-agent: *
Allow: /
Allow: /login
Allow: /register
Disallow: /dashboard
Disallow: /campers
Disallow: /applications
Disallow: /medical
Disallow: /admin
Disallow: /inbox
Disallow: /documents
Disallow: /settings
Disallow: /notifications
```

---

## 11. Performance Architecture

### 11.1 Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| LCP | < 2.0s | First impressions — stricter than the app's 2.5s target |
| CLS | < 0.05 | Hero section layout must be stable on load |
| FID / INP | < 100ms | Interaction with nav and CTA must feel instant |
| Lighthouse Performance | > 95 | Public-facing page — higher bar than authenticated app |
| Lighthouse SEO | > 90 | Indexed page — SEO score matters |
| Landing chunk size | < 60 KB gzipped | Strict budget to ensure fast parse on mobile |

### 11.2 Performance Strategies

**Hero section image/background:**
- Use CSS gradient mesh instead of a background photograph — eliminates the largest LCP risk (image download)
- If a photograph is used, it must be: WebP format, responsive `srcset`, `loading="eager"`, `fetchpriority="high"`, and served via CDN with proper cache headers

**Font loading:**
- `font-display: swap` on all custom fonts
- Preload the display font (Syne 800) in `index.html`:
  ```html
  <link rel="preload" href="/fonts/Syne-Bold.woff2" as="font" type="font/woff2" crossorigin />
  ```

**Lazy loading:**
- All sections below the fold (`TestimonialsSection`, `FAQSection`, `CTASection`, `LandingFooter`) are wrapped in `React.lazy()` via dynamic import
- Intersection Observer triggers section load just before it enters the viewport

**No unnecessary dependencies:**
- The landing chunk must not include Redux, Axios, or any feature-app code
- Validate with `vite-bundle-visualizer` after each major component addition

**Session data:**
- Default: embed session data statically in `sessions.config.ts` — zero network requests
- Optional: if live availability is needed, one public API call to `/api/sessions?is_active=true` is permitted. This call has no auth header and returns only public session information (no PHI).

---

## 12. Accessibility Requirements

The landing page must meet WCAG 2.1 AA, with particular attention to:

| Requirement | Implementation |
|-------------|---------------|
| Keyboard navigation | All nav links, CTA buttons, FAQ accordions, and carousel controls are fully keyboard operable |
| Skip to main content | `<a href="#hero" className="sr-only focus:not-sr-only">Skip to main content</a>` as first element in DOM |
| Heading hierarchy | One `<h1>` (hero headline), `<h2>` per section, `<h3>` per card/item |
| Color contrast | All text on glass surfaces: 4.5:1 minimum. All text on gradient backgrounds: tested at darkest and lightest gradient points |
| Focus indicators | Visible focus rings on all interactive elements, enhanced in high-contrast mode |
| Animated content | Background gradient mesh respects `prefers-reduced-motion: reduce` (paused) |
| FAQ accordion | Uses Radix Accordion — WAI-ARIA pattern compliant out of the box |
| Carousel | Arrow buttons have `aria-label`. Carousel region has `aria-live="polite"` |
| Images | Any decorative images use `alt=""`. Informational images have descriptive alt text |
| Form links | "Apply Now" and session CTA links have clear, descriptive text (not "click here") |

---

## 13. Responsive Design Specification

The landing page is designed mobile-first. All layout decisions start at 375px and scale up.

### 13.1 Breakpoint Behavior

| Section | Mobile (< 768px) | Tablet (768–1279px) | Desktop (≥ 1280px) |
|---------|-----------------|---------------------|---------------------|
| LandingNav | Hamburger + drawer | Hamburger + drawer | Full horizontal nav |
| HeroSection | Single column, centered | Single column, centered | Single column, centered |
| MissionSection | Copy then stats, stacked | Two columns | Two columns |
| SessionsSection | 1 card per row | 2 cards per row | 3 cards per row |
| HowItWorksSection | Vertical stack | Vertical stack | Horizontal row |
| TestimonialsSection | 1 card visible | 2 cards visible | 3 cards visible |
| FAQSection | Full width | Max-width 720px, centered | Max-width 720px, centered |
| CTASection | Single column, centered | Single column, centered | Single column, centered |
| LandingFooter | Stacked columns | 2-column grid | 4-column grid |

### 13.2 Touch Considerations

- All CTA buttons minimum 48×48 CSS pixels touch target
- Carousel supports swipe gestures via Embla's built-in touch handling
- Nav drawer closes on swipe-up gesture
- No hover-only interactions — all hover states also have focus states

---

## 14. Development Phase — Landing Page

This phase fits between Phase 2 (Design System) and Phase 3 (Authentication) in the main Frontend Development Plan. The landing page can be built in parallel with Phase 3 by a separate team member.

**Estimated duration:** 1 week

### 14.1 Setup

- [ ] Create `features/landing/` directory with full sub-structure (Section 8)
- [ ] Create `features/landing/config/sessions.config.ts` with placeholder session data
- [ ] Create `features/landing/config/faq.config.ts` with placeholder FAQ entries
- [ ] Create `features/landing/config/testimonials.config.ts` with placeholder testimonials
- [ ] Register `/` route in `router/index.tsx` pointing to `LandingPage` (lazy)
- [ ] Create `LandingPageSkeleton` as a static loading fallback for the `/` route
- [ ] Install `react-helmet-async` if not already present
- [ ] Confirm `embla-carousel-react` is available (already in `package.json`)
- [ ] Create `features/landing/hooks/useScrolledPast.ts` — Intersection Observer hook for nav glass transition

### 14.2 Navigation

- [ ] Build `LandingNav.tsx`
  - [ ] Logo + wordmark on left
  - [ ] Anchor links in center (desktop only)
  - [ ] Auth-aware CTA button on right (`useAppSelector` for `isAuthenticated`)
  - [ ] Transparent initial state
  - [ ] Glass transition on scroll past 80px (`useScrolledPast(80)`)
  - [ ] Mobile hamburger button with `aria-expanded`
  - [ ] Mobile slide-down drawer with focus trap and Escape key close
  - [ ] Smooth scroll on anchor link click with 80px offset
- [ ] Write unit test for `useScrolledPast` hook
- [ ] Write unit test for nav CTA label (authenticated vs unauthenticated)

### 14.3 Hero Section

- [ ] Build `HeroSection.tsx`
  - [ ] Animated gradient mesh background (CSS `@keyframes` or Motion)
  - [ ] Grain/noise texture overlay
  - [ ] Section ID: `id="hero"`
  - [ ] Pre-headline badge component
  - [ ] Primary headline with Motion word-stagger entrance
  - [ ] Subheadline with fade-up entrance
  - [ ] CTA button group ("Apply Now" primary + "Learn More" secondary)
  - [ ] Animated scroll-down indicator
- [ ] Confirm `reduced-motion` disables stagger and transforms but keeps opacity fades
- [ ] Confirm "Learn More" smooth-scrolls to `#about`

### 14.4 Mission Section

- [ ] Build `MissionSection.tsx`
  - [ ] Section ID: `id="about"`
  - [ ] Two-column layout (desktop), stacked (mobile)
  - [ ] Copy column with section heading and paragraphs
  - [ ] Stats column with three `StatBlock` sub-components
- [ ] Build `StatBlock` sub-component
  - [ ] Accepts `value` (number), `label` (string)
  - [ ] Count-up animation triggered by `useInView`
  - [ ] Reduced motion: snap to final value
- [ ] Write unit test for count-up logic

### 14.5 Sessions Section

- [ ] Build `SessionsSection.tsx`
  - [ ] Section ID: `id="sessions"`
  - [ ] Reads from `sessions.config.ts`
  - [ ] Responsive grid layout
  - [ ] Stagger entrance on viewport entry
- [ ] Build `SessionCard.tsx`
  - [ ] GlassCard base
  - [ ] Session name, dates, age range, eligibility
  - [ ] `AvailabilityBadge` sub-component (open/limited/waitlist/full)
  - [ ] CTA button: "Apply for This Session" → `/register?session={id}`
- [ ] Confirm "Session Full" state disables the CTA button with clear messaging

### 14.6 How It Works Section

- [ ] Build `HowItWorksSection.tsx`
  - [ ] Section ID: `id="how-it-works"`
  - [ ] Horizontal row (desktop), vertical stack (mobile)
  - [ ] Connecting arrow between steps (hidden on mobile)
  - [ ] Stagger entrance from left
- [ ] Build `StepCard.tsx`
  - [ ] GlassCard base
  - [ ] Step number (decorative, large, low-opacity)
  - [ ] Lucide icon
  - [ ] Step title and description

### 14.7 Testimonials Section

- [ ] Build `TestimonialsSection.tsx`
  - [ ] Only renders if `testimonials.config.ts` has entries
  - [ ] Embla Carousel with prev/next buttons and dot indicators
  - [ ] Accessible: `aria-live="polite"` on carousel region, `aria-label` on buttons
- [ ] Build `TestimonialCard.tsx`
  - [ ] GlassCard base
  - [ ] Quote text, attribution name and role

### 14.8 FAQ Section

- [ ] Build `FAQSection.tsx`
  - [ ] Section ID: `id="faq"`
  - [ ] Reads from `faq.config.ts`
  - [ ] Radix Accordion with `type="multiple"` (multiple items can be open)
  - [ ] Motion height animation on open/close
- [ ] Write integration test: keyboard navigation opens and closes accordion items

### 14.9 CTA Section

- [ ] Build `CTASection.tsx`
  - [ ] Deep contrast background (dark navy)
  - [ ] Bold headline and supporting copy
  - [ ] Large primary CTA button → `/register`
  - [ ] Secondary contact line (email link)
  - [ ] Scale + fade entrance animation on viewport entry

### 14.10 Footer

- [ ] Build `LandingFooter.tsx`
  - [ ] 4-column grid (desktop), stacked (mobile)
  - [ ] Brand, Navigate, Account, Legal columns
  - [ ] All links are either internal routes or `mailto:` / `tel:` links
  - [ ] Copyright line with current year
  - [ ] Confirm all footer links have descriptive text (no "click here")

### 14.11 SEO & Metadata

- [ ] Add `react-helmet-async` `HelmetProvider` to `main.tsx`
- [ ] Add `<Helmet>` to `LandingPage.tsx` with full meta tags (Section 10.1)
- [ ] Add Open Graph tags (Section 10.2)
- [ ] Add JSON-LD structured data (Section 10.3)
- [ ] Create `public/robots.txt` with correct Allow/Disallow rules (Section 10.4)
- [ ] Create `public/sitemap.xml` with only public routes

### 14.12 Performance Validation

- [ ] Run `vite-bundle-visualizer` — confirm landing chunk contains no auth/Redux/Axios code
- [ ] Confirm landing chunk is < 60 KB gzipped
- [ ] Run Lighthouse against landing page — confirm Performance > 95, SEO > 90
- [ ] Confirm no CLS: all fonts preloaded, image dimensions set, skeleton prevents flash
- [ ] Test on simulated slow 3G — LCP < 2.0s confirmed

---

## 15. Testing Checklist

### Unit Tests

- [ ] `useScrolledPast` — fires at correct scroll threshold, resets correctly
- [ ] `useInView` — fires when element enters viewport, does not re-fire
- [ ] Count-up animation logic — reaches correct final value, respects reduced motion
- [ ] `LandingNav` CTA label — "Apply Now" when unauthenticated, "Go to Dashboard" when authenticated
- [ ] `AvailabilityBadge` — renders correct label and color for each of 4 availability states
- [ ] Session CTA button — disabled when status is `full`
- [ ] `TestimonialsSection` — does not render when testimonials array is empty

### Integration Tests

- [ ] Hero CTA "Apply Now" navigates to `/register`
- [ ] Hero "Learn More" smooth-scrolls to `#about` section
- [ ] Session card "Apply for This Session" navigates to `/register?session={id}`
- [ ] FAQ accordion opens and closes items on click and keyboard Enter/Space
- [ ] Mobile nav drawer opens on hamburger click, closes on link click and Escape
- [ ] Carousel prev/next buttons advance and retreat slides

### E2E Tests (Playwright)

- [ ] Landing page loads at `/` without authentication
- [ ] Full keyboard navigation through entire page: nav → hero → all sections → footer
- [ ] Anchor links scroll to correct sections
- [ ] "Apply Now" CTA navigates to registration page
- [ ] Authenticated user visits `/` — nav shows "Go to Dashboard" — clicking navigates correctly
- [ ] All FAQ items are keyboard operable
- [ ] Carousel is keyboard operable
- [ ] Page passes axe-core scan with zero violations
- [ ] Page renders correctly at 375px, 768px, and 1280px
- [ ] Reduced motion setting disables animations (tested via `prefers-reduced-motion` media query emulation)

---

## 16. Definition of Done

The landing page is considered complete when ALL of the following are true:

- [ ] All 9 sections are fully implemented and visually match the design specification
- [ ] LandingNav glass transition works on scroll; CTA is auth-aware
- [ ] Session cards display correct availability states for all four statuses
- [ ] All CTAs route to the correct destination
- [ ] FAQ accordion is fully keyboard operable and uses Radix Accordion
- [ ] `<Helmet>` meta tags, Open Graph, and JSON-LD are in place
- [ ] `robots.txt` and `sitemap.xml` are correct and deployed
- [ ] Landing chunk is < 60 KB gzipped (verified by bundle analyzer)
- [ ] Lighthouse performance > 95, SEO > 90 on production build
- [ ] LCP < 2.0s confirmed on simulated 3G
- [ ] CLS < 0.05 confirmed
- [ ] Zero axe-core accessibility violations
- [ ] Full keyboard navigation works through the entire page
- [ ] Reduced motion compliance confirmed: all animations disabled when setting is active
- [ ] Renders correctly at 375px, 768px, and 1280px
- [ ] Unit tests passing for all hooks, utilities, and config-driven components
- [ ] E2E tests passing in Chromium, Firefox, and WebKit
- [ ] No Redux, Axios, or auth feature imports in any landing page component (enforced by ESLint `no-restricted-imports` rule for the `features/landing/` directory)
- [ ] PR reviewed and approved

---

## 17. Architectural Decision Record

### ADR-L-001: Landing Page Co-Located in the Same Vite Project

**Status:** Accepted
**Decision:** The public marketing landing page lives inside the same Vite project as the authenticated application, as a dedicated `features/landing` module under the `/` route.
**Rationale:** Shared design token system, typography, glassmorphism components, and motion constants with the authenticated app ensures visual consistency without duplicating infrastructure. Separate deployment is not warranted at current scale. The landing page is strictly isolated — enforced by ESLint `no-restricted-imports` rules that prevent any landing module from importing auth, Redux store, Axios, or PHI-adjacent code. A Vite chunk boundary ensures the public-page bundle never pulls in authenticated-application dependencies.
**Revisit Condition:** If SEO requirements grow to demand server-side rendering or static site generation, extract the landing page to a Next.js or Astro deployment and link to the SPA for authenticated flows.

### ADR-L-002: Static Session Data by Default

**Status:** Accepted
**Decision:** Session information on the landing page is sourced from a static configuration file (`sessions.config.ts`) by default, not from a live API call.
**Rationale:** The landing page has no authentication context and should not make API calls as a baseline behavior. Static data is faster, more reliable, and eliminates a potential failure point. The configuration is updated manually per registration cycle. If real-time availability data is required in a future cycle, a single unauthenticated public endpoint (`/api/sessions?is_active=true`) can be called — this is a documented and permitted exception (Section 11.2).

### ADR-L-003: LandingNav Separate from AppShell Header

**Status:** Accepted
**Decision:** The landing page uses its own `LandingNav` component and does not share the `AppShell` header from the authenticated application.
**Rationale:** The two navbars serve fundamentally different purposes (marketing vs application), have different visual behaviors (transparent-to-glass vs always-glass), and contain entirely different navigation items (anchor scroll vs route navigation). Forcing them to share a single component would create an overly complex, prop-driven component. Separate components with shared design tokens is the cleaner architectural choice.

---

**Document Status:** Authoritative
**Maintained By:** Frontend Lead
**Companion Documents:** Frontend Architecture Plan v1.0.0 | Frontend Development Plan v1.0.0
**Review Cycle:** Per-registration-cycle or when marketing requirements change
**Estimated Development Duration:** 1 week (parallelizable with Phase 3 of the main Development Plan)
