<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('risk_assessments', function (Blueprint $table) {
            // Staff-authored recommendations stored alongside system-generated ones.
            // Each element: { text, priority, added_by_id, added_by_name, added_at }
            $table->json('staff_recommendations')->nullable()->after('clinical_notes');
        });
    }

    public function down(): void
    {
        Schema::table('risk_assessments', function (Blueprint $table) {
            $table->dropColumn('staff_recommendations');
        });
    }
};
