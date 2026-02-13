<?php

namespace App\Services\Document;

use App\Models\Camper;
use App\Models\Document;
use App\Models\RequiredDocumentRule;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;
use Illuminate\Support\Collection;

/**
 * Service for enforcing medical document compliance before application approval.
 *
 * This service determines which documents are required based on a camper's
 * medical complexity tier, supervision level, and active condition flags.
 * It verifies that all required documents exist, are verified, and have not
 * expired before allowing application approval.
 *
 * CRITICAL SAFETY LAYER: This service prevents approval of applications
 * without proper medical documentation, reducing liability and safety risks.
 */
class DocumentEnforcementService
{
    public function __construct(
        protected SpecialNeedsRiskAssessmentService $riskAssessment
    ) {}

    /**
     * Check compliance status for a camper.
     *
     * This method is deterministic, has no side effects, and does not
     * modify database state or log PHI. It returns structured compliance
     * information suitable for approval enforcement and parent notification.
     *
     * @param  Camper  $camper  The camper to check compliance for
     * @return array{
     *     is_compliant: bool,
     *     required_documents: array,
     *     missing_documents: array,
     *     expired_documents: array,
     *     unverified_documents: array
     * }
     */
    public function checkCompliance(Camper $camper): array
    {
        // Get risk assessment to determine applicable rules
        $assessment = $this->riskAssessment->assessCamper($camper);

        // Determine applicable document rules
        $requiredDocuments = $this->getRequiredDocuments($assessment);

        // Get uploaded documents for this camper
        $uploadedDocuments = $this->getUploadedDocuments($camper);

        // Analyze compliance
        $missingDocuments = $this->findMissingDocuments($requiredDocuments, $uploadedDocuments);
        $expiredDocuments = $this->findExpiredDocuments($uploadedDocuments);
        $unverifiedDocuments = $this->findUnverifiedDocuments($uploadedDocuments);

        // Camper is compliant if no missing, expired, or unverified documents
        $isCompliant = $missingDocuments->isEmpty()
            && $expiredDocuments->isEmpty()
            && $unverifiedDocuments->isEmpty();

        return [
            'is_compliant' => $isCompliant,
            'required_documents' => $this->formatRequiredDocuments($requiredDocuments),
            'missing_documents' => $this->formatMissingDocuments($missingDocuments),
            'expired_documents' => $this->formatExpiredDocuments($expiredDocuments),
            'unverified_documents' => $this->formatUnverifiedDocuments($unverifiedDocuments),
        ];
    }

    /**
     * Get all required document rules for a camper based on risk assessment.
     *
     * Rules are matched by:
     * - Medical complexity tier
     * - Supervision level
     * - Active condition flags
     *
     * Multiple rules may apply to a single camper.
     */
    protected function getRequiredDocuments(array $assessment): Collection
    {
        $tier = $assessment['medical_complexity_tier'];
        $level = $assessment['supervision_level'];
        $flags = $assessment['flags'];

        // Fetch all applicable rules in a single query using OR conditions
        // PERFORMANCE: Consolidate multiple queries into one to prevent N+1
        $rules = RequiredDocumentRule::mandatory()
            ->where(function ($query) use ($tier, $level, $flags) {
                // Universal rules (no tier, level, or flag specified)
                $query->where(function ($q) {
                    $q->whereNull('medical_complexity_tier')
                        ->whereNull('supervision_level')
                        ->whereNull('condition_flag');
                });

                // Tier-specific rules
                if ($tier !== null) {
                    $query->orWhere('medical_complexity_tier', $tier->value);
                }

                // Supervision-level-specific rules
                if ($level !== null) {
                    $query->orWhere('supervision_level', $level->value);
                }

                // Condition-flag-specific rules
                if (! empty($flags)) {
                    $query->orWhereIn('condition_flag', $flags);
                }
            })
            ->get();

        // Remove duplicates by document_type
        return $rules->unique('document_type');
    }

    /**
     * Get all uploaded documents for a camper.
     *
     * Documents are loaded with minimal data to avoid N+1 queries.
     */
    protected function getUploadedDocuments(Camper $camper): Collection
    {
        return Document::where('documentable_type', Camper::class)
            ->where('documentable_id', $camper->id)
            ->get();
    }

    /**
     * Find required documents that are missing (not uploaded).
     */
    protected function findMissingDocuments(Collection $requiredDocuments, Collection $uploadedDocuments): Collection
    {
        $uploadedTypes = $uploadedDocuments->pluck('document_type')->unique();

        return $requiredDocuments->filter(function ($rule) use ($uploadedTypes) {
            return ! $uploadedTypes->contains($rule->document_type);
        });
    }

    /**
     * Find uploaded documents that have expired.
     */
    protected function findExpiredDocuments(Collection $uploadedDocuments): Collection
    {
        return $uploadedDocuments->filter(function (Document $document) {
            return $document->isExpired();
        });
    }

    /**
     * Find uploaded documents that are not verified or are rejected.
     */
    protected function findUnverifiedDocuments(Collection $uploadedDocuments): Collection
    {
        return $uploadedDocuments->filter(function (Document $document) {
            return ! $document->isVerified();
        });
    }

    /**
     * Format required documents for API response.
     *
     * Returns only non-PHI metadata about what documents are required.
     */
    protected function formatRequiredDocuments(Collection $requiredDocuments): array
    {
        return $requiredDocuments->map(function ($rule) {
            return [
                'document_type' => $rule->document_type,
                'description' => $rule->description,
                'is_mandatory' => $rule->is_mandatory,
            ];
        })->values()->toArray();
    }

    /**
     * Format missing documents for API response.
     *
     * Returns only document type codes, no PHI.
     */
    protected function formatMissingDocuments(Collection $missingDocuments): array
    {
        return $missingDocuments->map(function ($rule) {
            return [
                'document_type' => $rule->document_type,
                'description' => $rule->description,
            ];
        })->values()->toArray();
    }

    /**
     * Format expired documents for API response.
     *
     * Returns only document IDs and types, no PHI.
     */
    protected function formatExpiredDocuments(Collection $expiredDocuments): array
    {
        return $expiredDocuments->map(function (Document $document) {
            return [
                'document_id' => $document->id,
                'document_type' => $document->document_type,
                'expiration_date' => $document->expiration_date?->format('Y-m-d'),
            ];
        })->values()->toArray();
    }

    /**
     * Format unverified documents for API response.
     *
     * Returns only document IDs and types, no PHI.
     */
    protected function formatUnverifiedDocuments(Collection $unverifiedDocuments): array
    {
        return $unverifiedDocuments->map(function (Document $document) {
            return [
                'document_id' => $document->id,
                'document_type' => $document->document_type,
                'verification_status' => $document->verification_status?->value,
            ];
        })->values()->toArray();
    }
}
