<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Camper;
use App\Models\Document;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Phase 1 invariant: applicants can never destroy a system-of-record document.
 *
 * Before this pass the applicant "Delete" button on the Documents page cascaded
 * into the admin queue — a submitted insurance card disappeared on a single
 * click by the uploader. The fix splits the intent into two outcomes that live
 * behind the same endpoint:
 *
 *   pristine draft + uploader  → force-delete (row + physical file)
 *   system record  + uploader  → hide from the applicant's own list only
 *   anything       + admin     → force-delete
 *
 * These tests lock in the split. If any of them starts passing in the wrong
 * branch, the regression is that applicants have regained the ability to
 * destroy compliance records.
 */
class DocumentHideVsDeleteTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    private User $admin;

    private User $applicant;

    private Camper $camper;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();

        $this->admin = $this->createAdmin();
        $this->applicant = $this->createParent();
        $this->camper = Camper::factory()->create([
            'user_id' => $this->applicant->id,
        ]);
    }

    /**
     * Build a Document row directly. Avoids going through DocumentService so
     * tests can set exact lifecycle state (submitted, attached, archived)
     * without tripping the upload flow's validations.
     */
    private function makeDoc(array $overrides = []): Document
    {
        return Document::create(array_merge([
            'documentable_type' => Camper::class,
            'documentable_id' => $this->camper->id,
            'document_type' => 'supplementary',
            'original_filename' => 'proof.pdf',
            'stored_filename' => 'stored.pdf',
            'path' => 'documents/test/stored.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'disk' => 'local',
            'uploaded_by' => $this->applicant->id,
            'is_scanned' => true,
            'scan_passed' => true,
        ], $overrides));
    }

    // ── Applicant force-delete: pristine drafts only ────────────────────────

    public function test_applicant_force_deletes_own_pristine_draft(): void
    {
        $draft = $this->makeDoc(['submitted_at' => null]);

        Sanctum::actingAs($this->applicant);
        $this->deleteJson("/api/documents/{$draft->id}")->assertOk();

        // Pristine drafts ARE destroyed, not hidden.
        $this->assertDatabaseMissing('documents', ['id' => $draft->id]);
    }

    public function test_applicant_cannot_force_delete_submitted_document(): void
    {
        $submitted = $this->makeDoc(['submitted_at' => now()]);

        Sanctum::actingAs($this->applicant);
        $this->deleteJson("/api/documents/{$submitted->id}")->assertOk();

        // Row stays. Only the visibility flag flips.
        $this->assertDatabaseHas('documents', [
            'id' => $submitted->id,
            'deleted_at' => null,
        ]);
        $this->assertNotNull($submitted->fresh()->applicant_hidden_at);
    }

    public function test_applicant_cannot_force_delete_message_attached_document(): void
    {
        // Create a real message so the FK on documents.message_id is satisfied.
        // The scenario mirrors production: the applicant attached this document
        // to a message they sent, so "Delete" must not blow away the attachment.
        $message = \App\Models\Message::factory()
            ->sentBy($this->applicant)
            ->create();

        $attached = $this->makeDoc([
            'submitted_at' => null,
            'message_id' => $message->id,
        ]);

        Sanctum::actingAs($this->applicant);
        $this->deleteJson("/api/documents/{$attached->id}")->assertOk();

        $this->assertDatabaseHas('documents', [
            'id' => $attached->id,
            'deleted_at' => null,
        ]);
        $this->assertNotNull($attached->fresh()->applicant_hidden_at);
    }

    public function test_applicant_cannot_force_delete_archived_document(): void
    {
        $archived = $this->makeDoc([
            'submitted_at' => null,
            'archived_at' => now(),
        ]);

        Sanctum::actingAs($this->applicant);
        $this->deleteJson("/api/documents/{$archived->id}")->assertOk();

        $this->assertDatabaseHas('documents', [
            'id' => $archived->id,
            'deleted_at' => null,
        ]);
        $this->assertNotNull($archived->fresh()->applicant_hidden_at);
    }

    // ── Applicant hide: visibility without destruction ──────────────────────

    public function test_applicant_hide_preserves_admin_visibility(): void
    {
        $submitted = $this->makeDoc(['submitted_at' => now()]);

        Sanctum::actingAs($this->applicant);
        $this->deleteJson("/api/documents/{$submitted->id}")->assertOk();

        // Admin still sees the row. applicant_hidden_at is surfaced so the
        // admin UI can render the "Hidden by applicant" badge.
        Sanctum::actingAs($this->admin);
        $response = $this->getJson('/api/documents')->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($submitted->id, $ids);

        $row = collect($response->json('data'))->firstWhere('id', $submitted->id);
        $this->assertNotNull($row['applicant_hidden_at'] ?? null);
    }

    public function test_applicant_hide_removes_from_applicant_list(): void
    {
        $submitted = $this->makeDoc(['submitted_at' => now()]);

        Sanctum::actingAs($this->applicant);
        $this->deleteJson("/api/documents/{$submitted->id}")->assertOk();

        // The hidden row must not come back in the applicant's own index.
        $response = $this->getJson('/api/documents')->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertNotContains($submitted->id, $ids);
    }

    public function test_applicant_hide_is_idempotent(): void
    {
        $submitted = $this->makeDoc([
            'submitted_at' => now()->subHour(),
            'applicant_hidden_at' => now()->subMinutes(10),
        ]);
        $originalHidden = $submitted->applicant_hidden_at;

        Sanctum::actingAs($this->applicant);
        $this->deleteJson("/api/documents/{$submitted->id}")->assertOk();

        // applicant_hidden_at must not be bumped forward on a second click —
        // the first hide is the source of truth for the audit trail.
        $this->assertEquals(
            $originalHidden->toIso8601String(),
            $submitted->fresh()->applicant_hidden_at->toIso8601String(),
        );
    }

    public function test_non_uploader_applicant_cannot_hide_others_documents(): void
    {
        $other = $this->createParent();
        $otherCamper = Camper::factory()->create(['user_id' => $other->id]);

        $doc = $this->makeDoc([
            'documentable_id' => $otherCamper->id,
            'uploaded_by' => $other->id,
            'submitted_at' => now(),
        ]);

        Sanctum::actingAs($this->applicant);
        // The other applicant isn't authorized to view or mutate this row.
        $this->deleteJson("/api/documents/{$doc->id}")->assertForbidden();

        // Nothing changed.
        $this->assertNull($doc->fresh()->applicant_hidden_at);
    }

    // ── Admin: always force-deletes ─────────────────────────────────────────

    public function test_admin_force_deletes_submitted_document(): void
    {
        $submitted = $this->makeDoc(['submitted_at' => now()]);

        Sanctum::actingAs($this->admin);
        $this->deleteJson("/api/documents/{$submitted->id}")->assertOk();

        $this->assertDatabaseMissing('documents', ['id' => $submitted->id]);
    }

    // ── Audit trail ─────────────────────────────────────────────────────────

    public function test_audit_log_written_on_applicant_hide(): void
    {
        $submitted = $this->makeDoc(['submitted_at' => now()]);

        Sanctum::actingAs($this->applicant);
        $this->deleteJson("/api/documents/{$submitted->id}")->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->applicant->id,
            'action' => 'document_hide',
            'auditable_type' => Document::class,
            'auditable_id' => $submitted->id,
        ]);
    }

    public function test_audit_log_written_on_force_delete(): void
    {
        $draft = $this->makeDoc(['submitted_at' => null]);
        $id = $draft->id;

        Sanctum::actingAs($this->applicant);
        $this->deleteJson("/api/documents/{$id}")->assertOk();

        // Audit entry must exist even though the row itself is gone.
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->applicant->id,
            'action' => 'document_delete',
            'auditable_type' => Document::class,
            'auditable_id' => $id,
        ]);

        // Sanity: row really is gone.
        $this->assertDatabaseMissing('documents', ['id' => $id]);
    }

    // ── Service layer invariant ─────────────────────────────────────────────

    public function test_document_service_delete_is_soft_only(): void
    {
        $doc = $this->makeDoc(['submitted_at' => now()]);
        $service = app(\App\Services\Document\DocumentService::class);

        $service->delete($doc);

        // Soft-deleted, recoverable via withTrashed().
        $this->assertSoftDeleted('documents', ['id' => $doc->id]);
        $this->assertNotNull(Document::withTrashed()->find($doc->id));
    }
}
