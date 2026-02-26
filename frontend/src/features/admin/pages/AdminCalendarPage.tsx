/**
 * AdminCalendarPage.tsx
 * Admin calendar — all event types, create/edit/delete events.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronLeft, ChevronRight, X, Calendar, Clock, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
         isToday, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';

import {
  getCalendarEvents, createCalendarEvent, deleteCalendarEvent,
  type CalendarEvent, type CreateCalendarEventPayload, type EventType,
} from '@/features/admin/api/calendar.api';
import { SkeletonCard } from '@/ui/components/Skeletons';
import { Button } from '@/ui/components/Button';
import { scrollRevealVariants, staggerContainerVariants, staggerChildVariants, modalBackdrop, modalContent } from '@/shared/constants/motion';

const EVENT_COLORS: Record<EventType, { bg: string; text: string; dot: string; label: string }> = {
  deadline:    { bg: 'rgba(220,38,38,0.10)',   text: '#dc2626',  dot: '#dc2626',  label: 'Deadline'    },
  session:     { bg: 'rgba(22,101,52,0.10)',    text: '#166534',  dot: '#166534',  label: 'Session'     },
  orientation: { bg: 'rgba(37,99,235,0.10)',    text: '#2563eb',  dot: '#2563eb',  label: 'Orientation' },
  staff:       { bg: 'rgba(124,58,237,0.10)',   text: '#7c3aed',  dot: '#7c3aed',  label: 'Staff'       },
  internal:    { bg: 'rgba(107,114,128,0.10)',  text: '#6b7280',  dot: '#6b7280',  label: 'Internal'    },
};

const EVENT_TYPES = Object.entries(EVENT_COLORS).map(([value, meta]) => ({ value: value as EventType, label: meta.label }));

interface EventFormState {
  title: string;
  description: string;
  event_type: EventType;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  audience: 'all' | 'accepted' | 'staff' | 'session';
}

const DEFAULT_FORM: EventFormState = {
  title: '',
  description: '',
  event_type: 'deadline',
  starts_at: '',
  ends_at: '',
  all_day: false,
  audience: 'all',
};

function inputStyle(hasErr = false) {
  return {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: `1px solid ${hasErr ? '#dc2626' : 'rgba(0,0,0,0.12)'}`,
    fontSize: '0.9375rem',
    background: '#f9fafb',
    color: 'var(--foreground)',
    outline: 'none',
  } as React.CSSProperties;
}

export function AdminCalendarPage() {
  const [events, setEvents]           = useState<CalendarEvent[]>([]);
  const [loading, setLoading]         = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showModal, setShowModal]     = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [form, setForm]               = useState<EventFormState>(DEFAULT_FORM);
  const [saving, setSaving]           = useState(false);
  const [deletingId, setDeletingId]   = useState<number | null>(null);

  useEffect(() => {
    getCalendarEvents()
      .then(setEvents)
      .catch(() => toast.error('Failed to load events.'))
      .finally(() => setLoading(false));
  }, []);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end:   endOfMonth(currentMonth),
  });
  const startWeekday = startOfMonth(currentMonth).getDay();

  function eventsForDay(day: Date) {
    return events.filter((e) => isSameDay(new Date(e.starts_at), day));
  }

  const upcoming = events
    .filter((e) => new Date(e.starts_at) >= new Date())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 10);

  function openNewEvent(day?: Date) {
    setForm({
      ...DEFAULT_FORM,
      starts_at: day ? format(day, "yyyy-MM-dd'T'HH:mm") : '',
    });
    setSelectedDay(day ?? null);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.starts_at) {
      toast.error('Title and start date are required.');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateCalendarEventPayload = {
        title:       form.title.trim(),
        description: form.description || null,
        event_type:  form.event_type,
        color:       EVENT_COLORS[form.event_type].dot,
        starts_at:   form.starts_at,
        ends_at:     form.ends_at || null,
        all_day:     form.all_day,
        audience:    form.audience,
        target_session_id: null,
      };
      const created = await createCalendarEvent(payload);
      setEvents((prev) => [...prev, created]);
      toast.success('Event created.');
      setShowModal(false);
    } catch {
      toast.error('Failed to create event.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await deleteCalendarEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      toast.success('Event deleted.');
    } catch {
      toast.error('Failed to delete event.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      {/* Header */}
      <motion.div variants={scrollRevealVariants} initial="hidden" animate="visible">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--ember-orange)' }}>
              Admin
            </p>
            <h2 className="text-2xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
              Calendar
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Manage camp events, deadlines, staff schedules, and orientation dates.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => openNewEvent()}>
            <Plus className="h-4 w-4" />
            Add Event
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border overflow-hidden" style={{ background: '#ffffff', borderColor: 'var(--border)' }}>
            {/* Month nav */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                  className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                  style={{ color: 'var(--muted-foreground)' }}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date())}
                  className="px-3 py-1 rounded-lg text-xs font-medium"
                  style={{ background: 'var(--dash-nav-active-bg)', color: 'var(--ember-orange)' }}
                >
                  Today
                </button>
                <button
                  onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                  className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                  style={{ color: 'var(--muted-foreground)' }}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Days */}
            {loading ? (
              <div className="p-6"><SkeletonCard lines={4} /></div>
            ) : (
              <div className="grid grid-cols-7">
                {Array.from({ length: startWeekday }).map((_, i) => (
                  <div key={`e-${i}`} className="h-20 border-b border-r" style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,0.01)' }} />
                ))}
                {days.map((day) => {
                  const dayEvents = eventsForDay(day);
                  const today = isToday(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className="h-20 border-b border-r p-1.5 flex flex-col gap-0.5 overflow-hidden cursor-pointer transition-colors"
                      style={{
                        borderColor: 'var(--border)',
                        background: today ? 'rgba(22,101,52,0.04)' : '#ffffff',
                      }}
                      onClick={() => openNewEvent(day)}
                      onMouseEnter={(e) => { if (!today) e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; }}
                      onMouseLeave={(e) => { if (!today) e.currentTarget.style.background = '#ffffff'; }}
                    >
                      <span
                        className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0"
                        style={{
                          background: today ? '#166534' : 'transparent',
                          color: today ? '#ffffff' : 'var(--foreground)',
                        }}
                      >
                        {format(day, 'd')}
                      </span>
                      {dayEvents.slice(0, 2).map((ev) => {
                        const s = EVENT_COLORS[ev.event_type] ?? EVENT_COLORS.internal;
                        return (
                          <div
                            key={ev.id}
                            className="rounded px-1 text-[10px] font-medium truncate leading-4"
                            style={{ background: s.bg, color: s.text }}
                            title={ev.title}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {ev.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                          +{dayEvents.length - 2}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-3 px-1">
            {EVENT_TYPES.map(({ value, label }) => (
              <div key={value} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: EVENT_COLORS[value].dot }} />
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming sidebar */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
              <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
                Upcoming
              </h3>
            </div>
          </div>

          {loading ? (
            <SkeletonCard lines={4} />
          ) : upcoming.length === 0 ? (
            <div className="rounded-xl border px-4 py-6 text-center" style={{ borderColor: 'var(--border)' }}>
              <Calendar className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No upcoming events.</p>
            </div>
          ) : (
            <motion.ul
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-2"
            >
              {upcoming.map((ev) => {
                const s = EVENT_COLORS[ev.event_type] ?? EVENT_COLORS.internal;
                return (
                  <motion.li
                    key={ev.id}
                    variants={staggerChildVariants}
                    className="rounded-xl border p-3"
                    style={{ background: '#ffffff', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: s.dot }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{ev.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {format(new Date(ev.starts_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(ev.id)}
                        disabled={deletingId === ev.id}
                        className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)] transition-colors flex-shrink-0"
                        style={{ color: 'var(--muted-foreground)' }}
                        aria-label="Delete event"
                      >
                        {deletingId === ev.id ? (
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </div>
      </div>

      {/* Create event modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            variants={modalBackdrop}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              variants={modalContent}
              className="w-full max-w-md rounded-2xl p-6"
              style={{ background: '#ffffff', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
                  New Event{selectedDay && ` — ${format(selectedDay, 'MMM d')}`}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Title *</label>
                  <input
                    style={inputStyle(!form.title)}
                    placeholder="Event title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Description</label>
                  <textarea
                    style={{ ...inputStyle(), height: 72, resize: 'none' }}
                    placeholder="Optional description"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Type</label>
                    <select
                      style={inputStyle()}
                      value={form.event_type}
                      onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value as EventType }))}
                    >
                      {EVENT_TYPES.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Audience</label>
                    <select
                      style={inputStyle()}
                      value={form.audience}
                      onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as EventFormState['audience'] }))}
                    >
                      <option value="all">All</option>
                      <option value="accepted">Accepted</option>
                      <option value="staff">Staff</option>
                      <option value="session">Session</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Start *</label>
                    <input
                      type="datetime-local"
                      style={inputStyle(!form.starts_at)}
                      value={form.starts_at}
                      onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>End</label>
                    <input
                      type="datetime-local"
                      style={inputStyle()}
                      value={form.ends_at}
                      onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    checked={form.all_day}
                    onChange={(e) => setForm((f) => ({ ...f, all_day: e.target.checked }))}
                  />
                  <span className="text-sm" style={{ color: 'var(--foreground)' }}>All day event</span>
                </label>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Create Event'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
