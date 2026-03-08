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
 *   1. Roles                       — always (required for all user creation)
 *   2. System data                 — always (document rules, activity permissions)
 *   3. Super admin account         — always (production-safe bootstrap)
 *   4. Core demo data stack        — non-production, controlled by config/seeding.php
 *   5. Extended scenario stack     — non-production, adds edge cases and missing coverage
 *
 * Core demo data stack (in dependency order):
 *   UserSeeder             → staff accounts (admin, medical, deputy super admin)
 *   ApplicantSeeder        → 6 families with campers and emergency contacts
 *   CampSeeder             → Camp Burnt Gin + 3 sessions
 *   ApplicationSeeder      → applications across all status variants
 *   MedicalSeeder          → diagnoses, allergies, medications
 *   MedicalPhase11Seeder   → incidents, visits, follow-ups, restrictions
 *   TreatmentLogSeeder     → 12 treatment log entries (all 5 types, 8 campers)
 *   DocumentSeeder         → document metadata records (no actual files)
 *   MessageSeeder          → inbox conversations and messages
 *   AnnouncementSeeder     → announcements, calendar events, audit log entries
 *   NotificationSeeder     → database notifications for demo applicant accounts
 *
 * Extended scenario stack (runs after core stack; adds missing coverage):
 *   ExtendedUserSeeder            → inactive, locked, MFA users; address data; user emergency contacts
 *   WaitlistedApplicationSeeder   → waitlisted, draft, paper-entered, and returning-applicant applications
 *   ExtendedEmergencyContactSeeder → secondary contacts, non-pickup contacts
 *   ProviderLinkSeeder            → medical provider link workflow (all lifecycle states)
 *   CamperProfileSeeder           → behavioral profiles, assistive devices, feeding plans
 *   ExtendedMedicalRecordSeeder   → has_seizures fields; activity permission overrides (restricted/denied)
 *   ExtendedMessageSeeder         → medical staff threads, archived conversation, long thread, unanswered
 *   ExtendedAuditLogSeeder        → comprehensive audit log entries across all categories
 *   ExtendedNotificationSeeder    → admin, medical, and additional applicant notifications
 *
 * Environment flags (config/seeding.php / .env):
 *   ENABLE_DEMO_DATA          — master switch (default: true)
 *   ENABLE_MEDICAL_SEEDS      — medical data including treatment logs (default: true)
 *   ENABLE_DOCUMENT_SEEDS     — document metadata records (default: true)
 *   ENABLE_NOTIFICATION_SEEDS — database notifications (default: true)
 *   ENABLE_EXTENDED_SEEDS     — extended edge-case scenario stack (default: true)
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
                'is_active'         => true,
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

        $this->command->info('Seeding core demo data stack...');

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
            $this->call(MedicalPhase11Seeder::class); // incidents, visits, follow-ups, restrictions
            $this->call(TreatmentLogSeeder::class);   // treatment log entries (all types)
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

        // ── Extended scenario stack ────────────────────────────────────────────
        // Adds edge cases, missing coverage, and full workflow simulation on top
        // of the core demo stack. Depends on all core seeders having run.

        if (config('seeding.enable_extended_seeds', true)) {
            $this->command->info('Seeding extended scenario stack...');

            $this->call([
                // User variety: inactive, locked, MFA-enabled, address data, user emergency contacts
                ExtendedUserSeeder::class,

                // Applications: waitlisted, pure draft, paper-entered, returning-applicant
                // Also creates Henry Carter (new family) for paper app scenario
                WaitlistedApplicationSeeder::class,

                // Secondary and edge-case emergency contacts
                ExtendedEmergencyContactSeeder::class,

                // Medical provider links: all lifecycle states (active, accessed, submitted, expired, revoked)
                ProviderLinkSeeder::class,

                // Behavioral profiles, assistive devices, feeding plans for all campers
                CamperProfileSeeder::class,

                // Fill has_seizures fields in MedicalRecord + override activity permissions
                // with realistic restricted/denied entries (not all-yes defaults)
                ExtendedMedicalRecordSeeder::class,

                // More conversations: medical staff threads, archived, long-thread, unanswered, internal
                ExtendedMessageSeeder::class,

                // Comprehensive audit log entries (~35 entries across all event categories)
                ExtendedAuditLogSeeder::class,

                // Admin, medical staff, and additional applicant notifications
                ExtendedNotificationSeeder::class,
            ]);
        } else {
            $this->command->warn('Extended seeds disabled (ENABLE_EXTENDED_SEEDS=false).');
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
            $this->command->line('  Staff accounts (password: <comment>password</comment>):');
            $this->command->line('  Admin:    admin@example.com');
            $this->command->line('  Medical:  medical@example.com');
            $this->command->line('  Medical2: medical2@campburntgin.org  (Nurse Jamie Santos)');
            $this->command->line('  Coord:    admin3@campburntgin.org    (Taylor Brooks)');
            $this->command->line('  Deputy:   admin2@campburntgin.org');
            $this->command->line('  MFA:      mfa.admin@campburntgin.org (MFA-enabled, TOTP required)');
            $this->command->newLine();
            $this->command->line('  Edge-state accounts:');
            $this->command->line('  Inactive: inactive@example.com       (is_active=false, login denied)');
            $this->command->line('  Locked:   locked.applicant@example.com (lockout active)');
            $this->command->newLine();
            $this->command->line('  Applicant accounts (password: <comment>password</comment>):');
            $this->command->line('  sarah.johnson@example.com        (Ethan + Lily — approved/pending)');
            $this->command->line('  david.martinez@example.com       (Sofia — under review)');
            $this->command->line('  jennifer.thompson@example.com    (Noah — rejected/S1, pending/S2)');
            $this->command->line('  michael.williams@example.com     (Ava + Lucas — approved + pending)');
            $this->command->line('  patricia.davis@example.com       (Mia — past approved + 2026 draft)');
            $this->command->line('  grace.wilson@example.com         (Tyler — waitlisted)');
            $this->command->line('  james.carter@example.com         (Henry — paper application)');
            $this->command->newLine();
            $this->command->line('  Provider link states:');
            $this->command->line('  Sofia → Dr. Owens  : active, not accessed');
            $this->command->line('  Tyler → Dr. Bradley: active, accessed not submitted');
            $this->command->line('  Noah  → Dr. Kim    : submitted');
            $this->command->line('  Lucas → Dr. Gonzalez: expired (no submission)');
            $this->command->line('  Mia   → Dr. Patel  : revoked');
            $this->command->line('  Lily  → Dr. Hill   : active (just sent today)');
        }
    }
}
