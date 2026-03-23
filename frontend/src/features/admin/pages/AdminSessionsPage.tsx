/**
 * AdminSessionsPage.tsx
 *
 * Purpose: Full CRUD (Create, Read, Update, Delete) management for camps and sessions.
 * Route: /admin/sessions
 *
 * Responsibilities:
 *  - Display two columns side by side: one for camps, one for sessions.
 *  - Allow admins to create, edit, or delete camps via CampModal.
 *  - Allow admins to create, edit, or delete sessions (linked to a camp) via SessionModal.
 *  - After save, update local state optimistically (no full re-fetch needed).
 *
 * Phase 15 additions:
 *  - Active/Archived status badge on each session card.
 *  - Capacity fill bar with colour warning at 80%/100%.
 *  - "View Dashboard" link navigates to /admin/sessions/:id (SessionDetailPage).
 *  - "Archive" button for sessions that have applications (safe alternative to delete).
 *  - Delete handler now catches 422 and shows a descriptive toast instead of crashing.
 */

import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, X, Calendar, MapPin, Users, Archive, ExternalLink, FolderOpen } from 'lucide-react';
import { format } from 'date-fns';

import {
  getCamps, createCamp, updateCamp, deleteCamp,
  getSessions, createSession, updateSession, deleteSession, archiveSession,
} from '@/features/admin/api/admin.api';
import { Button } from '@/ui/components/Button';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState, ErrorState } from '@/ui/components/EmptyState';
import type { Camp, CampSession } from '@/features/admin/types/admin.types';
import { ROUTES } from '@/shared/constants/routes';

// ---------------------------------------------------------------------------
// Camp form modal
// ---------------------------------------------------------------------------

interface CampModalProps {
  // null means "create mode", an existing Camp means "edit mode".
  camp: Camp | null;
  onClose: () => void;
  // Called with the saved camp object so the parent can update its list.
  onSaved: (camp: Camp) => void;
}

function CampModal({ camp, onClose, onSaved }: CampModalProps) {
  const { t } = useTranslation();
  // Pre-fill form fields from the existing camp when editing, else start blank.
  const [name, setName]             = useState(camp?.name ?? '');
  const [location, setLocation]     = useState(camp?.location ?? '');
  const [description, setDesc]      = useState(camp?.description ?? '');
  const [saving, setSaving]         = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // If camp is provided we're editing; otherwise we're creating a new one.
      const saved = camp
        ? await updateCamp(camp.id, { name, location, description })
        : await createCamp({ name, location, description });
      onSaved(saved);
      toast.success(t(camp ? 'admin.sessions.camp_updated' : 'admin.sessions.camp_created'));
    } catch {
      toast.error(t('common.save_error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    // Backdrop — clicking it calls onClose.
    <div
      role="button"
      tabIndex={0}
      aria-label="Close"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
      {/* Dialog card — stop click from bubbling up to the backdrop. */}
      <div
        role="presentation"
        className="glass-panel w-full max-w-md rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
            {t(camp ? 'admin.sessions.edit_camp' : 'admin.sessions.new_camp')}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--muted-foreground)' }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form fields are declared as an array and mapped to avoid repetition. */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: t('admin.sessions.camp_name'), value: name, set: setName, required: true },
            { label: t('admin.sessions.camp_location'), value: location, set: setLocation, required: true },
            { label: t('admin.sessions.camp_description'), value: description, set: setDesc, required: false },
          ].map(({ label, value, set, required }) => (
            <div key={label}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                {label}
              </label>
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                required={required}
                className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
                style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              />
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={saving} className="flex-1">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session form modal
// ---------------------------------------------------------------------------

interface SessionModalProps {
  session: CampSession | null;
  camps: Camp[];
  onClose: () => void;
  onSaved: (session: CampSession) => void;
}

function SessionModal({ session, camps, onClose, onSaved }: SessionModalProps) {
  const { t } = useTranslation();
  // Default the camp dropdown to the session's camp (editing) or the first available camp (creating).
  const [campId, setCampId]         = useState<number>(session?.camp_id ?? camps[0]?.id ?? 0);
  const [name, setName]             = useState(session?.name ?? '');
  const [startDate, setStartDate]   = useState(session?.start_date ?? '');
  const [endDate, setEndDate]       = useState(session?.end_date ?? '');
  const [capacity, setCapacity]     = useState<number>(session?.capacity ?? 20);
  const [saving, setSaving]         = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { camp_id: campId, name, start_date: startDate, end_date: endDate, capacity };
      // Same create/update pattern as CampModal — determined by whether session prop is present.
      const saved = session
        ? await updateSession(session.id, payload)
        : await createSession(payload);
      onSaved(saved);
      toast.success(t(session ? 'admin.sessions.session_updated' : 'admin.sessions.session_created'));
    } catch {
      toast.error(t('common.save_error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Close"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
      <div
        role="presentation"
        className="glass-panel w-full max-w-md rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
            {t(session ? 'admin.sessions.edit_session' : 'admin.sessions.new_session')}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--muted-foreground)' }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Camp selector — which camp does this session belong to? */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin.sessions.camp')}
            </label>
            <select
              value={campId}
              onChange={(e) => setCampId(Number(e.target.value))}
              required
              className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              {camps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin.sessions.session_name')}
            </label>
            <input
              value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Start and end dates side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                {t('admin.sessions.start_date')}
              </label>
              <input
                type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
                className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
                style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                {t('admin.sessions.end_date')}
              </label>
              <input
                type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required
                className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
                style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin.sessions.capacity')}
            </label>
            <input
              type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} required
              className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" loading={saving} className="flex-1">{t('common.save')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function AdminSessionsPage() {
  const { t } = useTranslation();

  const [camps, setCamps]             = useState<Camp[]>([]);
  const [sessions, setSessions]       = useState<CampSession[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const [retryKey, setRetryKey]       = useState(0);
  // Track which sessions are mid-archive request so buttons show a loading state.
  const [archivingId, setArchivingId] = useState<number | null>(null);

  // Modal state objects hold both whether the modal is open and which item is being edited.
  const [campModal, setCampModal]     = useState<{ open: boolean; camp: Camp | null }>({ open: false, camp: null });
  const [sessionModal, setSessionModal] = useState<{ open: boolean; session: CampSession | null }>({ open: false, session: null });

  // Inline async effect with a cancelled flag so setState is never called on an unmounted
  // component (e.g. when the user switches tabs quickly mid-flight).
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!cancelled) setLoading(true);
      if (!cancelled) setError(false);
      try {
        const [campsData, sessionsData] = await Promise.all([getCamps(), getSessions()]);
        if (!cancelled) {
          setCamps(campsData);
          setSessions(sessionsData);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    // Cleanup: ignore the in-flight response if the component unmounts before it settles.
    return () => { cancelled = true; };
  }, [retryKey]); // Depend on data, not the callback reference.

  // Delete a camp after user confirmation — removes it from local state on success.
  async function handleDeleteCamp(id: number) {
    if (!window.confirm(t('admin.sessions.confirm_delete_camp'))) return;
    try {
      await deleteCamp(id);
      setCamps((prev) => prev.filter((c) => c.id !== id));
      toast.success(t('admin.sessions.camp_deleted'));
    } catch {
      toast.error(t('common.delete_error'));
    }
  }

  // Delete a session — catches 422 when applications exist and prompts to archive instead.
  async function handleDeleteSession(id: number) {
    if (!window.confirm(t('admin.sessions.confirm_delete_session'))) return;
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success(t('admin.sessions.session_deleted'));
    } catch (err) {
      const apiError = err as { message?: string };
      if (apiError?.message?.includes('applications')) {
        // Backend returns 422 when applications are linked — deletion would orphan records.
        toast.error('Cannot delete: this session has applications. Use Archive instead.');
      } else {
        toast.error(t('common.delete_error'));
      }
    }
  }

  // Archive a session — sets is_active=false, preserving all application records.
  async function handleArchiveSession(id: number) {
    if (!window.confirm('Archive this session? It will be hidden from the parent portal but all data is preserved.')) return;
    setArchivingId(id);
    try {
      await archiveSession(id);
      // Update local state to reflect the archived status without a full re-fetch.
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: false } : s))
      );
      toast.success('Session archived successfully.');
    } catch {
      toast.error('Failed to archive session. Please try again.');
    } finally {
      setArchivingId(null);
    }
  }

  if (error) {
    return <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />;
  }

  // Group sessions by camp_id for the hierarchical layout
  const sessionsByCamp = sessions.reduce((acc, session) => {
    const campId = session.camp_id;
    if (!acc[campId]) acc[campId] = [];
    acc[campId].push(session);
    return acc;
  }, {} as Record<number, typeof sessions>);

  return (
    <div className="p-6">

      {/* Page header with actions */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-headline text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
            {t('admin.sessions.camps_title')}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Manage camp programs and their sessions.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={ROUTES.ADMIN_ARCHIVED_SESSIONS}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--glass-medium)' }}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            View Archived
          </Link>
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setSessionModal({ open: true, session: null })}
            disabled={camps.length === 0}
          >
            {t('admin.sessions.new_session')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCampModal({ open: true, camp: null })}
          >
            {t('admin.sessions.new_camp')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-8">{Array.from({ length: 2 }).map((_, i) => <Skeletons.Card key={i} />)}</div>
      ) : camps.length === 0 ? (
        <EmptyState title={t('admin.sessions.no_camps')} description={t('admin.sessions.no_camps_desc')} />
      ) : (
        <div className="space-y-8">
          {camps.map((camp) => {
            const campSessions = (sessionsByCamp[camp.id] ?? []).filter((s) => s.is_active);
            const totalEnrolled  = campSessions.reduce((sum, s) => sum + (s.enrolled_count ?? 0), 0);
            const totalCapacity  = campSessions.reduce((sum, s) => sum + s.capacity, 0);

            return (
              <div key={camp.id}>
                {/* Camp header — full width banner with aggregate stats */}
                <div
                  className="rounded-xl px-5 py-4 mb-4 flex items-center justify-between gap-4 flex-wrap"
                  style={{
                    background: 'linear-gradient(135deg, rgba(22,101,52,0.08) 0%, rgba(22,101,52,0.03) 100%)',
                    border: '1px solid rgba(22,101,52,0.18)',
                  }}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Camp icon */}
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(22,101,52,0.12)' }}
                    >
                      <MapPin className="h-5 w-5" style={{ color: '#166534' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-headline font-semibold text-lg leading-tight" style={{ color: 'var(--foreground)' }}>
                        {camp.name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {camp.location}
                      </p>
                    </div>
                  </div>

                  {/* Aggregate stats */}
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-lg font-semibold leading-none" style={{ color: '#166534' }}>
                        {campSessions.length}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {campSessions.length === 1 ? 'Session' : 'Sessions'}
                      </p>
                    </div>
                    {totalCapacity > 0 && (
                      <>
                        <div className="h-8 w-px" style={{ background: 'var(--border)' }} />
                        <div className="text-center">
                          <p className="text-lg font-semibold leading-none" style={{ color: 'var(--foreground)' }}>
                            {totalEnrolled} <span className="text-sm font-normal" style={{ color: 'var(--muted-foreground)' }}>/ {totalCapacity}</span>
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Total enrolled</p>
                        </div>
                      </>
                    )}
                    <div className="h-8 w-px" style={{ background: 'var(--border)' }} />
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCampModal({ open: true, camp })}
                        className="p-1.5 rounded-lg transition-colors hover:bg-[var(--glass-strong)]"
                        style={{ color: 'var(--muted-foreground)' }}
                        title="Edit camp"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCamp(camp.id)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-[var(--glass-strong)]"
                        style={{ color: 'var(--muted-foreground)' }}
                        title="Delete camp"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sessions grid */}
                {campSessions.length === 0 ? (
                  <div
                    className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-10 gap-2"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No sessions yet for this camp.</p>
                    <button
                      onClick={() => setSessionModal({ open: true, session: null })}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-70 mt-1"
                      style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      <Plus className="h-3 w-3" /> Add first session
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {campSessions.map((session) => {
                      const enrolled   = session.enrolled_count ?? 0;
                      const fillPct    = session.capacity > 0
                        ? Math.min(100, Math.round((enrolled / session.capacity) * 100))
                        : 0;
                      const isNearFull = fillPct >= 80 && fillPct < 100;
                      const isFull     = fillPct >= 100;
                      const fillColor  = isFull ? '#dc2626' : isNearFull ? '#d97706' : '#166534';

                      return (
                        <div
                          key={session.id}
                          className="glass-card rounded-xl flex flex-col"
                          style={{ borderTop: `3px solid ${fillColor}` }}
                        >
                          {/* Card body */}
                          <div className="p-4 flex-1">
                            {/* Name + badges row */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <p className="font-semibold text-sm leading-snug" style={{ color: 'var(--foreground)' }}>
                                {session.name}
                              </p>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span
                                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                                  style={
                                    session.is_active
                                      ? { background: 'rgba(22,163,74,0.12)', color: '#166534' }
                                      : { background: 'rgba(107,114,128,0.12)', color: '#6b7280' }
                                  }
                                >
                                  {session.is_active ? 'Active' : 'Archived'}
                                </span>
                                {isFull && (
                                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}>
                                    Full
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Date */}
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Calendar className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                {format(new Date(session.start_date), 'MMM d')} — {format(new Date(session.end_date), 'MMM d, yyyy')}
                              </span>
                            </div>

                            {/* Capacity numbers */}
                            <div className="flex items-center gap-1.5 mb-3">
                              <Users className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                {enrolled} / {session.capacity} enrolled
                              </span>
                              {isNearFull && !isFull && (
                                <span className="text-xs font-medium" style={{ color: '#d97706' }}>· {fillPct}% full</span>
                              )}
                            </div>

                            {/* Capacity bar */}
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${fillPct}%`, background: fillColor }}
                              />
                            </div>
                          </div>

                          {/* Card footer — actions */}
                          <div
                            className="px-4 py-2.5 flex items-center justify-between border-t"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <Link
                              to={ROUTES.ADMIN_SESSION_DETAIL(session.id)}
                              className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-70"
                              style={{ color: '#166534' }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              View dashboard
                            </Link>
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => setSessionModal({ open: true, session })}
                                className="p-1.5 rounded transition-colors hover:bg-[var(--glass-strong)]"
                                style={{ color: 'var(--muted-foreground)' }}
                                title="Edit session"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              {session.is_active && (
                                <button
                                  onClick={() => handleArchiveSession(session.id)}
                                  disabled={archivingId === session.id}
                                  className="p-1.5 rounded transition-colors hover:bg-[var(--glass-strong)]"
                                  style={{ color: 'var(--muted-foreground)' }}
                                  title="Archive session"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteSession(session.id)}
                                className="p-1.5 rounded transition-colors hover:bg-[var(--glass-strong)]"
                                style={{ color: 'var(--muted-foreground)' }}
                                title="Delete session"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add session tile */}
                    <button
                      onClick={() => setSessionModal({ open: true, session: null })}
                      className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-8 transition-colors hover:opacity-70 min-h-[160px]"
                      style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      <Plus className="h-5 w-5" />
                      <span className="text-xs">Add session</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}


      {/* Camp modal */}
      {campModal.open && (
        <CampModal
          camp={campModal.camp}
          onClose={() => setCampModal({ open: false, camp: null })}
          onSaved={(saved) => {
            // Optimistically update local state: replace if editing, append if creating.
            setCamps((prev) =>
              campModal.camp
                ? prev.map((c) => (c.id === saved.id ? saved : c))
                : [...prev, saved]
            );
            setCampModal({ open: false, camp: null });
          }}
        />
      )}

      {/* Session modal */}
      {sessionModal.open && (
        <SessionModal
          session={sessionModal.session}
          camps={camps}
          onClose={() => setSessionModal({ open: false, session: null })}
          onSaved={(saved) => {
            setSessions((prev) =>
              sessionModal.session
                ? prev.map((s) => (s.id === saved.id ? saved : s))
                : [...prev, saved]
            );
            setSessionModal({ open: false, session: null });
          }}
        />
      )}
    </div>
  );
}
