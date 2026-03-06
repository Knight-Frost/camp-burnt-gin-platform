<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Main database seeder for Camp Burnt Gin.
 *
 * Execution order:
 *   1. Roles                    — always (required for all user creation)
 *   2. System data              — always (document rules, activity permissions)
 *   3. Super admin account      — always (production-safe bootstrap)
 *   4. Demo data stack          — non-production only, controlled by config/seeding.php
 *
 * Demo data stack (in dependency order):
 *   UserSeeder        → staff accounts (admin, medical, deputy super admin)
 *   ApplicantSeeder   → 6 families with campers and emergency contacts
 *   CampSeeder        → Camp Burnt Gin + 3 sessions
 *   ApplicationSeeder → applications across all status variants
 *   MedicalSeeder     → diagnoses, allergies, medications, treatment logs
 *   DocumentSeeder    → document metadata records (no actual files)
 *   MessageSeeder     → inbox conversations and messages
 *   AnnouncementSeeder → announcements, calendar events, audit log entries
 *   NotificationSeeder → database notifications for demo applicant accounts
 *
 * Environment flags (config/seeding.php / .env):
 *   ENABLE_DEMO_DATA          — master switch (default: true)
 *   ENABLE_MEDICAL_SEEDS      — medical data including treatment logs (default: true)
 *   ENABLE_DOCUMENT_SEEDS     — document metadata records (default: true)
 *   ENABLE_NOTIFICATION_SEEDS — database notifications (default: true)
 *
 * Reset (local dev only):
 *   php artisan migrate:fresh --seed
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // CRITICAL: Roles must be seeded first — all users require a role_id.
        $this->call(RoleSeeder::class);

        // System configuration data — always seeded in all environments.
        $this->call([
            RequiredDocumentRuleSeeder::class,
            ActivityPermissionSeeder::class,
        ]);

        // Bootstrap super admin — always created; this is the only account
        // that must exist in production before any staff can log in.
        $superAdminRole = Role::where('name', 'super_admin')->first();

        User::firstOrCreate(
            ['email' => 'admin@campburntgin.org'],
            [
                'name'              => 'Super Administrator',
                'role_id'           => $superAdminRole->id,
                'password'          => Hash::make('ChangeThisPassword123!'),
                'email_verified_at' => now(),
            ]
        );

        // Demo data — non-production environments only.
        if (app()->environment('production')) {
            $this->command->info('Production environment — demo data skipped.');
            $this->printSummary();
            return;
        }

        if (! config('seeding.enable_demo_data', true)) {
            $this->command->warn('Demo data disabled (ENABLE_DEMO_DATA=false).');
            $this->printSummary();
            return;
        }

        $this->command->info('Seeding demo data stack...');

        // Core demo data — always together (each depends on the previous).
        $this->call([
            UserSeeder::class,        // staff accounts
            ApplicantSeeder::class,   // 6 families + campers + emergency contacts
            CampSeeder::class,        // camp + 3 sessions
            ApplicationSeeder::class, // all status variants
        ]);

        // Medical data — diagnoses, allergies, medications, treatment logs.
        if (config('seeding.enable_medical_seeds', true)) {
            $this->call(MedicalSeeder::class);
        } else {
            $this->command->warn('Medical seeds disabled (ENABLE_MEDICAL_SEEDS=false).');
        }

        // Document metadata records (no actual files on disk).
        if (config('seeding.enable_document_seeds', true)) {
            $this->call(DocumentSeeder::class);
        } else {
            $this->command->warn('Document seeds disabled (ENABLE_DOCUMENT_SEEDS=false).');
        }

        // Messaging and announcements — depend on users + applications.
        $this->call([
            MessageSeeder::class,      // inbox conversations + messages
            AnnouncementSeeder::class, // announcements + calendar + audit log
        ]);

        // Database notifications — depend on users + applications.
        if (config('seeding.enable_notification_seeds', true)) {
            $this->call(NotificationSeeder::class);
        } else {
            $this->command->warn('Notification seeds disabled (ENABLE_NOTIFICATION_SEEDS=false).');
        }

        $this->printSummary();
    }

    private function printSummary(): void
    {
        $this->command->newLine();
        $this->command->info('Database seeding completed successfully.');
        $this->command->newLine();
        $this->command->warn('SECURITY WARNING: Change the super admin password immediately!');
        $this->command->warn('  Email: admin@campburntgin.org');
        $this->command->warn('  Default password: ChangeThisPassword123!');

        if (! app()->environment('production') && config('seeding.enable_demo_data', true)) {
            $this->command->newLine();
            $this->command->line('  Demo accounts (password: <comment>password</comment>):');
            $this->command->line('  Admin:   admin@example.com');
            $this->command->line('  Medical: medical@example.com');
            $this->command->line('  Deputy:  admin2@campburntgin.org');
            $this->command->line('  Parents: sarah.johnson@example.com');
            $this->command->line('           david.martinez@example.com');
            $this->command->line('           jennifer.thompson@example.com');
            $this->command->line('           michael.williams@example.com');
            $this->command->line('           patricia.davis@example.com');
            $this->command->line('           grace.wilson@example.com');
        }
    }
}
