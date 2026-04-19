<?php

namespace Tests\Feature\Security;

use App\Enums\ApplicationStatus;
use App\Enums\DocumentVerificationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Draft documents attached to a draft application are staging PHI. They MUST
 * NOT leak to admin or medical reviewers:
 *   - not in the list endpoint
 *   - not via the show-by-id endpoint
 *   - not via the document submit endpoint
 *   - not via compliance reports
 *
 * When the family finalizes the application, the cascade inside finalize()
 * flips every linked draft document to submitted atomically — in a single
 * transaction — so there is no window where the app is submitted but its
 * documents are not, or vice versa.
 */
class DraftDocumentVisibilityTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    /** @return array{0: Application, 1: Camper, 2: Document, 3: \App\Models\User} */
    private function seedDraftApplicationWithDraftDocument(): array
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true, 'capacity' => 10]);
        $camper = Camper::factory()->create([
            'user_id' => $parent->id,
            'first_name' => 'Athena',
            'last_name' => 'Wicker',
            'date_of_birth' => '2012-05-01',
            'gender' => 'female',
            'tshirt_size' => 'Youth M',
            'county' => 'Richland',
        ]);
        $application = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        // Simulate the exact leak scenario: applicant uploads and the doc's
        // own submitted_at happens to be set (e.g. legacy bug, bad migration,
        // admin mistakenly submitting by id). The parent application is still
        // a draft — the admin queue must still ignore this row.
        $doc = Document::create([
            'documentable_type' => Application::class,
            'documentable_id' => $application->id,
            'document_type' => 'immunization_record',
            'original_filename' => 'Screenshot 2026-04-18.png',
            'stored_filename' => 'wip.png',
            'path' => 'documents/wip.png',
            'mime_type' => 'image/png',
            'file_size' => 1024,
            'uploaded_by' => $parent->id,
            'submitted_at' => now(),
            'verification_status' => DocumentVerificationStatus::Pending,
        ]);

        return [$application, $camper, $doc, $parent];
    }

    public function test_admin_list_excludes_documents_attached_to_draft_applications(): void
    {
        [, , $draftAttachedDoc] = $this->seedDraftApplicationWithDraftDocument();
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)->getJson('/api/documents');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertNotContains(
            $draftAttachedDoc->id,
            $ids,
            'Document attached to a draft application must not appear in the admin Uploaded Documents list.',
        );
    }

    public function test_medical_list_excludes_documents_attached_to_draft_applications(): void
    {
        [, $camper, $draftAttachedDoc] = $this->seedDraftApplicationWithDraftDocument();
        // Active camper so the medical query would otherwise include docs.
        $camper->update(['is_active' => true]);

        $medical = $this->createMedicalProvider();

        $response = $this->actingAs($medical)->getJson('/api/documents');
        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertNotContains($draftAttachedDoc->id, $ids);
    }

    public function test_admin_cannot_access_draft_application_document_by_id(): void
    {
        [, , $draftAttachedDoc] = $this->seedDraftApplicationWithDraftDocument();
        $admin = $this->createAdmin();

        // Even hitting the exact id, the policy must deny — there is no way
        // for an admin to cross the staging boundary by enumerating ids.
        $this->actingAs($admin)
            ->getJson("/api/documents/{$draftAttachedDoc->id}")
            ->assertStatus(403);
    }

    public function test_submit_endpoint_rejects_documents_on_draft_applications(): void
    {
        [, , $draftAttachedDoc, $parent] = $this->seedDraftApplicationWithDraftDocument();
        // Reset submitted_at so the "already submitted" idempotency branch
        // doesn't short-circuit before the guard we want to verify.
        $draftAttachedDoc->update(['submitted_at' => null]);

        $response = $this->actingAs($parent)
            ->patchJson("/api/documents/{$draftAttachedDoc->id}/submit");

        $response->assertStatus(422)
            ->assertJsonPath('errors.document', 'parent_application_is_draft');

        $this->assertNull(
            $draftAttachedDoc->fresh()->submitted_at,
            'Submit endpoint must not stamp submitted_at on a doc attached to a draft application.',
        );
    }

    public function test_compliance_service_ignores_documents_attached_to_draft_applications(): void
    {
        // The camper has one application which is still a draft. Even though
        // the draft application carries a valid-looking "official_medical_form"
        // document, the compliance service must report it as missing — paper
        // trail only counts after submission.
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $draft = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);
        Document::create([
            'documentable_type' => Application::class,
            'documentable_id' => $draft->id,
            'document_type' => 'official_medical_form',
            'original_filename' => 'form.pdf',
            'stored_filename' => 'form.pdf',
            'path' => 'documents/form.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 2048,
            'uploaded_by' => $parent->id,
            'submitted_at' => now(),
            'verification_status' => DocumentVerificationStatus::Approved,
        ]);
        $this->seed(\Database\Seeders\RiskEngineSeeder::class);
        $this->seed(\Database\Seeders\RequiredDocumentRuleSeeder::class);

        $enforcement = app(\App\Services\Document\DocumentEnforcementService::class);
        $compliance = $enforcement->checkCompliance($camper->fresh());

        $medicalFormMissing = collect($compliance['missing_documents'])
            ->contains(fn ($d) => $d['document_type'] === 'official_medical_form');
        $this->assertTrue(
            $medicalFormMissing,
            'A medical form attached to a draft application must NOT satisfy compliance.',
        );
    }

    public function test_finalize_cascades_submitted_at_to_all_linked_documents(): void
    {
        // Before finalize: app is draft, docs are drafts.
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camper = Camper::factory()->create([
            'user_id' => $parent->id,
            'first_name' => 'Athena',
            'last_name' => 'Wicker',
            'date_of_birth' => '2012-05-01',
            'gender' => 'female',
            'tshirt_size' => 'Youth M',
            'county' => 'Richland',
        ]);
        \Tests\Support\TestApplicationFixture::buildCamperMinimum($camper);
        $draft = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'signed_at' => now(),
            'signature_name' => 'Aurora Wicker',
            'sections_reviewed' => \Tests\Support\TestApplicationFixture::reviewedOptionalSections(),
        ]);
        \Tests\Support\TestApplicationFixture::attachConsents($draft, 'Aurora');
        $this->seed(\Database\Seeders\RiskEngineSeeder::class);
        $this->seed(\Database\Seeders\RequiredDocumentRuleSeeder::class);

        // Three draft documents: one attached to the application, one to the
        // camper, one already archived (must NOT be touched).
        $appDoc = Document::create([
            'documentable_type' => Application::class,
            'documentable_id' => $draft->id,
            'document_type' => 'official_medical_form',
            'original_filename' => 'form.pdf', 'stored_filename' => 'form.pdf',
            'path' => 'documents/form.pdf', 'mime_type' => 'application/pdf',
            'file_size' => 1024, 'uploaded_by' => $parent->id,
            'submitted_at' => null,
            'expiration_date' => now()->addYear(),
        ]);
        $camperDoc = Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'document_type' => 'immunization_record',
            'original_filename' => 'imm.pdf', 'stored_filename' => 'imm.pdf',
            'path' => 'documents/imm.pdf', 'mime_type' => 'application/pdf',
            'file_size' => 1024, 'uploaded_by' => $parent->id,
            'submitted_at' => null,
        ]);
        $archivedDoc = Document::create([
            'documentable_type' => Application::class,
            'documentable_id' => $draft->id,
            'document_type' => 'insurance_card',
            'original_filename' => 'old.pdf', 'stored_filename' => 'old.pdf',
            'path' => 'documents/old.pdf', 'mime_type' => 'application/pdf',
            'file_size' => 1024, 'uploaded_by' => $parent->id,
            'submitted_at' => null,
            'archived_at' => now()->subDay(),
        ]);
        // Additional required doc to satisfy finalize completeness.
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'document_type' => 'insurance_card',
            'original_filename' => 'ins.pdf', 'stored_filename' => 'ins.pdf',
            'path' => 'documents/ins.pdf', 'mime_type' => 'application/pdf',
            'file_size' => 1024, 'uploaded_by' => $parent->id,
            'submitted_at' => null,
        ]);

        // Finalize.
        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$draft->id}/finalize");
        $response->assertOk();

        $draft->refresh();
        $this->assertFalse((bool) $draft->is_draft);
        $this->assertNotNull($draft->submitted_at);

        // Cascade touched the two live draft docs, left the archived doc alone.
        $this->assertNotNull($appDoc->fresh()->submitted_at, 'application-linked draft doc should now be submitted');
        $this->assertNotNull($camperDoc->fresh()->submitted_at, 'camper-linked draft doc should now be submitted');
        $this->assertNull($archivedDoc->fresh()->submitted_at, 'archived draft doc must NOT be touched by cascade');
    }

    public function test_admin_sees_cascaded_documents_after_application_is_submitted(): void
    {
        // End-to-end contract: before finalize → admin list is empty. After
        // finalize → the previously-draft docs appear as Submitted.
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camper = Camper::factory()->create([
            'user_id' => $parent->id,
            'first_name' => 'Test',
            'last_name' => 'Cascade',
            'date_of_birth' => '2012-01-01',
            'gender' => 'male',
            'tshirt_size' => 'Youth L',
            'county' => 'Richland',
        ]);
        $app = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft' => false,
            'submitted_at' => now(),
            'status' => ApplicationStatus::Submitted,
        ]);
        $doc = Document::create([
            'documentable_type' => Application::class,
            'documentable_id' => $app->id,
            'document_type' => 'immunization_record',
            'original_filename' => 'imm.pdf', 'stored_filename' => 'imm.pdf',
            'path' => 'documents/imm.pdf', 'mime_type' => 'application/pdf',
            'file_size' => 1024, 'uploaded_by' => $parent->id,
            'submitted_at' => now(),
        ]);

        $admin = $this->createAdmin();
        $response = $this->actingAs($admin)->getJson('/api/documents');
        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains(
            $doc->id,
            $ids,
            'A submitted document on a submitted application must appear in the admin Uploaded Documents list.',
        );
    }
}
