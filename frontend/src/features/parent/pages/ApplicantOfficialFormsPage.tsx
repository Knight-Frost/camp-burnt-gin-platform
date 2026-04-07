/**
 * ApplicantOfficialFormsPage.tsx
 *
 * Purpose: Guides applicants through the two-part application process:
 *   1. Digital Application Form — completed in the system (English or Spanish).
 *      The English Application, Spanish Application, and CYSHCN-inclusive form
 *      are all filled out digitally via the ApplicationFormPage. No upload required.
 *   2. Medical Form — must be downloaded, completed by a licensed medical provider,
 *      and uploaded here as a signed PDF.
 *
 * Design notes:
 *   - Digital form cards show completion status and a link to start/continue.
 *   - Medical form card shows download + upload controls.
 *   - Already-uploaded medical forms show a "View" link using the document URL.
 *
 * Route: /applicant/forms
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Download,
  Upload,
  CheckCircle2,
  FileText,
  Loader2,
  AlertCircle,
  Stethoscope,
  Globe,
  ExternalLink,
  ArrowRight,
  Clock,
} from 'lucide-react';

import {
  downloadFormTemplate,
  getDocuments,
  getFormTemplates,
  getApplications,
  uploadDocument,
} from '@/features/parent/api/applicant.api';
import type { OfficialFormTemplate, OfficialFormTypeKey } from '@/shared/types';
import type { Document } from '@/features/parent/api/applicant.api';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/ui/components/Button';
import { useAppSelector } from '@/store/hooks';

// These form types are completed digitally — no upload required.
const DIGITAL_FORM_TYPES: OfficialFormTypeKey[] = [
  'english_application',
  'spanish_application',
  'cyshcn_form',
];

// Per-form upload/download status (only relevant for medical_form)
type UploadStatus = 'idle' | 'uploading' | 'done' | 'error';

interface FormCardState {
  downloading: boolean;
  uploadStatus: UploadStatus;
  uploadedDoc: Document | null;
}

// Icon/color config per form type
const FORM_CONFIG: Record<
  OfficialFormTypeKey,
  { icon: React.ReactNode; accentColor: string; badgeLabel?: string }
> = {
  english_application: {
    icon: <FileText className="w-5 h-5" />,
    accentColor: 'var(--ember-orange)',
    badgeLabel: 'Digital Form',
  },
  spanish_application: {
    icon: <Globe className="w-5 h-5" />,
    accentColor: 'var(--night-sky-blue)',
    badgeLabel: 'Digital Form',
  },
  medical_form: {
    icon: <Stethoscope className="w-5 h-5" />,
    accentColor: 'var(--forest-green)',
    badgeLabel: 'Upload Required',
  },
  cyshcn_form: {
    icon: <FileText className="w-5 h-5" />,
    accentColor: 'var(--warm-amber)',
    badgeLabel: 'Digital Form',
  },
};

// Application completion status derived from the user's submitted applications
type AppStatus = 'submitted' | 'draft' | 'none';

export function ApplicantOfficialFormsPage() {
  const { t } = useTranslation();
  const userId = useAppSelector((state) => state.auth.user?.id);
  const draftKey = `cbg_app_draft_${userId ?? 'anon'}`;

  const [forms, setForms]   = useState<OfficialFormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);
  const [cardState, setCardState] = useState<Record<string, FormCardState>>({});
  // Whether the applicant has a submitted (non-draft) application
  const [appStatus, setAppStatus] = useState<AppStatus>('none');

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    (async () => {
      try {
        const [data, existingDocs, apps] = await Promise.all([
          getFormTemplates(),
          getDocuments(),
          getApplications(),
        ]);

        setForms(data);

        // Determine application completion status
        const hasSubmitted = apps.some((a) => !a.is_draft && a.submitted_at);
        const hasDraft     = apps.some((a) => a.is_draft);
        const localDraft   = sessionStorage.getItem(draftKey);
        if (hasSubmitted) {
          setAppStatus('submitted');
        } else if (hasDraft || localDraft) {
          setAppStatus('draft');
        } else {
          setAppStatus('none');
        }

        // Build initial card state; pre-mark medical_form as done if already uploaded
        const initial: Record<string, FormCardState> = {};
        data.forEach((f) => {
          const uploadedDoc = existingDocs.find((d) => d.document_type === f.document_type) ?? null;
          initial[f.id] = {
            downloading: false,
            uploadStatus: uploadedDoc ? 'done' : 'idle',
            uploadedDoc,
          };
        });
        setCardState(initial);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [draftKey]);

  // ── Download handler (for medical_form only) ──────────────────────────────

  async function handleDownload(form: OfficialFormTemplate) {
    setCardState((prev) => ({
      ...prev,
      [form.id]: { ...prev[form.id], downloading: true },
    }));
    try {
      const blob = await downloadFormTemplate(form.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = form.download_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(t('official_forms.download_success', { label: form.label }));
    } catch {
      toast.error(t('official_forms.download_error'));
    } finally {
      setCardState((prev) => ({
        ...prev,
        [form.id]: { ...prev[form.id], downloading: false },
      }));
    }
  }

  // ── Upload handler (for medical_form only) ────────────────────────────────

  function triggerUpload(formId: string) {
    fileInputRefs.current[formId]?.click();
  }

  async function handleUpload(form: OfficialFormTemplate, file: File) {
    setCardState((prev) => ({
      ...prev,
      [form.id]: { ...prev[form.id], uploadStatus: 'uploading' },
    }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', form.document_type);
      await uploadDocument(formData);

      // Re-fetch documents to get the URL of the newly uploaded file
      const updatedDocs = await getDocuments();
      const uploadedDoc = updatedDocs.find((d) => d.document_type === form.document_type) ?? null;

      setCardState((prev) => ({
        ...prev,
        [form.id]: { ...prev[form.id], uploadStatus: 'done', uploadedDoc },
      }));
      toast.success(t('official_forms.upload_success', { label: form.label }));
    } catch {
      setCardState((prev) => ({
        ...prev,
        [form.id]: { ...prev[form.id], uploadStatus: 'error' },
      }));
      toast.error(t('official_forms.upload_error'));
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function viewDocument(doc: Document) {
    if (doc.url) {
      window.open(doc.url, '_blank', 'noopener noreferrer');
    }
  }

  // ── Status pill for digital forms ─────────────────────────────────────────

  function DigitalStatusPill({ status }: { status: AppStatus }) {
    if (status === 'submitted') {
      return (
        <span
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(22,163,74,0.10)', color: '#16a34a' }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {t('official_forms.application_submitted')}
        </span>
      );
    }
    if (status === 'draft') {
      return (
        <span
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(251,191,36,0.12)', color: '#92400e' }}
        >
          <Clock className="w-3.5 h-3.5" />
          {t('official_forms.application_in_progress')}
        </span>
      );
    }
    return (
      <span
        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
        style={{ background: 'var(--border)', color: 'var(--muted-foreground)' }}
      >
        {t('official_forms.application_not_started')}
      </span>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: 140,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--muted)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 'var(--spacing-xl)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          color: 'var(--destructive)',
        }}
      >
        <AlertCircle className="w-8 h-8" />
        <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)' }}>
          {t('official_forms.load_error')}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--spacing-xl)' }}>
      {/* Page header */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h1
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          {t('official_forms.title')}
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--muted-foreground)',
            marginTop: 'var(--spacing-xs)',
          }}
        >
          {t('official_forms.subtitle')}
        </p>
      </div>

      {/* Instruction callout */}
      <div
        style={{
          background: 'rgba(22,163,74,0.07)',
          border: '1px solid var(--border-ember)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-lg)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          {t('official_forms.instructions')}
        </p>
      </div>

      {/* Digital form status — shown once above all digital form cards.
          All three language variants (English / Spanish / CYSHCN) represent the
          SAME application form; only one needs to be completed. Displaying the
          status per-card would imply that each must be filled separately. */}
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', flexWrap: 'wrap', marginBottom: 4 }}>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              color: 'var(--muted-foreground)',
            }}
          >
            {t('official_forms.digital_forms_status_label')}
          </span>
          <DigitalStatusPill status={appStatus} />
        </div>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            color: 'var(--muted-foreground)',
            margin: 0,
          }}
        >
          {t('official_forms.digital_forms_choose_one')}
        </p>
      </div>

      {/* Form cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {forms.map((form) => {
          const config   = FORM_CONFIG[form.id as OfficialFormTypeKey];
          const state    = cardState[form.id] ?? { downloading: false, uploadStatus: 'idle', uploadedDoc: null };
          const isDigital = DIGITAL_FORM_TYPES.includes(form.id as OfficialFormTypeKey);

          return (
            <div
              key={form.id}
              style={{
                background: 'var(--card)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-card)',
                padding: 'var(--spacing-md)',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 'var(--spacing-md)',
                alignItems: 'start',
              }}
            >
              {/* Left: metadata */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(22,163,74,0.10)',
                      color: config?.accentColor ?? 'var(--ember-orange)',
                      flexShrink: 0,
                    }}
                  >
                    {config?.icon}
                  </span>
                  <h2
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      margin: 0,
                    }}
                  >
                    {form.label}
                  </h2>
                  {config?.badgeLabel && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: isDigital ? 'rgba(22,163,74,0.10)' : 'rgba(202,138,4,0.10)',
                        color: isDigital ? 'var(--ember-orange)' : '#92400e',
                        flexShrink: 0,
                      }}
                    >
                      {config.badgeLabel}
                    </span>
                  )}
                </div>

                {/* Description */}
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--muted-foreground)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {isDigital
                    ? t('official_forms.digital_form_label')
                    : form.id === 'medical_form'
                    ? t('official_forms.medical_form_instructions')
                    : form.description}
                </p>

                {/* Medical form: upload status indicator */}
                {!isDigital && state.uploadStatus === 'done' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      color: '#16a34a',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {t('official_forms.uploaded_label')}
                  </div>
                )}
                {!isDigital && state.uploadStatus === 'error' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--destructive)',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    <AlertCircle className="w-4 h-4" />
                    {t('official_forms.upload_failed')}
                  </div>
                )}
              </div>

              {/* Right: action buttons */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-xs)',
                  minWidth: 160,
                  alignItems: 'stretch',
                }}
              >
                {isDigital ? (
                  /* Digital form: show "Start/Continue Application" link */
                  <>
                    <Link
                      to={ROUTES.PARENT_APPLICATION_START}
                      style={{ textDecoration: 'none' }}
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', width: '100%' }}
                      >
                        <ArrowRight className="w-4 h-4" />
                        {appStatus === 'submitted'
                          ? t('official_forms.application_submitted')
                          : appStatus === 'draft'
                          ? t('official_forms.continue_application')
                          : t('official_forms.start_application')}
                      </Button>
                    </Link>
                    {/* Optional: download reference PDF if available */}
                    {form.available && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(form)}
                        disabled={state.downloading}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', fontSize: '0.75rem' }}
                      >
                        {state.downloading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        {t('official_forms.download_reference')}
                      </Button>
                    )}
                  </>
                ) : (
                  /* Medical form: download + upload */
                  <>
                    {/* Download Form */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload(form)}
                      disabled={!form.available || state.downloading}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
                    >
                      {state.downloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {state.downloading
                        ? t('official_forms.downloading')
                        : t('official_forms.download_form')}
                    </Button>

                    {/* View uploaded file */}
                    {state.uploadStatus === 'done' && state.uploadedDoc?.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewDocument(state.uploadedDoc!)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
                      >
                        <ExternalLink className="w-4 h-4" />
                        {t('official_forms.view_document')}
                      </Button>
                    )}

                    {/* Upload completed form */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => triggerUpload(form.id)}
                      disabled={state.uploadStatus === 'uploading'}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
                    >
                      {state.uploadStatus === 'uploading' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {state.uploadStatus === 'uploading'
                        ? t('official_forms.uploading')
                        : state.uploadStatus === 'done'
                        ? t('official_forms.replace_upload')
                        : t('official_forms.upload_completed')}
                    </Button>

                    {/* Hidden file input scoped to this form */}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                      ref={(el) => { fileInputRefs.current[form.id] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(form, file);
                        e.target.value = '';
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-xs)',
          color: 'var(--muted-foreground)',
          marginTop: 'var(--spacing-lg)',
          textAlign: 'center',
        }}
      >
        {t('official_forms.footer_note')}
      </p>
    </div>
  );
}
