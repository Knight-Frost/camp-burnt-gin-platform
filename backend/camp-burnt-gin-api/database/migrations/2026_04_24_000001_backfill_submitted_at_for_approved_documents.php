<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Backfill submitted_at on approved documents that were approved directly from
 * draft state (submitted_at IS NULL). DocumentEnforcementService requires
 * submitted_at IS NOT NULL for admin compliance checks, so these rows were
 * invisible to the approval gate and caused phantom "missing document" warnings.
 *
 * Uses approved_at as the best available proxy for the submission timestamp.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('documents')
            ->whereNull('submitted_at')
            ->where('verification_status', 'approved')
            ->whereNotNull('approved_at')
            ->update(['submitted_at' => DB::raw('approved_at')]);
    }

    public function down(): void
    {
        // Not reversible — we cannot distinguish rows backfilled here from
        // rows that legitimately had submitted_at = approved_at before.
    }
};
