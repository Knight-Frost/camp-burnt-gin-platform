<?php

namespace Tests\Feature\Regression;

use App\Models\Camper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Camper identity = (user_id, first_name, last_name, date_of_birth).
 *
 * Before the fix, a parent who started an application flow and restarted
 * would end up with two Camper rows under the same identity, which later
 * manifested as "2 campers, both named Athena Wicker" in the admin
 * family view (BUG-215 root cause).
 *
 * CamperController::store now finds-or-creates by identity tuple, and
 * MergeDuplicateCampers is the one-shot cleanup for legacy duplicates.
 */
class CamperIdentityUniquenessTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        Queue::fake();
    }

    public function test_store_returns_existing_camper_when_identity_matches(): void
    {
        $parent = $this->createParent();

        $first = $this->actingAs($parent)
            ->postJson('/api/campers', [
                'first_name' => 'Athena',
                'last_name' => 'Wicker',
                'date_of_birth' => '2015-01-01',
                'gender' => 'female',
                'tshirt_size' => 'Youth M',
                'county' => 'Richland',
            ])
            ->assertCreated()
            ->json('data');

        $second = $this->actingAs($parent)
            ->postJson('/api/campers', [
                'first_name' => 'Athena',
                'last_name' => 'Wicker',
                'date_of_birth' => '2015-01-01',
                'gender' => 'female',
                'tshirt_size' => 'Youth M',
                'county' => 'Richland',
            ])
            ->assertOk()
            ->json('data');

        // Same row returned both times.
        $this->assertSame($first['id'], $second['id']);
        // One row in the DB, not two.
        $this->assertSame(1, Camper::where('user_id', $parent->id)
            ->where('first_name', 'Athena')
            ->where('last_name', 'Wicker')
            ->count());
    }

    public function test_store_applies_mutable_field_updates_on_existing_camper(): void
    {
        $parent = $this->createParent();

        $first = $this->actingAs($parent)
            ->postJson('/api/campers', [
                'first_name' => 'Athena',
                'last_name' => 'Wicker',
                'date_of_birth' => '2015-01-01',
                'gender' => 'female',
                'tshirt_size' => 'Youth M',
                'county' => 'Richland',
            ])
            ->assertCreated()
            ->json('data');

        // Second call changes tshirt_size; should update the existing row.
        $second = $this->actingAs($parent)
            ->postJson('/api/campers', [
                'first_name' => 'Athena',
                'last_name' => 'Wicker',
                'date_of_birth' => '2015-01-01',
                'gender' => 'female',
                'tshirt_size' => 'Youth L',
                'county' => 'Richland',
            ])
            ->assertOk()
            ->json('data');

        $this->assertSame($first['id'], $second['id']);
        $fresh = Camper::find($first['id']);
        $this->assertSame('Youth L', $fresh->tshirt_size);
    }

    public function test_identity_scope_is_per_user(): void
    {
        $parentA = $this->createParent();
        $parentB = $this->createParent();

        $camperA = $this->actingAs($parentA)
            ->postJson('/api/campers', [
                'first_name' => 'Athena',
                'last_name' => 'Wicker',
                'date_of_birth' => '2015-01-01',
                'gender' => 'female',
                'tshirt_size' => 'Youth M',
                'county' => 'Richland',
            ])
            ->assertCreated()
            ->json('data');

        $camperB = $this->actingAs($parentB)
            ->postJson('/api/campers', [
                'first_name' => 'Athena',
                'last_name' => 'Wicker',
                'date_of_birth' => '2015-01-01',
                'gender' => 'female',
                'tshirt_size' => 'Youth M',
                'county' => 'Richland',
            ])
            ->assertCreated()
            ->json('data');

        // Two distinct campers — the identity tuple is scoped per user.
        $this->assertNotSame($camperA['id'], $camperB['id']);
    }

    public function test_soft_deleted_camper_is_restored_rather_than_duplicated(): void
    {
        $parent = $this->createParent();

        $first = $this->actingAs($parent)
            ->postJson('/api/campers', [
                'first_name' => 'Athena',
                'last_name' => 'Wicker',
                'date_of_birth' => '2015-01-01',
                'gender' => 'female',
                'tshirt_size' => 'Youth M',
                'county' => 'Richland',
            ])
            ->assertCreated()
            ->json('data');

        Camper::find($first['id'])->delete();

        $second = $this->actingAs($parent)
            ->postJson('/api/campers', [
                'first_name' => 'Athena',
                'last_name' => 'Wicker',
                'date_of_birth' => '2015-01-01',
                'gender' => 'female',
                'tshirt_size' => 'Youth M',
                'county' => 'Richland',
            ])
            ->assertOk()
            ->json('data');

        // Same row restored, not a new row created behind the soft-delete.
        $this->assertSame($first['id'], $second['id']);
        $this->assertNull(Camper::withTrashed()->find($first['id'])->deleted_at);
    }
}
