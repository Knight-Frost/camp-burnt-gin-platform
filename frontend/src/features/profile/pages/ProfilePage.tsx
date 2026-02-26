/**
 * ProfilePage.tsx
 *
 * User profile: name/email update, MFA setup/disable, pre-fill data.
 * Accessible from dashboard header dropdown for all roles.
 * Route: /profile
 */

import { useState, useEffect, type ReactNode, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { User, Mail, Shield, ShieldCheck, ShieldOff, QrCode, Key } from 'lucide-react';

import {
  getProfile, updateProfile, setupMfa, verifyMfaSetup,
  disableMfa, type MfaSetupResponse,
} from '@/features/profile/api/profile.api';
import { Button } from '@/ui/components/Button';
import { Skeletons } from '@/ui/components/Skeletons';
import { pageEntry, staggerContainer, staggerChild } from '@/shared/constants/motion';
import { useAppDispatch } from '@/store/hooks';
import { setUser } from '@/features/auth/store/authSlice';
import type { User as UserType } from '@/shared/types/user.types';

// ---------------------------------------------------------------------------
// Section card
// ---------------------------------------------------------------------------

interface ProfileSectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

function ProfileSection({ title, icon, children }: ProfileSectionProps) {
  return (
    <div
      className="rounded-xl border p-6"
      style={{
        background: 'var(--glass-medium)',
        borderColor: 'var(--border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: 'rgba(34,197,94,0.1)' }}
        >
          <span style={{ color: 'var(--ember-orange)' }}>{icon}</span>
        </div>
        <h2 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MFA section
// ---------------------------------------------------------------------------

interface MfaSectionProps {
  mfaEnabled: boolean;
  onToggle: () => void;
}

function MfaSection({ mfaEnabled, onToggle }: MfaSectionProps) {
  const { t } = useTranslation();

  const [setup, setSetup]       = useState<MfaSetupResponse | null>(null);
  const [code, setCode]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [phase, setPhase]       = useState<'idle' | 'setup' | 'verify'>('idle');

  async function handleStartSetup() {
    setLoading(true);
    try {
      const res = await setupMfa();
      setSetup(res);
      setPhase('setup');
    } catch {
      toast.error(t('profile.mfa.setup_error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      await verifyMfaSetup(code);
      toast.success(t('profile.mfa.enabled_success'));
      setPhase('idle');
      setSetup(null);
      setCode('');
      onToggle();
    } catch {
      toast.error(t('profile.mfa.verify_error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (!window.confirm(t('profile.mfa.disable_confirm'))) return;
    setLoading(true);
    try {
      await disableMfa();
      toast.success(t('profile.mfa.disabled_success'));
      onToggle();
    } catch {
      toast.error(t('common.save_error'));
    } finally {
      setLoading(false);
    }
  }

  if (mfaEnabled) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5" style={{ color: 'var(--forest-green)' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {t('profile.mfa.enabled')}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {t('profile.mfa.enabled_desc')}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          loading={loading}
          onClick={handleDisable}
          icon={<ShieldOff className="h-4 w-4" />}
          className="text-red-400 hover:text-red-300"
        >
          {t('profile.mfa.disable')}
        </Button>
      </div>
    );
  }

  if (phase === 'setup' && setup) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
            style={{ background: 'rgba(34,197,94,0.1)' }}
          >
            <span className="text-sm font-bold" style={{ color: 'var(--warm-amber)' }}>1</span>
          </div>
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
              {t('profile.mfa.step1_title')}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {t('profile.mfa.step1_desc')}
            </p>
          </div>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div
            className="p-4 rounded-xl border"
            style={{ background: '#fff', borderColor: 'var(--border)' }}
          >
              <img src={setup.qr_code} alt="MFA QR Code" className="w-36 h-36" />
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <Key className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-xs font-mono break-all" style={{ color: 'var(--muted-foreground)' }}>
            {setup.secret}
          </p>
        </div>

        <div className="flex items-start gap-4">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
            style={{ background: 'rgba(34,197,94,0.1)' }}
          >
            <span className="text-sm font-bold" style={{ color: 'var(--warm-amber)' }}>2</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              {t('profile.mfa.step2_title')}
            </p>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-32 rounded-lg px-3 py-2 text-sm border outline-none font-mono text-center tracking-widest"
                style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              />
              <Button variant="primary" size="sm" loading={loading} onClick={handleVerify} disabled={code.length !== 6}>
                {t('profile.mfa.verify')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5" style={{ color: 'var(--muted-foreground)' }} />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {t('profile.mfa.disabled')}
          </p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {t('profile.mfa.disabled_desc')}
          </p>
        </div>
      </div>
      <Button variant="secondary" size="sm" loading={loading} onClick={handleStartSetup} icon={<QrCode className="h-4 w-4" />}>
        {t('profile.mfa.enable')}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ProfilePage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const [profile, setProfile]   = useState<UserType | null>(null);
  const [loading, setLoading]   = useState(true);
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p);
        setName(p.name);
        setEmail(p.email);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProfile({ name, email });
      setProfile(updated);
      dispatch(setUser(updated));
      toast.success(t('profile.save_success'));
    } catch {
      toast.error(t('common.save_error'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl space-y-4">
        <Skeletons.Block height={32} width={200} />
        <Skeletons.Card />
        <Skeletons.Card />
      </div>
    );
  }

  return (
    <motion.div variants={pageEntry} initial="hidden" animate="visible" className="p-6 max-w-2xl">
      <div className="mb-7">
        <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('profile.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {t('profile.subtitle')}
        </p>
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-5">

        {/* Personal info */}
        <motion.div variants={staggerChild}>
          <ProfileSection title={t('profile.personal_title')} icon={<User className="h-4 w-4" />}>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  {t('profile.name_label')}
                </label>
                <div
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
                  style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
                >
                  <User className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: 'var(--foreground)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  {t('profile.email_label')}
                </label>
                <div
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
                  style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
                >
                  <Mail className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: 'var(--foreground)' }}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button type="submit" variant="primary" size="sm" loading={saving}>
                  {t('profile.save')}
                </Button>
              </div>
            </form>
          </ProfileSection>
        </motion.div>

        {/* MFA */}
        <motion.div variants={staggerChild}>
          <ProfileSection title={t('profile.mfa.title')} icon={<Shield className="h-4 w-4" />}>
            <MfaSection
              mfaEnabled={!!profile?.mfa_enabled}
              onToggle={() => setProfile((p) => p ? { ...p, mfa_enabled: !p.mfa_enabled } : p)}
            />
          </ProfileSection>
        </motion.div>

      </motion.div>
    </motion.div>
  );
}
