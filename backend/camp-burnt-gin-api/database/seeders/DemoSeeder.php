<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * DemoSeeder — clean, demo-ready baseline for development and demonstrations.
 *
 * Builds on MinimalSeeder (system infrastructure + super admin).
 *
 * ─── WHAT IS CREATED ────────────────────────────────────────────────────────
 *
 *   MinimalSeeder:
 *     RoleSeeder                 → 4 RBAC roles
 *     RequiredDocumentRuleSeeder → document compliance rules
 *     ActivityPermissionSeeder   → system activity permission defaults
 *     FormDefinitionSeeder       → dynamic form schema v1
 *     RiskEngineSeeder           → risk scoring factors and thresholds
 *     Super admin account        → admin@campburntgin.org (or ADMIN_BOOTSTRAP_EMAIL)
 *
 * ─── HOW TO USE ─────────────────────────────────────────────────────────────
 *
 *   php artisan migrate:fresh --seed                  (default mode)
 *   SEED_MODE=demo php artisan migrate:fresh --seed
 *   php artisan db:seed --class=DemoSeeder
 *
 * ─── CREDENTIALS ─────────────────────────────────────────────────────────────
 *
 *   Super Admin: admin@campburntgin.org (or ADMIN_BOOTSTRAP_EMAIL) / (generated or ADMIN_BOOTSTRAP_PASSWORD)
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(MinimalSeeder::class);

        $this->command->newLine();
        $this->command->info('✓ Demo seed complete — system ready for demonstration.');
    }
}
