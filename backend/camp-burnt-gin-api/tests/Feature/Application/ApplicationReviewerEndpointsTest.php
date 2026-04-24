<?php

namespace Tests\Feature\Application;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Document;
use App\Models\DocumentRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * ApplicationReviewerEndpointsTest — covers the three endpoints added to
 * support the reviewer workspace:
 *
 *   GET  /api/applications/{id}/documents
 *   GET  /api/applications/{id}/document-requests
 *   POST /api/applications/{id}/start-review
 *
 * These exist so the admin review page can show live document state and
 * a soft-claim review indicator without leaving the workspace. All three
 * are admin-only; applicants must never see them.
 */
class ApplicationReviewerEndpointsTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected User $admin;
    protected User $otherAdmin;
    protected User $applicant;
    protected Application $application;
    protected Camper $camper;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();

        $this->admin = $this->createAdmin();
        $this->otherAdmin = $this->createAdmin();
        $this->applicant = $this->createParent();

        $this->camper = Camper::factory()->for($this->applicant)->create();
        $session = CampSession::factory()->create();
        $this->application = Application::factory()->create([
            'camper_id' => $this->camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => now(),
        ]);
    }

    // ── /documents endpoint ───────────────────────────────────────────────────

    public function test_admin_can_list_application_documents(): void
    {
        Sanctum::actingAs($this->admin);

        // A document directly attached to the Application
        $appDoc = Document::factory()->create([
            'documentable_type' => 'App\\Models\\Application',
            'documentable_id' => $this->application->id,
            'uploaded_by' => $this->applicant->id,
            'document_type' => 'paper_application_packet',
            'submitted_at' => now(),
        ]);

        $response = $this->getJson("/api/applications/{$this->application->id}/documents");

        $response->assertOk()
            ->assertJsonPath('meta.application_id', $this->application->id)
            ->assertJsonPath('meta.count', 1)
            ->assertJsonFragment(['id' => $appDoc->id, 'document_type' => 'paper_application_packet']);
    }

    public function test_documents_endpoint_includes_camper_scoped_uploads(): void
    {
        // Critical reviewer-workstation behaviour: applicant-uploaded
        // documents attached to the Camper (e.g. an Immunization Record
        // uploaded via the applicant Documents page with no DocumentRequest
        // linkage) MUST appear in the review workstation. Before this guard
        // was in place, the panel rendered "No documents or requests" even
        // when the file was sitting on the camper.
        Sanctum::actingAs($this->admin);

        $doc = Document::factory()->create([
            'documentable_type' => 'App\\Models\\Camper',
            'documentable_id' => $this->camper->id,
            'uploaded_by' => $this->applicant->id,
            'document_type' => 'immunization_record',
            'submitted_at' => now(),
        ]);

        $response = $this->getJson("/api/applications/{$this->application->id}/documents");
        $response->assertOk()
            ->assertJsonPath('meta.count', 1)
            ->assertJsonFragment(['id' => $doc->id, 'document_type' => 'immunization_record']);
    }

    public function test_documents_endpoint_excludes_archived(): void
    {
        Sanctum::actingAs($this->admin);

        Document::factory()->create([
            'documentable_type' => 'App\\Models\\Application',
            'documentable_id' => $this->application->id,
            'uploaded_by' => $this->applicant->id,
            'archived_at' => now(),
            'submitted_at' => now(),
        ]);

        $response = $this->getJson("/api/applications/{$this->application->id}/documents");
        $response->assertOk()->assertJsonPath('meta.count', 0);
    }

    public function test_documents_endpoint_excludes_drafts(): void
    {
        Sanctum::actingAs($this->admin);

        // Drafts (submitted_at NULL) are the uploader's private staging area
        // and must never leak into the admin review surface even if they're
        // camper-scoped.
        Document::factory()->create([
            'documentable_type' => 'App\\Models\\Camper',
            'documentable_id' => $this->camper->id,
            'uploaded_by' => $this->applicant->id,
            'submitted_at' => null,
        ]);

        $response = $this->getJson("/api/applications/{$this->application->id}/documents");
        $response->assertOk()->assertJsonPath('meta.count', 0);
    }

    public function test_documents_endpoint_does_not_leak_across_campers(): void
    {
        // A sibling's upload must never appear in this application's view.
        // Multi-camper safety is already enforced at the query layer via
        // documentable_id = application->camper_id; this test pins it.
        Sanctum::actingAs($this->admin);

        $siblingCamper = Camper::factory()->for($this->applicant)->create();
        Document::factory()->create([
            'documentable_type' => 'App\\Models\\Camper',
            'documentable_id' => $siblingCamper->id,
            'uploaded_by' => $this->applicant->id,
            'submitted_at' => now(),
        ]);

        $response = $this->getJson("/api/applications/{$this->application->id}/documents");
        $response->assertOk()->assertJsonPath('meta.count', 0);
    }

    public function test_applicant_cannot_access_application_documents_endpoint(): void
    {
        Sanctum::actingAs($this->applicant);

        $response = $this->getJson("/api/applications/{$this->application->id}/documents");
        $response->assertForbidden();
    }

    // ── /document-requests endpoint ───────────────────────────────────────────

    public function test_admin_can_list_application_document_requests(): void
    {
        Sanctum::actingAs($this->admin);

        $docRequest = DocumentRequest::factory()->create([
            'application_id' => $this->application->id,
            'camper_id' => $this->camper->id,
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Immunization Record',
        ]);

        $response = $this->getJson("/api/applications/{$this->application->id}/document-requests");

        $response->assertOk()
            ->assertJsonPath('meta.count', 1)
            ->assertJsonFragment(['id' => $docRequest->id, 'document_type' => 'Immunization Record']);
    }

    public function test_document_requests_endpoint_scoped_to_application(): void
    {
        Sanctum::actingAs($this->admin);

        $otherApp = Application::factory()->create([
            'camper_id' => $this->camper->id,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => now(),
        ]);

        DocumentRequest::factory()->create([
            'application_id' => $otherApp->id,
            'camper_id' => $this->camper->id,
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
        ]);

        $response = $this->getJson("/api/applications/{$this->application->id}/document-requests");
        $response->assertOk()->assertJsonPath('meta.count', 0);
    }

    public function test_applicant_cannot_access_document_requests_endpoint(): void
    {
        Sanctum::actingAs($this->applicant);

        $response = $this->getJson("/api/applications/{$this->application->id}/document-requests");
        $response->assertForbidden();
    }

    // ── /start-review endpoint ────────────────────────────────────────────────

    public function test_admin_can_start_review_and_transitions_to_under_review(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson("/api/applications/{$this->application->id}/start-review");

        $response->assertOk();

        $this->application->refresh();
        $this->assertSame($this->admin->id, $this->application->review_started_by);
        $this->assertNotNull($this->application->review_started_at);
        $this->assertSame(ApplicationStatus::UnderReview, $this->application->status);
    }

    public function test_start_review_is_a_soft_claim_and_can_be_overridden(): void
    {
        // First admin claims
        Sanctum::actingAs($this->admin);
        $this->postJson("/api/applications/{$this->application->id}/start-review")->assertOk();

        $this->application->refresh();
        $firstClaimAt = $this->application->review_started_at;
        $this->assertSame($this->admin->id, $this->application->review_started_by);

        // Second admin overrides — soft-claim semantics, no lock
        Sanctum::actingAs($this->otherAdmin);
        $response = $this->postJson("/api/applications/{$this->application->id}/start-review");
        $response->assertOk();

        $this->application->refresh();
        $this->assertSame($this->otherAdmin->id, $this->application->review_started_by);
        $this->assertTrue($this->application->review_started_at->greaterThanOrEqualTo($firstClaimAt));
    }

    public function test_start_review_rejects_draft_applications(): void
    {
        $this->application->update(['status' => ApplicationStatus::Draft, 'submitted_at' => null]);

        Sanctum::actingAs($this->admin);
        $response = $this->postJson("/api/applications/{$this->application->id}/start-review");

        // ApplicationPolicy::review() denies drafts at the authorization layer,
        // so we get 403 rather than the controller's 422 — either is a valid
        // rejection. Accept both, pinning the fact that drafts are not
        // review-startable.
        $this->assertContains($response->status(), [403, 422]);

        $this->application->refresh();
        $this->assertNull($this->application->review_started_by);
    }

    public function test_applicant_cannot_start_review(): void
    {
        Sanctum::actingAs($this->applicant);

        $response = $this->postJson("/api/applications/{$this->application->id}/start-review");
        $response->assertForbidden();
    }
}
