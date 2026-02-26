/**
 * ForgotPasswordPage.tsx
 * Forgot password — wired to POST /api/auth/forgot-password.
 * Shows success confirmation state after submission.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '@/features/auth/schemas/auth.schema';
import { forgotPassword } from '@/features/auth/api/auth.api';
import { ROUTES } from '@/shared/constants/routes';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { FormField } from '@/ui/components/FormField';
import { Button } from '@/ui/components/Button';
import { fadeVariants } from '@/shared/constants/motion';

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      await forgotPassword(values);
      setSubmittedEmail(values.email);
      setSubmitted(true);
    } catch {
      // Always show success for security (don't reveal if email exists)
      setSubmittedEmail(values.email);
      setSubmitted(true);
      toast.info('If an account exists, a reset link has been sent.');
    }
  };

  return (
    <AuthCard
      title={submitted ? 'Check your email' : 'Reset your password'}
      subtitle={
        submitted
          ? `We sent a password reset link to ${submittedEmail}.`
          : 'Enter the email address on your account and we will send a reset link.'
      }
      footer={
        <Link
          to={ROUTES.LOGIN}
          className="inline-flex items-center gap-1.5 text-ember-orange hover:underline font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      }
    >
      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="success"
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center gap-6 py-4"
          >
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl"
              style={{ background: 'var(--glass-icon-bg)' }}
            >
              <Mail className="h-8 w-8 text-ember-orange" />
            </div>
            <p className="text-sm text-center" style={{ color: 'var(--on-image-muted)' }}>
              Didn&apos;t receive it? Check your spam folder, or{' '}
              <button
                onClick={() => setSubmitted(false)}
                className="text-ember-orange hover:underline"
              >
                try a different email
              </button>
              .
            </p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-5"
          >
            <FormField
              label="Email address"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Button type="submit" fullWidth loading={isSubmitting}>
              Send reset link
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthCard>
  );
}
