<?php

namespace Tests\Feature\Regression;

use App\Models\Camper;
use App\Models\CampSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * MFA enrollment enforcement regression tests.
 *
 * Verifies that:
 *  - Admin users without MFA enrolled are blocked from admin endpoints (403).
 *  - The 403 response carries `mfa_setup_required: true` so the frontend can redirect.
 *  - Admin users with MFA enabled are allowed through.
 *  - Medical providers without MFA are blocked from PHI endpoints.
 *  - Medical providers with MFA enabled are allowed through.
 *  - Applicant (parent) users are never subject to the MFA enrollment requirement.
 *  - Super-admin without MFA is blocked (the early-return refactor closes this gap).
 */
class MfaEnrollmentEnforcementTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    // ── Admin without MFA ────────────────────────────────────────────────────

    public function test_admin_without_mfa_is_blocked_from_admin_routes(): void
    {
        $admin = $this->createAdmin(['mfa_enabled' => false]);

        $response = $this->actingAs($admin)->getJson('/api/families');

        $response->assertStatus(403);
        $response->assertJsonPath('mfa_setup_required', true);
    }

    public function test_admin_without_mfa_receives_descriptive_message(): void
    {
        $admin = $this->createAdmin(['mfa_enabled' => false]);

        $response = $this->actingAs($admin)->getJson('/api/families');

        $response->assertStatus(403);
        $response->assertJsonStructure(['message', 'mfa_setup_required']);
        $this->assertStringContainsString('Multi-factor authentication', $response->json('message'));
    }

    // ── Admin with MFA ───────────────────────────────────────────────────────

    public function test_admin_with_mfa_enabled_can_access_admin_routes(): void
    {
        $admin = $this->createAdmin(['mfa_enabled' => true]);

        $response = $this->actingAs($admin)->getJson('/api/families');

        // May return 200 (empty list) or 403 from a policy — what matters is
        // that the MFA gate does not fire (no mfa_setup_required key).
        $this->assertNotEquals(403, $response->status());
        $response->assertJsonMissing(['mfa_setup_required' => true]);
    }

    // ── Super-admin without MFA ──────────────────────────────────────────────

    public function test_super_admin_without_mfa_is_blocked_from_admin_routes(): void
    {
        $superAdmin = $this->createSuperAdmin(['mfa_enabled' => false]);

        // Use an endpoint that accepts super_admin via EnsureUserIsAdmin (isAdmin() = true)
        $response = $this->actingAs($superAdmin)->getJson('/api/families');

        $response->assertStatus(403);
        $response->assertJsonPath('mfa_setup_required', true);
    }

    public function test_super_admin_with_mfa_enabled_can_access_admin_routes(): void
    {
        $superAdmin = $this->createSuperAdmin(['mfa_enabled' => true]);

        $response = $this->actingAs($superAdmin)->getJson('/api/families');

        $this->assertNotEquals(403, $response->status());
        $response->assertJsonMissing(['mfa_setup_required' => true]);
    }

    // ── Medical provider ─────────────────────────────────────────────────────

    public function test_medical_provider_without_mfa_is_blocked_from_phi_endpoints(): void
    {
        $medical = $this->createMedicalProvider(['mfa_enabled' => false]);

        // GET /api/medical-records uses role:admin,medical middleware → EnsureUserHasRole
        $response = $this->actingAs($medical)->getJson('/api/medical-records');

        $response->assertStatus(403);
        $response->assertJsonPath('mfa_setup_required', true);
    }

    public function test_medical_provider_with_mfa_enabled_can_access_phi_endpoints(): void
    {
        $medical = $this->createMedicalProvider(['mfa_enabled' => true]);

        $response = $this->actingAs($medical)->getJson('/api/medical-records');

        $this->assertNotEquals(403, $response->status());
        $response->assertJsonMissing(['mfa_setup_required' => true]);
    }

    // ── Applicant (parent) — exempt from MFA enrollment requirement ──────────

    public function test_applicant_without_mfa_can_access_applicant_routes(): void
    {
        $parent = $this->createParent(['mfa_enabled' => false]);
        $session = CampSession::factory()->create(['portal_open' => true]);

        // GET /api/applications is accessible to applicants (parent viewing own apps)
        $response = $this->actingAs($parent)->getJson('/api/applications');

        $response->assertStatus(200);
        $response->assertJsonMissing(['mfa_setup_required' => true]);
    }

    // ── MFA setup endpoint itself remains accessible without enrollment ───────

    public function test_admin_without_mfa_can_still_reach_mfa_setup_endpoint(): void
    {
        $admin = $this->createAdmin(['mfa_enabled' => false]);

        // POST /api/mfa/setup is under auth:sanctum only (no role or MFA middleware)
        $response = $this->actingAs($admin)->postJson('/api/mfa/setup');

        // Should not be blocked by MFA enrollment gate (may fail for other reasons,
        // but must not return 403 mfa_setup_required).
        $this->assertNotEquals(403, $response->status());
        $response->assertJsonMissing(['mfa_setup_required' => true]);
    }
}
