<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Soft-delete orphaned stub Camper records left by initializeDraft PATH B.
 *
 * When a parent starts a new application without an existing camper, PATH B
 * creates a real Camper row with first_name='New', last_name='Camper' as a
 * stub placeholder. If the parent then deletes the draft, the Application row
 * is deleted but the stub Camper was never cleaned up (bug fixed in
 * ApplicationController::destroy() today).
 *
 * This migration back-fills the cleanup for all stubs that accumulated before
 * the fix. We only target rows where:
 *   1. deleted_at IS NULL  (not already soft-deleted)
 *   2. No applications reference this camper (orphaned)
 *   3. first_name = 'New' AND last_name = 'Camper'  (definitively a stub)
 *
 * Condition (3) is intentionally conservative: campers whose Section 1 was
 * partially filled in (real name set) but who have no remaining applications
 * are left alone — a separate audit can handle them if needed.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::statement("
            UPDATE campers
            SET deleted_at = ?
            WHERE deleted_at IS NULL
              AND first_name = 'New'
              AND last_name  = 'Camper'
              AND NOT EXISTS (
                  SELECT 1 FROM applications WHERE applications.camper_id = campers.id
              )
        ", [$now]);
    }

    public function down(): void
    {
        // Restore only the rows this migration soft-deleted.
        // We identify them by: deleted_at was set today, still no applications,
        // and stub name. Any row soft-deleted before today is left untouched.
        // Use a PHP-side date binding instead of CURDATE() for SQLite compatibility.
        $today = now()->toDateString();

        DB::statement("
            UPDATE campers
            SET deleted_at = NULL
            WHERE first_name = 'New'
              AND last_name  = 'Camper'
              AND DATE(deleted_at) = ?
              AND NOT EXISTS (
                  SELECT 1 FROM applications WHERE applications.camper_id = campers.id
              )
        ", [$today]);
    }
};
