<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Session Scoping for Medical Operational Tables — Phase 18
 *
 * Adds an optional camp_session_id FK to all operational medical tables.
 * Nullable so existing records remain valid (historical continuity preserved).
 *
 * Affected tables: medical_incidents, medical_visits, treatment_logs, medical_follow_ups
 *
 * With this FK, medical staff can filter incidents/visits/treatments by the
 * active session — eliminating cross-session data bleed in multi-session environments.
 */
return new class extends Migration
{
    public function up(): void
    {
        $tables = [
            'medical_incidents',
            'medical_visits',
            'treatment_logs',
            'medical_follow_ups',
        ];

        foreach ($tables as $table) {
            Schema::table($table, function (Blueprint $blueprint) use ($table) {
                // Nullable: historical records without a session remain valid.
                $blueprint->foreignId('camp_session_id')
                    ->nullable()
                    ->after('camper_id')
                    ->constrained('camp_sessions')
                    ->nullOnDelete();

                // Index for fast session-scoped queries.
                $blueprint->index('camp_session_id', "{$table}_session_idx");
            });
        }
    }

    public function down(): void
    {
        $tables = [
            'medical_follow_ups',
            'treatment_logs',
            'medical_visits',
            'medical_incidents',
        ];

        foreach ($tables as $table) {
            Schema::table($table, function (Blueprint $blueprint) use ($table) {
                $blueprint->dropForeign(["{$table}_camp_session_id_foreign"]);
                $blueprint->dropIndex("{$table}_session_idx");
                $blueprint->dropColumn('camp_session_id');
            });
        }
    }
};
