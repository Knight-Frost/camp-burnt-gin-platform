<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds `sections_reviewed` to applications. The ApplicationCompletenessService
 * treats certain sections as optionally empty (equipment, medications,
 * narratives — not every camper needs an assistive device or is on
 * medication). A legitimately-empty section is indistinguishable from an
 * un-visited section unless the parent explicitly attests "nothing to
 * declare". This column stores those attestations:
 *
 *     { "equipment": "2026-04-19T12:34:00Z", "medications": "…" }
 *
 * The engine treats a section as "complete" when either (a) it has the
 * required data, or (b) the applicant has stamped a review timestamp and no
 * conditional rule is violated. Camper / health / personal_care / documents
 * / consents do NOT accept the review-only path — they always require data.
 *
 * Stored as JSON (not JSONB) because the app targets both MySQL and SQLite
 * (tests) and only needs shallow read/write. Default null = nothing reviewed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->json('sections_reviewed')->nullable()->after('signed_at');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('sections_reviewed');
        });
    }
};
