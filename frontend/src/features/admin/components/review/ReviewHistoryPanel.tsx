/**
 * ReviewHistoryPanel — shows the chronological document review event timeline
 * for an application on the admin review page.
 *
 * Fetches from GET /api/applications/{id}/review-history and renders a compact
 * timeline with action icons, performer names, and timestamps.
 */

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  CheckCircle, XCircle, Send, Eye, Clock, AlertCircle, RefreshCw,
  FileText, MessageSquare, ChevronDown, ChevronUp,
} from 'lucide-react';
import { axiosInstance } from '@/api/axios.config';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ReviewEvent {
  id: number;
  action: string;
  action_label: string;
  document_id: number | null;
  document_type: string | null;
  document_request_id: number | null;
  performed_by: { id: number; name: string } | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
}

interface ReviewHistoryMeta {
  application_id: number;
  reviewed_by: number | null;
  reviewed_at: string | null;
}

interface HistoryResponse {
  data: ReviewEvent[];
  meta: ReviewHistoryMeta;
}

// ── Icon helper ────────────────────────────────────────────────────────────────

function ActionIcon({ action }: { action: string }) {
  const cls = 'h-3.5 w-3.5 flex-shrink-0';
  switch (action) {
    // Document-level actions
    case 'approved':   return <CheckCircle className={cls} style={{ color: '#16a34a' }} />;
    case 'rejected':   return <XCircle className={cls} style={{ color: '#dc2626' }} />;
    case 'sent':       return <Send className={cls} style={{ color: '#2563eb' }} />;
    case 'viewed':     return <Eye className={cls} style={{ color: 'var(--muted-foreground)' }} />;
    case 'overdue':    return <AlertCircle className={cls} style={{ color: '#b45309' }} />;
    case 'resubmitted': return <RefreshCw className={cls} style={{ color: '#7c3aed' }} />;
    case 'requested':  return <FileText className={cls} style={{ color: 'var(--muted-foreground)' }} />;
    case 'note_added': return <MessageSquare className={cls} style={{ color: 'var(--muted-foreground)' }} />;
    // Application-level actions (Phase 5B)
    case 'review_started':          return <Eye className={cls} style={{ color: '#2563eb' }} />;
    case 'application_approved':    return <CheckCircle className={cls} style={{ color: '#16a34a' }} />;
    case 'application_rejected':    return <XCircle className={cls} style={{ color: '#dc2626' }} />;
    case 'application_waitlisted':  return <Clock className={cls} style={{ color: '#b45309' }} />;
    case 'application_cancelled':   return <XCircle className={cls} style={{ color: 'var(--muted-foreground)' }} />;
    case 'application_reopened':    return <RefreshCw className={cls} style={{ color: '#2563eb' }} />;
    default:           return <Clock className={cls} style={{ color: 'var(--muted-foreground)' }} />;
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

interface ReviewHistoryPanelProps {
  applicationId: number;
}

export function ReviewHistoryPanel({ applicationId }: ReviewHistoryPanelProps) {
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [meta, setMeta] = useState<ReviewHistoryMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    axiosInstance
      .get<HistoryResponse>(`/applications/${applicationId}/review-history`)
      .then((res) => {
        if (cancelled) return;
        setEvents(res.data.data ?? []);
        setMeta(res.data.meta ?? null);
      })
      .catch(() => { if (!cancelled) setEvents([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [applicationId]);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--glass-light)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:opacity-80 transition-opacity"
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Review History
        </span>
        <span className="flex items-center gap-1.5">
          {events.length > 0 && (
            <span
              className="text-xs rounded-full px-1.5 py-0.5 font-medium"
              style={{ background: 'var(--glass-medium)', color: 'var(--muted-foreground)' }}
            >
              {events.length}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          ) : (
            <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          )}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {/* Application review metadata */}
          {meta?.reviewed_at && (
            <div
              className="rounded-lg px-3 py-2 mb-3 text-xs"
              style={{ background: 'var(--glass-medium)', color: 'var(--muted-foreground)' }}
            >
              Last reviewed {format(new Date(meta.reviewed_at), 'MMM d, yyyy h:mm a')}
            </div>
          )}

          {loading && (
            <p className="text-xs py-2" style={{ color: 'var(--muted-foreground)' }}>
              Loading history…
            </p>
          )}

          {!loading && events.length === 0 && (
            <p className="text-xs py-2" style={{ color: 'var(--muted-foreground)' }}>
              No review events recorded yet.
            </p>
          )}

          {/* Timeline */}
          {!loading && events.length > 0 && (
            <ol className="space-y-3">
              {events.map((event) => (
                <li key={event.id} className="flex gap-2.5">
                  <div className="mt-0.5">
                    <ActionIcon action={event.action} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug" style={{ color: 'var(--foreground)' }}>
                      <span className="font-medium">{event.action_label}</span>
                      {event.document_type && (
                        <span style={{ color: 'var(--muted-foreground)' }}>
                          {' — '}{event.document_type}
                        </span>
                      )}
                    </p>
                    {event.reason && (
                      <p className="text-xs mt-0.5 italic" style={{ color: 'var(--muted-foreground)' }}>
                        &ldquo;{event.reason}&rdquo;
                      </p>
                    )}
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {event.performed_by ? event.performed_by.name : 'System'}
                      {' · '}
                      {format(new Date(event.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
