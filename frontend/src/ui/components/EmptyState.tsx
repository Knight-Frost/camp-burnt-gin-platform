/**
 * EmptyState.tsx / ErrorState.tsx
 * Reusable empty and error state displays for data-fetching components.
 */

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import { Button } from './Button';
import { fadeVariants } from '@/shared/constants/motion';

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: EmptyStateProps) {
  return (
    <motion.div
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--muted)' }}
      >
        <Icon className="h-6 w-6" style={{ color: 'var(--muted-foreground)' }} />
      </div>
      <h3
        className="text-base font-headline font-semibold mb-1"
        style={{ color: 'var(--foreground)' }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-sm max-w-xs leading-relaxed mb-6"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {description}
        </p>
      )}
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// ErrorState
// ---------------------------------------------------------------------------

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'An error occurred while loading this data. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <motion.div
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(220,38,38,0.08)' }}
      >
        <AlertCircle className="h-6 w-6" style={{ color: 'var(--destructive)' }} />
      </div>
      <h3
        className="text-base font-headline font-semibold mb-1"
        style={{ color: 'var(--foreground)' }}
      >
        {title}
      </h3>
      <p
        className="text-sm max-w-xs leading-relaxed mb-6"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {description}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      )}
    </motion.div>
  );
}
