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
        // Campers that already have a 'camp_out' row — their 'camping' row is a
        // duplicate and must be deleted rather than renamed.
        // Uses two queries instead of UPDATE/DELETE...JOIN so it runs on both
        // MySQL and SQLite (Laravel CI test suite uses SQLite :memory:).
        $camperIdsWithCampOut = DB::table('activity_permissions')
            ->where('activity_name', 'camp_out')
            ->pluck('camper_id');

        if ($camperIdsWithCampOut->isNotEmpty()) {
            DB::table('activity_permissions')
                ->where('activity_name', 'camping')
                ->whereIn('camper_id', $camperIdsWithCampOut)
                ->delete();
        }

        // Orphaned 'camping' rows (no 'camp_out' partner) — rename to 'camp_out'
        // so the camper retains their overnight-camping permission.
        DB::table('activity_permissions')
            ->where('activity_name', 'camping')
            ->update(['activity_name' => 'camp_out']);
    }

    public function down(): void
    {
        // Not reversible — the 'camping' slug should not be reintroduced.
    }
};
