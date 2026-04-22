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
 * Phase-3 regression: ApplicationDraft JSON blobs now carry an
 * application_id FK, and finalize() deletes blobs by FK rather than
 * fragile `label LIKE %first_name%` string matching.
 *
 * Covers the root cause of the "ghost draft after submit" screenshots —
 * before the fix, a blob whose label did not match the camper's exact
 * first_name (nickname, typo, or default "New Application") survived
 * finalize() and rendered as a separate draft card in the applicant
 * applications list.
 */
class ApplicationDraftLinkageTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        Queue::fake();
    }

    private function buildCamperWithEverythingButSubmit(\App\Models\User $parent): Camper
    {
        $camper = Camper::factory()->forUser($parent)->create([
            'first_name' => 'Athena',
            'last_name' => 'Wicker',
            'date_of_birth' => '2015-01-01',
            'gender' => 'female',
            'tshirt_size' => 'Youth M',
            'county' => 'Richland',
        ]);
        TestApplicationFixture::buildCamperMinimum($camper);
        TestApplicationFixture::attachRequiredDocuments($camper);

        return $camper;
    }

    public function test_finalize_deletes_blob_linked_by_application_id(): void
    {
        $parent = $this->createParent();
        $camper = $this->buildCamperWithEverythingButSubmit($parent);
        $session = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);

        $draft = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Draft,
            'submitted_at' => null,
            'signed_at' => now(),
            'signature_name' => 'Jane Parent',
            'sections_reviewed' => TestApplicationFixture::reviewedOptionalSections(),
            'section_attestations' => TestApplicationFixture::attestedOptionalSections(),
        ]);
        TestApplicationFixture::attachConsents($draft);

        // A blob whose label intentionally does NOT match the camper's name.
        // Under the old label-match cleanup, this would have survived
        // finalize. With the FK-based cleanup it must be deleted.
        $blob = ApplicationDraft::create([
            'user_id' => $parent->id,
            'application_id' => $draft->id,
            'label' => 'Totally different label',
            'draft_data' => ['s1' => []],
        ]);

        $this->actingAs($parent)
            ->postJson("/api/applications/{$draft->id}/finalize")
            ->assertOk();

        $this->assertNull(
            ApplicationDraft::find($blob->id),
            'blob linked by application_id must be deleted regardless of label',
        );
    }

    public function test_finalize_does_not_touch_blobs_linked_to_other_applications(): void
    {
        $parent = $this->createParent();
        $camper = $this->buildCamperWithEverythingButSubmit($parent);
        $sessionA = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);
        $sessionB = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);

        $finalizingDraft = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $sessionA->id,
            'status' => ApplicationStatus::Draft,
            'submitted_at' => null,
            'signed_at' => now(),
            'signature_name' => 'Jane Parent',
            'sections_reviewed' => TestApplicationFixture::reviewedOptionalSections(),
            'section_attestations' => TestApplicationFixture::attestedOptionalSections(),
        ]);
        TestApplicationFixture::attachConsents($finalizingDraft);

        // Another in-flight Application (different session) with its own blob.
        $otherDraft = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $sessionB->id,
            'status' => ApplicationStatus::Draft,
            'submitted_at' => null,
        ]);

        $mineBlob = ApplicationDraft::create([
            'user_id' => $parent->id,
            'application_id' => $finalizingDraft->id,
            'label' => 'Athena',
            'draft_data' => ['s1' => []],
        ]);
        $othersBlob = ApplicationDraft::create([
            'user_id' => $parent->id,
            'application_id' => $otherDraft->id,
            'label' => 'Athena',
            'draft_data' => ['s1' => []],
        ]);

        $this->actingAs($parent)
            ->postJson("/api/applications/{$finalizingDraft->id}/finalize")
            ->assertOk();

        $this->assertNull(ApplicationDraft::find($mineBlob->id),
            'blob linked to the finalized app must be deleted');
        $this->assertNotNull(ApplicationDraft::find($othersBlob->id),
            'blob linked to a different (still-active) application must be preserved');
    }

    public function test_legacy_unlinked_blob_still_cleaned_by_label_fallback(): void
    {
        // Blobs created before the application_id column existed have NULL
        // for the FK. finalize() still falls back to the label-match
        // cleanup for those, so historical ghost-draft scenarios don't
        // regress.
        $parent = $this->createParent();
        $camper = $this->buildCamperWithEverythingButSubmit($parent);
        $session = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);

        $draft = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Draft,
            'submitted_at' => null,
            'signed_at' => now(),
            'signature_name' => 'Jane Parent',
            'sections_reviewed' => TestApplicationFixture::reviewedOptionalSections(),
            'section_attestations' => TestApplicationFixture::attestedOptionalSections(),
        ]);
        TestApplicationFixture::attachConsents($draft);

        $legacyBlob = ApplicationDraft::create([
            'user_id' => $parent->id,
            'application_id' => null,
            'label' => 'New Application',
            'draft_data' => ['s1' => []],
        ]);

        $this->actingAs($parent)
            ->postJson("/api/applications/{$draft->id}/finalize")
            ->assertOk();

        $this->assertNull(ApplicationDraft::find($legacyBlob->id),
            'legacy unlinked blob must still be caught by label-match fallback');
    }
}
