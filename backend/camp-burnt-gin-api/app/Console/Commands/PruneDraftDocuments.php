<?php

namespace App\Console\Commands;

use App\Models\Document;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * PruneDraftDocuments — clean up stale draft document rows and their files.
 *
 * Applicant uploads land as drafts (submitted_at = null) while the parent is
 * still staging. If they never hit Submit, the row and its bytes persist
 * forever — over a season that accumulates into a slow storage leak and
 * clutters the applicant's own document list.
 *
 * This command finds drafts older than --days days (default: 30) that have
 * never been submitted and soft-deletes them (SoftDeletes trait on Document).
 * When run with --force-delete it also removes the underlying disk file and
 * hard-deletes the row for truly orphaned rows — use sparingly, soft-delete
 * is normally enough because archived is not immediately visible anywhere.
 *
 * Scheduled nightly via Kernel::schedule().
 *
 * Usage:
 *   php artisan documents:prune-drafts                    # soft-delete drafts >30 days old
 *   php artisan documents:prune-drafts --days=60          # different age threshold
 *   php artisan documents:prune-drafts --force-delete     # hard-delete + remove files
 *   php artisan documents:prune-drafts --dry-run          # show what would be pruned
 */
class PruneDraftDocuments extends Command
{
    protected $signature = 'documents:prune-drafts
                            {--days=30 : Drafts older than this many days are eligible}
                            {--force-delete : Hard-delete rows and remove files from disk}
                            {--dry-run : Report eligible rows without deleting anything}';

    protected $description = 'Soft-delete stale applicant draft documents that were never submitted';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $forceDelete = (bool) $this->option('force-delete');
        $dryRun = (bool) $this->option('dry-run');
        $cutoff = now()->subDays($days);

        // Only operate on rows that are DEFINITELY drafts: no submitted_at, no
        // archived_at (admin archive is a separate workflow we must not touch).
        $query = Document::query()
            ->whereNull('submitted_at')
            ->whereNull('archived_at')
            ->where('created_at', '<=', $cutoff);

        $total = (clone $query)->count();

        if ($total === 0) {
            $this->info("No draft documents older than {$days} days found.");

            return self::SUCCESS;
        }

        $this->info(sprintf(
            '%s %d stale draft document(s) created before %s%s.',
            $dryRun ? 'Would process' : ($forceDelete ? 'Hard-deleting' : 'Soft-deleting'),
            $total,
            $cutoff->toDateString(),
            $forceDelete ? ' (including disk files)' : '',
        ));

        if ($dryRun) {
            $query->chunkById(100, function ($docs) {
                foreach ($docs as $doc) {
                    $this->line(sprintf(
                        '  - #%d  %s  %s  uploader=%d  created=%s',
                        $doc->id,
                        $doc->document_type ?? '(no type)',
                        $doc->original_filename ?? '(encrypted)',
                        $doc->uploaded_by ?? 0,
                        $doc->created_at?->toDateString(),
                    ));
                }
            });

            return self::SUCCESS;
        }

        $processed = 0;
        $query->chunkById(100, function ($docs) use ($forceDelete, &$processed) {
            foreach ($docs as $doc) {
                if ($forceDelete) {
                    // Remove the physical file if it still exists. Swallow
                    // "not found" — if the row already lost its bytes, the
                    // row deletion still makes sense.
                    try {
                        if ($doc->path && Storage::disk($doc->disk ?? 'local')->exists($doc->path)) {
                            Storage::disk($doc->disk ?? 'local')->delete($doc->path);
                        }
                    } catch (\Throwable) {
                        // best-effort cleanup
                    }
                    $doc->forceDelete();
                } else {
                    $doc->delete();
                }
                $processed++;
            }
        });

        $this->info("Processed {$processed} draft document(s).");

        return self::SUCCESS;
    }
}
