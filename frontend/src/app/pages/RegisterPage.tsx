/**
 * RegisterPage.tsx
 * Registration form — wired to POST /api/auth/register.
 * Clean institutional design: confirm email, always-visible criteria, icons.
 */

import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { User, Mail, Lock, Eye, EyeOff, Check, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { registerSchema, type RegisterFormValues } from '@/features/auth/schemas/auth.schema';
import { register as registerUser } from '@/features/auth/api/auth.api';
import { setUser, setToken } from '@/features/auth/store/authSlice';
import { useAppDispatch } from '@/store/hooks';
import { ROUTES } from '@/shared/constants/routes';
import { isValidationError } from '@/shared/types';
import { AuthCard } from '@/features/auth/components/AuthCard';

// ─── Shared helpers ────────────────────────────────────────────────────────────

const ICON_SIZE = { width: '1.125rem', height: '1.125rem' };

function inputCls(hasError: boolean, extra = '') {
  return [
    'w-full pl-11 py-3.5 rounded-xl border outline-none bg-white',
    'transition-all focus:ring-2 focus:ring-[#1e3a6e]/20 focus:border-[#1e3a6e]',
    hasError ? 'border-red-400' : 'border-[#d1dce8]',
    'text-[#1e293b] placeholder:text-slate-400',
    extra,
  ].join(' ');
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="font-semibold text-[#1e293b]" style={{ fontSize: '0.9375rem' }}>
      {children}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p role="alert" className="text-sm text-red-500">{message}</p> : null;
}

function CriterionRow({ met, typing, label }: { met: boolean; typing: boolean; label: string }) {
  return (
    <li
      className="flex items-center gap-1.5 italic"
      style={{
        fontSize: '0.8125rem',
        color: typing ? (met ? '#16a34a' : '#9ca3af') : '#9ca3af',
      }}
    >
      {typing
        ? met
          ? <Check style={{ width: '0.75rem', height: '0.75rem', flexShrink: 0 }} className="text-green-600" />
          : <X style={{ width: '0.75rem', height: '0.75rem', flexShrink: 0, opacity: 0.5 }} />
        : <span style={{ width: '0.75rem', height: '0.75rem', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>•</span>
      }
      {label}
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [acceptTerms,  setAcceptTerms]  = useState(false);
  const [termsError,   setTermsError]   = useState(false);

  const [confirmEmail,      setConfirmEmail]      = useState('');
  const [confirmEmailError, setConfirmEmailError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const password        = watch('password')              ?? '';
  const email           = watch('email')                 ?? '';
  const confirmPassword = watch('password_confirmation') ?? '';

  const criteria = {
    length:    password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number:    /[0-9]/.test(password),
    special:   /[!@#$%^&*(),.?":{}|<>_\-=+[\]\\;'`~]/.test(password),
  };

  const confirmMatchState =
    confirmPassword.length > 0
      ? password === confirmPassword ? 'match' : 'no-match'
      : null;

  const onSubmit = async (values: RegisterFormValues) => {
    if (email !== confirmEmail) {
      setConfirmEmailError('Email addresses do not match');
      return;
    }
    setConfirmEmailError('');

    if (!acceptTerms) {
      setTermsError(true);
      return;
    }
    setTermsError(false);

    try {
      const response = await registerUser(values);
      const { user, token, expires_in } = response.data;
      dispatch(setToken({ token, expiresIn: expires_in }));
      dispatch(setUser(user));
      toast.success('Account created. Welcome to Camp Burnt Gin.');
      navigate(ROUTES.PARENT_DASHBOARD, { replace: true });
    } catch (error) {
      if (isValidationError(error)) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          setError(field as keyof RegisterFormValues, { message: messages[0] });
        });
        return;
      }
      toast.error(
        (error as { message: string }).message ?? 'Registration failed. Please try again.'
      );
    }
  };

  const isTyping = password.length > 0;

  return (
    <AuthCard
      title="Create Your Account"
      subtitle="Join our secure online system to apply and manage your camper's information."
      accentBar
      maxWidth="md"
      footer={
        <p>
          Already have an account?{' '}
          <Link to={ROUTES.LOGIN} className="text-blue-600 font-semibold hover:underline">
            Log in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">

        {/* ── Full Name ── */}
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="reg-name">Full Name</FieldLabel>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={ICON_SIZE} />
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              placeholder="Enter your full name"
              aria-invalid={errors.name ? 'true' : 'false'}
              className={inputCls(!!errors.name, 'pr-4')}
              style={{ fontSize: '0.9375rem' }}
              {...register('name')}
            />
          </div>
          <FieldError message={errors.name?.message} />
        </div>

        {/* ── Email Address ── */}
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="reg-email">Email Address</FieldLabel>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={ICON_SIZE} />
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="your.email@example.com"
              aria-invalid={errors.email ? 'true' : 'false'}
              className={inputCls(!!errors.email, 'pr-4')}
              style={{ fontSize: '0.9375rem' }}
              {...register('email')}
            />
          </div>
          <FieldError message={errors.email?.message} />
        </div>

        {/* ── Confirm Email ── */}
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="reg-email-confirm">Confirm Email Address</FieldLabel>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={ICON_SIZE} />
            <input
              id="reg-email-confirm"
              type="email"
              autoComplete="email"
              placeholder="Confirm your email"
              value={confirmEmail}
              onChange={(e) => {
                setConfirmEmail(e.target.value);
                if (confirmEmailError) setConfirmEmailError('');
              }}
              className={inputCls(!!confirmEmailError, 'pr-4')}
              style={{ fontSize: '0.9375rem' }}
            />
          </div>
          <FieldError message={confirmEmailError} />
        </div>

        {/* ── Password ── */}
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="reg-password">Password</FieldLabel>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={ICON_SIZE} />
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Create a secure password"
              aria-invalid={errors.password ? 'true' : 'false'}
              className={inputCls(!!errors.password, 'pr-12')}
              style={{ fontSize: '0.9375rem' }}
              {...register('password')}
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword
                ? <EyeOff style={ICON_SIZE} />
                : <Eye style={ICON_SIZE} />
              }
            </motion.button>
          </div>

          {/* Criteria — always visible */}
          <ul className="flex flex-col gap-1 mt-0.5 pl-0.5">
            <CriterionRow met={criteria.length}    typing={isTyping} label="Must be 8–16 characters" />
            <CriterionRow met={criteria.uppercase} typing={isTyping} label="Must include 1 uppercase letter (A–Z)" />
            <CriterionRow met={criteria.lowercase} typing={isTyping} label="Must include 1 lowercase letter (a–z)" />
            <CriterionRow met={criteria.number}    typing={isTyping} label="Must include 1 number (0–9)" />
            <CriterionRow met={criteria.special}   typing={isTyping} label="Must include 1 special character (@, #, $, %, !, ?)" />
          </ul>
          <FieldError message={errors.password?.message} />
        </div>

        {/* ── Confirm Password ── */}
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="reg-confirm">Confirm Password</FieldLabel>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={ICON_SIZE} />
            <input
              id="reg-confirm"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              aria-invalid={errors.password_confirmation ? 'true' : 'false'}
              className={inputCls(
                !!errors.password_confirmation || confirmMatchState === 'no-match',
                'pr-12'
              )}
              style={{ fontSize: '0.9375rem' }}
              {...register('password_confirmation')}
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff style={ICON_SIZE} /> : <Eye style={ICON_SIZE} />}
            </motion.button>
          </div>

          <AnimatePresence mode="wait">
            {confirmMatchState && (
              <motion.p
                key={confirmMatchState}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1.5 text-sm"
                style={{ color: confirmMatchState === 'match' ? 'var(--forest-green)' : 'var(--destructive)' }}
              >
                {confirmMatchState === 'match'
                  ? <><Check style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} /> Passwords match</>
                  : <><X style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} /> Passwords do not match</>
                }
              </motion.p>
            )}
          </AnimatePresence>
          <FieldError message={errors.password_confirmation?.message} />
        </div>

        {/* ── Terms ── */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                if (e.target.checked) setTermsError(false);
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded cursor-pointer"
            />
            <span className="leading-relaxed text-[#374151]" style={{ fontSize: '0.9375rem' }}>
              I agree to the{' '}
              <span className="text-blue-600 font-medium hover:underline cursor-pointer">Terms of Use</span>
              {' '}and{' '}
              <span className="text-blue-600 font-medium hover:underline cursor-pointer">Privacy Policy</span>.
            </span>
          </label>
          {termsError && (
            <p role="alert" className="text-sm pl-7 text-red-500">
              You must agree to continue.
            </p>
          )}
        </div>

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-1 py-3.5 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#1e3a6e', fontSize: '1rem' }}
        >
          {isSubmitting ? 'Creating account…' : 'Create Account'}
        </button>

        {/* ── HIPAA notice ── */}
        <div className="flex items-start justify-center gap-2 pt-0.5">
          <ShieldCheck className="flex-shrink-0 mt-0.5 text-slate-400" style={{ width: '1rem', height: '1rem' }} />
          <p className="text-center text-slate-400" style={{ fontSize: '0.8125rem' }}>
            Your account is protected under HIPAA and SC DPH data privacy standards.
          </p>
        </div>

        {/* ── Copyright ── */}
        <p className="text-center text-slate-400" style={{ fontSize: '0.75rem' }}>
          © {new Date().getFullYear()} Camp Burnt Gin – South Carolina Department of Health
        </p>

      </form>
    </AuthCard>
  );
}
