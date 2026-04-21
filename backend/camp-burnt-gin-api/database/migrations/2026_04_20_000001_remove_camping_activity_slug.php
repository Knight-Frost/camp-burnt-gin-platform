<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Remove the orphaned 'camping' activity_permission rows.
 *
 * The backend completeness engine never required 'camping' from the frontend —
 * only 'camp_out'. The 'camping' slug was mistakenly added to
 * ApplicationCompletenessService::CANONICAL_ACTIVITIES and ActivityPermissionSeeder,
 * causing the activities section to be permanently INCOMPLETE for all applications.
 *
 * This migration soft-cleans the data: deletes any 'camping' rows only when a
 * 'camp_out' row already exists for the same camper (so no camper loses their
 * overnight-camping permission). Orphaned 'camping' rows without a 'camp_out'
 * partner are renamed to 'camp_out' rather than deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Rename orphaned 'camping' rows (no matching 'camp_out') to 'camp_out'.
        // Written as a subquery rather than UPDATE...JOIN so the statement runs
        // on both MySQL (production) and SQLite (CI test suite).
        DB::statement("
            UPDATE activity_permissions
            SET activity_name = 'camp_out'
            WHERE activity_name = 'camping'
              AND NOT EXISTS (
                SELECT 1 FROM activity_permissions ap2
                WHERE ap2.camper_id = activity_permissions.camper_id
                  AND ap2.activity_name = 'camp_out'
              )
        ");

        // Delete remaining 'camping' rows (camp_out already exists for this camper)
        DB::table('activity_permissions')
            ->where('activity_name', 'camping')
            ->delete();
    }

    public function down(): void
    {
        // Not reversible — the 'camping' slug should not be reintroduced.
    }
};
