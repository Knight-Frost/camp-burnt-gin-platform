<?php

namespace App\Http\Resources;

use App\Models\Application;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ApplicationResource — canonical 11-section projection for a single
 * application. This is the one shape admin and applicant frontends both
 * render from.
 *
 * Invariants:
 *   • All 11 sections are always structurally present, even when empty
 *     (empty object / empty array). Frontends must not test-for-existence
 *     before rendering a section — they render the section and branch on
 *     field values.
 *   • Document compliance is computed server-side and attached per document
 *     via ApplicationDocumentResource. Frontends do NOT recompute expired /
 *     verified / incomplete flags.
 *   • Role-based divergence is ONE thing: admins see documents filtered to
 *     `visible_to_admin=true`; applicants see all. Nothing else branches on
 *     role inside this resource.
 *
 * The 11 sections:
 *   1. camper         — general info (first/last/dob/gender/tshirt/county/…)
 *   2. health         — medical_record block + diagnoses + allergies
 *   3. behavior       — behavioral profile fields
 *   4. equipment      — assistive_devices list
 *   5. diet           — feeding_plan block
 *   6. personal_care  — personal_care_plan block
 *   7. activities     — activity_permissions list
 *   8. medications    — medications list (own top-level section per form)
 *   9. narratives     — 8 free-text narrative fields on Application
 *  10. documents      — filtered per role, each shaped by the doc resource
 *  11. consents       — application_consents + signature fields
 *
 * Plus a top-level `meta` block with compliance summary, timestamps,
 * and status.
 */
class ApplicationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Application $app */
        $app = $this->resource;

        $viewer = $request->user();
        $viewerIsAdmin = $viewer !== null && method_exists($viewer, 'isAdmin') && $viewer->isAdmin();

        return [
            'id' => $app->id,
            'status' => $app->status instanceof \BackedEnum ? $app->status->value : $app->status,
            'submitted_at' => $app->submitted_at?->toISOString(),
            'signed_at' => $app->signed_at?->toISOString(),
            'signature_name' => $app->signature_name,
            'camp_session_id' => $app->camp_session_id,
            'second_session_id' => $app->second_session_id,
            'camp_session' => $this->shapeSession($app->campSession),
            'second_session' => $this->shapeSession($app->secondSession),
            'submission_source' => $app->submission_source instanceof \BackedEnum ? $app->submission_source->value : $app->submission_source,

            // ── The 11 canonical sections ──────────────────────────────
            'sections' => [
                'camper' => $this->sectionCamper($app),
                'health' => $this->sectionHealth($app),
                'behavior' => $this->sectionBehavior($app),
                'equipment' => $this->sectionEquipment($app),
                'diet' => $this->sectionDiet($app),
                'personal_care' => $this->sectionPersonalCare($app),
                'activities' => $this->sectionActivities($app),
                'medications' => $this->sectionMedications($app),
                'narratives' => $this->sectionNarratives($app),
                'documents' => $this->sectionDocuments($app, $viewerIsAdmin),
                'consents' => $this->sectionConsents($app),
            ],

            'meta' => [
                // Full validation engine output (per-section, documents,
                // state, blocking_issues). This is the new canonical source
                // of truth — frontends should render from this block.
                'validation' => $this->buildValidationMeta($app),
                // Retained for back-compat with existing frontend code that
                // reads `compliance.issues` / `compliance.is_compliant`.
                // Its `is_compliant` now reflects the FULL engine result,
                // not just documents, and its `issues` array is merged with
                // per-section missing entries so the old "all on file"
                // false positive is no longer possible.
                'compliance' => $this->buildComplianceMeta($app),
            ],
        ];
    }

    /**
     * Build the rich validation block from ApplicationCompletenessService.
     * Single source of truth for application state / completeness / validity.
     */
    private function buildValidationMeta(Application $app): array
    {
        $engine = app(\App\Services\Camper\ApplicationCompletenessService::class);

        // Admin review page and applicant detail both read this block; we
        // run the engine in approval-gate mode (forFinalization=false) so
        // post-submit drift like unverified/expired documents surfaces.
        return $engine->evaluate($app, forFinalization: false);
    }

    private function shapeSession($session): ?array
    {
        if ($session === null) {
            return null;
        }

        return [
            'id' => $session->id,
            'name' => $session->name,
            'start_date' => $session->start_date?->format('Y-m-d'),
            'end_date' => $session->end_date?->format('Y-m-d'),
        ];
    }

    private function sectionCamper(Application $app): array
    {
        $c = $app->camper;
        if ($c === null) {
            return $this->emptyCamperSection();
        }

        return [
            'id' => $c->id,
            'first_name' => $c->first_name,
            'last_name' => $c->last_name,
            'preferred_name' => $c->preferred_name,
            'full_name' => $c->full_name,
            'date_of_birth' => $c->date_of_birth?->format('Y-m-d'),
            'gender' => $c->gender,
            'tshirt_size' => $c->tshirt_size,
            'county' => $c->county,
            'needs_interpreter' => (bool) $c->needs_interpreter,
            'preferred_language' => $c->preferred_language,
            'supervision_level' => $c->supervision_level instanceof \BackedEnum ? $c->supervision_level->value : $c->supervision_level,
            'applicant_address' => $c->applicant_address,
            'applicant_city' => $c->applicant_city,
            'applicant_state' => $c->applicant_state,
            'applicant_zip' => $c->applicant_zip,
            'emergency_contacts' => $c->emergencyContacts->map(fn ($e) => [
                'id' => $e->id,
                'name' => $e->name,
                'relationship' => $e->relationship,
                'phone_primary' => $e->phone_primary,
                'phone_secondary' => $e->phone_secondary,
                'is_primary' => (bool) $e->is_primary,
                'is_guardian' => (bool) $e->is_guardian,
                'is_authorized_pickup' => (bool) $e->is_authorized_pickup,
            ])->values()->all(),
        ];
    }

    private function emptyCamperSection(): array
    {
        return [
            'id' => null, 'first_name' => null, 'last_name' => null,
            'preferred_name' => null, 'full_name' => null,
            'date_of_birth' => null, 'gender' => null, 'tshirt_size' => null,
            'county' => null, 'needs_interpreter' => false,
            'preferred_language' => null, 'supervision_level' => null,
            'applicant_address' => null, 'applicant_city' => null,
            'applicant_state' => null, 'applicant_zip' => null,
            'emergency_contacts' => [],
        ];
    }

    private function sectionHealth(Application $app): array
    {
        $c = $app->camper;
        $mr = $c?->medicalRecord;

        return [
            'medical_record' => $mr === null ? null : array_filter($mr->only($mr->getFillable()), fn ($v, $k) => $k !== 'camper_id', ARRAY_FILTER_USE_BOTH),
            'diagnoses' => ($c?->diagnoses ?? collect())->map(fn ($d) => [
                'id' => $d->id,
                'name' => $d->name,
                'description' => $d->description,
                'severity_level' => $d->severity_level instanceof \BackedEnum ? $d->severity_level->value : $d->severity_level,
            ])->values()->all(),
            'allergies' => ($c?->allergies ?? collect())->map(fn ($a) => [
                'id' => $a->id,
                'allergen' => $a->allergen,
                'severity' => $a->severity instanceof \BackedEnum ? $a->severity->value : $a->severity,
                'reaction' => $a->reaction,
                'treatment' => $a->treatment,
            ])->values()->all(),
        ];
    }

    private function sectionBehavior(Application $app): ?array
    {
        $bp = $app->camper?->behavioralProfile;
        if ($bp === null) {
            return null;
        }

        $fields = $bp->getFillable();

        return collect($bp->only($fields))
            ->except(['camper_id'])
            ->all();
    }

    private function sectionEquipment(Application $app): array
    {
        return [
            'assistive_devices' => ($app->camper?->assistiveDevices ?? collect())->map(fn ($v) => [
                'id' => $v->id,
                'device_type' => $v->device_type,
                'requires_transfer_assistance' => (bool) $v->requires_transfer_assistance,
                'notes' => $v->notes,
            ])->values()->all(),
        ];
    }

    private function sectionDiet(Application $app): ?array
    {
        $fp = $app->camper?->feedingPlan;
        if ($fp === null) {
            return null;
        }

        return collect($fp->only($fp->getFillable()))
            ->except(['camper_id'])
            ->all();
    }

    private function sectionPersonalCare(Application $app): ?array
    {
        $pcp = $app->camper?->personalCarePlan;
        if ($pcp === null) {
            return null;
        }

        return collect($pcp->only($pcp->getFillable()))
            ->except(['camper_id'])
            ->all();
    }

    private function sectionActivities(Application $app): array
    {
        return [
            'permissions' => ($app->camper?->activityPermissions ?? collect())->map(fn ($ap) => [
                'id' => $ap->id,
                'activity_name' => $ap->activity_name,
                'permission_level' => $ap->permission_level instanceof \BackedEnum ? $ap->permission_level->value : $ap->permission_level,
                'restriction_notes' => $ap->restriction_notes,
            ])->values()->all(),
        ];
    }

    private function sectionMedications(Application $app): array
    {
        return [
            'list' => ($app->camper?->medications ?? collect())->map(fn ($m) => [
                'id' => $m->id,
                'name' => $m->name,
                'dosage' => $m->dosage,
                'frequency' => $m->frequency,
                'purpose' => $m->purpose,
            ])->values()->all(),
        ];
    }

    private function sectionNarratives(Application $app): array
    {
        return [
            'rustic_environment' => $app->narrative_rustic_environment,
            'staff_suggestions' => $app->narrative_staff_suggestions,
            'participation_concerns' => $app->narrative_participation_concerns,
            'camp_benefit' => $app->narrative_camp_benefit,
            'heat_tolerance' => $app->narrative_heat_tolerance,
            'transportation' => $app->narrative_transportation,
            'additional_info' => $app->narrative_additional_info,
            'emergency_protocols' => $app->narrative_emergency_protocols,
        ];
    }

    /**
     * Documents section — one LIVE document per document_type.
     *
     * Filter rules:
     *   1. Exclude archived rows for BOTH roles. Archived = superseded by
     *      a newer upload (see DocumentService::upload archive-on-reupload).
     *      Rendering stale copies alongside the current one was the
     *      root cause of the "9 Immunization Records" bug (BUG-216).
     *   2. After (1), there is at most one live row per
     *      (documentable_type, documentable_id, document_type) — enforced
     *      by the MySQL functional unique index
     *      `documents_live_ownership_unique` installed in migration
     *      2026_04_19_000003.
     *   3. Admin views additionally filter to submitted-only. Applicants
     *      still see their own drafts so they can complete the flow.
     *   4. As a belt-and-suspenders check against schema drift, an
     *      in-PHP dedupe by document_type keeps the newest live row
     *      per type if somehow more than one survived (e.g. on SQLite
     *      test DB where the functional index doesn't exist).
     */
    private function sectionDocuments(Application $app, bool $viewerIsAdmin): array
    {
        $appDocs = $app->documents ?? collect();
        $camperDocs = $app->camper?->documents ?? collect();

        $merged = $appDocs
            ->merge($camperDocs)
            ->unique('id')
            ->filter(fn ($d) => $d->archived_at === null)
            ->values();

        if ($viewerIsAdmin) {
            $merged = $merged
                ->filter(fn ($d) => $d->submitted_at !== null)
                ->values();
        }

        // App-layer dedupe by (documentable_type, documentable_id,
        // document_type) — newest id wins. No-op when the DB unique
        // index is in place; acts as a safety net on test DBs and
        // protects against any legacy orphan rows.
        $byKey = [];
        foreach ($merged as $d) {
            $key = ($d->documentable_type ?? 'orphan')
                .'|'.($d->documentable_id ?? 'orphan')
                .'|'.($d->document_type ?? 'untyped');
            if (! isset($byKey[$key]) || $d->id > $byKey[$key]->id) {
                $byKey[$key] = $d;
            }
        }
        $deduped = collect(array_values($byKey));

        return [
            'list' => $deduped->map(fn ($d) => (new ApplicationDocumentResource($d))->toArray(request()))->values()->all(),
        ];
    }

    private function sectionConsents(Application $app): array
    {
        return [
            'signed_at' => $app->signed_at?->toISOString(),
            'signature_name' => $app->signature_name,
            'consents' => ($app->consents ?? collect())->map(fn ($c) => [
                'id' => $c->id,
                'consent_type' => $c->consent_type,
                'guardian_name' => $c->guardian_name,
                'guardian_relationship' => $c->guardian_relationship,
                'guardian_signature' => $c->guardian_signature,
                'signed_at' => $c->signed_at?->toISOString(),
            ])->values()->all(),
        ];
    }

    /**
     * Build the compliance summary block at meta.compliance.
     *
     * Uses DocumentEnforcementService so the values match exactly what the
     * approval gate would use — no drift between "what the page shows" and
     * "what the system enforces". Each entry carries BOTH an admin_label and
     * an applicant_label so each frontend picks the role-appropriate wording.
     */
    private function buildComplianceMeta(Application $app): array
    {
        $camper = $app->camper;
        if ($camper === null) {
            return [
                'is_compliant' => false,
                'missing_documents' => [],
                'expired_documents' => [],
                'unverified_documents' => [],
                'incomplete_documents' => [],
                'issues' => [],
            ];
        }

        $service = app(\App\Services\Document\DocumentEnforcementService::class);
        // Pass the application as $finalizingApplication only when it's the
        // applicant's own draft — avoids the admin-gate branch filtering out
        // draft docs that legitimately belong to this application.
        $finalizing = $app->isDraft() ? $app : null;

        $report = $service->checkCompliance($camper, $finalizing);

        // Flatten into a single `issues` array with role-appropriate labels,
        // so frontends can render one unified list instead of iterating four
        // category buckets.
        $issues = [];

        foreach ($report['missing_documents'] as $m) {
            $label = $this->humanDocumentLabel($m['document_type']);
            $issues[] = [
                'category' => 'missing',
                'document_type' => $m['document_type'],
                'admin_label' => "Blocks approval: $label has not been uploaded",
                'applicant_label' => "Action needed: Upload the $label",
            ];
        }
        // Expired and incomplete-metadata document blocks are intentionally
        // omitted: exam-date / expiration-date enforcement was removed from
        // the approval gate. Unverified is the only remaining document-level
        // status that surfaces here.
        foreach ($report['unverified_documents'] as $u) {
            $label = $this->humanDocumentLabel($u['document_type']);
            $issues[] = [
                'category' => 'unverified',
                'document_type' => $u['document_type'],
                'document_id' => $u['document_id'] ?? null,
                'admin_label' => "Pending: $label awaiting verification",
                'applicant_label' => "$label submitted — awaiting staff review",
            ];
        }

        // Run the full validation engine so section-level gaps (empty diet
        // plan, no emergency contact phone, missing physician, etc.) show up
        // alongside document issues. Prevents the "All required documents
        // and metadata are on file" false positive when sections are empty.
        $engine = app(\App\Services\Camper\ApplicationCompletenessService::class);
        $validation = $engine->evaluate($app, forFinalization: false);

        foreach ($validation['blocking_issues'] as $issue) {
            // Documents already contributed entries above; avoid duplicating.
            if ($issue['section'] === 'documents' || $issue['section'] === 'consents') {
                continue;
            }
            $issues[] = [
                'category' => 'section',
                'section' => $issue['section'],
                'document_type' => 'section:'.$issue['section'],
                'admin_label' => 'Blocks approval: '.$issue['label'],
                'applicant_label' => 'Action needed: '.$issue['label'],
            ];
        }
        foreach ($validation['missing_consents'] as $c) {
            $issues[] = [
                'category' => 'consent',
                'document_type' => 'consent:'.$c['key'],
                'admin_label' => 'Blocks approval: '.$c['label'],
                'applicant_label' => 'Action needed: '.$c['label'],
            ];
        }

        return [
            // is_compliant now reflects full engine truth: all required
            // sections complete AND no blocking document issues AND no
            // unverified documents. A single true-or-false that cannot lie.
            'is_compliant' => $validation['is_valid'] && $validation['is_complete'],
            'required_documents' => $report['required_documents'],
            'missing_documents' => $report['missing_documents'],
            'expired_documents' => $report['expired_documents'],
            'unverified_documents' => $report['unverified_documents'],
            'incomplete_documents' => $report['incomplete_documents'],
            'issues' => $issues,
        ];
    }

    private function humanDocumentLabel(string $type): string
    {
        return match ($type) {
            'official_medical_form' => 'Medical Examination Form',
            'immunization_record' => 'Immunization Record',
            'insurance_card' => 'Insurance Card',
            'paper_application_packet' => 'Paper Application Packet',
            'physical_examination' => 'Physical Examination',
            'seizure_action_plan' => 'Seizure Action Plan',
            'emergency_care_plan' => 'Emergency Care Plan',
            default => ucwords(str_replace('_', ' ', $type)),
        };
    }
}
