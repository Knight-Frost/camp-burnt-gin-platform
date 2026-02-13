<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Main database seeder for Camp Burnt Gin application.
 *
 * Execution order:
 * 1. Roles (required for user creation)
 * 2. Document rules and activity permissions
 * 3. Initial users (super admin + test users)
 */
class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // CRITICAL: Seed roles FIRST (required for user creation)
        $this->call(RoleSeeder::class);

        // Seed system data
        $this->call([
            RequiredDocumentRuleSeeder::class,
            ActivityPermissionSeeder::class,
        ]);

        // Create initial super admin user
        $superAdminRole = Role::where('name', 'super_admin')->first();

        User::firstOrCreate(
            ['email' => 'admin@campburntgin.org'],
            [
                'name' => 'Super Administrator',
                'role_id' => $superAdminRole->id,
                'password' => Hash::make('ChangeThisPassword123!'),
                'email_verified_at' => now(),
            ]
        );

        // Create test parent user for development
        $parentRole = Role::where('name', 'parent')->first();

        User::firstOrCreate(
            ['email' => 'parent@example.com'],
            [
                'name' => 'Test Parent',
                'role_id' => $parentRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        // Create test admin user for development
        $adminRole = Role::where('name', 'admin')->first();

        User::firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Test Admin',
                'role_id' => $adminRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        $this->command->info('✓ Database seeding completed successfully.');
        $this->command->newLine();
        $this->command->warn('⚠️  SECURITY WARNING: Change the super admin password immediately!');
        $this->command->warn('    Email: admin@campburntgin.org');
        $this->command->warn('    Default password: ChangeThisPassword123!');
    }
}
