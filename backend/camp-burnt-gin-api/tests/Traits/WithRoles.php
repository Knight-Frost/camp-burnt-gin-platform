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
    protected ?Role $superAdminRole = null;

    protected ?Role $adminRole = null;

    protected ?Role $parentRole = null;

    protected ?Role $medicalRole = null;

    /**
     * Set up the required roles for testing.
     */
    protected function setUpRoles(): void
    {
        $this->superAdminRole = Role::firstOrCreate(
            ['name' => 'super_admin'],
            ['description' => 'Super Administrator with absolute system authority']
        );

        $this->adminRole = Role::firstOrCreate(
            ['name' => 'admin'],
            ['description' => 'Administrator with full operational access']
        );

        $this->parentRole = Role::firstOrCreate(
            ['name' => 'applicant'],
            ['description' => 'Parent or guardian of campers']
        );

        $this->medicalRole = Role::firstOrCreate(
            ['name' => 'medical'],
            ['description' => 'Medical provider with limited access']
        );
    }

    /**
     * Create a super admin user.
     */
    protected function createSuperAdmin(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role_id' => $this->superAdminRole->id,
        ], $attributes));
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
