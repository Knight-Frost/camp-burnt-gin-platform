<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds force_unread to conversation_participants.
 *
 * When a user marks a conversation as "unread" but they are the only sender
 * (no messages from other participants exist), deleting a read receipt has no
 * effect because there are no non-own messages to un-read. This flag overrides
 * that limitation: when set, the conversation is treated as having 1 unread
 * message regardless of message read receipts.
 *
 * Cleared automatically when the conversation is marked as read.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->boolean('force_unread')->default(false)->after('is_important');
        });
    }

    public function down(): void
    {
        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->dropColumn('force_unread');
        });
    }
};
