/**
 * MfaVerifyPage.tsx
 * Multi-factor authentication verification page.
 * 6-digit OTP input with auto-advance between digits.
 * Wired to POST /api/mfa/verify.
 */

import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';

import { verifyMfa } from '@/features/auth/api/auth.api';
import { setMfaVerified } from '@/features/auth/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { Button } from '@/ui/components/Button';

const CODE_LENGTH = 6;

export function MfaVerifyPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;

    setError(null);
    const updated = [...digits];
    updated[index] = value;
    setDigits(updated);

    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are filled
    if (updated.every((d) => d !== '') && value) {
      handleVerify(updated.join(''));
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;

    const updated = Array(CODE_LENGTH).fill('');
    pasted.split('').forEach((char, i) => {
      updated[i] = char;
    });
    setDigits(updated);
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();

    if (pasted.length === CODE_LENGTH) {
      handleVerify(pasted);
    }
  };

  const handleVerify = async (code: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await verifyMfa(code);
      dispatch(setMfaVerified(true));
      toast.success('Identity verified.');

      const role = getPrimaryRole(user?.roles ?? []);
      navigate(getDashboardRoute(role), { replace: true });
    } catch (err) {
      setError((err as { message: string }).message ?? 'Invalid code. Please try again.');
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const code = digits.join('');

  return (
    <AuthCard
      title="Two-factor authentication"
      subtitle="Enter the 6-digit code from your authenticator app."
    >
      <div className="flex flex-col items-center gap-8">
        {/* Shield icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex items-center justify-center w-16 h-16 rounded-2xl"
          style={{ background: 'var(--glass-icon-bg)' }}
        >
          <ShieldCheck className="h-8 w-8 text-ember-orange" />
        </motion.div>

        {/* OTP digit inputs */}
        <div className="flex gap-3" role="group" aria-label="One-time password input">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              aria-label={`Digit ${index + 1}`}
              className="w-12 h-14 text-center text-xl font-headline font-semibold rounded-xl border outline-none transition-all duration-300 focus:ring-2 focus:ring-ember-orange/40"
              style={{
                background: 'var(--input)',
                color: 'var(--on-image-text)',
                borderColor: error
                  ? 'var(--destructive)'
                  : digit
                  ? 'var(--ember-orange)'
                  : 'var(--on-image-border)',
              }}
            />
          ))}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="text-sm text-center"
              style={{ color: 'var(--destructive)' }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <Button
          fullWidth
          loading={isSubmitting}
          disabled={code.length < CODE_LENGTH}
          onClick={() => handleVerify(code)}
        >
          Verify identity
        </Button>
      </div>
    </AuthCard>
  );
}
