/**
 * CollapsibleDocumentCard — reusable collapsible card for any document type
 * on the admin review workstation.
 *
 * Used for: paper application packets, required supporting docs, uploaded docs,
 * medical/provider docs. Same component, different props.
 *
 * Decision D6: free-form multi-open (each card owns its own isOpen state).
 * Pass initiallyOpen=true to start expanded; default is collapsed.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  ChevronDown, ChevronUp, Download, ExternalLink,
  CheckCircle, XCircle, Clock, AlertCircle, Eye,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

export type DocumentCardStatus =
  | 'missing'
  | 'requested'
  | 'awaiting_upload'
  | 'uploaded'
  | 'sent'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'overdue';

export interface DocumentCardProps {
  /** Visible title for the card header (e.g. "Immunization Record"). */
  title: string;
  /** Optional file name shown in subheader when a file is attached. */
  fileName?: string;
  /** Display status that drives the badge color and text. */
  status: DocumentCardStatus;
  /** If provided, shows "Uploaded by X on date" metadata. */
  uploadedBy?: string;
  uploadedAt?: string;
  /** If provided, shows "Reviewed by X on date" metadata. */
  reviewedBy?: string;
  reviewedAt?: string;
  /** If provided, shows "Requested by X on date" metadata. */
  requestedBy?: string;
  requestedAt?: string;
  /** Due date for request-based cards. */
  dueDate?: string;
  /** Rejection reason if status is rejected. */
  rejectionReason?: string;
  /** Whether this card starts expanded. Defaults to false (collapsed). */
  initiallyOpen?: boolean;
  /** Whether the current user can approve/reject. */
  canReview?: boolean;
  /** Whether an action is currently in-flight (disables buttons). */
  actionsDisabled?: boolean;
  /** Whether there's a "new" badge (recently submitted, unseen). */
  isNew?: boolean;
  /** Inline content shown when card is expanded (e.g. PDF iframe). */
  children?: React.ReactNode;
  /** Action callbacks. */
  onApprove?: () => void;
  onReject?: () => void;
  onDownload?: () => void;
  onOpenInTab?: () => void;
  onPreview?: () => void;
}

// ── Status display config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DocumentCardStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  missing: {
    label: 'Missing',
    color: '#6b7280',
    bg: 'rgba(107,114,128,0.1)',
    icon: <Clock className="h-3 w-3" />,
  },
  requested: {
    label: 'Requested',
    color: '#b45309',
    bg: 'rgba(180,83,9,0.1)',
    icon: <Clock className="h-3 w-3" />,
  },
  awaiting_upload: {
    label: 'Awaiting Upload',
    color: '#b45309',
    bg: 'rgba(180,83,9,0.1)',
    icon: <Clock className="h-3 w-3" />,
  },
  uploaded: {
    label: 'Uploaded',
    color: '#2563eb',
    bg: 'rgba(37,99,235,0.1)',
    icon: <Eye className="h-3 w-3" />,
  },
  sent: {
    label: 'Received · Awaiting Review',
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.1)',
    icon: <Eye className="h-3 w-3" />,
  },
  under_review: {
    label: 'Under Review',
    color: '#2563eb',
    bg: 'rgba(37,99,235,0.1)',
    icon: <Eye className="h-3 w-3" />,
  },
  approved: {
    label: 'Approved',
    color: '#16a34a',
    bg: 'rgba(22,163,74,0.1)',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  rejected: {
    label: 'Rejected · Resubmission Needed',
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.1)',
    icon: <XCircle className="h-3 w-3" />,
  },
  overdue: {
    label: 'Overdue',
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.1)',
    icon: <AlertCircle className="h-3 w-3" />,
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export function CollapsibleDocumentCard({
  title,
  fileName,
  status,
  uploadedBy,
  uploadedAt,
  reviewedBy,
  reviewedAt,
  requestedBy,
  requestedAt,
  dueDate,
  rejectionReason,
  initiallyOpen = false,
  canReview = false,
  actionsDisabled = false,
  isNew = false,
  children,
  onApprove,
  onReject,
  onDownload,
  onOpenInTab,
  onPreview,
}: DocumentCardProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const { label, color, bg, icon } = STATUS_CONFIG[status];

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', background: 'var(--glass-light)' }}
    >
      {/* Header row — always visible */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Toggle */}
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="flex-1 flex items-center gap-3 min-w-0 text-left"
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          ) : (
            <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                {title}
              </span>
              {isNew && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(37,99,235,0.15)', color: '#2563eb' }}
                >
                  New
                </span>
              )}
            </div>
            {fileName && (
              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {fileName}
              </p>
            )}
          </div>
        </button>

        {/* Status badge */}
        <span
          className="flex-shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
          style={{ background: bg, color }}
        >
          {icon}
          {label}
        </span>

        {/* Quick actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onPreview && (
            <button
              type="button"
              onClick={onPreview}
              disabled={actionsDisabled}
              title="Preview"
              className="p-1.5 rounded-lg hover:opacity-70 transition-opacity disabled:opacity-40"
            >
              <Eye className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
            </button>
          )}
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              disabled={actionsDisabled}
              title="Download"
              className="p-1.5 rounded-lg hover:opacity-70 transition-opacity disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
            </button>
          )}
          {onOpenInTab && (
            <button
              type="button"
              onClick={onOpenInTab}
              disabled={actionsDisabled}
              title="Open in new tab"
              className="p-1.5 rounded-lg hover:opacity-70 transition-opacity disabled:opacity-40"
            >
              <ExternalLink className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {isOpen && (
        <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: 'var(--border)' }}>
          {/* Metadata row */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {uploadedBy && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Uploaded by</dt>
                <dd style={{ color: 'var(--foreground)' }}>
                  {uploadedBy}
                  {uploadedAt && (
                    <span style={{ color: 'var(--muted-foreground)' }}>
                      {' '}· {format(new Date(uploadedAt), 'MMM d, yyyy')}
                    </span>
                  )}
                </dd>
              </>
            )}
            {requestedBy && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Requested by</dt>
                <dd style={{ color: 'var(--foreground)' }}>
                  {requestedBy}
                  {requestedAt && (
                    <span style={{ color: 'var(--muted-foreground)' }}>
                      {' '}· {format(new Date(requestedAt), 'MMM d, yyyy')}
                    </span>
                  )}
                </dd>
              </>
            )}
            {reviewedBy && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Reviewed by</dt>
                <dd style={{ color: 'var(--foreground)' }}>
                  {reviewedBy}
                  {reviewedAt && (
                    <span style={{ color: 'var(--muted-foreground)' }}>
                      {' '}· {format(new Date(reviewedAt), 'MMM d, yyyy')}
                    </span>
                  )}
                </dd>
              </>
            )}
            {dueDate && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Due date</dt>
                <dd style={{ color: 'var(--foreground)' }}>
                  {format(new Date(dueDate), 'MMM d, yyyy')}
                </dd>
              </>
            )}
          </dl>

          {/* Rejection reason — shown for 'rejected' and for D4-reopened requests
              ('requested' status with a reason means it was rejected and is awaiting resubmission) */}
          {rejectionReason && (status === 'rejected' || status === 'requested') && (
            <div
              className="rounded-lg px-3 py-2 text-xs"
              style={{ background: 'rgba(220,38,38,0.06)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }}
            >
              <strong>Previous rejection reason:</strong> {rejectionReason}
            </div>
          )}

          {/* Inline content (e.g. PDF iframe, image preview) */}
          {children}

          {/* Review actions */}
          {canReview && (status === 'sent' || status === 'under_review' || status === 'uploaded') && (
            <div className="flex gap-2 pt-1">
              {onApprove && (
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={actionsDisabled}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.25)' }}
                >
                  Approve
                </button>
              )}
              {onReject && (
                <button
                  type="button"
                  onClick={onReject}
                  disabled={actionsDisabled}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }}
                >
                  Reject
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
