<?php

namespace Tests\Feature\Regression;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression coverage for BUG-209: the sign endpoint used to return 400
 * "Application has already been signed" whenever the parent's submission
 * flow retried (e.g. after a network error mid-submit). Those retries are
 * normal: the submit button runs `sign → consents → finalize` as one unit
 * and any transient failure rewinds to the start. Blocking the retry was
 * a false-positive conflict — the expected outcome of "sign this
 * application" is already true, so the endpoint must succeed.
 *
 * New contract:
 *   • unsigned                  → sign, 200
 *   • signed + draft            → overwrite signature, 200
 *   • signed + non-draft        → keep existing, 200 (idempotent)
 *   • signature fields missing  → 422 (validation unchanged)
 */
class ApplicationSignIdempotencyTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    private function makeDraftApplication(): Application
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $session = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);

        $app = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft' => true,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => null,
        ]);

        $this->actingAs($parent);

        return $app;
    }

    public function test_first_sign_on_unsigned_draft_returns_200(): void
    {
        $app = $this->makeDraftApplication();

        $response = $this->postJson("/api/applications/{$app->id}/sign", [
            'signature_data' => 'Jack Frost',
            'signature_name' => 'Jack Frost',
        ]);

        $response->assertOk();
        $this->assertNotNull($app->fresh()->signed_at);
    }

    public function test_second_sign_on_draft_overwrites_not_errors(): void
    {
        // Regression guard: the blocking 400 is gone. Re-signing is allowed
        // while the applicant is still editing a draft.
        $app = $this->makeDraftApplication();

        $this->postJson("/api/applications/{$app->id}/sign", [
            'signature_data' => 'Original',
            'signature_name' => 'Original Name',
        ])->assertOk();

        $response = $this->postJson("/api/applications/{$app->id}/sign", [
            'signature_data' => 'Updated',
            'signature_name' => 'Updated Name',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.signature_name', 'Updated Name');
    }

    public function test_repeat_sign_on_submitted_application_is_idempotent(): void
    {
        // The submit retry case. The flow runs sign → consents → finalize.
        // If a prior attempt already flipped the app to non-draft + signed,
        // the retry must not 400 on the sign step.
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $session = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);

        $app = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft' => false,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => now()->subMinute(),
            'signed_at' => now()->subMinute(),
            'signature_name' => 'Jack Frost',
            'signature_data' => 'Jack Frost',
            'signed_ip_address' => '10.0.0.1',
        ]);

        $response = $this->actingAs($parent)->postJson("/api/applications/{$app->id}/sign", [
            'signature_data' => 'Different Content',
            'signature_name' => 'Different Name',
        ]);

        $response->assertOk();

        // Original signature is preserved — the legal record is locked once
        // the application is no longer a draft.
        $this->assertSame('Jack Frost', $app->fresh()->signature_name);
    }

    public function test_missing_signature_fields_still_return_422(): void
    {
        // Validation is unchanged — the SignApplicationRequest still guards
        // against empty signatures.
        $app = $this->makeDraftApplication();

        $this->postJson("/api/applications/{$app->id}/sign", [
            'signature_data' => '',
            'signature_name' => '',
        ])->assertStatus(422);
    }
}
