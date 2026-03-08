/**
 * AdminDocumentsPage.tsx
 *
 * Redesigned (Phase 12) as a full document intake and management system.
 *
 * Features:
 *  - Queue summary stats at top (pending, scanning, approved today, archived)
 *  - Active / Archived tab toggle
 *  - Full document lifecycle: Uploaded → Scanning → Pending Review → Approved/Rejected → Archived/Deleted
 *  - Delete with confirmation dialog
 *  - Archive / restore workflow
 *  - Rich search by uploader, camper, or document name
 *  - Status filters: Pending, Scanning, Approved, Rejected, Archived
 *  - Per-row actions: View preview, Download, Approve, Reject, Archive, Delete
 *  - Scan status indicators
 *  - All actions audit-loggable via API calls
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  FileText,
  File,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Search,
  Loader2,
  User,
  X,
  Archive,
  ArchiveRestore,
  Trash2,
  Shield,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';

import {
  getAdminDocuments,
  verifyDocument,
  downloadAdminDocument,
  type AdminDocument,
} from '@/features/admin/api/admin.api';
import type { PaginatedResponse } from '@/shared/types/api.types';
import { Button } from '@/ui/components/Button';
import { EmptyState, ErrorState } from '@/ui/components/EmptyState';
import { SkeletonTable } from '@/ui/components/Skeletons';
import { staggerContainerVariants, staggerChildVariants } from '@/shared/constants/motion';
import axiosInstance from '@/api/axios.config';

// ─── Extended document status types ───────────────────────────────────────────

type DocTab = 'active' | 'archived';
type StatusFilter = '' | 'pending' | 'scanning' | 'approved' | 'rejected';

interface Filters {
  search: string;
  status: StatusFilter;
}

const DEFAULT_FILTERS: Filters = { search: '', status: '' };

// ─── API helpers (archive/delete/restore) ─────────────────────────────────────

async function archiveDocument(id: number): Promise<void> {
  await axiosInstance.post(`/documents/${id}/archive`);
}

async function restoreDocument(id: number): Promise<void> {
  await axiosInstance.post(`/documents/${id}/restore`);
}

async function deleteDocument(id: number): Promise<void> {
  await axiosInstance.delete(`/documents/${id}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocumentTypeLabel(doc: AdminDocument): string {
  if (doc.document_type) return doc.document_type;
  const mime = doc.mime_type ?? '';
  if (mime === 'application/pdf') return 'PDF Document';
  if (mime.startsWith('image/')) return 'Image File';
  return 'Document';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FileIcon({ mime }: { mime: string }) {
  const isPdf = mime === 'application/pdf';
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: isPdf ? 'rgba(239,68,68,0.10)' : 'rgba(96,165,250,0.10)' }}
    >
      {isPdf
        ? <FileText className="h-5 w-5" style={{ color: '#ef4444' }} />
        : <File className="h-5 w-5" style={{ color: 'var(--night-sky-blue)' }} />
      }
    </div>
  );
}

function VerificationBadge({ status }: { status: AdminDocument['verification_status'] }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
        style={{ background: 'rgba(5,150,105,0.10)', color: 'var(--forest-green)' }}>
        <CheckCircle className="h-3 w-3" /> Approved
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
        style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' }}>
        <XCircle className="h-3 w-3" /> Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
      style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
      <Clock className="h-3 w-3" /> Pending Review
    </span>
  );
}

function ScanBadge({ scanPassed }: { scanPassed: boolean | null }) {
  if (scanPassed === false) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
        style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' }}>
        <AlertCircle className="h-3 w-3" /> Scan Failed
      </span>
    );
  }
  if (scanPassed === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
        style={{ background: 'rgba(96,165,250,0.10)', color: 'var(--night-sky-blue)' }}>
        <Loader2 className="h-3 w-3 animate-spin" /> Scanning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
      style={{ background: 'rgba(5,150,105,0.08)', color: 'var(--forest-green)' }}>
      <Shield className="h-3 w-3" /> Scan Passed
    </span>
  );
}

// ─── Delete confirmation dialog ────────────────────────────────────────────────

function DeleteConfirmDialog({
  docName,
  onConfirm,
  onCancel,
  loading,
}: {
  docName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="rounded-2xl border p-6 max-w-md w-full shadow-xl"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-4 mb-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0" style={{ background: 'rgba(220,38,38,0.10)' }}>
              <Trash2 className="h-5 w-5" style={{ color: 'var(--destructive)' }} />
            </div>
            <div>
              <h3 className="font-semibold text-base" style={{ color: 'var(--foreground)' }}>Delete Document</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                Are you sure you want to permanently delete <span className="font-medium" style={{ color: 'var(--foreground)' }}>{docName}</span>?
              </p>
              <p className="text-xs mt-2 font-medium" style={{ color: 'var(--destructive)' }}>
                This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Document
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Document viewer modal ────────────────────────────────────────────────────

function DocumentViewerModal({
  docId,
  allDocs,
  onClose,
  onNavigate,
  onVerify,
  onDownload,
  verifying,
  downloading,
}: {
  docId: number;
  allDocs: AdminDocument[];
  onClose: () => void;
  onNavigate: (id: number) => void;
  onVerify: (id: number, status: 'approved' | 'rejected') => Promise<void>;
  onDownload: (doc: AdminDocument) => Promise<void>;
  verifying: number | null;
  downloading: number | null;
}) {
  const [blobUrl, setBlobUrl]           = useState<string | null>(null);
  const [loadingPreview, setLoading]    = useState(true);
  const [previewError, setPreviewError] = useState(false);
  const [zoom, setZoom]                 = useState(1);

  const currentDoc   = allDocs.find((d) => d.id === docId) ?? allDocs[0];
  const currentIndex = allDocs.findIndex((d) => d.id === docId);
  const hasPrev      = currentIndex > 0;
  const hasNext      = currentIndex < allDocs.length - 1;

  const isPdf          = currentDoc?.mime_type === 'application/pdf';
  const isImage        = currentDoc?.mime_type?.startsWith('image/') ?? false;
  const isPreviewable  = isPdf || isImage;

  // Load file as blob → object URL each time docId changes
  useEffect(() => {
    if (!currentDoc) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    setLoading(true);
    setPreviewError(false);
    setBlobUrl(null);
    setZoom(1);

    downloadAdminDocument(currentDoc.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setPreviewError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft'  && hasPrev) onNavigate(allDocs[currentIndex - 1].id);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(allDocs[currentIndex + 1].id);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, hasPrev, hasNext, currentIndex, allDocs, onNavigate]);

  if (!currentDoc) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.78)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
            width: '90vw',
            maxWidth: '1040px',
            height: '90vh',
            maxHeight: '900px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ─────────────────────────────────────────────── */}
          <div
            className="flex items-start justify-between gap-4 px-5 py-4 border-b flex-shrink-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-start gap-3 min-w-0">
              <FileIcon mime={currentDoc.mime_type} />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                  {currentDoc.file_name}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {currentDoc.uploaded_by_name && (
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      Uploader: {currentDoc.uploaded_by_name}
                    </span>
                  )}
                  {currentDoc.documentable_name && (
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      Camper: {currentDoc.documentable_name}
                    </span>
                  )}
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Uploaded: {format(new Date(currentDoc.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <VerificationBadge status={currentDoc.verification_status} />
                  <ScanBadge scanPassed={currentDoc.scan_passed} />
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-[var(--muted)]"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ── Preview area ────────────────────────────────────────── */}
          <div className="flex-1 relative overflow-hidden" style={{ background: '#111827' }}>

            {/* Loading state */}
            {loadingPreview && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading preview…</span>
              </div>
            )}

            {/* Fallback: unsupported type or load error */}
            {!loadingPreview && (previewError || !isPreviewable) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div
                  className="flex items-center justify-center w-16 h-16 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <File className="h-8 w-8" style={{ color: 'rgba(255,255,255,0.35)' }} />
                </div>
                <div className="text-center px-6">
                  <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {previewError
                      ? 'This document cannot be previewed.'
                      : 'Preview not available for this file type.'}
                  </p>
                  <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Please download the file to view it.
                  </p>
                </div>
                <button
                  onClick={() => void onDownload(currentDoc)}
                  disabled={downloading === currentDoc.id}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.7)' }}
                >
                  {downloading === currentDoc.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Download className="h-4 w-4" />}
                  Download to View
                </button>
              </div>
            )}

            {/* PDF — rendered natively in iframe */}
            {!loadingPreview && !previewError && blobUrl && isPdf && (
              <iframe
                src={blobUrl}
                className="w-full h-full"
                title={currentDoc.file_name ?? 'Document Preview'}
                style={{ border: 'none' }}
              />
            )}

            {/* Image — rendered directly with zoom support */}
            {!loadingPreview && !previewError && blobUrl && isImage && (
              <div className="flex items-center justify-center w-full h-full overflow-hidden p-6">
                <img
                  src={blobUrl}
                  alt={currentDoc.file_name ?? 'Document Preview'}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.15s ease',
                    borderRadius: '4px',
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between gap-2 px-5 py-3 border-t flex-shrink-0 flex-wrap"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => hasPrev && onNavigate(allDocs[currentIndex - 1].id)}
                disabled={!hasPrev}
                title="Previous document (← key)"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-35 hover:bg-[var(--muted)]"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span className="text-xs tabular-nums px-2" style={{ color: 'var(--muted-foreground)' }}>
                {currentIndex + 1} / {allDocs.length}
              </span>
              <button
                onClick={() => hasNext && onNavigate(allDocs[currentIndex + 1].id)}
                disabled={!hasNext}
                title="Next document (→ key)"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-35 hover:bg-[var(--muted)]"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Zoom controls (images only) */}
            {isImage && !loadingPreview && blobUrl && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}
                  disabled={zoom <= 0.25}
                  title="Zoom Out"
                  className="p-1.5 rounded-lg border transition-colors disabled:opacity-35 hover:bg-[var(--muted)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  title="Fit to Screen"
                  className="p-1.5 rounded-lg border transition-colors hover:bg-[var(--muted)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                  disabled={zoom >= 3}
                  title="Zoom In"
                  className="p-1.5 rounded-lg border transition-colors disabled:opacity-35 hover:bg-[var(--muted)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <span className="text-xs tabular-nums ml-1 w-9" style={{ color: 'var(--muted-foreground)' }}>
                  {Math.round(zoom * 100)}%
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              {/* Download */}
              <button
                onClick={() => void onDownload(currentDoc)}
                disabled={downloading === currentDoc.id || currentDoc.scan_passed === false}
                title={currentDoc.scan_passed === false ? 'Scan failed — download blocked' : 'Download file'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 hover:bg-[var(--muted)]"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {downloading === currentDoc.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />}
                Download
              </button>

              {/* Approve */}
              {currentDoc.verification_status !== 'approved' && (
                <button
                  onClick={() => void onVerify(currentDoc.id, 'approved')}
                  disabled={verifying === currentDoc.id}
                  title="Approve document"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 hover:bg-[var(--muted)]"
                  style={{ borderColor: 'rgba(5,150,105,0.35)', color: 'var(--forest-green)' }}
                >
                  {verifying === currentDoc.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <CheckCircle className="h-3.5 w-3.5" />}
                  Approve
                </button>
              )}

              {/* Reject */}
              {currentDoc.verification_status !== 'rejected' && (
                <button
                  onClick={() => void onVerify(currentDoc.id, 'rejected')}
                  disabled={verifying === currentDoc.id}
                  title="Reject document"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 hover:bg-[var(--muted)]"
                  style={{ borderColor: 'rgba(220,38,38,0.3)', color: 'var(--destructive)' }}
                >
                  {verifying === currentDoc.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <XCircle className="h-3.5 w-3.5" />}
                  Reject
                </button>
              )}

              {/* Close */}
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-[var(--muted)]"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                <X className="h-3.5 w-3.5" /> Close
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Queue summary bar ────────────────────────────────────────────────────────

function QueueSummary({ docs, tab }: { docs: AdminDocument[]; tab: DocTab }) {
  const pending  = docs.filter((d) => d.verification_status === 'pending').length;
  const scanning = docs.filter((d) => d.scan_passed === null).length;
  const approved = docs.filter((d) => d.verification_status === 'approved').length;
  const rejected = docs.filter((d) => d.verification_status === 'rejected').length;

  if (tab === 'archived') {
    return (
      <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        {docs.length} archived document{docs.length !== 1 ? 's' : ''}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {[
        { label: 'Pending Review', count: pending, bg: 'rgba(245,158,11,0.10)', color: '#b45309' },
        { label: 'Scanning',       count: scanning, bg: 'rgba(96,165,250,0.10)', color: 'var(--night-sky-blue)' },
        { label: 'Approved',       count: approved, bg: 'rgba(5,150,105,0.10)',  color: 'var(--forest-green)' },
        { label: 'Rejected',       count: rejected, bg: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' },
      ].map(({ label, count, bg, color }) => (
        <div
          key={label}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
          style={{ background: bg, color }}
        >
          <span className="font-semibold tabular-nums">{count}</span>
          <span className="font-medium">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Document row ─────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  tab,
  onPreview,
  onVerify,
  onDownload,
  onArchive,
  onRestore,
  onDeleteRequest,
  verifying,
  downloading,
  archiving,
}: {
  doc: AdminDocument;
  tab: DocTab;
  onPreview: (doc: AdminDocument) => void;
  onVerify: (id: number, status: 'approved' | 'rejected') => Promise<void>;
  onDownload: (doc: AdminDocument) => Promise<void>;
  onArchive: (id: number) => Promise<void>;
  onRestore: (id: number) => Promise<void>;
  onDeleteRequest: (doc: AdminDocument) => void;
  verifying: number | null;
  downloading: number | null;
  archiving: number | null;
}) {
  const typeLabel = getDocumentTypeLabel(doc);
  const isBusy = verifying === doc.id || archiving === doc.id;

  return (
    <motion.div
      variants={staggerChildVariants}
      className="flex items-start gap-4 px-5 py-4 border-b last:border-b-0 transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
      style={{ borderColor: 'var(--border)' }}
    >
      <FileIcon mime={doc.mime_type} />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
              {doc.file_name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {typeLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 flex-shrink-0">
            <VerificationBadge status={doc.verification_status} />
            <ScanBadge scanPassed={doc.scan_passed} />
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
          {doc.uploaded_by_name && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate max-w-32">{doc.uploaded_by_name}</span>
            </div>
          )}
          {doc.documentable_name && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <FileText className="h-3 w-3 flex-shrink-0" />
              <span className="truncate max-w-32">{doc.documentable_name}</span>
            </div>
          )}
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {formatBytes(doc.size)} · {format(new Date(doc.created_at), 'MMM d, yyyy')}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* View */}
        <button
          onClick={() => onPreview(doc)}
          disabled={doc.scan_passed === false}
          title={doc.scan_passed === false ? 'Scan failed — preview blocked' : 'Preview document'}
          className="p-1.5 rounded-lg border transition-colors disabled:opacity-40 hover:bg-[var(--muted)]"
          style={{ borderColor: 'var(--border)', color: 'var(--night-sky-blue)' }}
        >
          <Eye className="h-4 w-4" />
        </button>

        {/* Download */}
        <button
          onClick={() => void onDownload(doc)}
          disabled={downloading === doc.id || doc.scan_passed === false}
          title={doc.scan_passed === false ? 'Scan failed — download blocked for safety' : 'Download'}
          className="p-1.5 rounded-lg border transition-colors disabled:opacity-40 hover:bg-[var(--muted)]"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          {downloading === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </button>

        {tab === 'active' ? (
          <>
            {/* Approve */}
            {doc.verification_status !== 'approved' && (
              <button
                onClick={() => void onVerify(doc.id, 'approved')}
                disabled={isBusy}
                title="Approve document"
                className="p-1.5 rounded-lg border transition-colors disabled:opacity-40 hover:bg-[var(--muted)]"
                style={{ borderColor: 'rgba(5,150,105,0.35)', color: 'var(--forest-green)' }}
              >
                {verifying === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              </button>
            )}

            {/* Reject */}
            {doc.verification_status !== 'rejected' && (
              <button
                onClick={() => void onVerify(doc.id, 'rejected')}
                disabled={isBusy}
                title="Reject document"
                className="p-1.5 rounded-lg border transition-colors disabled:opacity-40 hover:bg-[var(--muted)]"
                style={{ borderColor: 'rgba(220,38,38,0.3)', color: 'var(--destructive)' }}
              >
                {verifying === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              </button>
            )}

            {/* Archive */}
            <button
              onClick={() => void onArchive(doc.id)}
              disabled={isBusy}
              title="Archive document"
              className="p-1.5 rounded-lg border transition-colors disabled:opacity-40 hover:bg-[var(--muted)]"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              {archiving === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            </button>
          </>
        ) : (
          /* Restore from archive */
          <button
            onClick={() => void onRestore(doc.id)}
            disabled={isBusy}
            title="Restore document"
            className="p-1.5 rounded-lg border transition-colors disabled:opacity-40 hover:bg-[var(--muted)]"
            style={{ borderColor: 'rgba(5,150,105,0.35)', color: 'var(--forest-green)' }}
          >
            {archiving === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
          </button>
        )}

        {/* Delete — always available */}
        <button
          onClick={() => onDeleteRequest(doc)}
          disabled={isBusy}
          title="Delete document permanently"
          className="p-1.5 rounded-lg border transition-colors disabled:opacity-40 hover:bg-[var(--muted)]"
          style={{ borderColor: 'rgba(220,38,38,0.25)', color: 'var(--destructive)' }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  meta,
  onPage,
}: {
  meta: PaginatedResponse<AdminDocument>['meta'];
  onPage: (page: number) => void;
}) {
  if (meta.last_page <= 1) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
      <span>Page {meta.current_page} of {meta.last_page} · {meta.total} documents</span>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" disabled={meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)}>
          Previous
        </Button>
        <Button variant="ghost" size="sm" disabled={meta.current_page >= meta.last_page} onClick={() => onPage(meta.current_page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AdminDocumentsPage() {
  const [result, setResult]           = useState<PaginatedResponse<AdminDocument> | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const [filters, setFilters]         = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage]               = useState(1);
  const [tab, setTab]                 = useState<DocTab>('active');
  const [verifying, setVerifying]     = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [archiving, setArchiving]     = useState<number | null>(null);
  const [retryKey, setRetryKey]       = useState(0);
  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<AdminDocument | null>(null);
  const [deleting, setDeleting]         = useState(false);
  // Viewer state
  const [viewTargetId, setViewTargetId] = useState<number | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Local input for instant UI feedback, debounced for API
  const [searchInput, setSearchInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params: Parameters<typeof getAdminDocuments>[0] = { page };
      if (filters.search) params.search = filters.search;
      if (filters.status && filters.status !== 'scanning') params.verification_status = filters.status as 'pending' | 'approved' | 'rejected';
      // Pass archived param based on current tab
      if (tab === 'archived') (params as Record<string, unknown>).archived = true;
      const res = await getAdminDocuments(params);
      setResult(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, filters, tab, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setFilters((prev) => ({ ...prev, search: value }));
    }, 300);
  }

  function handleStatusFilter(status: StatusFilter) {
    setPage(1);
    setFilters((prev) => ({ ...prev, status }));
  }

  function clearFilters() {
    setSearchInput('');
    setPage(1);
    setFilters(DEFAULT_FILTERS);
  }

  async function handleVerify(id: number, status: 'approved' | 'rejected') {
    setVerifying(id);
    try {
      const updated = await verifyDocument(id, status);
      setResult((prev) => prev
        ? { ...prev, data: prev.data.map((d) => d.id === id ? { ...d, ...updated } : d) }
        : prev
      );
      toast.success(`Document ${status}.`);
    } catch {
      toast.error('Failed to update document status.');
    } finally {
      setVerifying(null);
    }
  }

  async function handleDownload(doc: AdminDocument) {
    setDownloading(doc.id);
    try {
      const blob = await downloadAdminDocument(doc.id);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = doc.file_name ?? `document-${doc.id}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed.');
    } finally {
      setDownloading(null);
    }
  }

  async function handleArchive(id: number) {
    setArchiving(id);
    try {
      await archiveDocument(id);
      setResult((prev) => prev ? { ...prev, data: prev.data.filter((d) => d.id !== id) } : prev);
      toast.success('Document archived.');
    } catch {
      toast.error('Failed to archive document.');
    } finally {
      setArchiving(null);
    }
  }

  async function handleRestore(id: number) {
    setArchiving(id);
    try {
      await restoreDocument(id);
      setResult((prev) => prev ? { ...prev, data: prev.data.filter((d) => d.id !== id) } : prev);
      toast.success('Document restored.');
    } catch {
      toast.error('Failed to restore document.');
    } finally {
      setArchiving(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocument(deleteTarget.id);
      setResult((prev) => prev ? { ...prev, data: prev.data.filter((d) => d.id !== deleteTarget.id) } : prev);
      toast.success('Document permanently deleted.');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete document.');
    } finally {
      setDeleting(false);
    }
  }

  const docs          = result?.data ?? [];
  const pendingCount  = docs.filter((d) => d.verification_status === 'pending').length;
  const hasActiveFilter = filters.search || filters.status;

  // Client-side scanning filter (API may not support it directly)
  const displayedDocs = filters.status === 'scanning'
    ? docs.filter((d) => d.scan_passed === null)
    : docs;

  return (
    <>
      {/* Document viewer modal */}
      {viewTargetId !== null && (
        <DocumentViewerModal
          docId={viewTargetId}
          allDocs={displayedDocs}
          onClose={() => setViewTargetId(null)}
          onNavigate={setViewTargetId}
          onVerify={handleVerify}
          onDownload={handleDownload}
          verifying={verifying}
          downloading={downloading}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          docName={deleteTarget.file_name ?? 'this document'}
          onConfirm={() => void handleDeleteConfirm()}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      <div className="flex flex-col gap-6 max-w-6xl">

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
              Document Intake
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Review, verify, and manage documents submitted by applicants.
            </p>
          </div>
          {!loading && pendingCount > 0 && tab === 'active' && (
            <div
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(245,158,11,0.10)', color: '#b45309', border: '1px solid rgba(245,158,11,0.25)' }}
            >
              <Clock className="h-4 w-4" />
              {pendingCount} pending review
            </div>
          )}
        </div>

        {/* ── Queue summary ─────────────────────────────────────── */}
        {!loading && !error && (
          <QueueSummary docs={docs} tab={tab} />
        )}

        {/* ── Active / Archived tabs ────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--muted)' }}>
          {(['active', 'archived'] as DocTab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); setFilters(DEFAULT_FILTERS); setSearchInput(''); }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize"
              style={{
                background: tab === t ? 'var(--card)' : 'transparent',
                color: tab === t ? 'var(--foreground)' : 'var(--muted-foreground)',
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {t === 'active' ? <Eye className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              {t === 'active' ? 'Active Documents' : 'Archived Documents'}
            </button>
          ))}
        </div>

        {/* ── Search + Status filters ───────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              placeholder="Search by uploader, camper, or document name…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
            {searchInput && (
              <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status filter pills */}
          <div className="flex flex-wrap gap-2">
            {(['', 'pending', 'scanning', 'approved', 'rejected'] as StatusFilter[]).map((s) => {
              const labels: Record<string, string> = { '': 'All', pending: 'Pending', scanning: 'Scanning', approved: 'Approved', rejected: 'Rejected' };
              const active = filters.status === s;
              return (
                <button
                  key={s}
                  onClick={() => handleStatusFilter(s)}
                  className="px-3 py-2 rounded-xl border text-xs font-medium transition-colors"
                  style={{
                    background: active ? 'var(--ember-orange)' : 'var(--input)',
                    color: active ? '#fff' : 'var(--foreground)',
                    borderColor: active ? 'var(--ember-orange)' : 'var(--border)',
                  }}
                >
                  {labels[s]}
                </button>
              );
            })}
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border text-xs transition-colors hover:bg-[var(--muted)]"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Document list ─────────────────────────────────────── */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          {loading ? (
            <div className="p-4"><SkeletonTable rows={5} /></div>
          ) : error ? (
            <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />
          ) : displayedDocs.length === 0 ? (
            <EmptyState
              title={tab === 'archived' ? 'No archived documents' : 'No documents found'}
              description={
                hasActiveFilter ? 'Try adjusting your filters.'
                : tab === 'archived' ? 'Documents you archive will appear here.'
                : 'No documents have been submitted yet.'
              }
              icon={FileText}
            />
          ) : (
            <>
              <motion.div variants={staggerContainerVariants} initial="hidden" animate="visible">
                {displayedDocs.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    tab={tab}
                    onPreview={(d) => setViewTargetId(d.id)}
                    onVerify={handleVerify}
                    onDownload={handleDownload}
                    onArchive={handleArchive}
                    onRestore={handleRestore}
                    onDeleteRequest={setDeleteTarget}
                    verifying={verifying}
                    downloading={downloading}
                    archiving={archiving}
                  />
                ))}
              </motion.div>
              {result && <Pagination meta={result.meta} onPage={(p) => setPage(p)} />}
            </>
          )}
        </div>

      </div>
    </>
  );
}
