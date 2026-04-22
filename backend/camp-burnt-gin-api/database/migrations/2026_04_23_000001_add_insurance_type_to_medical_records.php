<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Add an `insurance_type` enum to medical_records so "No insurance" is a
 * first-class answer rather than an unanswered state.
 *
 * Before this migration, the completeness engine required either an
 * insurance_provider OR a medicaid_number to be present. A parent who
 * selected "No insurance" on the Health form cleared both fields, which
 * left the engine perpetually reporting the section as missing insurance
 * — the bug behind the "Health never turns green" forensic audit.
 *
 * After this migration:
 *   - insurance_type = 'none'     → parent explicitly has no insurance (complete)
 *   - insurance_type = 'medicaid' → medicaid_number also required
 *   - insurance_type = 'other'    → insurance_provider also required
 *   - insurance_type = null       → unanswered (incomplete)
 *
 * The column is unencrypted on purpose: the enum values are not PHI and we
 * want them available to SQL audit queries without round-tripping through
 * application-layer decryption.
 *
 * Backfill policy:
 *   - Rows with a non-null insurance_provider → 'other'
 *   - Rows with only a non-null medicaid_number → 'medicaid'
 *   - Rows with neither → LEFT NULL (they need a real parent answer).
 *
 * We deliberately do not map "no insurance data" → 'none' because that
 * would convert the existing phantom-incomplete state into a
 * phantom-complete state. The parent must explicitly pick "No insurance"
 * for those rows.
 *
 * Encrypted columns must be read through Eloquent (raw SQL decryption
 * is not possible), so the backfill loops model instances instead of
 * running a single UPDATE.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->enum('insurance_type', ['none', 'medicaid', 'other'])
                ->nullable()
                ->after('medicaid_number');
        });

        // Backfill existing rows.
        //
        // Reads decrypt through the cast layer, so we have to iterate records
        // rather than run a SQL-level UPDATE. For a production DB this is
        // linear in rows; seeder datasets are small. Production volumes are
        // well under the size where chunking matters, but we chunk anyway
        // for safety.
        \App\Models\MedicalRecord::query()
            ->whereNull('insurance_type')
            ->chunkById(200, function ($records) {
                foreach ($records as $mr) {
                    if (! empty($mr->insurance_provider)) {
                        $mr->insurance_type = 'other';
                    } elseif (! empty($mr->medicaid_number)) {
                        $mr->insurance_type = 'medicaid';
                    } else {
                        // Leave NULL — parent must answer.
                        continue;
                    }
                    // saveQuietly() to avoid firing Observers/Events during
                    // the migration (no audit noise, no notifications).
                    $mr->saveQuietly();
                }
            });
    }

    public function down(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->dropColumn('insurance_type');
        });
    }
};
