<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Enums\DocumentVerificationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Document;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Feature tests for application approval document enforcement.
 *
 * Verifies that the document enforcement layer prevents approval
 * of applications without complete, verified medical documentation.
 */
class ApplicationApprovalEnforcementTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Camper $camper;
    protected Application $application;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(\Database\Seeders\RequiredDocumentRuleSeeder::class);

        // Create roles
        $adminRole = Role::create(['name' => 'admin', 'description' => 'Administrator']);
        $parentRole = Role::create(['name' => 'parent', 'description' => 'Parent/Guardian']);

        // Create users with roles
        $this->admin = User::factory()->create(['role_id' => $adminRole->id]);
        $parent = User::factory()->create(['role_id' => $parentRole->id]);

        $this->camper = Camper::factory()->for($parent)->create();
        $this->camper->medicalRecord()->create([]);

        $session = CampSession::factory()->create();
        $this->application = Application::factory()
            ->for($this->camper)
            ->for($session, 'campSession')
            ->create([
                'status' => ApplicationStatus::Pending,
                'is_draft' => false,
                'submitted_at' => now(),
            ]);
    }

    public function test_approval_blocked_when_required_documents_missing(): void
    {
        $response = $this->actingAs($this->admin)
            ->postJson("/api/applications/{$this->application->id}/review", [
                'status' => ApplicationStatus::Approved->value,
                'notes' => 'Approving application',
            ]);

        $response->assertStatus(422);
        $response->assertJsonStructure([
            'message',
            'errors',
            'compliance_details' => [
                'missing_documents',
                'expired_documents',
                'unverified_documents',
            ],
        ]);

        // Verify application was NOT approved
        $this->application->refresh();
        $this->assertEquals(ApplicationStatus::Pending, $this->application->status);
    }

    public function test_approval_blocked_when_documents_unverified(): void
    {
        // Upload required documents but don't verify them
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $this->camper->id,
            'uploaded_by' => $this->camper->user_id,
            'original_filename' => 'physical.pdf',
            'stored_filename' => 'stored_physical.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'disk' => 'local',
            'path' => '/test/path',
            'document_type' => 'physical_examination',
            'is_scanned' => true,
            'scan_passed' => true,
            'verification_status' => DocumentVerificationStatus::Pending,
        ]);

        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $this->camper->id,
            'uploaded_by' => $this->camper->user_id,
            'original_filename' => 'immunization.pdf',
            'stored_filename' => 'stored_immunization.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'disk' => 'local',
            'path' => '/test/path',
            'document_type' => 'immunization_record',
            'is_scanned' => true,
            'scan_passed' => true,
            'verification_status' => DocumentVerificationStatus::Pending,
        ]);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/applications/{$this->application->id}/review", [
                'status' => ApplicationStatus::Approved->value,
                'notes' => 'Approving application',
            ]);

        $response->assertStatus(422);
        $response->assertJson([
            'message' => 'Application cannot be approved due to incomplete medical documentation.',
        ]);

        $this->application->refresh();
        $this->assertEquals(ApplicationStatus::Pending, $this->application->status);
    }

    public function test_approval_blocked_when_documents_expired(): void
    {
        // Upload expired documents
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $this->camper->id,
            'uploaded_by' => $this->camper->user_id,
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
            'expiration_date' => now()->subDay(),
        ]);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/applications/{$this->application->id}/review", [
                'status' => ApplicationStatus::Approved->value,
                'notes' => 'Approving application',
            ]);

        $response->assertStatus(422);
        $response->assertJsonPath('compliance_details.expired_documents', function ($expired) {
            return count($expired) > 0;
        });

        $this->application->refresh();
        $this->assertEquals(ApplicationStatus::Pending, $this->application->status);
    }

    public function test_approval_succeeds_when_all_documents_valid(): void
    {
        // Upload and verify all required documents
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $this->camper->id,
            'uploaded_by' => $this->camper->user_id,
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
            'documentable_id' => $this->camper->id,
            'uploaded_by' => $this->camper->user_id,
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

        $response = $this->actingAs($this->admin)
            ->postJson("/api/applications/{$this->application->id}/review", [
                'status' => ApplicationStatus::Approved->value,
                'notes' => 'All documents verified, approving',
            ]);

        $response->assertStatus(200);
        $response->assertJson([
            'message' => 'Application reviewed successfully.',
        ]);

        $this->application->refresh();
        $this->assertEquals(ApplicationStatus::Approved, $this->application->status);
        $this->assertNotNull($this->application->reviewed_at);
        $this->assertEquals($this->admin->id, $this->application->reviewed_by);
    }

    public function test_rejection_not_blocked_by_missing_documents(): void
    {
        // Rejections should NOT be blocked by document compliance
        $response = $this->actingAs($this->admin)
            ->postJson("/api/applications/{$this->application->id}/review", [
                'status' => ApplicationStatus::Rejected->value,
                'notes' => 'Rejecting due to capacity',
            ]);

        $response->assertStatus(200);

        $this->application->refresh();
        $this->assertEquals(ApplicationStatus::Rejected, $this->application->status);
    }

    public function test_waitlist_not_blocked_by_missing_documents(): void
    {
        // Waitlisting should NOT be blocked by document compliance
        $response = $this->actingAs($this->admin)
            ->postJson("/api/applications/{$this->application->id}/review", [
                'status' => ApplicationStatus::Waitlisted->value,
                'notes' => 'Placing on waitlist',
            ]);

        $response->assertStatus(200);

        $this->application->refresh();
        $this->assertEquals(ApplicationStatus::Waitlisted, $this->application->status);
    }

    public function test_high_complexity_camper_requires_additional_documents(): void
    {
        // Create high complexity camper
        $this->camper->medicalRecord()->update([
            'has_seizures' => true,
        ]);
        $this->camper->feedingPlan()->create([
            'g_tube' => true,
            'formula' => 'Test',
            'amount_per_feeding' => '200ml',
            'feedings_per_day' => 4,
        ]);
        $this->camper->behavioralProfile()->create([
            'wandering_risk' => true,
            'one_to_one_supervision' => true,
        ]);

        // Upload only universal documents
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $this->camper->id,
            'uploaded_by' => $this->camper->user_id,
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

        $response = $this->actingAs($this->admin)
            ->postJson("/api/applications/{$this->application->id}/review", [
                'status' => ApplicationStatus::Approved->value,
                'notes' => 'Approving',
            ]);

        $response->assertStatus(422);

        // Should require seizure, feeding, behavioral, and high-complexity documents
        $missingTypes = collect($response->json('compliance_details.missing_documents'))
            ->pluck('document_type');

        $this->assertContains('seizure_action_plan', $missingTypes);
        $this->assertContains('feeding_action_plan', $missingTypes);
        $this->assertContains('behavioral_support_plan', $missingTypes);
        $this->assertContains('physician_clearance', $missingTypes);
    }
}
