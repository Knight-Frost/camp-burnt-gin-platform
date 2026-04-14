<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The vitals column uses Laravel's 'encrypted:array' cast, which stores
     * AES-256-CBC ciphertext — not valid JSON. MySQL's JSON column type
     * validates the stored value and rejects ciphertext, causing SQLSTATE 22032.
     * Change vitals to TEXT so encrypted values can be stored freely.
     */
    public function up(): void
    {
        Schema::table('medical_visits', function (Blueprint $table) {
            $table->text('vitals')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('medical_visits', function (Blueprint $table) {
            $table->json('vitals')->nullable()->change();
        });
    }
};
