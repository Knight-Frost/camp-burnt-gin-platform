<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_review_events', function (Blueprint $table) {
            $table->id();

            // The document this event belongs to (required — every event has a document).
            $table->foreignId('document_id')
                ->constrained('documents')
                ->cascadeOnDelete();

            // Optional: the request that spawned this document. Null for documents
            // uploaded without a formal request (e.g. applicant-initiated uploads).
            $table->unsignedBigInteger('document_request_id')->nullable();
            $table->foreign('document_request_id')
                ->references('id')->on('document_requests')
                ->nullOnDelete();

            // Optional: scoping for timeline queries on a specific application or camper.
            $table->unsignedBigInteger('application_id')->nullable();
            $table->foreign('application_id')
                ->references('id')->on('applications')
                ->nullOnDelete();

            $table->unsignedBigInteger('camper_id')->nullable();
            $table->foreign('camper_id')
                ->references('id')->on('campers')
                ->nullOnDelete();

            // VARCHAR (not DB ENUM) so new action types can be added without ALTER TABLE.
            // Valid values defined in DocumentReviewAction enum.
            $table->string('action', 50);

            // The user who triggered this event. Null for system-generated events
            // (e.g. scheduled overdue detection).
            $table->unsignedBigInteger('performed_by')->nullable();
            $table->foreign('performed_by')
                ->references('id')->on('users')
                ->nullOnDelete();

            // Human-readable reason — required for rejected actions, optional otherwise.
            $table->text('reason')->nullable();

            // Free-form admin notes attached to this event.
            $table->text('notes')->nullable();

            // Extra structured data for deep-linking or future analytics.
            $table->json('metadata')->nullable();

            // Immutable audit ledger: created_at only, no updated_at.
            $table->timestamp('created_at')->useCurrent();

            // Efficient timeline queries.
            $table->index(['document_id', 'created_at']);
            $table->index(['application_id', 'created_at']);
            $table->index(['camper_id', 'created_at']);
            $table->index(['document_request_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_review_events');
    }
};
