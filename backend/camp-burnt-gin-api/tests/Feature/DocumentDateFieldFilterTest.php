<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Enums\DocumentRequestStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\Document;
use App\Models\DocumentRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * DocumentDateFieldFilterTest
 *
 * Verifies Extension B: the date_field selector on both
 * GET /api/documents and GET /api/document-requests.
 *
 * Cases:
 *   1. Default behavior (no date_field param): from/to still filters by created_at — back-compat.
 *   2. date_field=submitted_at + from filters documents by submitted_at (DocumentController).
 *   3. Invalid date_field falls back to created_at silently — no 422.
 *   4. date_field=due_date + from filters document_requests by due_date (DocumentRequestController).
 */
class DocumentDateFieldFilterTest extends TestCase
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
        $this->camper = Camper::factory()->for($this->applicant)->create();
    }

    /**
     * Helper: create a submitted Document attached to a submitted Application so
     * it passes the admin submission gate (submitted_at + non-draft parent app).
     *
     * Timestamp overrides (created_at, updated_at, submitted_at) are applied via
     * DB::table()->update() after creation because Eloquent auto-sets created_at/updated_at
     * and those fields are not in the Document $fillable list.
     */
    private function makeSubmittedDocument(array $overrides = []): Document
    {
        $application = Application::factory()->create([
            'camper_id' => $this->camper->id,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => now(),
        ]);

        // Extract timestamp overrides that Eloquent won't respect via create().
        $createdAt = $overrides['created_at'] ?? null;
        $updatedAt = $overrides['updated_at'] ?? null;
        $submittedAt = $overrides['submitted_at'] ?? now()->toDateTimeString();

        $doc = Document::create([
            'documentable_type' => Application::class,
            'documentable_id' => $application->id,
            'document_type' => 'supplementary',
            'original_filename' => 'proof.pdf',
            'stored_filename' => 'stored_'.uniqid().'.pdf',
            'path' => 'documents/test/stored.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'disk' => 'local',
            'uploaded_by' => $this->applicant->id,
            'is_scanned' => true,
            'scan_passed' => true,
            'submitted_at' => $submittedAt,
        ]);

        // Now force-write the timestamp columns that Eloquent does not respect via create().
        $updates = [];
        if ($createdAt !== null) {
            $updates['created_at'] = $createdAt;
        }
        if ($updatedAt !== null) {
            $updates['updated_at'] = $updatedAt;
        }
        if (isset($overrides['submitted_at'])) {
            $updates['submitted_at'] = $overrides['submitted_at'];
        }
        if (! empty($updates)) {
            DB::table('documents')->where('id', $doc->id)->update($updates);
        }

        return $doc->fresh();
    }

    // ── Test 1: Default created_at behavior preserved ────────────────────────

    /**
     * Omitting date_field still applies from/to against created_at — existing callers
     * see no change.
     */
    public function test_default_date_field_filters_by_created_at(): void
    {
        $docInRange = $this->makeSubmittedDocument([
            'created_at' => '2026-03-15 12:00:00',
            'updated_at' => '2026-03-15 12:00:00',
        ]);
        $docOutOfRange = $this->makeSubmittedDocument([
            'created_at' => '2026-01-01 00:00:00',
            'updated_at' => '2026-01-01 00:00:00',
        ]);

        Sanctum::actingAs($this->admin);
        $response = $this->getJson('/api/documents?from=2026-03-01&to=2026-03-31');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertContains($docInRange->id, $ids, 'Document within created_at range should be returned.');
        $this->assertNotContains($docOutOfRange->id, $ids, 'Document outside created_at range should be excluded.');
    }

    // ── Test 2: date_field=submitted_at filters Documents by submitted_at ────

    /**
     * When date_field=submitted_at, from/to applies to documents.submitted_at
     * instead of documents.created_at.
     */
    public function test_date_field_submitted_at_filters_documents_by_submitted_at(): void
    {
        // Document submitted in March but created in January
        $docSubmittedInRange = $this->makeSubmittedDocument([
            'created_at' => '2026-01-10 10:00:00',
            'updated_at' => '2026-01-10 10:00:00',
            'submitted_at' => '2026-03-15 10:00:00',
        ]);

        // Document submitted in January (outside March range)
        $docSubmittedOutOfRange = $this->makeSubmittedDocument([
            'created_at' => '2026-01-10 10:00:00',
            'updated_at' => '2026-01-10 10:00:00',
            'submitted_at' => '2026-01-10 10:00:00',
        ]);

        Sanctum::actingAs($this->admin);
        $response = $this->getJson('/api/documents?date_field=submitted_at&from=2026-03-01&to=2026-03-31');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertContains($docSubmittedInRange->id, $ids, 'Document submitted within the range should appear.');
        $this->assertNotContains($docSubmittedOutOfRange->id, $ids, 'Document submitted outside the range should not appear.');
    }

    // ── Test 3: Invalid date_field falls back to created_at silently ─────────

    /**
     * Sending an unrecognised date_field value does NOT return a 422.
     * The request succeeds and falls back to filtering by created_at.
     */
    public function test_invalid_date_field_falls_back_to_created_at_without_422(): void
    {
        $docInRange = $this->makeSubmittedDocument([
            'created_at' => '2026-03-15 12:00:00',
            'updated_at' => '2026-03-15 12:00:00',
        ]);

        Sanctum::actingAs($this->admin);
        // 'invoice_date' is not a valid field — should fall back to created_at, not error
        $response = $this->getJson('/api/documents?date_field=invoice_date&from=2026-03-01&to=2026-03-31');

        $response->assertOk(); // Must NOT return 422
        $ids = collect($response->json('data'))->pluck('id')->all();

        // Falls back to created_at, so the in-range document still appears
        $this->assertContains($docInRange->id, $ids, 'Falls back to created_at; in-range doc should appear.');
    }

    /**
     * Sending date_field=due_date to DocumentController (which only allows created_at,
     * updated_at, submitted_at) silently falls back to created_at — no 422.
     */
    public function test_due_date_field_on_document_controller_falls_back_silently(): void
    {
        $docInRange = $this->makeSubmittedDocument([
            'created_at' => '2026-03-15 12:00:00',
            'updated_at' => '2026-03-15 12:00:00',
        ]);

        Sanctum::actingAs($this->admin);
        $response = $this->getJson('/api/documents?date_field=due_date&from=2026-03-01&to=2026-03-31');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();

        // Falls back to created_at — the in-range document should still appear
        $this->assertContains($docInRange->id, $ids);
    }

    // ── Test 4: date_field=due_date on DocumentRequestController ─────────────

    /**
     * When date_field=due_date on GET /api/document-requests, from/to filters
     * by document_requests.due_date rather than created_at.
     */
    public function test_date_field_due_date_filters_document_requests_by_due_date(): void
    {
        $application = Application::factory()->create([
            'camper_id' => $this->camper->id,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => now(),
        ]);

        // Request with due_date within the query range (March)
        $reqDueInRange = DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'application_id' => $application->id,
            'camper_id' => $this->camper->id,
            'requested_by_admin_id' => $this->admin->id,
            'status' => DocumentRequestStatus::AwaitingUpload,
            'due_date' => '2026-03-20',
            'created_at' => '2026-01-05 08:00:00',
            'updated_at' => '2026-01-05 08:00:00',
        ]);

        // Request with due_date outside the query range (January)
        $reqDueOutOfRange = DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'application_id' => $application->id,
            'camper_id' => $this->camper->id,
            'requested_by_admin_id' => $this->admin->id,
            'status' => DocumentRequestStatus::AwaitingUpload,
            'due_date' => '2026-01-10',
            'created_at' => '2026-03-01 08:00:00',
            'updated_at' => '2026-03-01 08:00:00',
        ]);

        Sanctum::actingAs($this->admin);
        $response = $this->getJson('/api/document-requests?date_field=due_date&from=2026-03-01&to=2026-03-31');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertContains($reqDueInRange->id, $ids, 'Request with due_date in range should appear.');
        $this->assertNotContains($reqDueOutOfRange->id, $ids, 'Request with due_date outside range should not appear.');
    }
}
