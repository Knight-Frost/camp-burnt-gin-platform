<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Enums\DocumentRequestStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\DocumentRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * DocumentRequestApplicationNumberFilterTest
 *
 * Verifies that GET /api/document-requests?application_number=... correctly
 * filters document requests by the computed application_number accessor:
 *   CBG-{YEAR(applications.created_at)}-{LPAD(applications.id, 3, '0')}
 *
 * Cases:
 *   1. Full match returns only the request linked to that application.
 *   2. Partial match (year prefix) returns all requests for that year.
 *   3. No match returns empty result set.
 *   4. Combined with status filter — both conditions AND correctly.
 */
class DocumentRequestApplicationNumberFilterTest extends TestCase
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
     * Create a submitted Application with a specific created_at timestamp and
     * return a DocumentRequest linked to it.
     */
    private function makeRequestForApplication(string $createdAt): array
    {
        $application = Application::factory()->create([
            'camper_id' => $this->camper->id,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => now(),
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);

        $docRequest = DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'application_id' => $application->id,
            'camper_id' => $this->camper->id,
            'requested_by_admin_id' => $this->admin->id,
            'status' => DocumentRequestStatus::AwaitingUpload,
        ]);

        return [$application, $docRequest];
    }

    // ── Test 1: Full match returns only that request ──────────────────────────

    /**
     * When application_number exactly matches one application's computed number,
     * only the document request linked to that application is returned.
     */
    public function test_full_application_number_match_returns_single_request(): void
    {
        [$app2026, $req2026] = $this->makeRequestForApplication('2026-01-15 10:00:00');
        [$app2025, $req2025] = $this->makeRequestForApplication('2025-06-01 08:00:00');

        // Compute the expected number for the 2026 application
        $year = date('Y', strtotime('2026-01-15'));
        $expectedNumber = sprintf('CBG-%s-%03d', $year, $app2026->id);

        Sanctum::actingAs($this->admin);
        $response = $this->getJson('/api/document-requests?application_number='.urlencode($expectedNumber));

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertContains($req2026->id, $ids);
        $this->assertNotContains($req2025->id, $ids);
    }

    // ── Test 2: Partial match returns all requests from that year ─────────────

    /**
     * When application_number is a partial string like "CBG-2026", all requests
     * whose linked application was created in 2026 are returned.
     */
    public function test_partial_application_number_returns_all_matching_year(): void
    {
        [$appA, $reqA] = $this->makeRequestForApplication('2026-02-10 09:00:00');
        [$appB, $reqB] = $this->makeRequestForApplication('2026-09-20 14:00:00');
        [$appC, $reqC] = $this->makeRequestForApplication('2025-03-05 11:00:00');

        Sanctum::actingAs($this->admin);
        $response = $this->getJson('/api/document-requests?application_number=CBG-2026');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertContains($reqA->id, $ids, 'Request A (2026) should match.');
        $this->assertContains($reqB->id, $ids, 'Request B (2026) should match.');
        $this->assertNotContains($reqC->id, $ids, 'Request C (2025) should not match.');
    }

    // ── Test 3: No match returns empty result set ─────────────────────────────

    /**
     * When the application_number string matches nothing, the result set is empty.
     */
    public function test_no_match_returns_empty_result(): void
    {
        $this->makeRequestForApplication('2026-01-01 00:00:00');

        Sanctum::actingAs($this->admin);
        $response = $this->getJson('/api/document-requests?application_number=DOES-NOT-EXIST');

        $response->assertOk();
        $this->assertCount(0, $response->json('data'));
    }

    // ── Test 4: Combined with status filter ───────────────────────────────────

    /**
     * When both application_number and status are provided, both predicates
     * AND together: only requests matching the number AND the status are returned.
     */
    public function test_application_number_and_status_combine_with_and_logic(): void
    {
        [$app2026, $reqAwaiting] = $this->makeRequestForApplication('2026-04-01 00:00:00');

        // A second request on the same application but with a different status
        $reqUploaded = DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'application_id' => $app2026->id,
            'camper_id' => $this->camper->id,
            'requested_by_admin_id' => $this->admin->id,
            'status' => DocumentRequestStatus::Uploaded,
        ]);

        // A request for a completely different year
        [$app2025, $reqOther] = $this->makeRequestForApplication('2025-01-01 00:00:00');

        Sanctum::actingAs($this->admin);
        $response = $this->getJson('/api/document-requests?application_number=CBG-2026&status=awaiting_upload');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();

        // Only the awaiting-upload request for 2026 application should appear
        $this->assertContains($reqAwaiting->id, $ids, 'Awaiting-upload 2026 request should match.');
        $this->assertNotContains($reqUploaded->id, $ids, 'Uploaded 2026 request should not match status filter.');
        $this->assertNotContains($reqOther->id, $ids, '2025 request should not match application_number filter.');
    }
}
