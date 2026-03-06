<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Widens encrypted string columns to TEXT.
 *
 * Laravel's AES-256-CBC encryption wraps plaintext in a base64-encoded JSON
 * payload (iv + ciphertext + mac). Even short values produce payloads of
 * 250–350+ characters, which overflows VARCHAR(255).
 *
 * Affected tables:
 *   - medications: name, dosage, frequency, purpose, prescribing_physician
 *   - allergies: allergen
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medications', function (Blueprint $table) {
            $table->text('name')->change();
            $table->text('dosage')->change();
            $table->text('frequency')->change();
            $table->text('purpose')->nullable()->change();
            $table->text('prescribing_physician')->nullable()->change();
        });

        Schema::table('allergies', function (Blueprint $table) {
            $table->text('allergen')->change();
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->text('original_filename')->change();
        });
    }

    public function down(): void
    {
        Schema::table('medications', function (Blueprint $table) {
            $table->string('name')->change();
            $table->string('dosage')->change();
            $table->string('frequency')->change();
            $table->string('purpose')->nullable()->change();
            $table->string('prescribing_physician')->nullable()->change();
        });

        Schema::table('allergies', function (Blueprint $table) {
            $table->string('allergen')->change();
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->string('original_filename')->change();
        });
    }
};
