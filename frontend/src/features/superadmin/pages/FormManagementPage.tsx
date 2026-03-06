/**
 * FormManagementPage.tsx
 * Super admin — manage application form templates (upload PDF/Word, activate/deactivate, assign to sessions).
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Trash2, ToggleLeft, ToggleRight, Plus, X, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import axiosInstance from '@/api/axios.config';
import { getSessions } from '@/features/admin/api/admin.api';
import type { CampSession } from '@/features/admin/types/admin.types';
import { Button } from '@/ui/components/Button';
import { SkeletonCard } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { scrollRevealVariants, staggerContainerVariants, staggerChildVariants, modalBackdrop, modalContent } from '@/shared/constants/motion';

interface FormTemplate {
  id: number;
  name: string;
  file_name: string;
  file_type: 'pdf' | 'docx' | 'online';
  is_active: boolean;
  version: number;
  session_id: number | null;
  created_at: string;
  updated_at: string;
}

export function FormManagementPage() {
  const [templates, setTemplates]   = useState<FormTemplate[]>([]);
  const [sessions, setSessions]     = useState<CampSession[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [formName, setFormName]     = useState('');
  const [file, setFile]             = useState<File | null>(null);
  const [sessionId, setSessionId]   = useState('');
  const [nameError, setNameError]   = useState('');
  const [fileError, setFileError]   = useState('');

  useEffect(() => {
    loadTemplates();
    getSessions().then(setSessions).catch(() => {/* sessions optional */});
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await axiosInstance.get<{ data: FormTemplate[] }>('/form-templates');
      setTemplates(res.data.data ?? []);
    } catch {
      // API may not exist yet — show empty state
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  function openModal() {
    setFormName('');
    setFile(null);
    setSessionId('');
    setNameError('');
    setFileError('');
    setShowModal(true);
  }

  async function handleUpload() {
    let valid = true;
    if (!formName.trim()) { setNameError('Form name is required.'); valid = false; } else { setNameError(''); }
    if (!file)            { setFileError('Please select a file.'); valid = false; } else { setFileError(''); }
    if (!valid) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('name', formName.trim());
      fd.append('file', file!);
      if (sessionId) fd.append('session_id', sessionId);

      // Do NOT set Content-Type manually — axios auto-sets multipart/form-data with boundary
      const res = await axiosInstance.post<{ data: FormTemplate }>('/form-templates', fd);
      setTemplates((prev) => [res.data.data, ...prev]);
      toast.success('Form template uploaded.');
      setShowModal(false);
    } catch {
      toast.error('Failed to upload template.');
    } finally {
      setUploading(false);
    }
  }

  async function handleToggle(tmpl: FormTemplate) {
    try {
      const res = await axiosInstance.patch<{ data: FormTemplate }>(`/form-templates/${tmpl.id}`, {
        is_active: !tmpl.is_active,
      });
      setTemplates((prev) => prev.map((t) => (t.id === tmpl.id ? res.data.data : t)));
      toast.success(tmpl.is_active ? 'Form deactivated.' : 'Form activated.');
    } catch {
      toast.error('Failed to update status.');
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await axiosInstance.delete(`/form-templates/${id}`);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success('Template deleted.');
    } catch {
      toast.error('Failed to delete template.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownload(tmpl: FormTemplate) {
    try {
      const res = await axiosInstance.get(`/form-templates/${tmpl.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = tmpl.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download template.');
    }
  }

  const TYPE_ICONS: Record<string, string> = { pdf: '📄', docx: '📝', online: '🌐' };
  const TYPE_LABELS: Record<string, string> = { pdf: 'PDF', docx: 'Word (.docx)', online: 'Online Form' };

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      {/* Header */}
      <motion.div variants={scrollRevealVariants} initial="hidden" animate="visible">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--ember-orange)' }}>
              Super Admin
            </p>
            <h2 className="text-2xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
              Form Management
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Upload, activate, and assign application form templates to sessions.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={openModal}>
            <Plus className="h-4 w-4" />
            Upload Template
          </Button>
        </div>
      </motion.div>

      {/* Info cards */}
      <motion.div
        variants={staggerContainerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {[
          { label: 'Total Templates', value: templates.length },
          { label: 'Active',          value: templates.filter((t) => t.is_active).length },
          { label: 'Inactive',        value: templates.filter((t) => !t.is_active).length },
        ].map(({ label, value }) => (
          <motion.div
            key={label}
            variants={staggerChildVariants}
            className="rounded-2xl border px-5 py-4"
            style={{ background: '#ffffff', borderColor: 'var(--border)' }}
          >
            <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
            <p className="text-3xl font-headline font-bold" style={{ color: 'var(--ember-orange)' }}>{value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Templates list */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map((i) => <SkeletonCard key={i} lines={2} />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border p-8" style={{ borderColor: 'var(--border)' }}>
          <EmptyState
            title="No form templates yet"
            description="Upload a PDF or Word document to use as an application template."
            action={{ label: 'Upload Template', onClick: openModal }}
          />
        </div>
      ) : (
        <motion.div variants={staggerContainerVariants} initial="hidden" animate="visible" className="flex flex-col gap-3">
          {templates.map((tmpl) => (
            <motion.div
              key={tmpl.id}
              variants={staggerChildVariants}
              className="rounded-2xl border px-5 py-4 flex items-center gap-4"
              style={{ background: '#ffffff', borderColor: 'var(--border)' }}
            >
              <div className="text-2xl flex-shrink-0">{TYPE_ICONS[tmpl.file_type] ?? '📄'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{tmpl.name}</p>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: tmpl.is_active ? 'rgba(22,163,74,0.10)' : 'rgba(107,114,128,0.10)',
                      color: tmpl.is_active ? '#16a34a' : '#6b7280',
                    }}
                  >
                    {tmpl.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                    v{tmpl.version}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {TYPE_LABELS[tmpl.file_type] ?? tmpl.file_type} · {tmpl.file_name}
                  {tmpl.session_id && ` · ${sessions.find((s) => s.id === tmpl.session_id)?.name ?? `Session #${tmpl.session_id}`}`}
                  {' · '}Updated {format(new Date(tmpl.updated_at), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleDownload(tmpl)}
                  className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleToggle(tmpl)}
                  className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                  style={{ color: tmpl.is_active ? '#16a34a' : 'var(--muted-foreground)' }}
                  title={tmpl.is_active ? 'Deactivate' : 'Activate'}
                >
                  {tmpl.is_active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                </button>
                <button
                  onClick={() => handleDelete(tmpl.id)}
                  disabled={deletingId === tmpl.id}
                  className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                  style={{ color: 'var(--destructive)' }}
                  title="Delete"
                >
                  {deletingId === tmpl.id ? (
                    <div className="w-4 h-4 border border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Upload modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            variants={modalBackdrop}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            onClick={() => { setShowModal(false); }}
          >
            <motion.div
              variants={modalContent}
              className="w-full max-w-md rounded-2xl p-6"
              style={{ background: '#ffffff', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
                  Upload Form Template
                </h3>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)]" style={{ color: 'var(--muted-foreground)' }}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label htmlFor="form-name-input" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Form Name *</label>
                  <input
                    id="form-name-input"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${nameError ? '#dc2626' : 'rgba(0,0,0,0.12)'}`, fontSize: '0.9375rem', background: '#f9fafb', color: 'var(--foreground)', outline: 'none' }}
                    placeholder="e.g. Summer 2026 Application Form"
                    value={formName}
                    onChange={(e) => { setFormName(e.target.value); if (e.target.value.trim()) setNameError(''); }}
                  />
                  {nameError && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{nameError}</p>}
                </div>

                <div>
                  <label htmlFor="form-file-input" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>File (PDF or Word) *</label>
                  <div
                    role="button"
                    tabIndex={0}
                    className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors"
                    style={{ borderColor: file ? '#16a34a' : 'rgba(0,0,0,0.15)' }}
                    onClick={() => document.getElementById('form-file-input')?.click()}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('form-file-input')?.click(); } }}
                  >
                    {file ? (
                      <>
                        <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: '#16a34a' }} />
                        <p className="text-sm font-medium" style={{ color: '#16a34a' }}>{file.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {(file.size / 1024).toFixed(0)} KB
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--muted-foreground)' }} />
                        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Click to select PDF or Word file</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>.pdf, .docx, .doc</p>
                      </>
                    )}
                  </div>
                  <input
                    id="form-file-input"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => { setFile(e.target.files?.[0] ?? null); if (e.target.files?.[0]) setFileError(''); }}
                  />
                  {fileError && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{fileError}</p>}
                </div>

                <div>
                  <label htmlFor="form-session-id" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    Assign to Session <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <select
                    id="form-session-id"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.9375rem', background: '#f9fafb', color: sessionId ? 'var(--foreground)' : 'var(--muted-foreground)', outline: 'none' }}
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                  >
                    <option value="">No session assignment</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name} ({s.start_date} – {s.end_date})
                      </option>
                    ))}
                  </select>
                  {sessions.length === 0 && (
                    <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>No sessions found — template will be unassigned.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button variant="primary" size="sm" className="flex-1" onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Upload Template'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
