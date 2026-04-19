<?php

namespace Tests\Feature\Security;

use App\Models\Application;
use App\Models\Camper;
use App\Models\MedicalRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for Insecure Direct Object Reference (IDOR) prevention.
 *
 * Verifies that users cannot access resources belonging to other users
 * by manipulating IDs in requests.
 */
class IdorPreventionTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    public function test_parent_cannot_view_other_parents_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        // Parent1 tries to access Parent2's camper
        $response = $this->actingAs($parent1)->getJson("/api/campers/{$camper2->id}");

        $response->assertStatus(403);
    }

    public function test_parent_cannot_update_other_parents_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        // Parent1 tries to update Parent2's camper
        $response = $this->actingAs($parent1)->putJson("/api/campers/{$camper2->id}", [
            'first_name' => 'Hacked',
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_cannot_delete_other_parents_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        // Parent1 tries to delete Parent2's camper
        $response = $this->actingAs($parent1)->deleteJson("/api/campers/{$camper2->id}");

        $response->assertStatus(403);
    }

    public function test_parent_cannot_view_other_parents_application(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        $application1 = Application::factory()->create(['camper_id' => $camper1->id]);
        $application2 = Application::factory()->create(['camper_id' => $camper2->id]);

        // Parent1 tries to access Parent2's application
        $response = $this->actingAs($parent1)->getJson("/api/applications/{$application2->id}");

        $response->assertStatus(403);
    }

    public function test_parent_cannot_update_other_parents_application(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        $application1 = Application::factory()->create(['camper_id' => $camper1->id]);
        $application2 = Application::factory()->create(['camper_id' => $camper2->id]);

        // Parent1 tries to update Parent2's application
        $response = $this->actingAs($parent1)->putJson("/api/applications/{$application2->id}", [
            'notes' => 'Hacked',
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_cannot_view_other_parents_medical_record(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        $medicalRecord1 = MedicalRecord::factory()->create(['camper_id' => $camper1->id]);
        $medicalRecord2 = MedicalRecord::factory()->create(['camper_id' => $camper2->id]);

        // Parent1 tries to access Parent2's medical record
        $response = $this->actingAs($parent1)->getJson("/api/medical-records/{$medicalRecord2->id}");

        $response->assertStatus(403);
    }

    public function test_parent_cannot_update_other_parents_medical_record(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        $medicalRecord1 = MedicalRecord::factory()->create(['camper_id' => $camper1->id]);
        $medicalRecord2 = MedicalRecord::factory()->create(['camper_id' => $camper2->id]);

        // Parent1 tries to update Parent2's medical record
        $response = $this->actingAs($parent1)->putJson("/api/medical-records/{$medicalRecord2->id}", [
            'physician_name' => 'Hacked',
        ]);

        $response->assertStatus(403);
    }

    public function test_medical_provider_can_access_any_medical_record(): void
    {
        // Phase 6: provider link gates were removed. Medical providers now have
        // direct read/update access to all camper medical records for active clinical care.
        $provider = $this->createMedicalProvider();
        $parent = $this->createParent();

        $camper = Camper::factory()->create(['user_id' => $parent->id, 'is_active' => true]);
        $medicalRecord = MedicalRecord::factory()->create(['camper_id' => $camper->id]);

        $response = $this->actingAs($provider)->getJson("/api/medical-records/{$medicalRecord->id}");

        $response->assertOk();
    }

    public function test_parent_cannot_create_application_for_other_parents_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);
        $session = \App\Models\CampSession::factory()->create();

        // Parent1 tries to create application for Parent2's camper
        $response = $this->actingAs($parent1)->postJson('/api/applications', [
            'camper_id' => $camper2->id,
            'camp_session_id' => $session->id,
            'is_draft' => false,
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_cannot_create_medical_record_for_other_parents_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        // Parent1 tries to create medical record for Parent2's camper
        $response = $this->actingAs($parent1)->postJson('/api/medical-records', [
            'camper_id' => $camper2->id,
            'physician_name' => 'Dr. Test',
            'physician_phone' => '555-1234',
        ]);

        $response->assertStatus(403);
    }

    public function test_sequential_id_enumeration_prevented(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);

        // Try to enumerate IDs by incrementing
        $forbiddenCount = 0;
        for ($id = $camper->id + 1; $id <= $camper->id + 10; $id++) {
            $response = $this->actingAs($parent)->getJson("/api/campers/{$id}");
            if ($response->status() === 403 || $response->status() === 404) {
                $forbiddenCount++;
            }
        }

        // All enumeration attempts should be blocked
        $this->assertEquals(10, $forbiddenCount);
    }

    public function test_parent_cannot_view_another_parents_draft_document_by_id(): void
    {
        // Drafts (submitted_at = null) are the uploader's private staging area.
        // If two parents both parent the same camper (historical data state) or
        // if IDs are enumerated, the policy must still block a non-uploader from
        // viewing a draft document. This guards against a cross-account draft
        // enumeration path that GET /documents/{id} relied on the policy to close.
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent1->id]);

        // Parent 1 uploads a draft document for their camper. submitted_at stays null.
        $draftDoc = \App\Models\Document::create([
            'documentable_type' => \App\Models\Camper::class,
            'documentable_id' => $camper->id,
            'document_type' => 'official_medical_form',
            'original_filename' => 'wip.pdf',
            'stored_filename' => 'wip.pdf',
            'path' => 'documents/wip.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'uploaded_by' => $parent1->id,
            'submitted_at' => null,
        ]);

        // Parent 2 — unrelated to this camper — must not be able to view it.
        $this->actingAs($parent2)
            ->getJson("/api/documents/{$draftDoc->id}")
            ->assertStatus(403);
    }
}
