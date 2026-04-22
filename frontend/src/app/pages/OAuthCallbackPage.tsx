/**
 * OAuthCallbackPage.tsx
 *
 * Handles the redirect back from the Google OAuth flow.
 *
 * This page sits at /auth/callback and reads the query parameters that the
 * backend placed there after processing the OAuth callback:
 *
 *   ?code=<otc>              → Normal login/register. Exchange the OTC for a token.
 *   ?link_required=1         → Email collision. Show a link-account dialog.
 *     &link_token=<tok>
 *     &masked_email=<e>
 *   ?error=<message>         → Something went wrong. Show the error.
 *
 * After a successful exchange the user is navigated to their role dashboard
 * exactly the same way as the standard login flow.
 */

import { useEffect, useRef, useState, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Lock, ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';

import {
  exchangeSocialCode,
  confirmSocialLink,
  mfaVerifySocial,
  type SocialAuthSuccessData,
  type SocialExchangeResponse,
} from '@/features/auth/api/social.api';
import { normalizeUser } from '@/features/auth/api/auth.api';
import { setUser, setToken, hydrateAuth } from '@/features/auth/store/authSlice';
import { useAppDispatch } from '@/store/hooks';
import { ROUTES } from '@/shared/constants/routes';
import { getPrimaryRole, getDashboardRoute } from '@/shared/constants/roles';
import type { User } from '@/shared/types';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { GoogleSignInButton } from '@/features/auth/components/GoogleSignInButton';

const CODE_LENGTH = 6;

/**
 * Module-level cache of in-flight (and completed) OTC exchange promises.
 *
 * The OTC issued by /auth/google/callback is single-use and burns on first
 * read by /auth/social/exchange. React 18 StrictMode dev mounts every
 * component twice, which — without coordination — would either fire the
 * exchange POST twice (the second 422s on a burned OTC and paints an
 * error card on top of the success) or fire it only on the first mount
 * (whose React fiber is destroyed before the response arrives, leaving
 * the live second-mount instance stuck on the loading spinner).
 *
 * The fix is to share the same Promise across both mounts:
 *
 *   - First mount calls into here, no entry exists, so it kicks off the
 *     network request and stores the Promise.
 *   - Second mount calls into here, finds the cached Promise, awaits the
 *     same one. Its setState calls (on the live fiber) actually paint.
 *   - The dead first-mount instance also awaits and tries to setState —
 *     React 18 silently noops setState on dead fibers, which is fine.
 *
 * useRef is reset across the synthetic unmount/remount, which is why this
 * lives at module scope. Entries are tiny (string → Promise) and a session
 * accumulates at most a handful, so no eviction needed.
 */
const exchangeInFlight = new Map<string, Promise<SocialExchangeResponse>>();

type Phase =
  | 'loading'           // Exchanging the OTC or loading query params
  | 'link_confirm'      // Showing the link-account password dialog
  | 'mfa'               // Showing the TOTP input
  | 'error';            // Unrecoverable error

export function OAuthCallbackPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  // Link-confirm state
  const linkToken = searchParams.get('link_token') ?? '';
  const maskedEmail = searchParams.get('masked_email') ?? '';
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');

  // MFA state — mfa_pending_token held in a ref (never exposed to Redux/storage)
  const mfaPendingToken = useRef<string | null>(null);
  const mfaAction = useRef<'login' | 'register'>('login');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [mfaDigits, setMfaDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);

  // Run once on mount — process query params
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setErrorMessage(error);
      setPhase('error');
      return;
    }

    const linkRequired = searchParams.get('link_required');
    if (linkRequired === '1' && linkToken) {
      setPhase('link_confirm');
      return;
    }

    const code = searchParams.get('code');
    if (code) {
      // StrictMode-safe: the first mount kicks off the network call and
      // caches the Promise; the second mount finds the cached Promise and
      // awaits the same one. See exchangeInFlight above.
      let promise = exchangeInFlight.get(code);
      if (!promise) {
        promise = exchangeSocialCode(code);
        exchangeInFlight.set(code, promise);
      }
      void exchangeCode(promise);
      return;
    }

    setErrorMessage('Invalid authentication response. Please try again.');
    setPhase('error');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function exchangeCode(promise: Promise<SocialExchangeResponse>) {
    try {
      const result = await promise;

      if (result.mfa_required && result.mfa_pending_token) {
        mfaPendingToken.current = result.mfa_pending_token;
        setPhase('mfa');
        setTimeout(() => inputRefs.current[0]?.focus(), 120);
        return;
      }

      if (result.data) {
        await finalizeAuth(result.data);
      } else {
        throw new Error('Unexpected response from server.');
      }
    } catch (err) {
      const msg = (err as { message?: string })?.message
        ?? 'Authentication failed. Please try again.';
      setErrorMessage(msg);
      setPhase('error');
    }
  }

  async function finalizeAuth(data: SocialAuthSuccessData) {
    // The social-auth endpoint returns a user with the role relation as a
    // single `role` object (not the `roles[]` array the SPA's RBAC layer
    // expects). normalizeUser is the same helper LoginPage uses so both
    // login paths put the same shape into Redux.
    const user = normalizeUser(data.user as User);

    sessionStorage.setItem('auth_token', data.token);
    dispatch(setToken({ token: data.token }));
    dispatch(setUser(user));
    dispatch(hydrateAuth());

    if (!user.email_verified_at) {
      navigate('/verify-email?pending=true', { replace: true });
      return;
    }

    const toastMsg = data.action === 'register'
      ? `Welcome to Camp Burnt Gin, ${user.name.split(' ')[0]}!`
      : data.just_linked
        ? `Google account linked. Welcome back, ${user.name.split(' ')[0]}.`
        : `Welcome back, ${user.name.split(' ')[0]}.`;

    toast.success(toastMsg);

    const role = getPrimaryRole(user.roles ?? []);
    if (role) navigate(getDashboardRoute(role), { replace: true });
  }

  // ── Link confirm ───────────────────────────────────────────────────────────

  const handleLinkConfirm = async () => {
    if (!password || linkLoading) return;
    setLinkLoading(true);
    setLinkError('');

    try {
      const result = await confirmSocialLink(linkToken, password);

      if (result.mfa_required && result.mfa_pending_token) {
        mfaPendingToken.current = result.mfa_pending_token;
        mfaAction.current = 'login';
        setPhase('mfa');
        setTimeout(() => inputRefs.current[0]?.focus(), 120);
        return;
      }

      if (result.data) {
        await finalizeAuth(result.data);
      }
    } catch (err) {
      setLinkError(
        (err as { message?: string })?.message ?? 'Incorrect password. Please try again.'
      );
    } finally {
      setLinkLoading(false);
    }
  };

  // ── MFA input handlers ─────────────────────────────────────────────────────

  const handleMfaChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    setMfaError(null);
    const updated = [...mfaDigits];
    updated[index] = value;
    setMfaDigits(updated);
    if (value && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    if (updated.every(d => d !== '') && value) void handleMfaVerify(updated.join(''));
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
    if (!mfaPendingToken.current) return;
    setMfaLoading(true);
    setMfaError(null);

    try {
      const result = await mfaVerifySocial(mfaPendingToken.current, code);
      mfaPendingToken.current = null;

      if (result.data) {
        await finalizeAuth(result.data);
      }
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Invalid code. Please try again.';
      setMfaError(msg);
      setMfaDigits(Array(CODE_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 60);
    } finally {
      setMfaLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <AuthCard title="Signing In…" subtitle="Please wait while we verify your identity.">
        <div className="flex flex-col items-center gap-6 py-4">
          <div
            className="w-14 h-14 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: 'rgba(155,95,38,0.3)', borderTopColor: '#9b5f26' }}
            aria-label="Loading"
          />
          <p className="text-sm" style={{ color: 'rgba(232,188,112,0.70)' }}>
            Completing sign-in with Google…
          </p>
        </div>
      </AuthCard>
    );
  }

  if (phase === 'error') {
    return (
      <AuthCard
        title="Sign-In Failed"
        footer={
          <button
            onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
            className="flex items-center justify-center gap-1.5 text-sm font-semibold hover:underline"
            style={{ color: 'rgba(232,188,112,0.85)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </button>
        }
      >
        <div className="flex flex-col items-center gap-4 py-2">
          <div
            className="flex items-center justify-center w-14 h-14 rounded-2xl"
            style={{ background: 'rgba(220,38,38,0.12)' }}
          >
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="text-center text-sm" style={{ color: 'rgba(232,188,112,0.80)' }}>
            {errorMessage}
          </p>
        </div>
      </AuthCard>
    );
  }

  if (phase === 'link_confirm') {
    // "Expired" message means the backend's cached link-pending entry is gone.
    // At that point no password attempt can succeed — surface a restart CTA
    // instead of leaving the user re-submitting against a dead token.
    const linkSessionExpired = linkError.toLowerCase().includes('expired');

    return (
      <AuthCard
        title="Link Account"
        subtitle={
          linkSessionExpired ? (
            <>Your linking session has expired for security. Please sign in with Google again to continue.</>
          ) : (
            <>
              We found an existing account for{' '}
              <span style={{ color: '#e8bd58', fontWeight: 600 }}>{maskedEmail}</span>.
              Enter your password to link your Google account.
            </>
          )
        }
        footer={
          <button
            onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
            className="flex items-center justify-center gap-1.5 text-sm hover:underline"
            style={{ color: 'rgba(232,188,112,0.70)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Cancel and go back
          </button>
        }
      >
        {linkSessionExpired ? (
          <div className="flex flex-col gap-5">
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm"
              style={{ background: 'rgba(10,3,0,0.72)', color: '#fca5a5' }}
            >
              <AlertCircle style={{ width: '1.125rem', height: '1.125rem', flexShrink: 0, marginTop: '0.125rem' }} />
              <span>
                This link session has expired. Please try signing in with Google again.
              </span>
            </div>
            <GoogleSignInButton label="Sign in with Google again" />
            <p className="text-center text-xs" style={{ color: 'rgba(232,188,112,0.55)' }}>
              You&apos;ll be brought right back here to finish linking your account.
            </p>
          </div>
        ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="link-password"
              className="font-semibold"
              style={{ fontSize: '0.9375rem', color: 'rgba(232,188,112,0.90)' }}
            >
              Current password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                style={{ width: '1.125rem', height: '1.125rem' }}
              />
              <input
                id="link-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={e => { setPassword(e.target.value); setLinkError(''); }}
                onKeyDown={e => e.key === 'Enter' && void handleLinkConfirm()}
                className="w-full pl-11 pr-12 py-3.5 rounded-xl border outline-none transition-all"
                style={{
                  background: 'rgba(255,249,228,0.94)',
                  borderColor: linkError ? '#f87171' : 'rgba(155,95,38,0.55)',
                  fontSize: '0.9375rem',
                  color: '#2c1608',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                style={{ transform: 'translateY(-50%)' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            {linkError && (
              <p role="alert" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium" style={{ background: 'rgba(10,3,0,0.72)', color: '#fca5a5' }}>
                <AlertCircle style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} />
                {linkError}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={!password || linkLoading}
            onClick={() => void handleLinkConfirm()}
            className="w-full py-3.5 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#166534', fontSize: '1rem' }}
          >
            {linkLoading ? 'Verifying…' : 'Link Google Account'}
          </button>

          <p className="text-center text-xs" style={{ color: 'rgba(232,188,112,0.55)' }}>
            This will allow you to sign in with either your password or Google.
          </p>
        </div>
        )}
      </AuthCard>
    );
  }

  // MFA phase
  const mfaCode = mfaDigits.join('');
  return (
    <AuthCard
      title="Two-Factor Verification"
      subtitle="Enter the 6-digit code from your authenticator app."
    >
      <div className="flex flex-col items-center gap-8">
        <div
          className="flex items-center justify-center w-16 h-16 rounded-2xl"
          style={{ background: 'rgba(22,101,52,0.08)' }}
        >
          <ShieldCheck className="h-8 w-8" style={{ color: '#166534' }} />
        </div>

        <div className="flex gap-3" role="group" aria-label="MFA code">
          {mfaDigits.map((digit, index) => (
            <input
              key={index}
              ref={el => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleMfaChange(index, e.target.value)}
              onKeyDown={e => handleMfaKeyDown(index, e)}
              onPaste={handleMfaPaste}
              aria-label={`Digit ${index + 1}`}
              className="w-12 h-14 text-center text-xl font-semibold rounded-xl border outline-none transition-all duration-200 focus:ring-2 focus:ring-[#166534]/30"
              style={{
                background: 'rgba(255,249,228,0.94)',
                color: '#2c1608',
                borderColor: mfaError ? '#f87171' : digit ? '#166534' : 'rgba(155,95,38,0.55)',
                fontSize: '1.375rem',
                boxShadow: 'inset 0 1px 4px rgba(65,32,7,0.18)',
              }}
            />
          ))}
        </div>

        {mfaError && (
          <p role="alert" className="flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium" style={{ background: 'rgba(10,3,0,0.72)', color: '#fca5a5' }}>
            <AlertCircle style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} />
            {mfaError}
          </p>
        )}

        <button
          type="button"
          disabled={mfaCode.length < CODE_LENGTH || mfaLoading}
          onClick={() => void handleMfaVerify(mfaCode)}
          className="w-full py-3.5 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#1e3a6e', fontSize: '1rem' }}
        >
          {mfaLoading ? 'Verifying…' : 'Verify Code'}
        </button>

        <button
          type="button"
          onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sign In
        </button>
      </div>
    </AuthCard>
  );
}
