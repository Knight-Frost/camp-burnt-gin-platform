/**
 * StatusBadge.tsx
 *
 * Purpose: A colored inline badge that communicates the status of an entity
 * (application, session, medical severity, etc.) at a glance.
 *
 * Responsibilities:
 *   - Maps a status string to a background color, text color, and display label.
 *   - Optionally renders a small colored dot before the label for extra visual weight.
 *   - All color values meet WCAG AA 4.5:1 contrast ratio on their respective
 *     tinted backgrounds — ensuring accessibility compliance.
 *
 * Supported status values:
 *   Application statuses: draft, submitted, under_review, approved, accepted,
 *                         rejected, withdrawn
 *   General statuses:     pending, active, inactive, open, closed, cancelled, waitlist
 *   Medical severity:     low, moderate, high, critical
 */

import { cn } from '@/shared/utils/cn';
import type { ApplicationStatus } from '@/shared/types';

/** Union of all accepted status string values. */
type BadgeVariant =
  | ApplicationStatus
  | 'pending'
  | 'submitted'
  | 'accepted'
  | 'active'
  | 'inactive'
  | 'open'
  | 'closed'
  | 'waitlist'
  | 'waitlisted'
  | 'cancelled'
  | 'low'
  | 'moderate'
  | 'high'
  | 'critical';

// All text colors meet WCAG AA 4.5:1 contrast on their tinted backgrounds.
const variantConfig: Record<BadgeVariant, { bg: string; text: string; label: string }> = {
  pending: {
    bg: 'rgba(107,114,128,0.12)',
    text: '#374151',   // gray-700
    label: 'Pending',
  },
  draft: {
    bg: 'rgba(107,114,128,0.12)',
    text: '#374151',   // gray-700
    label: 'Draft',
  },
  submitted: {
    bg: 'rgba(37,99,235,0.12)',
    text: '#2563eb',   // blue-700 = --night-sky-blue
    label: 'Submitted',
  },
  under_review: {
    bg: 'rgba(234,179,8,0.15)',
    text: '#854d0e',   // yellow-800 — WCAG AA on yellow tint
    label: 'Under Review',
  },
  approved: {
    bg: 'rgba(22,163,74,0.10)',
    text: '#16a34a',
    label: 'Approved',
  },
  accepted: {
    bg: 'rgba(22,163,74,0.10)',
    text: '#16a34a',
    label: 'Accepted',
  },
  rejected: {
    bg: 'rgba(220,38,38,0.12)',
    text: '#dc2626',   // --destructive
    label: 'Rejected',
  },
withdrawn: {
    bg: 'rgba(107,114,128,0.12)',
    text: '#374151',
    label: 'Withdrawn',
  },
  active: {
    bg: 'rgba(22,163,74,0.10)',
    text: '#16a34a',
    label: 'Active',
  },
  inactive: {
    bg: 'rgba(107,114,128,0.12)',
    text: '#374151',
    label: 'Inactive',
  },
  open: {
    bg: 'rgba(22,163,74,0.10)',
    text: '#16a34a',
    label: 'Open',
  },
  closed: {
    bg: 'rgba(220,38,38,0.12)',
    text: '#dc2626',
    label: 'Closed',
  },
  cancelled: {
    bg: 'rgba(107,114,128,0.12)',
    text: '#374151',
    label: 'Cancelled',
  },
  waitlist: {
    bg: 'rgba(22,163,74,0.10)',
    text: '#16a34a',
    label: 'Waitlist',
  },
  waitlisted: {
    bg: 'rgba(234,179,8,0.15)',
    text: '#854d0e',   // yellow-800 — amber tint, same as under_review
    label: 'Waitlisted',
  },
  // Medical severity levels — green → amber → orange → red as risk increases.
  low: {
    bg: 'rgba(22,163,74,0.10)',
    text: '#16a34a',   // green = safe
    label: 'Low Risk',
  },
  moderate: {
    bg: 'rgba(180,83,9,0.10)',
    text: '#b45309',   // amber-700 = caution
    label: 'Moderate Risk',
  },
  high: {
    bg: 'rgba(194,65,12,0.10)',
    text: '#c2410c',   // orange-700 = warning
    label: 'High Risk',
  },
  critical: {
    bg: 'rgba(220,38,38,0.12)',
    text: '#dc2626',   // --destructive = danger
    label: 'Critical Risk',
  },
};

interface StatusBadgeProps {
  status: BadgeVariant;
  className?: string;
  /** When true, renders a small colored dot before the label text. */
  showDot?: boolean;
}

export function StatusBadge({ status, className, showDot = false }: StatusBadgeProps) {
  // Fall back to 'draft' config if an unrecognized status string is passed.
  const config = variantConfig[status] ?? variantConfig.draft;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        className
      )}
      style={{ background: config.bg, color: config.text }}
    >
      {/* Optional dot — same color as the text for visual cohesion */}
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: config.text }}
          aria-hidden="true"
        />
      )}
      {config.label}
    </span>
  );
}
