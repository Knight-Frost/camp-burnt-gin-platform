<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Remove the Camp entity entirely.
 *
 * CampSessions are now standalone — no parent Camp is required.
 * This drops the foreign key and camp_id column from camp_sessions,
 * then drops the camps table itself.
 *
 * This migration is intentionally irreversible (down() is a no-op).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('camp_sessions', function (Blueprint $table) {
            $table->dropForeign(['camp_id']);
            $table->dropColumn('camp_id');
        });

        Schema::dropIfExists('camps');
    }

    public function down(): void
    {
        // Irreversible by design — the Camp entity has been permanently removed.
    }
};
