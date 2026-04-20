<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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
        // Rename orphaned 'camping' rows (no matching 'camp_out') to 'camp_out'
        DB::statement("
            UPDATE activity_permissions ap
            LEFT JOIN activity_permissions ap2
                ON ap2.camper_id = ap.camper_id AND ap2.activity_name = 'camp_out'
            SET ap.activity_name = 'camp_out'
            WHERE ap.activity_name = 'camping'
              AND ap2.id IS NULL
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
