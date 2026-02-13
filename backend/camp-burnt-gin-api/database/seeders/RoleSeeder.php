<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Seeder for system roles.
 *
 * Creates the four core roles required for role-based access control:
 * - super_admin: Absolute system authority
 * - admin: Full operational access
 * - parent: Parent or guardian of campers
 * - medical: Medical provider with limited access
 *
 * This seeder is idempotent and safe to run multiple times.
 */
class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roles = [
            [
                'name' => 'super_admin',
                'description' => 'Super Administrator with absolute system authority',
            ],
            [
                'name' => 'admin',
                'description' => 'Administrator with full operational access',
            ],
            [
                'name' => 'parent',
                'description' => 'Parent or guardian of campers',
            ],
            [
                'name' => 'medical',
                'description' => 'Medical provider with limited access',
            ],
        ];

        foreach ($roles as $roleData) {
            Role::firstOrCreate(
                ['name' => $roleData['name']],
                ['description' => $roleData['description']]
            );
        }

        $this->command->info('✓ Roles seeded successfully (4 roles created).');
    }
}
