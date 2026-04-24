/**
 * InlineRequestDocumentButton — a small "Request Document" button + modal
 * scoped to a specific application/camper context.
 *
 * When opened from the application review page, parent/camper/application are
 * already known so admin only needs to choose: document type, instructions, due date.
 */

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { createDocumentRequest, type DocumentRequest } from '@/features/admin/api/admin.api';

interface Props {
  /** The applicant's user ID (required to create the request). */
  applicantId: number;
  /** The camper's ID (for scoping). */
  camperId: number | null;
  /** The application's ID (for scoping). */
  applicationId: number;
  /** Camper's display name for confirmation messages. */
  camperName: string;
  /** Called after a request is successfully created. */
  onCreated?: (req: DocumentRequest) => void;
}

const COMMON_DOCUMENT_TYPES = [
  'immunization_record',
  'insurance_card',
  'official_medical_form',
  'physician_clearance',
  'allergy_action_plan',
  'seizure_action_plan',
  'asthma_action_plan',
  'epi_pen_authorization',
  'diabetes_management_plan',
  'other',
];

function formatDocumentTypeLabel(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function InlineRequestDocumentButton({
  applicantId,
  camperId,
  applicationId,
  camperName,
  onCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    document_type: '',
    custom_document_type: '',
    instructions: '',
    due_date: '',
  });

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const effectiveDocumentType = form.document_type === 'other'
    ? form.custom_document_type.trim()
    : form.document_type;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!effectiveDocumentType) return;

    setSaving(true);
    try {
      const req = await createDocumentRequest({
        applicant_id: applicantId,
        camper_id: camperId ?? undefined,
        application_id: applicationId,
        document_type: effectiveDocumentType,
        instructions: form.instructions || undefined,
        due_date: form.due_date || undefined,
      });
      toast.success(`Document requested: ${effectiveDocumentType}`);
      setOpen(false);
      setForm({ document_type: '', custom_document_type: '', instructions: '', due_date: '' });
      onCreated?.(req);
    } catch {
      toast.error('Failed to create document request. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-opacity hover:opacity-80"
        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--glass-light)' }}
      >
        <Plus className="h-3.5 w-3.5" />
        Request Document
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="req-doc-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={() => { if (!saving) setOpen(false); }}
        disabled={saving}
        className="absolute inset-0 w-full h-full cursor-default"
        style={{ background: 'rgba(0,0,0,0.5)' }}
      />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="req-doc-title" className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Request Document
          </h2>
          <button
            type="button"
            onClick={() => { if (!saving) setOpen(false); }}
            disabled={saving}
            className="rounded-lg p-1 hover:opacity-70 transition-opacity"
          >
            <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Pre-filled context */}
        <div
          className="rounded-lg px-3 py-2 mb-4 text-xs"
          style={{ background: 'var(--glass-medium)', color: 'var(--muted-foreground)' }}
        >
          <strong style={{ color: 'var(--foreground)' }}>Camper:</strong> {camperName}
          {' · '}
          <strong style={{ color: 'var(--foreground)' }}>Application #</strong>{applicationId}
        </div>

        {/* Document type */}
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
            Document Type <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <select
            value={form.document_type}
            onChange={(e) => set('document_type', e.target.value)}
            required
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ background: 'var(--glass-light)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <option value="">Select a document type…</option>
            {COMMON_DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>{formatDocumentTypeLabel(type)}</option>
            ))}
          </select>
        </div>

        {form.document_type === 'other' && (
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
              Specify Document Type <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={form.custom_document_type}
              onChange={(e) => set('custom_document_type', e.target.value)}
              required
              placeholder="e.g. Therapy Authorization Form"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ background: 'var(--glass-light)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
        )}

        {/* Instructions */}
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
            Instructions <span style={{ color: 'var(--muted-foreground)' }}>(optional)</span>
          </label>
          <textarea
            value={form.instructions}
            onChange={(e) => set('instructions', e.target.value)}
            rows={2}
            placeholder="What the applicant needs to do or provide…"
            className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
            style={{ background: 'var(--glass-light)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        {/* Due date */}
        <div className="mb-5">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
            Due Date <span style={{ color: 'var(--muted-foreground)' }}>(optional)</span>
          </label>
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => set('due_date', e.target.value)}
            min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ background: 'var(--glass-light)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { if (!saving) setOpen(false); }}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm border transition-opacity hover:opacity-70"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !effectiveDocumentType}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {saving ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
