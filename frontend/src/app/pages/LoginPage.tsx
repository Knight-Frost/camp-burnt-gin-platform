/**
 * LoginPage.tsx
 * Login form — wired to POST /api/auth/login.
 * Handles MFA redirect, 422 field errors, 429 rate limiting, lockout.
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

import { loginSchema, type LoginFormValues } from '@/features/auth/schemas/auth.schema';
import { login } from '@/features/auth/api/auth.api';
import { setUser, setToken, setMfaRequired } from '@/features/auth/store/authSlice';
import { useAppDispatch } from '@/store/hooks';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';
import { ROUTES } from '@/shared/constants/routes';
import { isValidationError, isLockoutError, isRateLimitError } from '@/shared/types';
import { AuthCard } from '@/features/auth/components/AuthCard';

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
  const location = useLocation();
  const from     = (location.state as { from?: string })?.from ?? null;

  const [showPassword,   setShowPassword]   = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const response = await login(values);

      const topLevel = response as unknown as { mfa_required?: boolean };
      if (topLevel.mfa_required) {
        dispatch(setMfaRequired(true));
        navigate(ROUTES.MFA_VERIFY);
        return;
      }

      const { user, token, expires_in } = response.data;
      dispatch(setToken({ token, expiresIn: expires_in }));
      dispatch(setUser(user));
      toast.success(`Welcome back, ${user.name.split(' ')[0]}.`);

      const role = getPrimaryRole(user.roles ?? []);
      navigate(from ?? getDashboardRoute(role), { replace: true });

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
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff style={{ width: '1.125rem', height: '1.125rem' }} /> : <Eye style={{ width: '1.125rem', height: '1.125rem' }} />}
            </motion.button>
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
