/**
 * SessionWorkspaceContext.tsx
 *
 * Global session workspace state for admin and super-admin portals.
 *
 * A "session workspace" is the active camp session an admin is operating inside.
 * When a session is selected, pages like the camper directory and applications list
 * automatically scope their default data to that session.
 *
 * null currentSession = "Global Overview" mode — all sessions visible, no scoping.
 *
 * Persistence: the selected session ID is stored in localStorage under
 * 'cbg_session_workspace' so it survives page refreshes. On mount, the stored ID
 * is matched against the freshly-fetched sessions list; if the session is no longer
 * available (deleted or archived), the workspace silently resets to global mode.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSessions } from '@/features/admin/api/admin.api';
import type { CampSession } from '@/features/admin/types/admin.types';

const STORAGE_KEY = 'cbg_session_workspace';

export interface SessionWorkspaceValue {
  /** The currently selected session, or null for global overview mode. */
  currentSession: CampSession | null;
  /** True when currentSession is null — alias for clarity in conditional rendering. */
  isGlobalMode: boolean;
  /** All available sessions, loaded on provider mount. */
  sessions: CampSession[];
  sessionsLoading: boolean;
  /** True while the selector modal is open. */
  selectorOpen: boolean;
  setCurrentSession: (session: CampSession | null) => void;
  openSelector: () => void;
  closeSelector: () => void;
}

const SessionWorkspaceContext = createContext<SessionWorkspaceValue | null>(null);

export function SessionWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [currentSession, setCurrentSessionState] = useState<CampSession | null>(null);
  const [sessions, setSessions] = useState<CampSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);

  // Fetch all sessions on mount (per_page=100 to avoid pagination truncation).
  // After loading, rehydrate the active workspace from localStorage.
  useEffect(() => {
    getSessions({ per_page: 100 })
      .then((data) => {
        setSessions(data);
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as { sessionId: number | null };
            if (parsed.sessionId === null) {
              setCurrentSessionState(null);
            } else {
              // Only restore if the session still exists in the fetched list.
              const found = data.find((s) => s.id === parsed.sessionId);
              if (found) setCurrentSessionState(found);
            }
          }
        } catch {
          // Corrupt localStorage entry — silently start in global mode.
        }
      })
      .catch(() => {
        // Non-fatal: selector will show empty state, pages fall back to unscoped.
      })
      .finally(() => setSessionsLoading(false));
  }, []);

  const setCurrentSession = useCallback((session: CampSession | null) => {
    setCurrentSessionState(session);
    setSelectorOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId: session?.id ?? null }));
    } catch {
      // Ignore — localStorage might be unavailable in some environments.
    }
  }, []);

  const openSelector  = useCallback(() => setSelectorOpen(true),  []);
  const closeSelector = useCallback(() => setSelectorOpen(false), []);

  return (
    <SessionWorkspaceContext.Provider
      value={{
        currentSession,
        isGlobalMode: currentSession === null,
        sessions,
        sessionsLoading,
        selectorOpen,
        setCurrentSession,
        openSelector,
        closeSelector,
      }}
    >
      {children}
    </SessionWorkspaceContext.Provider>
  );
}

/**
 * Returns the session workspace context value, or null if called outside a provider.
 * Components in non-admin portals (applicant, medical) will receive null and can
 * simply skip any session-workspace-specific rendering.
 */
export function useSessionWorkspace(): SessionWorkspaceValue | null {
  return useContext(SessionWorkspaceContext);
}
