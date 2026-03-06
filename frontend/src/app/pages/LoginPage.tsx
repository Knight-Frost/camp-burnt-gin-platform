/**
 * LoginPage.tsx
 * Two-phase login form:
 *   Phase 1 — email + password → POST /api/auth/login
 *   Phase 2 — MFA code input   → POST /api/auth/login again with mfa_code
 *
 * When the backend returns { mfa_required: true }, credentials are kept in
 * component state (never persisted) and the form switches to the MFA step.
 * On MFA submit, we call login({ email, password, mfa_code }) to get a full token.
 */

import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { loginSchema, type LoginFormValues } from '@/features/auth/schemas/auth.schema';
import { login } from '@/features/auth/api/auth.api';
import { setUser, setToken, hydrateAuth } from '@/features/auth/store/authSlice';
import { useAppDispatch } from '@/store/hooks';
import { ROUTES } from '@/shared/constants/routes';
import { getPrimaryRole, getDashboardRoute } from '@/shared/constants/roles';
import type { User } from '@/shared/types';
import { isValidationError, isLockoutError, isRateLimitError } from '@/shared/types';
import { AuthCard } from '@/features/auth/components/AuthCard';

const CODE_LENGTH = 6;

function inputCls(hasError: boolean, extra = '') {
  return [
    'w-full pl-11 py-3.5 rounded-xl border outline-none bg-white',
    'transition-all focus:ring-2 focus:ring-[#1e3a6e]/20 focus:border-[#1e3a6e]',
    hasError ? 'border-red-400' : 'border-[#d1dce8]',
    'text-[#1e293b] placeholder:text-slate-400',
    extra,
  ].join(' ');
}

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Phase 1 state
  const [showPassword,   setShowPassword]   = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Phase 2: MFA state — credentials held in ref (not Redux, not localStorage)
  const mfaCredentials  = useRef<{ email: string; password: string } | null>(null);
  const inputRefs       = useRef<(HTMLInputElement | null)[]>([]);
  const [mfaStep,       setMfaStep]         = useState(false);
  const [mfaDigits,     setMfaDigits]       = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [mfaError,      setMfaError]        = useState<string | null>(null);
  const [mfaSubmitting, setMfaSubmitting]   = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  // ── Phase 1: Credentials submit ─────────────────────────────────────────────

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const response = await login(values);

      if (response.mfa_required) {
        // Store credentials in memory only, switch to MFA step
        mfaCredentials.current = { email: values.email, password: values.password };
        setMfaStep(true);
        setMfaDigits(Array(CODE_LENGTH).fill(''));
        setMfaError(null);
        setTimeout(() => inputRefs.current[0]?.focus(), 120);
        return;
      }

      const { user, token } = response.data!;
      sessionStorage.setItem('auth_token', token);
      dispatch(setToken({ token }));
      dispatch(setUser(user));
      dispatch(hydrateAuth());
      toast.success(`Welcome back, ${user.name.split(' ')[0]}.`);
      const role = getPrimaryRole((user as User).roles ?? []);
      if (role) navigate(getDashboardRoute(role));

    } catch (error) {
      if (isLockoutError(error)) {
        setLockoutSeconds(error.retryAfter);
        toast.error(`Account locked. Try again in ${error.retryAfter} seconds.`);
        return;
      }
      if (isRateLimitError(error)) {
        toast.error(`Too many attempts. Please wait ${error.retryAfter} seconds.`);
        return;
      }
      if (isValidationError(error)) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          setError(field as keyof LoginFormValues, { message: messages[0] });
        });
        return;
      }
      toast.error((error as { message: string }).message ?? 'Login failed. Please try again.');
    }
  };

  // ── Phase 2: MFA digit input handlers ───────────────────────────────────────

  const handleMfaChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    setMfaError(null);
    const updated = [...mfaDigits];
    updated[index] = value;
    setMfaDigits(updated);
    if (value && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    if (updated.every((d) => d !== '') && value) void handleMfaVerify(updated.join(''));
  };

  const handleMfaKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !mfaDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleMfaPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    const updated = Array(CODE_LENGTH).fill('');
    pasted.split('').forEach((char, i) => { updated[i] = char; });
    setMfaDigits(updated);
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
    if (pasted.length === CODE_LENGTH) void handleMfaVerify(pasted);
  };

  const handleMfaVerify = async (code: string) => {
    if (!mfaCredentials.current) return;
    setMfaSubmitting(true);
    setMfaError(null);
    try {
      const response = await login({ ...mfaCredentials.current, mfa_code: code });
      const { user, token } = response.data!;
      mfaCredentials.current = null; // clear from memory
      sessionStorage.setItem('auth_token', token);
      dispatch(setToken({ token }));
      dispatch(setUser(user));
      dispatch(hydrateAuth());
      toast.success(`Welcome back, ${user.name.split(' ')[0]}.`);
      const mfaRole = getPrimaryRole((user as User).roles ?? []);
      if (mfaRole) navigate(getDashboardRoute(mfaRole));
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Invalid code. Please try again.';
      setMfaError(msg);
      setMfaDigits(Array(CODE_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 60);
    } finally {
      setMfaSubmitting(false);
    }
  };

  const mfaCode = mfaDigits.join('');

  // ── Render ───────────────────────────────────────────────────────────────────

  if (mfaStep) {
    return (
      <AuthCard
        title="Two-factor authentication"
        subtitle="Enter the 6-digit code from your authenticator app."
      >
        <div className="flex flex-col items-center gap-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-center w-16 h-16 rounded-2xl"
            style={{ background: 'rgba(30,58,110,0.08)' }}
          >
            <ShieldCheck className="h-8 w-8" style={{ color: '#1e3a6e' }} />
          </motion.div>

          {/* Digit inputs */}
          <div className="flex gap-3" role="group" aria-label="MFA code">
            {mfaDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleMfaChange(index, e.target.value)}
                onKeyDown={(e) => handleMfaKeyDown(index, e)}
                onPaste={handleMfaPaste}
                aria-label={`Digit ${index + 1}`}
                className="w-12 h-14 text-center text-xl font-semibold rounded-xl border outline-none transition-all duration-200 focus:ring-2 focus:ring-[#1e3a6e]/30"
                style={{
                  background: '#f8fafc',
                  color: '#1e293b',
                  borderColor: mfaError ? '#f87171' : digit ? '#1e3a6e' : '#d1dce8',
                  fontSize: '1.375rem',
                }}
              />
            ))}
          </div>

          <AnimatePresence>
            {mfaError && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="alert"
                className="text-sm text-center text-red-500"
              >
                {mfaError}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="button"
            disabled={mfaCode.length < CODE_LENGTH || mfaSubmitting}
            onClick={() => void handleMfaVerify(mfaCode)}
            className="w-full py-3.5 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#1e3a6e', fontSize: '1rem' }}
          >
            {mfaSubmitting ? 'Verifying…' : 'Verify identity'}
          </button>

          <button
            type="button"
            onClick={() => { setMfaStep(false); mfaCredentials.current = null; setMfaDigits(Array(CODE_LENGTH).fill('')); }}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Welcome to Camp Burnt Gin!"
      subtitle="Log in to continue your camper application."
      footer={
        <p>
          Need an account?{' '}
          <Link to={ROUTES.REGISTER} className="text-blue-600 font-semibold hover:underline">
            Create one now
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">

        {/* ── Email ── */}
        <div className="flex flex-col gap-2">
          <label htmlFor="login-email" className="font-semibold text-[#1e293b]" style={{ fontSize: '0.9375rem' }}>
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 pointer-events-none" style={{ width: '1.125rem', height: '1.125rem' }} />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="your.email@example.com"
              aria-invalid={errors.email ? 'true' : 'false'}
              className={inputCls(!!errors.email, 'pr-4')}
              style={{ fontSize: '0.9375rem' }}
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p role="alert" className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        {/* ── Password ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="font-semibold text-[#1e293b]" style={{ fontSize: '0.9375rem' }}>
              Password
            </label>
            <Link
              to={ROUTES.FORGOT_PASSWORD}
              className="text-slate-500 hover:text-[#1e3a6e] transition-colors"
              style={{ fontSize: '0.875rem' }}
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={{ width: '1.125rem', height: '1.125rem' }} />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              aria-invalid={errors.password ? 'true' : 'false'}
              className={inputCls(!!errors.password, 'pr-12')}
              style={{ fontSize: '0.9375rem' }}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
              style={{ transform: 'translateY(-50%)' }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff style={{ width: '1.125rem', height: '1.125rem' }} /> : <Eye style={{ width: '1.125rem', height: '1.125rem' }} />}
            </button>
          </div>
          {errors.password && (
            <p role="alert" className="text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>

        {/* ── Lockout alert ── */}
        {lockoutSeconds > 0 && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
            style={{ fontSize: '0.9375rem' }}
            role="alert"
          >
            Account temporarily locked. Please wait {lockoutSeconds} seconds before trying again.
          </div>
        )}

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={isSubmitting || lockoutSeconds > 0}
          className="w-full mt-1 py-3.5 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#1e3a6e', fontSize: '1rem' }}
        >
          {isSubmitting ? 'Signing in…' : 'Log In'}
        </button>

        {/* ── HIPAA notice ── */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <ShieldCheck className="flex-shrink-0 text-slate-400" style={{ width: '1rem', height: '1rem' }} />
          <p className="text-center text-slate-400" style={{ fontSize: '0.8125rem' }}>
            Secure Login Protected by HIPAA Standards
          </p>
        </div>

      </form>
    </AuthCard>
  );
}
