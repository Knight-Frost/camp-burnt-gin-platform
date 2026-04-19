<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Add a nullable application_id FK to application_drafts.
 *
 * Why:
 *   The old cleanup path in ApplicationController::finalize() deleted draft
 *   blobs by fuzzy `label LIKE %first_name%` string match. That was fragile
 *   — a nickname in the label, a typo, or the bland default "New
 *   Application" value allowed blobs to survive finalize, showing up as
 *   ghost drafts in the applicant list.
 *
 *   A hard FK is the durable fix: the ApplicationFormPage associates the
 *   blob with its Application as soon as the Application row is created
 *   (during the first storeDraft() call), and finalize() deletes blobs
 *   via application_id = $application->id. Exact, unambiguous, and safe
 *   from label drift.
 *
 * Why nullable:
 *   - The frontend may create a draft blob BEFORE creating the Application
 *     (e.g. the form starts with pure FormState autosave before the parent
 *     has enough data to call createApplication). In that brief window the
 *     FK is null.
 *   - Legacy blobs created before this migration have no application_id.
 *     They continue to be cleaned up by the label-match fallback in
 *     finalize() until they age out naturally.
 *
 * The cascadeOnDelete ensures that if the Application is hard-deleted, any
 * lingering blob goes with it.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Idempotent: skip if already added by a previous partial run.
        if (Schema::hasColumn('application_drafts', 'application_id')) {
            return;
        }

        Schema::table('application_drafts', function (Blueprint $table) {
            $table->foreignId('application_id')
                ->nullable()
                ->after('user_id')
                ->constrained('applications')
                ->nullOnDelete();
            $table->index('application_id', 'application_drafts_application_id_index');
        });

        // Best-effort backfill: for each draft blob, find the applicant's
        // most recent draft Application and link them. Blobs that can't be
        // confidently matched (user has no drafts, or has multiple
        // ambiguous drafts) stay with application_id = null.
        if (DB::getSchemaBuilder()->hasTable('applications')) {
            $sql = 'UPDATE application_drafts ad '
                .'SET application_id = ('
                .'  SELECT a.id FROM applications a '
                .'    INNER JOIN campers c ON c.id = a.camper_id '
                .'    WHERE c.user_id = ad.user_id '
                .'    AND a.is_draft = 1 '
                .'    AND c.deleted_at IS NULL '
                .'    ORDER BY a.updated_at DESC '
                .'    LIMIT 1'
                .') '
                .'WHERE application_id IS NULL';

            if (DB::connection()->getDriverName() === 'mysql') {
                DB::statement($sql);
            }
        }
    }

    public function down(): void
    {
        Schema::table('application_drafts', function (Blueprint $table) {
            $table->dropForeign(['application_id']);
            $table->dropIndex('application_drafts_application_id_index');
            $table->dropColumn('application_id');
        });
    }
};
