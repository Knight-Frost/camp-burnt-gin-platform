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
        ]);
        TestApplicationFixture::attachConsents($app);

        $result = $this->engine()->evaluate($app->fresh());

        $this->assertSame('READY', $result['state']);
        $this->assertTrue($result['is_complete']);
        $this->assertTrue($result['is_valid']);
        $this->assertEmpty($result['blocking_issues']);
        $this->assertSame(100, $result['completion_percentage']);
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
            'is_draft' => false,
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

    public function test_paper_app_bypasses_signature_and_consents_but_still_requires_section_data(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create([
            'first_name' => 'Athena', 'last_name' => 'Wicker',
            'date_of_birth' => '2015-01-01', 'gender' => 'female',
            'tshirt_size' => 'Youth M', 'county' => 'Richland',
        ]);
        $camper->emergencyContacts()->create([
            'name' => 'Jane', 'relationship' => 'Mother', 'phone_primary' => '5555',
        ]);
        $camper->medicalRecord()->create([]);

        $session = CampSession::factory()->create(['is_active' => true]);
        $app = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft' => false,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => now(),
            'submission_source' => \App\Enums\SubmissionSource::PaperSelf,
        ]);

        // Packet on file — substitutes for digital signature+consents.
        Document::create([
            'documentable_type' => Application::class,
            'documentable_id' => $app->id,
            'document_type' => 'paper_application_packet',
            'original_filename' => 'packet.pdf', 'stored_filename' => 'packet.pdf',
            'path' => 'documents/packet.pdf', 'mime_type' => 'application/pdf',
            'file_size' => 1024, 'uploaded_by' => $parent->id,
            'submitted_at' => now(), 'is_verified' => true,
            'verification_status' => \App\Enums\DocumentVerificationStatus::Approved,
        ]);

        $result = $this->engine()->evaluate($app->fresh());

        $this->assertTrue($result['paper_substitutes_digital']);
        // Signature + consents slot is satisfied.
        $this->assertEmpty($result['missing_consents']);
        // But section-field gaps still show up (no diagnoses, no ADL plan, etc.).
        $this->assertFalse($result['sections']['health']['is_complete']);
        $this->assertFalse($result['sections']['personal_care']['is_complete']);
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
            'is_draft' => false,
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
            $app->is_draft,
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
            'is_draft' => false,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => now(),
        ]);

        $this->artisan('applications:revalidate')->assertExitCode(0);

        $app->refresh();
        $this->assertFalse($app->is_draft, 'Dry run must not change is_draft');
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
            'is_draft' => false,
            'status' => ApplicationStatus::Approved,
            'submitted_at' => now()->subWeek(),
        ]);

        $this->artisan('applications:revalidate', ['--apply' => true])
            ->assertExitCode(0);

        $app->refresh();
        $this->assertFalse($app->is_draft);
        $this->assertSame(ApplicationStatus::Approved, $app->status);
    }
}
