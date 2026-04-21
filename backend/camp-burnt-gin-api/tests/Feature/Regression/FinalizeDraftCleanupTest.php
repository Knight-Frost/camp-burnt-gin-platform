<?php

namespace Tests\Feature\Regression;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\ApplicationDraft;
use App\Models\Camper;
use App\Models\CampSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\Support\TestApplicationFixture;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression coverage for BUG-213: after a parent finalizes an application,
 * leftover draft rows (both Application and ApplicationDraft JSON blobs)
 * remained alongside the submitted record in the drafts list.
 *
 * The root cause is that a camper can end up with two kinds of stale drafts:
 *
 *   1. Application rows that were created earlier but never matched by the
 *      upsert gate (e.g. session-less reapplication shells, or drafts from
 *      an aborted session change).
 *   2. ApplicationDraft JSON blobs that the frontend failed to delete on
 *      its own (network retry, serverDraftId unset on fresh starts).
 *
 * Finalize now cleans up both so the UI shows exactly one record — the
 * submitted one — for each (camper, session) pair.
 */
class FinalizeDraftCleanupTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        Queue::fake();
    }

    /**
     * Build a draft Application that is otherwise ready to finalize:
     * every required section complete per the ApplicationCompletenessService
     * engine, including camper fields, physician/insurance, a diagnosis,
     * a personal-care plan with all four ADL levels, all canonical activity
     * permissions, sign-off on the data-or-review sections, seven consents,
     * and all required documents.
     */
    private function buildFinalizableDraft(Camper $camper, CampSession $session): Application
    {
        TestApplicationFixture::buildCamperMinimum($camper);

        $draft = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Draft,
            'submitted_at' => null,
            'signed_at' => now(),
            'signature_name' => 'Jane Parent',
            'sections_reviewed' => TestApplicationFixture::reviewedOptionalSections(),
        ]);

        TestApplicationFixture::attachConsents($draft);
        TestApplicationFixture::attachRequiredDocuments($camper);

        return $draft;
    }

    public function test_finalize_deletes_same_session_duplicate_draft(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create([
            'first_name' => 'Athena', 'last_name' => 'Wicker',
        ]);
        $camper->medicalRecord()->create([]);
        $session = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);

        // Orphan duplicate: a prior aborted submit left this row behind.
        $orphan = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Draft,
            'submitted_at' => null,
        ]);

        $draft = $this->buildFinalizableDraft($camper, $session);

        $this->actingAs($parent)
            ->postJson("/api/applications/{$draft->id}/finalize")
            ->assertOk();

        $this->assertNull(
            Application::find($orphan->id),
            'same-session orphan draft must be deleted by finalize',
        );
        $this->assertEquals(
            'submitted',
            Application::find($draft->id)->status->value,
            'finalized application must transition to submitted status',
        );
    }

    public function test_finalize_deletes_session_less_shell_draft(): void
    {
        // The reapplication flow seeds drafts with camp_session_id=null.
        // When the applicant starts fresh those shells become invisible to
        // the upsert gate (null != specific session) and then linger as
        // orphans in the drafts list.
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $camper->medicalRecord()->create([]);
        $session = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);

        $shell = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => null,
            'status' => ApplicationStatus::Draft,
            'submitted_at' => null,
        ]);

        $draft = $this->buildFinalizableDraft($camper, $session);

        $this->actingAs($parent)
            ->postJson("/api/applications/{$draft->id}/finalize")
            ->assertOk();

        $this->assertNull(
            Application::find($shell->id),
            'session-less shell draft for the same camper must be deleted',
        );
    }

    public function test_finalize_preserves_drafts_for_other_sessions(): void
    {
        // A parent may legitimately be applying to multiple sessions for
        // the same camper. Finalizing one session must not nuke drafts
        // in flight for another.
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $camper->medicalRecord()->create([]);
        $sessionA = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);
        $sessionB = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);

        $otherSessionDraft = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $sessionB->id,
            'status' => ApplicationStatus::Draft,
            'submitted_at' => null,
        ]);

        $draft = $this->buildFinalizableDraft($camper, $sessionA);

        $this->actingAs($parent)
            ->postJson("/api/applications/{$draft->id}/finalize")
            ->assertOk();

        $this->assertNotNull(
            Application::find($otherSessionDraft->id),
            'drafts for other sessions must be preserved — parent may submit them later',
        );
    }

    public function test_finalize_deletes_application_draft_json_blob_for_this_camper(): void
    {
        // The frontend writes the camper's first name into the blob's
        // label. After a successful finalize the staging blob is stale;
        // clean it up so the drafts list reflects only the submitted row.
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create([
            'first_name' => 'Athena', 'last_name' => 'Wicker',
        ]);
        $camper->medicalRecord()->create([]);
        $session = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);

        $matchingBlob = ApplicationDraft::create([
            'user_id' => $parent->id,
            'label' => 'New Application',
            'draft_data' => ['s1' => []],
        ]);

        // Another parent's blob — must not be affected.
        $otherParent = $this->createParent();
        $unrelatedBlob = ApplicationDraft::create([
            'user_id' => $otherParent->id,
            'label' => 'Athena',
            'draft_data' => ['s1' => []],
        ]);

        $draft = $this->buildFinalizableDraft($camper, $session);

        $this->actingAs($parent)
            ->postJson("/api/applications/{$draft->id}/finalize")
            ->assertOk();

        $this->assertNull(
            ApplicationDraft::find($matchingBlob->id),
            'JSON staging blob matching this camper must be deleted',
        );
        $this->assertNotNull(
            ApplicationDraft::find($unrelatedBlob->id),
            'Other parents\' blobs must be untouched — user_id scoping',
        );
    }
}
