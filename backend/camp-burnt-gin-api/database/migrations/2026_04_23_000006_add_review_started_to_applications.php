<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add review_started_by + review_started_at to applications.
 *
 * Records the "soft claim" moment when an admin clicks "Start Review" on an
 * application. Distinct from reviewed_by / reviewed_at which record the FINAL
 * decision (approved / rejected / waitlisted). A reviewer can start a review
 * and never finish it; this pair captures that intermediate state so the UI
 * can display "Review started by Jane on Apr 23 at 2:15 PM" and stop showing
 * "This application has not been reviewed" once someone has engaged with it.
 *
 * Soft claim semantics: no lock. A different admin can still review the
 * application. The fields are overwritten whenever a new admin clicks Start
 * Review (the most recent claim wins).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->foreignId('review_started_by')
                ->nullable()
                ->after('reviewed_by')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('review_started_at')
                ->nullable()
                ->after('review_started_by');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('review_started_by');
            $table->dropColumn('review_started_at');
        });
    }
};
