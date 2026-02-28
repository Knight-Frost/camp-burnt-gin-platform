/**
 * ProviderAccessPage.tsx
 *
 * Standalone medical provider link flow.
 * No PublicLayout — no nav, no footer, no LivingBackground.
 * Calm, clinical aesthetic; light-theme default.
 * Route: /provider-access/:token
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Heart, Upload, CheckCircle, AlertTriangle, Plus, X } from 'lucide-react';

import { axiosInstance } from '@/api/axios.config';
import { pageEntry, staggerContainer, staggerChild } from '@/shared/constants/motion';

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

interface ProviderFormContext {
  camper_name: string;
  session_name: string;
  camp_name: string;
  expires_at: string;
}

async function getProviderContext(token: string): Promise<ProviderFormContext> {
  const { data } = await axiosInstance.get(`/provider-access/${token}`);
  return data.data;
}

async function submitProviderForm(token: string, payload: unknown): Promise<void> {
  await axiosInstance.post(`/provider-access/${token}/submit`, payload);
}

async function uploadProviderDocument(token: string, file: File): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  await axiosInstance.post(`/provider-access/${token}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// ---------------------------------------------------------------------------
// Inline list builder (allergies / medications)
// ---------------------------------------------------------------------------

interface ListItem { value: string }

interface ListBuilderProps {
  label: string;
  placeholder: string;
  items: ListItem[];
  onChange: (items: ListItem[]) => void;
}

function ListBuilder({ label, placeholder, items, onChange }: ListBuilderProps) {
  const [input, setInput] = useState('');

  function add() {
    if (!input.trim()) return;
    onChange([...items, { value: input.trim() }]);
    setInput('');
  }

  return (
    <div>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
      <div className="flex gap-2 mb-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 rounded-lg px-3 py-2 text-sm border outline-none"
          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        />
        <button
          type="button" onClick={add}
          className="flex items-center justify-center w-9 h-9 rounded-lg border transition-colors"
          style={{ borderColor: 'var(--ember-orange)', color: 'var(--ember-orange)' }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              {item.value}
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                style={{ color: 'var(--muted-foreground)' }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ProviderAccessPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();

  const [context, setContext]           = useState<ProviderFormContext | null>(null);
  const [loading, setLoading]           = useState(true);
  const [invalid, setInvalid]           = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  // Form state
  const [primaryDx, setPrimaryDx]       = useState('');
  const [allergies, setAllergies]       = useState<{ value: string }[]>([]);
  const [medications, setMedications]   = useState<{ value: string }[]>([]);
  const [notes, setNotes]               = useState('');
  const [files, setFiles]               = useState<File[]>([]);
  const [uploading, setUploading]       = useState(false);

  useEffect(() => {
    if (!token) return;
    getProviderContext(token)
      .then(setContext)
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);

    try {
      // Upload documents first
      if (files.length > 0) {
        setUploading(true);
        await Promise.all(files.map((f) => uploadProviderDocument(token, f)));
        setUploading(false);
      }

      await submitProviderForm(token, {
        primary_diagnosis: primaryDx,
        allergies: allergies.map((a) => a.value),
        medications: medications.map((m) => m.value),
        notes,
      });

      setSubmitted(true);
    } catch {
      toast.error(t('provider.submit_error'));
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f4f6f9' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--ember-orange)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Invalid / expired token
  // ---------------------------------------------------------------------------
  if (invalid || !context) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#f4f6f9' }}>
        <div className="max-w-sm w-full text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl mx-auto mb-4"
            style={{ background: 'rgba(220,38,38,0.12)' }}>
            <AlertTriangle className="h-6 w-6" style={{ color: 'var(--destructive)' }} />
          </div>
          <h1 className="font-headline text-xl font-semibold mb-2" style={{ color: '#1a1a22' }}>
            {t('provider.invalid_title')}
          </h1>
          <p className="text-sm" style={{ color: '#555' }}>
            {t('provider.invalid_desc')}
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#f4f6f9' }}>
        <motion.div
          variants={pageEntry} initial="hidden" animate="visible"
          className="max-w-sm w-full text-center"
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl mx-auto mb-5"
            style={{ background: 'rgba(5,150,105,0.12)' }}>
            <CheckCircle className="h-7 w-7" style={{ color: '#10b981' }} />
          </div>
          <h1 className="font-headline text-xl font-semibold mb-2" style={{ color: '#1a1a22' }}>
            {t('provider.success_title')}
          </h1>
          <p className="text-sm" style={{ color: '#555' }}>
            {t('provider.success_desc', { name: context.camper_name })}
          </p>
        </motion.div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Form
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen py-10 px-4" style={{ background: '#f4f6f9' }}>
      <motion.div
        variants={pageEntry} initial="hidden" animate="visible"
        className="max-w-xl mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl mx-auto mb-4"
            style={{ background: 'rgba(22,101,52,0.1)' }}>
            <Heart className="h-5 w-5" style={{ color: 'var(--ember-orange)' }} />
          </div>
          <h1 className="font-headline text-2xl font-semibold mb-1" style={{ color: '#1a1a22' }}>
            {t('provider.form_title')}
          </h1>
          <p className="text-sm" style={{ color: '#555' }}>
            {t('provider.form_subtitle', {
              name: context.camper_name,
              session: context.session_name,
              camp: context.camp_name,
            })}
          </p>
        </div>

        {/* Form card */}
        <div
          className="rounded-2xl border p-6 shadow-lg"
          style={{ background: '#fff', borderColor: 'rgba(26,26,34,0.1)' }}
        >
          <form onSubmit={handleSubmit}>
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">

              <motion.div variants={staggerChild}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#555' }}>
                  {t('provider.primary_diagnosis')}
                </label>
                <input
                  value={primaryDx}
                  onChange={(e) => setPrimaryDx(e.target.value)}
                  placeholder={t('provider.primary_diagnosis_placeholder')}
                  className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
                  style={{ background: '#f4f6f9', borderColor: 'rgba(26,26,34,0.14)', color: '#1a1a22' }}
                />
              </motion.div>

              <motion.div variants={staggerChild}>
                <ListBuilder
                  label={t('provider.allergies')}
                  placeholder={t('provider.allergies_placeholder')}
                  items={allergies}
                  onChange={setAllergies}
                />
              </motion.div>

              <motion.div variants={staggerChild}>
                <ListBuilder
                  label={t('provider.medications')}
                  placeholder={t('provider.medications_placeholder')}
                  items={medications}
                  onChange={setMedications}
                />
              </motion.div>

              <motion.div variants={staggerChild}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#555' }}>
                  {t('provider.notes')}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder={t('provider.notes_placeholder')}
                  className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none resize-none"
                  style={{ background: '#f4f6f9', borderColor: 'rgba(26,26,34,0.14)', color: '#1a1a22' }}
                />
              </motion.div>

              {/* Document upload */}
              <motion.div variants={staggerChild}>
                <p className="text-xs font-medium mb-2" style={{ color: '#555' }}>
                  {t('provider.documents')}
                </p>
                <label
                  className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed py-6 cursor-pointer transition-colors"
                  style={{ borderColor: 'rgba(22,101,52,0.25)' }}
                >
                  <Upload className="h-6 w-6 mb-2" style={{ color: 'var(--ember-orange)' }} />
                  <p className="text-sm" style={{ color: '#555' }}>{t('provider.upload_label')}</p>
                  <p className="text-xs mt-1" style={{ color: '#999' }}>{t('provider.upload_hint')}</p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                    }}
                  />
                </label>
                {files.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: '#f4f6f9' }}>
                        <span style={{ color: '#1a1a22' }}>{f.name}</span>
                        <button type="button" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          style={{ color: '#999' }}>
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>

              <motion.div variants={staggerChild}>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-60"
                  style={{ background: 'var(--ember-orange)', color: '#fff' }}
                >
                  {uploading
                    ? t('provider.uploading')
                    : submitting
                      ? t('provider.submitting')
                      : t('provider.submit')}
                </button>
              </motion.div>

            </motion.div>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#999' }}>
          {t('provider.hipaa_notice')}
        </p>
      </motion.div>
    </div>
  );
}
