/**
 * ConfirmDialog.tsx
 *
 * Reusable confirmation dialog — replaces window.confirm entirely.
 * - Renders via React portal
 * - Focus trap (confirm button auto-focused)
 * - Escape key → cancel
 * - Click outside backdrop → cancel
 * - z-[600] (above compose panel, below nothing)
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'default';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_COLORS: Record<ConfirmVariant, { bg: string; text: string }> = {
  danger:  { bg: 'var(--destructive)', text: '#ffffff' },
  warning: { bg: 'var(--warm-amber)',  text: '#ffffff' },
  default: { bg: 'var(--ember-orange)', text: '#ffffff' },
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Auto-focus confirm button when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => confirmRef.current?.focus(), 50);
    }
  }, [open]);

  // Escape key → cancel
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  const colors = VARIANT_COLORS[variant];

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0"
            style={{ zIndex: 599, background: 'rgba(0,0,0,0.40)' }}
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
            style={{ zIndex: 600 }}
          >
            <div
              className="w-full max-w-sm rounded-2xl p-6 pointer-events-auto"
              style={{
                background: '#ffffff',
                boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Icon + Title */}
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${colors.bg}18` }}
                >
                  <AlertTriangle className="h-5 w-5" style={{ color: colors.bg }} />
                </div>
                <div>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                    {title}
                  </h3>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {message}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 mt-5">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                  style={{ color: 'var(--foreground)' }}
                >
                  {cancelLabel}
                </button>
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={onConfirm}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-90"
                  style={{ background: colors.bg, color: colors.text }}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
