<?php

namespace Tests\Unit\Services;

use App\Enums\DocumentVerificationStatus;
use App\Enums\SupervisionLevel;
use App\Models\Camper;
use App\Models\Document;
use App\Services\Document\DocumentEnforcementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Unit tests for DocumentEnforcementService.
 *
 * Tests the document compliance enforcement logic that prevents
 * application approval without required medical documentation.
 */
class DocumentEnforcementServiceTest extends TestCase
{
    use RefreshDatabase;

    protected DocumentEnforcementService $service;

    protected function setUp(): void
    {
        parent::setUp();

        // RiskEngineSeeder populates risk_factors/risk_rules/risk_thresholds.
        // DocumentEnforcementService depends on SpecialNeedsRiskAssessmentService,
        // which reads its scoring configuration from these tables.
        $this->seed(\Database\Seeders\RiskEngineSeeder::class);
        $this->seed(\Database\Seeders\RequiredDocumentRuleSeeder::class);
        $this->service = app(DocumentEnforcementService::class);
    }

    public function test_camper_with_no_conditions_requires_universal_documents(): void
    {
        // Create camper with no medical conditions
        $camper = Camper::factory()->create();

        $compliance = $this->service->checkCompliance($camper);

        $this->assertFalse($compliance['is_compliant']);
        $this->assertNotEmpty($compliance['required_documents']);

        // Should require all three universal documents: medical exam form, immunization, insurance
        $requiredTypes = collect($compliance['required_documents'])->pluck('document_type');
        $this->assertContains('official_medical_form', $requiredTypes);
        $this->assertContains('immunization_record', $requiredTypes);
        $this->assertContains('insurance_card', $requiredTypes);
    }

    public function test_camper_with_seizures_requires_seizure_documents(): void
    {
        $camper = Camper::factory()->create();
        $camper->medicalRecord()->create([
            'has_seizures' => true,
            'seizure_description' => 'Test seizure description',
        ]);

        $compliance = $this->service->checkCompliance($camper);

        $this->assertFalse($compliance['is_compliant']);

        $requiredTypes = collect($compliance['required_documents'])->pluck('document_type');
        $this->assertContains('seizure_action_plan', $requiredTypes);
        $this->assertContains('seizure_medication_authorization', $requiredTypes);
    }

    public function test_camper_with_g_tube_requires_feeding_documents(): void
    {
        $camper = Camper::factory()->create();
        $camper->feedingPlan()->create([
            'g_tube' => true,
            'formula' => 'Test formula',
            'amount_per_feeding' => '200ml',
            'feedings_per_day' => 4,
        ]);

        $compliance = $this->service->checkCompliance($camper);

        $this->assertFalse($compliance['is_compliant']);

        $requiredTypes = collect($compliance['required_documents'])->pluck('document_type');
        $this->assertContains('feeding_action_plan', $requiredTypes);
        $this->assertContains('feeding_equipment_list', $requiredTypes);
    }

    public function test_camper_with_one_to_one_supervision_requires_behavioral_documents(): void
    {
        $camper = Camper::factory()->create();

        // Create conditions that result in OneToOne supervision (score > 41)
        // Seizures (20) + G-tube (20) + Wandering (15) = 55 points
        $camper->medicalRecord()->create([
            'has_seizures' => true,
        ]);
        $camper->feedingPlan()->create([
            'g_tube' => true,
            'formula' => 'Test formula',
            'amount_per_feeding' => '200ml',
            'feedings_per_day' => 4,
        ]);
        $camper->behavioralProfile()->create([
            'wandering_risk' => true,
        ]);

        $compliance = $this->service->checkCompliance($camper);

        $this->assertFalse($compliance['is_compliant']);

        $requiredTypes = collect($compliance['required_documents'])->pluck('document_type');
        $this->assertContains('behavioral_support_plan', $requiredTypes);
        $this->assertContains('staffing_accommodation_request', $requiredTypes);
    }

    public function test_camper_with_high_complexity_requires_additional_documents(): void
    {
        $camper = Camper::factory()->create([
            'supervision_level' => SupervisionLevel::OneToOne,
        ]);

        // Force high complexity by creating multiple risk factors
        $camper->medicalRecord()->create(['has_seizures' => true]);
        $camper->feedingPlan()->create([
            'g_tube' => true,
            'formula' => 'Test',
            'amount_per_feeding' => '200ml',
            'feedings_per_day' => 4,
        ]);
        $camper->behavioralProfile()->create([
            'wandering_risk' => true,
            'one_to_one_supervision' => true,
        ]);

        $compliance = $this->service->checkCompliance($camper);

        $this->assertFalse($compliance['is_compliant']);

        $requiredTypes = collect($compliance['required_documents'])->pluck('document_type');
        // High complexity tier requires these documents
        $this->assertContains('medical_management_plan', $requiredTypes);
        $this->assertContains('physician_clearance', $requiredTypes);
        $this->assertContains('emergency_protocol', $requiredTypes);
    }

    public function test_camper_is_compliant_when_all_documents_uploaded_and_verified(): void
    {
        $camper = Camper::factory()->create();
        $camper->medicalRecord()->create([]);

        // Get required documents
        $compliance = $this->service->checkCompliance($camper);
        $requiredTypes = collect($compliance['required_documents'])->pluck('document_type');

        // Upload and verify all required documents; submitted_at required so enforcement sees them.
        // Medical-form types need an expiration anchor (from the physician's exam date)
        // or the new incomplete-metadata gate will flag them — that is the correct contract,
        // but for this "everything valid" test we set the expiration a year out.
        $examAnchoredTypes = ['official_medical_form', 'physical_examination'];
        foreach ($requiredTypes as $docType) {
            Document::create([
                'documentable_type' => Camper::class,
                'documentable_id' => $camper->id,
                'uploaded_by' => $camper->user_id,
                'original_filename' => "test_{$docType}.pdf",
                'stored_filename' => "stored_{$docType}.pdf",
                'mime_type' => 'application/pdf',
                'file_size' => 1024,
                'disk' => 'local',
                'path' => '/test/path',
                'document_type' => $docType,
                'is_scanned' => true,
                'scan_passed' => true,
                'verification_status' => DocumentVerificationStatus::Approved,
                'submitted_at' => now(),
                'expiration_date' => in_array($docType, $examAnchoredTypes, true)
                    ? now()->addYear()
                    : null,
            ]);
        }

        $compliance = $this->service->checkCompliance($camper);

        $this->assertTrue($compliance['is_compliant']);
        $this->assertEmpty($compliance['missing_documents']);
        $this->assertEmpty($compliance['expired_documents']);
        $this->assertEmpty($compliance['unverified_documents']);
        $this->assertEmpty($compliance['incomplete_documents']);
    }

    public function test_camper_not_compliant_with_unverified_documents(): void
    {
        $camper = Camper::factory()->create();

        // Upload document but leave it unverified; submitted_at required so enforcement sees it
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'uploaded_by' => $camper->user_id,
            'original_filename' => 'test.pdf',
            'stored_filename' => 'stored.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'disk' => 'local',
            'path' => '/test/path',
            'document_type' => 'official_medical_form',
            'is_scanned' => true,
            'scan_passed' => true,
            'verification_status' => DocumentVerificationStatus::Pending,
            'submitted_at' => now(),
        ]);

        $compliance = $this->service->checkCompliance($camper);

        $this->assertFalse($compliance['is_compliant']);
        $this->assertNotEmpty($compliance['unverified_documents']);
    }

    public function test_camper_not_compliant_with_expired_documents(): void
    {
        // Policy change: expiration-date enforcement was removed from checkCompliance().
        // expired_documents is always an empty collection regardless of strict mode.
        // An approved-but-past-expiry document counts as present and verified, so
        // non-compliance in this scenario comes only from other missing required types
        // (immunization_record, insurance_card). The camper is still non-compliant,
        // but the reason is missing documents — not expired ones.
        $camper = Camper::factory()->create();

        // Upload an "expired" document; submitted_at required so enforcement sees it.
        // Under the new policy this doc is treated as valid (expiry is ignored).
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'uploaded_by' => $camper->user_id,
            'original_filename' => 'test.pdf',
            'stored_filename' => 'stored.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'disk' => 'local',
            'path' => '/test/path',
            'document_type' => 'official_medical_form',
            'is_scanned' => true,
            'scan_passed' => true,
            'verification_status' => DocumentVerificationStatus::Approved,
            'expiration_date' => now()->subDay(),
            'submitted_at' => now(),
        ]);

        $compliance = $this->service->checkCompliance($camper);

        // expired_documents must ALWAYS be empty — expiry enforcement was removed.
        $this->assertEmpty($compliance['expired_documents']);
        // Camper is still non-compliant because immunization_record and insurance_card
        // are missing — the overall is_compliant flag still reflects reality.
        $this->assertFalse($compliance['is_compliant']);
    }

    public function test_service_returns_structured_compliance_data_without_phi(): void
    {
        $camper = Camper::factory()->create();

        $compliance = $this->service->checkCompliance($camper);

        // Verify structure
        $this->assertArrayHasKey('is_compliant', $compliance);
        $this->assertArrayHasKey('required_documents', $compliance);
        $this->assertArrayHasKey('missing_documents', $compliance);
        $this->assertArrayHasKey('expired_documents', $compliance);
        $this->assertArrayHasKey('unverified_documents', $compliance);

        // Verify no PHI in response
        $json = json_encode($compliance);
        $this->assertStringNotContainsStringIgnoringCase('seizure', $json);
        $this->assertStringNotContainsStringIgnoringCase('medication', $json);
        $this->assertStringNotContainsStringIgnoringCase('diagnosis', $json);
    }

    public function test_multiple_condition_flags_compound_requirements(): void
    {
        $camper = Camper::factory()->create();
        $camper->medicalRecord()->create([
            'has_seizures' => true,
            'has_neurostimulator' => true,
        ]);
        $camper->behavioralProfile()->create([
            'wandering_risk' => true,
            'aggression' => true,
        ]);

        $compliance = $this->service->checkCompliance($camper);

        $requiredTypes = collect($compliance['required_documents'])->pluck('document_type');

        // Should require documents for ALL flags
        $this->assertContains('seizure_action_plan', $requiredTypes);
        $this->assertContains('device_management_plan', $requiredTypes);
        $this->assertContains('elopement_prevention_plan', $requiredTypes);
        $this->assertContains('crisis_intervention_plan', $requiredTypes);
    }
}
