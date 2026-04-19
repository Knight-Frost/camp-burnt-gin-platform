<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * DatabaseSeeder — mode router for Camp Burnt Gin.
 *
 * Reads the SEED_MODE environment variable and delegates to the appropriate
 * seeder. This class contains no seeding logic of its own.
 *
 * ─── MODES ───────────────────────────────────────────────────────────────────
 *
 *   SEED_MODE=demo  (default when unset)  →  DemoSeeder
 *     Clean demo with 4 accounts and 2 fully-completed draft applications.
 *     Super admin + admin + medical staff + 1 applicant (Angela Thornton).
 *     2 campers: Marcus (ASD/ADHD) and Destiny (Sickle Cell) — both DRAFT.
 *     Use for: demos, onboarding, applicant portal testing.
 *
 *   SEED_MODE=super_admin_only  →  MinimalSeeder
 *     System configuration only: roles, document rules, risk engine, and one
 *     super_admin account. No test data of any kind.
 *     Use for: first production deployment, clean-slate staging environments.
 *
 *   SEED_MODE=full  →  FullSimulationSeeder
 *     Complete scenario simulation. 5 tiers, ~76 campers, all application
 *     statuses, all medical complexity tiers, 14 edge cases, messaging,
 *     notifications, audit logs, documents.
 *     Use for: development, QA, feature demonstration.
 *
 * ─── COMMANDS ────────────────────────────────────────────────────────────────
 *
 *   Demo mode (default):
 *     php artisan migrate:fresh --seed
 *     SEED_MODE=demo php artisan migrate:fresh --seed
 *
 *   Super admin only (production bootstrap):
 *     SEED_MODE=super_admin_only php artisan migrate:fresh --seed
 *
 *   Full simulation (development/QA):
 *     SEED_MODE=full php artisan migrate:fresh --seed
 *
 *   Run a specific seeder directly (bypasses this router):
 *     php artisan db:seed --class=DemoSeeder
 *     php artisan db:seed --class=MinimalSeeder
 *     php artisan db:seed --class=FullSimulationSeeder
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $mode = env('SEED_MODE', 'demo');

        match ($mode) {
            'super_admin_only' => $this->runMode('super admin only', MinimalSeeder::class),
            'full'             => $this->runMode('full simulation', FullSimulationSeeder::class),
            default            => $this->runMode('demo', DemoSeeder::class),
        };
    }

    private function runMode(string $label, string $seederClass): void
    {
        $this->command->info("Seed mode: {$label}");
        $this->call($seederClass);
    }
}
