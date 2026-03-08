/**
 * StatCard.tsx
 *
 * Purpose: An animated statistic card used on all dashboard overview pages.
 *
 * Redesigned (Phase 12) for localization resilience:
 *   - Left-aligned layout with flexible width
 *   - Reduced padding so cards don't feel cramped in 5-column grids
 *   - Label wraps gracefully instead of truncating
 *   - Minimum width safeguard prevents awkward squishing
 *   - Works in English and Spanish without layout breakage
 *
 * Responsibilities:
 *   - Displays a labeled numeric metric with an icon.
 *   - Animates the number from 0 to `value` over ~1.2 seconds using a
 *     requestAnimationFrame loop with an ease-out cubic curve.
 *   - Animates the card into view via a Framer Motion scroll-reveal.
 *   - Accepts a `delay` prop to stagger multiple cards on the same page.
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { scrollRevealVariants, scrollViewport } from '@/shared/constants/motion';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Icon and accent color — defaults to `var(--ember-orange)`. */
  color?: string;
  /** Optional unit suffix appended after the number (e.g. "%", "hrs"). */
  suffix?: string;
  /** Seconds to wait before the count-up animation starts (for stagger effects). */
  delay?: number;
}

/**
 * useCountUp — a custom hook that animates an integer from 0 to `target`.
 */
function useCountUp(target: number, duration = 1200): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color = 'var(--ember-orange)',
  suffix = '',
  delay = 0,
}: StatCardProps) {
  const count = useCountUp(value, 1200);

  return (
    <motion.div
      variants={scrollRevealVariants}
      initial="hidden"
      whileInView="visible"
      viewport={scrollViewport}
      transition={{ delay }}
      className="rounded-2xl border p-4 sm:p-5 flex items-start gap-3 min-w-0"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Icon container — 10% opacity tint of the accent color */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: `${color}18` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>

      {/* Stat value and label — min-w-0 enables text wrapping instead of overflow */}
      <div className="flex-1 min-w-0">
        {/* Large animated number */}
        <p
          className="text-2xl font-headline font-semibold leading-none"
          style={{ color: 'var(--foreground)' }}
        >
          {count.toLocaleString()}{suffix}
        </p>
        {/* Metric label — allows wrapping for long/translated strings */}
        <p
          className="text-xs sm:text-sm mt-1.5 leading-snug"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {label}
        </p>
      </div>
    </motion.div>
  );
}
