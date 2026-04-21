<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Normalise application state to a single authoritative source of truth.
 *
 * Before this migration the system used two fields in tandem:
 *   is_draft (boolean) — true while parent is filling out the form
 *   status  (string)   — workflow label (defaulted to 'submitted' even for drafts)
 *
 * This produced the primary contradiction: is_draft=true AND status='submitted'
 * was the normal state for every in-progress application. The word "submitted"
 * appeared on rows that were explicitly not yet submitted.
 *
 * This migration:
 *   1. Adds 'draft' as a valid status value and converts all is_draft=true rows
 *      so their status reflects the real lifecycle state.
 *   2. Changes the column default from 'submitted' to 'draft' so new application
 *      rows correctly enter the draft state before finalize() is called.
 *
 * The is_draft column is NOT removed here — it stays for a verification window.
 * Phase 8 (separate PR) will drop the column after all code paths are confirmed
 * to read exclusively from status.
 *
 * Data safety: no rows are deleted. No non-draft rows are touched.
 * Rollback restores the original column default and reverts the status values.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Step 1: Every row where is_draft=true currently has status='submitted'
        // (the old column default). Correct those to status='draft' so the
        // status field alone unambiguously describes the lifecycle state.
        DB::statement("UPDATE applications SET status = 'draft' WHERE is_draft = 1");

        // Step 2: Change the column default. Before this, any INSERT without an
        // explicit status produced status='submitted' — including draft rows created
        // by initializeDraft(). After this, the default is 'draft', which is the
        // correct starting point for every new application row.
        Schema::table('applications', function (Blueprint $table) {
            $table->string('status')->default('draft')->change();
        });
    }

    public function down(): void
    {
        // Revert draft rows to the old dual-state representation.
        DB::statement("UPDATE applications SET status = 'submitted' WHERE is_draft = 1");

        Schema::table('applications', function (Blueprint $table) {
            $table->string('status')->default('submitted')->change();
        });
    }
};
