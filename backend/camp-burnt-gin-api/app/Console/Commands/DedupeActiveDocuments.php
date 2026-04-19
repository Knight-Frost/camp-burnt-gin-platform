<?php

namespace App\Console\Commands;

use App\Services\Document\DocumentUniquenessEnforcer;
use Illuminate\Console\Command;

/**
 * docs:dedupe-active — archive duplicate live Document rows so each
 * (documentable_type, documentable_id, document_type) has at most one
 * non-archived row.
 *
 * Usage:
 *   php artisan docs:dedupe-active            # dry run — report only
 *   php artisan docs:dedupe-active --apply    # actually archive duplicates
 *
 * Keeps the newest row (highest id) per group; archives the rest via
 * archived_at. No data is hard-deleted — original rows remain in the
 * table for retention and audit purposes.
 *
 * This is the manual ops equivalent of the migration that ran the same
 * logic once to enable the new unique index. Run it if duplicate rows
 * appear later (e.g. data imports, manual SQL inserts).
 */
class DedupeActiveDocuments extends Command
{
    protected $signature = 'docs:dedupe-active
                            {--apply : Actually archive duplicates (default is dry run)}';

    protected $description = 'Archive duplicate live documents so each (owner, type) has at most one live row.';

    public function handle(DocumentUniquenessEnforcer $enforcer): int
    {
        $dryRun = ! (bool) $this->option('apply');

        $this->info($dryRun ? '[DRY RUN] Scanning for duplicate live documents...' : 'Archiving duplicate live documents...');
        $this->newLine();

        $report = $enforcer->archiveDuplicates($dryRun);

        $this->line(sprintf('Duplicate groups found: %d', $report['groups_found']));
        $this->line(sprintf(
            $dryRun ? 'Rows that WOULD be archived: %d' : 'Rows archived: %d',
            $report['rows_archived'],
        ));

        if (! empty($report['groups'])) {
            $this->newLine();
            $this->info('Per-group detail:');
            foreach ($report['groups'] as $g) {
                $this->line(sprintf(
                    '  %s  kept id=%d  archived=[%s]',
                    $g['key'],
                    $g['kept'],
                    implode(', ', $g['archived']),
                ));
            }
        }

        if ($dryRun) {
            $this->newLine();
            $this->comment('No rows were changed. Re-run with --apply to commit.');
        }

        return self::SUCCESS;
    }
}
