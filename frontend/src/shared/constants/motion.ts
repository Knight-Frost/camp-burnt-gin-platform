/**
 * motion.ts — Framer Motion animation variants and transition presets
 *
 * Framer Motion is the animation library used throughout this app.
 * A "variant" is a named animation state (like 'hidden' and 'visible') that
 * Framer Motion transitions between when triggered.
 *
 * Centralizing all animation values here means:
 * - No magic numbers scattered across components.
 * - A single place to tune the feel of the whole app.
 * - Short-name aliases (pageEntry, staggerContainer, etc.) for common patterns.
 *
 * Standard easing: [0.25, 0.1, 0.25, 1] — cubic-bezier used project-wide.
 * Note: MotionConfig in providers.tsx automatically respects OS "reduce motion" settings.
 */

import type { Variants, Transition } from 'framer-motion';

// ---------------------------------------------------------------------------
// Shared easing and transition presets
// ---------------------------------------------------------------------------

// Standard cubic-bezier easing — smooth and natural feeling
export const EASE_STANDARD = [0.25, 0.1, 0.25, 1] as const;
// Slightly heavier easing used for slow image crossfades — less snappy
export const EASE_IMAGE_CROSSFADE = [0.4, 0, 0.2, 1] as const;

// Factory functions that return Transition objects — accept optional duration and delay overrides
export const transition = {
  // Standard 1-second ease — used for most UI elements
  standard: (duration = 1.0, delay = 0): Transition => ({
    duration,
    delay,
    ease: EASE_STANDARD,
  }),
  // Quick 300ms ease — used for hover effects and small interactive elements
  fast: (delay = 0): Transition => ({
    duration: 0.3,
    delay,
    ease: EASE_STANDARD,
  }),
  // Slow 1.4-second ease — used for hero sections and major page transitions
  slow: (delay = 0): Transition => ({
    duration: 1.4,
    delay,
    ease: EASE_STANDARD,
  }),
  // Physics-based spring — bouncy feel for confirmations and popups
  spring: (delay = 0): Transition => ({
    type: 'spring',
    stiffness: 300,
    damping: 30,
    delay,
  }),
} as const;

// ---------------------------------------------------------------------------
// Page and section entry animations
// ---------------------------------------------------------------------------

/** Full-page hero entry — 1.4s, 40px lift from below */
export const pageEntryVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.4, ease: EASE_STANDARD },
  },
};

/** Standard section entry — 1.2s, 30px lift */
export const sectionEntryVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.2, ease: EASE_STANDARD },
  },
};

/** Scroll-triggered reveal — 1.0s, 20px lift — used with whileInView */
export const scrollRevealVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.0, ease: EASE_STANDARD },
  },
};

/** Fade only — no positional movement, just opacity change */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: EASE_STANDARD },
  },
  // exit variant is used with AnimatePresence to animate elements leaving the DOM
  exit: {
    opacity: 0,
    transition: { duration: 0.3, ease: EASE_STANDARD },
  },
};

/** Scale in from slightly smaller — used for cards and popovers */
export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: EASE_STANDARD },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.3, ease: EASE_STANDARD },
  },
};

// ---------------------------------------------------------------------------
// Stagger container and child patterns
// ---------------------------------------------------------------------------

/**
 * staggerContainerVariants — Container that staggers its children
 *
 * When a parent uses this variant, Framer Motion automatically delays each
 * child's animation by `staggerChildren` seconds, creating a cascade effect.
 * The parent itself has no visual animation — it only controls timing.
 */
export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      // Each child starts 150ms after the previous one
      staggerChildren: 0.15,
      // Wait 100ms before starting the first child
      delayChildren: 0.1,
    },
  },
};

/** Individual stagger child — used inside staggerContainerVariants */
export const staggerChildVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.0, ease: EASE_STANDARD },
  },
};

/** Fast stagger for dense lists (dashboard rows, nav items) — tighter timing */
export const fastStaggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

/** Fast stagger child — slides in from the left rather than from below */
export const fastStaggerChildVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: EASE_STANDARD },
  },
};

// ---------------------------------------------------------------------------
// Navigation animations
// ---------------------------------------------------------------------------

/** Top nav slide down on mount — enters from above */
export const navSlideVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.2, ease: EASE_STANDARD },
  },
};

/** Mobile full-screen menu overlay — fades in/out without moving */
export const mobileMenuVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3, ease: EASE_STANDARD },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.3, ease: EASE_STANDARD },
  },
};

/** Sidebar slide in from left — used for dashboard navigation panels */
export const sidebarVariants: Variants = {
  // Starts 280px off-screen to the left (matching typical sidebar width)
  hidden: { x: -280, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: EASE_STANDARD },
  },
};

// ---------------------------------------------------------------------------
// Panel and overlay animations
// ---------------------------------------------------------------------------

/** Slide-out panel from right (notifications drawer, detail panels) */
export const slidePanelVariants: Variants = {
  // Starts fully off-screen to the right
  hidden: { x: '100%', opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.35, ease: EASE_STANDARD },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { duration: 0.3, ease: EASE_STANDARD },
  },
};

/** Dropdown menu open/close — slight upward offset when hidden */
export const dropdownVariants: Variants = {
  hidden: { opacity: 0, y: -8, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: EASE_STANDARD },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.97,
    transition: { duration: 0.15, ease: EASE_STANDARD },
  },
};

/** Modal dialog — fades in while scaling up slightly from center */
export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, ease: EASE_STANDARD },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.25, ease: EASE_STANDARD },
  },
};

/** Modal backdrop — the dark overlay behind a dialog */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

// ---------------------------------------------------------------------------
// Form step transitions (multi-step form)
// ---------------------------------------------------------------------------

/** Slide forward to next step — exits to the left, enters from the right */
export const stepForwardVariants: Variants = {
  hidden: { opacity: 0, x: 60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: EASE_STANDARD },
  },
  exit: {
    opacity: 0,
    x: -60,
    transition: { duration: 0.3, ease: EASE_STANDARD },
  },
};

/** Slide backward to previous step — exits to the right, enters from the left */
export const stepBackwardVariants: Variants = {
  hidden: { opacity: 0, x: -60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: EASE_STANDARD },
  },
  exit: {
    opacity: 0,
    x: 60,
    transition: { duration: 0.3, ease: EASE_STANDARD },
  },
};

// ---------------------------------------------------------------------------
// Interactive element defaults
// ---------------------------------------------------------------------------

/** Standard button hover/tap — apply directly as motion component props */
export const buttonMotion = {
  whileHover: { scale: 1.03 },
  whileTap: { scale: 0.98 },
} as const;

/** Icon button — slightly more pronounced scale delta for smaller targets */
export const iconButtonMotion = {
  whileHover: { scale: 1.08 },
  whileTap: { scale: 0.94 },
} as const;

/** Card hover lift — nudges the card upward when hovered */
export const cardHoverMotion = {
  whileHover: { y: -4, transition: { duration: 0.25, ease: EASE_STANDARD } },
} as const;

/** Footer link hover nudge — slides the link slightly to the right */
export const linkNudgeMotion = {
  whileHover: { x: 4, transition: { duration: 0.2, ease: EASE_STANDARD } },
} as const;

/** Mission icon hover — scales up and rotates slightly */
export const iconOrbitMotion = {
  whileHover: {
    scale: 1.1,
    rotate: 5,
    transition: { duration: 0.25, ease: EASE_STANDARD },
  },
} as const;

// ---------------------------------------------------------------------------
// Image crossfade (LivingBackground)
// ---------------------------------------------------------------------------

// Slow crossfade easing is used here so background image transitions feel cinematic
export const imageFadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 2.2, ease: EASE_IMAGE_CROSSFADE },
  },
};

export const imageFadeOutVariants: Variants = {
  visible: { opacity: 1 },
  hidden: {
    opacity: 0,
    transition: { duration: 2.2, ease: EASE_IMAGE_CROSSFADE },
  },
};

// ---------------------------------------------------------------------------
// Viewport defaults (for whileInView)
// ---------------------------------------------------------------------------

/** Standard scroll viewport — trigger 100px before element enters view, fire once */
export const scrollViewport = {
  once: true,
  // Negative margin means the animation triggers slightly before the element is visible
  margin: '-100px',
} as const;

/** Eager scroll viewport — trigger the moment the element enters the viewport */
export const eagerScrollViewport = {
  once: true,
  margin: '0px',
} as const;

// ---------------------------------------------------------------------------
// Short-name aliases (used by pages for brevity)
// ---------------------------------------------------------------------------

export const scrollReveal = scrollRevealVariants;
export const staggerContainer = staggerContainerVariants;
export const staggerChild = staggerChildVariants;
export const pageEntry = pageEntryVariants;
export const modalBackdrop = backdropVariants;
export const modalContent = modalVariants;

/** Button hover scale — use as whileHover prop on a motion element */
export const buttonHover = { scale: 1.03 } as const;
/** Button tap scale — use as whileTap prop on a motion element */
export const buttonTap = { scale: 0.98 } as const;
/** Card hover lift alias */
export const cardHover = cardHoverMotion;
/** Fade-in variants alias */
export const fadeIn = fadeVariants;
