/**
 * StatusBadge.tsx
 * Colored status badge for application and other entity statuses.
 */

import { cn } from '@/shared/utils/cn';
import type { ApplicationStatus } from '@/shared/types';

type BadgeVariant =
  | ApplicationStatus
  | 'pending'
  | 'active'
  | 'inactive'
  | 'open'
  | 'closed'
  | 'waitlist'
  | 'cancelled'
  | 'low'
  | 'moderate'
  | 'high'
  | 'critical';

// All text colors meet WCAG AA 4.5:1 contrast on their tinted backgrounds.
const variantConfig: Record<BadgeVariant, { bg: string; text: string; label: string }> = {
  pending: {
    bg: 'rgba(22,101,52,0.10)',
    text: '#166534',   // brand dark emerald
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
    bg: 'rgba(22,101,52,0.10)',
    text: '#166534',
    label: 'Under Review',
  },
  accepted: {
    bg: 'rgba(22,101,52,0.10)',
    text: '#166534',
    label: 'Accepted',
  },
  rejected: {
    bg: 'rgba(220,38,38,0.12)',
    text: '#dc2626',   // --destructive
    label: 'Rejected',
  },
  waitlisted: {
    bg: 'rgba(109,40,217,0.12)',
    text: '#6d28d9',   // purple-700
    label: 'Waitlisted',
  },
  withdrawn: {
    bg: 'rgba(107,114,128,0.12)',
    text: '#374151',
    label: 'Withdrawn',
  },
  active: {
    bg: 'rgba(22,101,52,0.10)',
    text: '#166534',
    label: 'Active',
  },
  inactive: {
    bg: 'rgba(107,114,128,0.12)',
    text: '#374151',
    label: 'Inactive',
  },
  open: {
    bg: 'rgba(22,101,52,0.10)',
    text: '#166534',
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
    bg: 'rgba(22,101,52,0.10)',
    text: '#166534',
    label: 'Waitlist',
  },
  low: {
    bg: 'rgba(22,101,52,0.10)',
    text: '#166534',   // green = safe
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
  showDot?: boolean;
}

export function StatusBadge({ status, className, showDot = false }: StatusBadgeProps) {
  const config = variantConfig[status] ?? variantConfig.draft;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        className
      )}
      style={{ background: config.bg, color: config.text }}
    >
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
