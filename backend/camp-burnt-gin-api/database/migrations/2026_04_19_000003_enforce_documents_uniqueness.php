<?php

use App\Services\Document\DocumentUniquenessEnforcer;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Enforce the invariant:
 *   For any given (documentable_type, documentable_id, document_type),
 *   there is AT MOST ONE live (non-archived, non-deleted, non-message)
 *   document row.
 *
 * Why this migration:
 *   BUG-216 — the applicant portal showed multiple rows per required-doc
 *   type (Medical Exam, Insurance, Immunization) because every upload
 *   created a new Document via blind Model::create(). Dev DB had 26
 *   duplicate live rows on Application #2 alone. Without a DB-level
 *   constraint, any future write path that forgets the archive-on-
 *   reupload pattern reintroduces the bug.
 *
 * Two-step plan:
 *   1. Collapse existing duplicates by archiving all but the newest row
 *      per (owner, type) group. This is non-destructive — archived rows
 *      remain in the table with archived_at set.
 *   2. Create a functional UNIQUE index whose expression:
 *        - yields `CONCAT(type, '|', id, '|', doc_type)` for LIVE rows
 *        - yields NULL for archived/deleted/message-attachment rows
 *      MySQL allows multiple NULLs in a UNIQUE index, so archived
 *      duplicates can coexist but new live duplicates are rejected.
 *
 * SQLite (test DB) does not support this functional index syntax; the
 * test suite relies on the DocumentService archive-on-reupload write
 * logic plus regression coverage in DocumentUniquenessTest to lock the
 * invariant at the app layer.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Step 1: archive existing duplicate live rows so the unique
        // index below can be created without violating existing data.
        // Idempotent: a second run finds no duplicates and does nothing.
        $enforcer = app(DocumentUniquenessEnforcer::class);
        $enforcer->archiveDuplicates(dryRun: false);

        if (DB::connection()->getDriverName() === 'mysql') {
            // Step 2: MySQL 8.0.13+ functional unique index. The CASE
            // expression builds a stable dedupe key for live rows and
            // NULL for rows that must be allowed to coexist (archived
            // history, soft-deletes, message attachments).
            //
            // Because message_id-bearing rows participate in a different
            // uniqueness model (threaded conversations can legitimately
            // carry multiple PDFs of the same document_type), they are
            // excluded from this invariant.
            if (! $this->indexExists('documents', 'documents_live_ownership_unique')) {
                // CAST(... AS CHAR(512)) is required: MySQL 8 refuses to
                // build a functional index whose return type is TEXT/LONGTEXT,
                // which is what CONCAT yields when its inputs come from the
                // `documentable_type` string column. 512 chars is plenty for
                // a FQCN + 20-digit id + 64-char document_type marker.
                DB::statement(
                    'CREATE UNIQUE INDEX documents_live_ownership_unique ON documents ('
                    .'(CAST('
                    .'  CASE '
                    .'    WHEN archived_at IS NULL AND deleted_at IS NULL AND message_id IS NULL '
                    .'         AND documentable_type IS NOT NULL AND documentable_id IS NOT NULL '
                    .'         AND document_type IS NOT NULL '
                    .'    THEN CONCAT(documentable_type, \'|\', documentable_id, \'|\', document_type) '
                    .'    ELSE NULL '
                    .'  END '
                    .'AS CHAR(512))'
                    .')'
                    .')',
                );
            }
        }
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'mysql'
            && $this->indexExists('documents', 'documents_live_ownership_unique')
        ) {
            DB::statement('DROP INDEX documents_live_ownership_unique ON documents');
        }
        // Archived rows stay archived — no way to meaningfully "undo" that
        // and attempting to unarchive them would likely re-introduce the
        // original bug on rollback.
    }

    private function indexExists(string $table, string $index): bool
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return false;
        }

        return DB::selectOne(
            'SELECT 1 AS present FROM information_schema.STATISTICS '
            .'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
            [$table, $index],
        ) !== null;
    }
};
