<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds `applicant_hidden_at` to documents.
 *
 * Separates applicant visibility from system visibility. Previously, an
 * applicant clicking "Delete" on a submitted document soft-deleted the row,
 * which also hid it from the admin queue — a HIPAA-sensitive compliance
 * record disappearing on a single click by the uploader.
 *
 * New semantics (enforced by DocumentPolicy::delete + DocumentController::destroy):
 *
 *   - Draft, unattached document  → applicant "Delete" permanently removes it
 *                                    (soft-delete + physical file purge via
 *                                    Document::forceDeleting event).
 *   - Submitted / attached document → applicant "Delete" sets
 *                                     applicant_hidden_at = now(). Admin view
 *                                     is unaffected. Applicant no longer sees
 *                                     it in their own list.
 *
 * The column is indexed because the applicant index query will filter it out
 * on every request (applicants have a tight row budget, so the predicate is
 * worth indexing).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->timestamp('applicant_hidden_at')
                ->nullable()
                ->after('submitted_at');

            $table->index('applicant_hidden_at');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropIndex(['applicant_hidden_at']);
            $table->dropColumn('applicant_hidden_at');
        });
    }
};
