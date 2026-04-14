<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The name, relationship, phone, and email columns store Laravel-encrypted
     * ciphertext (~350–500 chars). The original migration used VARCHAR(100),
     * VARCHAR(20), and VARCHAR(255) which are too small for encrypted values.
     * Change all encrypted PII columns to TEXT.
     */
    public function up(): void
    {
        Schema::table('user_emergency_contacts', function (Blueprint $table) {
            $table->text('name')->change();
            $table->text('relationship')->change();
            $table->text('phone')->change();
            $table->text('email')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('user_emergency_contacts', function (Blueprint $table) {
            $table->string('name')->change();
            $table->string('relationship', 100)->change();
            $table->string('phone', 20)->change();
            $table->string('email', 255)->nullable()->change();
        });
    }
};
