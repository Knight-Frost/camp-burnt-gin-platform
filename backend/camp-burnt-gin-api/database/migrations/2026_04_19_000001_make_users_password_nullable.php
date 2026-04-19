<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Make users.password nullable to support social-only accounts.
 *
 * Users who register exclusively via Google (or another OAuth provider) do
 * not have a password. Making the column nullable allows those accounts to
 * exist without a sentinel value. Hash::check() called against a null
 * password always returns false, so password login remains blocked for
 * social-only accounts without any additional guard logic.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Before reverting, ensure no social-only accounts (null password) exist,
        // or those rows will violate the NOT NULL constraint.
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable(false)->change();
        });
    }
};
