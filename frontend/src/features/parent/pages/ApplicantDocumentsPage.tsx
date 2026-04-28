/**
 * ApplicantDocumentsPage.tsx
 *
 * Purpose: Document management for applicants — a unified task-based system.
 *
 * Architecture:
 *   - UnifiedTask: normalized view over DocumentRequestRecord + RequiredDocument.
 *     Both data sources map to a single task interface sorted by urgency.
 *   - TaskCard: fully self-contained card per task, including its own file input
 *     ref. Upload happens in-card — no separate upload section for tasks.
 *   - Four states per task: not_started → rejected → waiting → completed.
 *   - "Staged" is a client-only sub-state of not_started: file selected, not yet
 *     submitted. This is the honest local analog of "in progress."
 *   - Progress bar covers all unified tasks at the top of the task section.
 *   - Supplementary UploadArea remains below for general (non-required) docs.
 *   - PreviewModal: inline image / PDF iframe / open-in-tab fallback.
 *   - SendDocumentModal: notify admin via inbox conversation thread.
 */

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Eye,
  X,
  File,
  Send,
  Download,
  Clock,
  CheckCircle,
  AlertTriangle,
  ClipboardList,
} from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

import {
  getDocuments,
  uploadDocument,
  submitDocument,
  getRequiredDocuments,
  submitCompletedDocument,
  getDocumentRequests,
  uploadDocumentRequest,
  submitDocumentRequest,
  getCampers,
  type Document,
  type RequiredDocument,
  type DocumentRequestRecord,
} from '@/features/parent/api/applicant.api';
import type { Camper } from '@/shared/types';
import { DocumentStatusBadge } from '@/ui/components/DocumentStatusBadge';
import { resolveDocumentStatus, type DocumentUIStatus } from '@/shared/constants/documentStatuses';
import {
  getDocumentLabel,
} from '@/shared/constants/documentRequirements';
import {
  searchInboxUsers,
  createConversation,
  sendMessage,
  type ConversationParticipant,
} from '@/features/messaging/api/messaging.api';
import { Button } from '@/ui/components/Button';
import { EmptyState } from '@/ui/components/EmptyState';
import { SkeletonTable } from '@/ui/components/Skeletons';
import axiosInstance from '@/api/axios.config';
import { ROLE_LABELS, type RoleName } from '@/shared/constants/roles';

// File types accepted by the hidden <input> and the drag-and-drop zone
const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp';


// PDF icon is red (conventional); all other file types get a blue generic icon
function FileIcon({ mime }: { mime: string }) {
  const isPdf = mime === 'application/pdf';
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: isPdf ? 'rgba(239,68,68,0.10)' : 'rgba(96,165,250,0.10)' }}
    >
      {isPdf
        ? <FileText className="h-4 w-4" style={{ color: '#ef4444' }} />
        : <File className="h-4 w-4" style={{ color: 'var(--night-sky-blue)' }} />
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// PreviewModal — renders an image, PDF iframe, or a "can't preview" fallback
// ---------------------------------------------------------------------------

function PreviewModal({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const isImage = doc.mime_type.startsWith('image/');
  const isPdf   = doc.mime_type === 'application/pdf';

  // Document URLs are authenticated API routes — `<img src>` and
  // `<iframe src>` cannot send the bearer token, so they 401 silently and
  // the modal renders blank. Fetch the bytes via axios (which carries the
  // token) into an object URL the browser can render directly. Revoke the
  // URL on unmount to avoid a memory leak. This also fixes the broken
  // Download anchor — the `download` attribute is gated on a same-origin
  // href; an object URL counts as same-origin.
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let revoked = false;
    let createdUrl: string | null = null;
    setLoadError(false);
    setBlobUrl(null);
    axiosInstance
      .get(doc.url, { responseType: 'blob' })
      .then((res) => {
        if (revoked) return;
        createdUrl = URL.createObjectURL(res.data as Blob);
        setBlobUrl(createdUrl);
      })
      .catch(() => { if (!revoked) setLoadError(true); });
    return () => {
      revoked = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [doc.url]);

  const previewSrc = blobUrl ?? '';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Close"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
      <div
        role="presentation"
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--card)', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header: filename + close + download */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
            {doc.file_name}
          </span>
          <div className="flex items-center gap-1">
            <a
              href={blobUrl ?? '#'}
              download={doc.file_name}
              aria-disabled={!blobUrl}
              onClick={(e) => { if (!blobUrl) e.preventDefault(); }}
              className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
              style={{ opacity: blobUrl ? 1 : 0.4 }}
              title="Download"
            >
              <Download className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
            >
              <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </div>
        </div>
        <div className="overflow-auto" style={{ maxHeight: 'calc(90vh - 56px)' }}>
          {!blobUrl && !loadError && (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
            </div>
          )}
          {loadError && (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm" style={{ color: 'var(--destructive)' }}>
                We couldn't load this document. Please try again or contact camp staff.
              </p>
            </div>
          )}
          {blobUrl && isImage && (
            <img
              src={previewSrc}
              alt={doc.file_name}
              className="w-full h-auto object-contain"
            />
          )}
          {blobUrl && isPdf && (
            <iframe
              src={previewSrc}
              title={doc.file_name}
              className="w-full border-0"
              style={{ height: '75vh' }}
            />
          )}
          {blobUrl && !isImage && !isPdf && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <FileText className="h-12 w-12" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Preview not available for this file type.
              </p>
              <a
                href={blobUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium hover:underline"
                style={{ color: 'var(--ember-orange)' }}
              >
                Open in new tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SendDocumentModal — notify an admin about a specific document via inbox
// ---------------------------------------------------------------------------

function SendDocumentModal({
  doc,
  onClose,
  onSent,
}: {
  doc: Document;
  onClose: () => void;
  /**
   * Fires with the document id after the message send succeeds. The
   * parent page uses this to drop the doc from the "Ready to Send" list
   * — the server-side sent_at stamp is the source of truth, but removing
   * it locally avoids a re-fetch round-trip and keeps the UI snappy.
   */
  onSent?: (docId: number) => void;
}) {
  const [admins, setAdmins]               = useState<ConversationParticipant[]>([]);
  const [selectedId, setSelectedId]       = useState<number | null>(null);
  // Plain natural message. The filename and file type used to be crammed into
  // the body as "Document: X / Type: Y" — a fake attachment. The actual file
  // is now linked server-side via attached_document_ids, so the admin sees
  // it as a real attachment card in their inbox. Nothing to embed in text.
  const [message, setMessage]             = useState(
    "Hi, I'm sharing a document with you. Please let me know if you need anything else."
  );
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [sending, setSending]             = useState(false);

  useEffect(() => {
    searchInboxUsers('')
      .then((users) => {
        setAdmins(users);
        if (users.length > 0) setSelectedId(users[0].id);
      })
      .catch(() => toast.error('Could not load admin recipients.'))
      .finally(() => setLoadingAdmins(false));
  }, []);

  async function handleSend() {
    if (!selectedId || !message.trim()) return;
    setSending(true);
    try {
      const conv = await createConversation({
        subject: `Document: ${doc.file_name}`,
        participant_ids: [selectedId],
        category: 'general',
      });
      // Phase 2: the Document is linked to the message via the server-side
      // message_document_links pivot. The admin's inbox renders it as a
      // real attachment, not body text. The service also stamps sent_at
      // on the Document so it drops off the applicant's Ready-to-Send list.
      await sendMessage(
        conv.id,
        message.trim(),
        undefined, // no inline file uploads — the doc already exists
        undefined, // no explicit TO/CC/BCC — single admin recipient is implicit
        undefined, // idempotency key auto-generated
        [doc.id],  // attach the referenced document via its existing id
      );
      toast.success('Document sent to admin.');
      onSent?.(doc.id);
      onClose();
    } catch {
      toast.error('Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Close"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
      <div
        role="presentation"
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--card)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Send document to admin
            </p>
            <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
              {doc.file_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
          >
            <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="send-doc-recipient" className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Send to
            </label>
            {loadingAdmins ? (
              <div className="h-9 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
            ) : admins.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No admin recipients available.</p>
            ) : (
              <select
                id="send-doc-recipient"
                value={selectedId ?? ''}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                className="rounded-lg px-3 py-2 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
                style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({ROLE_LABELS[a.role as RoleName] ?? a.role})</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="send-doc-message" className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Message
            </label>
            <textarea
              id="send-doc-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded-lg px-3 py-2.5 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)] resize-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
        </div>
        <div
          className="flex items-center justify-end gap-3 px-5 py-4 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!selectedId || !message.trim() || sending || loadingAdmins || admins.length === 0}
            loading={sending}
            onClick={() => void handleSend()}
            className="flex items-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UploadArea — supplementary drag-and-drop for general (non-required) docs
// ---------------------------------------------------------------------------

function UploadArea({
  onUpload,
  uploading,
}: {
  onUpload: (file: File, documentType: string) => Promise<void>;
  uploading: boolean;
}) {
  const inputRef              = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('');
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    if (!docType.trim()) {
      toast.error('Please enter a document type before uploading.');
      return;
    }
    await onUpload(file, docType.trim());
    setDocType('');
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div
      className="rounded-2xl border p-6 flex flex-col gap-4"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Upload additional document</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          For documents not listed above — PDF, JPG, or PNG · Max 10 MB
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Document type (e.g. Insurance Card, ID)"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2.5 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        />
      </div>
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors"
        style={{
          borderColor: dragging ? 'var(--ember-orange)' : 'var(--border)',
          background: dragging ? 'rgba(22,101,52,0.04)' : 'var(--dash-bg)',
        }}
      >
        <Upload className="h-6 w-6" style={{ color: 'var(--muted-foreground)' }} />
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Drag & drop or <span style={{ color: 'var(--ember-orange)' }}>browse</span>
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPTED_TYPES}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {uploading && (
        <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>Uploading…</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unified task system — normalizes DocumentRequestRecord + RequiredDocument
// ---------------------------------------------------------------------------

// Five states a task can be in from the applicant's perspective
type TaskStatus = 'not_started' | 'rejected' | 'uploaded' | 'waiting' | 'completed';

// Sort order: most urgent first
const TASK_STATUS_ORDER: Record<TaskStatus, number> = {
  not_started: 0,
  rejected: 1,
  uploaded: 2,    // file on server, awaiting applicant submit action
  waiting: 3,
  completed: 4,
};

interface UnifiedTask {
  // Stable key for React reconciliation and staged-file map
  key: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  isRequired: boolean;
  isOverdue: boolean;
  dueDate: string | null;
  requestedBy: string | null;
  requestedAt: string | null;
  rejectionReason: string | null;
  // Filename of an already-uploaded response (shown in waiting/completed states)
  uploadedFileName: string | null;
  // ISO timestamp of when the applicant uploaded their response file
  uploadedAt: string | null;
  // Matched Document from the uploads list: enables the inline View button
  linkedDoc: Document | null;
  // Whether this task has an admin-provided blank form to download first
  canDownload: boolean;
  // Source discriminator for routing submit calls to the right API
  source: 'doc_request' | 'required_doc';
  sourceId: number;
  // Camper display name: only populated when the account has 2+ campers
  camperName: string | null;
}

// Map a DocumentRequestRecord → UnifiedTask
// camperName: pre-resolved display name for the linked camper (null for single-camper accounts)
function fromDocRequest(req: DocumentRequestRecord, documents: Document[], camperName: string | null = null): UnifiedTask {
  const status: TaskStatus =
    req.status === 'approved'                               ? 'completed'   :
    req.status === 'rejected'                               ? 'rejected'    :
    req.status === 'awaiting_upload' || req.status === 'overdue' ? 'not_started' :
    req.status === 'uploaded'                               ? 'uploaded'    :
    'waiting'; // scanning | under_review

  // Scope by camper_id to prevent cross-camper document leakage in multi-camper families
  const linkedDoc = documents.find(
    (d) =>
      d.document_type.toLowerCase() === req.document_type.toLowerCase() &&
      (d.camper_id === req.camper_id || d.camper_id == null),
  ) ?? null;

  return {
    key: `req-${req.id}`,
    title: getDocumentLabel(req.document_type, 'applicant'),
    description: req.instructions,
    status,
    isRequired: true,
    isOverdue: req.status === 'overdue',
    dueDate: req.due_date,
    requestedBy: req.requested_by_name,
    requestedAt: req.created_at,
    rejectionReason: req.rejection_reason,
    uploadedFileName: req.uploaded_file_name,
    uploadedAt: req.uploaded_at,
    linkedDoc,
    canDownload: false,
    source: 'doc_request',
    sourceId: req.id,
    camperName,
  };
}

// Map a RequiredDocument → UnifiedTask
function fromRequiredDoc(doc: RequiredDocument, _documents: Document[]): UnifiedTask {
  const status: TaskStatus =
    doc.status === 'reviewed'  ? 'completed'   :
    doc.status === 'submitted' ? 'waiting'     :
    'not_started'; // pending

  return {
    key: `rdoc-${doc.id}`,
    title: doc.original_file_name,
    description: doc.instructions,
    status,
    isRequired: true,
    isOverdue: false,
    dueDate: null,
    requestedBy: null,
    requestedAt: doc.created_at,
    rejectionReason: null,
    uploadedFileName: doc.submitted_file_name ?? null,
    uploadedAt: null,
    linkedDoc: null,
    canDownload: true, // admin provides a blank form via download_url
    source: 'required_doc',
    sourceId: doc.id,
    camperName: null,
  };
}

// ---------------------------------------------------------------------------
// TaskCard — self-contained card rendering one task in its current state.
//
// The file input ref lives inside this component so upload always happens
// in-place, adjacent to the task description — no page scrolling required.
// ---------------------------------------------------------------------------

interface TaskCardProps {
  task: UnifiedTask;
  stagedFile: File | null;      // local file selected but not yet uploaded (in-flight visual only)
  uploading: boolean;           // upload API call in progress
  submitting: boolean;          // submit API call in progress
  onFileSelected: (file: File) => void;  // triggers immediate upload
  onSubmit: () => void;         // submits already-uploaded file for review
  onDownload?: () => void;
  onViewDoc: (doc: Document) => void;
  onViewUploaded?: () => void;
  viewingUploaded?: boolean;
}

function TaskCard({
  task, stagedFile, uploading, submitting, onFileSelected, onSubmit, onDownload, onViewDoc,
  onViewUploaded, viewingUploaded,
}: TaskCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { status } = task;
  const needsUpload = status === 'not_started' || status === 'rejected';
  const needsSubmit = status === 'uploaded';

  const v = {
    not_started: {
      strip: '#f59e0b',
      iconBg: 'rgba(245,158,11,0.12)',
      iconColor: '#f59e0b',
      badgeBg: 'rgba(245,158,11,0.20)',
      badgeColor: '#92400e',
      label: 'Upload Required',
      border: 'rgba(245,158,11,0.45)',
      cardBg: 'rgba(253,230,138,0.04)',
    },
    rejected: {
      strip: '#ef4444',
      iconBg: 'rgba(239,68,68,0.12)',
      iconColor: '#ef4444',
      badgeBg: 'rgba(239,68,68,0.12)',
      badgeColor: '#dc2626',
      label: 'Action Required',
      border: 'rgba(239,68,68,0.45)',
      cardBg: 'rgba(254,202,202,0.06)',
    },
    uploaded: {
      strip: '#10b981',
      iconBg: 'rgba(16,185,129,0.12)',
      iconColor: '#10b981',
      badgeBg: 'rgba(16,185,129,0.12)',
      badgeColor: '#065f46',
      label: 'Ready to Submit',
      border: 'rgba(16,185,129,0.40)',
      cardBg: 'rgba(209,250,229,0.06)',
    },
    waiting: {
      strip: null as string | null,
      iconBg: 'rgba(59,130,246,0.10)',
      iconColor: '#3b82f6',
      badgeBg: 'rgba(59,130,246,0.10)',
      badgeColor: '#1d4ed8',
      label: 'Under Review',
      border: 'var(--border)',
      cardBg: 'var(--card)',
    },
    completed: {
      strip: null as string | null,
      iconBg: 'rgba(22,101,52,0.10)',
      iconColor: '#166534',
      badgeBg: 'rgba(22,101,52,0.10)',
      badgeColor: '#166534',
      label: 'Completed',
      border: 'var(--border)',
      cardBg: 'var(--card)',
    },
  }[status];

  const StateIcon = {
    not_started: Upload,
    rejected: AlertTriangle,
    uploaded: CheckCircle,
    waiting: Clock,
    completed: CheckCircle,
  }[status];

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: v.cardBg,
        borderColor: v.border,
        // Fade completed items so they recede and leave urgency to active tasks
        opacity: status === 'completed' ? 0.68 : 1,
      }}
    >
      {/* Urgency strip — only rendered when action is required */}
      {v.strip && <div className="h-1 w-full" style={{ background: v.strip }} />}

      <div className="p-5 flex flex-col gap-4">

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* State icon */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: v.iconBg }}
            >
              <StateIcon className="h-4 w-4" style={{ color: v.iconColor }} />
            </div>
            {/* Title + meta */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--foreground)' }}>
                  {task.title}
                </p>
                {task.isRequired && (
                  <span
                    className="inline-block px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                    style={{
                      background: 'rgba(239,68,68,0.10)',
                      color: '#dc2626',
                      fontSize: '9px',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Required
                  </span>
                )}
              </div>
              {task.requestedBy && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  Requested by camp staff
                  {task.requestedAt && ` · ${format(new Date(task.requestedAt), 'MMM d, yyyy')}`}
                  {task.camperName && ` · For ${task.camperName}`}
                </p>
              )}
              {!task.requestedBy && task.requestedAt && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  Sent {format(new Date(task.requestedAt), 'MMM d, yyyy')}
                  {task.camperName && ` · For ${task.camperName}`}
                </p>
              )}
            </div>
          </div>
          {/* Status pill — top-right, always visible */}
          <span
            className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 whitespace-nowrap"
            style={{ background: v.badgeBg, color: v.badgeColor }}
          >
            {v.label}
          </span>
        </div>

        {/* ── DESCRIPTION ────────────────────────────────────────────── */}
        {task.description && (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            {task.description}
          </p>
        )}

        {/* ── REJECTION REASON ───────────────────────────────────────── */}
        {task.rejectionReason && (
          <div
            className="rounded-xl px-3.5 py-3 text-xs leading-relaxed"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}
          >
            <span className="font-semibold">Why it was rejected: </span>
            {task.rejectionReason}
          </div>
        )}

        {/* ── DUE DATE ───────────────────────────────────────────────── */}
        {task.dueDate && (
          <p
            className="text-xs font-semibold"
            style={{ color: task.isOverdue ? '#dc2626' : '#b45309' }}
          >
            {task.isOverdue ? '⚠ Overdue — ' : 'Due '}
            {format(new Date(task.dueDate), 'MMMM d, yyyy')}
          </p>
        )}

        {/* ── ACTION ZONE ────────────────────────────────────────────── */}
        <div className="pt-3.5 border-t flex flex-col gap-2" style={{ borderColor: 'var(--border)' }}>

          {/* NOT STARTED / REJECTED: Upload Document (triggers real upload) + Submit (disabled) */}
          {needsUpload && (
            <div className="flex flex-col gap-2">
              {uploading && stagedFile && (
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Uploading <strong>{stagedFile.name}</strong>…
                </p>
              )}
              {!uploading && (
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Upload your file, then click <strong>Submit</strong> to send it to camp staff for review.
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {task.canDownload && onDownload && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDownload}
                    className="flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Form
                  </Button>
                )}
                {/* Upload Document: opens file picker; onChange triggers the upload API */}
                <Button
                  variant="primary"
                  size="sm"
                  disabled={uploading}
                  loading={uploading}
                  onClick={() => inputRef.current?.click()}
                  className="flex items-center gap-1.5 flex-shrink-0"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Document
                </Button>
                {/* Submit: disabled until upload succeeds and status becomes uploaded */}
                <Button
                  variant="primary"
                  size="sm"
                  disabled
                  className="flex items-center gap-1.5 flex-shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  Submit
                </Button>
              </div>
            </div>
          )}

          {/* UPLOADED: file confirmed on server; show filename + Change File + Submit (enabled) */}
          {needsSubmit && (
            <div className="flex flex-col gap-2">
              {/* Server-confirmed file pill */}
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: 'var(--dash-bg)', border: '1px solid rgba(16,185,129,0.35)' }}
              >
                <FileText className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#10b981' }} />
                <span className="text-xs truncate font-medium flex-1" style={{ color: 'var(--foreground)' }}>
                  {task.uploadedFileName ?? (stagedFile?.name ?? 'File uploaded')}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: '#10b981' }}>✓ Uploaded</span>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                File saved. Click <strong>Submit</strong> to send it to camp staff for review.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Change File: re-uploads, replacing the staged file */}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={uploading || submitting}
                  loading={uploading}
                  onClick={() => inputRef.current?.click()}
                  className="flex items-center gap-1.5 flex-shrink-0"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Change File
                </Button>
                {/* Submit: active now that a file is confirmed on the server */}
                <Button
                  variant="primary"
                  size="sm"
                  disabled={submitting || uploading}
                  loading={submitting}
                  onClick={onSubmit}
                  className="flex items-center gap-1.5 flex-shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  Submit
                </Button>
              </div>
            </div>
          )}

          {/* WAITING: file row + View; badge already says "Under Review", no duplicate label */}
          {status === 'waiting' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  {task.uploadedFileName && (
                    <>
                      <FileText className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                      <span className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                        {task.uploadedFileName}
                      </span>
                      {task.uploadedAt && (
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                          · Submitted {format(new Date(task.uploadedAt), 'MMM d, yyyy')}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Show View for doc_request tasks using the private download endpoint */}
                  {onViewUploaded && task.uploadedFileName && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={viewingUploaded}
                      loading={viewingUploaded}
                      onClick={onViewUploaded}
                      className="flex items-center gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                  )}
                  {/* Fallback: linkedDoc from documents list (required_doc tasks) */}
                  {!onViewUploaded && task.linkedDoc && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDoc(task.linkedDoc!)}
                      className="flex items-center gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                  )}
                </div>
              </div>
              {/* Wrong-file guidance: backend blocks re-upload while under review (canUpload() = false) */}
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Uploaded the wrong file? Contact camp staff via{' '}
                <span className="font-medium" style={{ color: 'var(--foreground)' }}>Inbox</span>{' '}
                to request a correction.
              </p>
            </div>
          )}

          {/* COMPLETED: green checkmark + optional View */}
          {status === 'completed' && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#166534' }}>
                <CheckCircle className="h-4 w-4" />
                Approved — no further action needed
              </div>
              {task.linkedDoc && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewDoc(task.linkedDoc!)}
                  className="flex items-center gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Button>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Hidden file input; accept matches backend mimes: pdf,jpg,jpeg,png,docx (no .doc, no .webp) */}
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.docx,.jpg,.jpeg,.png"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelected(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ApplicantDocumentsPage() {
  useTranslation(); // i18n hook kept for future label keys

  // ── API data ──────────────────────────────────────────────────────────────
  const [documents,        setDocuments]        = useState<Document[]>([]);
  const [requiredDocs,     setRequiredDocs]     = useState<RequiredDocument[]>([]);
  const [documentRequests, setDocumentRequests] = useState<DocumentRequestRecord[]>([]);
  const [campers,          setCampers]          = useState<Camper[]>([]);
  const [loading,          setLoading]          = useState(true);

  // ── Camper tab selection ──────────────────────────────────────────────────
  // null = "All campers" (the merged view). Persisted per-applicant in
  // localStorage so the last-selected child survives page reloads. For
  // single-camper families the tab strip is hidden and `activeCamperId` stays
  // null — tabs only appear when there are 2+ campers.
  const [activeCamperId, setActiveCamperIdRaw] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem('cbg_applicant_docs_active_camper');
    if (!stored || stored === 'all') return null;
    const n = Number(stored);
    return Number.isFinite(n) ? n : null;
  });
  const setActiveCamperId = (id: number | null) => {
    setActiveCamperIdRaw(id);
    try {
      window.localStorage.setItem('cbg_applicant_docs_active_camper', id === null ? 'all' : String(id));
    } catch {
      // localStorage may be unavailable (private mode). Tab persistence is a
      // nice-to-have — silently degrade rather than blow up the click handler.
    }
  };

  // ── Active application — required docs are linked to this application ─────
  // We prefer a submitted (non-draft) application; fall back to any draft.
  // Without an applicationId, required doc uploads would be orphaned (no
  // documentable association) and admin queries would not find them.
  // Required-document state is intentionally absent here. Required documents
  // live exclusively inside the ApplicationFormPage submission flow — see the
  // comment above the removed "Required Documents" section in the render.

  // ── General upload state (UploadArea — supplementary docs) ───────────────
  const [uploading, setUploading] = useState(false);

  // ── Modal state ───────────────────────────────────────────────────────────
  // Whichever Document is being previewed (from My Documents OR from a task card)
  const [preview, setPreview]   = useState<Document | null>(null);
  const [sendDoc, setSendDoc]   = useState<Document | null>(null);

  // ── My Documents list ─────────────────────────────────────────────────────

  // ── Unified task upload state ─────────────────────────────────────────────
  // Staged files: keyed by UnifiedTask.key; only populated while the upload API call is in-flight
  const [stagedTaskFiles,   setStagedTaskFiles]   = useState<Record<string, File>>({});
  const [uploadingTaskKey,  setUploadingTaskKey]  = useState<string | null>(null);
  const [submittingTaskKey, setSubmittingTaskKey] = useState<string | null>(null);
  // Track which doc_request is being fetched for preview
  const [viewingUploadedId, setViewingUploadedId] = useState<number | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  // Full load: shows skeleton. Used on mount and on tab-switch.
  const load = () => {
    setLoading(true);
    Promise.allSettled([getDocuments(), getRequiredDocuments(), getDocumentRequests(), getCampers()])
      .then(([docsResult, reqResult, docReqResult, campersResult]) => {
        if (docsResult.status === 'fulfilled') {
          setDocuments(docsResult.value);
        }
        if (reqResult.status === 'fulfilled') {
          setRequiredDocs(reqResult.value);
        }
        if (docReqResult.status === 'fulfilled') {
          const raw = docReqResult.value;
          setDocumentRequests(Array.isArray(raw) ? raw : []);
        } else {
          toast.error(`Could not load document requests: ${(docReqResult.reason as { message?: string })?.message ?? 'Unknown error'}`);
        }
        if (campersResult.status === 'fulfilled') {
          const loadedCampers = campersResult.value;
          setCampers(loadedCampers);
          if (loadedCampers.length <= 1) {
            setActiveCamperId(null);
          }
        }
      })
      .finally(() => setLoading(false));
  };

  // Silent targeted refresh of document requests only: no skeleton, no side-effects.
  // Called after upload/submit to ensure authoritative server state without racing against
  // concurrent load() calls or showing a disruptive loading skeleton.
  const refreshRequests = () => {
    getDocumentRequests()
      .then((raw) => setDocumentRequests(Array.isArray(raw) ? raw : []))
      .catch(() => { /* non-fatal; optimistic update from the API response already applied */ });
  };

  useEffect(() => {
    load();
  }, []);

  // Refresh when the tab becomes visible again (cross-tab admin action, e.g. approve/reject).
  // NOTE: We intentionally do NOT listen to window.focus here. The native OS file-picker
  // dialog returns focus to the window before the file input's onChange fires. If we called
  // load() on focus, it would race against the in-flight upload POST and overwrite the
  // optimistic state update with stale server data (status: awaiting_upload).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') load();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Supplementary upload (UploadArea — not linked to a specific task)
  async function handleUpload(file: File, documentType: string) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('document_type', documentType);
      const uploaded = await uploadDocument(fd);
      // Immediately promote to submitted so admins can see it on the review page.
      // Orphaned docs (no documentable) are not gated by the draft-application guard.
      try { await submitDocument(uploaded.id); } catch { /* idempotent — ignore */ }
      toast.success('Document uploaded and sent to staff.');
      load();
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ? `Upload failed: ${msg}` : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  // Step 1: upload the selected file to the server.
  // For doc_request tasks: stores file, sets status→Uploaded (not yet submitted for review).
  // For required_doc tasks: combined upload+submit in one call (no separate submit step).
  async function handleTaskUpload(task: UnifiedTask, file: File) {
    setUploadingTaskKey(task.key);
    try {
      if (task.source === 'doc_request') {
        const updated = await uploadDocumentRequest(task.sourceId, file);
        // Apply optimistic state immediately from the response, then confirm from server.
        setDocumentRequests((prev) => prev.map((r) => r.id === task.sourceId ? updated : r));
        toast.success('File uploaded. Click Submit to send it to camp staff.');
        // Authoritative refresh after upload: ensures state is correct even if a
        // concurrent load() call (e.g. from visibilitychange) overwrote the optimistic update.
        refreshRequests();
      } else {
        const updated = await submitCompletedDocument(task.sourceId, file);
        setRequiredDocs((prev) => prev.map((d) => d.id === task.sourceId ? { ...d, ...updated } : d));
        toast.success('Document submitted to camp staff.');
      }
      setStagedTaskFiles((prev) => { const n = { ...prev }; delete n[task.key]; return n; });
    } catch (err) {
      setStagedTaskFiles((prev) => { const n = { ...prev }; delete n[task.key]; return n; });
      const msg = (err as { message?: string })?.message;
      toast.error(msg ? `Upload failed: ${msg}` : 'Upload failed. Please try again.');
    } finally {
      setUploadingTaskKey(null);
    }
  }

  // Step 2: submit an already-uploaded doc_request file for staff review.
  // Transitions status from Uploaded → UnderReview and notifies staff.
  async function handleTaskSubmit(task: UnifiedTask) {
    if (task.source !== 'doc_request') return;
    setSubmittingTaskKey(task.key);
    try {
      const updated = await submitDocumentRequest(task.sourceId);
      setDocumentRequests((prev) => prev.map((r) => r.id === task.sourceId ? updated : r));
      toast.success('Document submitted to camp staff for review.');
      refreshRequests();
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ? `Submit failed: ${msg}` : 'Submit failed. Please try again.');
    } finally {
      setSubmittingTaskKey(null);
    }
  }

  // Fetch and preview the applicant's own uploaded file for a doc_request task.
  // Files are stored on private disk — served via the authenticated download route.
  async function handleViewUploaded(req: DocumentRequestRecord) {
    setViewingUploadedId(req.id);
    try {
      const res = await axiosInstance.get(
        `/applicant/document-requests/${req.id}/download`,
        { responseType: 'blob' }
      );
      const contentType = (res.headers['content-type'] as string | undefined) ?? 'application/octet-stream';
      const blob = res.data as Blob;
      const objectUrl = URL.createObjectURL(blob);
      // Construct a synthetic Document so PreviewModal can render it directly
      setPreview({
        id: req.id,
        file_name: req.uploaded_file_name ?? 'document',
        mime_type: contentType.split(';')[0].trim(),
        url: objectUrl,
        size: blob.size,
        document_type: req.document_type,
        created_at: req.uploaded_at ?? req.created_at,
      } as Document);
    } catch {
      toast.error('Could not load document preview.');
    } finally {
      setViewingUploadedId(null);
    }
  }

  // View the applicant's own submitted file for a required_doc task.
  // Uses the authenticated download-submitted endpoint (private disk, blob response).
  const [viewingSubmittedId, setViewingSubmittedId] = useState<number | null>(null);

  async function handleViewSubmitted(doc: RequiredDocument) {
    setViewingSubmittedId(doc.id);
    try {
      const res = await axiosInstance.get(
        `/applicant/applicant-documents/${doc.id}/download-submitted`,
        { responseType: 'blob' }
      );
      const contentType = (res.headers['content-type'] as string | undefined) ?? 'application/octet-stream';
      const blob = res.data as Blob;
      const objectUrl = URL.createObjectURL(blob);
      setPreview({
        id: doc.id,
        file_name: doc.submitted_file_name ?? 'document',
        mime_type: contentType.split(';')[0].trim(),
        url: objectUrl,
        size: blob.size,
        document_type: doc.original_file_name,
        created_at: doc.created_at,
      } as Document);
    } catch {
      toast.error('Could not load document preview.');
    } finally {
      setViewingSubmittedId(null);
    }
  }

  // Download the admin-provided blank form for a RequiredDocument task
  async function handleTaskDownload(task: UnifiedTask) {
    const doc = requiredDocs.find((d) => d.id === task.sourceId);
    if (!doc) return;
    try {
      const path = doc.download_url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '');
      const res  = await axiosInstance.get(path, { responseType: 'blob' });
      const url  = URL.createObjectURL(res.data as Blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = doc.original_file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed.');
    }
  }


  // ── Camper scoping ────────────────────────────────────────────────────────
  // Filter each data stream to the currently-selected camper tab. `null` active
  // id means the merged "All" view. DocumentRequests and Documents have a
  // camper_id we can filter on; RequiredDocuments (admin-provided blank forms)
  // currently have no camper link in the API shape, so they're shown under
  // every tab. A later enhancement can scope them when the backend surfaces
  // the id.
  // Requests and documents with camper_id == null are unscoped (e.g. admin
  // created with "All campers", or a general applicant-level upload). These
  // surface on EVERY tab; hiding them on specific tabs made admin-created
  // requests invisible to applicants who had a camper tab selected.
  const scopedDocumentRequests = activeCamperId === null
    ? documentRequests
    : documentRequests.filter((r) => r.camper_id === activeCamperId || r.camper_id == null);
  const scopedDocuments = activeCamperId === null
    ? documents
    : documents.filter((d) => d.camper_id === activeCamperId || d.camper_id == null);

  // ── Unified task list ─────────────────────────────────────────────────────
  // Merge both data sources, sort urgently-needed tasks to the top.
  const unifiedTasks: UnifiedTask[] = [
    ...scopedDocumentRequests.map((r) => {
      const camper = campers.length >= 2 ? campers.find((c) => c.id === r.camper_id) : undefined;
      const camperName = camper ? `${camper.first_name} ${camper.last_name}`.trim() : null;
      return fromDocRequest(r, documents, camperName);
    }),
    ...requiredDocs.map((d) => fromRequiredDoc(d, documents)),
  ].sort((a, b) => TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status]);

  const completedTaskCount = unifiedTasks.filter((t) => t.status === 'completed').length;
  const uploadedTaskCount  = unifiedTasks.filter((t) => t.status === 'uploaded').length;
  const waitingTaskCount   = unifiedTasks.filter((t) => t.status === 'waiting').length;
  const pendingTaskCount   = unifiedTasks.filter((t) => t.status === 'not_started' || t.status === 'rejected').length;
  const totalTaskCount     = unifiedTasks.length;
  const allComplete        = totalTaskCount > 0 && completedTaskCount === totalTaskCount;

  // ── Submitted vs Additional ───────────────────────────────────────────────
  // A doc has been SENT if its sent_at is set (MessageService stamps this on
  // inbox attach). Submitted docs live on forever in the applicant's view with
  // their current admin decision — they no longer "drop off" like they did
  // when there was only a Ready-to-Send list. Drafts (sent_at null) go in the
  // Additional section below.
  // Include both inbox-sent docs (sent_at) and directly-submitted supplementary uploads (submitted_at)
  const submittedDocuments = scopedDocuments.filter((d) => !!d.sent_at || !!d.submitted_at);

  // Derive the 8-state UI status for a submitted doc. DocumentRequest matching
  // is best-effort: if this upload came from an admin ask, surface the request
  // overdue/reject state; otherwise resolve from document.verification_status
  // alone. The resolver handles all combinations.
  const statusForDocument = (doc: Document): DocumentUIStatus => {
    const matchingRequest = documentRequests.find((r) =>
      r.camper_id === doc.camper_id && r.document_type === doc.document_type,
    );
    return resolveDocumentStatus({
      request: matchingRequest
        ? { status: matchingRequest.status, is_overdue: matchingRequest.status === 'overdue' }
        : undefined,
      document: doc,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Modals — rendered at root level to avoid z-index stacking issues */}
      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
      {sendDoc  && (
        <SendDocumentModal
          doc={sendDoc}
          onClose={() => setSendDoc(null)}
          onSent={(docId) => {
            // Local mirror of the server-side sent_at stamp: flip sent_at on
            // the matching row so the Ready-to-Send filter drops it without
            // a network round-trip.
            setDocuments((prev) =>
              prev.map((d) => (d.id === docId ? { ...d, sent_at: new Date().toISOString() } : d)),
            );
          }}
        />
      )}

      <div className="flex flex-col gap-8 max-w-4xl">

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div>
          <h2 className="text-xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
            My Documents
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            If camp staff has requested documents from you, upload and submit them here. You can also send optional supporting files to staff using the area below.
          </p>
        </div>

        {/* ── Camper tabs ─────────────────────────────────────────────────
             Rendered only when the account has 2+ campers. Single-camper
             families never see the tab strip — the page is already scoped to
             the only child. The "All" tab shows the merged view, primarily
             useful for account-level documents (messaging attachments that
             aren't tied to a specific child). */}
        {campers.length >= 2 && (
          <div
            role="tablist"
            aria-label="Select camper"
            className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 pb-1"
          >
            <button
              role="tab"
              type="button"
              aria-selected={activeCamperId === null}
              onClick={() => setActiveCamperId(null)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                background: activeCamperId === null ? 'var(--ember-orange)' : 'var(--glass-medium)',
                color: activeCamperId === null ? '#fff' : 'var(--foreground)',
              }}
            >
              All campers
            </button>
            {campers.map((camper) => {
              const active = activeCamperId === camper.id;
              return (
                <button
                  key={camper.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setActiveCamperId(camper.id)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{
                    background: active ? 'var(--ember-orange)' : 'var(--glass-medium)',
                    color: active ? '#fff' : 'var(--foreground)',
                  }}
                >
                  {`${camper.first_name} ${camper.last_name}`.trim()}
                </button>
              );
            })}
          </div>
        )}

        {/* Required documents for the camp application (Immunization Record,
            Insurance Card, Medical Examination Form, etc.) are intentionally
            NOT rendered on this page.
            They belong exclusively to the ApplicationFormPage submission flow
            so that:
              - completion is evaluated in one place (the finalize gate)
              - the "submitted to staff" label can only ever reflect the real
                application state (draft docs never claim to be submitted)
              - this page stays focused on its actual purpose: admin-initiated
                document requests and optional supplementary uploads.
            See ApplicationFormPage step 11 for the required-document flow. */}

        {/* ── Task panel — Documents Requested From You ─────────────────── */}
        {/* Always rendered — admins can create requests at any time and users
            need a stable place to look. Hidden section = hidden expectation. */}
        <section data-guide-anchor="documents.requested-section">

          {/* Section header */}
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
            <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
              Documents Requested From You
            </h3>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
            {unifiedTasks.length > 0
              ? 'Upload each document below. The camp cannot process your application until all required items are submitted.'
              : 'If camp staff needs additional documents from you, they will appear here.'}
          </p>

          {loading ? (
            <div
              className="rounded-2xl border p-6"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <SkeletonTable rows={3} />
            </div>
          ) : unifiedTasks.length === 0 ? (
            /* Empty state — always visible so users know where to look */
            <div
              className="rounded-2xl border px-6 py-10 flex flex-col items-center gap-3 text-center"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(234,88,12,0.08)' }}
              >
                <ClipboardList className="h-5 w-5" style={{ color: 'var(--ember-orange)' }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  No documents requested yet
                </p>
                <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Camp staff will send you a request here if they need specific documents from you. Check back after submitting your application.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Progress bar — only shown when tasks exist */}
              <div
                className="rounded-2xl border px-5 py-4 mb-4 flex items-center gap-4"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                      {allComplete
                        ? 'All documents submitted'
                        : (() => {
                            const parts: string[] = [];
                            if (waitingTaskCount > 0) parts.push(`${waitingTaskCount} awaiting review`);
                            if (uploadedTaskCount > 0) parts.push(`${uploadedTaskCount} ready to submit`);
                            if (pendingTaskCount > 0)  parts.push(`${pendingTaskCount} still needed`);
                            return parts.join(' · ') || 'No documents required';
                          })()}
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: allComplete ? '#166534' : '#b45309' }}
                    >
                      {completedTaskCount + uploadedTaskCount + waitingTaskCount} / {totalTaskCount}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full" style={{ background: 'var(--border)' }}>
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${((completedTaskCount + uploadedTaskCount + waitingTaskCount) / totalTaskCount) * 100}%`,
                        background: allComplete ? '#166534' : 'var(--ember-orange)',
                      }}
                    />
                  </div>
                </div>
                {allComplete && (
                  <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: '#166534' }} />
                )}
              </div>

              {/* Task cards */}
              <div className="flex flex-col gap-3">
                {unifiedTasks.map((task) => {
                    // doc_request: view via private download endpoint
                    const req = task.source === 'doc_request'
                      ? documentRequests.find((r) => r.id === task.sourceId) ?? null
                      : null;
                    // required_doc: view the submitted file via its own endpoint
                    const rdoc = task.source === 'required_doc'
                      ? requiredDocs.find((d) => d.id === task.sourceId) ?? null
                      : null;
                    const viewUploadedHandler =
                      req  ? () => void handleViewUploaded(req)  :
                      rdoc ? () => void handleViewSubmitted(rdoc) :
                      undefined;
                    const isViewingUploaded =
                      req  ? viewingUploadedId  === req.id  :
                      rdoc ? viewingSubmittedId === rdoc.id :
                      false;
                    return (
                      <TaskCard
                        key={task.key}
                        task={task}
                        stagedFile={stagedTaskFiles[task.key] ?? null}
                        uploading={uploadingTaskKey === task.key}
                        submitting={submittingTaskKey === task.key}
                        onFileSelected={(file) => {
                          setStagedTaskFiles((prev) => ({ ...prev, [task.key]: file }));
                          void handleTaskUpload(task, file);
                        }}
                        onSubmit={() => void handleTaskSubmit(task)}
                        onDownload={task.canDownload ? () => void handleTaskDownload(task) : undefined}
                        onViewDoc={(doc) => setPreview(doc)}
                        onViewUploaded={viewUploadedHandler}
                        viewingUploaded={isViewingUploaded}
                      />
                    );
                  })}
                </div>
              </>
            )}
        </section>

        {/* ── Submitted Documents ──────────────────────────────────────
             Persistent history of everything the applicant has sent to camp
             staff. Rows stay visible even after admin approves/rejects so the
             applicant always has a record of "what did I send?" alongside the
             current decision. A rejection surfaces the rejection reason and a
             "Resubmit" path via the Additional Documents section below. */}
        <div data-guide-anchor="documents.submitted-section">
          <h3 className="font-headline font-semibold text-base mb-1" style={{ color: 'var(--foreground)' }}>
            Submitted Documents
          </h3>
          <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Files you've sent to camp staff, with their current review status. Rejected documents can be resubmitted below.
          </p>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {loading ? (
              <div className="p-4"><SkeletonTable rows={3} /></div>
            ) : submittedDocuments.length === 0 ? (
              <EmptyState
                title="No documents submitted yet"
                description="Once you send a document to camp staff, it will appear here with its review status."
                icon={Send}
              />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {submittedDocuments.map((doc) => {
                  const status = statusForDocument(doc);
                  return (
                    <li key={doc.id}>
                      <div className="flex items-center justify-between gap-4 px-5 py-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <FileIcon mime={doc.mime_type} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                              {doc.file_name}
                            </p>
                            <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap" style={{ color: 'var(--muted-foreground)' }}>
                              <DocumentStatusBadge status={status} />
                              <span>{getDocumentLabel(doc.document_type, 'applicant')}</span>
                              {doc.sent_at && (
                                <>
                                  <span aria-hidden="true">&middot;</span>
                                  <span>Sent {format(new Date(doc.sent_at), 'MMM d, yyyy')}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreview(doc)}
                            className="flex items-center gap-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ── Supplementary upload ─────────────────────────────────────── */}
        <div data-guide-anchor="documents.upload-area">
          <UploadArea onUpload={handleUpload} uploading={uploading} />
        </div>


      </div>
    </>
  );
}
