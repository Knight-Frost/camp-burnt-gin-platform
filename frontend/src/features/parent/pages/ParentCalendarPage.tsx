/**
 * ParentCalendarPage.tsx
 * Parent view of the camp calendar — deadlines, session dates, orientation events.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
         isSameDay, isToday, isPast, addMonths, subMonths } from 'date-fns';

import { getCalendarEvents, type CalendarEvent } from '@/features/admin/api/calendar.api';
import { SkeletonCard } from '@/ui/components/Skeletons';
import { scrollRevealVariants, staggerContainerVariants, staggerChildVariants } from '@/shared/constants/motion';

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  deadline:    { bg: 'rgba(220,38,38,0.10)',   text: 'var(--destructive)',  dot: 'var(--destructive)'  },
  session:     { bg: 'rgba(22,101,52,0.10)',    text: '#166534',  dot: '#166534'  },
  orientation: { bg: 'rgba(37,99,235,0.10)',    text: '#2563eb',  dot: '#2563eb'  },
  staff:       { bg: 'rgba(124,58,237,0.10)',   text: '#7c3aed',  dot: '#7c3aed'  },
  internal:    { bg: 'rgba(107,114,128,0.10)',  text: '#6b7280',  dot: '#6b7280'  },
};

function getEventStyle(type: string) {
  return EVENT_COLORS[type] ?? EVENT_COLORS.internal;
}

export function ParentCalendarPage() {
  const [events, setEvents]     = useState<CalendarEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    getCalendarEvents()
      .then(setEvents)
      .catch(() => {/* silently show empty */})
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

  // Upcoming events (next 30 days from today)
  const upcoming = events
    .filter((e) => {
      const d = new Date(e.starts_at);
      const now = new Date();
      return d >= now && d <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 8);

  const overdue = events.filter((e) =>
    e.event_type === 'deadline' && isPast(new Date(e.starts_at))
  );

  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      {/* Header */}
      <motion.div variants={scrollRevealVariants} initial="hidden" animate="visible">
        <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--ember-orange)' }}>
          My Schedule
        </p>
        <h2 className="text-2xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
          Calendar
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Application deadlines, session dates, and orientation events.
        </p>
      </motion.div>

      {/* Overdue alert */}
      {!loading && overdue.length > 0 && (
        <div
          className="rounded-xl border px-4 py-3 flex items-start gap-3"
          style={{ background: 'rgba(220,38,38,0.05)', borderColor: 'rgba(220,38,38,0.20)' }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--destructive)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--destructive)' }}>
              {overdue.length} overdue deadline{overdue.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {overdue.map((e) => e.title).join(', ')}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2">
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: '#ffffff', borderColor: 'var(--border)' }}
          >
            {/* Month header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--dash-nav-hover-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date())}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'var(--dash-nav-active-bg)', color: 'var(--ember-orange)' }}
                >
                  Today
                </button>
                <button
                  onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--dash-nav-hover-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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

            {/* Days grid */}
            {loading ? (
              <div className="p-6"><SkeletonCard lines={4} /></div>
            ) : (
              <div className="grid grid-cols-7">
                {/* Empty cells before month start */}
                {Array.from({ length: startWeekday }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-20 border-b border-r" style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,0.01)' }} />
                ))}
                {days.map((day) => {
                  const dayEvents = eventsForDay(day);
                  const today    = isToday(day);
                  const inMonth  = isSameMonth(day, currentMonth);
                  return (
                    <div
                      key={day.toISOString()}
                      className="h-20 border-b border-r p-1.5 flex flex-col gap-0.5 overflow-hidden"
                      style={{
                        borderColor: 'var(--border)',
                        background: today ? 'rgba(22,101,52,0.04)' : inMonth ? '#ffffff' : 'rgba(0,0,0,0.01)',
                      }}
                    >
                      <span
                        className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0"
                        style={{
                          background: today ? '#166534' : 'transparent',
                          color: today ? '#ffffff' : inMonth ? 'var(--foreground)' : 'var(--muted-foreground)',
                        }}
                      >
                        {format(day, 'd')}
                      </span>
                      {dayEvents.slice(0, 2).map((ev) => {
                        const style = getEventStyle(ev.event_type);
                        return (
                          <div
                            key={ev.id}
                            className="rounded px-1 text-[10px] font-medium truncate leading-4"
                            style={{ background: style.bg, color: style.text }}
                            title={ev.title}
                          >
                            {ev.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                          +{dayEvents.length - 2} more
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
            {Object.entries(EVENT_COLORS).map(([type, style]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: style.dot }} />
                <span className="text-xs capitalize" style={{ color: 'var(--muted-foreground)' }}>{type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming events sidebar */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
            <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
              Upcoming (30 days)
            </h3>
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
                const style = getEventStyle(ev.event_type);
                return (
                  <motion.li
                    key={ev.id}
                    variants={staggerChildVariants}
                    className="rounded-xl border p-3"
                    style={{ background: '#ffffff', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: style.dot }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                          {ev.title}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {format(new Date(ev.starts_at), 'MMM d, yyyy')}
                          {!ev.all_day && ` · ${format(new Date(ev.starts_at), 'h:mm a')}`}
                        </p>
                        <span
                          className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 capitalize"
                          style={{ background: style.bg, color: style.text }}
                        >
                          {ev.event_type}
                        </span>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </div>
      </div>
    </div>
  );
}
