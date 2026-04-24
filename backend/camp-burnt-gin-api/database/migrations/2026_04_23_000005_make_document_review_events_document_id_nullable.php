<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Make document_review_events.document_id nullable.
 *
 * Overdue events are recorded when a document request's due date passes with
 * no upload. In that case there is no Document row to reference — requiring
 * document_id NOT NULL silently blocks the event and breaks idempotency in
 * the MarkOverdueDocumentRequests command.
 *
 * Cascade-on-delete is preserved so that if a document IS linked and later
 * hard-deleted, the event row goes with it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_review_events', function (Blueprint $table) {
            // Drop the foreign key constraint first, then re-add with nullable column.
            $table->dropForeign(['document_id']);
            $table->unsignedBigInteger('document_id')->nullable()->change();
            $table->foreign('document_id')
                ->references('id')->on('documents')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('document_review_events', function (Blueprint $table) {
            $table->dropForeign(['document_id']);
            $table->unsignedBigInteger('document_id')->nullable(false)->change();
            $table->foreign('document_id')
                ->references('id')->on('documents')
                ->cascadeOnDelete();
        });
    }
};
