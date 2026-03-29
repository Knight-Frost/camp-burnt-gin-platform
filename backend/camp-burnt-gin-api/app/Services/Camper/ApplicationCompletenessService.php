<?php

namespace App\Services\Camper;

use App\Models\Application;
use App\Services\Document\DocumentEnforcementService;

/**
 * ApplicationCompletenessService — Pre-approval completeness evaluation.
 *
 * Inspects an application across three dimensions before an admin approves:
 *   1. Required camper/application fields (name, DOB, signature, emergency contact).
 *   2. Required documents (medical form upload, compliance documents).
 *   3. Required consent records (all 5 consent types signed).
 *
 * This service does NOT block approval — it only surfaces what is missing.
 * The decision to proceed despite missing data rests entirely with the admin,
 * who must explicitly confirm the override and whose action is audit-logged.
 *
 * The check() method is the single entry point. Call it before presenting
 * the approval UI to the admin; if is_complete is false, show the warning modal.
 */
class ApplicationCompletenessService
{
    /**
     * Camper profile fields that must be non-empty before approval.
     * Key = model attribute, value = human-readable label for the warning modal.
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
     * These match the values accepted by storeConsents() in ApplicationController.
     */
    private const REQUIRED_CONSENT_TYPES = [
        'general' => 'Medical treatment authorization',
        'photos' => 'Photo and media release',
        'liability' => 'Release of liability',
        'activity' => 'Activity participation consent',
        'authorization' => 'HIPAA authorization',
    ];

    public function __construct(
        protected DocumentEnforcementService $documentEnforcement,
    ) {}

    /**
     * Evaluate an application for completeness and return a structured report.
     *
     * Loads required relationships before checking; safe to call with an already-
     * loaded application (loadMissing is idempotent).
     *
     * @return array{
     *   is_complete: bool,
     *   missing_fields: list<array{key: string, label: string, severity: string}>,
     *   missing_documents: list<array{key: string, label: string, severity: string}>,
     *   missing_consents: list<array{key: string, label: string, severity: string}>,
     * }
     */
    public function check(Application $application): array
    {
        $application->loadMissing([
            'camper.emergencyContacts',
            'camper.medicalRecord',
            'consents',
            'documents',
        ]);

        $missingFields = $this->checkCamperFields($application);
        $missingDocuments = $this->checkDocuments($application);
        $missingConsents = $this->checkConsents($application);

        return [
            'is_complete' => empty($missingFields) && empty($missingDocuments) && empty($missingConsents),
            'missing_fields' => $missingFields,
            'missing_documents' => $missingDocuments,
            'missing_consents' => $missingConsents,
        ];
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function checkCamperFields(Application $application): array
    {
        $missing = [];
        $camper = $application->camper;

        foreach (self::REQUIRED_CAMPER_FIELDS as $field => $label) {
            if (empty($camper->{$field})) {
                $missing[] = ['key' => $field, 'label' => $label, 'severity' => 'high'];
            }
        }

        // The application must have been formally submitted (not still a draft).
        if ($application->is_draft || ! $application->submitted_at) {
            $missing[] = [
                'key' => 'submitted',
                'label' => 'Application has not been submitted by the family',
                'severity' => 'high',
            ];
        }

        // A digital guardian signature is required for legal record.
        if (! $application->signed_at) {
            $missing[] = [
                'key' => 'signature',
                'label' => 'Guardian signature is missing',
                'severity' => 'high',
            ];
        }

        // At least one emergency contact must exist with a primary phone number.
        $contacts = $camper->emergencyContacts;
        if ($contacts->isEmpty()) {
            $missing[] = [
                'key' => 'emergency_contact',
                'label' => 'No emergency contact on file',
                'severity' => 'high',
            ];
        } else {
            $hasPhone = $contacts->contains(fn ($c) => ! empty($c->phone_primary));
            if (! $hasPhone) {
                $missing[] = [
                    'key' => 'emergency_contact_phone',
                    'label' => 'Emergency contact primary phone number is missing',
                    'severity' => 'high',
                ];
            }
        }

        return $missing;
    }

    private function checkDocuments(Application $application): array
    {
        $missing = [];

        // The physician-completed medical form must have been uploaded.
        $hasMedicalForm = $application->documents
            ->where('document_type', 'official_medical_form')
            ->isNotEmpty();

        if (! $hasMedicalForm) {
            $missing[] = [
                'key' => 'medical_form',
                'label' => 'Medical Form (physician-completed) has not been uploaded',
                'severity' => 'high',
            ];
        }

        // Delegate dynamic document requirement evaluation to DocumentEnforcementService.
        // This covers risk-based rules (seizure action plans, G-tube protocols, etc.).
        if ($application->camper->medicalRecord) {
            $compliance = $this->documentEnforcement->checkCompliance($application->camper);

            foreach ($compliance['missing_documents'] as $doc) {
                $missing[] = [
                    'key' => 'doc_'.$doc['document_type'],
                    'label' => $doc['description'] ?? ucwords(str_replace('_', ' ', $doc['document_type'])),
                    'severity' => 'high',
                ];
            }

            foreach ($compliance['expired_documents'] as $doc) {
                $missing[] = [
                    'key' => 'expired_'.($doc['document_id'] ?? $doc['document_type']),
                    'label' => ucwords(str_replace('_', ' ', $doc['document_type'])).' has expired',
                    'severity' => 'medium',
                ];
            }

            foreach ($compliance['unverified_documents'] as $doc) {
                $missing[] = [
                    'key' => 'unverified_'.($doc['document_id'] ?? $doc['document_type']),
                    'label' => ucwords(str_replace('_', ' ', $doc['document_type'])).' has not been verified by admin',
                    'severity' => 'medium',
                ];
            }
        }

        return $missing;
    }

    private function checkConsents(Application $application): array
    {
        $missing = [];
        $signedTypes = $application->consents->pluck('consent_type')->all();

        foreach (self::REQUIRED_CONSENT_TYPES as $type => $label) {
            if (! in_array($type, $signedTypes, true)) {
                $missing[] = [
                    'key' => $type,
                    'label' => $label.' not signed',
                    'severity' => 'high',
                ];
            }
        }

        return $missing;
    }
}
