/**
 * LinkedAccountsSection.tsx
 *
 * Displays and manages the OAuth providers linked to a user's account.
 * Shown in the Profile / Security section.
 *
 * Capabilities:
 *  - Show which providers are currently linked
 *  - Link Google (redirects through the normal OAuth flow)
 *  - Unlink Google (with lockout-prevention guard)
 *  - Show set-password prompt for social-only users
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Link2, Link2Off, KeyRound, AlertCircle, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { getSocialAuthUrl, unlinkSocialAccount, setPassword } from '@/features/auth/api/social.api';
import type { LinkedSocialAccount } from '@/shared/types/user.types';

interface Props {
  hasPassword: boolean;
  socialProviders: LinkedSocialAccount[];
  onUpdate: (update: { has_password?: boolean; social_providers?: LinkedSocialAccount[] }) => void;
}

export function LinkedAccountsSection({ hasPassword, socialProviders, onUpdate }: Props) {
  const isGoogleLinked = socialProviders.some(p => p.provider === 'google');
  const googleAccount = socialProviders.find(p => p.provider === 'google');

  const [linkLoading, setLinkLoading] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);

  // Set-password form state (for social-only accounts)
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [setPasswordLoading, setSetPasswordLoading] = useState(false);
  const [setPasswordError, setSetPasswordError] = useState('');

  const handleLinkGoogle = async () => {
    setLinkLoading(true);
    try {
      const url = await getSocialAuthUrl('google');
      window.location.href = url;
    } catch {
      toast.error('Could not connect to Google. Please try again.');
      setLinkLoading(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (unlinkLoading) return;
    setUnlinkLoading(true);
    try {
      await unlinkSocialAccount('google');
      toast.success('Google account unlinked.');
      onUpdate({ social_providers: socialProviders.filter(p => p.provider !== 'google') });
    } catch (err) {
      const e = err as { message?: string; requires_password?: boolean };
      if (e.requires_password) {
        toast.error('Set a password first before unlinking Google to avoid being locked out.');
        setShowSetPassword(true);
      } else {
        toast.error(e.message ?? 'Failed to unlink Google account.');
      }
    } finally {
      setUnlinkLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      setSetPasswordError('Passwords do not match.');
      return;
    }
    setSetPasswordLoading(true);
    setSetPasswordError('');
    try {
      await setPassword(newPassword, confirmPassword);
      toast.success('Password set successfully. You can now sign in with email and password.');
      onUpdate({ has_password: true });
      setShowSetPassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const e = err as { message?: string; errors?: Record<string, string[]> };
      const msg = e.errors?.password?.[0] ?? e.message ?? 'Failed to set password.';
      setSetPasswordError(msg);
    } finally {
      setSetPasswordLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── No-password banner ── */}
      {!hasPassword && (
        <div
          className="flex items-start gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: 'rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.08)' }}
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: '#fbbf24' }} />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>
              Social-only account
            </p>
            <p className="text-xs" style={{ color: 'rgba(251,191,36,0.80)' }}>
              You signed up with Google and have no password set. Set a password to enable email login
              and to be able to disable MFA or unlink Google in the future.
            </p>
            <button
              type="button"
              onClick={() => setShowSetPassword(v => !v)}
              className="mt-1 self-start text-xs font-semibold underline"
              style={{ color: '#fbbf24' }}
            >
              {showSetPassword ? 'Cancel' : 'Set a password'}
            </button>
          </div>
        </div>
      )}

      {/* ── Set-password form ── */}
      {showSetPassword && (
        <form onSubmit={e => void handleSetPassword(e)} className="flex flex-col gap-3 rounded-xl border px-4 py-4" style={{ borderColor: 'rgba(155,95,38,0.35)', background: 'rgba(0,0,0,0.08)' }}>
          <p className="text-sm font-semibold" style={{ color: '#e8bd58' }}>
            <KeyRound className="inline h-4 w-4 mr-1.5" />
            Set a password
          </p>

          {/* New password */}
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="New password (12+ chars)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-lg border outline-none text-sm"
              style={{ background: 'rgba(255,249,228,0.94)', borderColor: 'rgba(155,95,38,0.45)', color: '#2c1608' }}
              required
            />
            <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Confirm password */}
          <div className="relative">
            <input
              type={showConfirmPw ? 'text' : 'password'}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-lg border outline-none text-sm"
              style={{ background: 'rgba(255,249,228,0.94)', borderColor: 'rgba(155,95,38,0.45)', color: '#2c1608' }}
              required
            />
            <button type="button" onClick={() => setShowConfirmPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {setPasswordError && (
            <p className="flex items-center gap-1.5 text-xs" style={{ color: '#fca5a5' }}>
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {setPasswordError}
            </p>
          )}

          <button
            type="submit"
            disabled={setPasswordLoading || !newPassword || !confirmPassword}
            className="w-full py-2 rounded-lg font-semibold text-sm text-white disabled:opacity-50"
            style={{ background: '#166534' }}
          >
            {setPasswordLoading ? 'Setting password…' : 'Set Password'}
          </button>
        </form>
      )}

      {/* ── Google link status ── */}
      <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5" style={{ borderColor: 'rgba(155,95,38,0.30)', background: 'rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3">
          {/* Google G logo */}
          <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'rgba(232,188,112,0.95)' }}>Google</p>
            {isGoogleLinked && googleAccount?.provider_email ? (
              <p className="text-xs" style={{ color: 'rgba(232,188,112,0.55)' }}>
                {googleAccount.provider_email}
              </p>
            ) : (
              <p className="text-xs" style={{ color: 'rgba(232,188,112,0.45)' }}>Not connected</p>
            )}
          </div>
        </div>

        {isGoogleLinked ? (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#4ade80' }} />
            <button
              type="button"
              onClick={() => void handleUnlinkGoogle()}
              disabled={unlinkLoading}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: 'rgba(220,38,38,0.14)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.28)' }}
            >
              <Link2Off className="h-3.5 w-3.5" />
              {unlinkLoading ? 'Unlinking…' : 'Unlink'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void handleLinkGoogle()}
            disabled={linkLoading}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: 'rgba(66,133,244,0.14)', color: '#93c5fd', border: '1px solid rgba(66,133,244,0.28)' }}
          >
            <Link2 className="h-3.5 w-3.5" />
            {linkLoading ? 'Connecting…' : 'Connect'}
          </button>
        )}
      </div>

      <p className="text-xs" style={{ color: 'rgba(232,188,112,0.45)' }}>
        Connected providers let you sign in without entering a password.
      </p>
    </div>
  );
}
