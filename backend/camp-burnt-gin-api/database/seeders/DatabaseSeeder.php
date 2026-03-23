<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * DatabaseSeeder — scenario-driven orchestrator for Camp Burnt Gin.
 *
 * This seeder turns the database into a full simulation of the system.
 * Every record exists for a reason. Every scenario is documented.
 *
 * ─── EXECUTION TIERS ────────────────────────────────────────────────────────
 *
 *   Tier 1 — System bootstrap (production-safe, always runs)
 *     RoleSeeder              → 4 roles (super_admin, admin, applicant, medical)
 *     Super admin account     → admin@campburntgin.org (inline, production bootstrap)
 *
 *   Tier 2 — People and structure (dev/staging only)
 *     StaffSeeder             → 7 staff accounts + 2 edge-case accounts (inactive, locked)
 *     CampSeeder              → Camp Burnt Gin + 3 sessions (1 past, 2 upcoming)
 *     FamilySeeder            → 8 applicant families with campers and emergency contacts
 *
 *   Tier 3 — Application workflow scenarios (all 6 statuses + draft + paper)
 *     ApplicationSeeder       → 14 applications covering every status and edge case
 *
 *   Tier 4 — Medical data scenarios (5 complexity tiers + all medical states)
 *     MedicalSeeder           → Records, diagnoses, allergies, medications, treatment logs
 *     MedicalPhase11Seeder    → Incidents, visits, follow-ups, restrictions (Phase 11)
 *     TreatmentLogSeeder      → Visit-linked treatment log entries
 *     CamperProfileSeeder     → Behavioral profiles, assistive devices, feeding plans
 *     ExtendedMedicalRecordSeeder → Seizure data, activity permission overrides
 *     MedicalCrossLinkSeeder  → Incident/follow-up cross-links; restrictions for Ava+Mia
 *
 *   Tier 5 — Communication and operations
 *     DocumentSeeder          → Document metadata records (no actual files)
 *     ApplicantDocumentSeeder → Admin-to-applicant documents (3 states)
 *     DocumentRequestSeeder   → Full document request lifecycle (7 states)
 *     ProviderLinkSeeder      → Medical provider link workflow (all lifecycle states)
 *     MessagingSeeder         → Conversations, messages, read receipts
 *     AnnouncementSeeder      → Announcements + calendar events
 *     AuditLogSeeder          → Audit trail entries (35 entries, all categories)
 *     NotificationSeeder      → Database notifications
 *
 *   Tier 6 — System configuration (always runs, safe to repeat)
 *     RequiredDocumentRuleSeeder → Required document rule definitions
 *     ActivityPermissionSeeder   → System activity permission defaults
 *     FormDefinitionSeeder       → Phase 14 dynamic form schema v1
 *
 * ─── SCENARIO COVERAGE ──────────────────────────────────────────────────────
 *
 *   Application statuses   : pending, under_review, approved, rejected, cancelled, waitlisted
 *   Draft applications     : 2 (Mia returning draft, Olivia new family draft)
 *   Paper application      : 1 (Henry Carter — admin-entered from physical form)
 *   Medical complexity     : no record, partial, complete (mild/moderate/severe)
 *   Family structures      : single child, multi-child, returning, new, mixed outcomes
 *   Session distribution   : past, upcoming × 2, capacity variation
 *   Admin interactions     : reviewed, pending, rejected, waitlisted with notes
 *   Edge-case accounts     : inactive user, locked-out user, MFA-enabled admin
 *
 * ─── RESET (local dev only) ─────────────────────────────────────────────────
 *
 *   php artisan migrate:fresh --seed
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── Tier 1: System bootstrap ──────────────────────────────────────────
        // Roles must be seeded first — every user record requires a role_id.
        $this->call(RoleSeeder::class);

        // System configuration — safe to run in all environments.
        $this->call([
            RequiredDocumentRuleSeeder::class,
            ActivityPermissionSeeder::class,
            FormDefinitionSeeder::class,
        ]);

        // Super admin — the only account that must exist before any staff can log in.
        // This runs in production too. Change the password immediately after deploy.
        $this->bootstrapSuperAdmin();

        // ── Production gate ───────────────────────────────────────────────────
        if (app()->environment('production')) {
            $this->command->info('Production environment — demo data skipped.');
            $this->printProductionSummary();
            return;
        }

        // ── Tier 2: People and structure ──────────────────────────────────────
        $this->command->info('Seeding people and structure...');
        $this->call([
            StaffSeeder::class,                  // 7 staff + 2 edge-case accounts (inactive, locked)
            CampSeeder::class,                   // Camp Burnt Gin + 3 sessions (1 past, 2 upcoming)
            FamilySeeder::class,                 // 30 applicant families with campers
            ExtendedEmergencyContactSeeder::class, // secondary/edge-case emergency contacts
        ]);

        // ── Tier 3: Application workflow scenarios ────────────────────────────
        $this->command->info('Seeding application scenarios...');
        $this->call(ApplicationSeeder::class);

        // ── Tier 4: Medical data scenarios ────────────────────────────────────
        $this->command->info('Seeding medical data scenarios...');
        $this->call([
            MedicalSeeder::class,              // core records, diagnoses, medications, treatment logs
            MedicalPhase11Seeder::class,       // incidents, visits, follow-ups, restrictions
            TreatmentLogSeeder::class,         // visit-linked treatment logs (all 5 types)
            CamperProfileSeeder::class,        // behavioral profiles, assistive devices, feeding plans
            ExtendedMedicalRecordSeeder::class, // seizure data, activity permission overrides
            MedicalCrossLinkSeeder::class,     // incident/follow-up cross-links
        ]);

        // ── Tier 5: Communication and operations ──────────────────────────────
        $this->command->info('Seeding communication and documents...');
        $this->call([
            // Documents
            DocumentSeeder::class,              // uploaded document metadata (no real files)
            ApplicantDocumentSeeder::class,     // admin-to-applicant docs (pending/submitted/reviewed)
            DocumentRequestSeeder::class,       // full document request lifecycle (7 states)
            ProviderLinkSeeder::class,          // medical provider links (all lifecycle states)

            // Messaging — MessagingSeeder is the comprehensive replacement for
            // MessageSeeder + ExtendedMessageSeeder + MessageReadSeeder.
            // It covers 10 human threads + 4 system threads with read receipts.
            MessagingSeeder::class,

            // Admin content
            AnnouncementSeeder::class,          // announcements + calendar events
            AuditLogSeeder::class,              // 55+ audit entries across all 6 categories
            NotificationSeeder::class,          // database notifications
        ]);

        $this->printDemoSummary();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function bootstrapSuperAdmin(): void
    {
        $superAdminRole = Role::where('name', 'super_admin')->firstOrFail();

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
    }

    private function printProductionSummary(): void
    {
        $this->command->newLine();
        $this->command->warn('SECURITY: Change the super admin password immediately!');
        $this->command->warn('  Email:    admin@campburntgin.org');
        $this->command->warn('  Password: ChangeThisPassword123!');
        $this->command->newLine();
    }

    private function printDemoSummary(): void
    {
        $this->command->newLine();
        $this->command->info('✓ Database seeded — full scenario simulation ready.');
        $this->command->newLine();

        $this->command->warn('SECURITY: Change the super admin password immediately!');
        $this->command->warn('  admin@campburntgin.org / ChangeThisPassword123!');
        $this->command->newLine();

        $this->command->line('<comment>Staff accounts</comment> (password: password):');
        $this->command->line('  Super Admin : admin@campburntgin.org         Jordan Blake (deputy)');
        $this->command->line('  Admin       : admin@example.com              Alex Rivera');
        $this->command->line('  Coordinator : admin3@campburntgin.org        Taylor Brooks');
        $this->command->line('  Medical Dir : medical@example.com            Dr. Morgan Chen');
        $this->command->line('  Nurse       : medical2@campburntgin.org      Jamie Santos RN');
        $this->command->line('  MFA Admin   : mfa.admin@campburntgin.org     Dana Forsythe (TOTP required)');
        $this->command->newLine();

        $this->command->line('<comment>Applicant accounts</comment> (password: password):');
        $this->command->line('  sarah.johnson@example.com        Ethan (approved S1) + Lily (pending S2)');
        $this->command->line('  david.martinez@example.com       Sofia (under review S1)');
        $this->command->line('  jennifer.thompson@example.com    Noah (rejected S1, pending S2)');
        $this->command->line('  michael.williams@example.com     Ava (approved S2) + Lucas (pending S1)');
        $this->command->line('  patricia.davis@example.com       Mia (past approved + 2026 draft)');
        $this->command->line('  grace.wilson@example.com         Tyler (waitlisted S1)');
        $this->command->line('  james.carter@example.com         Henry (paper app approved S1 + pending S2)');
        $this->command->line('  michelle.robinson@example.com    Olivia (draft S2 — no medical data)');
        $this->command->newLine();

        $this->command->line('<comment>Edge-case accounts</comment>:');
        $this->command->line('  inactive@example.com             Login denied (is_active=false)');
        $this->command->line('  locked.applicant@example.com     Login denied (lockout active)');
        $this->command->newLine();

        $this->command->line('<comment>Application status coverage</comment>:');
        $this->command->line('  pending      : Lily (S2), Lucas (S1), Noah (S2), Henry (S2)');
        $this->command->line('  under_review : Sofia (S1)');
        $this->command->line('  approved     : Ethan (S1), Ava (S2), Mia (2025), Henry (S1)');
        $this->command->line('  rejected     : Noah (S1 — capacity)');
        $this->command->line('  cancelled    : Lucas (S2 — draft abandoned)');
        $this->command->line('  waitlisted   : Tyler (S1 — on waitlist, promotable)');
        $this->command->line('  draft        : Mia (S1 2026 in-progress), Olivia (S2 brand new)');
        $this->command->newLine();
    }
}
