/**
 * AdminAnnouncementsPage.tsx
 * Create, schedule, pin, and manage announcements.
 */

import { useEffect, useState, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pin, AlertTriangle, X, Trash2, Edit2, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import {
  getAnnouncements, createAnnouncement, updateAnnouncement,
  deleteAnnouncement, toggleAnnouncementPin,
  type Announcement, type CreateAnnouncementPayload,
} from '@/features/admin/api/announcements.api';
import { Button } from '@/ui/components/Button';
import { SkeletonCard } from '@/ui/components/Skeletons';
import { EmptyState, ErrorState } from '@/ui/components/EmptyState';
import {
  scrollRevealVariants, staggerContainerVariants, staggerChildVariants,
  modalBackdrop, modalContent,
} from '@/shared/constants/motion';

const AUDIENCE_LABELS: Record<string, string> = {
  all:      'All Applicants',
  accepted: 'Accepted Only',
  staff:    'Staff Only',
  session:  'Specific Session',
};

const DEFAULT_FORM: CreateAnnouncementPayload = {
  title:      '',
  body:       '',
  is_pinned:  false,
  is_urgent:  false,
  audience:   'all',
  target_session_id: null,
  published_at: null,
};

function inputStyle() {
  return {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(0,0,0,0.12)',
    fontSize: '0.9375rem',
    background: '#f9fafb',
    color: 'var(--foreground)',
    outline: 'none',
  } as CSSProperties;
}

export function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(false);
  const [retryKey, setRetryKey]           = useState(0);
  const [showModal, setShowModal]         = useState(false);
  const [editing, setEditing]             = useState<Announcement | null>(null);
  const [form, setForm]                   = useState<CreateAnnouncementPayload>(DEFAULT_FORM);
  const [saving, setSaving]               = useState(false);
  const [deletingId, setDeletingId]       = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getAnnouncements(50)
      .then((res) => { if (!cancelled) setAnnouncements(res.data ?? []); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retryKey]);

  function openCreate() {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setShowModal(true);
  }

  function openEdit(ann: Announcement) {
    setEditing(ann);
    setForm({
      title:      ann.title,
      body:       ann.body,
      is_pinned:  ann.is_pinned,
      is_urgent:  ann.is_urgent,
      audience:   ann.audience,
      target_session_id: ann.target_session_id,
      published_at: ann.published_at,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Title and body are required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateAnnouncement(editing.id, form);
        setAnnouncements((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        toast.success('Announcement updated.');
      } else {
        const created = await createAnnouncement(form);
        setAnnouncements((prev) => [created, ...prev]);
        toast.success('Announcement created.');
      }
      setShowModal(false);
    } catch {
      toast.error('Failed to save announcement.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast.success('Announcement deleted.');
    } catch {
      toast.error('Failed to delete announcement.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handlePin(ann: Announcement) {
    try {
      const res = await toggleAnnouncementPin(ann.id);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === ann.id ? { ...a, is_pinned: res.is_pinned } : a))
      );
    } catch {
      toast.error('Failed to update pin.');
    }
  }

  const pinned   = announcements.filter((a) => a.is_pinned);
  const unpinned = announcements.filter((a) => !a.is_pinned);

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      {/* Header */}
      <motion.div variants={scrollRevealVariants} initial="hidden" animate="visible">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--ember-orange)' }}>
              Communications
            </p>
            <h2 className="text-2xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
              Announcements
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Create, schedule, and manage announcements for applicants and staff.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Announcement
          </Button>
        </div>
      </motion.div>

      {error ? (
        <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />
      ) : loading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map((i) => <SkeletonCard key={i} lines={2} />)}
        </div>
      ) : announcements.length === 0 ? (
        <div className="rounded-2xl border p-8" style={{ borderColor: 'var(--border)' }}>
          <EmptyState
            title="No announcements yet"
            description="Create your first announcement to notify applicants and staff."
            action={{ label: 'New Announcement', onClick: openCreate }}
          />
        </div>
      ) : (
        <motion.div variants={staggerContainerVariants} initial="hidden" animate="visible" className="flex flex-col gap-3">
          {/* Pinned */}
          {pinned.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Pin className="h-3.5 w-3.5" style={{ color: 'var(--ember-orange)' }} />
                <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  Pinned
                </p>
              </div>
              {pinned.map((ann) => (
                <AnnouncementRow
                  key={ann.id}
                  ann={ann}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onPin={handlePin}
                  deleting={deletingId === ann.id}
                />
              ))}
              {unpinned.length > 0 && (
                <div className="flex items-center gap-2 mt-3 mb-1">
                  <Megaphone className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
                  <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    All Announcements
                  </p>
                </div>
              )}
            </>
          )}
          {unpinned.map((ann) => (
            <AnnouncementRow
              key={ann.id}
              ann={ann}
              onEdit={openEdit}
              onDelete={handleDelete}
              onPin={handlePin}
              deleting={deletingId === ann.id}
            />
          ))}
        </motion.div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            variants={modalBackdrop}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              variants={modalContent}
              className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
              style={{ background: '#ffffff', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
                  {editing ? 'Edit Announcement' : 'New Announcement'}
                </h3>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)]" style={{ color: 'var(--muted-foreground)' }}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label htmlFor="ann-title" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Title *</label>
                  <input id="ann-title" style={inputStyle()} placeholder="Announcement title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="ann-body" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Body *</label>
                  <textarea id="ann-body" style={{ ...inputStyle(), height: 96, resize: 'none' }} placeholder="Announcement body…" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="ann-audience" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Audience</label>
                  <select id="ann-audience" style={inputStyle()} value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as CreateAnnouncementPayload['audience'] }))}>
                    {Object.entries(AUDIENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ann-publish-at" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Schedule Publish Date (optional)</label>
                  <input id="ann-publish-at" type="datetime-local" style={inputStyle()} value={form.published_at ?? ''} onChange={(e) => setForm((f) => ({ ...f, published_at: e.target.value || null }))} />
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>Leave blank to publish immediately.</p>
                </div>
                <div className="flex gap-6">
                  <label htmlFor="ann-pinned" className="flex items-center gap-2 cursor-pointer">
                    <input id="ann-pinned" type="checkbox" className="w-4 h-4 rounded" checked={!!form.is_pinned} onChange={(e) => setForm((f) => ({ ...f, is_pinned: e.target.checked }))} />
                    <span className="text-sm" style={{ color: 'var(--foreground)' }}>Pin announcement</span>
                  </label>
                  <label htmlFor="ann-urgent" className="flex items-center gap-2 cursor-pointer">
                    <input id="ann-urgent" type="checkbox" className="w-4 h-4 rounded" checked={!!form.is_urgent} onChange={(e) => setForm((f) => ({ ...f, is_urgent: e.target.checked }))} />
                    <span className="text-sm" style={{ color: 'var(--foreground)' }}>Mark as urgent</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button variant="primary" size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function AnnouncementRow({
  ann, onEdit, onDelete, onPin, deleting,
}: {
  ann: Announcement;
  onEdit: (a: Announcement) => void;
  onDelete: (id: number) => void;
  onPin: (a: Announcement) => void;
  deleting: boolean;
}) {
  return (
    <motion.div
      variants={staggerChildVariants}
      className="rounded-2xl border px-5 py-4"
      style={{
        background: ann.is_urgent ? 'rgba(220,38,38,0.03)' : '#ffffff',
        borderColor: ann.is_urgent ? 'rgba(220,38,38,0.18)' : 'var(--border)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {ann.is_pinned && <Pin className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />}
            {ann.is_urgent && (
              <span className="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' }}>
                <AlertTriangle className="h-3 w-3" />
                Urgent
              </span>
            )}
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{ann.title}</p>
          </div>
          <p className="text-xs leading-relaxed line-clamp-2 mb-2" style={{ color: 'var(--muted-foreground)' }}>{ann.body}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--dash-nav-active-bg)', color: 'var(--ember-orange)' }}>
              {AUDIENCE_LABELS[ann.audience] ?? ann.audience}
            </span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {format(new Date(ann.published_at ?? ann.created_at), 'MMM d, yyyy')}
            </span>
            {ann.author && (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>by {ann.author.name}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onPin(ann)}
            className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
            style={{ color: ann.is_pinned ? 'var(--ember-orange)' : 'var(--muted-foreground)' }}
            title={ann.is_pinned ? 'Unpin' : 'Pin'}
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onEdit(ann)}
            className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            title="Edit"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(ann.id)}
            disabled={deleting}
            className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
            style={{ color: 'var(--destructive)' }}
            title="Delete"
          >
            {deleting ? (
              <div className="w-3.5 h-3.5 border border-red-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
