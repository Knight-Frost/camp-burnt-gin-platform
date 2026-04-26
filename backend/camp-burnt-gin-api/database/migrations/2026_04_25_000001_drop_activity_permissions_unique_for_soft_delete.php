<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Drop the unique(camper_id, activity_name) constraint on activity_permissions.
 *
 * The 2024-01-10 create migration added a UNIQUE index on
 * (camper_id, activity_name). The 2026-04-06 migration retro-fitted soft
 * deletes onto this table without dropping that constraint, so soft-deleted
 * rows still occupy the unique index. ApplicationSectionReplacer's
 * replaceListRelation pattern (soft-delete the camper's set, then re-create
 * the submitted set) collides on the SECOND save: the soft-deleted row
 * shares (camper_id, activity_name) with the new row, MySQL throws 1062,
 * the transaction rolls back, and sections_reviewed['activities'] is never
 * stamped — so the activities section never registers as complete (BUG-134).
 *
 * Uniqueness is enforced at the application layer: the replace pattern
 * deletes-then-recreates the entire set inside one DB::transaction, so
 * after each save there is exactly one live row per (camper, activity)
 * pair. No other code path writes to this table outside the replace
 * service and the merge-duplicate-campers admin command (which already
 * handles its own dedupe).
 *
 * The composite index on the same columns is left in place for query
 * performance; only the uniqueness is dropped.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activity_permissions', function (Blueprint $table) {
            $table->dropUnique(['camper_id', 'activity_name']);
            // Replace with a non-unique composite index so query plans on
            // (camper_id, activity_name) lookups are still optimal.
            $table->index(['camper_id', 'activity_name']);
        });
    }

    public function down(): void
    {
        Schema::table('activity_permissions', function (Blueprint $table) {
            $table->dropIndex(['camper_id', 'activity_name']);
            // Recreating the unique index will fail if soft-deleted
            // duplicates have accumulated. Operators rolling back must
            // first run: DELETE FROM activity_permissions WHERE deleted_at IS NOT NULL;
            $table->unique(['camper_id', 'activity_name']);
        });
    }
};
