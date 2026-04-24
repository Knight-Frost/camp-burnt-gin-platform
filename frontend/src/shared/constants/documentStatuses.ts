/**
 * Unified document status vocabulary.
 *
 * The backend stores two distinct state fields that describe the same
 * user-visible lifecycle from different angles:
 *
 *   - DocumentRequest.status (awaiting_upload | uploaded | scanning |
 *     under_review | approved | rejected | overdue)
 *       Tracks the lifecycle of an admin's *ask* for a document.
 *
 *   - Document.verification_status (pending | approved | rejected) combined
 *     with submitted_at (null vs. set) and scan_passed (null | true | false)
 *       Tracks the lifecycle of an actual *file* the applicant uploaded.
 *
 * The UI needs ONE vocabulary that reviewers and applicants both understand
 * per camper × required type. Split vocabularies are the reason reviewer
 * pages say "Pending Review" while the control center says "Uploaded" for
 * the same thing — same bit, different word. This module resolves any
 * combination of request + document to a single `DocumentUIStatus` so every
 * page reads from the same source of truth.
 *
 * Do not add statuses outside the 8-state set without updating both
 * applicant and admin vocabularies together.
 */

import type { FC } from 'react';
import {
  AlertCircle, CheckCircle, Clock, Eye, FileText, RefreshCw, Send, XCircle,
} from 'lucide-react';

// ── Canonical 8-state vocabulary ──────────────────────────────────────────────

export type DocumentUIStatus =
  | 'missing'        // Required type, nothing uploaded or requested. Computed absence.
  | 'requested'      // Admin created a request; applicant hasn't uploaded yet. Not overdue.
  | 'draft'          // Applicant uploaded but has not sent to staff. Hidden from admin queue.
  | 'submitted'      // Applicant sent. Visible to admin. Not yet claimed for review.
  | 'under_review'   // Admin has picked it up; reviewing in progress.
  | 'approved'       // Admin approved. Terminal until superseded by a newer upload.
  | 'rejected'       // Admin rejected. Applicant must resubmit. Not terminal.
  | 'overdue';       // Request past due date without upload. Request-only state.

export const DOCUMENT_UI_STATUSES: readonly DocumentUIStatus[] = [
  'missing', 'requested', 'draft', 'submitted',
  'under_review', 'approved', 'rejected', 'overdue',
] as const;

// ── Adapter inputs ────────────────────────────────────────────────────────────

/**
 * Minimal shape of a DocumentRequest record the resolver needs. Pages can
 * pass their own fuller type so long as these fields line up with the
 * backend enum values.
 */
export interface DocumentRequestLike {
  status:
    | 'awaiting_upload' | 'uploaded' | 'scanning'
    | 'under_review'    | 'approved' | 'rejected' | 'overdue';
  due_date?: string | null;
  is_overdue?: boolean;
}

/**
 * Minimal shape of a Document record the resolver needs.
 */
export interface DocumentLike {
  verification_status?: 'pending' | 'approved' | 'rejected' | null;
  submitted_at?: string | null;
}

// ── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Resolve a UI status from any combination of request/document input.
 *
 * Precedence (highest → lowest):
 *   1. Explicit overdue on request           → 'overdue'
 *   2. Document.verification_status terminal → 'approved' | 'rejected'
 *   3. Request.status terminal               → 'approved' | 'rejected'
 *   4. Document submitted but not reviewed   → 'submitted' | 'under_review'
 *   5. Document exists but not submitted     → 'draft'
 *   6. Request exists, no document           → 'requested' | 'overdue'
 *   7. Neither                               → 'missing'
 */
export function resolveDocumentStatus(input: {
  request?: DocumentRequestLike | null;
  document?: DocumentLike | null;
}): DocumentUIStatus {
  const { request, document } = input;

  // Terminal document decisions always win.
  if (document?.verification_status === 'approved') return 'approved';
  if (document?.verification_status === 'rejected') return 'rejected';

  // Request-overdue only matters if no terminal document decision above.
  if (request?.is_overdue || request?.status === 'overdue') return 'overdue';

  // Terminal request decisions (when there's no document yet, or an older one).
  if (request?.status === 'approved') return 'approved';
  if (request?.status === 'rejected') return 'rejected';

  // Document exists — map its submission + review state.
  if (document) {
    if (!document.submitted_at) return 'draft';
    if (request?.status === 'under_review') return 'under_review';
    if (document.verification_status === 'pending') return 'submitted';
    return 'submitted';
  }

  // Only a request exists (no document yet).
  if (request) {
    if (request.status === 'under_review') return 'under_review';
    return 'requested';
  }

  return 'missing';
}

// ── Display metadata ──────────────────────────────────────────────────────────

export interface StatusMeta {
  /** Fallback English label — pages should prefer i18n (admin_extra.status_*). */
  label: string;
  /** Text color, theme-aware CSS variable or hex. */
  color: string;
  /** Background fill for pill/badge. */
  bg: string;
  /** Lucide icon component rendered next to the label. */
  icon: FC<{ className?: string }>;
  /** Whether the status indicates "needs the applicant to act". */
  needsApplicantAction: boolean;
  /** Whether the status indicates "needs reviewer to act". */
  needsReviewerAction: boolean;
}

export const DOCUMENT_STATUS_META: Record<DocumentUIStatus, StatusMeta> = {
  missing: {
    label: 'Missing',
    color: '#6b7280',
    bg: 'rgba(107,114,128,0.12)',
    icon: FileText,
    needsApplicantAction: true,
    needsReviewerAction: false,
  },
  requested: {
    label: 'Requested',
    color: '#b45309',
    bg: 'rgba(245,158,11,0.12)',
    icon: Send,
    needsApplicantAction: true,
    needsReviewerAction: false,
  },
  draft: {
    label: 'Draft',
    color: '#4b5563',
    bg: 'rgba(107,114,128,0.10)',
    icon: Clock,
    needsApplicantAction: true,
    needsReviewerAction: false,
  },
  submitted: {
    label: 'Submitted',
    color: '#1d4ed8',
    bg: 'rgba(59,130,246,0.12)',
    icon: RefreshCw,
    needsApplicantAction: false,
    needsReviewerAction: true,
  },
  under_review: {
    label: 'Under Review',
    color: '#a16207',
    bg: 'rgba(234,179,8,0.12)',
    icon: Eye,
    needsApplicantAction: false,
    needsReviewerAction: true,
  },
  approved: {
    label: 'Approved',
    color: 'var(--forest-green)',
    bg: 'rgba(5,150,105,0.10)',
    icon: CheckCircle,
    needsApplicantAction: false,
    needsReviewerAction: false,
  },
  rejected: {
    label: 'Rejected',
    color: '#dc2626',
    bg: 'rgba(239,68,68,0.12)',
    icon: XCircle,
    needsApplicantAction: true,
    needsReviewerAction: false,
  },
  overdue: {
    label: 'Overdue',
    color: '#dc2626',
    bg: 'rgba(239,68,68,0.12)',
    icon: AlertCircle,
    needsApplicantAction: true,
    needsReviewerAction: true,
  },
};

/**
 * i18n key for a given status. Pages pass this to t() with the English
 * fallback from DOCUMENT_STATUS_META so untranslated locales still render.
 */
export function statusI18nKey(status: DocumentUIStatus): string {
  return `admin_extra.status_${status}`;
}

/**
 * Convenience: backend DocumentRequest.status → UI status when there's
 * no corresponding Document. Used by the control center when rendering
 * a pure-request row.
 */
export function mapRequestStatus(
  status: DocumentRequestLike['status'],
  isOverdue = false,
): DocumentUIStatus {
  if (isOverdue || status === 'overdue') return 'overdue';
  switch (status) {
    case 'awaiting_upload': return 'requested';
    case 'uploaded':        return 'submitted';
    case 'scanning':        return 'submitted';
    case 'under_review':    return 'under_review';
    case 'approved':        return 'approved';
    case 'rejected':        return 'rejected';
  }
}
