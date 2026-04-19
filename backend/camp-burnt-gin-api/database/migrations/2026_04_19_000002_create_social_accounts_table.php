<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Social accounts table — links a system user to one or more OAuth provider identities.
 *
 * Design rationale: A separate table (rather than columns on users) keeps OAuth-specific
 * data isolated from core identity fields and makes multi-provider support straightforward.
 * Cascading delete ensures no orphaned OAuth records remain after a user is removed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_accounts', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            // Provider identifier — 'google', and future providers (github, microsoft, etc.)
            $table->string('provider', 50);

            // The unique user ID from the OAuth provider (Google's "sub" claim)
            $table->string('provider_id');

            // The email address associated with the provider account.
            // May differ from users.email if the user has multiple Google accounts.
            $table->string('provider_email')->nullable();

            // Display name returned by the provider — used to pre-fill registration
            $table->string('provider_name')->nullable();

            // Provider avatar URL — shown only if the user has no local avatar_path
            $table->string('avatar_url', 500)->nullable();

            // OAuth tokens — encrypted at rest via the 'encrypted' cast on the model
            $table->text('access_token')->nullable();
            $table->text('refresh_token')->nullable();
            $table->timestamp('token_expires_at')->nullable();

            $table->timestamps();

            // A provider can only be linked once per provider user ID
            $table->unique(['provider', 'provider_id']);

            // Fast lookup: find user by provider + email (used in linking logic)
            $table->index(['provider', 'provider_email']);

            // Fast lookup: find all providers for a user
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_accounts');
    }
};
