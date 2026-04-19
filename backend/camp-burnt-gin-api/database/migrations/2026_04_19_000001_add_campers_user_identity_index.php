<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Campers — add a composite lookup index on
 * (user_id, first_name, last_name, date_of_birth).
 *
 * Purpose: make the findOrCreate path in CamperController::store fast
 * (the tuple is how the controller now detects existing camper identities).
 *
 * Why NOT a DB unique constraint:
 *   HIPAA retention requires soft-deletes, so multiple soft-deleted rows may
 *   share the same identity tuple. MySQL's UNIQUE with a nullable deleted_at
 *   allows multiple NULL values by design, which would permit duplicate live
 *   rows — defeating the whole point. MySQL 8 also refuses to use the auto-
 *   increment id column inside a functional index expression, closing off
 *   the clean "CASE WHEN deleted_at IS NULL THEN 0 ELSE id END" approach.
 *
 *   Uniqueness is therefore enforced at the application layer:
 *     - CamperController::store() — findOrCreate by identity tuple (returns
 *       the existing row rather than creating a duplicate).
 *     - Camper::findOrCreateForUser() helper for other callers.
 *     - CamperIdentityUniquenessTest — regression coverage that the invariant
 *       holds under concurrent and sequential creation.
 *
 *   The ongoing MergeDuplicateCampers command is a safety net for legacy data
 *   or edge cases where a duplicate slips through.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Idempotent: a previous migration attempt may have partially created
        // this index before failing on an unrelated statement. Skip if it's
        // already there.
        if ($this->indexExists('campers', 'campers_user_identity_lookup')) {
            return;
        }

        Schema::table('campers', function (Blueprint $table) {
            $table->index(
                ['user_id', 'first_name', 'last_name', 'date_of_birth'],
                'campers_user_identity_lookup',
            );
        });
    }

    public function down(): void
    {
        if (! $this->indexExists('campers', 'campers_user_identity_lookup')) {
            return;
        }

        Schema::table('campers', function (Blueprint $table) {
            $table->dropIndex('campers_user_identity_lookup');
        });
    }

    private function indexExists(string $table, string $index): bool
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return false;
        }

        return DB::selectOne(
            'SELECT 1 AS present FROM information_schema.STATISTICS '
            .'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
            [$table, $index],
        ) !== null;
    }
};
