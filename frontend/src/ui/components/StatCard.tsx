/**
 * StatCard.tsx
 *
 * Purpose: An animated statistic card used on all dashboard overview pages.
 *
 * Responsibilities:
 *   - Displays a labeled numeric metric with an icon.
 *   - Animates the number from 0 to `value` over ~1.2 seconds using a
 *     requestAnimationFrame loop with an ease-out cubic curve, giving the
 *     "counting up" effect that makes dashboards feel alive.
 *   - Animates the card into view via a Framer Motion scroll-reveal when it
 *     enters the viewport (useful on pages with many stat cards below the fold).
 *   - Accepts a `delay` prop to stagger multiple cards on the same page.
 *
 * Why requestAnimationFrame instead of CSS animation?
 *   rAF gives us precise frame-by-frame control to apply the easing function
 *   and format the number with toLocaleString() at each step.
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
 *
 * How it works:
 *   1. On mount (or when `target` changes), records the current time.
 *   2. Each animation frame computes elapsed time / duration to get a 0–1 progress value.
 *   3. Applies a cubic ease-out curve: `1 - (1 - progress)^3` — fast start, gentle finish.
 *   4. Multiplies by `target` and floors to get the displayed integer.
 *   5. Cancels the rAF loop once progress reaches 1 and snaps to the exact target.
 *
 * @param target   - the final number to count up to
 * @param duration - animation duration in milliseconds
 */
function useCountUp(target: number, duration = 1200): number {
  const [count, setCount] = useState(0);
  // Store the rAF handle so the cleanup function can cancel it on unmount.
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      // progress is a value between 0 and 1 representing how far through the animation we are.
      const progress = Math.min((now - start) / duration, 1);
      // Ease-out cubic: decelerates as it approaches the end value.
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Snap to exact value at the end — avoids floating-point rounding leaving a wrong digit.
        setCount(target);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    // Cancel any in-progress animation when the component unmounts or target changes.
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
  // count animates from 0 to value over 1.2 seconds.
  const count = useCountUp(value, 1200);

  return (
    // whileInView triggers the animation once the card enters the visible viewport area.
    <motion.div
      variants={scrollRevealVariants}
      initial="hidden"
      whileInView="visible"
      viewport={scrollViewport}
      transition={{ delay }}
      className="rounded-2xl border p-7 flex items-start gap-5"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Icon container — colored background is 10% opacity of the accent color */}
      <div
        className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
        // `${color}18` appends "18" as a hex alpha channel (18/FF ≈ 10% opacity).
        style={{ background: `${color}18` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>

      {/* Stat value and label */}
      <div className="flex-1 min-w-0">
        {/* Large animated number — toLocaleString adds thousands separators */}
        <p
          className="text-3xl font-headline font-semibold"
          style={{ color: 'var(--foreground)' }}
        >
          {count.toLocaleString()}{suffix}
        </p>
        {/* Metric label below the number in muted color */}
        <p className="text-sm mt-1 leading-snug" style={{ color: 'var(--muted-foreground)' }}>
          {label}
        </p>
      </div>
    </motion.div>
  );
}
