<?php

namespace Tests\Feature\Regression;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression coverage for the duplicate-application upsert gate introduced
 * in 2026-04-18 (BUG-208). The old behavior lived in a FormRequest
 * Rule::unique that fired before the controller, permanently blocking
 * applicants whose prior application was a draft, rejected, cancelled, or
 * withdrawn. These tests lock in the new contract.
 */
class ApplicationDuplicateDetectionTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    public function test_draft_is_resumed_not_rejected_when_reposting(): void
    {
        $parent  = $this->createParent();
        $camper  = Camper::factory()->forUser($parent)->create();
        $session = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);

        $draft = Application::factory()->create([
            'camper_id'       => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft'        => true,
            'status'          => ApplicationStatus::Submitted,
            'submitted_at'    => null,
        ]);

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id'       => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft'        => true,
            'notes'           => 'updated on resume',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.id', $draft->id)
            ->assertJsonPath('data.notes', 'updated on resume');

        // Still exactly one row for the slot — the resume must never clone.
        $this->assertSame(
            1,
            Application::where('camper_id', $camper->id)
                ->where('camp_session_id', $session->id)
                ->count(),
        );
    }

    public function test_reapplication_is_allowed_after_withdrawn(): void
    {
        $parent  = $this->createParent();
        $camper  = Camper::factory()->forUser($parent)->create();
        $session = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);

        Application::factory()->create([
            'camper_id'       => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft'        => false,
            'status'          => ApplicationStatus::Withdrawn,
            'submitted_at'    => now()->subWeek(),
        ]);

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id'       => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft'        => true,
        ]);

        $response->assertStatus(201);
        $this->assertSame(
            2,
            Application::where('camper_id', $camper->id)
                ->where('camp_session_id', $session->id)
                ->count(),
            'withdrawn row + new draft should coexist',
        );
    }

    public function test_reapplication_is_allowed_after_rejected(): void
    {
        $parent  = $this->createParent();
        $camper  = Camper::factory()->forUser($parent)->create();
        $session = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);

        Application::factory()->create([
            'camper_id'       => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft'        => false,
            'status'          => ApplicationStatus::Rejected,
            'submitted_at'    => now()->subWeek(),
        ]);

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id'       => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft'        => true,
        ]);

        $response->assertStatus(201);
    }

    public function test_active_submitted_application_blocks_with_409(): void
    {
        $parent  = $this->createParent();
        $camper  = Camper::factory()->forUser($parent)->create();
        $session = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);

        $existing = Application::factory()->create([
            'camper_id'       => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft'        => false,
            'status'          => ApplicationStatus::UnderReview,
            'submitted_at'    => now()->subDay(),
        ]);

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id'       => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft'        => true,
        ]);

        $response->assertStatus(409)
            ->assertJsonPath('existing_application_id', $existing->id)
            ->assertJsonPath('existing_application_status', 'under_review');
    }

    public function test_admin_default_view_excludes_drafts(): void
    {
        // Admin default = submitted-only review queue. Drafts are incomplete
        // work-in-progress and should not clutter the queue by default.
        $admin  = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $draft = Application::factory()->create([
            'camper_id'       => $camper->id,
            'camp_session_id' => CampSession::factory()->create()->id,
            'is_draft'        => true,
            'status'          => ApplicationStatus::Submitted,
            'submitted_at'    => null,
        ]);

        $submitted = Application::factory()->create([
            'camper_id'       => $camper->id,
            'camp_session_id' => CampSession::factory()->create()->id,
            'is_draft'        => false,
            'status'          => ApplicationStatus::Submitted,
            'submitted_at'    => now(),
        ]);

        $ids = collect($this->actingAs($admin)->getJson('/api/applications')->json('data'))
            ->pluck('id')
            ->all();

        $this->assertNotContains($draft->id, $ids, 'draft must NOT appear in admin default view');
        $this->assertContains($submitted->id, $ids, 'submitted must appear in admin default view');
    }

    public function test_admin_include_drafts_flag_surfaces_drafts(): void
    {
        // Opt-in escape hatch. The admin toggles "Include drafts" to diagnose
        // a blocked applicant; both drafts AND submitted must be returned.
        $admin  = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $draft = Application::factory()->create([
            'camper_id'       => $camper->id,
            'camp_session_id' => CampSession::factory()->create()->id,
            'is_draft'        => true,
            'status'          => ApplicationStatus::Submitted,
            'submitted_at'    => null,
        ]);

        $submitted = Application::factory()->create([
            'camper_id'       => $camper->id,
            'camp_session_id' => CampSession::factory()->create()->id,
            'is_draft'        => false,
            'status'          => ApplicationStatus::Submitted,
            'submitted_at'    => now(),
        ]);

        $ids = collect(
            $this->actingAs($admin)
                ->getJson('/api/applications?include_drafts=true')
                ->json('data')
        )->pluck('id')->all();

        $this->assertContains($draft->id, $ids);
        $this->assertContains($submitted->id, $ids);
    }

    public function test_admin_status_filter_excludes_drafts(): void
    {
        // A status filter means "review-queue meaning". Drafts share the
        // 'submitted' enum value so the status column alone isn't enough
        // to distinguish them; is_draft=false is applied alongside the
        // status filter for this reason.
        $admin  = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        Application::factory()->create([
            'camper_id'       => $camper->id,
            'camp_session_id' => CampSession::factory()->create()->id,
            'is_draft'        => true,
            'status'          => ApplicationStatus::Submitted,
            'submitted_at'    => null,
        ]);

        $submitted = Application::factory()->create([
            'camper_id'       => $camper->id,
            'camp_session_id' => CampSession::factory()->create()->id,
            'is_draft'        => false,
            'status'          => ApplicationStatus::Submitted,
            'submitted_at'    => now(),
        ]);

        $ids = collect($this->actingAs($admin)->getJson('/api/applications?status=submitted')->json('data'))
            ->pluck('id')
            ->all();

        $this->assertEquals([$submitted->id], $ids);
    }
}
