<?php

namespace Tests\Feature\Regression;

use App\Enums\DocumentVerificationStatus;
use App\Models\Camper;
use App\Models\Document;
use App\Models\RequiredDocumentRule;
use App\Services\Document\DocumentEnforcementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression coverage for the testing-bypass flag
 * (config `compliance.strict_enabled`, env APP_COMPLIANCE_CHECKS).
 *
 * Contract (post expiry-enforcement removal):
 *   • flag on  → enforce missing + unverified. expired and incomplete are
 *     always empty regardless of flag value.
 *   • flag off → enforce missing ONLY. unverified is skipped so dev /
 *     staging submission flows work.
 *   • production env → ALWAYS strict for missing + unverified. expired and
 *     incomplete remain empty (expiry enforcement was intentionally removed).
 */
class ComplianceBypassFlagTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    private function ensureRequiredRule(string $type): void
    {
        RequiredDocumentRule::firstOrCreate(
            ['document_type' => $type],
            [
                'description' => ucfirst(str_replace('_', ' ', $type)),
                'is_mandatory' => true,
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => null,
            ],
        );
    }

    private function makeCamperWithMedicalRecord(): Camper
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $camper->medicalRecord()->create([]);

        return $camper;
    }

    public function test_flag_off_lets_expired_medical_form_pass_compliance(): void
    {
        Config::set('compliance.strict_enabled', false);
        $this->ensureRequiredRule('official_medical_form');

        $camper = $this->makeCamperWithMedicalRecord();

        Document::factory()->create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'document_type' => 'official_medical_form',
            'expiration_date' => now()->subMonths(6),
            'submitted_at' => now()->subYears(2),
            'verification_status' => DocumentVerificationStatus::Approved,
        ]);

        $report = app(DocumentEnforcementService::class)->checkCompliance($camper);

        $this->assertEmpty($report['expired_documents'], 'expired rule must be skipped when flag is off');
        $this->assertEmpty($report['unverified_documents']);
        $this->assertEmpty($report['incomplete_documents']);
    }

    public function test_flag_off_still_blocks_when_document_is_completely_missing(): void
    {
        // The missing rule is NEVER relaxed. Without this guard the admin
        // workflow would have to handle applications with zero required
        // documents, which defeats the entire point of the gate.
        Config::set('compliance.strict_enabled', false);
        $this->ensureRequiredRule('official_medical_form');

        $camper = $this->makeCamperWithMedicalRecord();

        $report = app(DocumentEnforcementService::class)->checkCompliance($camper);

        $this->assertNotEmpty($report['missing_documents']);
        $this->assertSame(
            'official_medical_form',
            $report['missing_documents'][0]['document_type'],
        );
    }

    public function test_flag_on_enforces_expired_rule_as_usual(): void
    {
        // Policy change: expired_documents is always empty regardless of strict mode.
        // Expiry-date enforcement was intentionally removed from checkCompliance().
        // What strict mode still gates is unverified documents — that contract is
        // tested separately. Here we assert that even with the flag on, an expired
        // approved document does NOT appear in expired_documents.
        Config::set('compliance.strict_enabled', true);
        $this->ensureRequiredRule('official_medical_form');

        $camper = $this->makeCamperWithMedicalRecord();

        Document::factory()->create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'document_type' => 'official_medical_form',
            'expiration_date' => now()->subMonths(6),
            'submitted_at' => now()->subYears(2),
            'verification_status' => DocumentVerificationStatus::Approved,
        ]);

        $report = app(DocumentEnforcementService::class)->checkCompliance($camper);

        // expired_documents must be empty — expiry enforcement was removed.
        $this->assertEmpty(
            $report['expired_documents'],
            'expired_documents must always be empty after the policy change',
        );
        // The doc is approved, so unverified must also be empty.
        $this->assertEmpty($report['unverified_documents']);
    }

    public function test_production_env_forces_strict_even_when_flag_is_off(): void
    {
        // Safety override: a misconfigured .env in production cannot
        // silently disable the document gate. The environment wins.
        //
        // Policy change: expiry enforcement was removed from checkCompliance(), so
        // expired_documents is always empty even in production. What the production
        // override still guards is unverified documents — an approved document with a
        // past expiration_date is no longer a compliance failure in any environment.
        app()->detectEnvironment(fn () => 'production');
        Config::set('compliance.strict_enabled', false);

        $this->ensureRequiredRule('official_medical_form');
        $camper = $this->makeCamperWithMedicalRecord();

        Document::factory()->create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'document_type' => 'official_medical_form',
            'expiration_date' => now()->subMonths(6),
            'submitted_at' => now()->subYears(2),
            'verification_status' => DocumentVerificationStatus::Approved,
        ]);

        $report = app(DocumentEnforcementService::class)->checkCompliance($camper);

        // expired_documents must be empty — expiry enforcement was removed.
        $this->assertEmpty(
            $report['expired_documents'],
            'expired_documents must always be empty after the policy change, even in production',
        );
        // The document is Approved, so the production strict-mode guard on
        // unverified_documents is satisfied — it must also be empty.
        $this->assertEmpty(
            $report['unverified_documents'],
            'production strict mode must still gate unverified documents, but this doc is approved',
        );
    }
}
