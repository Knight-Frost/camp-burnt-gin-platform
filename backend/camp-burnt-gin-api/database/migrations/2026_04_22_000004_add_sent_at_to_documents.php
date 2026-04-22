<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds `sent_at` to documents.
 *
 * Distinct from `submitted_at` (admin-visibility gate) — `sent_at` records
 * the moment the applicant pushed the document to an admin via the inbox
 * messaging flow. Null = the document is still in the applicant's
 * "Ready to Send" bucket on /applicant/documents; set = it's been linked
 * to a message via message_document_links and dropped off their queue.
 *
 * The two timestamps can have any combination of states:
 *   - submitted_at SET,  sent_at NULL → required doc submitted via the
 *     application form; admin already sees it but the applicant never
 *     used the inbox Send flow.
 *   - submitted_at NULL, sent_at NULL → private draft the applicant
 *     hasn't shared yet. Default state after upload.
 *   - submitted_at NULL, sent_at SET  → pushed via inbox (the message
 *     send flow also stamps submitted_at if it was null, but by design
 *     that promotion lives in the service layer, not the schema).
 *   - submitted_at SET,  sent_at SET  → both paths; harmless.
 *
 * Indexed because the applicant's Documents page is the hot query
 * path: `WHERE uploaded_by = X AND sent_at IS NULL`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->timestamp('sent_at')
                ->nullable()
                ->after('applicant_hidden_at');

            $table->index('sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropIndex(['sent_at']);
            $table->dropColumn('sent_at');
        });
    }
};
