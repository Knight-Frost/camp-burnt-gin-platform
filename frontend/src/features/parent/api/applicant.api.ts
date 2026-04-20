/**
 * applicant.api.ts
 * API calls for applicant-role users: sessions, campers, applications, documents.
 */

import axiosInstance from '@/api/axios.config';
import type {
  ApiResponse,
  PaginatedResponse,
  Camper,
  Application,
  Session,
} from '@/shared/types';

// ---------------------------------------------------------------------------
// Campers
// ---------------------------------------------------------------------------

export async function getCampers(): Promise<Camper[]> {
  const { data } = await axiosInstance.get<PaginatedResponse<Camper>>('/campers');
  return data.data ?? [];
}

export async function getCamper(id: number): Promise<Camper> {
  const { data } = await axiosInstance.get<ApiResponse<Camper>>(`/campers/${id}`);
  return data.data;
}

export interface CreateCamperPayload {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  tshirt_size?: string;
  preferred_name?: string;
  county?: string;
  needs_interpreter?: boolean;
  preferred_language?: string;
  // Form parity — applicant mailing address (may differ from guardian)
  applicant_address?: string;
  applicant_city?: string;
  applicant_state?: string;
  applicant_zip?: string;
}

export async function createCamper(
  payload: CreateCamperPayload
): Promise<Camper> {
  const { data } = await axiosInstance.post<ApiResponse<Camper>>(
    '/campers',
    payload
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export async function getApplications(): Promise<Application[]> {
  const { data } = await axiosInstance.get<PaginatedResponse<Application>>(
    '/applications'
  );
  return data.data ?? [];
}

export async function getApplication(id: number): Promise<Application> {
  const { data } = await axiosInstance.get<ApiResponse<Application>>(
    `/applications/${id}`
  );
  return data.data;
}

/**
 * Fetch the canonical 11-section projection of an application. This is the
 * shape admin and applicant frontends both render from — same sections,
 * same document status labels, same compliance issues, with role-appropriate
 * label selection. The legacy `data` key is kept on the response too for
 * backward compatibility with older components; prefer this helper for any
 * new rendering.
 */
export async function getApplicationCanonical(id: number): Promise<{
  data: Application;
  canonical: import('@/shared/types').CanonicalApplicationPayload;
}> {
  const { data } = await axiosInstance.get<{
    data: Application;
    canonical: import('@/shared/types').CanonicalApplicationPayload;
  }>(`/applications/${id}`);
  return data;
}

export interface CreateApplicationPayload {
  camper_id: number;
  session_id: number;
  is_draft?: boolean;
  narrative_rustic_environment?: string;
  narrative_staff_suggestions?: string;
  narrative_participation_concerns?: string;
  narrative_camp_benefit?: string;
  narrative_heat_tolerance?: string;
  narrative_transportation?: string;
  narrative_additional_info?: string;
  narrative_emergency_protocols?: string;
  // Form parity meta fields
  first_application?: boolean;
  attended_before?: boolean;
  session_id_second?: number;
  // Reapplication audit trail — set when this application originates from a
  // previous one. Links the new record to the original for admin visibility.
  reapplied_from_id?: number;
}

export async function createApplication(
  payload: CreateApplicationPayload
): Promise<Application> {
  const { data } = await axiosInstance.post<ApiResponse<Application>>(
    '/applications',
    payload
  );
  return data.data;
}

export async function signApplication(
  id: number,
  signatureName: string,
  signatureData: string
): Promise<Application> {
  const { data } = await axiosInstance.post<ApiResponse<Application>>(
    `/applications/${id}/sign`,
    { signature_name: signatureName, signature_data: signatureData }
  );
  return data.data;
}

/**
 * Submit a saved draft application (flip is_draft → false).
 * The ApplicationController::update() endpoint handles is_draft=false + submitted_at stamping
 * when the `submit` flag is present. This is the authoritative path for promoting a
 * server-side draft application to submitted without re-running the full creation wizard.
 */
export async function submitDraftApplication(id: number): Promise<Application> {
  const { data } = await axiosInstance.patch<ApiResponse<Application>>(
    `/applications/${id}`,
    { submit: true }
  );
  return data.data;
}

/**
 * Withdraw an application. Parent-initiated only.
 * Valid from: pending, under_review, approved, waitlisted.
 * If the application was approved, the backend deactivates the camper
 * and medical record if no other approved enrollment exists.
 */
export async function withdrawApplication(id: number): Promise<Application> {
  const { data } = await axiosInstance.post<ApiResponse<Application>>(
    `/applications/${id}/withdraw`
  );
  return data.data;
}

export type ConsentType = 'general' | 'photos' | 'liability' | 'activity' | 'authorization' | 'medication' | 'hipaa';

export interface ConsentPayload {
  consent_type: ConsentType;
  guardian_name: string;
  guardian_relationship: string;
  guardian_signature: string;
  applicant_signature?: string;
  signed_at: string;
}

/**
 * Store the 5 signed consent records for an application.
 * Called after signApplication() during the final submission step.
 * Each consent_type must be unique per application (backend upserts).
 */
export async function storeConsents(
  applicationId: number,
  consents: ConsentPayload[]
): Promise<void> {
  await axiosInstance.post(`/applications/${applicationId}/consents`, { consents });
}

export interface FinalizationGap {
  key: string;
  label: string;
  severity: 'high' | 'medium';
}

export interface FinalizationReport {
  missing_fields: FinalizationGap[];
  missing_documents: FinalizationGap[];
  missing_consents: FinalizationGap[];
}

/**
 * Finalize a draft application — the applicant's official submission gate.
 *
 * Called as the LAST step of the submission waterfall, after documents,
 * signature, and consents have been attached. Runs the full backend
 * completeness check and atomically marks the application as submitted.
 *
 * On success: returns the now-submitted Application record.
 * On failure (422): throws with a FinalizationReport payload describing
 * exactly what is missing so the frontend can guide the applicant.
 */
export async function finalizeApplication(id: number): Promise<Application> {
  const { data } = await axiosInstance.post<ApiResponse<Application>>(
    `/applications/${id}/finalize`
  );
  return data.data;
}

/**
 * Create a blank draft Application + Camper + empty MedicalRecord atomically.
 * Returns the IDs the form needs to drive the backend validation engine.
 * Idempotent: if the applicant already has a draft for the session, returns
 * the existing IDs instead of creating a new row.
 */
export interface InitializeDraftResponse {
  application_id: number;
  camper_id: number;
  medical_record_id: number;
  behavioral_profile_id: number;
  feeding_plan_id: number;
}

export async function initializeDraftApplication(payload: {
  camp_session_id: number;
  /** Reuse an existing Camper — set for reapplication flows. */
  camper_id?: number;
  /** Audit-trail pointer to the terminal application being succeeded. */
  reapplied_from_id?: number;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
}): Promise<InitializeDraftResponse> {
  const { data } = await axiosInstance.post<ApiResponse<InitializeDraftResponse>>(
    '/applications/initialize-draft',
    payload,
  );
  return data.data;
}

/**
 * Read the validation engine output for this application. Single source of
 * truth for completeness, blocking_issues, per-section status, and the
 * state (INCOMPLETE / BLOCKED / READY / SUBMITTED).
 *
 * Response carries the rich `validation` object AND the legacy flat fields
 * (missing_fields / missing_documents / missing_consents / …) so older
 * callers like IncompleteApprovalModal keep working unchanged.
 */
export interface CompletenessResponse {
  is_complete: boolean;
  missing_fields: Array<{ key: string; label: string; severity: string }>;
  missing_documents: Array<{ key: string; label: string; severity: string }>;
  unverified_documents: Array<{ key: string; label: string; severity: string }>;
  missing_consents: Array<{ key: string; label: string; severity: string }>;
  submission_source: string;
  paper_substitutes_digital: boolean;
  validation: import('@/shared/types').CanonicalValidationMeta;
}

export async function getApplicationCompleteness(id: number): Promise<CompletenessResponse> {
  const { data } = await axiosInstance.get<ApiResponse<CompletenessResponse>>(
    `/applications/${id}/completeness`,
  );
  return data.data;
}

/**
 * Fetch just the lifecycle IDs (camper + singleton relations) for a given
 * application. Used by the form when resuming a draft — we only need the
 * IDs to drive progressive writes, not the full application payload.
 */
export async function getApplicationLifecycleIds(id: number): Promise<InitializeDraftResponse> {
  const { data } = await axiosInstance.get<ApiResponse<InitializeDraftResponse>>(
    `/applications/${id}/lifecycle-ids`,
  );
  return data.data;
}

/**
 * Clone an existing terminal application into a new draft.
 * The clone shares the same camper_id, is_draft=true, and reapplied_from_id
 * pointing to the source application. Only terminal applications can be cloned.
 * NOTE: This endpoint is kept for administrative use. The applicant-facing
 * "Apply for a New Session" flow does not call this — it passes reapplied_from_id
 * through the standard createApplication() call instead.
 */
export async function cloneApplication(id: number): Promise<Application> {
  const { data } = await axiosInstance.post<ApiResponse<Application>>(
    `/applications/${id}/clone`
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Application Drafts (server-side save slots)
// ---------------------------------------------------------------------------

/**
 * A server-side save slot for an in-progress application form.
 * draft_data is the full FormState JSON — present only in the `show` response.
 */
export interface ApplicationDraft {
  id: number;
  label: string;
  draft_data?: Record<string, unknown> | null;
  /**
   * FK to the real Application row this blob belongs to. Populated by
   * initializeDraftApplication at form-start; absent only on legacy blobs
   * that predate the lifecycle refactor. The form treats its absence as a
   * hard error and redirects to start to re-initialize.
   */
  application_id?: number | null;
  created_at: string;
  updated_at: string;
}

/** List all drafts for the authenticated user (no draft_data in list response). */
export async function getDrafts(): Promise<ApplicationDraft[]> {
  const { data } = await axiosInstance.get<{ data: ApplicationDraft[] }>('/application-drafts');
  return data.data ?? [];
}

/**
 * Create a new empty draft save slot. Returns the created draft with its id.
 *
 * `applicationId` links the blob to its Application record when one exists
 * at blob-creation time. When the blob outlives the Application (finalize
 * succeeds, or the Application is deleted), the blob is automatically
 * cleaned up — no reliance on label-match fallback.
 */
export async function createDraft(label?: string, applicationId?: number): Promise<ApplicationDraft> {
  const { data } = await axiosInstance.post<{ data: ApplicationDraft }>('/application-drafts', {
    label: label ?? 'New Application',
    ...(applicationId ? { application_id: applicationId } : {}),
  });
  return data.data;
}

/** Fetch a single draft including its full draft_data. */
export async function getDraft(id: number): Promise<ApplicationDraft> {
  const { data } = await axiosInstance.get<{ data: ApplicationDraft }>(`/application-drafts/${id}`);
  return data.data;
}

/**
 * Auto-save the full form state to a draft slot.
 *
 * Pass `lastKnownUpdatedAt` (the `updated_at` from the last successful save or
 * fetch) to enable the server-side optimistic concurrency guard. The server
 * returns 409 if another tab has already overwritten the draft since that
 * timestamp. Returns the server's new `updated_at` value on success so the
 * caller can keep their local copy in sync.
 */
export async function saveDraft(
  id: number,
  label: string,
  draftData: Record<string, unknown>,
  lastKnownUpdatedAt?: string,
  applicationId?: number,
): Promise<string | undefined> {
  const { data } = await axiosInstance.put<{ data: { id: number; label: string; updated_at: string } }>(
    `/application-drafts/${id}`,
    {
      label,
      draft_data: draftData,
      ...(lastKnownUpdatedAt ? { last_known_updated_at: lastKnownUpdatedAt } : {}),
      ...(applicationId ? { application_id: applicationId } : {}),
    },
  );
  return data.data?.updated_at;
}

/** Permanently delete a draft. No confirmation on the server — confirm in the UI. */
export async function deleteDraft(id: number): Promise<void> {
  await axiosInstance.delete(`/application-drafts/${id}`);
}

/**
 * Delete an Application record that is still in draft state (is_draft = true).
 * The backend enforces this constraint via ApplicationPolicy — submitting a
 * request to delete a non-draft application will return 403.
 */
export async function deleteApplication(id: number): Promise<void> {
  await axiosInstance.delete(`/applications/${id}`);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function getSessions(): Promise<Session[]> {
  const { data } = await axiosInstance.get<{ data: Session[] }>('/sessions');
  return data.data ?? [];
}

// ---------------------------------------------------------------------------
// Application submission resources
// ---------------------------------------------------------------------------

export interface CreateEmergencyContactPayload {
  camper_id: number;
  name: string;
  relationship: string;
  phone_primary: string;
  phone_secondary?: string;
  phone_work?: string;
  is_primary: boolean;
  is_authorized_pickup: boolean;
  is_guardian?: boolean;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  primary_language?: string;
  interpreter_needed?: boolean;
}

export async function createEmergencyContact(
  payload: CreateEmergencyContactPayload
): Promise<void> {
  await axiosInstance.post('/emergency-contacts', payload);
}


export interface CreateDiagnosisPayload {
  camper_id: number;
  name: string;
  severity_level: string;
  notes?: string;
}

export async function createDiagnosis(
  payload: CreateDiagnosisPayload
): Promise<void> {
  await axiosInstance.post('/diagnoses', payload);
}

export interface CreateAllergyPayload {
  camper_id: number;
  allergen: string;
  severity: string;
  reaction?: string;
  treatment?: string;
}

export async function createAllergy(
  payload: CreateAllergyPayload
): Promise<void> {
  await axiosInstance.post('/allergies', payload);
}

export interface CreateBehavioralProfilePayload {
  camper_id: number;
  aggression: boolean;
  self_abuse: boolean;
  wandering_risk: boolean;
  one_to_one_supervision: boolean;
  developmental_delay: boolean;
  functional_reading?: boolean;
  functional_writing?: boolean;
  independent_mobility?: boolean;
  verbal_communication?: boolean;
  social_skills?: boolean;
  behavior_plan?: boolean;
  functioning_age_level?: string;
  communication_methods?: string[];
  notes?: string;
  // Form parity fields (2026_03_26_000001)
  sexual_behaviors?: boolean;
  interpersonal_behavior?: boolean;
  social_emotional?: boolean;
  follows_instructions?: boolean;
  group_participation?: boolean;
  attends_school?: boolean;
  classroom_type?: string;
  aggression_description?: string;
  self_abuse_description?: string;
  one_to_one_description?: string;
  wandering_description?: string;
  sexual_behaviors_description?: string;
  interpersonal_behavior_description?: string;
  social_emotional_description?: string;
  follows_instructions_description?: string;
  group_participation_description?: string;
}

export async function createBehavioralProfile(
  payload: CreateBehavioralProfilePayload
): Promise<void> {
  await axiosInstance.post('/behavioral-profiles', payload);
}

export interface CreateAssistiveDevicePayload {
  camper_id: number;
  device_type: string;
  requires_transfer_assistance: boolean;
  notes?: string;
}

export async function createAssistiveDevice(
  payload: CreateAssistiveDevicePayload
): Promise<void> {
  await axiosInstance.post('/assistive-devices', payload);
}

export interface CreateFeedingPlanPayload {
  camper_id: number;
  special_diet: boolean;
  diet_description?: string;
  texture_modified?: boolean;
  texture_level?: string;
  fluid_restriction?: boolean;
  fluid_details?: string;
  g_tube: boolean;
  formula?: string;
  amount_per_feeding?: string;
  feedings_per_day?: number;
  feeding_times?: string[];
  bolus_only?: boolean;
  notes?: string;
}

export interface StoreHealthProfilePayload {
  // Physician
  physician_name?: string;
  physician_phone?: string;
  physician_address?: string;
  // Insurance
  insurance_provider?: string;
  insurance_policy?: string;      // mapped to insurance_policy_number by backend
  insurance_group?: string;
  medicaid_number?: string;
  // Immunization
  immunizations_current?: boolean;
  tetanus_date?: string;
  date_of_medical_exam?: string;
  // Seizure history
  has_seizures?: boolean;
  last_seizure_date?: string;
  seizure_description?: string;
  // Other health flags
  has_neurostimulator?: boolean;
  // Mobility
  mobility_notes?: string;
}

export async function storeHealthProfile(
  camperId: number,
  payload: StoreHealthProfilePayload
): Promise<void> {
  await axiosInstance.post(`/campers/${camperId}/health-profile`, payload);
}

export interface CreatePersonalCarePlanPayload {
  bathing_level?: string;
  bathing_notes?: string;
  toileting_level?: string;
  toileting_notes?: string;
  nighttime_toileting?: boolean;
  nighttime_notes?: string;
  dressing_level?: string;
  dressing_notes?: string;
  oral_hygiene_level?: string;
  oral_hygiene_notes?: string;
  positioning_notes?: string;
  sleep_notes?: string;
  falling_asleep_issues?: boolean;
  sleep_walking?: boolean;
  night_wandering?: boolean;
  bowel_control_notes?: string;
  urinary_catheter?: boolean;
  // Form parity (2026_03_26_000005)
  irregular_bowel?: boolean;
  irregular_bowel_notes?: string;
  menstruation_support?: boolean;
}

export async function createPersonalCarePlan(
  camperId: number,
  payload: CreatePersonalCarePlanPayload
): Promise<void> {
  await axiosInstance.post(`/campers/${camperId}/personal-care-plan`, payload);
}

export async function createFeedingPlan(
  payload: CreateFeedingPlanPayload
): Promise<void> {
  await axiosInstance.post('/feeding-plans', payload);
}

export interface CreateMedicationPayload {
  camper_id: number;
  name: string;
  dosage: string;
  frequency: string;
  purpose?: string;
  prescribing_physician?: string;
  notes?: string;
}

export async function createMedication(
  payload: CreateMedicationPayload
): Promise<void> {
  await axiosInstance.post('/medications', payload);
}

export interface CreateActivityPermissionPayload {
  camper_id: number;
  activity_name: string;
  permission_level: string;
  restriction_notes?: string;
}

export async function createActivityPermission(
  payload: CreateActivityPermissionPayload
): Promise<void> {
  await axiosInstance.post('/activity-permissions', payload);
}

export async function uploadDocument(formData: FormData): Promise<Document> {
  const { data } = await axiosInstance.post<ApiResponse<Document>>('/documents', formData, {
    headers: { 'Content-Type': undefined },
  });
  return data.data;
}

// ---------------------------------------------------------------------------
// Applicant-facing update/delete helpers
// ---------------------------------------------------------------------------
//
// The form's per-section progressive flush needs to PUT single-record
// relations (camper, medical record, behavioral profile, feeding plan) and
// DELETE + recreate list relations (contacts, diagnoses, allergies,
// assistive devices, activity permissions, medications) on every section
// transition. Owner-gated on the backend via the respective Policy classes;
// admin has the same access via the admin.api mirror.

export interface UpdateCamperPayload {
  first_name?: string;
  last_name?: string;
  preferred_name?: string;
  date_of_birth?: string;
  gender?: string;
  tshirt_size?: string;
  county?: string;
  needs_interpreter?: boolean;
  preferred_language?: string;
  camper_address?: string;
  camper_city?: string;
  camper_state?: string;
  camper_zip?: string;
}
export async function updateCamperProfile(id: number, payload: UpdateCamperPayload): Promise<void> {
  await axiosInstance.put(`/campers/${id}`, payload);
}

export interface UpdateMedicalRecordPayload {
  physician_name?: string;
  physician_phone?: string;
  physician_address?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_group?: string;
  medicaid_number?: string;
  has_seizures?: boolean;
  last_seizure_date?: string;
  seizure_description?: string;
  has_neurostimulator?: boolean;
  immunizations_current?: boolean;
  tetanus_date?: string;
  date_of_medical_exam?: string;
  special_needs?: string;
  dietary_restrictions?: string;
}
export async function updateMedicalRecord(id: number, payload: UpdateMedicalRecordPayload): Promise<void> {
  await axiosInstance.put(`/medical-records/${id}`, payload);
}

export async function updateBehavioralProfile(id: number, payload: CreateBehavioralProfilePayload): Promise<void> {
  const { camper_id: _unused, ...body } = payload;
  void _unused;
  await axiosInstance.put(`/behavioral-profiles/${id}`, body);
}

export async function updateFeedingPlan(id: number, payload: CreateFeedingPlanPayload): Promise<void> {
  const { camper_id: _unused, ...body } = payload;
  void _unused;
  await axiosInstance.put(`/feeding-plans/${id}`, body);
}

/** List-relation deletes — called before wipe/recreate in a section flush. */
export async function deleteEmergencyContact(id: number): Promise<void> {
  await axiosInstance.delete(`/emergency-contacts/${id}`);
}
export async function deleteDiagnosis(id: number): Promise<void> {
  await axiosInstance.delete(`/diagnoses/${id}`);
}
export async function deleteAllergy(id: number): Promise<void> {
  await axiosInstance.delete(`/allergies/${id}`);
}
export async function deleteAssistiveDevice(id: number): Promise<void> {
  await axiosInstance.delete(`/assistive-devices/${id}`);
}
export async function deleteActivityPermission(id: number): Promise<void> {
  await axiosInstance.delete(`/activity-permissions/${id}`);
}
export async function deleteMedication(id: number): Promise<void> {
  await axiosInstance.delete(`/medications/${id}`);
}

// List-relation PUTs — used by the form's diff-based sync to update rows
// in place when the parent edits (instead of delete+recreate). Owner-gated
// on the backend via each Policy class.

export interface UpdateEmergencyContactPayload {
  name?: string;
  relationship?: string;
  phone_primary?: string;
  phone_secondary?: string;
  email?: string;
  is_primary?: boolean;
  is_authorized_pickup?: boolean;
}
export async function updateEmergencyContact(id: number, payload: UpdateEmergencyContactPayload): Promise<void> {
  await axiosInstance.put(`/emergency-contacts/${id}`, payload);
}

export interface UpdateDiagnosisPayload {
  name?: string;
  severity_level?: string;
  notes?: string;
}
export async function updateDiagnosis(id: number, payload: UpdateDiagnosisPayload): Promise<void> {
  await axiosInstance.put(`/diagnoses/${id}`, payload);
}

export interface UpdateAllergyPayload {
  allergen?: string;
  severity?: string;
  reaction?: string;
  treatment?: string;
}
export async function updateAllergy(id: number, payload: UpdateAllergyPayload): Promise<void> {
  await axiosInstance.put(`/allergies/${id}`, payload);
}

export interface UpdateAssistiveDevicePayload {
  device_type?: string;
  requires_transfer_assistance?: boolean;
  notes?: string;
}
export async function updateAssistiveDevice(id: number, payload: UpdateAssistiveDevicePayload): Promise<void> {
  await axiosInstance.put(`/assistive-devices/${id}`, payload);
}

export interface UpdateActivityPermissionPayload {
  activity_name?: string;
  permission_level?: string;
  restriction_notes?: string;
}
export async function updateActivityPermission(id: number, payload: UpdateActivityPermissionPayload): Promise<void> {
  await axiosInstance.put(`/activity-permissions/${id}`, payload);
}

export interface UpdateMedicationPayload {
  name?: string;
  dosage?: string;
  frequency?: string;
  purpose?: string;
  prescribing_physician?: string;
  notes?: string;
}
export async function updateMedication(id: number, payload: UpdateMedicationPayload): Promise<void> {
  await axiosInstance.put(`/medications/${id}`, payload);
}

/** Update the Application's narrative fields + sections_reviewed + admin notes. */
export interface UpdateApplicationPayload {
  notes?: string;
  narrative_rustic_environment?: string;
  narrative_staff_suggestions?: string;
  narrative_participation_concerns?: string;
  narrative_camp_benefit?: string;
  narrative_heat_tolerance?: string;
  narrative_transportation?: string;
  narrative_additional_info?: string;
  narrative_emergency_protocols?: string;
  sections_reviewed?: Record<string, string>;
}
export async function updateApplication(id: number, payload: UpdateApplicationPayload): Promise<void> {
  await axiosInstance.put(`/applications/${id}`, payload);
}

/**
 * List-relation row shapes returned by GET /campers/{id}. Exposes enough
 * fields for the form's diff-based sync to match form rows against server
 * rows by natural key. Additional properties may be present; only the
 * ones listed here are consumed by the sync logic.
 */
export interface ServerEmergencyContact { id: number; name?: string; relationship?: string; phone_primary?: string }
export interface ServerDiagnosis { id: number; name?: string; notes?: string }
export interface ServerAllergy { id: number; allergen?: string; severity?: string; reaction?: string; treatment?: string }
export interface ServerAssistiveDevice { id: number; device_type?: string; requires_transfer_assistance?: boolean; notes?: string }
export interface ServerActivityPermission { id: number; activity_name?: string; permission_level?: string; restriction_notes?: string }
export interface ServerMedication { id: number; name?: string; dosage?: string; frequency?: string; purpose?: string }

// ---------------------------------------------------------------------------
// Autofill (returning-camper prefill snapshot)
// ---------------------------------------------------------------------------

/**
 * Safe, non-PHI snapshot returned by GET /campers/{id}/prefill.
 * Contains only stable demographic + contact data appropriate for autofill.
 * Medical data (medications, diagnoses, allergies, treatment plans) is
 * intentionally excluded — those fields change frequently and must never
 * be silently carried forward between sessions.
 */
export interface PrefillContact {
  name: string;
  relationship: string;
  phone_home: string | null;
  phone_work: string | null;
  phone_cell: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  primary_language: string | null;
  interpreter_needed: boolean;
}

export interface CamperPrefillData {
  camper: {
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    date_of_birth: string;
    gender: string;
    tshirt_size: string | null;
    county: string | null;
    needs_interpreter: boolean;
    preferred_language: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  guardian1: PrefillContact | null;
  guardian2: PrefillContact | null;
  emergency_contact: Omit<PrefillContact, 'email'> | null;
  has_prior_submitted_application: boolean;
}

export async function getCamperPrefill(camperId: number): Promise<CamperPrefillData> {
  const { data } = await axiosInstance.get<{ data: CamperPrefillData }>(
    `/campers/${camperId}/prefill`
  );
  return data.data;
}

/**
 * Fetches the camper with every relevant relation nested. Used by the
 * form's per-section diff-based sync logic to compare current server
 * rows against in-memory form state.
 */
export async function getCamperFull(id: number): Promise<Camper & {
  emergency_contacts?: ServerEmergencyContact[];
  diagnoses?: ServerDiagnosis[];
  allergies?: ServerAllergy[];
  assistive_devices?: ServerAssistiveDevice[];
  activity_permissions?: ServerActivityPermission[];
  medications?: ServerMedication[];
}> {
  const { data } = await axiosInstance.get<ApiResponse<Camper>>(`/campers/${id}`);
  return data.data;
}

// ---------------------------------------------------------------------------
// Documents (applicant portal)
// ---------------------------------------------------------------------------

export interface Document {
  id: number;
  file_name: string;
  /** Raw model field name — present when document comes from eager-loaded relation (not API transform). */
  original_filename?: string;
  document_type: string;
  mime_type: string;
  size: number;
  created_at: string;
  url: string;
  /** Null = draft (not yet submitted to staff). Set = submitted and visible to admins. */
  submitted_at: string | null;
}

export async function getDocuments(): Promise<Document[]> {
  const { data } = await axiosInstance.get<{ data: Document[] }>('/documents');
  return data.data ?? [];
}

export async function deleteDocument(id: number): Promise<void> {
  await axiosInstance.delete(`/documents/${id}`);
}

/** Promote a draft document to submitted state, making it visible to admins. */
export async function submitDocument(id: number): Promise<Document> {
  const { data } = await axiosInstance.patch<{ data: Document }>(`/documents/${id}/submit`);
  return data.data;
}

/**
 * Upload a document and immediately submit it so staff can see it.
 *
 * Backend policy: applicant uploads ALWAYS land as drafts (submitted_at=null)
 * for security separation. The caller must then call /submit to make them
 * visible to admins. If the submit step fails after the upload succeeds, the
 * upload is left as an invisible draft — and the next form submission retry
 * will create a duplicate. This helper deletes the orphaned upload on submit
 * failure so retries start from a clean state.
 */
export async function uploadAndSubmitDocument(formData: FormData): Promise<Document> {
  const uploaded = await uploadDocument(formData);
  try {
    return await submitDocument(uploaded.id);
  } catch (submitError) {
    // Best-effort cleanup. If the delete itself fails we still surface the
    // original submit error — the draft will remain on the applicant's
    // detail page where they can manually submit or delete it.
    try {
      await deleteDocument(uploaded.id);
    } catch {
      /* swallow — original error is more important */
    }
    throw submitError;
  }
}

// ─── Required Documents (sent by admin) ──────────────────────────────────────

export interface RequiredDocument {
  id: number;
  original_file_name: string;
  instructions: string | null;
  status: 'pending' | 'submitted' | 'reviewed';
  created_at: string;
  download_url: string;
  submitted_file_name: string | null;
  download_submitted_url: string | null;
}

export async function getRequiredDocuments(): Promise<RequiredDocument[]> {
  const { data } = await axiosInstance.get('/applicant/documents');
  return data;
}

export async function submitCompletedDocument(id: number, file: File): Promise<RequiredDocument> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('applicant_document_id', String(id));
  const { data } = await axiosInstance.post('/applicant/documents/upload', formData, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}

// ─── Document Requests (new request lifecycle system) ─────────────────────────

export type DocumentRequestStatus =
  | 'awaiting_upload'
  | 'uploaded'
  | 'scanning'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'overdue';

export interface DocumentRequestRecord {
  id: number;
  applicant_id: number;
  camper_id: number | null;
  camper_name: string | null;
  requested_by_admin_id: number;
  requested_by_name: string;
  document_type: string;
  instructions: string | null;
  status: DocumentRequestStatus;
  due_date: string | null;
  uploaded_file_name: string | null;
  uploaded_at: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  download_url: string | null;
  created_at: string;
}

export async function getDocumentRequests(): Promise<DocumentRequestRecord[]> {
  const { data } = await axiosInstance.get('/applicant/document-requests');
  return data;
}

export async function uploadDocumentRequest(id: number, file: File): Promise<DocumentRequestRecord> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await axiosInstance.post(`/applicant/document-requests/${id}/upload`, formData, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}

// ---------------------------------------------------------------------------
// Active Form Schema
// ---------------------------------------------------------------------------

import type { FormSchema } from '@/features/forms/types/form.types';

/**
 * Fetch the currently active application form schema.
 * Returns sections, fields, options, and conditional logic rules.
 * Used by ApplicationFormPage to optionally fetch schema for future schema-driven rendering.
 */
export async function getActiveFormSchema(): Promise<FormSchema> {
  const { data } = await axiosInstance.get<{ data: FormSchema }>('/form/active');
  return data.data;
}

// ---------------------------------------------------------------------------
// Official Form Templates
// ---------------------------------------------------------------------------

import type { OfficialFormTemplate } from '@/shared/types';

/**
 * Fetch metadata for all four official form templates.
 * Returns label, description, document_type, and availability for each form.
 * Authenticated — logs the fetch in the audit trail.
 */
export async function getFormTemplates(): Promise<OfficialFormTemplate[]> {
  const { data } = await axiosInstance.get<{ data: OfficialFormTemplate[] }>('/form-templates');
  return data.data;
}

/**
 * Download a blank official form template PDF.
 * Returns a Blob for browser download via URL.createObjectURL.
 *
 * @param type - one of: english_application | spanish_application | medical_form | cyshcn_form
 * @returns Blob with application/pdf content
 */
export async function downloadFormTemplate(type: string): Promise<Blob> {
  const response = await axiosInstance.get(`/form-templates/${type}/download`, {
    responseType: 'blob',
  });
  return response.data as Blob;
}
