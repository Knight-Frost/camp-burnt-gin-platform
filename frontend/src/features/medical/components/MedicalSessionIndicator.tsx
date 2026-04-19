/**
 * MedicalSessionIndicator.tsx
 *
 * Compact session picker displayed in the medical portal header.
 * Shows the active session or "All Sessions" with a dropdown to switch.
 */

import { useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronDown, Check, Globe } from 'lucide-react';
import { useMedicalSession } from '@/features/medical/context/MedicalSessionContext';
import type { CampSession } from '@/features/admin/types/admin.types';

export function MedicalSessionIndicator() {
  const { activeSession, sessions, sessionsLoading, setActiveSession } = useMedicalSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = activeSession
    ? activeSession.name
    : 'All Sessions';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
        style={{
          borderColor: activeSession ? 'rgba(22,163,74,0.40)' : 'var(--border)',
          background: activeSession ? 'rgba(22,163,74,0.06)' : 'var(--card)',
          color: activeSession ? 'var(--ember-orange)' : 'var(--foreground)',
        }}
        title="Switch active session"
      >
        {activeSession ? (
          <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <Globe className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
        )}
        <span className="max-w-[160px] truncate">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
      </button>

      {open && (
        <div
          className="absolute left-0 mt-1 w-64 rounded-xl border shadow-lg z-50 py-1 overflow-hidden"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            Session Filter
          </p>

          {/* All Sessions option */}
          <button
            onClick={() => { setActiveSession(null); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ color: 'var(--foreground)' }}
          >
            <Globe className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
            <span className="flex-1">All Sessions</span>
            {!activeSession && <Check className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />}
          </button>

          {sessionsLoading ? (
            <p className="px-3 py-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>Loading sessions…</p>
          ) : (
            sessions.map((session: CampSession) => (
              <button
                key={session.id}
                onClick={() => { setActiveSession(session); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ color: 'var(--foreground)' }}
              >
                <CalendarDays className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{session.name}</p>
                  {session.start_date && (
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(session.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
                {activeSession?.id === session.id && (
                  <Check className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
