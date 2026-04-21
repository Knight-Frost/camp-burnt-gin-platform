<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 8: Drop the legacy is_draft column from applications.
 *
 * Migration 000003 (normalize_application_status_draft) converted all
 * is_draft=true rows to status='draft' and changed the column default.
 * After a verification window, this migration removes the column entirely.
 *
 * The status column is now the sole lifecycle truth for draft/submitted state.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            // Drop the dedicated index first (added in 2026_02_05_000003).
            // MySQL requires this before the column can be dropped.
            $table->dropIndex(['is_draft']);
            $table->dropColumn('is_draft');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->boolean('is_draft')->default(false)->after('status');
            $table->index('is_draft');
        });
    }
};
