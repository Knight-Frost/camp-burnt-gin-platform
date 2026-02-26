/**
 * DocumentUploader.tsx
 * Drag-and-drop file upload component with progress bars.
 * Accepts PDF and image files. Wires to POST /api/documents (multipart).
 */

import { useCallback, useRef, useState, type DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import axiosInstance from '@/api/axios.config';
import type { Document } from '@/shared/types';
import { cn } from '@/shared/utils/cn';
import { fadeVariants } from '@/shared/constants/motion';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 10;

interface UploadedFile {
  id: string; // local key
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  document?: Document;
  error?: string;
}

interface DocumentUploaderProps {
  onUploaded: (document: Document) => void;
  onRemoved: (documentId: number) => void;
  label?: string;
  hint?: string;
}

export function DocumentUploader({
  onUploaded,
  onRemoved,
  label = 'Upload documents',
  hint = 'PDF, JPG, PNG up to 10 MB each',
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (localFile: UploadedFile) => {
    const formData = new FormData();
    formData.append('file', localFile.file);

    setFiles((prev) =>
      prev.map((f) =>
        f.id === localFile.id ? { ...f, status: 'uploading', progress: 0 } : f
      )
    );

    try {
      const { data } = await axiosInstance.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          const progress = event.total
            ? Math.round((event.loaded * 100) / event.total)
            : 0;
          setFiles((prev) =>
            prev.map((f) =>
              f.id === localFile.id ? { ...f, progress } : f
            )
          );
        },
      });

      const document = data.data as Document;
      setFiles((prev) =>
        prev.map((f) =>
          f.id === localFile.id
            ? { ...f, status: 'success', progress: 100, document }
            : f
        )
      );
      onUploaded(document);
    } catch {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === localFile.id
            ? { ...f, status: 'error', error: 'Upload failed. Please try again.' }
            : f
        )
      );
    }
  };

  const addFiles = useCallback(
    (incoming: File[]) => {
      const valid = incoming.filter((file) => {
        if (!ACCEPTED_TYPES.includes(file.type)) return false;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) return false;
        return true;
      });

      const newFiles: UploadedFile[] = valid.map((file) => ({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: 'pending',
      }));

      setFiles((prev) => [...prev, ...newFiles]);
      newFiles.forEach(uploadFile);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleRemove = (localFile: UploadedFile) => {
    if (localFile.document) {
      onRemoved(localFile.document.id);
    }
    setFiles((prev) => prev.filter((f) => f.id !== localFile.id));
  };

  return (
    <div className="flex flex-col gap-4">
      {label && (
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          {label}
        </p>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer',
          'transition-all duration-300',
          isDragging ? 'border-ember-orange' : 'border-on-image-border hover:border-ember-orange/60'
        )}
        style={{
          background: isDragging ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
          aria-hidden="true"
        />

        <Upload
          className="h-8 w-8 mx-auto mb-3"
          style={{ color: isDragging ? 'var(--ember-orange)' : 'var(--muted-foreground)' }}
        />
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          Drop files here or{' '}
          <span className="text-ember-orange">click to browse</span>
        </p>
        {hint && (
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {hint}
          </p>
        )}
      </div>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.ul
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-2"
          >
            {files.map((f) => (
              <motion.li
                key={f.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 rounded-xl border px-4 py-3"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderColor: f.status === 'error'
                    ? 'rgba(248,113,113,0.3)'
                    : f.status === 'success'
                    ? 'rgba(16,185,129,0.3)'
                    : 'var(--border)',
                }}
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  {f.status === 'success' ? (
                    <CheckCircle className="h-5 w-5" style={{ color: 'var(--forest-green)' }} />
                  ) : f.status === 'error' ? (
                    <AlertCircle className="h-5 w-5" style={{ color: 'var(--destructive)' }} />
                  ) : (
                    <File className="h-5 w-5" style={{ color: 'var(--muted-foreground)' }} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {f.file.name}
                  </p>
                  {f.status === 'uploading' && (
                    <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'var(--ember-orange)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${f.progress}%` }}
                        transition={{ ease: 'linear' }}
                      />
                    </div>
                  )}
                  {f.status === 'error' && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--destructive)' }}>
                      {f.error}
                    </p>
                  )}
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => handleRemove(f)}
                  className="flex-shrink-0 p-1 rounded hover:bg-[var(--dash-nav-hover-bg)]"
                  style={{ color: 'var(--muted-foreground)' }}
                  aria-label={`Remove ${f.file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
