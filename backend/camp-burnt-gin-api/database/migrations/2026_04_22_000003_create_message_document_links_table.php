<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates `message_document_links` — the join table that lets a Message
 * reference an existing Document without duplicating the file.
 *
 * Why a join table instead of the existing `documents.message_id` FK:
 *
 *   The existing FK models "this document IS an inline attachment of this
 *   message" — one message owns the doc. That made sense for email-style
 *   file uploads where the file is born with the message. It does NOT
 *   describe our actual scenario: an applicant uploads a tiger.jpg to
 *   their Documents module, then sends it as an attachment to admin
 *   review. The doc lives in the Documents module; the message merely
 *   references it.
 *
 *   A many-to-many via this table expresses that exactly: one Document
 *   can be referenced by many Messages, one Message can reference many
 *   Documents, and destroying the link doesn't touch the Document or
 *   the file.
 *
 * Coexistence with the legacy `documents.message_id` FK:
 *
 *   The FK path stays in place for historical messages that used the old
 *   inline-upload flow (pre-Phase 2). shapeMessage() merges both sources
 *   into one attachments array so the client sees a single shape.
 *
 * Cascade behaviour:
 *
 *   - Message hard-deleted → link row is removed (FK cascade).
 *   - Document force-deleted → link row is removed (FK cascade). The
 *     Document::canForceDelete() rule will prevent this from happening
 *     accidentally for docs with live message references.
 *   - Soft-deletes on either side do NOT remove link rows — the link
 *     stays so a restored message/doc re-surfaces with its attachments.
 *
 * Unique index on (message_id, document_id) prevents the same doc being
 * attached twice to the same message (a harmless but noisy UX issue).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('message_document_links', function (Blueprint $table) {
            $table->id();

            $table->foreignId('message_id')
                ->constrained('messages')
                ->cascadeOnDelete();

            $table->foreignId('document_id')
                ->constrained('documents')
                ->cascadeOnDelete();

            // The user who attached the doc to the message. Usually the
            // sender, but recorded separately for audit purposes.
            $table->foreignId('attached_by')
                ->constrained('users')
                ->restrictOnDelete();

            $table->timestamp('created_at')->useCurrent();

            $table->unique(['message_id', 'document_id']);
            $table->index('document_id'); // reverse lookup: which messages reference this doc
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_document_links');
    }
};
