<?php

namespace Tests\Feature\Regression;

use App\Enums\ApplicationStatus;
use App\Jobs\SendNotificationJob;
use App\Models\Application;
use App\Models\ApplicationConsent;
use App\Models\AuditLog;
use App\Models\CampSession;
use App\Models\Camper;
use App\Models\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression tests for application workflows.
 *
 * Verifies that core application submission and review workflows
 * still function correctly after performance optimizations.
 */
class ApplicationWorkflowTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        Queue::fake();
    }

    public function test_complete_application_submission_workflow(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = \App\Models\CampSession::factory()->create();

        // Submit application
        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft' => false,
        ]);

        // Verify response
        $response->assertStatus(201);
        $response->assertJsonPath('message', 'Application submitted successfully.');
        $response->assertJsonStructure(['data' => ['id', 'status', 'submitted_at']]);

        // Verify database state
        $this->assertDatabaseHas('applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Submitted->value,
            'is_draft' => false,
        ]);

        $application = Application::where('camper_id', $camper->id)->first();
        $this->assertNotNull($application->submitted_at);

        // Verify notification was queued
        Queue::assertPushed(SendNotificationJob::class);

        // Verify audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $parent->id,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'create',
        ]);
    }

    public function test_draft_workflow_maintains_correct_state(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = \App\Models\CampSession::factory()->create();

        // Save as draft
        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft' => true,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('message', 'Application draft saved.');

        // Verify draft state
        $this->assertDatabaseHas('applications', [
            'camper_id' => $camper->id,
            'is_draft' => true,
        ]);

        $application = Application::where('camper_id', $camper->id)->first();
        $this->assertNull($application->submitted_at);

        // Verify no notification sent for draft
        Queue::assertNotPushed(SendNotificationJob::class);
    }

    public function test_draft_to_submitted_workflow(): void
    {
        $parent  = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true, 'capacity' => 20]);
        $camper  = Camper::factory()->create([
            'user_id'       => $parent->id,
            'first_name'    => 'Alice',
            'last_name'     => 'Smith',
            'date_of_birth' => '2010-01-01',
            'gender'        => 'female',
            'tshirt_size'   => 'Youth M',
            'county'        => 'Richland',
        ]);

        \Tests\Support\TestApplicationFixture::buildCamperMinimum($camper);
        \Tests\Support\TestApplicationFixture::attachRequiredDocuments($camper);

        $application = Application::factory()->draft()->create([
            'camper_id'         => $camper->id,
            'camp_session_id'   => $session->id,
            'signed_at'         => now(),
            'signature_name'    => 'Jane Smith',
            'sections_reviewed' => \Tests\Support\TestApplicationFixture::reviewedOptionalSections(),
        ]);

        \Tests\Support\TestApplicationFixture::attachConsents($application, 'Jane Smith');

        // Submit via the finalize endpoint (the correct two-phase submission path)
        $response = $this->actingAs($parent)->postJson("/api/applications/{$application->id}/finalize");

        $response->assertOk();

        $application->refresh();
        $this->assertFalse($application->is_draft);
        $this->assertNotNull($application->submitted_at);
        Queue::assertPushed(SendNotificationJob::class);
    }

    public function test_complete_application_review_workflow(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => ApplicationStatus::Submitted,
        ]);

        // Review application
        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'approved',
            'notes' => 'Application approved',
            'override_incomplete' => true, // workflow test — not testing compliance enforcement
        ]);

        // Verify response
        $response->assertStatus(200);
        $response->assertJsonPath('message', 'Application reviewed successfully.');

        // Verify database state
        $application->refresh();
        $this->assertEquals(ApplicationStatus::Approved, $application->status);
        $this->assertEquals('Application approved', $application->notes);
        $this->assertNotNull($application->reviewed_at);
        $this->assertEquals($admin->id, $application->reviewed_by);

        // Verify notification was queued
        Queue::assertPushed(SendNotificationJob::class);

        // Verify audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'update',
        ]);
    }

    public function test_application_rejection_workflow(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => ApplicationStatus::Submitted,
        ]);

        // Reject application
        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'rejected',
            'notes' => 'Insufficient documentation',
        ]);

        $response->assertStatus(200);

        // Verify rejection
        $application->refresh();
        $this->assertEquals(ApplicationStatus::Rejected, $application->status);
        $this->assertEquals('Insufficient documentation', $application->notes);

        // Verify notification was queued
        Queue::assertPushed(SendNotificationJob::class);
    }

    public function test_parent_can_view_own_application_after_submission(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => ApplicationStatus::Submitted,
        ]);

        // View application
        $response = $this->actingAs($parent)->getJson("/api/applications/{$application->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('data.id', $application->id);
        $response->assertJsonPath('data.status', 'submitted');
    }

    public function test_parent_can_edit_pending_application(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => ApplicationStatus::Submitted,
        ]);

        // Parents can edit narrative fields but NOT internal admin notes
        $response = $this->actingAs($parent)->putJson("/api/applications/{$application->id}", [
            'narrative_camp_benefit' => 'Camp helps with socialisation.',
        ]);

        $response->assertStatus(200);

        $application->refresh();
        $this->assertEquals('Camp helps with socialisation.', $application->narrative_camp_benefit);
    }

    public function test_parent_cannot_set_admin_notes(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => ApplicationStatus::Submitted,
            'notes' => 'Original admin note',
        ]);

        // The notes field is filtered out for non-admin roles — the original value must survive.
        $this->actingAs($parent)->putJson("/api/applications/{$application->id}", [
            'notes' => 'Parent trying to overwrite admin notes',
        ]);

        $application->refresh();
        $this->assertEquals('Original admin note', $application->notes);
    }

    public function test_parent_cannot_edit_approved_application(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => ApplicationStatus::Approved,
        ]);

        // Try to edit approved application
        $response = $this->actingAs($parent)->putJson("/api/applications/{$application->id}", [
            'narrative_camp_benefit' => 'Should not work',
        ]);

        $response->assertStatus(403);
    }

    public function test_admin_can_filter_applications_by_status(): void
    {
        $admin = $this->createAdmin();

        Application::factory()->count(3)->create(['status' => ApplicationStatus::Submitted]);
        Application::factory()->count(2)->create(['status' => ApplicationStatus::Approved]);
        Application::factory()->count(1)->create(['status' => ApplicationStatus::Rejected]);

        // Filter by submitted
        $response = $this->actingAs($admin)->getJson('/api/applications?status=submitted');
        $response->assertStatus(200);
        $this->assertCount(3, $response->json('data'));

        // Filter by approved
        $response = $this->actingAs($admin)->getJson('/api/applications?status=approved');
        $response->assertStatus(200);
        $this->assertCount(2, $response->json('data'));
    }

    public function test_admin_can_filter_applications_by_session(): void
    {
        $admin = $this->createAdmin();

        $session1 = \App\Models\CampSession::factory()->create();
        $session2 = \App\Models\CampSession::factory()->create();

        Application::factory()->count(3)->create(['camp_session_id' => $session1->id]);
        Application::factory()->count(2)->create(['camp_session_id' => $session2->id]);

        // Filter by session 1
        $response = $this->actingAs($admin)->getJson("/api/applications?camp_session_id={$session1->id}");
        $response->assertStatus(200);
        $this->assertCount(3, $response->json('data'));
    }

    public function test_duplicate_active_application_returns_409_not_422(): void
    {
        // Regression guard for BUG-208: the old implementation used
        // Rule::unique at the FormRequest layer which returned 422. That
        // short-circuited the controller's draft-resume logic and also
        // applied to final-state rows that should not block. New contract
        // is 409 Conflict with a structured body that names the blocker.
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = \App\Models\CampSession::factory()->create();

        Application::factory()->create([
            'camper_id'       => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft'        => false,
            'status'          => \App\Enums\ApplicationStatus::Submitted,
            'submitted_at'    => now()->subHour(),
        ]);

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id'       => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft'        => false,
        ]);

        $response->assertStatus(409)
            ->assertJsonStructure(['message', 'existing_application_id', 'existing_application_status']);
    }
}
