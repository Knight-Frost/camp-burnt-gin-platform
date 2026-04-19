<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Relax the hard unique constraint on (camper_id, camp_session_id).
 *
 * The original migration 2024_01_02_000002 added
 *     UNIQUE (camper_id, camp_session_id)
 * which treated every row the same — a rejected or withdrawn application
 * would permanently lock that slot and force admin intervention before the
 * applicant could reapply. The real business rule is:
 *
 *   • At most ONE active application per (camper, session).
 *     "Active" = draft OR status in (submitted, under_review, approved, waitlisted).
 *   • Any number of historical (final-state) rows may exist as audit trail.
 *
 * We drop the hard constraint and rely on the application-layer upsert gate
 * in ApplicationController::store(), which runs the existence check inside
 * DB::transaction with SELECT ... FOR UPDATE. That serialises concurrent
 * POSTs for the same (camper, session) pair and enforces the rule correctly
 * without needing a partial index — which MySQL 8 does not support natively.
 *
 * The composite index is kept (non-unique) so the existence lookup stays
 * fast after the drop.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Create the replacement composite index FIRST. On MySQL, a foreign
        // key may reference the columns of the soon-to-be-dropped unique
        // index; dropping the unique index before an equivalent index exists
        // raises "Cannot drop index … needed in a foreign key constraint".
        // Creating the lookup index first lets MySQL silently re-point the FK
        // to the new index, and the drop then succeeds.
        Schema::table('applications', function ($table) {
            $table->index(
                ['camper_id', 'camp_session_id'],
                'applications_camper_session_lookup',
            );
        });

        Schema::table('applications', function ($table) {
            // Laravel's default unique-index name for (a, b) columns is
            // "<table>_<a>_<b>_unique". Passing the column array lets
            // dropUnique resolve it without guessing the driver quoting.
            $table->dropUnique(['camper_id', 'camp_session_id']);
        });
    }

    public function down(): void
    {
        Schema::table('applications', function ($table) {
            $table->dropIndex('applications_camper_session_lookup');
        });

        // If duplicate historical rows accumulated while the constraint was
        // relaxed, the restore will fail. Callers can detect and merge them
        // with the query below before re-running the down migration:
        //
        //   SELECT camper_id, camp_session_id, COUNT(*)
        //     FROM applications
        //    GROUP BY camper_id, camp_session_id
        //   HAVING COUNT(*) > 1;
        Schema::table('applications', function ($table) {
            $table->unique(['camper_id', 'camp_session_id']);
        });
    }
};
