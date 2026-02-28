/**
 * ApplicationFormPage.tsx
 * Multi-step camper application form.
 *
 * Steps:
 * 1. Camper Info
 * 2. Session Selection
 * 3. Medical Basics
 * 4. Document Upload
 * 5. Signature
 * 6. Review & Submit
 *
 * Assembled form data is submitted to:
 *   POST /api/campers → creates camper
 *   POST /api/applications → creates application
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2, Calendar } from 'lucide-react';

import {
  camperInfoSchema,
  sessionSelectionSchema,
  medicalBasicsSchema,
  signatureSchema,
  type CamperInfoValues,
  type SessionSelectionValues,
  type MedicalBasicsValues,
  type SignatureValues,
  type ApplicationFormData,
} from '@/features/parent/schemas/application.schema';
import {
  createCamper,
  createApplication,
  signApplication,
} from '@/features/parent/api/parent.api';
import axiosInstance from '@/api/axios.config';
import type { Session, Document } from '@/shared/types';
import { ROUTES } from '@/shared/constants/routes';
import { FormField } from '@/ui/components/FormField';
import { Button } from '@/ui/components/Button';
import { DocumentUploader } from '@/ui/components/DocumentUploader';
import { StatusBadge } from '@/ui/components/StatusBadge';
import {
  stepForwardVariants,
  stepBackwardVariants,
} from '@/shared/constants/motion';
import { cn } from '@/shared/utils/cn';
import { format } from 'date-fns';

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  'Camper Info',
  'Session',
  'Medical',
  'Documents',
  'Signature',
  'Review',
];

function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Application progress" className="mb-8">
      <ol className="flex items-center gap-0">
        {STEPS.map((label, index) => {
          const isComplete = index < current;
          const isCurrent = index === current;
          const isLast = index === STEPS.length - 1;

          return (
            <li key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300',
                    isComplete
                      ? 'bg-forest-green text-white'
                      : isCurrent
                      ? 'bg-ember-orange text-white'
                      : 'border text-muted-foreground'
                  )}
                  style={
                    !isComplete && !isCurrent
                      ? { borderColor: 'var(--border)', color: 'var(--muted-foreground)' }
                      : {}
                  }
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isComplete ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className="hidden sm:block text-xs mt-1.5 text-center"
                  style={{
                    color: isCurrent ? 'var(--foreground)' : 'var(--muted-foreground)',
                    fontWeight: isCurrent ? 500 : 400,
                  }}
                >
                  {label}
                </span>
              </div>
              {!isLast && (
                <div
                  className="flex-1 h-px mx-2 transition-all duration-300"
                  style={{
                    background: isComplete
                      ? 'var(--forest-green)'
                      : 'var(--border)',
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Progress bar */}
      <div
        className="mt-4 h-1 rounded-full overflow-hidden"
        style={{ background: 'var(--border)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'var(--ember-orange)' }}
          animate={{ width: `${((current) / (STEPS.length - 1)) * 100}%` }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ApplicationFormPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Pre-fill data passed from "Re-apply" button
  const prefill = (location.state as { prefill?: Partial<CamperInfoValues> } | null)?.prefill;

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<Document[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Assembled data across steps
  const [formData, setFormData] = useState<Partial<ApplicationFormData>>({});

  // Step 1 form — pre-fill from prefill state if available
  const step1 = useForm<CamperInfoValues>({
    resolver: zodResolver(camperInfoSchema),
    defaultValues: prefill ?? formData.camperInfo,
  });

  // Step 2 form
  const step2 = useForm<SessionSelectionValues>({
    resolver: zodResolver(sessionSelectionSchema),
    defaultValues: formData.sessionSelection,
  });

  // Step 3 form
  const step3 = useForm<MedicalBasicsValues>({
    resolver: zodResolver(medicalBasicsSchema),
    defaultValues: formData.medicalBasics,
  });
  const { fields: allergyFields, append: appendAllergy, remove: removeAllergy } =
    useFieldArray({ control: step3.control, name: 'allergies' });

  // Step 5 form
  const step5 = useForm<SignatureValues>({
    resolver: zodResolver(signatureSchema),
  });

  // Load sessions on mount
  useEffect(() => {
    axiosInstance
      .get('/sessions')
      .then((res) => setSessions(res.data.data))
      .catch(() => {});
  }, []);

  const goNext = () => {
    setDirection('forward');
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goPrev = () => {
    setDirection('backward');
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleStep1 = step1.handleSubmit((data) => {
    setFormData((prev) => ({ ...prev, camperInfo: data }));
    goNext();
  });

  const handleStep2 = step2.handleSubmit((data) => {
    setFormData((prev) => ({ ...prev, sessionSelection: data }));
    goNext();
  });

  const handleStep3 = step3.handleSubmit((data) => {
    setFormData((prev) => ({ ...prev, medicalBasics: data }));
    goNext();
  });

  const handleStep4 = () => {
    setFormData((prev) => ({
      ...prev,
      uploadedDocumentIds: uploadedDocs.map((d) => d.id),
    }));
    goNext();
  };

  const handleStep5 = step5.handleSubmit((data) => {
    setFormData((prev) => ({ ...prev, signature: data }));
    goNext();
  });

  const handleSubmit = async () => {
    if (!formData.camperInfo || !formData.sessionSelection || !formData.signature) {
      toast.error('Please complete all steps before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create camper
      const camper = await createCamper(formData.camperInfo);

      // Create application
      const application = await createApplication({
        camper_id: camper.id,
        session_id: formData.sessionSelection.session_id,
      });

      // Sign application
      await signApplication(application.id, formData.signature.signature_name);

      toast.success('Application submitted successfully.');
      navigate(ROUTES.PARENT_APPLICATIONS);
    } catch (error) {
      toast.error(
        (error as { message: string }).message ?? 'Submission failed. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepVariants =
    direction === 'forward' ? stepForwardVariants : stepBackwardVariants;

  const selectedSession = sessions.find(
    (s) => s.id === formData.sessionSelection?.session_id
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2
          className="text-xl font-headline font-semibold"
          style={{ color: 'var(--foreground)' }}
        >
          {prefill ? 'New Application' : 'New Application'}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Complete each step to register your camper.
        </p>
        {prefill && (
          <div
            className="mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-lg border"
            style={{ background: 'rgba(22,101,52,0.08)', borderColor: 'rgba(22,101,52,0.25)', color: 'var(--forest-green)' }}
          >
            <span>Camper info pre-filled from a previous application. Review and update as needed.</span>
          </div>
        )}
      </div>

      <StepIndicator current={currentStep} />

      <div
        className="rounded-2xl border p-6 lg:p-8"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--border)',
        }}
      >
        <AnimatePresence mode="wait">
          {/* Step 1: Camper Info */}
          {currentStep === 0 && (
            <motion.div
              key="step1"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <h3 className="text-base font-headline font-semibold mb-6" style={{ color: 'var(--foreground)' }}>
                Camper information
              </h3>
              <form onSubmit={handleStep1} noValidate className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="First name"
                    error={step1.formState.errors.first_name?.message}
                    {...step1.register('first_name')}
                  />
                  <FormField
                    label="Last name"
                    error={step1.formState.errors.last_name?.message}
                    {...step1.register('last_name')}
                  />
                </div>
                <FormField
                  label="Date of birth"
                  type="date"
                  error={step1.formState.errors.date_of_birth?.message}
                  {...step1.register('date_of_birth')}
                />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="gender" className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    Gender
                  </label>
                  <select
                    id="gender"
                    className="w-full rounded-lg px-4 py-3 text-sm border outline-none"
                    style={{ background: 'var(--input)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                    {...step1.register('gender')}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                    <option value="other">Other</option>
                  </select>
                  {step1.formState.errors.gender && (
                    <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                      {step1.formState.errors.gender.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="tshirt_size" className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    T-shirt size
                  </label>
                  <select
                    id="tshirt_size"
                    className="w-full rounded-lg px-4 py-3 text-sm border outline-none"
                    style={{ background: 'var(--input)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                    {...step1.register('tshirt_size')}
                  >
                    <option value="">Select size</option>
                    {['YS', 'YM', 'YL', 'AS', 'AM', 'AL', 'AXL', 'A2XL'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end mt-2">
                  <Button type="submit">
                    Continue <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Step 2: Session Selection */}
          {currentStep === 1 && (
            <motion.div
              key="step2"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <h3 className="text-base font-headline font-semibold mb-6" style={{ color: 'var(--foreground)' }}>
                Select a session
              </h3>
              <form onSubmit={handleStep2} noValidate className="flex flex-col gap-4">
                {sessions.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Loading available sessions...
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {sessions.map((session) => {
                      const selected = step2.watch('session_id') === session.id;
                      return (
                        <label
                          key={session.id}
                          className={cn(
                            'flex items-start gap-4 rounded-xl border p-4 cursor-pointer transition-all duration-200',
                            selected ? 'border-ember-orange' : 'hover:border-ember-orange/40'
                          )}
                          style={{
                            background: selected ? 'rgba(22,101,52,0.06)' : 'var(--card)',
                            borderColor: selected ? 'var(--ember-orange)' : 'var(--border)',
                          }}
                        >
                          <input
                            type="radio"
                            value={session.id}
                            className="mt-0.5 accent-ember-orange"
                            {...step2.register('session_id', { valueAsNumber: true })}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                              {session.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              <Calendar className="h-3 w-3" />
                              {format(new Date(session.start_date), 'MMM d')} &ndash; {format(new Date(session.end_date), 'MMM d, yyyy')}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <StatusBadge status={session.status} />
                              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                {session.available_spots} spots available
                              </span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
                {step2.formState.errors.session_id && (
                  <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                    {step2.formState.errors.session_id.message}
                  </p>
                )}
                <div className="flex justify-between mt-2">
                  <Button type="button" variant="ghost" onClick={goPrev}>
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button type="submit">
                    Continue <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Step 3: Medical Basics */}
          {currentStep === 2 && (
            <motion.div
              key="step3"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <h3 className="text-base font-headline font-semibold mb-6" style={{ color: 'var(--foreground)' }}>
                Medical information
              </h3>
              <form onSubmit={handleStep3} noValidate className="flex flex-col gap-6">
                <FormField
                  label="Primary diagnosis (optional)"
                  placeholder="e.g. Autism Spectrum Disorder"
                  {...step3.register('primary_diagnosis')}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Physician name" {...step3.register('physician_name')} />
                  <FormField label="Physician phone" type="tel" {...step3.register('physician_phone')} />
                </div>

                {/* Allergies */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Allergies</p>
                    <button
                      type="button"
                      onClick={() => appendAllergy({
                        allergen: '', reaction: '', severity: 'mild',
                        treatment: '', epi_pen_required: false,
                      })}
                      className="flex items-center gap-1.5 text-xs text-ember-orange hover:underline"
                    >
                      <Plus className="h-3 w-3" /> Add allergy
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {allergyFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="rounded-xl border p-4 flex flex-col gap-3"
                        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <FormField label="Allergen" {...step3.register(`allergies.${index}.allergen`)} />
                          <FormField label="Reaction" {...step3.register(`allergies.${index}.reaction`)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                            <input type="checkbox" {...step3.register(`allergies.${index}.epi_pen_required`)} />
                            Epi-pen required
                          </label>
                          <button
                            type="button"
                            onClick={() => removeAllergy(index)}
                            className="text-xs flex items-center gap-1"
                            style={{ color: 'var(--destructive)' }}
                          >
                            <Trash2 className="h-3 w-3" /> Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between mt-2">
                  <Button type="button" variant="ghost" onClick={goPrev}>
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button type="submit">
                    Continue <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Step 4: Documents */}
          {currentStep === 3 && (
            <motion.div
              key="step4"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <h3 className="text-base font-headline font-semibold mb-6" style={{ color: 'var(--foreground)' }}>
                Upload documents
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
                Upload any relevant medical records, immunization forms, or other documents. This step is optional.
              </p>
              <DocumentUploader
                onUploaded={(doc) => setUploadedDocs((prev) => [...prev, doc])}
                onRemoved={(id) =>
                  setUploadedDocs((prev) => prev.filter((d) => d.id !== id))
                }
              />
              <div className="flex justify-between mt-8">
                <Button type="button" variant="ghost" onClick={goPrev}>
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                <Button onClick={handleStep4}>
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 5: Signature */}
          {currentStep === 4 && (
            <motion.div
              key="step5"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <h3 className="text-base font-headline font-semibold mb-6" style={{ color: 'var(--foreground)' }}>
                Authorization and signature
              </h3>
              <form onSubmit={handleStep5} noValidate className="flex flex-col gap-6">
                <div
                  className="rounded-xl border p-4 text-sm leading-relaxed"
                  style={{
                    background: 'var(--card)',
                    borderColor: 'var(--border)',
                    color: 'var(--muted-foreground)',
                  }}
                >
                  I certify that the information provided in this application is true and accurate to the best of my knowledge. I authorize Camp Burnt Gin to use this information for the purpose of registering my child for camp.
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-ember-orange"
                    {...step5.register('confirmed')}
                  />
                  <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                    I confirm the information provided is accurate and I authorize Camp Burnt Gin to process this application.
                  </span>
                </label>
                {step5.formState.errors.confirmed && (
                  <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                    {step5.formState.errors.confirmed.message}
                  </p>
                )}
                <FormField
                  label="Type your full name as signature"
                  placeholder="Your full legal name"
                  error={step5.formState.errors.signature_name?.message}
                  {...step5.register('signature_name')}
                />
                <div className="flex justify-between mt-2">
                  <Button type="button" variant="ghost" onClick={goPrev}>
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button type="submit">
                    Review <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Step 6: Review & Submit */}
          {currentStep === 5 && (
            <motion.div
              key="step6"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col gap-6"
            >
              <h3 className="text-base font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
                Review your application
              </h3>

              {/* Summary sections */}
              {[
                {
                  title: 'Camper information',
                  step: 0,
                  content: formData.camperInfo ? (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span style={{ color: 'var(--muted-foreground)' }}>Name</span>
                      <span style={{ color: 'var(--foreground)' }}>
                        {formData.camperInfo.first_name} {formData.camperInfo.last_name}
                      </span>
                      <span style={{ color: 'var(--muted-foreground)' }}>Date of birth</span>
                      <span style={{ color: 'var(--foreground)' }}>
                        {format(new Date(formData.camperInfo.date_of_birth), 'MMMM d, yyyy')}
                      </span>
                      <span style={{ color: 'var(--muted-foreground)' }}>T-shirt size</span>
                      <span style={{ color: 'var(--foreground)' }}>
                        {formData.camperInfo.tshirt_size}
                      </span>
                    </div>
                  ) : null,
                },
                {
                  title: 'Session',
                  step: 1,
                  content: selectedSession ? (
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                      {selectedSession.name} &mdash;{' '}
                      {format(new Date(selectedSession.start_date), 'MMM d')} to{' '}
                      {format(new Date(selectedSession.end_date), 'MMM d, yyyy')}
                    </p>
                  ) : null,
                },
                {
                  title: 'Documents',
                  step: 3,
                  content: (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {uploadedDocs.length} document{uploadedDocs.length !== 1 ? 's' : ''} uploaded
                    </p>
                  ),
                },
              ].map(({ title, step, content }) => (
                <div
                  key={title}
                  className="rounded-xl border p-4"
                  style={{
                    background: 'var(--card)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {title}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setDirection('backward'); setCurrentStep(step); }}
                      className="text-xs text-ember-orange hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  {content}
                </div>
              ))}

              <div className="flex justify-between mt-2">
                <Button type="button" variant="ghost" onClick={goPrev}>
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  loading={isSubmitting}
                >
                  Submit application
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
