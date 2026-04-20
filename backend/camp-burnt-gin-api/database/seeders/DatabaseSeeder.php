<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * DatabaseSeeder — seed mode router for Camp Burnt Gin.
 *
 * Reads SEED_MODE from the environment and delegates to the appropriate seeder.
 * This class contains no seeding logic of its own.
 *
 * ─── MODES ───────────────────────────────────────────────────────────────────
 *
 *   SEED_MODE=demo  (default)
 *     → DemoSeeder
 *     Polished small dataset for stakeholder demos and onboarding.
 *     5 accounts, 3 campers, 3 applications (approved/submitted/under_review),
 *     documents and medical records for the approved camper.
 *     Best for: demos, presentations, first-time dev setup, applicant portal testing.
 *
 *   SEED_MODE=development
 *     → FullSimulationSeeder
 *     Complete scenario simulation. ~76 campers across ~62 families. Every
 *     application status, medical complexity tier, edge case, and messaging
 *     scenario. Full audit logs, notifications, deadlines, and document states.
 *     Best for: day-to-day development, QA, feature work, dashboard/filter testing.
 *
 *   SEED_MODE=minimal
 *     → MinimalSeeder
 *     System configuration only: roles, document rules, activity permissions,
 *     form definitions, risk engine, and one super_admin account. No test data.
 *     Best for: first production deployment, clean-slate staging environments.
 *
 *   SEED_MODE=full  (alias for development — backward compatibility)
 *     → FullSimulationSeeder
 *
 * ─── COMMANDS ────────────────────────────────────────────────────────────────
 *
 *   Demo (default — good starting point for all developers):
 *     php artisan migrate:fresh --seed
 *     SEED_MODE=demo php artisan migrate:fresh --seed
 *
 *   Full development dataset:
 *     SEED_MODE=development php artisan migrate:fresh --seed
 *
 *   Production bootstrap (super admin only):
 *     SEED_MODE=minimal php artisan migrate:fresh --seed
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
            'minimal' => $this->runMode('minimal', MinimalSeeder::class),
            'development', 'full' => $this->runMode('development', FullSimulationSeeder::class),
            default => $this->runMode('demo', DemoSeeder::class),
        };
    }

    private function runMode(string $label, string $seederClass): void
    {
        $this->command->info("Seed mode: {$label}");
        $this->call($seederClass);
    }
}
