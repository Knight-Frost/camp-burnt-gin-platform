<?php

namespace Tests\Feature\Security;

use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Verifies that draft applications cannot be approved, rejected, or otherwise
 * reviewed by admins. A draft has not been officially submitted by the parent,
 * so no review decision is legally or logically valid on it.
 */
class DraftReviewPreventionTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    private function makeDraftApplication(): Application
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true, 'capacity' => 20]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);

        return Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);
    }

    public function test_admin_cannot_approve_draft_application(): void
    {
        $admin = $this->createAdmin();
        $draft = $this->makeDraftApplication();

        $response = $this->actingAs($admin)
            ->postJson("/api/applications/{$draft->id}/review", ['status' => 'approved']);

        $response->assertForbidden();
        $this->assertDatabaseHas('applications', ['id' => $draft->id, 'is_draft' => true]);
    }

    public function test_admin_cannot_reject_draft_application(): void
    {
        $admin = $this->createAdmin();
        $draft = $this->makeDraftApplication();

        $response = $this->actingAs($admin)
            ->postJson("/api/applications/{$draft->id}/review", ['status' => 'rejected']);

        $response->assertForbidden();
    }

    public function test_admin_cannot_move_draft_to_under_review(): void
    {
        $admin = $this->createAdmin();
        $draft = $this->makeDraftApplication();

        $response = $this->actingAs($admin)
            ->postJson("/api/applications/{$draft->id}/review", ['status' => 'under_review']);

        $response->assertForbidden();
    }

    public function test_super_admin_cannot_approve_draft_application(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $draft = $this->makeDraftApplication();

        $response = $this->actingAs($superAdmin)
            ->postJson("/api/applications/{$draft->id}/review", ['status' => 'approved']);

        $response->assertForbidden();
    }

    public function test_draft_approval_blocked_draft_camper_not_activated(): void
    {
        $admin = $this->createAdmin();
        $draft = $this->makeDraftApplication();
        $camper = $draft->camper;

        $this->assertFalse((bool) $camper->is_active);

        $this->actingAs($admin)
            ->postJson("/api/applications/{$draft->id}/review", ['status' => 'approved']);

        // Camper must remain inactive — draft was blocked, no activation should occur.
        $this->assertFalse((bool) $camper->fresh()->is_active);
    }

    public function test_submitted_application_can_still_be_approved(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true, 'capacity' => 20]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);

        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $response = $this->actingAs($admin)
            ->postJson("/api/applications/{$application->id}/review", ['status' => 'approved']);

        // Policy must NOT block this — it's a submitted application. The completeness
        // check may block the actual approval (422), but 403 must never be returned.
        $this->assertNotEquals(403, $response->status(), 'Submitted application review was incorrectly forbidden.');
    }
}
