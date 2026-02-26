/**
 * Button.tsx
 * Primary UI button with variant, size, loading state, and polymorphic `as` support.
 * Uses CTA design tokens for primary variant; glass tokens for secondary.
 */

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
  type ElementType,
} from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  as?: ElementType<any>;
  to?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'text-cta-primary-color border-cta-primary-border',
  secondary: 'text-on-image-text border-on-image-border',
  ghost: 'border-transparent text-on-image-muted hover:text-on-image-text',
  destructive: 'border-destructive/50 text-destructive',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      className,
      children,
      icon,
      as: Component,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const isPrimary = variant === 'primary';

    const sharedClassName = cn(
      'relative inline-flex items-center justify-center gap-2',
      'rounded-xl border font-headline font-medium',
      'transition-all duration-button cursor-pointer',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-orange/60',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      variantStyles[variant],
      sizeStyles[size],
      fullWidth && 'w-full',
      className
    );

    const sharedStyle =
      isPrimary
        ? { background: 'var(--cta-primary-bg)', boxShadow: 'var(--shadow-ember-primary)' }
        : variant === 'secondary'
        ? { background: 'var(--cta-secondary-bg)', boxShadow: 'var(--shadow-ember-secondary)' }
        : undefined;

    const content = (
      <>
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {!loading && icon}
        {children}
      </>
    );

    if (Component) {
      return (
        <Component
          className={sharedClassName}
          style={sharedStyle}
          {...props}
        >
          {content}
        </Component>
      );
    }

    return (
      <motion.button
        ref={ref}
        whileHover={isDisabled ? undefined : { scale: 1.03 }}
        whileTap={isDisabled ? undefined : { scale: 0.98 }}
        className={sharedClassName}
        style={sharedStyle}
        disabled={isDisabled}
        {...(props as object)}
      >
        {content}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
