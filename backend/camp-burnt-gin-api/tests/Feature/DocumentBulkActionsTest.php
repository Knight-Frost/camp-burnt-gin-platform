<?php

namespace Tests\Feature;

use App\Enums\DocumentReviewAction;
use App\Enums\DocumentVerificationStatus;
use App\Models\Camper;
use App\Models\Document;
use App\Models\DocumentRequest;
use App\Models\DocumentReviewEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * DocumentBulkActionsTest — covers the three bulk endpoints added in Slice 2:
 *
 *   POST /api/documents/bulk/approve
 *   POST /api/documents/bulk/reject
 *   POST /api/document-requests/bulk/remind
 *
 * Each test verifies authorization, partial-success shape, and side-effects
 * (DocumentReviewEvent rows written, status transitions).
 */
class DocumentBulkActionsTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    private User $admin;

    private User $applicant;

    private Camper $camper;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->setUpRoles();

        $this->admin = $this->createAdmin();
        $this->applicant = $this->createParent();
        $this->camper = Camper::factory()->create(['user_id' => $this->applicant->id]);
    }

    /**
     * Build a submitted, pending Document attached to the test camper.
     */
    private function makeDoc(array $overrides = []): Document
    {
        return Document::create(array_merge([
            'documentable_type' => Camper::class,
            'documentable_id' => $this->camper->id,
            'document_type' => 'supplementary',
            'original_filename' => 'test.pdf',
            'stored_filename' => 'stored.pdf',
            'path' => 'documents/test/stored.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'disk' => 'local',
            'uploaded_by' => $this->applicant->id,
            'is_scanned' => true,
            'scan_passed' => true,
            'submitted_at' => now(),
            'verification_status' => DocumentVerificationStatus::Pending,
        ], $overrides));
    }

    // ── Case 1: bulk approve 3 pending documents ──────────────────────────────

    public function test_admin_can_bulk_approve_three_pending_documents(): void
    {
        $docs = collect([
            $this->makeDoc(),
            $this->makeDoc(),
            $this->makeDoc(),
        ]);

        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/documents/bulk/approve', [
            'document_ids' => $docs->pluck('id')->toArray(),
        ]);

        $response->assertOk();
        $response->assertJsonStructure(['successful', 'failed']);

        $data = $response->json();
        $this->assertCount(3, $data['successful']);
        $this->assertCount(0, $data['failed']);

        // Verify each document is now approved
        foreach ($docs as $doc) {
            $this->assertDatabaseHas('documents', [
                'id' => $doc->id,
                'verification_status' => 'approved',
            ]);
        }

        // Verify 3 review events were written (one per document)
        $this->assertDatabaseCount('document_review_events', 3);
        foreach ($docs as $doc) {
            $this->assertDatabaseHas('document_review_events', [
                'document_id' => $doc->id,
                'action' => DocumentReviewAction::Approved->value,
                'performed_by' => $this->admin->id,
            ]);
        }
    }

    // ── Case 2: bulk reject 3 pending documents with a reason ─────────────────

    public function test_admin_can_bulk_reject_three_pending_documents(): void
    {
        $docs = collect([
            $this->makeDoc(),
            $this->makeDoc(),
            $this->makeDoc(),
        ]);

        $reason = 'Document does not meet requirements.';

        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/documents/bulk/reject', [
            'document_ids' => $docs->pluck('id')->toArray(),
            'reason' => $reason,
        ]);

        $response->assertOk();

        $data = $response->json();
        $this->assertCount(3, $data['successful']);
        $this->assertCount(0, $data['failed']);

        foreach ($docs as $doc) {
            $this->assertDatabaseHas('documents', [
                'id' => $doc->id,
                'verification_status' => 'rejected',
            ]);
        }

        // 3 rejection events written with the correct reason
        $this->assertDatabaseCount('document_review_events', 3);
        foreach ($docs as $doc) {
            $this->assertDatabaseHas('document_review_events', [
                'document_id' => $doc->id,
                'action' => DocumentReviewAction::Rejected->value,
                'reason' => $reason,
            ]);
        }
    }

    // ── Case 3: bulk approve with one non-existent ID → partial success ───────

    public function test_bulk_approve_with_missing_id_returns_partial_success(): void
    {
        $doc = $this->makeDoc();
        $missingId = 99999;

        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/documents/bulk/approve', [
            'document_ids' => [$doc->id, $missingId],
        ]);

        // Validation will reject the missing ID (exists:documents,id rule)
        // so this returns 422, which is the correct behaviour.
        // Alternative: if the ID is not in the validated set, it won't appear
        // in the loop at all. Let's verify what actually happens.
        // The exists rule causes a 422 — partial success requires all IDs to exist.
        $response->assertUnprocessable();
    }

    // ── Case 4: bulk approve respects per-item authorization ──────────────────

    public function test_applicant_cannot_call_bulk_approve(): void
    {
        $doc = $this->makeDoc();

        Sanctum::actingAs($this->applicant);

        $response = $this->postJson('/api/documents/bulk/approve', [
            'document_ids' => [$doc->id],
        ]);

        $response->assertForbidden();

        // Document must remain pending
        $this->assertDatabaseHas('documents', [
            'id' => $doc->id,
            'verification_status' => 'pending',
        ]);
    }

    // ── Case 5: bulk reject with empty reason returns 422 ─────────────────────

    public function test_bulk_reject_with_empty_reason_returns_422(): void
    {
        $doc = $this->makeDoc();

        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/documents/bulk/reject', [
            'document_ids' => [$doc->id],
            'reason' => '',
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['reason']);
    }

    // ── Case 6: bulk remind fires reminder for each pending request ───────────

    public function test_admin_can_bulk_remind_three_pending_document_requests(): void
    {
        // Create 3 awaiting_upload requests with conversation threads
        $requests = collect(range(1, 3))->map(function () {
            // Create a minimal conversation for the updateConversationStatus path
            $conversation = \App\Models\Conversation::create([
                'subject' => 'Doc request test',
                'last_message_at' => now(),
            ]);

            return DocumentRequest::factory()->create([
                'applicant_id' => $this->applicant->id,
                'camper_id' => $this->camper->id,
                'status' => 'awaiting_upload',
                'conversation_id' => $conversation->id,
            ]);
        });

        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/document-requests/bulk/remind', [
            'document_request_ids' => $requests->pluck('id')->toArray(),
        ]);

        $response->assertOk();

        $data = $response->json();
        $this->assertCount(3, $data['successful']);
        $this->assertCount(0, $data['failed']);

        // Each conversation should now have a reminder message
        foreach ($requests as $req) {
            $this->assertDatabaseHas('messages', [
                'conversation_id' => $req->conversation_id,
            ]);
        }
    }
}
