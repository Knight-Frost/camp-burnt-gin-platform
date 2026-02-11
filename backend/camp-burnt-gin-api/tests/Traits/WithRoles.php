<?php

namespace Tests\Traits;

use App\Models\Role;
use App\Models\User;

/**
 * Trait for creating users with specific roles in tests.
 *
 * Provides helper methods to create authenticated users with
 * admin, parent, or medical provider roles for authorization testing.
 */
trait WithRoles
{
    protected ?Role $adminRole = null;

    protected ?Role $parentRole = null;

    protected ?Role $medicalRole = null;

    /**
     * Set up the required roles for testing.
     */
    protected function setUpRoles(): void
    {
        $this->adminRole = Role::firstOrCreate(
            ['name' => 'admin'],
            ['description' => 'Administrator with full access']
        );

        $this->parentRole = Role::firstOrCreate(
            ['name' => 'parent'],
            ['description' => 'Parent or guardian of campers']
        );

        $this->medicalRole = Role::firstOrCreate(
            ['name' => 'medical'],
            ['description' => 'Medical provider with limited access']
        );
    }

    /**
     * Create an admin user.
     */
    protected function createAdmin(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role_id' => $this->adminRole->id,
        ], $attributes));
    }

    /**
     * Create a parent user.
     */
    protected function createParent(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role_id' => $this->parentRole->id,
        ], $attributes));
    }

    /**
     * Create a medical provider user.
     */
    protected function createMedicalProvider(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role_id' => $this->medicalRole->id,
        ], $attributes));
    }

    /**
     * Create a user with no role assigned.
     */
    protected function createUserWithoutRole(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role_id' => null,
        ], $attributes));
    }
}
