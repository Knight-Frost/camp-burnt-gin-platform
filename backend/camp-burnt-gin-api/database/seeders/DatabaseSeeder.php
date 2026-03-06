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

        // Dev data (users, camp, applications, inbox, announcements, calendar)
        // is only seeded in non-production environments.
        if (! app()->environment('production')) {
            $this->call(DevSeeder::class);
        }

        // Note: dev test accounts (admin@example.com, medical@example.com,
        // and applicant family accounts) are seeded by DevSeeder above
        // with realistic demo names. Do not duplicate them here.

        $this->command->info('Database seeding completed successfully.');
        $this->command->newLine();
        $this->command->warn('SECURITY WARNING: Change the super admin password immediately!');
        $this->command->warn('  Email: admin@campburntgin.org');
        $this->command->warn('  Default password: ChangeThisPassword123!');
    }
}
