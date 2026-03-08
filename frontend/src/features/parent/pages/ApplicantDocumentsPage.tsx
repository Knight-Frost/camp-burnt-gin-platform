/**
 * ApplicantDocumentsPage.tsx
 *
 * Purpose: Standalone document management for applicants — upload, preview, and
 *          delete documents independent of the multi-step application form.
 * Responsibilities:
 *   - Fetch all documents belonging to the current user from the API
 *   - Provide a drag-and-drop / click-to-browse upload area (PDF, JPG, PNG, WebP)
 *   - Require a document-type label before upload to keep files organized
 *   - Display each document with a View (modal preview), Send (to admin), and Delete action
 *   - PreviewModal: inline image or iframe PDF viewer; "open in new tab" fallback for others
 *   - SendDocumentModal: creates a new inbox conversation with a selected admin recipient
 *
 * Plain-English: This is the parent's personal filing cabinet — they can
 * drag files in, preview them without downloading, notify an admin that
 * a document is ready, or remove files they uploaded by mistake.
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  X,
  File,
  Send,
} from 'lucide-react';
import { format } from 'date-fns';

import {
  getDocuments,
  deleteDocument,
  uploadDocument,
  type Document,
} from '@/features/parent/api/applicant.api';
import {
  searchInboxUsers,
  createConversation,
  sendMessage,
  type ConversationParticipant,
} from '@/features/messaging/api/messaging.api';
import { Button } from '@/ui/components/Button';
import { EmptyState } from '@/ui/components/EmptyState';
import { ErrorState } from '@/ui/components/EmptyState';
import { SkeletonTable } from '@/ui/components/Skeletons';
import { staggerContainerVariants, staggerChildVariants } from '@/shared/constants/motion';

// File types accepted by the hidden <input> and the drag-and-drop zone
const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp';

// Converts raw byte count into a human-readable string (B / KB / MB)
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
// Preview modal — renders an image, PDF iframe, or a "can't preview" fallback
// ---------------------------------------------------------------------------

function PreviewModal({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const isImage = doc.mime_type.startsWith('image/');
  const isPdf   = doc.mime_type === 'application/pdf';

  return (
    // Clicking the dark backdrop closes the modal
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      {/* e.stopPropagation prevents clicks inside the card from closing the modal */}
      <div
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--card)', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
            {doc.file_name}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
          >
            <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
        <div className="overflow-auto" style={{ maxHeight: 'calc(90vh - 56px)' }}>
          {/* Images render directly */}
          {isImage && (
            <img
              src={doc.url}
              alt={doc.file_name}
              className="w-full h-auto object-contain"
            />
          )}
          {/* PDFs load in an iframe so the browser's built-in PDF viewer handles them */}
          {isPdf && (
            <iframe
              src={doc.url}
              title={doc.file_name}
              className="w-full border-0"
              style={{ height: '75vh' }}
            />
          )}
          {/* Any other format gets a "can't preview" message with an open-in-tab link */}
          {!isImage && !isPdf && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <FileText className="h-12 w-12" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Preview not available for this file type.
              </p>
              <a
                href={doc.url}
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
// Send to admin modal — lets the parent notify an admin about a specific document
// ---------------------------------------------------------------------------

function SendDocumentModal({
  doc,
  onClose,
}: {
  doc: Document;
  onClose: () => void;
}) {
  const [admins, setAdmins]           = useState<ConversationParticipant[]>([]);
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  // Pre-fill a helpful message template mentioning the document name and type
  const [message, setMessage]         = useState(
    `Hi, I'm sharing a document with you:\n\nDocument: ${doc.file_name}\nType: ${doc.document_type}\n\nPlease let me know if you need anything else.`
  );
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [sending, setSending]         = useState(false);

  // Load available admin recipients when the modal opens
  useEffect(() => {
    searchInboxUsers('')
      .then((users) => {
        setAdmins(users);
        // Auto-select the first admin so the user doesn't have to pick one manually
        if (users.length > 0) setSelectedId(users[0].id);
      })
      .catch(() => toast.error('Could not load admin recipients.'))
      .finally(() => setLoadingAdmins(false));
  }, []);

  async function handleSend() {
    if (!selectedId || !message.trim()) return;
    setSending(true);
    try {
      // Step 1: create a new conversation thread for this document notification
      const conv = await createConversation({
        subject: `Document: ${doc.file_name}`,
        participant_ids: [selectedId],
        category: 'general',
      });
      // Step 2: send the composed message into that new thread
      await sendMessage(conv.id, message.trim());
      toast.success('Document notification sent to admin.');
      onClose();
    } catch {
      toast.error('Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    // Backdrop click closes the modal
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
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

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {/* Recipient dropdown — populated after searchInboxUsers resolves */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Send to
            </label>
            {loadingAdmins ? (
              <div className="h-9 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
            ) : admins.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                No admin recipients available.
              </p>
            ) : (
              <select
                value={selectedId ?? ''}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                className="rounded-lg px-3 py-2 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
                style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Editable message body — parent can customize before sending */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Message
            </label>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded-lg px-3 py-2.5 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)] resize-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-4 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          {/* Send button disabled while loading admins, while sending, or if nothing to send */}
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
// Upload area — drag-and-drop zone with a document-type input
// ---------------------------------------------------------------------------

function UploadArea({
  onUpload,
  uploading,
}: {
  onUpload: (file: File, documentType: string) => Promise<void>;
  uploading: boolean;
}) {
  // Hidden file input triggered by clicking the drop zone
  const inputRef     = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('');
  // Visual feedback when a file is dragged over the zone
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    // Require a document type label so uploads are always categorized
    if (!docType.trim()) {
      toast.error('Please enter a document type before uploading.');
      return;
    }
    await onUpload(file, docType.trim());
    // Clear the label after a successful upload so the next upload starts fresh
    setDocType('');
  }

  function handleDrop(e: React.DragEvent) {
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
        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Upload a document</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          PDF, JPG, or PNG · Max 10 MB
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Document type label — must be filled before uploading */}
        <input
          type="text"
          placeholder="Document type (e.g. Medical Exam, Insurance Card)"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2.5 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        />
      </div>

      {/* Drop zone: border turns orange and background tints when dragging */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
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
        {/* sr-only hides the raw file input visually while keeping it accessible */}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPTED_TYPES}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            // Reset value so re-selecting the same file triggers onChange again
            e.target.value = '';
          }}
        />
      </div>

      {uploading && (
        <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
          Uploading…
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ApplicantDocumentsPage() {
  const [documents, setDocuments]   = useState<Document[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [uploading, setUploading]   = useState(false);
  // null means no preview is open; set to a Document to open the preview modal
  const [preview, setPreview]       = useState<Document | null>(null);
  // Track which document ID is being deleted for a per-row spinner
  const [deletingId, setDeletingId] = useState<number | null>(null);
  // null means the send modal is closed; set to a Document to open it
  const [sendDoc, setSendDoc]       = useState<Document | null>(null);

  // Named function so it can be passed directly to ErrorState's onRetry prop
  const load = () => {
    setLoading(true);
    setError(false);
    getDocuments()
      .then(setDocuments)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Build FormData for multipart upload; re-fetch list after success
  async function handleUpload(file: File, documentType: string) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('document_type', documentType);
      await uploadDocument(fd);
      toast.success('Document uploaded.');
      // Re-fetch to get the new document's server-assigned ID and URL
      load();
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ? `Upload failed: ${msg}` : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: Document) {
    // Native confirm dialog — simple safeguard against accidental deletes
    if (!window.confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id);
      // Filter the deleted document out of local state — no re-fetch needed
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success('Document deleted.');
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ? `Delete failed: ${msg}` : 'Delete failed. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {/* Modals are rendered outside the main layout div to avoid z-index issues */}
      {preview && (
        <PreviewModal doc={preview} onClose={() => setPreview(null)} />
      )}
      {sendDoc && (
        <SendDocumentModal doc={sendDoc} onClose={() => setSendDoc(null)} />
      )}

      <div className="flex flex-col gap-6 max-w-4xl">
        {/* Page header */}
        <div>
          <h2 className="text-xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
            Documents
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Upload and manage documents for your camper applications.
          </p>
        </div>

        {/* Upload panel appears above the document list */}
        <UploadArea onUpload={handleUpload} uploading={uploading} />

        {/* Document list card */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          {loading ? (
            <div className="p-4">
              <SkeletonTable rows={4} />
            </div>
          ) : error ? (
            <ErrorState onRetry={load} />
          ) : documents.length === 0 ? (
            <EmptyState
              title="No documents uploaded"
              description="Upload your first document above."
              icon={FileText}
            />
          ) : (
            // Stagger animation so each row fades in one after another
            <motion.ul
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="divide-y"
              style={{ borderColor: 'var(--border)' }}
            >
              {documents.map((doc) => (
                <motion.li key={doc.id} variants={staggerChildVariants}>
                  <div className="flex items-center justify-between gap-4 px-6 py-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <FileIcon mime={doc.mime_type} />
                      <div className="min-w-0">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: 'var(--foreground)' }}
                        >
                          {doc.file_name}
                        </p>
                        {/* Secondary metadata: type · size · upload date */}
                        <div
                          className="flex items-center gap-2 text-xs mt-0.5"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          <span>{doc.document_type}</span>
                          <span aria-hidden="true">&middot;</span>
                          <span>{formatBytes(doc.size)}</span>
                          <span aria-hidden="true">&middot;</span>
                          <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    {/* Per-row action buttons: View, Send, Delete */}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSendDoc(doc)}
                        className="flex items-center gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Send
                      </Button>
                      {/* Delete shows a spinner while the API call is in flight */}
                      <Button
                        variant="destructive"
                        size="sm"
                        loading={deletingId === doc.id}
                        disabled={deletingId === doc.id}
                        onClick={() => handleDelete(doc)}
                        className="flex items-center gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>
      </div>
    </>
  );
}
