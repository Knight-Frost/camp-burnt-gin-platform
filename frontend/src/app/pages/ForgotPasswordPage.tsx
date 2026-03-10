/**
 * ForgotPasswordPage.tsx
 *
 * Purpose: Lets users request a password reset link via email.
 * Responsibilities:
 *   - Renders a simple email input form.
 *   - On submit: POSTs to POST /api/auth/forgot-password.
 *   - Always shows the "check your email" success screen after submission,
 *     even if the API call fails — this hides whether a given email exists
 *     in the system (a standard security practice).
 *
 * Two visual states:
 *   1. Form state   — email input + submit button.
 *   2. Success state — envelope icon + link to try a different address.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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

export function ForgotPasswordPage() {
  // When true the form is replaced by the success confirmation screen.
  const [submitted, setSubmitted] = useState(false);
  // Stores the email the user entered so we can display it in the success message.
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
      // API call succeeded — show success screen.
      setSubmittedEmail(values.email);
      setSubmitted(true);
    } catch {
      // API call failed, but we still show the success screen.
      // This prevents an attacker from probing which emails are registered.
      setSubmittedEmail(values.email);
      setSubmitted(true);
      toast.info('If an account exists, a reset link has been sent.');
    }
  };

  return (
    <AuthCard
      // The card title and subtitle change dynamically between the two states.
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
      {submitted ? (
        // ── Success state ──────────────────────────────────────────────────
        <div className="flex flex-col items-center gap-6 py-4">
          {/* Mail icon gives a visual cue that something was sent to their inbox */}
          <div
            className="flex items-center justify-center w-16 h-16 rounded-2xl"
            style={{ background: 'var(--glass-icon-bg)' }}
          >
            <Mail className="h-8 w-8 text-ember-orange" />
          </div>
          <p className="text-sm text-center" style={{ color: 'var(--on-image-muted)' }}>
            Didn&apos;t receive it? Check your spam folder, or{' '}
            {/* Clicking here resets the form so they can try a different address */}
            <button
              onClick={() => setSubmitted(false)}
              className="text-ember-orange hover:underline"
            >
              try a different email
            </button>
            .
          </p>
        </div>
      ) : (
        // ── Form state ─────────────────────────────────────────────────────
        <form
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
          {/* fullWidth makes the button span the entire card width */}
          <Button type="submit" fullWidth loading={isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
