/**
 * motion.ts
 * Central repository for all Framer Motion animation variants and transitions.
 * Every component imports from here — no inline duplication of animation values.
 *
 * Standard easing: [0.25, 0.1, 0.25, 1] — project-wide cubic-bezier.
 */

import type { Variants, Transition } from 'framer-motion';

// ---------------------------------------------------------------------------
// Shared easing and transition presets
// ---------------------------------------------------------------------------

export const EASE_STANDARD = [0.25, 0.1, 0.25, 1] as const;
export const EASE_IMAGE_CROSSFADE = [0.4, 0, 0.2, 1] as const;

export const transition = {
  standard: (duration = 1.0, delay = 0): Transition => ({
    duration,
    delay,
    ease: EASE_STANDARD,
  }),
  fast: (delay = 0): Transition => ({
    duration: 0.3,
    delay,
    ease: EASE_STANDARD,
  }),
  slow: (delay = 0): Transition => ({
    duration: 1.4,
    delay,
    ease: EASE_STANDARD,
  }),
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

/** Full-page hero entry — 1.4s, 40px lift */
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

/** Scroll-triggered reveal — 1.0s, 20px lift */
export const scrollRevealVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.0, ease: EASE_STANDARD },
  },
};

/** Fade only — no y movement */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: EASE_STANDARD },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.3, ease: EASE_STANDARD },
  },
};

/** Scale in from slightly smaller */
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

/** Container that staggers its children */
export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
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

/** Fast stagger for dense lists (dashboard rows, nav items) */
export const fastStaggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

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

/** Top nav slide down on mount */
export const navSlideVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.2, ease: EASE_STANDARD },
  },
};

/** Mobile full-screen menu overlay */
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

/** Sidebar slide in from left */
export const sidebarVariants: Variants = {
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

/** Slide-out panel from right (notifications, drawer) */
export const slidePanelVariants: Variants = {
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

/** Dropdown menu open/close */
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

/** Modal dialog */
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

/** Modal backdrop */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

// ---------------------------------------------------------------------------
// Form step transitions (multi-step form)
// ---------------------------------------------------------------------------

/** Slide forward to next step */
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

/** Slide backward to previous step */
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

/** Standard button hover/tap — apply directly as props */
export const buttonMotion = {
  whileHover: { scale: 1.03 },
  whileTap: { scale: 0.98 },
} as const;

/** Icon button (smaller scale delta) */
export const iconButtonMotion = {
  whileHover: { scale: 1.08 },
  whileTap: { scale: 0.94 },
} as const;

/** Card hover lift */
export const cardHoverMotion = {
  whileHover: { y: -4, transition: { duration: 0.25, ease: EASE_STANDARD } },
} as const;

/** Footer link hover nudge */
export const linkNudgeMotion = {
  whileHover: { x: 4, transition: { duration: 0.2, ease: EASE_STANDARD } },
} as const;

/** Mission icon hover */
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

/** Standard scroll viewport — trigger 100px before entering view, fire once */
export const scrollViewport = {
  once: true,
  margin: '-100px',
} as const;

/** Eager scroll viewport — trigger immediately when element enters */
export const eagerScrollViewport = {
  once: true,
  margin: '0px',
} as const;

// ---------------------------------------------------------------------------
// Short-name aliases (used by pages)
// ---------------------------------------------------------------------------

export const scrollReveal = scrollRevealVariants;
export const staggerContainer = staggerContainerVariants;
export const staggerChild = staggerChildVariants;
export const pageEntry = pageEntryVariants;
export const modalBackdrop = backdropVariants;
export const modalContent = modalVariants;

/** Button hover scale — use as whileHover prop */
export const buttonHover = { scale: 1.03 } as const;
/** Button tap scale — use as whileTap prop */
export const buttonTap = { scale: 0.98 } as const;
/** Card hover lift alias */
export const cardHover = cardHoverMotion;
/** Fade-in variants alias */
export const fadeIn = fadeVariants;
