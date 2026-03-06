/**
 * VerifyEmailPage.tsx
 * Email verification landing page — handles the link the user clicks from their inbox.
 *
 * Reads id/hash/expires/signature from the URL search params,
 * POSTs to POST /api/auth/email/verify, and shows the result.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { verifyEmail, resendVerificationEmail } from '@/features/auth/api/auth.api';
import { ROUTES } from '@/shared/constants/routes';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { Button } from '@/ui/components/Button';
import { fadeVariants } from '@/shared/constants/motion';

type VerifyState = 'verifying' | 'success' | 'error' | 'resent';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [state, setState]       = useState<VerifyState>('verifying');
  const [resending, setResending] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const id        = searchParams.get('id')        ?? '';
    const hash      = searchParams.get('hash')      ?? '';
    const expires   = searchParams.get('expires')   ?? '';
    const signature = searchParams.get('signature') ?? '';

    if (!id || !hash || !expires || !signature) {
      setState('error');
      return;
    }

    verifyEmail({ id, hash, expires, signature })
      .then(() => setState('success'))
      .catch(() => setState('error'));
  }, [searchParams]);

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail();
      setState('resent');
      toast.success('Verification email sent. Check your inbox.');
    } catch {
      toast.error('Could not resend verification email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const renderContent = () => {
    switch (state) {
      case 'verifying':
        return (
          <motion.div
            key="verifying"
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center gap-4 py-6"
          >
            <Loader2 className="h-10 w-10 text-ember-orange animate-spin" />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Verifying your email address…
            </p>
          </motion.div>
        );

      case 'success':
        return (
          <motion.div
            key="success"
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center gap-5 py-4"
          >
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl"
              style={{ background: 'var(--glass-icon-bg)' }}
            >
              <CheckCircle className="h-8 w-8 text-ember-orange" />
            </div>
            <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              Your email has been verified. You can now access all features of your account.
            </p>
            <Link to={ROUTES.LOGIN}>
              <Button>Continue to sign in</Button>
            </Link>
          </motion.div>
        );

      case 'resent':
        return (
          <motion.div
            key="resent"
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center gap-5 py-4"
          >
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl"
              style={{ background: 'var(--glass-icon-bg)' }}
            >
              <Mail className="h-8 w-8 text-ember-orange" />
            </div>
            <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              A new verification link has been sent to your email address.
            </p>
          </motion.div>
        );

      case 'error':
        return (
          <motion.div
            key="error"
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center gap-5 py-4"
          >
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl"
              style={{ background: 'rgba(220,38,38,0.08)' }}
            >
              <XCircle className="h-8 w-8" style={{ color: '#dc2626' }} />
            </div>
            <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              This verification link is invalid or has expired. Request a new one below.
            </p>
            <Button onClick={handleResend} loading={resending} variant="secondary">
              Resend verification email
            </Button>
          </motion.div>
        );
    }
  };

  return (
    <AuthCard
      title="Verify your email"
      subtitle="Confirming your email address keeps your account secure."
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
      {renderContent()}
    </AuthCard>
  );
}
