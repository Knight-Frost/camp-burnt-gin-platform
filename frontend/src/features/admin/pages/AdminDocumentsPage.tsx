/**
 * AdminDocumentsPage.tsx
 *
 * Purpose: Admin document inbox — view, verify, and download all documents
 *          submitted by applicants.
 * Responsibilities:
 *   - Fetch paginated documents from the API with search + verification_status filters
 *   - Debounce text search (300ms) while applying dropdown filter changes immediately
 *   - Allow admins to approve or reject individual documents inline
 *   - Allow admins to download documents (blocked if security scan failed)
 *   - Display verification badge, scan status badge, uploader name, and camper name per row
 *
 * Plain-English: Think of this page as a mail room where every document a
 * parent uploads lands first. Admins can stamp each one "Approved", "Rejected",
 * or download it to read it — but only after it passes the security scanner.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
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
  Filter,
  Loader2,
  User,
  X,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Converts raw byte count into a human-readable string (B / KB / MB)
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Shows a red PDF icon for PDFs and a blue generic icon for everything else
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

// Color-coded pill showing the admin's verification decision
function VerificationBadge({ status }: { status: AdminDocument['verification_status'] }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
        style={{ background: 'rgba(5,150,105,0.10)', color: 'var(--forest-green)' }}>
        <CheckCircle className="h-3 w-3" /> Approved
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
        style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' }}>
        <XCircle className="h-3 w-3" /> Rejected
      </span>
    );
  }
  // Default: pending — not yet acted on
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}

// Shows a "Failed scan" or "Scanning" badge; returns null when the scan passed (no badge needed)
function ScanBadge({ scanPassed }: { scanPassed: boolean | null }) {
  if (scanPassed === false) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' }}>
        <AlertCircle className="h-3 w-3" /> Failed scan
      </span>
    );
  }
  if (scanPassed === null) {
    // null means the scan is still in progress on the server side
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(96,165,250,0.10)', color: 'var(--night-sky-blue)' }}>
        <Clock className="h-3 w-3" /> Scanning
      </span>
    );
  }
  return null; // passed scan — no badge needed
}

// ─── Filters bar ──────────────────────────────────────────────────────────────

// Consolidated filter state to prevent double-fetch race conditions
interface Filters {
  search: string;
  verification_status: '' | 'pending' | 'approved' | 'rejected';
}

function FiltersBar({
  filters,
  onChange,
  onClear,
}: {
  filters: Filters;
  onChange: (f: Partial<Filters>) => void;
  onClear: () => void;
}) {
  // Determine if any filter is active so the "Clear" button appears
  const hasActive = filters.search !== '' || filters.verification_status !== '';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Text search — debounced by the parent via handleFilterChange */}
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
        <input
          type="text"
          placeholder="Search by uploader name…"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        />
      </div>

      {/* Verification status dropdown — applied immediately (no debounce) */}
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
        <select
          value={filters.verification_status}
          onChange={(e) => onChange({ verification_status: e.target.value as Filters['verification_status'] })}
          className="pl-8 pr-4 py-2 text-sm rounded-lg border outline-none focus:ring-1 focus:ring-[var(--ember-orange)] appearance-none"
          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Clear button only visible when at least one filter is active */}
      {hasActive && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}

// ─── Document row ─────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  onVerify,
  onDownload,
  verifying,
  downloading,
}: {
  doc: AdminDocument;
  onVerify: (id: number, status: 'approved' | 'rejected') => Promise<void>;
  onDownload: (doc: AdminDocument) => Promise<void>;
  // Track which document ID is currently being verified/downloaded for per-row spinners
  verifying: number | null;
  downloading: number | null;
}) {
  return (
    <motion.div
      variants={staggerChildVariants}
      className="flex items-start gap-4 px-6 py-5 border-b last:border-b-0"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* File type icon derived from MIME type */}
      <FileIcon mime={doc.mime_type} />

      {/* Main info — two-column grid on wider screens */}
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
        {/* File name and document type label */}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
            {doc.file_name}
          </p>
          {doc.document_type && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {doc.document_type}
            </p>
          )}
        </div>

        {/* Metadata column: uploader, camper, size, date */}
        <div className="flex flex-col gap-0.5">
          {doc.uploaded_by_name && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{doc.uploaded_by_name}</span>
            </div>
          )}
          {/* documentable_name is the camper this file belongs to */}
          {doc.documentable_name && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <FileText className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">Camper: {doc.documentable_name}</span>
            </div>
          )}
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {formatBytes(doc.size)} &middot; {format(new Date(doc.created_at), 'MMM d, yyyy')}
          </p>
        </div>

        {/* Status badges spanning both columns */}
        <div className="flex flex-wrap items-center gap-2 mt-1 sm:col-span-2">
          <VerificationBadge status={doc.verification_status} />
          <ScanBadge scanPassed={doc.scan_passed} />
        </div>
      </div>

      {/* Action buttons: download, approve, reject */}
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        {/* Download disabled when scan failed — unsafe file */}
        <button
          onClick={() => void onDownload(doc)}
          disabled={downloading === doc.id || doc.scan_passed === false}
          title={doc.scan_passed === false ? 'Failed security scan — cannot download' : 'Download'}
          className="p-1.5 rounded-lg border transition-colors disabled:opacity-40 hover:bg-[var(--dash-nav-hover-bg)]"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          {downloading === doc.id
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Download className="h-4 w-4" />
          }
        </button>

        {/* Approve button hidden if already approved — avoids redundant action */}
        {doc.verification_status !== 'approved' && (
          <button
            onClick={() => void onVerify(doc.id, 'approved')}
            disabled={verifying === doc.id}
            title="Approve document"
            className="p-1.5 rounded-lg border transition-colors disabled:opacity-40 hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ borderColor: 'rgba(5,150,105,0.35)', color: 'var(--forest-green)' }}
          >
            {verifying === doc.id
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <CheckCircle className="h-4 w-4" />
            }
          </button>
        )}

        {/* Reject button hidden if already rejected */}
        {doc.verification_status !== 'rejected' && (
          <button
            onClick={() => void onVerify(doc.id, 'rejected')}
            disabled={verifying === doc.id}
            title="Reject document"
            className="p-1.5 rounded-lg border transition-colors disabled:opacity-40 hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ borderColor: 'rgba(220,38,38,0.3)', color: 'var(--destructive)' }}
          >
            {verifying === doc.id
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <XCircle className="h-4 w-4" />
            }
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Pagination controls ──────────────────────────────────────────────────────

function Pagination({
  meta,
  onPage,
}: {
  meta: PaginatedResponse<AdminDocument>['meta'];
  onPage: (page: number) => void;
}) {
  // No pagination UI needed on a single-page result set
  if (meta.last_page <= 1) return null;
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
      <span>
        Page {meta.current_page} of {meta.last_page} &nbsp;·&nbsp; {meta.total} documents
      </span>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={meta.current_page <= 1}
          onClick={() => onPage(meta.current_page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={meta.current_page >= meta.last_page}
          onClick={() => onPage(meta.current_page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = { search: '', verification_status: '' };

export function AdminDocumentsPage() {
  const [result, setResult]       = useState<PaginatedResponse<AdminDocument> | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  // Consolidated filter object avoids double-fetch race conditions from separate useState calls
  const [filters, setFilters]     = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage]           = useState(1);
  // Track which document ID is being verified to show a per-row spinner
  const [verifying, setVerifying] = useState<number | null>(null);
  // Track which document ID is being downloaded to show a per-row spinner
  const [downloading, setDownloading] = useState<number | null>(null);
  // Increment to force a re-fetch after a network error (retryKey pattern)
  const [retryKey, setRetryKey]   = useState(0);

  // Timer ref for debouncing the search input
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable fetch function — recreated only when page, filters, or retryKey changes
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params: Parameters<typeof getAdminDocuments>[0] = { page };
      // Only add optional params when they have a value — keeps the URL clean
      if (filters.search) params.search = filters.search;
      if (filters.verification_status) params.verification_status = filters.verification_status;
      const res = await getAdminDocuments(params);
      setResult(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, filters, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch whenever the stable `load` function reference changes
  useEffect(() => { void load(); }, [load]);

  // Text search: debounced 300ms so we don't hit the API on every keystroke
  function handleFilterChange(partial: Partial<Filters>) {
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, ...partial }));
    }, 300);
  }

  // Dropdown filter: applied immediately since the user made a deliberate selection
  function handleFilterChangeDirect(partial: Partial<Filters>) {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...partial }));
  }

  // Approve or reject a document, then optimistically update the local list in place
  async function handleVerify(id: number, status: 'approved' | 'rejected') {
    setVerifying(id);
    try {
      const updated = await verifyDocument(id, status);
      // Replace only the updated document in the existing list — no full re-fetch needed
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

  // Download via blob — creates a temporary object URL, clicks it, then revokes to free memory
  async function handleDownload(doc: AdminDocument) {
    setDownloading(doc.id);
    try {
      const blob = await downloadAdminDocument(doc.id);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = doc.file_name ?? `document-${doc.id}`;
      a.click();
      // Revoke immediately after click to avoid memory leaks
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed. The file may be pending security review.');
    } finally {
      setDownloading(null);
    }
  }

  const docs    = result?.data ?? [];
  // Count pending documents to show the attention badge in the header
  const pending = docs.filter((d) => d.verification_status === 'pending').length;

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header with optional pending-count badge */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
            Documents
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            All documents submitted by applicants. Review and verify before application approval.
          </p>
        </div>
        {/* Amber badge only shown when there are documents waiting for review */}
        {pending > 0 && (
          <div
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(245,158,11,0.10)', color: '#b45309' }}
          >
            <Clock className="h-4 w-4" />
            {pending} pending
          </div>
        )}
      </div>

      {/* Filter bar — routes search to debounced handler, dropdown to direct handler */}
      <FiltersBar
        filters={filters}
        onChange={(p) => {
          if ('search' in p) {
            handleFilterChange(p);
          } else {
            handleFilterChangeDirect(p);
          }
        }}
        onClear={() => { setPage(1); setFilters(DEFAULT_FILTERS); }}
      />

      {/* Document list card */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={5} />
          </div>
        ) : error ? (
          // Clicking Retry increments retryKey which triggers the useCallback/useEffect chain
          <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />
        ) : docs.length === 0 ? (
          <EmptyState
            title="No documents found"
            description={
              filters.search || filters.verification_status
                ? 'Try adjusting your filters.'
                : 'No documents have been submitted yet.'
            }
            icon={FileText}
          />
        ) : (
          <>
            {/* Stagger animation so each row fades in sequentially */}
            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
            >
              {docs.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  onVerify={handleVerify}
                  onDownload={handleDownload}
                  verifying={verifying}
                  downloading={downloading}
                />
              ))}
            </motion.div>
            {result && (
              <Pagination meta={result.meta} onPage={(p) => setPage(p)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
