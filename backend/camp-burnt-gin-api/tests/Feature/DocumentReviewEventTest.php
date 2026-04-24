<?php

namespace Tests\Feature;

use App\Enums\DocumentRequestStatus;
use App\Enums\DocumentReviewAction;
use App\Enums\DocumentVerificationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\Document;
use App\Models\DocumentRequest;
use App\Models\DocumentReviewEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * DocumentReviewEventTest — verifies the new review event model and
 * Document / DocumentRequest model additions from Increment 1.
 *
 * Coverage:
 *  - Document.document_request_id FK can be set and retrieved
 *  - Document.approved_by / rejected_by are persisted correctly
 *  - DocumentRequest.documents() and latestDocument() return correct rows
 *  - DocumentRequest.markRejectedAndReopen() flips status back to awaiting_upload (D4)
 *  - DocumentRequest.markApproved() sets terminal state
 *  - DocumentReviewEvent factory helpers create correct shapes
 *  - Review events are append-only (no updated_at column)
 */
class DocumentReviewEventTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected User $admin;
    protected User $applicant;
    protected Camper $camper;
    protected Application $application;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->setUpRoles();

        $this->admin = $this->createAdmin();
        $this->applicant = $this->createParent();
        $this->camper = Camper::factory()->for($this->applicant)->create();
        $this->application = Application::factory()
            ->for($this->camper)
            ->create();
    }

    // ── Document model — new columns ──────────────────────────────────────────

    public function test_document_request_id_fk_can_be_set(): void
    {
        $request = DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'camper_id' => $this->camper->id,
            'document_type' => 'immunization_record',
            'status' => DocumentRequestStatus::AwaitingUpload,
        ]);

        $doc = Document::factory()->create([
            'documentable_type' => Application::class,
            'documentable_id' => $this->application->id,
            'uploaded_by' => $this->applicant->id,
            'document_request_id' => $request->id,
        ]);

        $this->assertEquals($request->id, $doc->fresh()->document_request_id);
        $this->assertTrue($doc->documentRequest->is($request));
    }

    public function test_document_approved_by_fields_are_persisted(): void
    {
        $doc = Document::factory()->create([
            'documentable_type' => Application::class,
            'documentable_id' => $this->application->id,
            'uploaded_by' => $this->applicant->id,
        ]);

        $doc->update([
            'approved_by' => $this->admin->id,
            'approved_at' => now(),
            'verification_status' => DocumentVerificationStatus::Approved,
        ]);

        $fresh = $doc->fresh();
        $this->assertEquals($this->admin->id, $fresh->approved_by);
        $this->assertNotNull($fresh->approved_at);
    }

    public function test_document_rejected_by_fields_are_persisted(): void
    {
        $doc = Document::factory()->create([
            'documentable_type' => Application::class,
            'documentable_id' => $this->application->id,
            'uploaded_by' => $this->applicant->id,
        ]);

        $doc->update([
            'rejected_by' => $this->admin->id,
            'rejected_at' => now(),
            'rejection_reason' => 'Document is blurry.',
            'verification_status' => DocumentVerificationStatus::Rejected,
        ]);

        $fresh = $doc->fresh();
        $this->assertEquals($this->admin->id, $fresh->rejected_by);
        $this->assertNotNull($fresh->rejected_at);
        $this->assertEquals('Document is blurry.', $fresh->rejection_reason);
    }

    // ── DocumentRequest — new relationships and lifecycle helpers ─────────────

    public function test_document_request_documents_relationship_returns_linked_docs(): void
    {
        $request = DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'camper_id' => $this->camper->id,
            'document_type' => 'immunization_record',
        ]);

        Document::factory()->count(2)->create([
            'documentable_type' => Application::class,
            'documentable_id' => $this->application->id,
            'uploaded_by' => $this->applicant->id,
            'document_request_id' => $request->id,
        ]);

        $this->assertCount(2, $request->documents);
    }

    public function test_latest_document_returns_most_recent_linked_doc(): void
    {
        $request = DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'camper_id' => $this->camper->id,
            'document_type' => 'immunization_record',
        ]);

        $first = Document::factory()->create([
            'documentable_type' => Application::class,
            'documentable_id' => $this->application->id,
            'uploaded_by' => $this->applicant->id,
            'document_request_id' => $request->id,
            'created_at' => now()->subMinutes(5),
        ]);

        $second = Document::factory()->create([
            'documentable_type' => Application::class,
            'documentable_id' => $this->application->id,
            'uploaded_by' => $this->applicant->id,
            'document_request_id' => $request->id,
            'created_at' => now(),
        ]);

        $this->assertTrue($request->latestDocument->is($second));
    }

    public function test_mark_rejected_and_reopen_flips_status_back_to_awaiting_upload(): void
    {
        $request = DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'camper_id' => $this->camper->id,
            'status' => DocumentRequestStatus::UnderReview,
        ]);

        $request->markRejectedAndReopen('Content is illegible.', $this->admin);

        $fresh = $request->fresh();
        $this->assertEquals(DocumentRequestStatus::AwaitingUpload, $fresh->status);
        $this->assertEquals('Content is illegible.', $fresh->rejection_reason);
        $this->assertEquals($this->admin->id, $fresh->reviewed_by_admin_id);
        $this->assertNotNull($fresh->reviewed_at);
    }

    public function test_mark_approved_sets_terminal_approved_state(): void
    {
        $request = DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'camper_id' => $this->camper->id,
            'status' => DocumentRequestStatus::UnderReview,
        ]);

        $request->markApproved($this->admin);

        $fresh = $request->fresh();
        $this->assertEquals(DocumentRequestStatus::Approved, $fresh->status);
        $this->assertEquals($this->admin->id, $fresh->reviewed_by_admin_id);
        $this->assertTrue($fresh->status->isTerminal());
    }

    // ── DocumentReviewEvent — factory helpers ─────────────────────────────────

    public function test_record_sent_creates_event_with_correct_action(): void
    {
        $doc = Document::factory()->create([
            'documentable_type' => Application::class,
            'documentable_id' => $this->application->id,
            'uploaded_by' => $this->applicant->id,
        ]);

        $event = DocumentReviewEvent::recordSent($doc, $this->applicant);

        $this->assertEquals(DocumentReviewAction::Sent, $event->action);
        $this->assertEquals($doc->id, $event->document_id);
        $this->assertEquals($this->applicant->id, $event->performed_by);
    }

    public function test_record_approved_creates_event_with_performer(): void
    {
        $doc = Document::factory()->create([
            'documentable_type' => Application::class,
            'documentable_id' => $this->application->id,
            'uploaded_by' => $this->applicant->id,
        ]);

        $event = DocumentReviewEvent::recordApproved($doc, $this->admin, 'Looks good.');

        $this->assertEquals(DocumentReviewAction::Approved, $event->action);
        $this->assertEquals($this->admin->id, $event->performed_by);
        $this->assertEquals('Looks good.', $event->notes);
    }

    public function test_record_rejected_requires_reason(): void
    {
        $doc = Document::factory()->create([
            'documentable_type' => Application::class,
            'documentable_id' => $this->application->id,
            'uploaded_by' => $this->applicant->id,
        ]);

        $event = DocumentReviewEvent::recordRejected($doc, $this->admin, 'Image is too small.');

        $this->assertEquals(DocumentReviewAction::Rejected, $event->action);
        $this->assertEquals('Image is too small.', $event->reason);
        $this->assertEquals($this->admin->id, $event->performed_by);
    }

    public function test_record_overdue_has_null_performer(): void
    {
        // Overdue events fire at the request level — document may not exist yet.
        $docRequest = DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'camper_id' => $this->camper->id,
            'application_id' => $this->application->id,
            'document_type' => 'immunization_record',
            'status' => DocumentRequestStatus::Overdue,
        ]);

        $event = DocumentReviewEvent::recordOverdue($docRequest);

        $this->assertEquals(DocumentReviewAction::Overdue, $event->action);
        $this->assertNull($event->performed_by);
        $this->assertNull($event->document_id);
        $this->assertEquals($docRequest->id, $event->document_request_id);
    }

    public function test_record_overdue_with_document_links_document_id(): void
    {
        $docRequest = DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'camper_id' => $this->camper->id,
            'application_id' => $this->application->id,
            'document_type' => 'immunization_record',
            'status' => DocumentRequestStatus::Overdue,
        ]);

        $doc = Document::factory()->create([
            'documentable_type' => Application::class,
            'documentable_id' => $this->application->id,
            'uploaded_by' => $this->applicant->id,
            'document_request_id' => $docRequest->id,
        ]);

        $event = DocumentReviewEvent::recordOverdue($docRequest, $doc);

        $this->assertEquals(DocumentReviewAction::Overdue, $event->action);
        $this->assertNull($event->performed_by);
        $this->assertEquals($doc->id, $event->document_id);
    }

    public function test_record_requested_creates_event_without_document(): void
    {
        $docRequest = DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'camper_id' => $this->camper->id,
            'application_id' => $this->application->id,
            'document_type' => 'insurance_card',
            'status' => DocumentRequestStatus::AwaitingUpload,
        ]);

        $event = DocumentReviewEvent::recordRequested($docRequest, $this->admin);

        $this->assertEquals(DocumentReviewAction::Requested, $event->action);
        $this->assertEquals($this->admin->id, $event->performed_by);
        $this->assertNull($event->document_id);
        $this->assertEquals($docRequest->id, $event->document_request_id);
    }

    public function test_review_events_are_immutable_no_updated_at(): void
    {
        $doc = Document::factory()->create([
            'documentable_type' => Application::class,
            'documentable_id' => $this->application->id,
            'uploaded_by' => $this->applicant->id,
        ]);

        $event = DocumentReviewEvent::recordSent($doc, $this->applicant);

        // The model's UPDATED_AT constant is null — column should not exist in the DB row.
        $this->assertNull(DocumentReviewEvent::UPDATED_AT);
        $this->assertArrayNotHasKey('updated_at', $event->toArray());
    }

    public function test_document_review_events_relationship_returns_events_in_order(): void
    {
        $doc = Document::factory()->create([
            'documentable_type' => Application::class,
            'documentable_id' => $this->application->id,
            'uploaded_by' => $this->applicant->id,
        ]);

        DocumentReviewEvent::recordSent($doc, $this->applicant);
        DocumentReviewEvent::recordApproved($doc, $this->admin);

        $events = $doc->reviewEvents;
        $this->assertCount(2, $events);
        $this->assertEquals(DocumentReviewAction::Sent, $events->first()->action);
        $this->assertEquals(DocumentReviewAction::Approved, $events->last()->action);
    }
}
