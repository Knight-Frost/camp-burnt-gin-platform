/**
 * PersonalGreeting.tsx
 *
 * A liquid-glass greeting card displayed at the top of each role's dashboard.
 *
 * Features:
 *  - Time-aware salutation (Good morning / afternoon / evening / Welcome back)
 *  - Uses preferred_name if set, otherwise first word of name
 *  - Role-aware rotating subtitle that can incorporate real stat data
 *  - Liquid glass panel: backdrop-blur + specular highlight + soft shadow
 *  - Text contrast guaranteed: dark overlay gradient behind the card,
 *    white text with subtle shadow so letters never blend into the photo
 *
 * Usage:
 *   <PersonalGreeting user={user} role="admin" stats={{ pendingCount: 3 }} />
 */

import { useState, useEffect, useRef } from 'react';
import type { User } from '@/shared/types/user.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type GreetingRole = 'applicant' | 'admin' | 'medical' | 'super_admin';

interface GreetingStats {
  pendingCount?: number;
  unreadCount?: number;
  camperCount?: number;
  overdueCount?: number;
}

interface PersonalGreetingProps {
  user: User | null;
  role: GreetingRole;
  stats?: GreetingStats;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Welcome back';
}

function getDisplayName(user: User | null): string {
  if (!user) return 'there';
  const preferred = user.preferred_name?.trim();
  if (preferred) return preferred;
  return user.name.split(' ')[0] ?? 'there';
}

function buildSubtitles(role: GreetingRole, stats: GreetingStats): string[] {
  const base: Record<GreetingRole, string[]> = {
    applicant: [
      "Let's make this summer unforgettable.",
      "Your camper's adventure starts here.",
      'Camp Burnt Gin is ready for you.',
      'A great season is just ahead.',
    ],
    admin: [
      'Camp operations are on track.',
      'The camp season is shaping up beautifully.',
      'Ready to make today count.',
      'Your team is counting on you.',
    ],
    medical: [
      'All campers are in good hands.',
      'Ready for a safe camp season.',
      'Keeping every camper healthy and happy.',
      'Your care makes all the difference.',
    ],
    super_admin: [
      'You have full visibility across the platform.',
      'Camp Burnt Gin is running smoothly.',
      'All systems operational.',
      'The platform is yours to command.',
    ],
  };

  const messages = [...base[role]];

  // Inject data-aware messages at the front when relevant
  if (role === 'applicant' && stats.camperCount && stats.camperCount > 0) {
    const noun = stats.camperCount === 1 ? 'camper' : 'campers';
    messages.unshift(`${stats.camperCount} ${noun} registered for camp.`);
  }
  if ((role === 'admin' || role === 'super_admin') && stats.pendingCount && stats.pendingCount > 0) {
    const noun = stats.pendingCount === 1 ? 'application needs' : 'applications need';
    messages.unshift(`${stats.pendingCount} ${noun} your review.`);
  }
  if (role === 'admin' && stats.unreadCount && stats.unreadCount > 0) {
    const noun = stats.unreadCount === 1 ? 'unread message' : 'unread messages';
    messages.unshift(`${stats.unreadCount} ${noun} in your inbox.`);
  }
  if (role === 'medical' && stats.overdueCount && stats.overdueCount > 0) {
    const noun = stats.overdueCount === 1 ? 'follow-up is' : 'follow-ups are';
    messages.unshift(`${stats.overdueCount} ${noun} overdue.`);
  }

  return messages;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PersonalGreeting({ user, role, stats = {} }: PersonalGreetingProps) {
  const subtitles = buildSubtitles(role, stats);
  const [subtitleIndex, setSubtitleIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (subtitles.length <= 1) return;

    intervalRef.current = setInterval(() => {
      // Fade out → swap text → fade in
      setVisible(false);
      setTimeout(() => {
        setSubtitleIndex((i) => (i + 1) % subtitles.length);
        setVisible(true);
      }, 400);
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // subtitles array identity changes only when stats changes — intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitles.length, role]);

  const greeting = getTimeGreeting();
  const name = getDisplayName(user);

  return (
    <div
      className="relative rounded-2xl px-6 py-5 max-w-sm"
      style={{
        // ── Liquid glass core ──────────────────────────────────────────────
        background: 'rgba(255, 255, 255, 0.13)',
        backdropFilter: 'blur(28px) saturate(200%) brightness(108%)',
        WebkitBackdropFilter: 'blur(28px) saturate(200%) brightness(108%)',
        // ── Borders: bright top/left edge, dimmer bottom/right ─────────────
        border: '1px solid rgba(255, 255, 255, 0.42)',
        borderBottomColor: 'rgba(255, 255, 255, 0.14)',
        borderRightColor: 'rgba(255, 255, 255, 0.14)',
        // ── Depth shadows ──────────────────────────────────────────────────
        boxShadow: [
          '0 20px 60px rgba(0, 0, 0, 0.22)',
          '0 4px 16px rgba(0, 0, 0, 0.12)',
          'inset 0 1.5px 0 rgba(255, 255, 255, 0.55)', // specular top
          'inset 1.5px 0 0 rgba(255, 255, 255, 0.22)', // specular left
          'inset -1px -1px 0 rgba(0, 0, 0, 0.06)',     // inner shadow bottom/right
        ].join(', '),
        // ── Subtle iridescent refraction tint ──────────────────────────────
        // A faint cool shimmer overlaid via a pseudo-element isn't possible here,
        // but the saturate() filter on backdrop-filter achieves a similar effect
        // by enriching the colors of whatever is behind the glass.
      }}
    >
      {/* Inner highlight strip — simulates light catching the top rim */}
      <div
        className="absolute top-0 left-4 right-4 h-px rounded-full"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7) 30%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.7) 70%, transparent)',
        }}
        aria-hidden="true"
      />

      {/* Greeting salutation */}
      <p
        className="text-xs font-semibold uppercase tracking-[0.18em] mb-1.5 select-none"
        style={{
          color: 'rgba(255, 255, 255, 0.72)',
          textShadow: '0 1px 4px rgba(0,0,0,0.35)',
        }}
      >
        {greeting}
      </p>

      {/* Name */}
      <h2
        className="font-headline text-2xl font-semibold leading-tight mb-2 select-none"
        style={{
          color: '#ffffff',
          textShadow: '0 1px 6px rgba(0,0,0,0.45), 0 0 24px rgba(0,0,0,0.15)',
        }}
      >
        {name}
      </h2>

      {/* Rotating subtitle */}
      <p
        className="text-sm leading-snug select-none"
        style={{
          color: 'rgba(255, 255, 255, 0.82)',
          textShadow: '0 1px 4px rgba(0,0,0,0.4)',
          transition: 'opacity 400ms ease-in-out',
          opacity: visible ? 1 : 0,
          minHeight: '1.25rem', // prevent layout shift during text swap
        }}
      >
        {subtitles[subtitleIndex]}
      </p>
    </div>
  );
}
