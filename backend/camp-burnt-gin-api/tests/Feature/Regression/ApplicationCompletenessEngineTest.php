<?php

namespace Tests\Feature\Regression;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Document;
use App\Services\Camper\ApplicationCompletenessService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Support\TestApplicationFixture;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression coverage for the ApplicationCompletenessService engine —
 * the canonical validator for "is this application complete / valid /
 * submittable". These tests lock the contract that drives finalize(),
 * the completeness endpoint, the canonical resource's meta.validation
 * block, and the revalidate command.
 */
class ApplicationCompletenessEngineTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    private function engine(): ApplicationCompletenessService
    {
        return app(ApplicationCompletenessService::class);
    }

    // ── Empty application — every section flagged ─────────────────────────────

    public function test_empty_application_is_incomplete_with_every_section_flagged(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create([
            'first_name' => '', 'last_name' => '',
        ]);
        $session = CampSession::factory()->create(['is_active' => true]);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            // Explicitly clear narratives that the factory randomises.
            'narrative_rustic_environment' => null,
            'narrative_staff_suggestions' => null,
            'narrative_participation_concerns' => null,
            'narrative_camp_benefit' => null,
            'narrative_heat_tolerance' => null,
            'narrative_transportation' => null,
            'narrative_additional_info' => null,
            'narrative_emergency_protocols' => null,
        ]);

        $result = $this->engine()->evaluate($app);

        $this->assertSame('INCOMPLETE', $result['state']);
        $this->assertFalse($result['is_complete']);
        foreach (['camper', 'health', 'behavior', 'equipment', 'diet',
            'personal_care', 'activities', 'medications', 'narratives',
            'documents', 'consents'] as $key) {
            $this->assertFalse(
                $result['sections'][$key]['is_complete'],
                "Section '$key' must be incomplete on an empty application",
            );
        }
    }

    // ── Valid application → READY ──────────────────────────────────────────────

    public function test_valid_application_reaches_ready_state(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        TestApplicationFixture::buildCamperMinimum($camper);
        TestApplicationFixture::attachRequiredDocuments($camper);

        $session = CampSession::factory()->create(['is_active' => true]);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'signed_at' => now(),
            'signature_name' => 'Jane Parent',
            'sections_reviewed' => TestApplicationFixture::reviewedOptionalSections(),
            'section_attestations' => TestApplicationFixture::attestedOptionalSections(),
        ]);
        TestApplicationFixture::attachConsents($app);

        $result = $this->engine()->evaluate($app->fresh());

        $this->assertSame('READY', $result['state']);
        $this->assertTrue($result['is_complete']);
        $this->assertTrue($result['is_valid']);
        $this->assertEmpty($result['blocking_issues']);
        $this->assertSame(100, $result['completion_percentage']);
    }

    // ── BUG-247: Phantom checkmarks on new draft for returning applicant ─────

    /**
     * Regression: a returning applicant who creates a brand-new draft
     * application (against an existing Camper whose clinical relations
     * carry over from a prior year) must NOT have any section reported
     * as `is_complete=true` purely because that data exists on the
     * Camper. The parent must explicitly review each section for THIS
     * application, stamped via sections_reviewed.
     *
     * Before the fix: 8 of 11 sections showed is_complete=true on mount.
     * The frontend then rendered green checkmarks next to Health,
     * Behavior, Equipment, Diet, Personal Care, Activities, Medications,
     * Narratives — with the parent having typed only a first/last name.
     */
    public function test_returning_applicant_fresh_draft_has_no_phantom_section_completeness(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        // Camper carries over all clinical data from a prior application year.
        TestApplicationFixture::buildCamperMinimum($camper);
        TestApplicationFixture::attachRequiredDocuments($camper);

        $session = CampSession::factory()->create(['is_active' => true]);
        // Fresh draft — signed_at set and consents attached (so those are
        // NOT the gating signal), but sections_reviewed is empty.
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'signed_at' => now(),
            'signature_name' => 'Jane Parent',
            'sections_reviewed' => null,
        ]);
        TestApplicationFixture::attachConsents($app);

        $result = $this->engine()->evaluate($app->fresh());

        // Every data-bearing section must report NOT complete — the parent
        // hasn't confirmed this year's data yet, even though the Camper has
        // populated rows from last year's submission.
        $reviewRequired = [
            'camper', 'health', 'behavior', 'equipment', 'diet',
            'personal_care', 'activities', 'medications', 'narratives',
        ];
        foreach ($reviewRequired as $section) {
            $this->assertFalse(
                $result['sections'][$section]['is_complete'],
                "Section '{$section}' must NOT be complete before the parent stamps sections_reviewed. "
                    .'Otherwise returning applicants see phantom green checkmarks on new drafts.'
            );
        }
        // Documents and consents have been attached — they should be complete
        // in this scenario. If either is unexpectedly false here it means the
        // test fixture drifted or the engine regressed (e.g., documents was
        // added to REVIEW_REQUIRED_SECTIONS by mistake).
        $this->assertTrue(
            $result['sections']['documents']['is_complete'],
            'Documents section must be complete when all required docs are attached.'
        );
        $this->assertTrue(
            $result['sections']['consents']['is_complete'],
            'Consents section must be complete when all 7 consent records are attached.'
        );
        // State cannot be READY.
        $this->assertNotSame('READY', $result['state']);
        $this->assertFalse($result['is_complete']);
    }

    /**
     * Regression: even a brand-new Camper stub with an empty FeedingPlan
     * row (auto-created by initializeDraft PATH B) must NOT mark the diet
     * section complete. Before the fix, the rule was `$hasData = $fp !== null`
     * — presence of the zero-field stub was enough to flip diet to green.
     */
    public function test_empty_feeding_plan_stub_does_not_complete_diet_section(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        // Auto-create an EMPTY feeding plan like initializeDraft does.
        $camper->feedingPlan()->create([]);

        $session = CampSession::factory()->create(['is_active' => true]);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'sections_reviewed' => null,
        ]);

        $result = $this->engine()->evaluate($app->fresh());

        $this->assertFalse(
            $result['sections']['diet']['is_complete'],
            'Diet section must not be complete merely because a zero-field FeedingPlan stub exists.'
        );
    }

    /**
     * Regression: a parent who uploads every required document to their
     * DRAFT application's polymorphic must see the Documents section
     * report is_complete=true — without having to finalize first.
     *
     * Before the fix: documentBreakdown() passed `null` (not the application)
     * to checkCompliance() unless the caller was the finalize flow. As a
     * result, getUploadedDocuments filtered application-attached docs by
     * `status != 'draft' AND submitted_at IS NOT NULL` and could not see
     * the parent's draft uploads. The Documents pill stayed black until
     * the moment of finalize, even though every required PDF was on file.
     *
     * The legacy test fixture attaches docs to the Camper polymorphic
     * (always counted regardless of forFinalization) — that is why
     * existing happy-path tests passed despite this bug. This test uses
     * the Application polymorphic (the post-BUG-198 primary path).
     *
     * The docs are attached as DRAFTS (submitted_at = null) — that is
     * the actual on-disk shape during the parent's draft phase. The
     * DocumentController::submit endpoint forbids independently flipping
     * submitted_at on draft-Application-linked docs (only finalize() may
     * cascade-promote them), so the engine MUST be able to count drafts
     * for the parent's own validation refresh.
     */
    public function test_documents_attached_to_draft_application_count_for_completeness(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $session = CampSession::factory()->create(['is_active' => true]);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        // Attach the three universal required documents to the DRAFT
        // application's polymorphic, deliberately as drafts — finalize()
        // is the only path allowed to set submitted_at on these rows.
        $types = ['official_medical_form', 'immunization_record', 'insurance_card'];
        foreach ($types as $type) {
            Document::create([
                'documentable_type' => Application::class,
                'documentable_id' => $app->id,
                'document_type' => $type,
                'original_filename' => $type.'.pdf',
                'stored_filename' => $type.'.pdf',
                'path' => 'documents/'.$type.'.pdf',
                'mime_type' => 'application/pdf',
                'file_size' => 1024,
                'uploaded_by' => $parent->id,
                'submitted_at' => null,
                'is_verified' => false,
                'verification_status' => 'pending',
                'expiration_date' => $type === 'official_medical_form' ? now()->addYear() : null,
                'exam_date' => $type === 'official_medical_form' ? now()->subMonth() : null,
            ]);
        }

        $result = $this->engine()->evaluate($app->fresh());

        $this->assertTrue(
            $result['sections']['documents']['is_complete'],
            'Documents section must be complete when every required doc is '
                .'uploaded to the draft application — even though the '
                .'application itself is still draft. Otherwise the parent '
                .'never sees the Documents pill go green until they finalize.'
        );
        $this->assertEmpty(
            $result['documents']['missing'],
            'No required document type should appear in the missing list.'
        );
    }

    /**
     * Regression: ApplicationController::update() must MERGE the
     * sections_reviewed JSON patch with any existing map, not replace it.
     * Before the fix, sequential PATCH calls with different section keys
     * silently erased each other's stamps — so a parent who marked behavior
     * reviewed, then diet reviewed, would end up with only diet stamped.
     */
    public function test_sections_reviewed_is_merged_across_updates(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $session = CampSession::factory()->create(['is_active' => true]);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $this->actingAs($parent)
            ->patchJson("/api/applications/{$app->id}", [
                'sections_reviewed' => ['behavior' => '2026-04-21T10:00:00Z'],
            ])->assertOk();

        $this->actingAs($parent)
            ->patchJson("/api/applications/{$app->id}", [
                'sections_reviewed' => ['diet' => '2026-04-21T10:05:00Z'],
            ])->assertOk();

        $merged = $app->fresh()->sections_reviewed;

        $this->assertSame('2026-04-21T10:00:00Z', $merged['behavior'] ?? null);
        $this->assertSame('2026-04-21T10:05:00Z', $merged['diet'] ?? null);
    }

    // ── Submitted application retains SUBMITTED state even with drift ────────

    public function test_submitted_application_is_state_submitted_even_if_data_drifts(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        TestApplicationFixture::buildCamperMinimum($camper);
        TestApplicationFixture::attachRequiredDocuments($camper);

        $session = CampSession::factory()->create(['is_active' => true]);
        $app = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => now()->subDays(30),
            'signed_at' => now()->subDays(30),
            'sections_reviewed' => TestApplicationFixture::reviewedOptionalSections(),
        ]);
        TestApplicationFixture::attachConsents($app);

        // Drift: expire the medical form retroactively.
        Document::where('documentable_id', $camper->id)
            ->where('document_type', 'official_medical_form')
            ->update(['expiration_date' => now()->subWeek()]);

        $result = $this->engine()->evaluate($app->fresh());

        $this->assertSame('SUBMITTED', $result['state']);
        // But the payload still tells the truth about what's wrong.
        $this->assertNotEmpty(
            array_filter(
                $result['documents']['expired'],
                fn ($d) => $d['document_type'] === 'official_medical_form',
            ),
        );
    }

    // ── Paper app: signature+consents relaxed, section fields still required ─

    /**
     * Regression: paper-self submission with packet on file is fully complete.
     *
     * The paper UX has no UI for the parent to enter camper / health /
     * behavior / etc. data — the whole flow is "scan the packet, upload it,
     * done." The engine therefore short-circuits every section to complete
     * once the packet is on file. Admin transcribes via Admin Edit
     * Application before approval; the IncompleteApprovalModal is the
     * "transcription hole" guard at the approval gate.
     *
     * Before the paper-form audit fix, this test asserted the OPPOSITE —
     * that section data must be present even for paper apps. That contract
     * was never deliverable in production: the paper page has no section
     * editor, so every paper-self finalize rejected with a generic
     * "Application is incomplete" toast. The test name and assertions were
     * inverted to match the actual UX.
     */
    public function test_paper_app_with_packet_is_fully_complete(): void
    {
        $parent = $this->createParent();
        // Bare-minimum camper — only the fields the paper Step 0 collects.
        $camper = Camper::factory()->forUser($parent)->create([
            'first_name' => 'Athena',
            'last_name' => 'Wicker',
            'date_of_birth' => '2015-01-01',
            // Intentionally NO gender, tshirt_size, county, EC, medical record,
            // diagnoses, etc. — the parent never had a UI for these.
            'gender' => null,
            'tshirt_size' => null,
            'county' => null,
        ]);

        $session = CampSession::factory()->create(['is_active' => true]);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'submission_source' => \App\Enums\SubmissionSource::PaperSelf,
        ]);

        // Packet on file as a draft (this engine path runs at finalize time
        // before submitted_at flips on the doc — see paperPacketOnFile's
        // $forFinalization branch).
        Document::create([
            'documentable_type' => Application::class,
            'documentable_id' => $app->id,
            'document_type' => 'paper_application_packet',
            'original_filename' => 'packet.pdf', 'stored_filename' => 'packet.pdf',
            'path' => 'documents/packet.pdf', 'mime_type' => 'application/pdf',
            'file_size' => 1024, 'uploaded_by' => $parent->id,
            'submitted_at' => null,
            'is_verified' => false,
            'verification_status' => \App\Enums\DocumentVerificationStatus::Pending,
        ]);

        $result = $this->engine()->evaluate($app->fresh(), forFinalization: true);

        $this->assertTrue($result['paper_substitutes_digital']);
        $this->assertTrue($result['is_complete']);
        $this->assertEmpty($result['blocking_issues']);
        // Every section reports complete — admin will transcribe missing
        // fields via Admin Edit before approval.
        foreach (['camper', 'health', 'behavior', 'equipment', 'diet',
            'personal_care', 'activities', 'medications', 'narratives',
            'documents', 'consents'] as $section) {
            $this->assertTrue(
                $result['sections'][$section]['is_complete'],
                "Section '{$section}' must be complete for a paper-self app with packet on file."
            );
        }
    }

    // ── Conditional rules fire regardless of review sentinel ─────────────────

    public function test_g_tube_without_formula_fails_diet_even_if_section_reviewed(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $camper->feedingPlan()->create([
            'g_tube' => true,
            'formula' => null,
            'amount_per_feeding' => null,
        ]);

        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'sections_reviewed' => TestApplicationFixture::reviewedOptionalSections(),
        ]);

        $result = $this->engine()->evaluate($app->fresh());

        $dietMissing = collect($result['sections']['diet']['missing'])->pluck('key')->all();
        $this->assertContains('formula', $dietMissing);
        $this->assertContains('amount_per_feeding', $dietMissing);
    }

    // ── Revalidate command reverts a submitted-but-invalid app ───────────────

    public function test_revalidate_apply_reverts_submitted_app_with_expired_medical_form(): void
    {
        Notification::fake();
        // strict_enabled gates expired-document detection; override for this
        // test so the revalidate command can identify the drift.
        config()->set('compliance.strict_enabled', true);

        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        TestApplicationFixture::buildCamperMinimum($camper);
        TestApplicationFixture::attachRequiredDocuments($camper);

        $session = CampSession::factory()->create(['is_active' => true]);
        $app = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => now()->subWeek(),
            'signed_at' => now()->subWeek(),
            'sections_reviewed' => TestApplicationFixture::reviewedOptionalSections(),
        ]);
        TestApplicationFixture::attachConsents($app);

        // Seed required-document rules so the enforcer actually has
        // rules to evaluate (without rules the compliance block reports
        // "is_compliant=true" trivially — no rules match).
        $this->seed(\Database\Seeders\RequiredDocumentRuleSeeder::class);

        // Expire the medical form so it now blocks.
        Document::where('documentable_id', $camper->id)
            ->where('document_type', 'official_medical_form')
            ->update(['expiration_date' => now()->subDay()]);

        // Sanity-check: engine sees the expired doc and marks invalid.
        $preCheck = $this->engine()->evaluate($app->fresh(), forFinalization: true);
        $this->assertFalse(
            $preCheck['is_valid'],
            'Expected pre-check invalid; got: '.json_encode($preCheck['documents']),
        );

        $output = new \Symfony\Component\Console\Output\BufferedOutput;
        \Illuminate\Support\Facades\Artisan::call('applications:revalidate', ['--apply' => true], $output);

        $app->refresh();
        $this->assertTrue(
            $app->isDraft(),
            'Revalidate must revert invalid submitted app to draft. Command output: '.$output->fetch(),
        );
        $this->assertNull($app->submitted_at, 'submitted_at must be cleared on revert');

        // Audit + notification were recorded.
        $this->assertDatabaseHas('audit_logs', [
            'auditable_type' => Application::class,
            'auditable_id' => $app->id,
            'action' => 'application.reverted.revalidation',
        ]);
        Notification::assertSentTo(
            $parent,
            \App\Notifications\ApplicationRevertedToDraftNotification::class,
        );
    }

    public function test_revalidate_dry_run_does_not_touch_rows(): void
    {
        Notification::fake();

        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $session = CampSession::factory()->create(['is_active' => true]);
        $app = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => now(),
        ]);

        $this->artisan('applications:revalidate')->assertExitCode(0);

        $app->refresh();
        $this->assertFalse($app->isDraft(), 'Dry run must not change application status');
        $this->assertNotNull($app->submitted_at, 'Dry run must not clear submitted_at');
        Notification::assertNothingSent();
        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'application.reverted.revalidation',
        ]);
    }

    public function test_revalidate_skips_applications_admin_has_touched(): void
    {
        Notification::fake();

        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $session = CampSession::factory()->create(['is_active' => true]);
        // Intentionally-bad application in a post-review status. The command
        // must leave it alone — once admin has touched it, reverting silently
        // would overwrite admin work.
        $app = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Approved,
            'submitted_at' => now()->subWeek(),
        ]);

        $this->artisan('applications:revalidate', ['--apply' => true])
            ->assertExitCode(0);

        $app->refresh();
        $this->assertFalse($app->isDraft());
        $this->assertSame(ApplicationStatus::Approved, $app->status);
    }
}
