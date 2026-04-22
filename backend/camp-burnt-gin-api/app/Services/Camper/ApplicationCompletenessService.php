<?php

namespace App\Services\Camper;

use App\Enums\SubmissionSource;
use App\Models\Application;
use App\Services\Document\DocumentEnforcementService;

/**
 * ApplicationCompletenessService — Canonical validation engine for a camp
 * application. Every completeness / validity / submission-readiness answer
 * in the system MUST come from this service.
 *
 * Two public entry points:
 *
 *   evaluate($application, $forFinalization = false):
 *     Returns the full structured result — per-section is_complete,
 *     per-section missing lists, documents breakdown, aggregate blocking
 *     issues, completion_percentage, and the derived `state`:
 *       INCOMPLETE | BLOCKED | READY | SUBMITTED
 *     This is what ApplicationResource.meta.validation exposes.
 *
 *   check($application, $forFinalization = false):
 *     Backward-compatible flat shape (missing_fields / missing_documents /
 *     missing_consents / unverified_documents / is_complete). Internally
 *     calls evaluate() and flattens. All existing callers — finalize(),
 *     completeness endpoint, ApplicationService::reviewApplication —
 *     continue to work unchanged, but now pick up the stricter per-section
 *     rules automatically.
 *
 * Gating semantics:
 *
 *   SUBMISSION gate (finalize endpoint): unverified documents do NOT block
 *   (the admin verifies post-submit). Everything else — per-section data,
 *   required documents, consents, signature — blocks strictly.
 *
 *   APPROVAL gate (admin review): unverified documents DO block. Admin has
 *   the IncompleteApprovalModal override, which is logged to audit.
 *
 * Paper submissions relax ONLY the signature + digital-consent requirements
 * when a `paper_application_packet` is on file. Section fields still apply
 * — staff are expected to transcribe the paper packet's contents into the
 * database. "Backend = single source of truth" means no transcription hole.
 *
 * Per-application review confirmation (prevents phantom-completeness):
 *
 *   CYSHCN clinical data (BehavioralProfile, FeedingPlan, Medications,
 *   AssistiveDevices, ActivityPermissions, PersonalCarePlan, MedicalRecord,
 *   Diagnoses, EmergencyContacts) lives on the Camper model and PERSISTS
 *   across applications — a parent's 2026 application reuses the Camper
 *   row from their 2025 application. That is intentional: families should
 *   not retype unchanged medical history every year.
 *
 *   BUT "data exists on the Camper" is NOT the same as "the parent has
 *   reviewed and confirmed this data is current for THIS year's
 *   application." Every section that reads Camper-scoped data therefore
 *   requires an explicit per-application review timestamp on
 *   `applications.sections_reviewed[section_key]`. The frontend stamps
 *   this timestamp when the parent leaves (clicks Next past) the section,
 *   or via an explicit "Reviewed — nothing to declare" checkbox.
 *
 *   Without this gate, an initialize-draft call for a returning applicant
 *   caused 8 of 11 section pills to show green before the parent had
 *   touched anything — data-visible sections (behavior, equipment, diet,
 *   medications, activities, personal_care, health) reported
 *   `is_complete=true` purely because the Camper already had populated
 *   rows. See BUG-247.
 *
 *   Documents and consents are inherently application-scoped — each new
 *   application needs its own signed consent records and its own
 *   submitted documents — so they do NOT require a review flag.
 *
 *   Conditional error rules (e.g. g_tube=true → formula required) still
 *   fire independently of the review flag. A "reviewed nothing to
 *   declare" attestation does not suppress an inconsistency in data that
 *   IS present.
 */
class ApplicationCompletenessService
{
    /**
     * Camper profile fields that must be non-empty. Key = model attribute,
     * value = human-readable label used by the UI warning modals.
     */
    private const REQUIRED_CAMPER_FIELDS = [
        'first_name' => 'Camper first name',
        'last_name' => 'Camper last name',
        'date_of_birth' => 'Date of birth',
        'gender' => 'Gender',
        'tshirt_size' => 'T-shirt size',
        'county' => 'County (required for CYSHCN eligibility)',
    ];

    /**
     * Consent types that must have a signed ApplicationConsent record.
     * Kept in sync with the CONSENT_DEFS array in ApplicationFormPage.tsx.
     */
    private const REQUIRED_CONSENT_TYPES = [
        'general' => 'General consent',
        'photos' => 'Photo and media release',
        'liability' => 'Release of liability',
        'activity' => 'Activity participation consent',
        'authorization' => 'Medical treatment authorization',
        'medication' => 'Medication administration consent',
        'hipaa' => 'HIPAA privacy acknowledgment',
    ];

    /**
     * Canonical activity slugs. Each activity must have an
     * ActivityPermission row with a valid permission_level. Kept in sync
     * with the ACTIVITIES array in AdminApplicationEditPage.tsx /
     * ApplicationFormPage.tsx.
     */
    private const CANONICAL_ACTIVITIES = [
        'sports_games' => 'Sports & Games',
        'arts_crafts' => 'Arts & Crafts',
        'nature' => 'Nature Activities',
        'fine_arts' => 'Fine Arts',
        'swimming' => 'Swimming',
        'boating' => 'Boating',
        'camp_out' => 'Camp Out',
    ];

    /** Valid values for ADL levels on PersonalCarePlan. */
    private const VALID_ADL_LEVELS = ['independent', 'verbal_cue', 'physical_assist', 'full_assist'];

    /** Ordered list of section keys — used for completion_percentage. */
    private const SECTION_KEYS = [
        'camper', 'health', 'behavior', 'equipment', 'diet',
        'personal_care', 'activities', 'medications', 'narratives',
        'documents', 'consents',
    ];

    /**
     * Sections that require a per-application review timestamp on
     * `applications.sections_reviewed[key]` to be considered complete.
     *
     * All data-bearing sections belong here. `documents` and `consents` are
     * inherently application-scoped (each new application has its own docs
     * and its own signed consent records), so they do not need a review
     * flag — their own contents are the proof of confirmation.
     */
    private const REVIEW_REQUIRED_SECTIONS = [
        'camper', 'health', 'behavior', 'equipment', 'diet',
        'personal_care', 'activities', 'medications', 'narratives',
    ];

    /**
     * "Hybrid" sections — accept either data OR an explicit attestation as
     * proof of completion. These sections have NO universally-required
     * field set; an empty section can be legitimate (the camper has no
     * behavioral concerns, no special diet, etc.). To distinguish "empty
     * because nothing applies" from "empty because the parent forgot",
     * the parent must check an explicit attestation when no data is
     * present. The attestation lives in `applications.section_attestations`
     * (added 2026_04_22_000001).
     *
     * Per the 2026-04-22 forensic audit, the prior visit-and-leave model
     * was the headline cause of false-green section pills.
     */
    private const ATTESTABLE_SECTIONS = [
        'behavior', 'equipment', 'diet', 'medications',
    ];

    public function __construct(
        protected DocumentEnforcementService $documentEnforcement,
    ) {}

    // ──────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Full structured evaluation. This is the canonical output shape used
     * by ApplicationResource.meta.validation.
     *
     * @return array{
     *   state: 'INCOMPLETE'|'BLOCKED'|'READY'|'SUBMITTED',
     *   is_complete: bool,
     *   is_valid: bool,
     *   sections: array<string, array{is_complete: bool, missing: list<array>, errors: list<array>}>,
     *   documents: array{missing: list<array>, expired: list<array>, incomplete: list<array>, unverified: list<array>},
     *   missing_consents: list<array>,
     *   blocking_issues: list<array>,
     *   warnings: list<array>,
     *   completion_percentage: int,
     *   submission_source: string,
     *   paper_substitutes_digital: bool,
     * }
     */
    public function evaluate(Application $application, bool $forFinalization = false): array
    {
        $application->loadMissing([
            'camper.emergencyContacts',
            'camper.medicalRecord',
            'camper.diagnoses',
            'camper.allergies',
            'camper.medications',
            'camper.behavioralProfile',
            'camper.feedingPlan',
            'camper.personalCarePlan',
            'camper.activityPermissions',
            'camper.assistiveDevices',
            'consents',
            'documents',
        ]);

        $isPaper = $this->isPaperSubmission($application);
        $paperPacketPresent = $this->paperPacketOnFile($application, $forFinalization);
        $paperSubstitutesDigital = $isPaper && $paperPacketPresent;

        // Paper packet substitutes for the entire digital flow.
        //
        // Rationale: the paper-self UX is "scan the packet, upload it, done."
        // The parent never enters camper / health / behavior / etc. data
        // through the paper page — there is no UI for it. The admin
        // transcribes from the scanned packet via Admin Edit Application
        // before approval, and the existing IncompleteApprovalModal forces
        // an explicit acknowledgement when approving an under-transcribed
        // application (so the "no transcription hole" intent is preserved
        // by the approval gate rather than the submission gate).
        //
        // Previously only signature + consents were waived; every section
        // gate still ran, which meant *no* paper-self application could
        // ever finalize in production — section data had nowhere to come
        // from. See the paper-form audit follow-up.
        if ($paperSubstitutesDigital) {
            $allComplete = $this->sectionResult(true, []);
            $sections = [
                'camper' => $allComplete,
                'health' => $allComplete,
                'behavior' => $allComplete,
                'equipment' => $allComplete,
                'diet' => $allComplete,
                'personal_care' => $allComplete,
                'activities' => $allComplete,
                'medications' => $allComplete,
                'narratives' => $allComplete,
                'documents' => $allComplete,
                'consents' => $allComplete,
            ];
        } else {
            $sections = [
                'camper' => $this->validateCamper($application, $paperSubstitutesDigital),
                'health' => $this->validateHealth($application),
                'behavior' => $this->validateBehavior($application),
                'equipment' => $this->validateEquipment($application),
                'diet' => $this->validateDiet($application),
                'personal_care' => $this->validatePersonalCare($application),
                'activities' => $this->validateActivities($application),
                'medications' => $this->validateMedications($application),
                'narratives' => $this->validateNarratives($application),
                'documents' => $this->validateDocuments($application, $forFinalization, $isPaper, $paperPacketPresent),
                'consents' => $this->validateConsents($application, $paperSubstitutesDigital),
            ];
        }

        // Raw document breakdown (for UI that wants to render the four doc
        // buckets separately — matches the old contract shape).
        $docBreakdown = $this->documentBreakdown($application, $forFinalization);

        // Submitted-at check is part of the camper section but callers of
        // the flat check() also want it as a standalone missing_fields
        // entry when NOT finalizing. Captured inside validateCamper.

        // Aggregate rollups
        $allSectionsComplete = true;
        foreach ($sections as $result) {
            if (! $result['is_complete']) {
                $allSectionsComplete = false;
                break;
            }
        }

        $hasBlockingDocs =
            ! empty($docBreakdown['missing'])
            || ! empty($docBreakdown['expired'])
            || ! empty($docBreakdown['incomplete']);

        $unverifiedBlocks = ! $forFinalization && ! empty($docBreakdown['unverified']);

        $isComplete = $allSectionsComplete && ! $hasBlockingDocs;
        $isValid = ! $hasBlockingDocs && ! $unverifiedBlocks;

        // State
        $state = $this->deriveState($application, $isComplete, $docBreakdown);

        // Blocking issues = high-severity missings across sections + docs
        $blockingIssues = [];
        foreach ($sections as $sectionKey => $result) {
            foreach ($result['missing'] as $item) {
                if (($item['severity'] ?? 'high') === 'high') {
                    $blockingIssues[] = [
                        'section' => $sectionKey,
                        'key' => $item['key'],
                        'label' => $item['label'],
                        'severity' => $item['severity'] ?? 'high',
                    ];
                }
            }
        }

        // Warnings = lower-severity + unverified
        $warnings = [];
        foreach ($sections as $sectionKey => $result) {
            foreach ($result['missing'] as $item) {
                if (($item['severity'] ?? 'high') !== 'high') {
                    $warnings[] = [
                        'section' => $sectionKey,
                        'key' => $item['key'],
                        'label' => $item['label'],
                        'severity' => $item['severity'],
                    ];
                }
            }
        }
        foreach ($docBreakdown['unverified'] as $doc) {
            $warnings[] = [
                'section' => 'documents',
                'key' => 'unverified_'.($doc['document_id'] ?? $doc['document_type']),
                'label' => ucwords(str_replace('_', ' ', $doc['document_type'])).' — uploaded, pending admin verification',
                'severity' => 'medium',
            ];
        }

        // Completion percentage
        $completed = 0;
        foreach (self::SECTION_KEYS as $key) {
            if ($sections[$key]['is_complete']) {
                $completed++;
            }
        }
        $completionPercentage = (int) round(($completed / count(self::SECTION_KEYS)) * 100);

        return [
            'state' => $state,
            'is_complete' => $isComplete,
            'is_valid' => $isValid,
            'sections' => $sections,
            'documents' => $docBreakdown,
            'missing_consents' => $sections['consents']['missing'],
            'blocking_issues' => $blockingIssues,
            'warnings' => $warnings,
            'completion_percentage' => $completionPercentage,
            'submission_source' => $this->submissionSourceString($application),
            'paper_substitutes_digital' => $paperSubstitutesDigital,
        ];
    }

    /**
     * Backward-compatible flat shape used by finalize(), approval gate, the
     * `/completeness` endpoint, and the existing warning modal. Keyed
     * identically to the pre-engine API; callers do not need to change.
     *
     * @return array{
     *   is_complete: bool,
     *   missing_fields: list<array{key: string, label: string, severity: string}>,
     *   missing_documents: list<array{key: string, label: string, severity: string}>,
     *   unverified_documents: list<array{key: string, label: string, severity: string}>,
     *   missing_consents: list<array{key: string, label: string, severity: string}>,
     *   submission_source: string,
     *   paper_substitutes_digital: bool,
     * }
     */
    public function check(Application $application, bool $forFinalization = false): array
    {
        $result = $this->evaluate($application, $forFinalization);

        // Flatten per-section `missing` arrays into the flat missing_fields
        // list — minus documents and consents, which have their own slots.
        $missingFields = [];
        foreach ($result['sections'] as $key => $section) {
            if ($key === 'documents' || $key === 'consents') {
                continue;
            }
            foreach ($section['missing'] as $m) {
                $missingFields[] = [
                    'key' => $m['key'],
                    'label' => $m['label'],
                    'severity' => $m['severity'] ?? 'high',
                ];
            }
        }

        // Documents: flatten missing + expired + incomplete into a single
        // "missing_documents" list (as the old check() did). Unverified
        // stays separate.
        $missingDocs = [];
        foreach ($result['documents']['missing'] as $doc) {
            $missingDocs[] = [
                'key' => 'doc_'.$doc['document_type'],
                'label' => $doc['description'] ?? ucwords(str_replace('_', ' ', $doc['document_type'])),
                'severity' => 'high',
            ];
        }
        foreach ($result['documents']['expired'] as $doc) {
            $missingDocs[] = [
                'key' => 'expired_'.($doc['document_id'] ?? $doc['document_type']),
                'label' => $this->expiredDocLabel($doc),
                'severity' => 'medium',
            ];
        }
        foreach ($result['documents']['incomplete'] as $doc) {
            $missingDocs[] = [
                'key' => 'incomplete_'.($doc['document_id'] ?? $doc['document_type']),
                'label' => $this->incompleteDocLabel($doc),
                'severity' => 'high',
            ];
        }

        // Paper-without-packet surfaces as a single missing entry on the
        // `missing_documents` list, matching the legacy behaviour.
        if ($this->isPaperSubmission($application) && ! $this->paperPacketOnFile($application, $forFinalization)) {
            $missingDocs[] = [
                'key' => 'doc_paper_application_packet',
                'label' => 'Completed paper application packet',
                'severity' => 'high',
            ];
        }

        $unverifiedDocs = [];
        foreach ($result['documents']['unverified'] as $doc) {
            $unverifiedDocs[] = [
                'key' => 'unverified_'.($doc['document_id'] ?? $doc['document_type']),
                'label' => ucwords(str_replace('_', ' ', $doc['document_type'])).' — uploaded, pending admin verification',
                'severity' => 'medium',
            ];
        }

        // Is-complete logic preserved from original:
        //   submission gate (forFinalization): unverified is not blocking
        //   approval gate:                     unverified IS blocking
        $isCompleteFlat = empty($missingFields)
            && empty($missingDocs)
            && empty($result['missing_consents'])
            && ($forFinalization || empty($unverifiedDocs));

        return [
            'is_complete' => $isCompleteFlat,
            'missing_fields' => $missingFields,
            'missing_documents' => $missingDocs,
            'unverified_documents' => $unverifiedDocs,
            'missing_consents' => $result['missing_consents'],
            'submission_source' => $result['submission_source'],
            'paper_substitutes_digital' => $result['paper_substitutes_digital'],
        ];
    }

    // ──────────────────────────────────────────────────────────────────────
    // Section validators
    // ──────────────────────────────────────────────────────────────────────

    private function validateCamper(Application $app, bool $paperSubstitutesDigital): array
    {
        $missing = [];
        $camper = $app->camper;

        if (! $camper) {
            $missing[] = $this->item('camper_missing', 'Camper record is missing');

            return $this->sectionResult(false, $missing);
        }

        foreach (self::REQUIRED_CAMPER_FIELDS as $field => $label) {
            if (empty($camper->{$field})) {
                $missing[] = $this->item($field, $label);
            }
        }

        // At least one emergency contact with primary phone.
        $contacts = $camper->emergencyContacts;
        if ($contacts->isEmpty()) {
            $missing[] = $this->item('emergency_contact', 'No emergency contact on file');
        } else {
            $hasPhone = $contacts->contains(fn ($c) => ! empty($c->phone_primary));
            if (! $hasPhone) {
                $missing[] = $this->item('emergency_contact_phone', 'Emergency contact primary phone number is missing');
            }
            $hasName = $contacts->contains(fn ($c) => ! empty($c->name));
            if (! $hasName) {
                $missing[] = $this->item('emergency_contact_name', 'Emergency contact name is missing');
            }
        }

        if (! $this->sectionReviewed($app, 'camper')) {
            $missing[] = $this->item(
                'camper_section_review',
                'Please review the camper information section',
            );
        }

        return $this->sectionResult(empty($missing), $missing);
    }

    private function validateHealth(Application $app): array
    {
        $missing = [];
        $camper = $app->camper;
        $mr = $camper?->medicalRecord;

        if (! $mr) {
            $missing[] = $this->item('medical_record', 'Medical record has not been started');

            return $this->sectionResult(false, $missing);
        }

        if (empty($mr->physician_name)) {
            $missing[] = $this->item('physician_name', 'Physician name is required');
        }

        // Insurance: the parent must give an explicit answer via
        // insurance_type. 'none' is a complete answer by itself; 'medicaid'
        // and 'other' additionally require the matching detail field.
        // An unanswered record (insurance_type null) is incomplete.
        //
        // Prior to 2026-04-23 this rule checked only insurance_provider OR
        // medicaid_number. That made "No insurance" — a valid UI choice —
        // indistinguishable from "parent hasn't answered yet", so the
        // Health section could never turn green for uninsured campers.
        $insuranceMissing = match ($mr->insurance_type) {
            'none' => null,
            'medicaid' => empty($mr->medicaid_number)
                ? $this->item('medicaid_number', 'Medicaid number is required when Medicaid is selected')
                : null,
            'other' => empty($mr->insurance_provider)
                ? $this->item('insurance_provider', 'Insurance provider is required for private/other insurance')
                : null,
            default => $this->item('insurance', 'Please answer the insurance question (No insurance, Medicaid, or Private/other)'),
        };
        if ($insuranceMissing !== null) {
            $missing[] = $insuranceMissing;
        }

        // Conditional: has_seizures → seizure_description required.
        if ($mr->has_seizures && empty($mr->seizure_description)) {
            $missing[] = $this->item(
                'seizure_description',
                'Seizure description is required when seizure history is indicated',
                'high',
            );
        }

        // CYSHCN eligibility — every camper has at least one recorded
        // diagnosis. An empty diagnosis list means the parent hasn't
        // completed the health section.
        if ($camper->diagnoses->isEmpty()) {
            $missing[] = $this->item(
                'diagnoses',
                'At least one diagnosis is required for CYSHCN eligibility',
            );
        }

        if (! $this->sectionReviewed($app, 'health')) {
            $missing[] = $this->item(
                'health_section_review',
                'Please review the health & medical section',
            );
        }

        return $this->sectionResult(empty($missing), $missing);
    }

    private function validateBehavior(Application $app): array
    {
        $missing = [];
        $errors = [];
        /** @var \App\Models\Camper|null $camper */
        $camper = $app->camper;
        /** @var \App\Models\BehavioralProfile|null $bp */
        $bp = $camper?->behavioralProfile;

        // Conditional rules apply regardless of data-or-attestation path:
        // if a flag is set, its description must be present.
        $conditionalPairs = [
            ['aggression',            'aggression_description',            'Aggression description'],
            ['self_abuse',            'self_abuse_description',            'Self-abuse description'],
            ['wandering_risk',        'wandering_description',             'Wandering risk description'],
            ['one_to_one_supervision', 'one_to_one_description',            'One-to-one supervision description'],
            ['sexual_behaviors',      'sexual_behaviors_description',      'Sexual behaviors description'],
            ['interpersonal_behavior', 'interpersonal_behavior_description', 'Interpersonal behavior description'],
            ['social_emotional',      'social_emotional_description',      'Social/emotional concerns description'],
        ];
        if ($bp) {
            foreach ($conditionalPairs as [$flag, $descField, $label]) {
                if (! empty($bp->{$flag}) && empty($bp->{$descField})) {
                    $errors[] = $this->item(
                        $descField,
                        $label.' is required (a behavior flag is set without a description)',
                    );
                }
            }
        }
        $missing = array_merge($missing, $errors);

        // Hybrid completion: data OR explicit attestation. Behavior data
        // exists when any flag is set OR developmental info / functioning
        // age is filled. If neither path is satisfied, the parent must
        // explicitly attest "nothing to declare".
        $hasData = $this->behaviorHasData($bp);
        if (! $hasData && ! $this->attested($app, 'behavior')) {
            $missing[] = $this->item(
                'behavior_attestation',
                'Add at least one entry above, or check "I have reviewed this section and have nothing to declare."',
            );
        } elseif (! $this->sectionReviewed($app, 'behavior')) {
            // When data IS present, require the section-reviewed stamp
            // (auto-set by the atomic section endpoint on every successful
            // save, so this is essentially "did the parent save the data").
            $missing[] = $this->item(
                'behavior_section_review',
                'Please review the behavior section.',
            );
        }

        return $this->sectionResult(empty($missing), $missing);
    }

    private function validateEquipment(Application $app): array
    {
        $missing = [];
        /** @var \App\Models\Camper|null $camper */
        $camper = $app->camper;
        $devices = $camper?->assistiveDevices ?? collect();

        // Conditional: every device row must have a device_type.
        foreach ($devices as $d) {
            if (empty($d->device_type)) {
                $missing[] = $this->item(
                    'device_'.$d->id,
                    'Assistive device row is missing a device type',
                );
            }
        }

        // Hybrid completion: data OR attestation.
        /** @var \App\Models\MedicalRecord|null $mr */
        $mr = $camper?->medicalRecord;
        $hasData = $devices->isNotEmpty()
            || ($mr !== null && ! empty($mr->mobility_notes));
        if (! $hasData && ! $this->attested($app, 'equipment')) {
            $missing[] = $this->item(
                'equipment_attestation',
                'Add at least one assistive device above, or check "I have reviewed this section and have nothing to declare."',
            );
        } elseif (! $this->sectionReviewed($app, 'equipment')) {
            $missing[] = $this->item(
                'equipment_section_review',
                'Please review the equipment section.',
            );
        }

        return $this->sectionResult(empty($missing), $missing);
    }

    private function validateDiet(Application $app): array
    {
        $missing = [];
        /** @var \App\Models\Camper|null $camper */
        $camper = $app->camper;
        /** @var \App\Models\FeedingPlan|null $fp */
        $fp = $camper?->feedingPlan;

        // Conditional rules — always apply when the parent has actually
        // flagged the conditional trigger (independent of attestation).
        if ($fp) {
            if ($fp->special_diet && empty($fp->diet_description)) {
                $missing[] = $this->item(
                    'diet_description',
                    'Diet description is required when "special diet" is indicated',
                );
            }
            if ($fp->g_tube) {
                if (empty($fp->formula)) {
                    $missing[] = $this->item('formula', 'Formula is required for g-tube feeding');
                }
                if (empty($fp->amount_per_feeding)) {
                    $missing[] = $this->item('amount_per_feeding', 'Amount per feeding is required for g-tube feeding');
                }
            }
        }

        // Hybrid completion: data OR attestation.
        $hasData = $this->dietHasData($fp);
        if (! $hasData && ! $this->attested($app, 'diet')) {
            $missing[] = $this->item(
                'diet_attestation',
                'Indicate any dietary needs above, or check "I have reviewed this section and have nothing to declare."',
            );
        } elseif (! $this->sectionReviewed($app, 'diet')) {
            $missing[] = $this->item(
                'diet_section_review',
                'Please review the diet & feeding section.',
            );
        }

        return $this->sectionResult(empty($missing), $missing);
    }

    private function validatePersonalCare(Application $app): array
    {
        $missing = [];
        $camper = $app->camper;
        $pcp = $camper?->personalCarePlan;

        if (! $pcp) {
            $missing[] = $this->item(
                'personal_care_plan',
                'Personal care plan has not been completed',
            );

            return $this->sectionResult(false, $missing);
        }

        $required = [
            'bathing_level' => 'Bathing assistance level',
            'toileting_level' => 'Toileting assistance level',
            'dressing_level' => 'Dressing assistance level',
            'oral_hygiene_level' => 'Oral hygiene assistance level',
        ];
        foreach ($required as $field => $label) {
            $value = $pcp->{$field};
            if (empty($value) || ! in_array($value, self::VALID_ADL_LEVELS, true)) {
                $missing[] = $this->item($field, $label.' is required');
            }
        }

        if (! $this->sectionReviewed($app, 'personal_care')) {
            $missing[] = $this->item(
                'personal_care_section_review',
                'Please review the personal care section',
            );
        }

        return $this->sectionResult(empty($missing), $missing);
    }

    private function validateActivities(Application $app): array
    {
        $missing = [];
        $camper = $app->camper;
        $permissions = $camper?->activityPermissions ?? collect();

        $permsByName = $permissions->keyBy('activity_name');
        foreach (self::CANONICAL_ACTIVITIES as $slug => $label) {
            $perm = $permsByName->get($slug);
            if (! $perm || empty($perm->permission_level)) {
                $missing[] = $this->item(
                    'activity_'.$slug,
                    $label.' permission is required',
                );
                continue;
            }
            if ($perm->permission_level === 'restricted' && empty($perm->restriction_notes)) {
                $missing[] = $this->item(
                    'activity_'.$slug.'_notes',
                    $label.' is marked restricted — restriction notes are required',
                );
            }
        }

        if (! $this->sectionReviewed($app, 'activities')) {
            $missing[] = $this->item(
                'activities_section_review',
                'Please review the activities & permissions section',
            );
        }

        return $this->sectionResult(empty($missing), $missing);
    }

    private function validateMedications(Application $app): array
    {
        $missing = [];
        $camper = $app->camper;
        $medications = $camper?->medications ?? collect();

        foreach ($medications as $m) {
            if (empty($m->name)) {
                $missing[] = $this->item('medication_name_'.$m->id, 'A medication row is missing a name');
            }
            if (empty($m->dosage)) {
                $missing[] = $this->item('medication_dosage_'.$m->id, 'A medication row is missing a dosage');
            }
            if (empty($m->frequency)) {
                $missing[] = $this->item('medication_frequency_'.$m->id, 'A medication row is missing a frequency');
            }
        }

        // Hybrid completion: data OR attestation.
        $hasData = $medications->isNotEmpty();
        if (! $hasData && ! $this->attested($app, 'medications')) {
            $missing[] = $this->item(
                'medications_attestation',
                'Add at least one medication above, or check "I have reviewed this section and have nothing to declare."',
            );
        } elseif (! $this->sectionReviewed($app, 'medications')) {
            $missing[] = $this->item(
                'medications_section_review',
                'Please review the medications section.',
            );
        }

        return $this->sectionResult(empty($missing), $missing);
    }

    private function validateNarratives(Application $app): array
    {
        $missing = [];

        // Narrative fields are application-scoped (they live on the Application
        // row, not the Camper), so there is no phantom-completion risk here.
        // But we still require the review flag so the parent confirms they've
        // seen the section this year — otherwise a parent who legitimately
        // wrote narratives last year could silently skip the section on a
        // cloned/reapplication draft and never realize they need to review.

        if (! $this->sectionReviewed($app, 'narratives')) {
            $missing[] = $this->item(
                'narratives_section_review',
                'Please review the narratives section (mark as reviewed if there is nothing to declare)',
            );
        }

        return $this->sectionResult(empty($missing), $missing);
    }

    private function validateDocuments(
        Application $app,
        bool $forFinalization,
        bool $isPaper,
        bool $paperPacketPresent,
    ): array {
        // Paper submissions substitute the entire document checklist with a
        // scanned packet. When the packet is on file, waive universal document
        // requirements (insurance card, immunization records) — staff review
        // the scans and can upload discrete documents via the admin path before
        // approving.
        if ($isPaper && $paperPacketPresent) {
            return $this->sectionResult(true, []);
        }

        $breakdown = $this->documentBreakdown($app, $forFinalization);
        $missing = [];

        foreach ($breakdown['missing'] as $doc) {
            $missing[] = $this->item(
                'doc_'.$doc['document_type'],
                $doc['description'] ?? ucwords(str_replace('_', ' ', $doc['document_type'])),
            );
        }
        foreach ($breakdown['expired'] as $doc) {
            // Expired documents block approval — always high severity so
            // they surface in blocking_issues (not warnings).
            $missing[] = $this->item(
                'expired_'.($doc['document_id'] ?? $doc['document_type']),
                $this->expiredDocLabel($doc),
                'high',
            );
        }
        foreach ($breakdown['incomplete'] as $doc) {
            $missing[] = $this->item(
                'incomplete_'.($doc['document_id'] ?? $doc['document_type']),
                $this->incompleteDocLabel($doc),
            );
        }

        if ($isPaper && ! $paperPacketPresent) {
            $missing[] = $this->item(
                'doc_paper_application_packet',
                'Completed paper application packet is required',
            );
        }

        return $this->sectionResult(empty($missing), $missing);
    }

    private function validateConsents(Application $app, bool $paperSubstitutesDigital): array
    {
        $missing = [];

        if ($paperSubstitutesDigital) {
            return $this->sectionResult(true, $missing);
        }

        // Guardian electronic signature — required on the Application record itself.
        // Checked here (not in validateCamper) because the signature is captured on
        // the consents step of the form, not the camper-info step.
        if (! $app->signed_at) {
            $missing[] = $this->item('signature', 'Guardian signature is missing');
        }

        $signedTypes = $app->consents->pluck('consent_type')->all();
        foreach (self::REQUIRED_CONSENT_TYPES as $type => $label) {
            if (! in_array($type, $signedTypes, true)) {
                $missing[] = $this->item($type, $label.' not signed');
            }
        }

        return $this->sectionResult(empty($missing), $missing);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────

    private function documentBreakdown(Application $app, bool $forFinalization): array
    {
        // Paper submissions with the packet on file substitute for all individual
        // document requirements — the admin reviews the scanned packet directly.
        // This mirrors the waiver already applied in validateDocuments().
        if ($this->isPaperSubmission($app) && $this->paperPacketOnFile($app, $forFinalization)) {
            return ['missing' => [], 'expired' => [], 'incomplete' => [], 'unverified' => []];
        }

        // Always pass $app so checkCompliance can see the documents attached
        // to THIS specific application — even if the application is still a
        // draft. Without this, a parent who uploads every required document
        // to their draft would see the Documents pill stay incomplete until
        // the moment of finalize, because getUploadedDocuments excludes
        // draft applications by default.
        //
        // The "admin doesn't see staging PHI from sibling drafts" guard is
        // unaffected: getUploadedDocuments still filters out OTHER drafts of
        // the camper; only the application being evaluated is admitted.
        // (The admin's own /campers/{id}/compliance endpoint calls
        // checkCompliance($camper, null) directly and does not route through
        // this method.)
        $compliance = $this->documentEnforcement->checkCompliance($app->camper, $app);

        return [
            'missing' => $compliance['missing_documents'] ?? [],
            'expired' => $compliance['expired_documents'] ?? [],
            'incomplete' => $compliance['incomplete_documents'] ?? [],
            'unverified' => $compliance['unverified_documents'] ?? [],
        ];
    }

    private function isPaperSubmission(Application $app): bool
    {
        return in_array(
            $app->submission_source?->value,
            ['paper_self', 'paper_admin'],
            true,
        );
    }

    private function paperPacketOnFile(Application $app, bool $forFinalization = false): bool
    {
        // During finalization the packet is still a draft (submitted_at = null)
        // because finalize() submits documents only after the completeness gate
        // passes. We must treat unsubmitted drafts as present so the gate does
        // not trap the applicant in a deadlock.
        $collection = $app->documents
            ->where('document_type', 'paper_application_packet')
            ->whereNull('archived_at');
        if (! $forFinalization) {
            $collection = $collection->whereNotNull('submitted_at');
        }
        if ($collection->isNotEmpty()) {
            return true;
        }

        $dbQuery = \App\Models\Document::query()
            ->where('document_type', 'paper_application_packet')
            ->whereNull('archived_at')
            ->where('documentable_type', \App\Models\Camper::class)
            ->where('documentable_id', $app->camper_id);
        if (! $forFinalization) {
            $dbQuery->whereNotNull('submitted_at');
        }

        return $dbQuery->exists();
    }

    private function submissionSourceString(Application $app): string
    {
        if ($app->submission_source instanceof SubmissionSource) {
            return $app->submission_source->value;
        }

        return $app->submission_source ?? 'digital';
    }

    /**
     * Has the parent explicitly attested "nothing to declare" for this
     * section? Used by the four hybrid sections (behavior, equipment,
     * diet, medications) where empty data is legitimately complete.
     *
     * Non-draft applications are implicitly attested — same as
     * sectionReviewed(). A submitted application either passed the
     * finalize gate (which required hybrid completion at the time) OR
     * predates the section_attestations column entirely. Re-asking the
     * gate for historical records would retroactively flip them to
     * INCOMPLETE, which is wrong: the snapshot at submission time is
     * what matters for non-drafts, not the current rule set.
     *
     * The admin approval gate uses this same evaluation; the
     * IncompleteApprovalModal override remains the escape hatch when
     * the admin wants to flag a missing attestation on a legacy record.
     */
    private function attested(Application $app, string $section): bool
    {
        if (! in_array($section, self::ATTESTABLE_SECTIONS, true)) {
            return false;
        }
        if (! $app->isDraft()) {
            return true;
        }
        /** @var array<string,bool> $attestations */
        $attestations = $app->section_attestations ?? [];

        return ! empty($attestations[$section]);
    }

    /**
     * Behavior section "has data" — any flag set, any description filled,
     * developmental info, communication methods, school info, or notes.
     * Used by validateBehavior() to decide whether the data path is
     * satisfied without needing the explicit attestation.
     */
    private function behaviorHasData(?\App\Models\BehavioralProfile $bp): bool
    {
        if (! $bp) {
            return false;
        }
        $flagFields = [
            'aggression', 'self_abuse', 'wandering_risk', 'one_to_one_supervision',
            'sexual_behaviors', 'interpersonal_behavior', 'social_emotional',
            'developmental_delay', 'behavior_plan',
        ];
        foreach ($flagFields as $f) {
            if (! empty($bp->{$f})) {
                return true;
            }
        }
        $textFields = [
            'functioning_age_level', 'classroom_type',
            'aggression_description', 'self_abuse_description',
            'wandering_description', 'one_to_one_description',
            'sexual_behaviors_description', 'interpersonal_behavior_description',
            'social_emotional_description',
            'follows_instructions_description', 'group_participation_description',
            'notes',
        ];
        foreach ($textFields as $f) {
            if (! empty($bp->{$f})) {
                return true;
            }
        }
        if (! empty($bp->communication_methods)) {
            return true;
        }

        return false;
    }

    /**
     * Diet section "has data" — special diet, g-tube, texture or fluid
     * modifications, scheduled feedings, or notes.
     */
    private function dietHasData(?\App\Models\FeedingPlan $fp): bool
    {
        if (! $fp) {
            return false;
        }
        $flagFields = ['special_diet', 'g_tube', 'bolus_only', 'texture_modified', 'fluid_restriction'];
        foreach ($flagFields as $f) {
            if (! empty($fp->{$f})) {
                return true;
            }
        }
        $textFields = ['diet_description', 'formula', 'amount_per_feeding', 'texture_level', 'fluid_details', 'notes'];
        foreach ($textFields as $f) {
            if (! empty($fp->{$f})) {
                return true;
            }
        }
        if (! empty($fp->feeding_times)) {
            return true;
        }
        if (! empty($fp->feedings_per_day)) {
            return true;
        }

        return false;
    }

    private function sectionReviewed(Application $app, string $section): bool
    {
        if (! in_array($section, self::REVIEW_REQUIRED_SECTIONS, true)) {
            // Sections not in the review-required list (documents, consents)
            // don't use review flags at all — their contents are the gate.
            return true;
        }

        // Non-draft applications (submitted, under_review, approved,
        // waitlisted, rejected, withdrawn, cancelled) are implicitly
        // "reviewed" — they either passed the finalize gate at submission
        // time or were moved to a terminal state by an admin. This
        // prevents historical records from flipping to INCOMPLETE
        // retroactively when validation rules tighten; the gate only
        // runs meaningfully on drafts, which is where UX needs it.
        if (! $app->isDraft()) {
            return true;
        }

        $reviewed = $app->sections_reviewed ?? [];

        return ! empty($reviewed[$section]);
    }

    /**
     * Derive the state label.
     *
     *   SUBMITTED   — the lifecycle marker is set (is_draft=false). Data
     *                 quality of a submitted app is still captured in
     *                 blocking_issues / is_valid / is_complete so callers
     *                 can still see drift.
     *   BLOCKED     — application has documents that are invalid (expired
     *                 or missing required metadata). This matches the user
     *                 semantic: "BLOCKED = has invalid/expired required
     *                 documents." Missing (never uploaded) docs fall under
     *                 INCOMPLETE because they behave the same as missing
     *                 section data from the parent's standpoint.
     *   INCOMPLETE  — missing required section data or missing documents.
     *   READY       — every section complete, no blocking docs, signed,
     *                 all consents — ready for finalize().
     */
    private function deriveState(Application $app, bool $isComplete, array $docBreakdown): string
    {
        if (! $app->isDraft()) {
            return 'SUBMITTED';
        }
        $hasInvalidDocs = ! empty($docBreakdown['expired']) || ! empty($docBreakdown['incomplete']);
        if ($hasInvalidDocs) {
            return 'BLOCKED';
        }
        if (! $isComplete) {
            return 'INCOMPLETE';
        }

        return 'READY';
    }

    private function expiredDocLabel(array $doc): string
    {
        $typeLabel = ucwords(str_replace('_', ' ', $doc['document_type']));
        if (! empty($doc['exam_date']) && ! empty($doc['expiration_date'])) {
            return sprintf(
                '%s expired on %s (physical exam dated %s must be within the past 12 months)',
                $typeLabel,
                $doc['expiration_date'],
                $doc['exam_date'],
            );
        }
        if (! empty($doc['expiration_date'])) {
            return sprintf('%s expired on %s', $typeLabel, $doc['expiration_date']);
        }

        return $typeLabel.' has expired';
    }

    private function incompleteDocLabel(array $doc): string
    {
        $typeLabel = ucwords(str_replace('_', ' ', $doc['document_type']));

        return ($doc['reason'] ?? '') === 'missing_exam_date'
            ? $typeLabel.' — physician exam date is required (enter in the Health section)'
            : $typeLabel.' — required information missing';
    }

    private function item(string $key, string $label, string $severity = 'high'): array
    {
        return ['key' => $key, 'label' => $label, 'severity' => $severity];
    }

    private function sectionResult(bool $isComplete, array $missing, array $errors = []): array
    {
        return [
            'is_complete' => $isComplete,
            'missing' => $missing,
            'errors' => $errors,
        ];
    }
}
