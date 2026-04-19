/**
 * MedicalSessionContext.tsx
 *
 * Session awareness for the medical portal.
 *
 * Selected session_id is passed to all medical API calls so staff can view
 * incidents, visits, treatments, and follow-ups scoped to a specific session.
 *
 * Modes:
 *  - null (all sessions) — global view, no session filter
 *  - number (session ID) — scoped view for that session
 *
 * Persistence: stored in sessionStorage under 'cbg_medical_session' so it
 * resets when the tab closes (appropriate for clinical data privacy).
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSessions } from '@/features/admin/api/admin.api';
import type { CampSession } from '@/features/admin/types/admin.types';

const STORAGE_KEY = 'cbg_medical_session';

export interface MedicalSessionValue {
  /** Currently selected session, or null for all-sessions view. */
  activeSession: CampSession | null;
  /** Convenience: the session ID to pass to API calls, or undefined for global. */
  activeSessionId: number | undefined;
  /** All available sessions. */
  sessions: CampSession[];
  sessionsLoading: boolean;
  setActiveSession: (session: CampSession | null) => void;
}

const MedicalSessionContext = createContext<MedicalSessionValue | null>(null);

export function MedicalSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSessionState] = useState<CampSession | null>(null);
  const [sessions, setSessions] = useState<CampSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  useEffect(() => {
    getSessions({ per_page: 100 })
      .then((data) => {
        setSessions(Array.isArray(data) ? data : (data as any).data ?? []);

        // Rehydrate selection from sessionStorage.
        try {
          const stored = sessionStorage.getItem(STORAGE_KEY);
          if (stored) {
            const storedId = parseInt(stored, 10);
            const found = (Array.isArray(data) ? data : (data as any).data ?? [])
              .find((s: CampSession) => s.id === storedId);
            if (found) {
              setActiveSessionState(found);
            }
          }
        } catch {
          // Ignore storage errors — fall back to all-sessions mode.
        }
      })
      .catch(() => {
        // Sessions unavailable — stay in global mode.
      })
      .finally(() => setSessionsLoading(false));
  }, []);

  const setActiveSession = useCallback((session: CampSession | null) => {
    setActiveSessionState(session);
    try {
      if (session) {
        sessionStorage.setItem(STORAGE_KEY, String(session.id));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors.
    }
  }, []);

  return (
    <MedicalSessionContext.Provider value={{
      activeSession,
      activeSessionId: activeSession?.id,
      sessions,
      sessionsLoading,
      setActiveSession,
    }}>
      {children}
    </MedicalSessionContext.Provider>
  );
}

export function useMedicalSession(): MedicalSessionValue {
  const ctx = useContext(MedicalSessionContext);
  if (!ctx) {
    throw new Error('useMedicalSession must be used inside MedicalSessionProvider');
  }
  return ctx;
}
