/**
 * ApplicationStartPage.tsx — Redesigned
 *
 * Two-column responsive layout: main flow (left) + sticky summary panel (right).
 * Route: /applicant/applications/start
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  Stethoscope,
  Users,
} from 'lucide-react';

import { getSessions } from '@/features/parent/api/applicant.api';
import type { Session } from '@/shared/types';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/ui/components/Button';

const DRAFT_KEY = 'cbg_app_draft';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string): string {
  const toDate = (d: string) => new Date(`${d}T12:00:00`);
  const startStr = toDate(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr   = toDate(end).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return `${startStr} – ${endStr}`;
}

// Label key is resolved via t() inside the component — only visual props here.
type BadgeConfig = { labelKey: string; color: string; bg: string; selectable: boolean };

function getSessionBadge(session: Session): BadgeConfig {
  const filled =
    session.capacity > 0
      ? (session.capacity - session.available_spots) / session.capacity
      : 1;
  if (session.status === 'closed' || session.status === 'cancelled') {
    return { labelKey: 'app_start.session_badge_closed',   color: '#6b7280', bg: 'rgba(107,114,128,0.10)', selectable: false };
  }
  if (session.status === 'waitlist') {
    return { labelKey: 'app_start.session_badge_waitlist', color: '#ea580c', bg: 'rgba(234,88,12,0.10)',   selectable: true  };
  }
  if (filled >= 0.8) {
    return { labelKey: 'app_start.session_badge_filling',  color: '#d97706', bg: 'rgba(217,119,6,0.10)',   selectable: true  };
  }
  return   { labelKey: 'app_start.session_badge_open',     color: '#16a34a', bg: 'rgba(22,163,74,0.10)',   selectable: true  };
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StepBadge({ number, complete = false }: { number: number; complete?: boolean }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300"
      style={{
        background: complete ? 'var(--ember-orange)' : 'rgba(22,163,74,0.10)',
        border:     complete ? 'none'                : '2px solid rgba(22,163,74,0.22)',
      }}
    >
      {complete ? (
        <Check className="h-3.5 w-3.5" style={{ color: '#ffffff' }} />
      ) : (
        <span
          className="text-xs font-bold leading-none"
          style={{ color: 'var(--ember-orange)', fontFamily: 'var(--font-body)' }}
        >
          {number}
        </span>
      )}
    </div>
  );
}

function ChecklistRow({
  done,
  pending = false,
  label,
  note,
}: {
  done: boolean;
  pending?: boolean;
  label: string;
  note: string;
}) {
  const iconBg = done
    ? 'var(--ember-orange)'
    : pending
    ? 'rgba(217,119,6,0.12)'
    : 'var(--muted)';
  const iconBorder = done
    ? 'transparent'
    : pending
    ? '1.5px solid rgba(217,119,6,0.30)'
    : '1.5px solid var(--border)';

  return (
    <div className="flex items-start gap-2.5">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-300"
        style={{ background: iconBg, border: iconBorder }}
      >
        {done ? (
          <Check className="h-2.5 w-2.5" style={{ color: '#ffffff' }} />
        ) : pending ? (
          <Clock className="h-2.5 w-2.5" style={{ color: '#d97706' }} />
        ) : (
          <span
            className="w-1.5 h-1.5 rounded-full block"
            style={{ background: 'var(--muted-foreground)', opacity: 0.35 }}
          />
        )}
      </div>
      <div>
        <p className="text-sm font-medium leading-tight" style={{ color: 'var(--foreground)' }}>
          {label}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {note}
        </p>
      </div>
    </div>
  );
}

// ── Page Component ──────────────────────────────────────────────────────────

export function ApplicationStartPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [sessions, setSessions]               = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [language, setLanguage]               = useState<'english' | 'spanish'>('english');
  const [localDraft, setLocalDraft]           = useState<{ camperName: string | null } | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          s1?: { camper_first_name?: string; camper_last_name?: string };
        };
        const first = (parsed.s1?.camper_first_name ?? '').trim();
        const last  = (parsed.s1?.camper_last_name  ?? '').trim();
        setLocalDraft({ camperName: first || last ? `${first} ${last}`.trim() : null });
      }
    } catch { /* ignore corrupt draft */ }

    getSessions()
      .then((data) => setSessions(data.filter((s) => s.status !== 'cancelled')))
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, []);

  function startNew() {
    if (!selectedSession) return;
    i18n.changeLanguage(language === 'spanish' ? 'es' : 'en');
    localStorage.removeItem(DRAFT_KEY);
    navigate(ROUTES.PARENT_APPLICATION_NEW, {
      state: { language, sessionId: selectedSession.id },
    });
  }

  function continueDraft() {
    navigate(ROUTES.PARENT_APPLICATION_NEW);
  }

  const canStartNew     = selectedSession !== null;
  const activeSessions  = sessions.filter((s) => s.status === 'open' || s.status === 'waitlist');
  const closedSessions  = sessions.filter((s) => s.status === 'closed');
  const orderedSessions = [...activeSessions, ...closedSessions];

  const progressLabel = localDraft
    ? t('app_start.panel_progress_draft')
    : canStartNew
    ? t('app_start.panel_progress_ready')
    : t('app_start.panel_progress_not_started');
  const progressDot = localDraft ? '#d97706' : canStartNew ? '#16a34a' : '#9ca3af';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ animation: 'pageIn 0.3s ease both' }}>
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <nav className="mb-8">
          <button
            type="button"
            onClick={() => navigate(ROUTES.PARENT_APPLICATIONS)}
            className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-[var(--foreground)]"
            style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-body)' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('app_start.back_applications')}
          </button>
        </nav>

        {/* ── Two-column layout ───────────────────────────────────────────── */}
        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-12 flex flex-col gap-10">

          {/* ═══════════════════════════════════════════════════════════════
              LEFT COLUMN — Main flow
          ════════════════════════════════════════════════════════════════ */}
          <div className="flex flex-col gap-12 min-w-0">

            {/* ── HERO ───────────────────────────────────────────────────── */}
            <header className="flex flex-col gap-3">
              <h1
                className="font-headline font-bold leading-tight"
                style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', color: 'var(--foreground)' }}
              >
                {t('app_start.hero_title')}
              </h1>
              <p
                className="text-base leading-relaxed"
                style={{ color: 'var(--muted-foreground)', maxWidth: '520px' }}
              >
                {t('app_start.hero_subtitle')}{' '}
                <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>
                  {t('app_start.hero_subtitle_bold')}
                </span>
              </p>
            </header>

            {/* ── STEP 1: Camp Session ────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <StepBadge number={1} complete={canStartNew} />
                <div>
                  <p
                    className="text-base font-semibold leading-tight"
                    style={{ color: 'var(--foreground)', fontFamily: 'var(--font-body)' }}
                  >
                    {t('app_start.step1_title')}
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {t('app_start.step1_desc')}
                  </p>
                </div>
              </div>

              {sessionsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="h-36 rounded-2xl animate-pulse"
                      style={{ background: 'var(--muted)' }}
                    />
                  ))}
                </div>
              ) : orderedSessions.length === 0 ? (
                <div
                  className="flex flex-col items-center gap-4 py-14 rounded-2xl border text-center"
                  style={{ borderColor: 'var(--border)', background: 'var(--card)', boxShadow: 'var(--shadow-card-subtle)' }}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--muted)' }}
                  >
                    <Calendar className="h-5 w-5" style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                      {t('app_start.no_sessions_title')}
                    </p>
                    <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: 'var(--muted-foreground)' }}>
                      {t('app_start.no_sessions_desc')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {orderedSessions.map((session) => {
                    const badge      = getSessionBadge(session);
                    const isSelected = selectedSession?.id === session.id;

                    return (
                      <button
                        key={session.id}
                        type="button"
                        disabled={!badge.selectable}
                        onClick={() =>
                          badge.selectable && setSelectedSession(isSelected ? null : session)
                        }
                        className="flex flex-col gap-3 rounded-2xl p-5 text-left transition-all duration-200"
                        style={{
                          background:  isSelected ? 'rgba(22,163,74,0.04)' : 'var(--card)',
                          border:      isSelected
                            ? '2px solid var(--ember-orange)'
                            : '2px solid var(--border)',
                          boxShadow: isSelected
                            ? '0 0 0 4px rgba(22,163,74,0.06), var(--shadow-card-subtle)'
                            : 'var(--shadow-card-subtle)',
                          opacity:  badge.selectable ? 1 : 0.45,
                          cursor:   badge.selectable ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {/* Name + selector */}
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className="text-sm font-semibold leading-snug flex-1"
                            style={{ color: 'var(--foreground)' }}
                          >
                            {session.name}
                          </p>
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all duration-200"
                            style={{
                              background:  isSelected ? 'var(--ember-orange)' : 'transparent',
                              borderColor: isSelected ? 'var(--ember-orange)' : 'var(--border)',
                            }}
                          >
                            {isSelected && <Check className="h-2.5 w-2.5" style={{ color: '#ffffff' }} />}
                          </div>
                        </div>

                        {/* Dates */}
                        <div className="flex items-center gap-1.5">
                          <Calendar
                            className="h-3.5 w-3.5 flex-shrink-0"
                            style={{ color: 'var(--muted-foreground)' }}
                          />
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {formatDateRange(session.start_date, session.end_date)}
                          </span>
                        </div>

                        {/* Status + spots */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                            style={{ background: badge.bg, color: badge.color }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full inline-block"
                              style={{ background: badge.color }}
                            />
                            {t(badge.labelKey)}
                          </span>
                          {session.available_spots > 0 && badge.selectable && (
                            <span
                              className="flex items-center gap-1 text-xs"
                              style={{ color: 'var(--muted-foreground)' }}
                            >
                              <Users className="h-3 w-3" />
                              {t(
                                session.available_spots === 1
                                  ? 'app_start.spots_left_one'
                                  : 'app_start.spots_left_other',
                                { count: session.available_spots }
                              )}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── STEP 2: Language ─────────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <StepBadge number={2} complete />
                <div>
                  <p
                    className="text-base font-semibold leading-tight"
                    style={{ color: 'var(--foreground)', fontFamily: 'var(--font-body)' }}
                  >
                    {t('app_start.step2_title')}
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {t('app_start.step2_desc')}
                  </p>
                </div>
              </div>

              <div
                className="inline-flex items-center p-1 rounded-2xl"
                style={{ background: 'var(--muted)', width: '100%', maxWidth: '300px' }}
              >
                {(['english', 'spanish'] as const).map((lang) => {
                  const active = language === lang;
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setLanguage(lang)}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                      style={{
                        background: active
                          ? 'var(--card)'
                          : 'transparent',
                        color: active
                          ? 'var(--foreground)'
                          : 'var(--muted-foreground)',
                        boxShadow: active
                          ? '0 1px 4px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)'
                          : 'none',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                      {lang === 'english' ? 'English' : 'Español'}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ── STEP 3: What You'll Need ──────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <StepBadge number={3} complete />
                <div>
                  <p
                    className="text-base font-semibold leading-tight"
                    style={{ color: 'var(--foreground)', fontFamily: 'var(--font-body)' }}
                  >
                    {t('app_start.step3_title')}
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {t('app_start.step3_desc')}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-stretch">

                {/* Part A: Digital Form */}
                <div
                  className="flex-1 rounded-2xl border p-5 flex flex-col gap-4"
                  style={{
                    background:  'var(--card)',
                    borderColor: 'var(--border)',
                    boxShadow:   'var(--shadow-card-subtle)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(22,163,74,0.10)' }}
                    >
                      <FileText className="h-5 w-5" style={{ color: 'var(--ember-orange)' }} />
                    </div>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(22,163,74,0.10)', color: 'var(--ember-orange)' }}
                    >
                      {t('app_start.badge_online')}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
                      {t('app_start.digital_form_title')}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                      {t('app_start.digital_form_desc')}
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: 'var(--ember-orange)' }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t('app_start.digital_form_note')}
                  </div>
                </div>

                {/* Arrow connector */}
                <div className="hidden sm:flex items-center justify-center flex-shrink-0 py-2">
                  <ArrowRight
                    className="h-4 w-4"
                    style={{ color: 'var(--muted-foreground)', opacity: 0.4 }}
                  />
                </div>

                {/* Part B: Medical Form */}
                <div
                  className="flex-1 rounded-2xl border p-5 flex flex-col gap-4"
                  style={{
                    background:  'var(--card)',
                    borderColor: 'var(--border)',
                    boxShadow:   'var(--shadow-card-subtle)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(217,119,6,0.10)' }}
                    >
                      <Stethoscope className="h-5 w-5" style={{ color: '#d97706' }} />
                    </div>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(217,119,6,0.10)', color: '#d97706' }}
                    >
                      {t('app_start.badge_upload_required')}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
                      {t('app_start.medical_form_title')}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                      {t('app_start.medical_form_desc_part1')}{' '}
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.PARENT_FORMS)}
                        className="underline underline-offset-2 hover:no-underline font-medium"
                        style={{ color: 'var(--ember-orange)' }}
                      >
                        {t('app_start.medical_form_desc_link')}
                      </button>{' '}
                      {t('app_start.medical_form_desc_part2')}
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: '#d97706' }}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {t('app_start.medical_form_note')}
                  </div>
                </div>

              </div>
            </section>

            {/* ── STEP 4: Action Area ───────────────────────────────────────── */}
            <section className="pb-4">
              <div className="flex items-center gap-3 mb-6">
                <StepBadge number={4} />
                <div>
                  <p
                    className="text-base font-semibold leading-tight"
                    style={{ color: 'var(--foreground)', fontFamily: 'var(--font-body)' }}
                  >
                    {t('app_start.step4_title')}
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {canStartNew
                      ? t('app_start.step4_ready')
                      : t('app_start.step4_select_session')}
                  </p>
                </div>
              </div>

              {localDraft ? (
                /* DRAFT EXISTS ── Primary: continue  |  Secondary: start new */
                <div className="flex flex-col gap-4">

                  {/* Primary: Continue */}
                  <div
                    className="rounded-2xl p-6 flex flex-col gap-4"
                    style={{
                      background:  'rgba(22,163,74,0.04)',
                      border:      '2px solid var(--border-ember)',
                      boxShadow:   'var(--shadow-card-subtle)',
                    }}
                  >
                    <div>
                      <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                        {t('app_start.continue_title')}
                      </p>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {localDraft.camperName
                          ? t('app_start.continue_desc_named', { name: localDraft.camperName })
                          : t('app_start.continue_desc_generic')}
                      </p>
                    </div>
                    <Button size="lg" onClick={continueDraft} fullWidth>
                      {t('app_start.resume_btn')}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>

                  {/* Secondary: Start new */}
                  <div
                    className="rounded-2xl p-5 flex flex-col gap-3"
                    style={{
                      background:  'var(--card)',
                      border:      '1px solid var(--border)',
                      boxShadow:   'var(--shadow-card-subtle)',
                    }}
                  >
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {t('app_start.new_app_warning')}
                    </p>
                    <Button
                      variant="secondary"
                      size="md"
                      disabled={!canStartNew}
                      onClick={startNew}
                      fullWidth
                    >
                      {t('app_start.start_new_btn')}
                    </Button>
                    {!canStartNew && (
                      <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
                        {t('app_start.select_session_hint')}
                      </p>
                    )}
                  </div>

                </div>
              ) : (
                /* NO DRAFT ── Single dominant CTA */
                <div
                  className="rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300"
                  style={{
                    background:  canStartNew ? 'rgba(22,163,74,0.03)' : 'var(--card)',
                    border:      canStartNew
                      ? '2px solid var(--border-ember)'
                      : '2px solid var(--border)',
                    boxShadow: 'var(--shadow-card-subtle)',
                  }}
                >
                  {canStartNew && selectedSession && (
                    <div
                      className="flex items-center gap-2 text-sm"
                      style={{ color: 'var(--ember-orange)' }}
                    >
                      <Check className="h-4 w-4 flex-shrink-0" />
                      <span className="font-semibold">{selectedSession.name}</span>
                      <span style={{ color: 'var(--muted-foreground)' }}>
                        · {formatDateRange(selectedSession.start_date, selectedSession.end_date)}
                      </span>
                    </div>
                  )}

                  <Button
                    size="lg"
                    disabled={!canStartNew}
                    onClick={startNew}
                    fullWidth
                  >
                    {t('app_start.start_btn')}
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>

                  {!canStartNew && (
                    <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
                      {t('app_start.select_session_hint2')}
                    </p>
                  )}
                </div>
              )}
            </section>

          </div>

          {/* ═══════════════════════════════════════════════════════════════
              RIGHT COLUMN — Sticky summary panel (desktop only)
          ════════════════════════════════════════════════════════════════ */}
          <aside className="hidden lg:block h-fit">
            <div className="sticky top-6">
              <div
                className="rounded-2xl flex flex-col gap-0 overflow-hidden"
                style={{
                  background:  'var(--card)',
                  border:      '1px solid var(--border)',
                  boxShadow:   'var(--shadow-card)',
                }}
              >
                {/* Panel header */}
                <div
                  className="px-5 py-4"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--muted-foreground)', letterSpacing: '0.07em', fontFamily: 'var(--font-body)' }}
                  >
                    {t('app_start.panel_your_application')}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300"
                      style={{ background: progressDot }}
                    />
                    <span
                      className="text-sm font-medium transition-all duration-300"
                      style={{ color: 'var(--foreground)', fontFamily: 'var(--font-body)' }}
                    >
                      {progressLabel}
                    </span>
                  </div>
                </div>

                {/* Session */}
                <div
                  className="px-5 py-4"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-2"
                    style={{ color: 'var(--muted-foreground)', letterSpacing: '0.07em', fontFamily: 'var(--font-body)' }}
                  >
                    {t('app_start.panel_session')}
                  </p>
                  {selectedSession ? (
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        {selectedSession.name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {formatDateRange(selectedSession.start_date, selectedSession.end_date)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {t('app_start.panel_not_selected')}
                    </p>
                  )}
                </div>

                {/* Language */}
                <div
                  className="px-5 py-4"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-2"
                    style={{ color: 'var(--muted-foreground)', letterSpacing: '0.07em', fontFamily: 'var(--font-body)' }}
                  >
                    {t('app_start.panel_language')}
                  </p>
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {language === 'english' ? t('app_start.panel_language_english') : t('app_start.panel_language_spanish')}
                  </p>
                </div>

                {/* Checklist */}
                <div className="px-5 py-4">
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-3"
                    style={{ color: 'var(--muted-foreground)', letterSpacing: '0.07em', fontFamily: 'var(--font-body)' }}
                  >
                    {t('app_start.panel_checklist')}
                  </p>
                  <div className="flex flex-col gap-3">
                    <ChecklistRow
                      done={canStartNew}
                      label={t('app_start.checklist_digital_label')}
                      note={canStartNew ? t('app_start.checklist_digital_ready') : t('app_start.checklist_digital_select')}
                    />
                    <ChecklistRow
                      done={false}
                      pending
                      label={t('app_start.checklist_medical_label')}
                      note={t('app_start.checklist_medical_note')}
                    />
                  </div>
                </div>

              </div>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}
