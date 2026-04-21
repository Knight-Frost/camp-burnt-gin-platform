/**
 * ApplicantOfficialFormsPage.tsx
 *
 * Purpose: Multi-application paper form submission hub.
 *
 * Users can manage any number of paper_self applications (one per camper/session
 * combination). The page lists all existing paper applications and lets users
 * switch between them or start new ones at any time.
 *
 * Step 0 — Select Session & Camper: creates a paper_self Application record.
 *           Only shown when starting a brand-new application.
 * Step 1 — Get blank forms: View or download any official blank form.
 * Step 2 — Upload completed forms: Upload signed, completed paper forms.
 * Step 3 — Submit for review: Explicitly submit uploads so staff can see them.
 *
 * Route: /applicant/forms
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Download,
  Upload,
  CheckCircle2,
  FileText,
  Loader2,
  AlertCircle,
  Eye,
  X,
  Send,
  RefreshCw,
  Calendar,
  ChevronDown,
  User,
  Plus,
} from 'lucide-react';

import { HeroSlideshow } from '@/ui/components/HeroSlideshow';

import {
  downloadFormTemplate,
  getApplicationDocuments,
  getFormTemplates,
  getApplications,
  getCampers,
  getSessions,
  uploadDocument,
  finalizeApplication,
  initializeDraftApplication,
} from '@/features/parent/api/applicant.api';
import type { Application, OfficialFormTemplate, Session, Camper } from '@/shared/types';
import type { Document } from '@/features/parent/api/applicant.api';
import { Button } from '@/ui/components/Button';
import { useAppSelector } from '@/store/hooks';

// ── Upload slot definitions ───────────────────────────────────────────────────

interface UploadSlotDef {
  id: string;
  labelKey: string;
  descKey: string;
  documentType: string;
  required: boolean;
}

const UPLOAD_SLOTS: UploadSlotDef[] = [
  {
    id: 'application',
    labelKey: 'official_forms.slot_app_label',
    descKey: 'official_forms.slot_app_desc',
    documentType: 'paper_application_packet',
    required: true,
  },
  {
    id: 'medical',
    labelKey: 'official_forms.slot_medical_label',
    descKey: 'official_forms.slot_medical_desc',
    documentType: 'official_medical_form',
    required: true,
  },
  {
    id: 'cyshcn',
    labelKey: 'official_forms.slot_cyshcn_label',
    descKey: 'official_forms.slot_cyshcn_desc',
    documentType: 'official_cyshcn_form',
    required: false,
  },
  {
    id: 'cpap_waiver',
    labelKey: 'official_forms.slot_cpap_label',
    descKey: 'official_forms.slot_cpap_desc',
    documentType: 'cpap_waiver',
    required: false,
  },
  {
    id: 'seizure_plan',
    labelKey: 'official_forms.slot_seizure_label',
    descKey: 'official_forms.slot_seizure_desc',
    documentType: 'seizure_action_plan',
    required: false,
  },
  {
    id: 'gtube_plan',
    labelKey: 'official_forms.slot_gtube_label',
    descKey: 'official_forms.slot_gtube_desc',
    documentType: 'feeding_action_plan',
    required: false,
  },
  {
    id: 'insurance_card',
    labelKey: 'official_forms.slot_insurance_label',
    descKey: 'official_forms.slot_insurance_desc',
    documentType: 'insurance_card',
    required: false,
  },
  {
    id: 'immunization_record',
    labelKey: 'official_forms.slot_immunization_label',
    descKey: 'official_forms.slot_immunization_desc',
    documentType: 'immunization_record',
    required: false,
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface SlotState {
  uploadStatus: 'idle' | 'uploading' | 'done' | 'error';
  uploadedDoc: Document | null;
}

interface PreviewState {
  open: boolean;
  loading: boolean;
  error: boolean;
  blobUrl: string | null;
  formLabel: string;
  formId: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ApplicantOfficialFormsPage() {
  const { t } = useTranslation();
  const userId = useAppSelector((state) => state.auth.user?.id);

  // ── Multi-application hub state ──────────────────────────────────────────────
  // All paper_self applications belonging to this user.
  const [paperApplications, setPaperApplications] = useState<Application[]>([]);
  // Which application is currently in context for Steps 1–3.
  const [activeApplicationId, setActiveApplicationId] = useState<number | null>(null);
  // Whether the Step 0 creation form is visible.
  // True when no paper apps exist OR user clicked "Start New Application".
  const [showNewAppForm, setShowNewAppForm] = useState(false);
  // Slot loading spinner while switching between applications.
  const [loadingSlots, setLoadingSlots] = useState(false);

  // ── Step 0 form fields ──────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<Session[]>([]);
  const [campers, setCampers] = useState<Camper[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  const [camperMode, setCamperMode] = useState<'existing' | 'new'>('existing');
  const [selectedCamperId, setSelectedCamperId] = useState<number | ''>('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newDob, setNewDob] = useState('');
  const [startingPaper, setStartingPaper] = useState(false);

  // ── Upload / submission state ────────────────────────────────────────────────
  const [forms, setForms] = useState<OfficialFormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [slotStates, setSlotStates] = useState<Record<string, SlotState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [downloadingForm, setDownloadingForm] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({
    open: false, loading: false, error: false, blobUrl: null, formLabel: '', formId: null,
  });

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Derived state ───────────────────────────────────────────────────────────

  const activeApplication = paperApplications.find((a) => a.id === activeApplicationId) ?? null;
  const hasAnyPaperApp = paperApplications.length > 0;
  // Step 0 is visible only when starting a new application.
  const showStep0 = !hasAnyPaperApp || showNewAppForm;
  // Steps 1–3 visible when an application is in context and Step 0 is not open.
  const intakeCompleted = activeApplicationId !== null && !showNewAppForm;
  // Derive source/draft status from the live Application record — no stale state vars.
  const activeApplicationIsDraft = activeApplication?.status === 'draft';
  const activeApplicationSource = activeApplication?.submission_source ?? null;

  const requiredComplete = UPLOAD_SLOTS.filter((s) => s.required).every(
    (s) => slotStates[s.id]?.uploadedDoc != null,
  );
  // True only when every uploaded doc (required OR optional) has been submitted.
  // An unuploaded optional slot counts as fine; a draft optional doc blocks this.
  const allRequiredSubmitted = UPLOAD_SLOTS.every((s) => {
    const st = slotStates[s.id];
    if (!st?.uploadedDoc) return true; // nothing uploaded for this slot — OK
    return st.uploadedDoc.submitted_at != null;
  });
  const hasUnsubmitted = UPLOAD_SLOTS.some((s) => {
    const st = slotStates[s.id];
    return st?.uploadedDoc && !st.uploadedDoc.submitted_at;
  });

  // Step 0 form validation
  const step0Valid =
    selectedSessionId !== '' &&
    (camperMode === 'existing'
      ? selectedCamperId !== ''
      : newFirstName.trim().length > 0 && newLastName.trim().length > 0 && newDob.length > 0);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function initEmptySlotStates() {
    const initial: Record<string, SlotState> = {};
    UPLOAD_SLOTS.forEach((slot) => {
      initial[slot.id] = { uploadStatus: 'idle', uploadedDoc: null };
    });
    setSlotStates(initial);
  }

  const loadSlotStatesForApp = useCallback(async (applicationId: number) => {
    setLoadingSlots(true);
    try {
      const docs = await getApplicationDocuments(applicationId);
      const initial: Record<string, SlotState> = {};
      UPLOAD_SLOTS.forEach((slot) => {
        const uploadedDoc = docs.find((d) => d.document_type === slot.documentType) ?? null;
        initial[slot.id] = { uploadStatus: uploadedDoc ? 'done' : 'idle', uploadedDoc };
      });
      setSlotStates(initial);
    } catch {
      initEmptySlotStates();
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  // ── Initial data load ────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [sessionData, camperData, apps, formData] = await Promise.all([
          getSessions(),
          getCampers(),
          getApplications(),
          getFormTemplates(),
        ]);

        setSessions(sessionData);
        setCampers(camperData);
        setForms(formData);

        const paperApps = apps.filter((a) => a.submission_source === 'paper_self');
        setPaperApplications(paperApps);

        if (paperApps.length > 0) {
          // Default to the first draft; fall back to the first submitted app.
          const defaultApp = paperApps.find((a) => a.status === 'draft') ?? paperApps[0];
          setActiveApplicationId(defaultApp.id);
          await loadSlotStatesForApp(defaultApp.id);
        } else {
          // No paper apps yet — Step 0 will render; pre-select single camper.
          initEmptySlotStates();
          if (camperData.length === 1) {
            setSelectedCamperId(camperData[0].id);
            setCamperMode('existing');
          } else if (camperData.length === 0) {
            setCamperMode('new');
          }
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Application switching ────────────────────────────────────────────────────

  async function handleSwitchApplication(appId: number) {
    if (appId === activeApplicationId && !showNewAppForm) return;
    setActiveApplicationId(appId);
    setShowNewAppForm(false);
    await loadSlotStatesForApp(appId);
  }

  // ── Step 0 — new application handlers ───────────────────────────────────────

  function handleStartNewPaperApp() {
    setShowNewAppForm(true);
    setSelectedSessionId('');
    setSelectedCamperId('');
    setNewFirstName('');
    setNewLastName('');
    setNewDob('');
    setCamperMode(campers.length > 0 ? 'existing' : 'new');
  }

  function handleCancelNewApp() {
    setShowNewAppForm(false);
  }

  async function handleStartPaperApplication() {
    if (!step0Valid) return;
    setStartingPaper(true);
    try {
      const payload: Parameters<typeof initializeDraftApplication>[0] = {
        camp_session_id: Number(selectedSessionId),
        submission_source: 'paper_self',
        ...(camperMode === 'existing'
          ? { camper_id: Number(selectedCamperId) }
          : {
              first_name: newFirstName.trim(),
              last_name: newLastName.trim(),
              date_of_birth: newDob,
            }),
      };

      const result = await initializeDraftApplication(payload);
      const newAppId = result.application_id;

      // Reload the full list so the new entry includes eager session/camper data.
      const freshApps = await getApplications();
      const freshPaperApps = freshApps.filter((a) => a.submission_source === 'paper_self');
      setPaperApplications(freshPaperApps);

      setActiveApplicationId(newAppId);
      setShowNewAppForm(false);
      initEmptySlotStates();
    } catch {
      toast.error(t('official_forms.start_error'));
    } finally {
      setStartingPaper(false);
    }
  }

  // ── PDF preview handlers ────────────────────────────────────────────────────

  async function handleViewForm(form: OfficialFormTemplate) {
    setPreview({ open: true, loading: true, error: false, blobUrl: null, formLabel: form.label, formId: form.id });
    try {
      const blob = await downloadFormTemplate(form.id);
      const url = URL.createObjectURL(blob);
      setPreview((prev) => ({ ...prev, loading: false, blobUrl: url }));
    } catch {
      setPreview((prev) => ({ ...prev, loading: false, error: true }));
    }
  }

  function closePreview() {
    setPreview((prev) => {
      if (prev.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return { open: false, loading: false, error: false, blobUrl: null, formLabel: '', formId: null };
    });
  }

  // ── Download handlers ───────────────────────────────────────────────────────

  async function handleDownloadForm(form: OfficialFormTemplate) {
    setDownloadingForm(form.id);
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
      setDownloadingForm(null);
    }
  }

  function handleDownloadFromPreview() {
    if (!preview.blobUrl || !preview.formId) return;
    const form = forms.find((f) => f.id === preview.formId);
    if (!form) return;
    const link = document.createElement('a');
    link.href = preview.blobUrl;
    link.download = form.download_filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ── Upload handlers ─────────────────────────────────────────────────────────

  function triggerSlotUpload(slotId: string) {
    if (!intakeCompleted || activeApplicationId === null) {
      toast.error(t('official_forms.session_required_to_upload'));
      return;
    }
    fileInputRefs.current[slotId]?.click();
  }

  async function handleSlotUpload(slot: UploadSlotDef, file: File) {
    setSlotStates((prev) => ({
      ...prev,
      [slot.id]: { ...prev[slot.id], uploadStatus: 'uploading' },
    }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', slot.documentType);
      if (activeApplicationId !== null) {
        formData.append('documentable_type', 'App\\Models\\Application');
        formData.append('documentable_id', String(activeApplicationId));
      }
      await uploadDocument(formData);

      // Scope the refresh to this application only — prevents cross-application doc bleed.
      const updatedDocs = activeApplicationId !== null
        ? await getApplicationDocuments(activeApplicationId)
        : [];
      const uploadedDoc = updatedDocs.find((d) => d.document_type === slot.documentType) ?? null;
      setSlotStates((prev) => ({
        ...prev,
        [slot.id]: { uploadStatus: 'done', uploadedDoc },
      }));
      toast.success(t('official_forms.upload_success', { label: t(slot.labelKey) }));
    } catch {
      setSlotStates((prev) => ({
        ...prev,
        [slot.id]: { ...prev[slot.id], uploadStatus: 'error' },
      }));
      toast.error(t('official_forms.upload_error'));
    }
  }

  // ── Submission handler ──────────────────────────────────────────────────────

  async function handleSubmitAll() {
    const toSubmit = UPLOAD_SLOTS.flatMap((slot) => {
      const st = slotStates[slot.id];
      return st?.uploadedDoc && !st.uploadedDoc.submitted_at ? [st.uploadedDoc.id] : [];
    });

    if (toSubmit.length === 0) return;

    const isPaper =
      activeApplicationSource === 'paper_self' ||
      activeApplicationSource === 'paper_admin';

    setSubmitting(true);
    try {
      if (isPaper && activeApplicationIsDraft && activeApplicationId !== null) {
        // Paper draft path: finalize atomically. The completeness service
        // allows paper_self applications to finalize with just the packet
        // on file — all section data requirements are waived; staff review
        // the scans and transcribe data via Admin Edit Application later.
        // finalize() cascades submitted_at to every linked doc in one tx.
        try {
          await finalizeApplication(activeApplicationId);
          // Refresh the application list so the active app's status reflects 'submitted'.
          const freshApps = await getApplications();
          setPaperApplications(freshApps.filter((a) => a.submission_source === 'paper_self'));
        } catch (err) {
          const fe = err as { missing_documents?: Array<{ label?: string }>; message?: string };
          const missing = fe.missing_documents?.map((m) => m.label).filter(Boolean).join(', ');
          toast.error(
            missing
              ? `${t('official_forms.submit_error')} — ${missing}`
              : (fe.message ?? t('official_forms.submit_error')),
          );
          return;
        }
      } else if (!activeApplicationIsDraft) {
        // Already-submitted application (corrective supplementary upload).
        // Submit each new doc individually so staff sees it immediately.
        const { submitDocument } = await import('@/features/parent/api/applicant.api');
        await Promise.all(toSubmit.map((id) => submitDocument(id)));
      }
      // Digital drafts: this page does not finalize them — ApplicationFormPage handles that.

      // Full slot reload so every doc's submitted_at reflects the server's
      // finalize() cascade — avoids partial-update races with the banner logic.
      if (activeApplicationId !== null) {
        await loadSlotStatesForApp(activeApplicationId);
      }

      toast.success(t('official_forms.submit_success'));
    } catch {
      toast.error(t('official_forms.submit_error'));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading / error states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 80,
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
    <>
      {/* ── PDF Preview Modal ──────────────────────────────────────────────── */}
      {preview.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-md)',
          }}
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) closePreview(); }}
        >
          <div
            style={{
              background: 'var(--card)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-xl, 0 20px 60px rgba(0,0,0,0.3))',
              width: '100%',
              maxWidth: 920,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--foreground)' }}>
                  {preview.formLabel}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {preview.blobUrl && (
                  <Button variant="secondary" size="sm" onClick={handleDownloadFromPreview} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Download className="w-3.5 h-3.5" />
                    {t('official_forms.download_form')}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={closePreview} style={{ display: 'flex', alignItems: 'center', padding: '6px' }} aria-label="Close preview">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div
              style={{
                flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--muted)',
              }}
            >
              {preview.loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--muted-foreground)', padding: 40 }}>
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)' }}>{t('official_forms.preview_loading')}</span>
                </div>
              )}
              {preview.error && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--destructive)', padding: 40, textAlign: 'center' }}>
                  <AlertCircle className="w-8 h-8" />
                  <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)' }}>{t('official_forms.preview_error')}</span>
                </div>
              )}
              {preview.blobUrl && (
                <iframe src={preview.blobUrl} style={{ width: '100%', height: '78vh', border: 'none', display: 'block' }} title={preview.formLabel} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Page ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 max-w-5xl">

        {/* ── Hero banner ─────────────────────────────────────────────────── */}
        <div className="relative flex flex-col justify-end rounded-2xl overflow-hidden" style={{ minHeight: 200 }}>
          <HeroSlideshow initialIndex={3} />
          <div className="relative z-10 px-6 py-7 lg:px-8 lg:py-8">
            <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.15, textShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>
              {t('official_forms.title')}
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.82)', marginTop: 8, maxWidth: 560, lineHeight: 1.6, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
              {t('official_forms.subtitle')}
            </p>
          </div>
        </div>

        {/* ── Steps ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-8">

        {/* ── Application Manager Panel ────────────────────────────────────── */}
        {hasAnyPaperApp && (
          <section>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--spacing-md)',
              }}
            >
              <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                {t('official_forms.your_applications_title')}
              </h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleStartNewPaperApp}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus className="w-3.5 h-3.5" />
                {t('official_forms.start_new_btn')}
              </Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paperApplications.map((app) => (
                <PaperApplicationCard
                  key={app.id}
                  app={app}
                  isActive={app.id === activeApplicationId && !showNewAppForm}
                  sessions={sessions}
                  onSwitch={() => handleSwitchApplication(app.id)}
                  t={t}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Step 0: New Application Form ─────────────────────────────────── */}
        {showStep0 && (
        <section>
          <StepHeader
            step={0}
            title={t('official_forms.step0_title')}
            subtitle={t('official_forms.step0_subtitle')}
          />

          {/* Session + camper picker form */}
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--spacing-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Session selector */}
              <div>
                <label
                  style={{ display: 'block', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--foreground)', marginBottom: 6 }}
                >
                  <Calendar className="w-3.5 h-3.5 inline mr-1.5" style={{ color: 'var(--muted-foreground)', verticalAlign: '-1px' }} />
                  {t('official_forms.select_session_label')}
                </label>
                {sessions.length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--muted-foreground)' }}>
                    {t('official_forms.no_sessions_available')}
                  </p>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <select
                      value={selectedSessionId}
                      onChange={(e) => setSelectedSessionId(e.target.value === '' ? '' : Number(e.target.value))}
                      style={{
                        width: '100%',
                        appearance: 'none',
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '9px 36px 9px 12px',
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--foreground)',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">{t('official_forms.select_session_placeholder')}</option>
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
                  </div>
                )}
              </div>

              {/* Camper selector (only shown when session is picked) */}
              {selectedSessionId !== '' && (
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--foreground)', marginBottom: 6 }}>
                    <User className="w-3.5 h-3.5 inline mr-1.5" style={{ color: 'var(--muted-foreground)', verticalAlign: '-1px' }} />
                    {t('official_forms.select_camper_label')}
                  </label>

                  {campers.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setCamperMode('existing')}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 999,
                          border: `1.5px solid ${camperMode === 'existing' ? 'var(--ember-orange)' : 'var(--border)'}`,
                          background: camperMode === 'existing' ? 'rgba(234,88,12,0.07)' : 'var(--card)',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 500,
                          color: camperMode === 'existing' ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                          cursor: 'pointer',
                        }}
                      >
                        {t('official_forms.existing_camper_tab')}
                      </button>
                      <button
                        onClick={() => setCamperMode('new')}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 999,
                          border: `1.5px solid ${camperMode === 'new' ? 'var(--ember-orange)' : 'var(--border)'}`,
                          background: camperMode === 'new' ? 'rgba(234,88,12,0.07)' : 'var(--card)',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 500,
                          color: camperMode === 'new' ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                          cursor: 'pointer',
                        }}
                      >
                        {t('official_forms.new_camper_tab')}
                      </button>
                    </div>
                  )}

                  {(camperMode === 'existing' && campers.length > 0) ? (
                    <div style={{ position: 'relative' }}>
                      <select
                        value={selectedCamperId}
                        onChange={(e) => setSelectedCamperId(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{
                          width: '100%',
                          appearance: 'none',
                          background: 'var(--background)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          padding: '9px 36px 9px 12px',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--foreground)',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="">{t('official_forms.select_camper_placeholder')}</option>
                        {campers.map((c) => (
                          <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
                    </div>
                  ) : (
                    /* New camper fields */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', marginBottom: 4 }}>
                            {t('official_forms.new_camper_first_name')}
                          </label>
                          <input
                            type="text"
                            value={newFirstName}
                            onChange={(e) => setNewFirstName(e.target.value)}
                            placeholder={t('official_forms.new_camper_first_name')}
                            style={{
                              width: '100%',
                              background: 'var(--background)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)',
                              padding: '9px 12px',
                              fontFamily: 'var(--font-body)',
                              fontSize: 'var(--text-sm)',
                              color: 'var(--foreground)',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', marginBottom: 4 }}>
                            {t('official_forms.new_camper_last_name')}
                          </label>
                          <input
                            type="text"
                            value={newLastName}
                            onChange={(e) => setNewLastName(e.target.value)}
                            placeholder={t('official_forms.new_camper_last_name')}
                            style={{
                              width: '100%',
                              background: 'var(--background)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)',
                              padding: '9px 12px',
                              fontFamily: 'var(--font-body)',
                              fontSize: 'var(--text-sm)',
                              color: 'var(--foreground)',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', marginBottom: 4 }}>
                          {t('official_forms.new_camper_dob')}
                        </label>
                        <input
                          type="date"
                          value={newDob}
                          onChange={(e) => setNewDob(e.target.value)}
                          style={{
                            background: 'var(--background)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '9px 12px',
                            fontFamily: 'var(--font-body)',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--foreground)',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Buttons row: Continue + Cancel (when there are existing apps) */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Button
                  variant="primary"
                  size="md"
                  disabled={!step0Valid || startingPaper || sessions.length === 0}
                  onClick={handleStartPaperApplication}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  {startingPaper ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('official_forms.starting')}
                    </>
                  ) : (
                    t('official_forms.start_paper_btn')
                  )}
                </Button>
                {hasAnyPaperApp && (
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={handleCancelNewApp}
                    disabled={startingPaper}
                  >
                    {t('official_forms.cancel_new_btn')}
                  </Button>
                )}
              </div>
            </div>
        </section>
        )}

        {/* ── Steps 1–3: visible when an application is in context ────────── */}
        {intakeCompleted && (
        <>

        {/* ── Step 1: Get Blank Forms ──────────────────────────────────────── */}
        <section>
          <StepHeader step={1} title={t('official_forms.step1_title')} subtitle={t('official_forms.step1_subtitle')} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {forms.map((form) => (
              <FormDownloadCard
                key={form.id}
                form={form}
                isDownloading={downloadingForm === form.id}
                onView={() => handleViewForm(form)}
                onDownload={() => handleDownloadForm(form)}
                t={t}
              />
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <p style={{ fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--foreground)', margin: '0 0 2px' }}>
              {t('official_forms.supplemental_title')}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', margin: '0 0 10px' }}>
              {t('official_forms.supplemental_subtitle')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SupplementalFormCard label={t('official_forms.slot_cpap_label')} description={t('official_forms.slot_cpap_desc')} href="/api/forms/cpap-waiver" filename="CPAP-BiPAP-Waiver-1856-ENG-DPH.pdf" t={t} />
              <SupplementalFormCard label={t('official_forms.slot_seizure_label')} description={t('official_forms.slot_seizure_desc')} href="/api/forms/seizure-plan" filename="Seizure-Action-Plan-4522-ENG-DPH.pdf" t={t} />
              <SupplementalFormCard label={t('official_forms.slot_gtube_label')} description={t('official_forms.slot_gtube_desc')} href="/api/forms/gtube-plan" filename="G-Tube-Feeding-Action-Plan-4515-ENG-DPH.pdf" t={t} />
            </div>
          </div>
        </section>

        {/* ── Step 2: Upload Completed Forms ──────────────────────────────── */}
        <section>
          <StepHeader step={2} title={t('official_forms.step2_title')} subtitle={t('official_forms.step2_subtitle')} />

          {/* Upload ≠ Submit notice */}
          <div
            role="note"
            style={{
              background: 'rgba(234,88,12,0.06)',
              border: '1px solid rgba(234,88,12,0.28)',
              borderLeft: '4px solid var(--ember-orange)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              marginBottom: 14,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <AlertCircle className="w-4 h-4" style={{ color: 'var(--ember-orange)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--foreground)', margin: 0 }}>
                {t('official_forms.upload_notice_title')}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', margin: '3px 0 0', lineHeight: 1.5 }}>
                {t('official_forms.upload_notice_body')}
              </p>
            </div>
          </div>

          {/* Slot loading spinner while switching applications */}
          {loadingSlots ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: 'var(--muted-foreground)' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>
                {t('official_forms.loading_slots')}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {UPLOAD_SLOTS.map((slot) => {
                const state = slotStates[slot.id] ?? { uploadStatus: 'idle', uploadedDoc: null };
                return (
                  <div key={slot.id}>
                    <UploadSlotCard
                      slot={slot}
                      state={state}
                      disabled={false}
                      onUpload={() => triggerSlotUpload(slot.id)}
                      t={t}
                    />
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                      ref={(el) => { fileInputRefs.current[slot.id] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSlotUpload(slot, file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Step 3: Submit for Review ────────────────────────────────────── */}
        <section>
          <StepHeader step={3} title={t('official_forms.step3_title')} subtitle={t('official_forms.step3_subtitle')} />

          <div
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-md)',
            }}
          >
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              {UPLOAD_SLOTS.filter((s) => s.required).map((slot) => {
                const st = slotStates[slot.id];
                const uploaded = st?.uploadedDoc != null;
                const submitted = !!(st?.uploadedDoc?.submitted_at);
                return (
                  <div key={slot.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                    {uploaded ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#16a34a' }} />
                    ) : (
                      <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', flexShrink: 0 }} />
                    )}
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: uploaded ? 'var(--foreground)' : 'var(--muted-foreground)', flex: 1 }}>
                      {t(slot.labelKey)}
                    </span>
                    {submitted && (
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: '#16a34a', fontWeight: 500 }}>
                        {t('official_forms.submitted_label')}
                      </span>
                    )}
                    {uploaded && !submitted && (
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: '#92400e', fontWeight: 500 }}>
                        {t('official_forms.uploaded_not_submitted')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {allRequiredSubmitted ? (
              <div
                style={{
                  background: 'rgba(22,163,74,0.07)',
                  border: '1px solid rgba(22,163,74,0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#16a34a' }} />
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-sm)', color: '#16a34a', margin: 0 }}>
                    {t('official_forms.all_submitted_label')}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', margin: '3px 0 0' }}>
                    {t('official_forms.all_submitted_note')}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!requiredComplete && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', margin: 0 }}>
                    {t('official_forms.missing_required')}
                  </p>
                )}
                <Button
                  variant="primary"
                  size="md"
                  disabled={!requiredComplete || !hasUnsubmitted || submitting}
                  onClick={handleSubmitAll}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {submitting ? t('official_forms.submitting') : t('official_forms.submit_btn')}
                </Button>
              </div>
            )}
          </div>
        </section>

        </> /* end intakeCompleted */
        )}

        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', textAlign: 'center' }}>
          {t('official_forms.footer_note')}
        </p>

        </div>
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 'var(--spacing-md)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'var(--ember-orange)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-headline)',
          fontWeight: 700,
          fontSize: 13,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {step}
      </div>
      <div>
        <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
          {title}
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function PaperApplicationCard({
  app,
  isActive,
  sessions,
  onSwitch,
  t,
}: {
  app: Application;
  isActive: boolean;
  sessions: Session[];
  onSwitch: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const sessionName =
    app.session?.name ??
    sessions.find((s) => s.id === app.session_id)?.name ??
    `Session #${app.session_id}`;
  const camperName = app.camper
    ? `${app.camper.first_name} ${app.camper.last_name}`
    : t('official_forms.unknown_camper');
  const isDraft = app.status === 'draft';

  return (
    <div
      style={{
        background: isActive ? 'rgba(234,88,12,0.04)' : 'var(--card)',
        border: `1px solid ${isActive ? 'rgba(234,88,12,0.32)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--foreground)', margin: 0 }}>
            {camperName}
          </p>
          <span
            style={{
              fontSize: '0.7rem',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              background: isDraft ? 'rgba(234,88,12,0.08)' : 'rgba(22,163,74,0.08)',
              color: isDraft ? 'var(--ember-orange)' : '#16a34a',
              borderRadius: 999,
              padding: '1px 8px',
            }}
          >
            {isDraft ? t('official_forms.app_status_draft') : t('official_forms.app_status_submitted')}
          </span>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
          {sessionName}
        </p>
      </div>
      {isActive ? (
        <span
          style={{
            fontSize: '0.7rem',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            background: 'rgba(234,88,12,0.1)',
            color: 'var(--ember-orange)',
            borderRadius: 999,
            padding: '3px 10px',
            flexShrink: 0,
          }}
        >
          {t('official_forms.app_card_active_badge')}
        </span>
      ) : (
        <Button variant="ghost" size="sm" onClick={onSwitch} style={{ flexShrink: 0 }}>
          {t('official_forms.app_card_switch_btn')}
        </Button>
      )}
    </div>
  );
}

function SupplementalFormCard({
  label,
  description,
  href,
  filename,
  t,
}: {
  label: string;
  description: string;
  href: string;
  filename: string;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'rgba(124,58,237,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <FileText className="w-4 h-4" style={{ color: '#7c3aed' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--foreground)', margin: 0 }}>{label}</p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', margin: '2px 0 0', lineHeight: 1.45 }}>{description}</p>
      </div>
      <a
        href={href}
        download={filename}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
          padding: '5px 12px', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)', background: 'var(--card)',
          fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 500,
          color: 'var(--foreground)', textDecoration: 'none', cursor: 'pointer',
        }}
      >
        <Download className="w-3.5 h-3.5" />
        {t('official_forms.supplemental_download')}
      </a>
    </div>
  );
}

function FormDownloadCard({
  form,
  isDownloading,
  onView,
  onDownload,
  t,
}: {
  form: OfficialFormTemplate;
  isDownloading: boolean;
  onView: () => void;
  onDownload: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: 'rgba(22,101,52,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <FileText className="w-5 h-5" style={{ color: 'var(--ember-orange)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--foreground)', margin: 0 }}>{form.label}</p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', margin: '2px 0 0', lineHeight: 1.45 }}>{form.description}</p>
        {!form.available && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', margin: '4px 0 0', fontStyle: 'italic' }}>
            {t('official_forms.form_not_available')}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Button variant="ghost" size="sm" disabled={!form.available} onClick={onView} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Eye className="w-3.5 h-3.5" />
          {t('official_forms.view_form')}
        </Button>
        <Button variant="secondary" size="sm" disabled={!form.available || isDownloading} onClick={onDownload} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {isDownloading ? t('official_forms.downloading') : t('official_forms.download_form')}
        </Button>
      </div>
    </div>
  );
}

function UploadSlotCard({
  slot,
  state,
  disabled,
  onUpload,
  t,
}: {
  slot: UploadSlotDef;
  state: SlotState;
  disabled: boolean;
  onUpload: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const isUploaded = state.uploadedDoc != null;
  const isSubmittedToStaff = !!(state.uploadedDoc?.submitted_at);
  const isDraft = isUploaded && !isSubmittedToStaff;

  return (
    <div
      style={{
        background: disabled ? 'var(--muted)' : 'var(--card)',
        border: `1px solid ${isUploaded ? 'rgba(22,163,74,0.22)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div
        style={{
          width: 38, height: 38, borderRadius: 'var(--radius-md)',
          background: isUploaded ? 'rgba(22,163,74,0.07)' : 'var(--muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        {isUploaded ? (
          <CheckCircle2 className="w-5 h-5" style={{ color: '#16a34a' }} />
        ) : (
          <Upload className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--foreground)', margin: 0 }}>
            {t(slot.labelKey)}
          </p>
          <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-body)', fontWeight: 500, background: slot.required ? 'rgba(22,101,52,0.08)' : 'var(--muted)', color: slot.required ? 'var(--ember-orange)' : 'var(--muted-foreground)', borderRadius: 999, padding: '1px 8px' }}>
            {slot.required ? t('official_forms.required_badge') : t('official_forms.optional_badge')}
          </span>
          {isSubmittedToStaff && (
            <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-body)', fontWeight: 600, background: 'rgba(22,163,74,0.12)', color: '#15803d', borderRadius: 999, padding: '1px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 className="w-3 h-3" />
              {t('official_forms.submitted_to_staff_badge')}
            </span>
          )}
          {isDraft && (
            <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-body)', fontWeight: 600, background: 'rgba(234,179,8,0.12)', color: '#92400e', borderRadius: 999, padding: '1px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle className="w-3 h-3" />
              {t('official_forms.draft_badge')}
            </span>
          )}
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', margin: '3px 0 0', lineHeight: 1.45 }}>
          {isUploaded ? `${t('official_forms.uploaded_file')}: ${state.uploadedDoc!.file_name}` : t(slot.descKey)}
        </p>
        {isDraft && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: '#92400e', margin: '3px 0 0', fontWeight: 500 }}>
            {t('official_forms.draft_note')}
          </p>
        )}
        {state.uploadStatus === 'error' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--destructive)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-body)', marginTop: 4 }}>
            <AlertCircle className="w-3.5 h-3.5" />
            {t('official_forms.upload_failed')}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        <Button
          variant={isUploaded ? 'ghost' : 'secondary'}
          size="sm"
          disabled={disabled || state.uploadStatus === 'uploading'}
          onClick={onUpload}
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
        >
          {state.uploadStatus === 'uploading' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isUploaded ? (
            <RefreshCw className="w-3.5 h-3.5" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {state.uploadStatus === 'uploading'
            ? t('official_forms.uploading')
            : isUploaded
            ? t('official_forms.replace_upload')
            : t('official_forms.upload_form_btn')}
        </Button>
      </div>
    </div>
  );
}
