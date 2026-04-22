<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds `section_attestations` to applications.
 *
 * `sections_reviewed` (added 2026_04_19_000004) records that the parent
 * navigated through a section. That timestamp says "I saw this" — it does
 * not say "there is genuinely nothing to declare for my child."
 *
 * For data-bearing-but-optional sections (behavior, equipment, diet,
 * medications) the completeness engine needs to distinguish:
 *
 *   - has data        → complete (the data IS the attestation)
 *   - has attestation → complete (parent explicitly checked "nothing to declare")
 *   - has neither     → INCOMPLETE
 *
 * Without this third field, a parent who navigated past an empty section
 * would have it counted as complete even when they meant to fill it in but
 * forgot. That ambiguity is the headline cause of false-green section pills
 * reported in the 2026-04-22 forensic audit.
 *
 * Storage: JSON column shaped { "behavior": true, "equipment": false, ... }.
 * Boolean values, not timestamps — the question is whether the parent
 * affirmatively attested, not when. Default null = no attestations recorded.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->json('section_attestations')->nullable()->after('sections_reviewed');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('section_attestations');
        });
    }
};
