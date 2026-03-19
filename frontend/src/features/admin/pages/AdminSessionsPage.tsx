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
 * Plain-English summary:
 *  Camps are the main programs (e.g., "Summer Camp 2025"). Sessions are time-slots within
 *  a camp (e.g., "Week 1 — June 2-8"). This page manages both. Each modal opens in an
 *  overlay, and clicking the backdrop dismisses it. The "New Session" button is
 *  disabled when there are no camps yet, because every session must belong to a camp.
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, X, Calendar, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';

import {
  getCamps, createCamp, updateCamp, deleteCamp,
  getSessions, createSession, updateSession, deleteSession,
} from '@/features/admin/api/admin.api';
import { Button } from '@/ui/components/Button';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState, ErrorState } from '@/ui/components/EmptyState';
import type { Camp, CampSession } from '@/features/admin/types/admin.types';

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
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
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
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
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
    await deleteCamp(id);
    setCamps((prev) => prev.filter((c) => c.id !== id));
    toast.success(t('admin.sessions.camp_deleted'));
  }

  // Delete a session after user confirmation — filters it out of local state.
  async function handleDeleteSession(id: number) {
    if (!window.confirm(t('admin.sessions.confirm_delete_session'))) return;
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast.success(t('admin.sessions.session_deleted'));
  }

  if (error) {
    return <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />;
  }

  return (
    <div className="p-6 max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left column: Camps */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-headline font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
              {t('admin.sessions.camps_title')}
            </h2>
            {/* Opens the camp modal in "create" mode (camp=null). */}
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setCampModal({ open: true, camp: null })}
            >
              {t('admin.sessions.new_camp')}
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeletons.Card key={i} />)}</div>
          ) : camps.length === 0 ? (
            <EmptyState title={t('admin.sessions.no_camps')} description={t('admin.sessions.no_camps_desc')} />
          ) : (
            <div className="space-y-3">
              {camps.map((camp) => (
                <div
                  key={camp.id}
                  className="rounded-xl border p-4"
                  style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{camp.name}</p>
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                        <MapPin className="h-3 w-3" /> {camp.location}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Edit button — opens modal with this camp pre-loaded. */}
                      <button
                        onClick={() => setCampModal({ open: true, camp })}
                        className="p-1.5 rounded transition-colors"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCamp(camp.id)}
                        className="p-1.5 rounded transition-colors"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: Sessions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-headline font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
              {t('admin.sessions.sessions_title')}
            </h2>
            {/* Disabled when no camps exist — every session must belong to a camp. */}
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setSessionModal({ open: true, session: null })}
              disabled={camps.length === 0}
            >
              {t('admin.sessions.new_session')}
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeletons.Card key={i} />)}</div>
          ) : sessions.length === 0 ? (
            <EmptyState title={t('admin.sessions.no_sessions')} description={t('admin.sessions.no_sessions_desc')} />
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl border p-4"
                  style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{session.name}</p>
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                        <Calendar className="h-3 w-3" />
                        {format(new Date(session.start_date), 'MMM d')} — {format(new Date(session.end_date), 'MMM d, yyyy')}
                      </p>
                      {/* Show enrolled / capacity fraction. */}
                      <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                        <Users className="h-3 w-3" />
                        {session.enrolled_count ?? 0} / {session.capacity} {t('admin.sessions.enrolled')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSessionModal({ open: true, session })}
                        className="p-1.5 rounded transition-colors"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="p-1.5 rounded transition-colors"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
