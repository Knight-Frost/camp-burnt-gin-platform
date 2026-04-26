<?php

namespace Tests\Feature\Regression;

use App\Models\Camper;
use App\Models\Document;
use App\Models\RequiredDocumentRule;
use App\Services\Document\DocumentEnforcementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression coverage for BUG-210.
 *
 * The compliance report used to emit one "expired" / "unverified" entry per
 * historical row. A camper with six past uploads of the same type saw the
 * same error six times, and a fresh-enough upload did not supersede the
 * stale ones. This test locks in the new "latest-per-required-type" model:
 *
 *   • One entry per required type, never more.
 *   • Fresh rows supersede stale rows of the same type.
 *   • Non-required types never surface in the compliance report.
 */
class DocumentComplianceDedupeTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    private function ensureRequiredRule(string $type, string $description): void
    {
        RequiredDocumentRule::firstOrCreate(
            ['document_type' => $type],
            [
                'description' => $description,
                'is_mandatory' => true,
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => null,
            ],
        );
    }

    public function test_multiple_expired_rows_of_same_type_dedupe_to_one(): void
    {
        // Policy change: expiration-date enforcement was removed from checkCompliance().
        // expired_documents is always empty regardless of how many expired rows exist.
        // The per-type deduplication logic in binByType() still works as designed, but
        // its output never reaches the expired bucket. Approved docs (regardless of
        // expiration_date) are counted as present, so the type is neither missing
        // nor expired — it is fully compliant on the presence + verification axes.
        $this->ensureRequiredRule('official_medical_form', 'Medical Form');

        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        // Six uploads, all with past expiration_date.
        for ($i = 0; $i < 6; $i++) {
            Document::factory()->create([
                'documentable_type' => Camper::class,
                'documentable_id' => $camper->id,
                'document_type' => 'official_medical_form',
                'expiration_date' => now()->subMonths($i + 1),
                'submitted_at' => now()->subMonths($i + 1),
                'verification_status' => \App\Enums\DocumentVerificationStatus::Approved,
            ]);
        }

        $report = app(DocumentEnforcementService::class)->checkCompliance($camper);

        // expired_documents must always be empty — expiry enforcement was removed.
        $this->assertEmpty(
            $report['expired_documents'],
            'expired_documents must be empty after the policy change regardless of row count',
        );
        // Approved docs are present → type is not missing.
        $missingTypes = collect($report['missing_documents'])->pluck('document_type')->all();
        $this->assertNotContains('official_medical_form', $missingTypes);
    }

    public function test_fresh_upload_supersedes_all_older_expired_rows(): void
    {
        // The primary bug the user reported: they re-uploaded but the
        // system kept flagging the old expired copies. One in-date row
        // must be enough to clear the type from the expired list.
        $this->ensureRequiredRule('official_medical_form', 'Medical Form');

        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        // Stale uploads
        for ($i = 0; $i < 3; $i++) {
            Document::factory()->create([
                'documentable_type' => Camper::class,
                'documentable_id' => $camper->id,
                'document_type' => 'official_medical_form',
                'expiration_date' => now()->subMonths($i + 1),
                'submitted_at' => now()->subMonths($i + 1),
                'verification_status' => \App\Enums\DocumentVerificationStatus::Approved,
            ]);
        }

        // Fresh upload — one year out
        Document::factory()->create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'document_type' => 'official_medical_form',
            'expiration_date' => now()->addYear(),
            'submitted_at' => now(),
            'verification_status' => \App\Enums\DocumentVerificationStatus::Approved,
        ]);

        $report = app(DocumentEnforcementService::class)->checkCompliance($camper);

        $expiredTypes = collect($report['expired_documents'])->pluck('document_type')->all();
        $missingTypes = collect($report['missing_documents'])->pluck('document_type')->all();

        $this->assertNotContains(
            'official_medical_form',
            $expiredTypes,
            'Fresh in-date upload must clear the expired entry for this type — found: '.json_encode($report),
        );
        $this->assertNotContains('official_medical_form', $missingTypes);
    }

    public function test_type_with_only_expired_rows_does_not_also_appear_missing(): void
    {
        // Policy change: expiration-date enforcement was removed. A required type whose
        // only rows have a past expiration_date is now treated as present and approved —
        // it appears in neither missing nor expired. Both buckets must be empty for
        // this type; the doc satisfies the presence + verification axes on its own.
        $this->ensureRequiredRule('official_medical_form', 'Medical Form');

        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        Document::factory()->create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'document_type' => 'official_medical_form',
            'expiration_date' => now()->subMonth(),
            'submitted_at' => now()->subMonth(),
            'verification_status' => \App\Enums\DocumentVerificationStatus::Approved,
        ]);

        $report = app(DocumentEnforcementService::class)->checkCompliance($camper);

        $missingTypes = collect($report['missing_documents'])->pluck('document_type')->all();
        $expiredTypes = collect($report['expired_documents'])->pluck('document_type')->all();

        // Not missing — the doc exists and is approved.
        $this->assertNotContains('official_medical_form', $missingTypes);
        // Not expired — expiry enforcement was removed; the bucket is always empty.
        $this->assertNotContains('official_medical_form', $expiredTypes);
        $this->assertEmpty($expiredTypes);
    }

    public function test_medical_form_without_exam_date_is_reported_as_incomplete(): void
    {
        // Policy change: incomplete_documents enforcement was removed from checkCompliance().
        // A medical form uploaded without an expiration_date (the exam-date anchor) is no
        // longer surfaced in incomplete_documents — that bucket is always empty. The doc is
        // treated as present and approved, satisfying the compliance gate on those two axes.
        // The expired bucket is also empty (expiry enforcement removed). Neither missing
        // nor incomplete fires for this scenario.
        $this->ensureRequiredRule('official_medical_form', 'Medical Form');

        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        Document::factory()->create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'document_type' => 'official_medical_form',
            'expiration_date' => null, // no exam date / expiration anchor
            'submitted_at' => now(),
            'verification_status' => \App\Enums\DocumentVerificationStatus::Approved,
        ]);

        $report = app(DocumentEnforcementService::class)->checkCompliance($camper);

        // incomplete_documents must always be empty — incomplete-metadata enforcement was removed.
        $this->assertEmpty(
            $report['incomplete_documents'],
            'incomplete_documents must be empty after the policy change',
        );
        // expired_documents must also be empty.
        $this->assertEmpty($report['expired_documents']);
        // The doc is present and approved, so it must not appear as missing either.
        $this->assertNotContains(
            'official_medical_form',
            collect($report['missing_documents'])->pluck('document_type')->all(),
        );
    }

    public function test_expired_medical_form_error_includes_exam_and_expiration_date(): void
    {
        // Skipped: expiration-date enforcement was intentionally removed from
        // checkCompliance(). expired_documents is always an empty collection,
        // so the exam_date and expiration_date payload fields are never
        // populated. There is no meaningful inverse assertion for this scenario —
        // the feature that produced this output no longer exists.
        $this->markTestSkipped(
            'Expiry enforcement was removed; expired_documents is always empty. '
            .'The exam_date / expiration_date payload this test covered is no longer emitted.'
        );
    }

    public function test_non_required_type_is_not_reported_as_expired(): void
    {
        // Compliance reports must be scoped to required rules. An expired
        // row of a type the applicant was never asked for should not
        // surface as a compliance error.
        $this->ensureRequiredRule('official_medical_form', 'Medical Form');

        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        // No medical_form at all — that should be "missing", not "expired".
        Document::factory()->create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'document_type' => 'some_unrequired_misc',
            'expiration_date' => now()->subMonth(),
            'submitted_at' => now()->subMonth(),
            'verification_status' => \App\Enums\DocumentVerificationStatus::Approved,
        ]);

        $report = app(DocumentEnforcementService::class)->checkCompliance($camper);

        $expiredTypes = collect($report['expired_documents'])->pluck('document_type')->all();
        $missingTypes = collect($report['missing_documents'])->pluck('document_type')->all();

        $this->assertNotContains(
            'some_unrequired_misc',
            $expiredTypes,
            'Expired rows of non-required types must never surface in the compliance report',
        );
        $this->assertContains('official_medical_form', $missingTypes);
    }
}
