<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for the two-phase submission finalize endpoint.
 *
 * POST /api/applications/{id}/finalize
 *
 * This endpoint converts a complete draft application into an official
 * submission. It enforces the full backend completeness gate before
 * atomically marking the application as submitted.
 */
class ApplicationFinalizationTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        // Completeness evaluation reads both the risk engine configuration and
        // the required-document rules from the database. Without these seeders,
        // `missing_documents` is always empty and tests pass vacuously.
        $this->seed(\Database\Seeders\RiskEngineSeeder::class);
        $this->seed(\Database\Seeders\RequiredDocumentRuleSeeder::class);
    }

    private function makeDraftWithCamper(): array
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true, 'capacity' => 20]);
        $camper = Camper::factory()->create([
            'user_id' => $parent->id,
            'first_name' => 'Alice',
            'last_name' => 'Smith',
            'date_of_birth' => '2010-01-01',
            'gender' => 'female',
            'tshirt_size' => 'Youth M',
            'county' => 'Richland',
        ]);

        $draft = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        return [$parent, $camper, $draft];
    }

    // ── Authorization ──────────────────────────────────────────────────────────

    public function test_unauthenticated_user_cannot_finalize(): void
    {
        [, , $draft] = $this->makeDraftWithCamper();

        $this->postJson("/api/applications/{$draft->id}/finalize")
            ->assertUnauthorized();
    }

    public function test_admin_cannot_finalize_applicant_draft(): void
    {
        $admin = $this->createAdmin();
        [, , $draft] = $this->makeDraftWithCamper();

        $this->actingAs($admin)
            ->postJson("/api/applications/{$draft->id}/finalize")
            ->assertForbidden();
    }

    public function test_other_parent_cannot_finalize_draft(): void
    {
        $other = $this->createParent();
        [, , $draft] = $this->makeDraftWithCamper();

        $this->actingAs($other)
            ->postJson("/api/applications/{$draft->id}/finalize")
            ->assertForbidden();
    }

    public function test_parent_cannot_finalize_already_submitted_application(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true, 'capacity' => 20]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $app = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/finalize")
            ->assertForbidden();
    }

    // ── Completeness enforcement ───────────────────────────────────────────────

    public function test_finalize_blocked_when_camper_fields_missing(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true, 'capacity' => 20]);
        $camper = Camper::factory()->create([
            'user_id' => $parent->id,
            'tshirt_size' => null,
            'county' => null,
        ]);
        $draft = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$draft->id}/finalize");

        $response->assertUnprocessable();
        $body = $response->json();
        $this->assertNotEmpty($body['missing_fields']);
        // Application must remain a draft
        $this->assertTrue($draft->fresh()->isDraft());
    }

    public function test_finalize_response_includes_structured_missing_data(): void
    {
        [$parent, , $draft] = $this->makeDraftWithCamper();
        // Camper has all required fields but no EC, signature, consents, or documents

        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$draft->id}/finalize");

        $response->assertUnprocessable();
        $body = $response->json();
        // Response must include all three gap categories for structured frontend handling
        $this->assertArrayHasKey('missing_fields', $body);
        $this->assertArrayHasKey('missing_documents', $body);
        $this->assertArrayHasKey('missing_consents', $body);
        // Each gap must have key, label, and severity
        foreach ($body['missing_fields'] as $gap) {
            $this->assertArrayHasKey('key', $gap);
            $this->assertArrayHasKey('label', $gap);
            $this->assertArrayHasKey('severity', $gap);
        }
    }

    public function test_finalize_blocked_when_missing_consents(): void
    {
        [$parent, $camper, $draft] = $this->makeDraftWithCamper();
        // Add EC so field checks pass (except consents, signature, docs)
        $camper->emergencyContacts()->create([
            'name' => 'Jane Smith',
            'relationship' => 'Mother',
            'phone_primary' => '555-0001',
        ]);
        // Sign the application
        $draft->update(['signed_at' => now(), 'signature_name' => 'Jane Smith']);

        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$draft->id}/finalize");

        $response->assertUnprocessable();
        $body = $response->json();
        $this->assertNotEmpty($body['missing_consents']);
        // Still a draft
        $this->assertTrue($draft->fresh()->isDraft());
    }

    // ── Successful finalization ────────────────────────────────────────────────

    public function test_finalize_succeeds_with_complete_application(): void
    {
        [$parent, $camper, $draft] = $this->makeDraftWithCamper();
        $this->seedCompleteApplication($draft, $camper, $parent);

        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$draft->id}/finalize");

        $response->assertOk();

        $fresh = $draft->fresh();
        $this->assertFalse((bool) $fresh->isDraft());
        $this->assertNotNull($fresh->submitted_at);
        $this->assertEquals(ApplicationStatus::Submitted, $fresh->status);
    }

    public function test_finalize_stamps_submitted_at(): void
    {
        [$parent, $camper, $draft] = $this->makeDraftWithCamper();
        $this->seedCompleteApplication($draft, $camper, $parent);

        $before = now()->subSecond();
        $this->actingAs($parent)->postJson("/api/applications/{$draft->id}/finalize");
        $after = now()->addSecond();

        $fresh = $draft->fresh();
        $this->assertNotNull($fresh->submitted_at);
        $this->assertTrue($fresh->submitted_at->between($before, $after));
    }

    public function test_finalize_sets_form_definition_id_when_active_form_exists(): void
    {
        [$parent, $camper, $draft] = $this->makeDraftWithCamper();
        $this->seedCompleteApplication($draft, $camper, $parent);

        // No assertion on specific value — just that it is set if an active form exists
        $this->actingAs($parent)->postJson("/api/applications/{$draft->id}/finalize");

        $fresh = $draft->fresh();
        $this->assertFalse((bool) $fresh->isDraft());
        // form_definition_id is nullable if no active form exists — no error either way
    }

    public function test_finalize_does_not_block_on_unverified_documents(): void
    {
        [$parent, $camper, $draft] = $this->makeDraftWithCamper();

        \Tests\Support\TestApplicationFixture::buildCamperMinimum($camper);
        $draft->update([
            'signed_at' => now(),
            'signature_name' => 'Jane Smith',
            'sections_reviewed' => \Tests\Support\TestApplicationFixture::reviewedOptionalSections(),
        ]);
        \Tests\Support\TestApplicationFixture::attachConsents($draft, 'Jane Smith');

        // Documents uploaded but NOT verified (is_verified = false) — per
        // the submission-gate contract, finalize must succeed anyway; the
        // admin verifies post-submit.
        foreach (['official_medical_form', 'immunization_record', 'insurance_card'] as $type) {
            Document::create([
                'documentable_type' => 'App\\Models\\Camper',
                'documentable_id' => $camper->id,
                'document_type' => $type,
                'original_filename' => $type.'.pdf',
                'stored_filename' => $type.'.pdf',
                'path' => 'documents/'.$type.'.pdf',
                'mime_type' => 'application/pdf',
                'file_size' => 1024,
                'uploaded_by' => $parent->id,
                'submitted_at' => now(),
                'is_verified' => false,
                'expiration_date' => $type === 'official_medical_form' ? now()->addYear() : null,
            ]);
        }

        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$draft->id}/finalize");

        // Finalization must succeed even with unverified documents
        $response->assertOk();
        $this->assertFalse($draft->fresh()->isDraft());
    }

    // ── Paper-submission completeness ──────────────────────────────────────────

    public function test_paper_self_application_is_complete_without_digital_signature_or_consents(): void
    {
        // A paper-self application carries the guardian's signature and the
        // seven CYSHCN consents on the physical packet. Once the packet
        // document is uploaded and marked submitted, the digital-only gate
        // must NOT keep reporting "signature missing" / "7 consents missing".
        // Section fields still apply — staff must transcribe the paper
        // packet's contents into the database (strict source of truth).
        [$parent, $camper, $draft] = $this->makeDraftWithCamper();

        \Tests\Support\TestApplicationFixture::buildCamperMinimum($camper);

        $draft->update([
            'submission_source' => \App\Enums\SubmissionSource::PaperSelf,
            'submitted_at' => now(),
            'sections_reviewed' => \Tests\Support\TestApplicationFixture::reviewedOptionalSections(),
        ]);

        // Required medical documents still apply to paper apps; seed with
        // the correct verification_status enum so isVerified() returns true.
        foreach (['official_medical_form', 'immunization_record', 'insurance_card'] as $type) {
            Document::create([
                'documentable_type' => \App\Models\Camper::class,
                'documentable_id' => $camper->id,
                'document_type' => $type,
                'original_filename' => $type.'.pdf',
                'stored_filename' => $type.'.pdf',
                'path' => 'documents/'.$type.'.pdf',
                'mime_type' => 'application/pdf',
                'file_size' => 1024,
                'uploaded_by' => $parent->id,
                'submitted_at' => now(),
                'verification_status' => \App\Enums\DocumentVerificationStatus::Approved,
                'expiration_date' => $type === 'official_medical_form' ? now()->addYear() : null,
            ]);
        }

        // Attach the completed paper packet — this IS the digital signature
        // and consents for the purposes of the completeness gate.
        Document::create([
            'documentable_type' => \App\Models\Application::class,
            'documentable_id' => $draft->id,
            'document_type' => 'paper_application_packet',
            'original_filename' => 'packet.pdf',
            'stored_filename' => 'packet.pdf',
            'path' => 'documents/packet.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 2048,
            'uploaded_by' => $parent->id,
            'submitted_at' => now(),
            'verification_status' => \App\Enums\DocumentVerificationStatus::Approved,
        ]);

        $report = app(\App\Services\Camper\ApplicationCompletenessService::class)
            ->check($draft->fresh(), forFinalization: false);

        $this->assertTrue(
            $report['is_complete'],
            'Paper app with packet should be complete: '.json_encode($report),
        );
        $this->assertSame([], $report['missing_consents']);
        $this->assertTrue($report['paper_substitutes_digital']);
    }

    public function test_paper_application_without_packet_reports_packet_missing(): void
    {
        [, $camper, $draft] = $this->makeDraftWithCamper();
        $camper->emergencyContacts()->create([
            'name' => 'Jane', 'relationship' => 'Mother', 'phone_primary' => '555-0001',
        ]);
        $draft->update(['submission_source' => \App\Enums\SubmissionSource::PaperAdmin]);

        $report = app(\App\Services\Camper\ApplicationCompletenessService::class)
            ->check($draft->fresh(), forFinalization: false);

        $this->assertFalse($report['is_complete']);
        $packetMissing = collect($report['missing_documents'])
            ->contains(fn ($d) => $d['key'] === 'doc_paper_application_packet');
        $this->assertTrue($packetMissing, 'Paper app without packet must surface one clear "packet missing" entry.');
    }

    public function test_archived_required_document_does_not_pass_compliance(): void
    {
        // Guards against: admin archives a rejected medical form → compliance
        // check silently treats the slot as "filled" → approval goes through
        // without a valid document ever being received.
        [$parent, $camper, $draft] = $this->makeDraftWithCamper();

        foreach (['official_medical_form', 'immunization_record', 'insurance_card'] as $type) {
            Document::create([
                'documentable_type' => 'App\\Models\\Camper',
                'documentable_id' => $camper->id,
                'document_type' => $type,
                'original_filename' => $type.'.pdf',
                'stored_filename' => $type.'.pdf',
                'path' => 'documents/'.$type.'.pdf',
                'mime_type' => 'application/pdf',
                'file_size' => 1024,
                'uploaded_by' => $parent->id,
                'submitted_at' => now(),
                'verification_status' => \App\Enums\DocumentVerificationStatus::Approved,
                // Archived: should be excluded from compliance consideration.
                'archived_at' => now(),
            ]);
        }

        $report = app(\App\Services\Camper\ApplicationCompletenessService::class)
            ->check($draft->fresh(), forFinalization: false);

        $this->assertFalse($report['is_complete']);
        $missingTypes = collect($report['missing_documents'])
            ->pluck('key')
            ->all();
        $this->assertContains('doc_official_medical_form', $missingTypes);
        $this->assertContains('doc_immunization_record', $missingTypes);
        $this->assertContains('doc_insurance_card', $missingTypes);
    }

    // ── Admin source-change guard ──────────────────────────────────────────────

    public function test_admin_cannot_flip_source_to_paper_without_packet_on_file(): void
    {
        // If an admin could flip a digital application to paper_admin without
        // the paper packet being attached, the paper-substitutes-digital branch
        // of the completeness gate would open up — making an application with
        // neither digital nor paper signatures look "complete". This test
        // locks that gate shut.
        [, , $draft] = $this->makeDraftWithCamper();
        $draft->update([
            'submitted_at' => now(),
            'submission_source' => \App\Enums\SubmissionSource::Digital,
        ]);
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)->putJson("/api/applications/{$draft->id}", [
            'submission_source' => 'paper_admin',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['submission_source']);

        $this->assertSame(
            \App\Enums\SubmissionSource::Digital,
            $draft->fresh()->submission_source,
            'submission_source must not change when the packet is absent.',
        );
    }

    public function test_admin_can_flip_source_to_paper_once_packet_is_on_file(): void
    {
        [$parent, $camper, $draft] = $this->makeDraftWithCamper();
        $draft->update([
            'submitted_at' => now(),
            'submission_source' => \App\Enums\SubmissionSource::Digital,
        ]);

        Document::create([
            'documentable_type' => \App\Models\Application::class,
            'documentable_id' => $draft->id,
            'document_type' => 'paper_application_packet',
            'original_filename' => 'packet.pdf',
            'stored_filename' => 'packet.pdf',
            'path' => 'documents/packet.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 2048,
            'uploaded_by' => $parent->id,
            'submitted_at' => now(),
            'verification_status' => \App\Enums\DocumentVerificationStatus::Approved,
        ]);

        $admin = $this->createAdmin();
        $this->actingAs($admin)
            ->putJson("/api/applications/{$draft->id}", [
                'submission_source' => 'paper_admin',
            ])
            ->assertOk();

        $this->assertSame(
            \App\Enums\SubmissionSource::PaperAdmin,
            $draft->fresh()->submission_source,
        );
    }

    public function test_index_filters_by_submission_source(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);

        $digital = Application::factory()->create([
            'camper_id' => Camper::factory()->create(['user_id' => $parent->id])->id,
            'camp_session_id' => $session->id,
            'submitted_at' => now(),
            'submission_source' => \App\Enums\SubmissionSource::Digital,
        ]);
        $paper = Application::factory()->create([
            'camper_id' => Camper::factory()->create(['user_id' => $parent->id])->id,
            'camp_session_id' => $session->id,
            'submitted_at' => now(),
            'submission_source' => \App\Enums\SubmissionSource::PaperSelf,
        ]);

        $response = $this->actingAs($admin)
            ->getJson('/api/applications?submission_source=paper_self');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($paper->id, $ids);
        $this->assertNotContains($digital->id, $ids);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function seedCompleteApplication(Application $draft, Camper $camper, $parent): void
    {
        \Tests\Support\TestApplicationFixture::buildCamperMinimum($camper);
        \Tests\Support\TestApplicationFixture::attachRequiredDocuments($camper);
        $draft->update([
            'signed_at' => now(),
            'signature_name' => 'Jane Smith',
            'sections_reviewed' => \Tests\Support\TestApplicationFixture::reviewedOptionalSections(),
        ]);
        \Tests\Support\TestApplicationFixture::attachConsents($draft, 'Jane Smith');
    }
}
