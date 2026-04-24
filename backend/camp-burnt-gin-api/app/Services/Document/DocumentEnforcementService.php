<?php

namespace App\Services\Document;

use App\Enums\DocumentRequestStatus;
use App\Enums\DocumentVerificationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\Document;
use App\Models\DocumentRequest;
use App\Models\RequiredDocumentRule;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;
use Illuminate\Support\Collection;

/**
 * DocumentEnforcementService — Pre-Approval Document Compliance Gating
 *
 * This service is a critical safety layer in the application approval process.
 * Before an application can be approved, this service checks that the camper's
 * uploaded documents meet the rules for their specific medical profile.
 *
 * The required documents are not one-size-fits-all. A camper with seizures needs
 * a Seizure Action Plan. A camper using a G-tube needs feeding documentation.
 * This service uses the camper's risk assessment (from SpecialNeedsRiskAssessmentService)
 * to determine exactly which documents are required for that individual.
 *
 * The check is deterministic and read-only — it never modifies data and produces
 * no side effects. It returns a structured result the controller can use to either
 * block the approval or surface specific compliance gaps to the reviewer.
 *
 * CRITICAL SAFETY LAYER: This service prevents approvals without proper medical
 * documentation, directly reducing liability and camper safety risks.
 *
 * Documents must be:
 *  1. Uploaded (present for the required document type)
 *  2. Verified (admin-approved, not pending or rejected)
 *  3. Not expired (expiration_date is in the future, if set)
 *
 * Called by: ApplicationService -> reviewApplication() (compliance gate before approval)
 *            CamperController -> complianceStatus() (for display in the admin UI)
 */
class DocumentEnforcementService
{
    /**
     * Inject the risk assessment service so we can determine which
     * document rules apply to each individual camper's medical profile.
     */
    public function __construct(
        protected SpecialNeedsRiskAssessmentService $riskAssessment
    ) {}

    /**
     * Check whether a camper's documents meet all compliance requirements.
     *
     * This method is deterministic, has no side effects, and does not modify
     * database state or log PHI. It returns a structured compliance report
     * suitable for both approval enforcement and display in the admin portal.
     *
     * @param  Camper  $camper  The camper whose documents are being checked
     * @param  \App\Models\Application|null  $finalizingApplication
     *                                                               When the caller is the applicant's own finalize flow, the target
     *                                                               application is still status='draft' at the moment this check runs
     *                                                               — but its documents DO count toward its own completeness because
     *                                                               the cascade inside finalize() is about to promote them. Pass the
     *                                                               application here to include its draft docs in the counted set.
     *                                                               Admin/approval gate callers should omit this (default null) so
     *                                                               only truly-submitted applications contribute.
     * @return array{
     *     is_compliant: bool,
     *     required_documents: array,
     *     missing_documents: array,
     *     expired_documents: array,
     *     unverified_documents: array,
     *     incomplete_documents: array
     * }
     */
    public function checkCompliance(Camper $camper, ?\App\Models\Application $finalizingApplication = null): array
    {
        // Retrieve the current risk assessment without triggering a new calculation.
        // Using getCurrentAssessment() is read-safe: it reads the existing stored record
        // rather than running assessCamper(), which would persist new data as a side effect.
        // Only falls back to a full calculation on first-time initialisation when no
        // assessment record exists yet.
        $assessment = $this->riskAssessment->getCurrentAssessment($camper);

        // Determine which document rules apply based on the assessment result
        $requiredDocuments = $this->getRequiredDocuments($assessment);

        // Fetch all documents already uploaded for this camper
        $uploadedDocuments = $this->getUploadedDocuments($camper, $finalizingApplication);

        // Each finder works against the required-type set so errors are
        // scoped to rules that actually apply to this camper. Historical
        // rows of the same type dedupe to a single representative — see
        // binByType() for the rationale behind BUG-210.
        $missingDocuments = $this->findMissingDocuments($requiredDocuments, $uploadedDocuments);

        // Testing bypass: config('compliance.strict_enabled') gates the three
        // non-presence rules (expired / unverified / incomplete-metadata).
        // When the flag is off we still check that a document EXISTS for
        // each required type — that's the contract the admin workflow
        // depends on and it can't be meaningfully relaxed — but we let
        // rows with stale or unverified metadata through so the submission
        // flow can be exercised against seed data without curating every
        // fixture's dates.
        //
        // Production hard-override: regardless of the env value, a deploy
        // running with APP_ENV=production always enforces strict mode.
        // This guards against an operator accidentally shipping a relaxed
        // gate by leaving APP_COMPLIANCE_CHECKS=false in a production .env.
        $strictMode = app()->environment('production')
            || (bool) config('compliance.strict_enabled');

        if ($strictMode) {
            $expiredDocuments = $this->findExpiredDocuments($requiredDocuments, $uploadedDocuments);
            $unverifiedDocuments = $this->findUnverifiedDocuments($requiredDocuments, $uploadedDocuments);
            $incompleteDocuments = $this->findIncompleteMetadataDocuments($requiredDocuments, $uploadedDocuments);
        } else {
            $expiredDocuments = collect();
            $unverifiedDocuments = collect();
            $incompleteDocuments = collect();
        }

        // A camper is fully compliant only when every category is empty
        $isCompliant = $missingDocuments->isEmpty()
            && $expiredDocuments->isEmpty()
            && $unverifiedDocuments->isEmpty()
            && $incompleteDocuments->isEmpty();

        return [
            'is_compliant' => $isCompliant,
            'required_documents' => $this->formatRequiredDocuments($requiredDocuments),
            'missing_documents' => $this->formatMissingDocuments($missingDocuments),
            'expired_documents' => $this->formatExpiredDocuments($expiredDocuments),
            'unverified_documents' => $this->formatUnverifiedDocuments($unverifiedDocuments),
            'incomplete_documents' => $this->formatIncompleteDocuments($incompleteDocuments),
        ];
    }

    /**
     * Determine which RequiredDocumentRules apply to this camper's assessment.
     *
     * Rules are matched by three criteria (any match counts):
     *  - Medical complexity tier  (e.g. "High complexity requires X document")
     *  - Supervision level        (e.g. "One-to-one requires Y document")
     *  - Condition flag           (e.g. "Seizures require seizure_action_plan document")
     *
     * Universal rules (no tier, level, or flag) always apply to everyone.
     *
     * PERFORMANCE: All applicable rules are fetched in a single query using OR
     * conditions rather than multiple separate queries.
     *
     * @param  array  $assessment  Result from SpecialNeedsRiskAssessmentService::assessCamper()
     * @return Collection Deduplicated collection of RequiredDocumentRule models
     */
    protected function getRequiredDocuments(array $assessment): Collection
    {
        $tier = $assessment['medical_complexity_tier'];
        $level = $assessment['supervision_level'];
        $flags = $assessment['flags'];

        // Single query that ORs together all matching rule conditions
        $rules = RequiredDocumentRule::mandatory()
            ->where(function ($query) use ($tier, $level, $flags) {
                // Universal rules: always apply (no specific tier, level, or flag)
                $query->where(function ($q) {
                    $q->whereNull('medical_complexity_tier')
                        ->whereNull('supervision_level')
                        ->whereNull('condition_flag');
                });

                // Tier-specific rules (e.g. only for High complexity campers)
                if ($tier !== null) {
                    $query->orWhere('medical_complexity_tier', $tier->value);
                }

                // Supervision-level-specific rules (e.g. only for OneToOne campers)
                if ($level !== null) {
                    $query->orWhere('supervision_level', $level->value);
                }

                // Condition-flag-specific rules (e.g. seizures, g_tube, wandering_risk)
                if (! empty($flags)) {
                    $query->orWhereIn('condition_flag', $flags);
                }
            })
            ->get();

        // Deduplicate by document_type in case multiple rules require the same document
        return $rules->unique('document_type');
    }

    /**
     * Retrieve all submitted documents uploaded for this camper from the database.
     *
     * Searches both storage paths:
     *  1. Camper-polymorphic (legacy path — documentable = App\Models\Camper)
     *  2. Application-polymorphic (primary path post-linkage fix — documentable = App\Models\Application)
     *
     * Only submitted documents (submitted_at IS NOT NULL) are considered for compliance.
     * Draft documents are still in the applicant's staging area and have not been sent to staff.
     *
     * Deduplication via unique('id') prevents double-counting if a row somehow appears
     * in both result sets (should not happen, but is a safety guard).
     */
    protected function getUploadedDocuments(Camper $camper, ?\App\Models\Application $finalizingApplication = null): Collection
    {
        // Path 1: documents directly attached to the camper record.
        // For the applicant's own finalize flow we include draft camper docs
        // because the cascade inside finalize() is about to promote them; for
        // admin callers (null $finalizingApplication) we exclude drafts so
        // staging PHI never surfaces in the review queue.
        $camperDocsQuery = Document::where('documentable_type', \App\Models\Camper::class)
            ->where('documentable_id', $camper->id)
            ->whereNull('archived_at');
        if ($finalizingApplication === null) {
            $camperDocsQuery->whereNotNull('submitted_at');
        }
        $camperDocs = $camperDocsQuery->get();

        // Path 2: documents attached to applications. A draft application's
        // docs are staging PHI for admin-facing compliance, so they are
        // excluded from that path. They ARE counted when the applicant's
        // own finalize flow is evaluating its target application — the
        // cascade inside finalize() promotes those docs atomically.
        $appIds = $camper->applications()
            ->where('status', '!=', \App\Enums\ApplicationStatus::Draft->value)
            ->whereNotNull('submitted_at')
            ->pluck('id')
            ->all();
        if ($finalizingApplication !== null && ! in_array($finalizingApplication->id, $appIds, true)) {
            $appIds[] = $finalizingApplication->id;
        }
        $appDocsQuery = Document::where('documentable_type', \App\Models\Application::class)
            ->whereIn('documentable_id', $appIds)
            ->whereNull('archived_at');
        if ($finalizingApplication === null) {
            $appDocsQuery->whereNotNull('submitted_at');
        }
        $appDocs = count($appIds) > 0 ? $appDocsQuery->get() : collect();

        $merged = $camperDocs->merge($appDocs)->unique('id')->values();

        // Path 3: approved DocumentRequests.
        // DocumentRequest uploads store only a file path on the request row and never
        // create a Document record. Query the approved requests linked to the same
        // application IDs and synthesise stub Document objects so they satisfy the
        // isVerified() / isExpired() interface the finders below rely on.
        // Stubs are appended after unique('id') because they have no id — merging
        // before would coalesce all of them into a single row via the uniqueness key.
        if (count($appIds) > 0) {
            $coveredByStubs = $merged->pluck('document_type')->flip();

            DocumentRequest::whereIn('application_id', $appIds)
                ->where('status', DocumentRequestStatus::Approved)
                ->whereNotNull('uploaded_document_path')
                ->pluck('document_type')
                ->unique()
                ->each(function (string $type) use (&$merged, $coveredByStubs) {
                    // Skip if the document table already has a row for this type;
                    // the real Document row is authoritative when both exist.
                    if ($coveredByStubs->has($type)) {
                        return;
                    }

                    $stub = new Document([
                        'document_type'       => $type,
                        'verification_status' => DocumentVerificationStatus::Approved,
                        'submitted_at'        => now(),
                        'expiration_date'     => null,
                        'archived_at'         => null,
                    ]);
                    $merged->push($stub);
                });
        }

        return $merged;
    }

    /**
     * Compliance is evaluated at the document-TYPE level, not at the row
     * level. Each required type gets at most one entry in each category:
     *
     *   • missing    — no row of this type exists.
     *   • expired    — row(s) exist but every in-date row is absent. The
     *                  newest row is returned as the representative so the
     *                  UI can name a specific filename in the error.
     *   • unverified — at least one fresh-enough row exists but admin has
     *                  not approved it yet. Pending/rejected both qualify.
     *
     * This helper bins uploaded documents by type so the three finders below
     * can reason "latest valid vs latest expired" per type without returning
     * one error per row. BUG-210 was caused by emitting one "expired" entry
     * per historical upload of the same type — the applicant saw the same
     * error six times.
     *
     * @param  Collection  $uploaded  Documents (already filtered to non-archived)
     * @return array<string, Collection> type → newest-first collection
     */
    protected function binByType(Collection $uploaded): array
    {
        return $uploaded
            ->sortByDesc('created_at')
            ->groupBy('document_type')
            ->all();
    }

    /**
     * Return required rules that have no uploaded row at all.
     *
     * A type with ONLY expired rows is NOT missing (it's expired). A type
     * with ONLY unverified rows is NOT missing (it's unverified). This
     * ensures the three categories partition the required set cleanly —
     * a single type can't appear in two of them.
     */
    protected function findMissingDocuments(Collection $requiredDocuments, Collection $uploadedDocuments): Collection
    {
        $bins = $this->binByType($uploadedDocuments);

        return $requiredDocuments->filter(
            fn ($rule) => ! isset($bins[$rule->document_type])
                || $bins[$rule->document_type]->isEmpty(),
        );
    }

    /**
     * Return one representative expired document per required type that
     * has NO in-date row on file.
     *
     * A type with both an old expired row AND a recent in-date row is
     * considered compliant — the fresh upload supersedes the stale one.
     * Only types where every row is expired produce an entry, and each
     * such type produces exactly one entry (the newest expired row, so
     * the error can name a recognisable filename).
     */
    protected function findExpiredDocuments(Collection $requiredDocuments, Collection $uploadedDocuments): Collection
    {
        $bins = $this->binByType($uploadedDocuments);
        $out = collect();

        foreach ($requiredDocuments as $rule) {
            $rows = $bins[$rule->document_type] ?? collect();
            if ($rows->isEmpty()) {
                continue; // handled by findMissingDocuments
            }

            $hasInDate = $rows->contains(fn (Document $d) => ! $d->isExpired());
            if ($hasInDate) {
                continue; // fresh upload supersedes the expired one(s)
            }

            // Every row is expired — return the newest so the UI can name it.
            $out->push($rows->first());
        }

        return $out;
    }

    /**
     * Return one representative unverified document per required type that
     * has NO admin-verified row on file.
     *
     * Same dedupe rule as expired: a type with an approved row is
     * compliant regardless of how many pending rows exist alongside it.
     */
    protected function findUnverifiedDocuments(Collection $requiredDocuments, Collection $uploadedDocuments): Collection
    {
        $bins = $this->binByType($uploadedDocuments);
        $out = collect();

        foreach ($requiredDocuments as $rule) {
            $rows = $bins[$rule->document_type] ?? collect();
            if ($rows->isEmpty()) {
                continue;
            }

            $hasVerified = $rows->contains(fn (Document $d) => $d->isVerified());
            if ($hasVerified) {
                continue;
            }

            $out->push($rows->first());
        }

        return $out;
    }

    /**
     * Types that REQUIRE an exam_date to be meaningful. These are medical
     * forms whose validity window is anchored to the physician's exam date
     * (CYSHCN rule: Form 4523 must be based on an exam in the past 12
     * months). A row uploaded without an exam_date has no expiration
     * anchor — it can neither be validated nor flagged as expired, and
     * must therefore be surfaced to the applicant as incomplete metadata.
     */
    protected const TYPES_REQUIRING_EXAM_DATE = [
        'official_medical_form',
        'physical_examination',
    ];

    /**
     * Return one representative row per required type that is uploaded but
     * missing metadata the type needs to be evaluable. Today this is only
     * the exam-date anchor for medical forms, but the category is open so
     * future "needs effective date", "needs issuing physician", etc. can
     * attach without reshuffling the compliance contract.
     *
     * A type with at least one row that HAS the needed metadata is
     * considered satisfied on this dimension; only types whose entire bin
     * is incomplete produce an entry.
     */
    protected function findIncompleteMetadataDocuments(Collection $requiredDocuments, Collection $uploadedDocuments): Collection
    {
        $bins = $this->binByType($uploadedDocuments);
        $out = collect();

        foreach ($requiredDocuments as $rule) {
            if (! in_array($rule->document_type, self::TYPES_REQUIRING_EXAM_DATE, true)) {
                continue;
            }

            $rows = $bins[$rule->document_type] ?? collect();
            if ($rows->isEmpty()) {
                continue; // caught by findMissingDocuments
            }

            $hasDatedRow = $rows->contains(fn (Document $d) => $d->expiration_date !== null);
            if ($hasDatedRow) {
                continue;
            }

            $out->push($rows->first());
        }

        return $out;
    }

    /**
     * Format required document rules for the API response.
     * Returns only non-PHI metadata (document type codes and descriptions).
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
     * Format missing document rules for the API response.
     * Returns only document type codes — no PHI is exposed.
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
     * Format expired documents for the API response.
     *
     * Returns the expiration date AND a derived exam_date when the type
     * is anchored to a physician exam (medical forms). Applicants need
     * to see BOTH so the error is actionable — just "has expired" does
     * not tell them what date to go back and correct.
     */
    protected function formatExpiredDocuments(Collection $expiredDocuments): array
    {
        return $expiredDocuments->map(function (Document $document) {
            $examDate = null;
            if (
                in_array($document->document_type, self::TYPES_REQUIRING_EXAM_DATE, true)
                && $document->expiration_date !== null
            ) {
                // Exam date = expiration_date - 1 year, per the rule in DocumentService::upload.
                // The attribute is cast to Carbon via the Document model, but the static
                // analyser sees the docblock as string — wrap with Carbon::parse to keep
                // both runtime and analyser happy without changing the cast.
                $examDate = \Carbon\Carbon::parse($document->expiration_date)
                    ->subYear()
                    ->format('Y-m-d');
            }

            return [
                'document_id' => $document->id,
                'document_type' => $document->document_type,
                'expiration_date' => $document->expiration_date?->format('Y-m-d'),
                'exam_date' => $examDate,
            ];
        })->values()->toArray();
    }

    /**
     * Format incomplete-metadata documents for the API response.
     *
     * Today this only surfaces the "medical form uploaded without exam
     * date" case. The payload identifies the document so the UI can deep
     * link back to the fix location (the Health section's exam-date field).
     */
    protected function formatIncompleteDocuments(Collection $incompleteDocuments): array
    {
        return $incompleteDocuments->map(function (Document $document) {
            return [
                'document_id' => $document->id,
                'document_type' => $document->document_type,
                'reason' => 'missing_exam_date',
            ];
        })->values()->toArray();
    }

    /**
     * Format unverified documents for the API response.
     * Returns document IDs, types, and verification status — no PHI content.
     */
    protected function formatUnverifiedDocuments(Collection $unverifiedDocuments): array
    {
        return $unverifiedDocuments->map(function (Document $document) {
            return [
                'document_id' => $document->id,
                'document_type' => $document->document_type,
                // e.g. 'pending', 'rejected' — helps the admin understand why it fails
                'verification_status' => $document->verification_status?->value,
            ];
        })->values()->toArray();
    }
}
