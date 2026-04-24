<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            // Link a document back to the request that prompted its upload.
            // SET NULL on delete so destroying an old request does not cascade
            // to the uploaded document (which is an independent compliance artifact).
            $table->unsignedBigInteger('document_request_id')->nullable()->after('message_id');
            $table->foreign('document_request_id')
                ->references('id')->on('document_requests')
                ->nullOnDelete();

            // Content review decision columns.
            // These are distinct from verified_by/verified_at, which track the
            // security-scan + admin content approval shared action.
            // The new columns give the workflow layer its own dedicated audit fields.
            $table->text('rejection_reason')->nullable()->after('verified_at');

            $table->unsignedBigInteger('approved_by')->nullable()->after('rejection_reason');
            $table->timestamp('approved_at')->nullable()->after('approved_by');
            $table->foreign('approved_by')->references('id')->on('users')->nullOnDelete();

            $table->unsignedBigInteger('rejected_by')->nullable()->after('approved_at');
            $table->timestamp('rejected_at')->nullable()->after('rejected_by');
            $table->foreign('rejected_by')->references('id')->on('users')->nullOnDelete();

            $table->index('document_request_id');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropForeign(['document_request_id']);
            $table->dropForeign(['approved_by']);
            $table->dropForeign(['rejected_by']);
            $table->dropIndex(['document_request_id']);
            $table->dropColumn([
                'document_request_id',
                'rejection_reason',
                'approved_by',
                'approved_at',
                'rejected_by',
                'rejected_at',
            ]);
        });
    }
};
