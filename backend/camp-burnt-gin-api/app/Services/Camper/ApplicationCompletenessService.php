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
 * Data-OR-review sections:
 *
 *   Not every section has mandatory data for every camper. A CYSHCN camp
 *   serves kids with and without assistive devices, with and without
 *   medications, etc. For `behavior`, `equipment`, `diet`, `medications`,
 *   and `narratives` the engine accepts EITHER (a) positive data, OR (b) an
 *   explicit "I reviewed this section and have nothing to add" timestamp
 *   stored on `applications.sections_reviewed`. Conditional rules still
 *   fire — e.g. if g_tube=true then formula + amount_per_feeding are
 *   required regardless of the review flag.
 *
 *   Camper / health / personal_care / activities / documents / consents do
 *   NOT accept the review-only path — they always require data.
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
        'arts_crafts'  => 'Arts & Crafts',
        'nature'       => 'Nature Activities',
        'fine_arts'    => 'Fine Arts',
        'swimming'     => 'Swimming',
        'boating'      => 'Boating',
        'camp_out'     => 'Camp Out',
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
     * Sections that accept a "review timestamp" in lieu of data. Every
     * other section requires positive data to be considered complete.
     */
    private const REVIEW_OPTIONAL_SECTIONS = [
        'behavior', 'equipment', 'diet', 'medications', 'narratives',
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
        $paperPacketPresent = $this->paperPacketOnFile($application);
        $paperSubstitutesDigital = $isPaper && $paperPacketPresent;

        // Per-section validators
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
        if ($this->isPaperSubmission($application) && ! $this->paperPacketOnFile($application)) {
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

        // Digital signature required unless paper packet substitutes.
        if (! $paperSubstitutesDigital && ! $app->signed_at) {
            $missing[] = $this->item('signature', 'Guardian signature is missing');
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

        // Insurance: require provider OR medicaid number. Either is
        // sufficient proof the parent answered the insurance question.
        $hasInsurance = ! empty($mr->insurance_provider) || ! empty($mr->medicaid_number);
        if (! $hasInsurance) {
            $missing[] = $this->item('insurance', 'Insurance provider or Medicaid number is required');
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

        return $this->sectionResult(empty($missing), $missing);
    }

    private function validateBehavior(Application $app): array
    {
        $missing = [];
        $errors = [];
        $camper = $app->camper;
        $bp = $camper?->behavioralProfile;

        // Conditional rules apply regardless of data-or-review path.
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

        $hasData = $bp
            && (! empty($bp->communication_style)
                || ! empty($bp->triggers)
                || ! empty($bp->notes)
                || $this->anyBehaviorFlagSet($bp));

        $reviewed = $this->sectionReviewed($app, 'behavior');

        if (! $hasData && ! $reviewed) {
            $missing[] = $this->item(
                'behavior_section',
                'Behavior section has not been filled in or marked reviewed',
            );
        }

        // Conditional errors are always blocking.
        $missing = array_merge($missing, $errors);

        return $this->sectionResult(empty($missing), $missing);
    }

    private function validateEquipment(Application $app): array
    {
        $missing = [];
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

        $hasData = $devices->isNotEmpty();
        $reviewed = $this->sectionReviewed($app, 'equipment');

        if (! $hasData && ! $reviewed) {
            $missing[] = $this->item(
                'equipment_section',
                'Equipment section has not been filled in or marked reviewed',
            );
        }

        return $this->sectionResult(empty($missing), $missing);
    }

    private function validateDiet(Application $app): array
    {
        $missing = [];
        $camper = $app->camper;
        $fp = $camper?->feedingPlan;

        // Conditional rules (always apply when a feeding plan exists).
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

        $hasData = $fp !== null;
        $reviewed = $this->sectionReviewed($app, 'diet');

        if (! $hasData && ! $reviewed) {
            $missing[] = $this->item(
                'diet_section',
                'Diet & feeding section has not been filled in or marked reviewed',
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

        $hasData = $medications->isNotEmpty();
        $reviewed = $this->sectionReviewed($app, 'medications');

        if (! $hasData && ! $reviewed) {
            $missing[] = $this->item(
                'medications_section',
                'Medications section has not been filled in or marked reviewed',
            );
        }

        return $this->sectionResult(empty($missing), $missing);
    }

    private function validateNarratives(Application $app): array
    {
        $missing = [];

        $narrativeFields = [
            'narrative_rustic_environment',
            'narrative_staff_suggestions',
            'narrative_participation_concerns',
            'narrative_camp_benefit',
            'narrative_heat_tolerance',
            'narrative_transportation',
            'narrative_additional_info',
            'narrative_emergency_protocols',
        ];
        $hasAny = false;
        foreach ($narrativeFields as $f) {
            if (! empty($app->{$f})) {
                $hasAny = true;
                break;
            }
        }

        $reviewed = $this->sectionReviewed($app, 'narratives');

        if (! $hasAny && ! $reviewed) {
            $missing[] = $this->item(
                'narratives_section',
                'Narratives section has not been filled in or marked reviewed',
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
        $compliance = $this->documentEnforcement->checkCompliance(
            $app->camper,
            $forFinalization ? $app : null,
        );

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

    private function paperPacketOnFile(Application $app): bool
    {
        $applicationPacket = $app->documents
            ->where('document_type', 'paper_application_packet')
            ->whereNotNull('submitted_at')
            ->whereNull('archived_at')
            ->isNotEmpty();

        if ($applicationPacket) {
            return true;
        }

        return \App\Models\Document::query()
            ->where('document_type', 'paper_application_packet')
            ->whereNotNull('submitted_at')
            ->whereNull('archived_at')
            ->where('documentable_type', \App\Models\Camper::class)
            ->where('documentable_id', $app->camper_id)
            ->exists();
    }

    private function submissionSourceString(Application $app): string
    {
        if ($app->submission_source instanceof SubmissionSource) {
            return $app->submission_source->value;
        }

        return $app->submission_source ?? 'digital';
    }

    private function sectionReviewed(Application $app, string $section): bool
    {
        if (! in_array($section, self::REVIEW_OPTIONAL_SECTIONS, true)) {
            return false;
        }
        $reviewed = $app->sections_reviewed ?? [];

        return ! empty($reviewed[$section]);
    }

    private function anyBehaviorFlagSet($bp): bool
    {
        $flags = [
            'aggression', 'self_abuse', 'wandering_risk', 'one_to_one_supervision',
            'developmental_delay', 'sexual_behaviors', 'interpersonal_behavior',
            'social_emotional', 'functional_reading', 'functional_writing',
            'independent_mobility', 'verbal_communication', 'social_skills',
            'behavior_plan',
        ];
        foreach ($flags as $f) {
            if (! empty($bp->{$f})) {
                return true;
            }
        }

        return false;
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
