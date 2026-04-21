<?php

namespace Tests\Feature\Api;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for Camper resource authorization.
 *
 * Verifies that access control is properly enforced for camper
 * resources based on user roles and ownership.
 */
class CamperAuthorizationTest extends TestCase
{
    use RefreshDatabase;
    use WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    /*
    |--------------------------------------------------------------------------
    | Authentication Tests
    |--------------------------------------------------------------------------
    */

    public function test_unauthenticated_user_cannot_access_campers(): void
    {
        $response = $this->getJson('/api/campers');

        $response->assertStatus(401);
    }

    public function test_unauthenticated_user_cannot_create_camper(): void
    {
        $response = $this->postJson('/api/campers', [
            'first_name' => 'Test',
            'last_name' => 'Camper',
            'date_of_birth' => '2015-01-01',
        ]);

        $response->assertStatus(401);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin Access Tests
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_view_all_campers(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $session = CampSession::factory()->create();
        // Admin may only see campers with at least one submitted application.
        $campers = Camper::factory()->count(3)->forUser($parent)->create();
        foreach ($campers as $camper) {
            Application::factory()->for($camper)->for($session, 'campSession')->create([
                'status' => ApplicationStatus::Submitted,
                'submitted_at' => now(),
            ]);
        }

        $response = $this->actingAs($admin)->getJson('/api/campers');

        $response->assertStatus(200)
            ->assertJsonCount(3, 'data');
    }

    public function test_admin_cannot_view_campers_without_submitted_application(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        // Camper with only a draft application — must not appear in admin directory.
        $camper = Camper::factory()->forUser($parent)->create();
        Application::factory()->for($camper)->for(CampSession::factory()->create(), 'campSession')->draft()->create();

        $response = $this->actingAs($admin)->getJson('/api/campers');

        $response->assertStatus(200)->assertJsonCount(0, 'data');
    }

    public function test_admin_can_view_any_camper(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        // Must have a submitted application for admin to access the full record.
        Application::factory()->for($camper)->for(CampSession::factory()->create(), 'campSession')->create([
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => now(),
        ]);

        $response = $this->actingAs($admin)->getJson("/api/campers/{$camper->id}");

        $response->assertStatus(200)
            ->assertJsonPath('data.id', $camper->id);
    }

    public function test_admin_cannot_view_camper_without_submitted_application(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        // Draft-only camper — admin must receive 403 on detail page.
        Application::factory()->for($camper)->for(CampSession::factory()->create(), 'campSession')->draft()->create();

        $response = $this->actingAs($admin)->getJson("/api/campers/{$camper->id}");

        $response->assertStatus(403);
    }

    public function test_admin_can_create_camper_for_any_user(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();

        $response = $this->actingAs($admin)->postJson('/api/campers', [
            'user_id' => $parent->id,
            'first_name' => 'Test',
            'last_name' => 'Camper',
            'date_of_birth' => '2015-01-01',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('campers', [
            'user_id' => $parent->id,
            'first_name' => 'Test',
        ]);
    }

    public function test_admin_can_update_any_camper(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($admin)->putJson("/api/campers/{$camper->id}", [
            'first_name' => 'Updated',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('campers', [
            'id' => $camper->id,
            'first_name' => 'Updated',
        ]);
    }

    public function test_admin_can_delete_any_camper(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($admin)->deleteJson("/api/campers/{$camper->id}");

        $response->assertStatus(200);
        $this->assertSoftDeleted('campers', ['id' => $camper->id]);
    }

    /*
    |--------------------------------------------------------------------------
    | Parent Ownership Tests
    |--------------------------------------------------------------------------
    */

    public function test_parent_can_view_own_campers(): void
    {
        $parent = $this->createParent();
        Camper::factory()->count(2)->forUser($parent)->create();

        $response = $this->actingAs($parent)->getJson('/api/campers');

        $response->assertStatus(200)
            ->assertJsonCount(2, 'data');
    }

    public function test_parent_cannot_see_other_parents_campers_in_list(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        Camper::factory()->count(2)->forUser($parent1)->create();
        Camper::factory()->count(3)->forUser($parent2)->create();

        $response = $this->actingAs($parent1)->getJson('/api/campers');

        $response->assertStatus(200)
            ->assertJsonCount(2, 'data');
    }

    public function test_parent_can_view_own_camper(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->getJson("/api/campers/{$camper->id}");

        $response->assertStatus(200)
            ->assertJsonPath('data.id', $camper->id);
    }

    public function test_parent_cannot_view_other_parents_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();

        $response = $this->actingAs($parent1)->getJson("/api/campers/{$camper->id}");

        $response->assertStatus(403);
    }

    public function test_parent_can_create_camper(): void
    {
        $parent = $this->createParent();

        $response = $this->actingAs($parent)->postJson('/api/campers', [
            'first_name' => 'Test',
            'last_name' => 'Camper',
            'date_of_birth' => '2015-01-01',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('campers', [
            'user_id' => $parent->id,
            'first_name' => 'Test',
        ]);
    }

    public function test_parent_can_update_own_camper(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->putJson("/api/campers/{$camper->id}", [
            'first_name' => 'Updated',
        ]);

        $response->assertStatus(200);
    }

    public function test_parent_cannot_update_other_parents_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();

        $response = $this->actingAs($parent1)->putJson("/api/campers/{$camper->id}", [
            'first_name' => 'Hacked',
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_can_delete_own_camper(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->deleteJson("/api/campers/{$camper->id}");

        $response->assertStatus(200);
    }

    public function test_parent_cannot_delete_other_parents_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();

        $response = $this->actingAs($parent1)->deleteJson("/api/campers/{$camper->id}");

        $response->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | Medical Provider Isolation Tests
    |--------------------------------------------------------------------------
    */

    public function test_medical_provider_can_view_campers_list(): void
    {
        // Phase 11: medical providers have full read access to camper profiles for clinical workflows.
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        Camper::factory()->count(3)->forUser($parent)->create();

        $response = $this->actingAs($medical)->getJson('/api/campers');

        $response->assertOk();
    }

    public function test_medical_provider_can_view_camper(): void
    {
        // Medical providers can only view active (approved) campers.
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create(['is_active' => true]);

        $response = $this->actingAs($medical)->getJson("/api/campers/{$camper->id}");

        $response->assertOk();
    }

    public function test_medical_provider_cannot_create_camper(): void
    {
        $medical = $this->createMedicalProvider();

        $response = $this->actingAs($medical)->postJson('/api/campers', [
            'first_name' => 'Test',
            'last_name' => 'Camper',
            'date_of_birth' => '2015-01-01',
        ]);

        $response->assertStatus(403);
    }

    public function test_medical_provider_cannot_update_camper(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($medical)->putJson("/api/campers/{$camper->id}", [
            'first_name' => 'Updated',
        ]);

        $response->assertStatus(403);
    }

    public function test_medical_provider_cannot_delete_camper(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($medical)->deleteJson("/api/campers/{$camper->id}");

        $response->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | User Without Role Tests
    |--------------------------------------------------------------------------
    */

    public function test_user_without_role_gets_empty_campers_list(): void
    {
        // Users with no recognised role receive an empty result set rather than 403.
        $user = $this->createUserWithoutRole();

        $response = $this->actingAs($user)->getJson('/api/campers');

        $response->assertOk();
        $response->assertJsonPath('data', []);
    }
}
