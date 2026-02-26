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

const variantConfig: Record<BadgeVariant, { bg: string; text: string; label: string }> = {
  pending: {
    bg: 'rgba(34,197,94,0.12)',
    text: '#22C55E',
    label: 'Pending',
  },
  draft: {
    bg: 'rgba(156,163,175,0.15)',
    text: '#9CA3AF',
    label: 'Draft',
  },
  submitted: {
    bg: 'rgba(96,165,250,0.15)',
    text: '#60A5FA',
    label: 'Submitted',
  },
  under_review: {
    bg: 'rgba(34,197,94,0.12)',
    text: '#22C55E',
    label: 'Under Review',
  },
  accepted: {
    bg: 'rgba(16,185,129,0.15)',
    text: '#10B981',
    label: 'Accepted',
  },
  rejected: {
    bg: 'rgba(248,113,113,0.15)',
    text: '#F87171',
    label: 'Rejected',
  },
  waitlisted: {
    bg: 'rgba(167,139,250,0.15)',
    text: '#A78BFA',
    label: 'Waitlisted',
  },
  withdrawn: {
    bg: 'rgba(156,163,175,0.1)',
    text: '#6B7280',
    label: 'Withdrawn',
  },
  active: {
    bg: 'rgba(16,185,129,0.15)',
    text: '#10B981',
    label: 'Active',
  },
  inactive: {
    bg: 'rgba(156,163,175,0.1)',
    text: '#6B7280',
    label: 'Inactive',
  },
  open: {
    bg: 'rgba(16,185,129,0.15)',
    text: '#10B981',
    label: 'Open',
  },
  closed: {
    bg: 'rgba(248,113,113,0.15)',
    text: '#F87171',
    label: 'Closed',
  },
  cancelled: {
    bg: 'rgba(156,163,175,0.1)',
    text: '#6B7280',
    label: 'Cancelled',
  },
  waitlist: {
    bg: 'rgba(34,197,94,0.12)',
    text: '#22C55E',
    label: 'Waitlist',
  },
  low: {
    bg: 'rgba(16,185,129,0.15)',
    text: '#10B981',
    label: 'Low Risk',
  },
  moderate: {
    bg: 'rgba(34,197,94,0.12)',
    text: '#22C55E',
    label: 'Moderate Risk',
  },
  high: {
    bg: 'rgba(251,146,60,0.15)',
    text: '#F59E0B',
    label: 'High Risk',
  },
  critical: {
    bg: 'rgba(248,113,113,0.15)',
    text: '#F87171',
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
