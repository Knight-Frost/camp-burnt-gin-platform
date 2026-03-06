<?php

namespace Tests\Feature;

use App\Enums\DocumentVerificationStatus;
use App\Models\Camper;
use App\Models\Document;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Feature tests for camper compliance status endpoint.
 *
 * Verifies authorization and response structure for the compliance
 * endpoint that shows document requirements and status.
 */
class CamperComplianceEndpointTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(\Database\Seeders\RequiredDocumentRuleSeeder::class);
    }

    protected function createUserWithRole(string $roleName): User
    {
        $role = Role::firstOrCreate(
            ['name' => $roleName],
            ['description' => ucfirst($roleName)]
        );

        return User::factory()->create(['role_id' => $role->id]);
    }

    public function test_parent_can_view_own_camper_compliance_status(): void
    {
        $parent = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent)->create();
        $camper->medicalRecord()->create([]);

        $response = $this->actingAs($parent)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                'is_compliant',
                'required_documents',
                'missing_documents',
                'expired_documents',
                'unverified_documents',
            ],
        ]);
    }

    public function test_parent_cannot_view_other_camper_compliance_status(): void
    {
        $parent1 = $this->createUserWithRole('applicant');
        $parent2 = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent2)->create();

        $response = $this->actingAs($parent1)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(403);
    }

    public function test_admin_can_view_any_camper_compliance_status(): void
    {
        $admin = $this->createUserWithRole('admin');
        $parent = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent)->create();
        $camper->medicalRecord()->create([]);

        $response = $this->actingAs($admin)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(200);
    }

    public function test_unauthenticated_user_cannot_access_compliance_status(): void
    {
        $camper = Camper::factory()->create();

        $response = $this->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(401);
    }

    public function test_compliance_status_shows_missing_documents(): void
    {
        $parent = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent)->create();
        $camper->medicalRecord()->create([]);

        $response = $this->actingAs($parent)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(200);
        $response->assertJson([
            'data' => [
                'is_compliant' => false,
            ],
        ]);

        $missing = $response->json('data.missing_documents');
        $this->assertNotEmpty($missing);

        // Should have missing universal documents
        $types = collect($missing)->pluck('document_type');
        $this->assertContains('physical_examination', $types);
        $this->assertContains('immunization_record', $types);
    }

    public function test_compliance_status_shows_unverified_documents(): void
    {
        $parent = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent)->create();
        $camper->medicalRecord()->create([]);

        // Upload document but leave unverified
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'uploaded_by' => $parent->id,
            'original_filename' => 'physical.pdf',
            'stored_filename' => 'stored.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'disk' => 'local',
            'path' => '/test/path',
            'document_type' => 'physical_examination',
            'is_scanned' => true,
            'scan_passed' => true,
            'verification_status' => DocumentVerificationStatus::Pending,
        ]);

        $response = $this->actingAs($parent)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(200);
        $response->assertJson([
            'data' => [
                'is_compliant' => false,
            ],
        ]);

        $unverified = $response->json('data.unverified_documents');
        $this->assertNotEmpty($unverified);
        $this->assertEquals('physical_examination', $unverified[0]['document_type']);
        $this->assertEquals('pending', $unverified[0]['verification_status']);
    }

    public function test_compliance_status_shows_expired_documents(): void
    {
        $parent = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent)->create();
        $camper->medicalRecord()->create([]);

        // Upload expired document
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'uploaded_by' => $parent->id,
            'original_filename' => 'physical.pdf',
            'stored_filename' => 'stored.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'disk' => 'local',
            'path' => '/test/path',
            'document_type' => 'physical_examination',
            'is_scanned' => true,
            'scan_passed' => true,
            'verification_status' => DocumentVerificationStatus::Approved,
            'expiration_date' => now()->subDay(),
        ]);

        $response = $this->actingAs($parent)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(200);
        $response->assertJson([
            'data' => [
                'is_compliant' => false,
            ],
        ]);

        $expired = $response->json('data.expired_documents');
        $this->assertNotEmpty($expired);
        $this->assertEquals('physical_examination', $expired[0]['document_type']);
    }

    public function test_compliance_status_shows_compliant_when_all_valid(): void
    {
        $parent = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent)->create();
        $camper->medicalRecord()->create([]);

        // Upload all required documents
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'uploaded_by' => $parent->id,
            'original_filename' => 'physical.pdf',
            'stored_filename' => 'stored_physical.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'disk' => 'local',
            'path' => '/test/path',
            'document_type' => 'physical_examination',
            'is_scanned' => true,
            'scan_passed' => true,
            'verification_status' => DocumentVerificationStatus::Approved,
        ]);

        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'uploaded_by' => $parent->id,
            'original_filename' => 'immunization.pdf',
            'stored_filename' => 'stored_immunization.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'disk' => 'local',
            'path' => '/test/path',
            'document_type' => 'immunization_record',
            'is_scanned' => true,
            'scan_passed' => true,
            'verification_status' => DocumentVerificationStatus::Approved,
        ]);

        $response = $this->actingAs($parent)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(200);
        $response->assertJson([
            'data' => [
                'is_compliant' => true,
                'missing_documents' => [],
                'expired_documents' => [],
                'unverified_documents' => [],
            ],
        ]);
    }

    public function test_compliance_response_contains_no_phi(): void
    {
        $parent = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent)->create();
        $camper->medicalRecord()->create([
            'has_seizures' => true,
            'seizure_description' => 'SENSITIVE PHI DATA',
        ]);

        $response = $this->actingAs($parent)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(200);

        // Response should contain document type codes but no PHI
        $content = $response->getContent();
        $this->assertStringNotContainsString('SENSITIVE PHI DATA', $content);
        $this->assertStringNotContainsString('seizure_description', $content);
    }
}
