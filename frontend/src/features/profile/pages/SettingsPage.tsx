/**
 * SettingsPage.tsx
 * User settings — Appearance, Account, Security, Notifications.
 * Available to all roles via /[role]/settings.
 */

import { useState, useEffect, type ReactNode, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Sun, Type, Contrast, Activity, Shield, Bell, User, Eye, EyeOff } from 'lucide-react';
import {
  applyFontScale,
  applyHighContrast,
  applyReducedMotion,
  getSavedFontScale,
  getSavedHighContrast,
  getSavedReducedMotion,
  type FontScale,
} from '@/theme/themePreferences';
import {
  getNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreferences,
} from '@/features/admin/api/notifications.api';
import { getProfileRoute, getPrimaryRole } from '@/shared/constants/roles';
import { useAppSelector } from '@/store/hooks';
import { Button } from '@/ui/components/Button';
import { FormField } from '@/ui/components/FormField';
import { scrollRevealVariants } from '@/shared/constants/motion';
import axiosInstance from '@/api/axios.config';

// ─── Types & schemas ──────────────────────────────────────────────────────────

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  password: z.string().min(8, 'Must be at least 8 characters'),
  password_confirmation: z.string(),
}).refine((d) => d.password === d.password_confirmation, {
  message: 'Passwords do not match',
  path: ['password_confirmation'],
});
type PasswordFormValues = z.infer<typeof passwordSchema>;

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'appearance' | 'account' | 'security' | 'notifications';

const TABS: { id: Tab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'appearance',    label: 'Appearance',    icon: Sun },
  { id: 'account',       label: 'Account',       icon: User },
  { id: 'security',      label: 'Security',      icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

const FONT_SCALES: { id: FontScale; label: string; size: string }[] = [
  { id: 'small',   label: 'Small',      size: '14px' },
  { id: 'default', label: 'Default',    size: '16px' },
  { id: 'large',   label: 'Large',      size: '18px' },
  { id: 'xlarge',  label: 'Extra Large',size: '20px' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const DEFAULT_NOTIF_PREFS: NotificationPreferences = {
  application_updates: true,
  announcements: true,
  messages: true,
  deadlines: true,
};

export function SettingsPage() {
  const user = useAppSelector((state) => state.auth.user);
  const [activeTab, setActiveTab] = useState<Tab>('appearance');
  const [fontScale, setFontScaleState] = useState<FontScale>(getSavedFontScale);
  const [highContrast, setHighContrastState] = useState(getSavedHighContrast);
  const [reducedMotion, setReducedMotionState] = useState(getSavedReducedMotion);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIF_PREFS);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [savingNotif, setSavingNotif] = useState<keyof NotificationPreferences | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) });

  const handleFontScale = (scale: FontScale) => {
    setFontScaleState(scale);
    applyFontScale(scale);
    toast.success(`Font size set to ${scale}.`);
  };

  const handleHighContrast = (val: boolean) => {
    setHighContrastState(val);
    applyHighContrast(val);
    toast.success(val ? 'High contrast enabled.' : 'High contrast disabled.');
  };

  const handleReducedMotion = (val: boolean) => {
    setReducedMotionState(val);
    applyReducedMotion(val);
    toast.success(val ? 'Reduced motion enabled.' : 'Animations enabled.');
  };

  // Load notification preferences once when the tab is first opened
  useEffect(() => {
    if (activeTab === 'notifications' && !notifLoaded) {
      getNotificationPreferences()
        .then((prefs) => {
          setNotifPrefs(prefs);
          setNotifLoaded(true);
        })
        .catch(() => {
          setNotifLoaded(true); // use defaults on failure
        });
    }
  }, [activeTab, notifLoaded]);

  const handleNotifToggle = async (key: keyof NotificationPreferences, value: boolean) => {
    setSavingNotif(key);
    const prev = notifPrefs;
    setNotifPrefs({ ...notifPrefs, [key]: value }); // optimistic update
    try {
      const updated = await updateNotificationPreference(key, value);
      setNotifPrefs(updated);
    } catch {
      setNotifPrefs(prev); // revert on error
      toast.error('Failed to save notification preference.');
    } finally {
      setSavingNotif(null);
    }
  };

  const onPasswordSubmit = async (values: PasswordFormValues) => {
    setSavingPw(true);
    try {
      await axiosInstance.put('/profile/password', values);
      toast.success('Password updated successfully.');
      reset();
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? 'Failed to update password.');
    } finally {
      setSavingPw(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <motion.div
      variants={scrollRevealVariants}
      initial="hidden"
      animate="visible"
      className="max-w-3xl"
    >
      <div className="mb-8">
        <h2
          className="font-headline font-semibold text-2xl mb-1"
          style={{ color: 'var(--foreground)' }}
        >
          Settings
        </h2>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '1rem' }}>
          Manage your preferences, appearance, and security settings.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Tab list */}
        <nav className="flex sm:flex-col gap-1 sm:w-44 flex-shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                style={{
                  background: isActive ? 'var(--dash-nav-active-bg)' : 'transparent',
                  color: isActive ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                  borderLeft: isActive ? '2px solid var(--ember-orange)' : '2px solid transparent',
                }}
                aria-selected={isActive}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          {/* ── APPEARANCE ──────────────────────────────────────────────── */}
          {activeTab === 'appearance' && (
            <div className="flex flex-col gap-6">

              {/* Font scaling */}
              <SettingsCard
                icon={Type}
                title="Font Size"
                description="Adjust text size for better readability."
              >
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {FONT_SCALES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleFontScale(s.id)}
                      className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-medium transition-all"
                      style={{
                        background: fontScale === s.id ? 'var(--dash-nav-active-bg)' : 'transparent',
                        borderColor: fontScale === s.id ? 'var(--ember-orange)' : 'var(--border)',
                        color: fontScale === s.id ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                      }}
                    >
                      <span style={{ fontSize: s.size, lineHeight: 1 }}>Aa</span>
                      <span className="text-xs">{s.label}</span>
                    </button>
                  ))}
                </div>
              </SettingsCard>

              {/* High contrast */}
              <SettingsCard
                icon={Contrast}
                title="High Contrast"
                description="Increase contrast for better visibility."
              >
                <ToggleSwitch
                  checked={highContrast}
                  onChange={handleHighContrast}
                  label="Enable high contrast mode"
                />
              </SettingsCard>

              {/* Reduced motion */}
              <SettingsCard
                icon={Activity}
                title="Reduced Motion"
                description="Minimize animations and transitions."
              >
                <ToggleSwitch
                  checked={reducedMotion}
                  onChange={handleReducedMotion}
                  label="Reduce motion and animations"
                />
              </SettingsCard>
            </div>
          )}

          {/* ── ACCOUNT ─────────────────────────────────────────────────── */}
          {activeTab === 'account' && (
            <div className="flex flex-col gap-6">
              <div
                className="rounded-2xl border p-6"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                  Account Information
                </h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Name</p>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>{user?.name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Email</p>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>{user?.email ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Role</p>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                      {user?.roles?.map((r) => r.name).join(', ') ?? '—'}
                    </p>
                  </div>
                </div>
                <p className="text-xs mt-4" style={{ color: 'var(--muted-foreground)' }}>
                  To update your name or email, go to{' '}
                  <Link
                    to={getProfileRoute(getPrimaryRole(user?.roles ?? []))}
                    className="hover:underline"
                    style={{ color: 'var(--ember-orange)' }}
                  >
                    Profile
                  </Link>.
                </p>
              </div>
            </div>
          )}

          {/* ── SECURITY ────────────────────────────────────────────────── */}
          {activeTab === 'security' && (
            <div className="flex flex-col gap-6">
              <div
                className="rounded-2xl border p-6"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                  Change Password
                </h3>
                <form onSubmit={handleSubmit(onPasswordSubmit)} className="flex flex-col gap-4">
                  {/* Current password */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="settings-current-password" className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        id="settings-current-password"
                        type={showCurrent ? 'text' : 'password'}
                        className="w-full rounded-lg px-4 py-3 pr-10 text-sm border outline-none transition-all focus:ring-2 focus:ring-ember-orange/30"
                        style={{
                          background: 'var(--input)',
                          color: 'var(--foreground)',
                          borderColor: errors.current_password ? 'var(--destructive)' : 'var(--border)',
                        }}
                        {...register('current_password')}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--muted-foreground)' }}
                        onClick={() => setShowCurrent(v => !v)}
                      >
                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.current_password && (
                      <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                        {errors.current_password.message}
                      </p>
                    )}
                  </div>

                  {/* New password */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="settings-new-password" className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="settings-new-password"
                        type={showNew ? 'text' : 'password'}
                        className="w-full rounded-lg px-4 py-3 pr-10 text-sm border outline-none transition-all focus:ring-2 focus:ring-ember-orange/30"
                        style={{
                          background: 'var(--input)',
                          color: 'var(--foreground)',
                          borderColor: errors.password ? 'var(--destructive)' : 'var(--border)',
                        }}
                        {...register('password')}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--muted-foreground)' }}
                        onClick={() => setShowNew(v => !v)}
                      >
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  {/* Confirm new password */}
                  <FormField
                    label="Confirm New Password"
                    type="password"
                    error={errors.password_confirmation?.message}
                    {...register('password_confirmation')}
                  />

                  <Button type="submit" variant="primary" loading={savingPw} className="self-start mt-2">
                    Update Password
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS ────────────────────────────────────────────── */}
          {activeTab === 'notifications' && (
            <div
              className="rounded-2xl border p-6"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                Email Notifications
              </h3>
              <div className="flex flex-col gap-4">
                {(
                  [
                    { key: 'application_updates' as keyof NotificationPreferences, label: 'Application status updates' },
                    { key: 'announcements'        as keyof NotificationPreferences, label: 'New announcements' },
                    { key: 'messages'             as keyof NotificationPreferences, label: 'New messages in inbox' },
                    { key: 'deadlines'            as keyof NotificationPreferences, label: 'Upcoming deadline reminders' },
                  ]
                ).map((pref) => (
                  <div
                    key={pref.key}
                    className="flex items-center justify-between py-3 border-b last:border-b-0"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <span className="text-sm" style={{ color: 'var(--foreground)' }}>{pref.label}</span>
                    <ToggleSwitch
                      checked={notifPrefs[pref.key]}
                      onChange={(val) => handleNotifToggle(pref.key, val)}
                      label={pref.label}
                      hideLabel
                      disabled={savingNotif === pref.key}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs mt-4" style={{ color: 'var(--muted-foreground)' }}>
                Preferences are saved to your account and applied across all devices.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start gap-3 mb-1">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(22,163,74,0.10)', color: 'var(--ember-orange)' }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  hideLabel = false,
  disabled = false,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  hideLabel?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-3 mt-3 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      {!hideLabel && (
        <span className="text-sm" style={{ color: 'var(--foreground)' }}>{label}</span>
      )}
      <div className="relative flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
          aria-label={label}
          disabled={disabled}
        />
        <div
          role="presentation"
          className="w-10 h-6 rounded-full transition-colors duration-300"
          style={{
            background: checked ? 'var(--ember-orange)' : 'var(--border)',
          }}
        />
        <div
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300"
          style={{ transform: `translateX(${checked ? '18px' : '2px'})` }}
        />
      </div>
    </label>
  );
}
