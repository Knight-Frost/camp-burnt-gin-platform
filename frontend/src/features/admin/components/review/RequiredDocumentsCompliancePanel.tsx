/**
 * RequiredDocumentsCompliancePanel — authoritative "what does this camper
 * still need?" view for reviewers.
 *
 * Reads getCamperComplianceStatus which runs the backend
 * SpecialNeedsRiskAssessmentService + DocumentEnforcementService logic. That
 * means the list of required documents always matches exactly what the
 * approval gate will check — the reviewer is never surprised by a "still
 * missing X" block at approval time.
 *
 * Each row resolves to one of the 8-state UI statuses using
 * DOCUMENT_STATUS_META-backed wording. A progress summary at the top ("2 of
 * 3 required documents verified") is the single counter the reviewer looks
 * at to answer "can I approve yet?".
 *
 * Refresh contract: parent component passes `refreshKey`. Any time it
 * changes (typically after a verify/reject action elsewhere on the page),
 * this panel refetches. That way the missing → approved transition happens
 * the same tick as the action, with no manual page reload.
 */

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import {
  getCamperComplianceStatus,
  type CamperComplianceStatus,
} from '@/features/admin/api/admin.api';
import { DocumentStatusBadge } from '@/ui/components/DocumentStatusBadge';
import { getDocumentLabel } from '@/shared/constants/documentRequirements';
import type { DocumentUIStatus } from '@/shared/constants/documentStatuses';

interface Props {
  camperId: number;
  /**
   * Changing this value forces a refetch. Parent increments it after any
   * action that could change document compliance (verify/reject/new upload
   * arriving). The absence of a changing key is not an error — the panel
   * still renders its last-known state.
   */
  refreshKey?: number;
}

export function RequiredDocumentsCompliancePanel({ camperId, refreshKey = 0 }: Props) {
  const [status,  setStatus]  = useState<CamperComplianceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    getCamperComplianceStatus(camperId)
      .then(setStatus)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [camperId]);

  useEffect(load, [load, refreshKey]);

  // Resolve a single required-type to a UI status based on which bucket the
  // compliance service placed it in. Precedence: expired > unverified >
  // missing > approved. Matches the order the admin would expect to act in.
  const resolveStatus = (type: string): DocumentUIStatus => {
    if (!status) return 'missing';
    if (status.expired_documents.some((d) => d.document_type === type)) return 'rejected';
    if (status.unverified_documents.some((d) => d.document_type === type)) return 'submitted';
    if (status.missing_documents.some((d) => d.document_type === type)) return 'missing';
    return 'approved';
  };

  const total = status?.required_documents.length ?? 0;
  const approved = (status?.required_documents ?? []).filter(
    (d) => resolveStatus(d.document_type) === 'approved',
  ).length;
  const progress = total === 0 ? 0 : Math.round((approved / total) * 100);

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
          Required Documents
        </span>
        <span className="flex items-center gap-1.5">
          {total > 0 && (
            <span
              className="text-xs rounded-full px-1.5 py-0.5 font-medium"
              style={{
                background: approved === total ? 'rgba(22,163,74,0.12)' : 'var(--glass-medium)',
                color: approved === total ? '#166534' : 'var(--muted-foreground)',
              }}
            >
              {approved} / {total}
            </span>
          )}
          {expanded
            ? <ChevronUp className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
            : <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {loading && (
            <p className="text-xs py-2" style={{ color: 'var(--muted-foreground)' }}>
              Loading compliance status…
            </p>
          )}
          {error && (
            <p className="text-xs py-2" style={{ color: '#dc2626' }}>
              Could not load compliance status.
            </p>
          )}
          {!loading && !error && status && (
            <>
              {/* Progress bar — the reviewer's single-glance summary. */}
              {total > 0 && (
                <div className="mb-3">
                  <div
                    className="w-full h-1.5 rounded-full"
                    style={{ background: 'var(--border)' }}
                  >
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                        background: approved === total ? '#166534' : 'var(--ember-orange)',
                      }}
                    />
                  </div>
                </div>
              )}
              {total === 0 && (
                <p className="text-xs py-2" style={{ color: 'var(--muted-foreground)' }}>
                  No documents are required for this camper's profile.
                </p>
              )}
              <ul className="space-y-2">
                {status.required_documents.map((doc) => {
                  const resolved = resolveStatus(doc.document_type);
                  return (
                    <li
                      key={doc.document_type}
                      className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2"
                      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-xs font-medium truncate"
                          style={{ color: 'var(--foreground)' }}
                        >
                          {getDocumentLabel(doc.document_type, 'admin')}
                        </p>
                        {doc.is_mandatory && (
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            {doc.description}
                          </p>
                        )}
                      </div>
                      <DocumentStatusBadge status={resolved} />
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
