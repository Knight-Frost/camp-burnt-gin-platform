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
        $this->ensureRequiredRule('official_medical_form', 'Medical Form');

        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        // Six stale uploads, all expired.
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

        $this->assertCount(
            1,
            $report['expired_documents'],
            'Six historical expired rows must dedupe to one compliance entry',
        );
        $this->assertSame(
            'official_medical_form',
            $report['expired_documents'][0]['document_type'],
        );
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
        // A single required type must surface in exactly one bucket:
        // missing OR expired OR unverified, never more than one.
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

        $this->assertNotContains('official_medical_form', $missingTypes);
        $this->assertContains('official_medical_form', $expiredTypes);
    }

    public function test_medical_form_without_exam_date_is_reported_as_incomplete(): void
    {
        // New contract: a medical form uploaded without an exam_date is
        // incomplete — it cannot be validated because there's no anchor
        // to compute expiration from. Surface it explicitly instead of
        // silently letting it pass compliance.
        $this->ensureRequiredRule('official_medical_form', 'Medical Form');

        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        Document::factory()->create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'document_type' => 'official_medical_form',
            'expiration_date' => null, // no exam date was captured
            'submitted_at' => now(),
            'verification_status' => \App\Enums\DocumentVerificationStatus::Approved,
        ]);

        $report = app(DocumentEnforcementService::class)->checkCompliance($camper);

        $this->assertNotEmpty($report['incomplete_documents'], 'medical form without exam date must surface in incomplete_documents');
        $this->assertSame('official_medical_form', $report['incomplete_documents'][0]['document_type']);
        $this->assertSame('missing_exam_date', $report['incomplete_documents'][0]['reason']);

        // And it must not double-surface in expired or missing.
        $this->assertEmpty(collect($report['expired_documents'])->where('document_type', 'official_medical_form'));
        $this->assertNotContains(
            'official_medical_form',
            collect($report['missing_documents'])->pluck('document_type')->all(),
        );
    }

    public function test_expired_medical_form_error_includes_exam_and_expiration_date(): void
    {
        // Actionable error messaging: the applicant needs to know WHICH
        // date is wrong. The compliance label must name both the
        // physician's exam date and the computed expiration.
        $this->ensureRequiredRule('official_medical_form', 'Medical Form');

        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $expiration = now()->subMonths(2);
        Document::factory()->create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'document_type' => 'official_medical_form',
            'expiration_date' => $expiration,
            'submitted_at' => $expiration->copy()->subYear(),
            'verification_status' => \App\Enums\DocumentVerificationStatus::Approved,
        ]);

        $report = app(DocumentEnforcementService::class)->checkCompliance($camper);

        $this->assertCount(1, $report['expired_documents']);
        $this->assertSame(
            $expiration->copy()->subYear()->format('Y-m-d'),
            $report['expired_documents'][0]['exam_date'],
            'exam_date must be derivable from expiration_date so the UI can say "exam dated X"',
        );
        $this->assertSame(
            $expiration->format('Y-m-d'),
            $report['expired_documents'][0]['expiration_date'],
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
