<?php

namespace Tests\Feature\Inbox;

use App\Models\Camper;
use App\Models\Conversation;
use App\Models\Document;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Phase 2: link existing Documents to Messages via message_document_links.
 *
 * These tests lock in the authorization + rendering invariants that replace
 * the old fake "Document: filename" text-only flow. If any of them regresses,
 * an applicant has regained the ability to fan out arbitrary documents into
 * conversations they shouldn't have access to, or the admin inbox has lost
 * the ability to render real attachments.
 */
class MessageAttachedDocumentTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    private User $admin;

    private User $applicant;

    private Camper $camper;

    private Conversation $conversation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();

        $this->admin = $this->createAdmin();
        $this->applicant = $this->createParent();
        $this->camper = Camper::factory()->create(['user_id' => $this->applicant->id]);

        // A conversation with admin + applicant as participants. Mirrors the
        // real "applicant sends document to admin" flow from the screenshot.
        $this->conversation = Conversation::factory()->create([
            'created_by_id' => $this->applicant->id,
            'subject' => 'Document: tiger.jpg',
        ]);
        $this->conversation->participantRecords()->createMany([
            ['user_id' => $this->applicant->id, 'joined_at' => now()],
            ['user_id' => $this->admin->id, 'joined_at' => now()],
        ]);

        Storage::fake('local');
    }

    /**
     * Build a Document owned by a given user. The doc lives under their own
     * camper so DocumentPolicy::view lets the uploader see it.
     */
    private function makeOwnedDoc(User $uploader, Camper $camper, array $overrides = []): Document
    {
        return Document::create(array_merge([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'document_type' => 'supplementary',
            'original_filename' => 'tiger.jpg',
            'stored_filename' => 'stored-tiger.jpg',
            'path' => 'documents/test/stored-tiger.jpg',
            'mime_type' => 'image/jpeg',
            'file_size' => 2048,
            'disk' => 'local',
            'uploaded_by' => $uploader->id,
            'is_scanned' => true,
            'scan_passed' => true,
            'submitted_at' => now(),
        ], $overrides));
    }

    // ── Happy path: applicant links their own document ──────────────────────

    #[Test]
    public function applicant_can_attach_their_own_document(): void
    {
        $doc = $this->makeOwnedDoc($this->applicant, $this->camper);

        Sanctum::actingAs($this->applicant);
        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => "Here's the file.",
                'attached_document_ids' => [$doc->id],
            ]
        );

        $response->assertStatus(201);

        // Pivot row created.
        $this->assertDatabaseHas('message_document_links', [
            'document_id' => $doc->id,
            'attached_by' => $this->applicant->id,
        ]);

        // Shaped response carries the attachment so the admin UI renders a
        // real attachment card instead of parsing body text.
        $attachments = $response->json('data.attachments');
        $this->assertIsArray($attachments);
        $this->assertCount(1, $attachments);
        $this->assertSame($doc->id, $attachments[0]['id']);
    }

    #[Test]
    public function attached_document_appears_in_thread_fetch(): void
    {
        $doc = $this->makeOwnedDoc($this->applicant, $this->camper);

        Sanctum::actingAs($this->applicant);
        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Tiger photo.',
                'attached_document_ids' => [$doc->id],
            ]
        )->assertStatus(201);

        // Admin fetches the thread — attachment should show up on the message.
        Sanctum::actingAs($this->admin);
        $response = $this->getJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages"
        )->assertOk();

        $messages = $response->json('data');
        $this->assertNotEmpty($messages);
        $last = end($messages);
        $this->assertCount(1, $last['attachments']);
        $this->assertSame($doc->id, $last['attachments'][0]['id']);
    }

    // ── Authorization gates ─────────────────────────────────────────────────

    #[Test]
    public function applicant_cannot_attach_another_users_document(): void
    {
        $otherApplicant = $this->createParent();
        $otherCamper = Camper::factory()->create(['user_id' => $otherApplicant->id]);
        $otherDoc = $this->makeOwnedDoc($otherApplicant, $otherCamper);

        Sanctum::actingAs($this->applicant);
        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Trying to steal their file.',
                'attached_document_ids' => [$otherDoc->id],
            ]
        );

        $response->assertStatus(403);

        // Whole transaction rolled back — no message, no pivot row.
        $this->assertDatabaseMissing('message_document_links', [
            'document_id' => $otherDoc->id,
        ]);
        $this->assertDatabaseMissing('messages', [
            'body' => 'Trying to steal their file.',
        ]);
    }

    #[Test]
    public function applicant_cannot_attach_to_conversation_they_are_not_in(): void
    {
        $otherAdmin = $this->createAdmin();
        $othersConv = Conversation::factory()->create([
            'created_by_id' => $this->admin->id,
        ]);
        $othersConv->participantRecords()->createMany([
            ['user_id' => $this->admin->id, 'joined_at' => now()],
            ['user_id' => $otherAdmin->id, 'joined_at' => now()],
        ]);

        $doc = $this->makeOwnedDoc($this->applicant, $this->camper);

        Sanctum::actingAs($this->applicant);
        // Even gate-of-conversation fires first — this should 403 at Gate::create
        // or at attachDocument. Either way it must not succeed.
        $response = $this->postJson(
            "/api/inbox/conversations/{$othersConv->id}/messages",
            [
                'body' => 'Not my conversation.',
                'attached_document_ids' => [$doc->id],
            ]
        );

        $this->assertTrue(in_array($response->status(), [403, 404]), "expected 403 or 404, got {$response->status()}");

        $this->assertDatabaseMissing('message_document_links', [
            'document_id' => $doc->id,
        ]);
    }

    #[Test]
    public function admin_can_attach_any_document_in_conversation_they_view(): void
    {
        $doc = $this->makeOwnedDoc($this->applicant, $this->camper);

        Sanctum::actingAs($this->admin);
        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Admin response with the file.',
                'attached_document_ids' => [$doc->id],
            ]
        );

        $response->assertStatus(201);
        $this->assertDatabaseHas('message_document_links', [
            'document_id' => $doc->id,
            'attached_by' => $this->admin->id,
        ]);
    }

    // ── Idempotency + backward compat ──────────────────────────────────────

    #[Test]
    public function duplicate_ids_in_request_do_not_create_duplicate_links(): void
    {
        $doc = $this->makeOwnedDoc($this->applicant, $this->camper);

        Sanctum::actingAs($this->applicant);
        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Same doc twice.',
                'attached_document_ids' => [$doc->id, $doc->id],
            ]
        )->assertStatus(201);

        $this->assertSame(1, \DB::table('message_document_links')
            ->where('document_id', $doc->id)
            ->count());
    }

    #[Test]
    public function legacy_inline_attachment_still_renders_on_shaped_message(): void
    {
        // Simulate a pre-Phase-2 inline attachment: a Document with
        // message_id set and documentable_type=Message.
        $message = Message::factory()
            ->inConversation($this->conversation)
            ->sentBy($this->applicant)
            ->create(['body' => 'Legacy message.']);

        $legacyDoc = Document::create([
            'documentable_type' => Message::class,
            'documentable_id' => $message->id,
            'message_id' => $message->id,
            'document_type' => 'message_attachment',
            'original_filename' => 'legacy.pdf',
            'stored_filename' => 'stored-legacy.pdf',
            'path' => 'documents/test/stored-legacy.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 512,
            'disk' => 'local',
            'uploaded_by' => $this->applicant->id,
            'is_scanned' => true,
            'scan_passed' => true,
            'submitted_at' => now(),
        ]);

        // Admin fetches the thread. The legacy attachment should appear in
        // the unified attachments[] array without any Phase 2 pivot row.
        Sanctum::actingAs($this->admin);
        $response = $this->getJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages"
        )->assertOk();

        $row = collect($response->json('data'))->firstWhere('id', $message->id);
        $this->assertNotNull($row, 'legacy message should be present in thread');
        $this->assertCount(1, $row['attachments']);
        $this->assertSame($legacyDoc->id, $row['attachments'][0]['id']);
    }

    // ── Phase 1 invariant extension: linked doc blocks force-delete ─────────

    #[Test]
    public function document_linked_via_pivot_cannot_be_force_deleted_by_applicant(): void
    {
        // Fresh draft — would normally be force-deletable per Phase 1.
        $doc = $this->makeOwnedDoc($this->applicant, $this->camper, [
            'submitted_at' => null,
        ]);

        // Link it to a message via the new pathway.
        Sanctum::actingAs($this->applicant);
        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Linking.',
                'attached_document_ids' => [$doc->id],
            ]
        )->assertStatus(201);

        // canForceDelete must now report false because the doc is referenced
        // by an active message.
        $this->assertFalse($doc->fresh()->canForceDelete());

        // Clicking "Delete" from the Documents page should hide, not destroy.
        $this->deleteJson("/api/documents/{$doc->id}")->assertOk();

        $this->assertDatabaseHas('documents', [
            'id' => $doc->id,
            'deleted_at' => null,
        ]);
        $this->assertNotNull($doc->fresh()->applicant_hidden_at);
    }

    // ── sent_at stamping ────────────────────────────────────────────────────

    #[Test]
    public function attaching_document_stamps_sent_at(): void
    {
        $doc = $this->makeOwnedDoc($this->applicant, $this->camper, [
            'sent_at' => null,
        ]);
        $this->assertNull($doc->fresh()->sent_at);

        Sanctum::actingAs($this->applicant);
        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Sending it.',
                'attached_document_ids' => [$doc->id],
            ]
        )->assertStatus(201);

        $this->assertNotNull($doc->fresh()->sent_at);
    }

    #[Test]
    public function subsequent_attach_does_not_overwrite_sent_at(): void
    {
        $firstSent = now()->subHours(2);
        $doc = $this->makeOwnedDoc($this->applicant, $this->camper, [
            'sent_at' => $firstSent,
        ]);

        Sanctum::actingAs($this->applicant);
        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Re-sending.',
                'attached_document_ids' => [$doc->id],
            ]
        )->assertStatus(201);

        // The first send is the source of truth for when the applicant pushed
        // this doc — a second link (e.g. same doc attached to a follow-up
        // message) must not move the timestamp forward.
        $this->assertEquals(
            $firstSent->toIso8601String(),
            $doc->fresh()->sent_at->toIso8601String(),
        );
    }

    #[Test]
    public function sent_at_is_exposed_in_documents_response(): void
    {
        $doc = $this->makeOwnedDoc($this->applicant, $this->camper, [
            'sent_at' => null,
        ]);

        Sanctum::actingAs($this->applicant);
        $response = $this->getJson('/api/documents')->assertOk();

        $row = collect($response->json('data'))->firstWhere('id', $doc->id);
        $this->assertNotNull($row, 'applicant should see their own not-yet-sent doc');
        $this->assertArrayHasKey('sent_at', $row);
        $this->assertNull($row['sent_at']);
    }

    // ── Download path: unified across legacy + new ──────────────────────────

    #[Test]
    public function attachment_download_works_for_phase_2_linked_doc(): void
    {
        $doc = $this->makeOwnedDoc($this->applicant, $this->camper);

        // Put a real file on the fake disk so the download endpoint can find it.
        Storage::disk('local')->put($doc->path, 'tiger bytes');

        Sanctum::actingAs($this->applicant);
        $sendResponse = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Sharing.',
                'attached_document_ids' => [$doc->id],
            ]
        )->assertStatus(201);

        $messageId = $sendResponse->json('data.id');

        // Admin downloads the attachment via the messaging API.
        Sanctum::actingAs($this->admin);
        $this->getJson("/api/inbox/messages/{$messageId}/attachments/{$doc->id}")
            ->assertOk();
    }
}
