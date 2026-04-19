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
 * Contract:
 *   • flag on  → enforce missing + expired + unverified + incomplete.
 *   • flag off → enforce missing ONLY. The other three rules are
 *     silently skipped so dev / staging submission flows work.
 *   • production env → ALWAYS strict regardless of the flag value.
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

        $this->assertNotEmpty(
            $report['expired_documents'],
            'strict mode must still report the expired medical form',
        );
    }

    public function test_production_env_forces_strict_even_when_flag_is_off(): void
    {
        // Safety override: a misconfigured .env in production cannot
        // silently disable the document gate. The environment wins.
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

        $this->assertNotEmpty(
            $report['expired_documents'],
            'production environment must force strict mode regardless of flag',
        );
    }
}
