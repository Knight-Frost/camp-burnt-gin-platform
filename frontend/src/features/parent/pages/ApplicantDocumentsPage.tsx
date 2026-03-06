/**
 * ApplicantDocumentsPage.tsx
 * Standalone document management for applicants — upload, preview, and delete
 * documents independent of the application form.
 *
 * Route: /applicant/documents
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
} from 'lucide-react';
import { format } from 'date-fns';

import {
  getDocuments,
  deleteDocument,
  uploadDocument,
  type Document,
} from '@/features/parent/api/applicant.api';
import { Button } from '@/ui/components/Button';
import { EmptyState } from '@/ui/components/EmptyState';
import { ErrorState } from '@/ui/components/EmptyState';
import { SkeletonTable } from '@/ui/components/Skeletons';
import { staggerContainerVariants, staggerChildVariants } from '@/shared/constants/motion';

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
// Preview modal
// ---------------------------------------------------------------------------

function PreviewModal({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const isImage = doc.mime_type.startsWith('image/');
  const isPdf   = doc.mime_type === 'application/pdf';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
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
          {isImage && (
            <img
              src={doc.url}
              alt={doc.file_name}
              className="w-full h-auto object-contain"
            />
          )}
          {isPdf && (
            <iframe
              src={doc.url}
              title={doc.file_name}
              className="w-full border-0"
              style={{ height: '75vh' }}
            />
          )}
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
// Upload area
// ---------------------------------------------------------------------------

function UploadArea({
  onUpload,
  uploading,
}: {
  onUpload: (file: File, documentType: string) => Promise<void>;
  uploading: boolean;
}) {
  const inputRef     = useRef<HTMLInputElement>(null);
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
        <input
          type="text"
          placeholder="Document type (e.g. Medical Exam, Insurance Card)"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2.5 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        />
      </div>

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
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]     = useState<Document | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    setError(false);
    getDocuments()
      .then(setDocuments)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function handleUpload(file: File, documentType: string) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('document_type', documentType);
      await uploadDocument(fd);
      toast.success('Document uploaded.');
      load();
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: Document) {
    if (!window.confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success('Document deleted.');
    } catch {
      toast.error('Delete failed. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {preview && (
        <PreviewModal doc={preview} onClose={() => setPreview(null)} />
      )}

      <div className="flex flex-col gap-6 max-w-4xl">
        {/* Header */}
        <div>
          <h2 className="text-xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
            Documents
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Upload and manage documents for your camper applications.
          </p>
        </div>

        {/* Upload panel */}
        <UploadArea onUpload={handleUpload} uploading={uploading} />

        {/* Document list */}
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
