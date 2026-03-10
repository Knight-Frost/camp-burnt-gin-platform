/**
 * StatCard.tsx
 *
 * Purpose: A statistic card used on all dashboard overview pages.
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
 *   - Displays the numeric value immediately (no count-up animation).
 *   - Accepts a `delay` prop (kept for API compatibility, unused).
 */

import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Icon and accent color — defaults to `var(--ember-orange)`. */
  color?: string;
  /** Optional unit suffix appended after the number (e.g. "%", "hrs"). */
  suffix?: string;
  /** Kept for API compatibility. */
  delay?: number;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color = 'var(--ember-orange)',
  suffix = '',
}: StatCardProps) {
  const count = value;

  return (
    <div
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
    </div>
  );
}
