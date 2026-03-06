<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeder — staff and system accounts.
 *
 * Creates demo staff accounts for local development:
 *   - admin@example.com       (admin role)
 *   - medical@example.com     (medical role)
 *   - admin2@example.com      (second super_admin for role-management testing)
 *
 * The primary super admin (admin@campburntgin.org) is created in DatabaseSeeder.
 * All demo accounts use the password "password".
 */
class UserSeeder extends Seeder
{
    public function run(): void
    {
        $adminRole   = Role::where('name', 'admin')->firstOrFail();
        $medicalRole = Role::where('name', 'medical')->firstOrFail();
        $superRole   = Role::where('name', 'super_admin')->firstOrFail();

        User::firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name'              => 'Alex Rivera',
                'role_id'           => $adminRole->id,
                'password'          => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        User::firstOrCreate(
            ['email' => 'medical@example.com'],
            [
                'name'              => 'Dr. Morgan Chen',
                'role_id'           => $medicalRole->id,
                'password'          => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        // Second super admin — used for testing role-management UI and
        // safeguards (e.g. "last super_admin cannot be deleted" logic).
        User::firstOrCreate(
            ['email' => 'admin2@campburntgin.org'],
            [
                'name'              => 'Deputy Administrator',
                'role_id'           => $superRole->id,
                'password'          => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );
    }
}
