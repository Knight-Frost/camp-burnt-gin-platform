<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * medical_follow_ups.title uses Laravel's 'encrypted' cast, producing
     * ~350–500 char ciphertext that overflows VARCHAR(255). Change to TEXT.
     */
    public function up(): void
    {
        Schema::table('medical_follow_ups', function (Blueprint $table) {
            $table->text('title')->change();
        });
    }

    public function down(): void
    {
        Schema::table('medical_follow_ups', function (Blueprint $table) {
            $table->string('title')->change();
        });
    }
};
