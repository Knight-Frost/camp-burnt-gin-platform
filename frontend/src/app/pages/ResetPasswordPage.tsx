/**
 * ResetPasswordPage.tsx
 * Password reset — reads token + email from URL params.
 * Wired to POST /api/auth/reset-password.
 */

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '@/features/auth/schemas/auth.schema';
import { resetPassword } from '@/features/auth/api/auth.api';
import { ROUTES } from '@/shared/constants/routes';
import { isValidationError } from '@/shared/types';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { Button } from '@/ui/components/Button';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  if (!token || !email) {
    return (
      <AuthCard
        title="Invalid reset link"
        subtitle="This password reset link is invalid or has expired."
        footer={
          <Link to={ROUTES.FORGOT_PASSWORD} className="text-ember-orange hover:underline">
            Request a new reset link
          </Link>
        }
      >
        <div />
      </AuthCard>
    );
  }

  const onSubmit = async (values: ResetPasswordFormValues) => {
    try {
      await resetPassword({ ...values, token, email });
      toast.success('Password reset successfully. You can now sign in.');
      navigate(ROUTES.LOGIN);
    } catch (error) {
      if (isValidationError(error)) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          setError(field as keyof ResetPasswordFormValues, { message: messages[0] });
        });
        return;
      }
      toast.error(
        (error as { message: string }).message ?? 'Failed to reset password. Please try again.'
      );
    }
  };

  return (
    <AuthCard
      title="Set new password"
      subtitle="Choose a strong password for your account."
      footer={
        <Link to={ROUTES.LOGIN} className="text-ember-orange hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium" style={{ color: 'var(--on-image-text)' }}>
            New password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="w-full rounded-lg px-4 py-3 pr-12 text-sm outline-none border transition-all duration-300 focus:ring-2 focus:ring-ember-orange/40"
              style={{
                background: 'var(--input)',
                color: 'var(--on-image-text)',
                borderColor: errors.password ? 'var(--destructive)' : 'var(--on-image-border)',
              }}
              {...register('password')}
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              style={{ color: 'var(--on-image-muted)' }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </motion.button>
          </div>
          {errors.password && (
            <p role="alert" className="text-xs" style={{ color: 'var(--destructive)' }}>
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password_confirmation" className="text-sm font-medium" style={{ color: 'var(--on-image-text)' }}>
            Confirm new password
          </label>
          <div className="relative">
            <input
              id="password_confirmation"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              className="w-full rounded-lg px-4 py-3 pr-12 text-sm outline-none border transition-all duration-300 focus:ring-2 focus:ring-ember-orange/40"
              style={{
                background: 'var(--input)',
                color: 'var(--on-image-text)',
                borderColor: errors.password_confirmation ? 'var(--destructive)' : 'var(--on-image-border)',
              }}
              {...register('password_confirmation')}
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              style={{ color: 'var(--on-image-muted)' }}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </motion.button>
          </div>
          {errors.password_confirmation && (
            <p role="alert" className="text-xs" style={{ color: 'var(--destructive)' }}>
              {errors.password_confirmation.message}
            </p>
          )}
        </div>

        <Button type="submit" fullWidth loading={isSubmitting} className="mt-2">
          Reset password
        </Button>
      </form>
    </AuthCard>
  );
}
