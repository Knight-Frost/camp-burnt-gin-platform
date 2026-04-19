<?php

namespace App\Console\Commands;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\AuditLog;
use App\Notifications\ApplicationRevertedToDraftNotification;
use App\Services\Camper\ApplicationCompletenessService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * applications:revalidate — rerun the completeness engine over every
 * submitted application and report (or automatically revert) the ones
 * whose data no longer passes validation.
 *
 *   php artisan applications:revalidate            # dry run: print report
 *   php artisan applications:revalidate --apply    # revert failing apps
 *
 * Scope: only applications with is_draft=false AND status=submitted.
 * Applications that an admin has already touched (under_review, approved,
 * rejected, waitlisted, cancelled, withdrawn) are NOT revalidated — once
 * the admin has started reviewing, reverting would silently unenroll
 * campers and overwrite admin work.
 *
 * Revert behaviour (--apply):
 *   1. Set is_draft=true, submitted_at=null, status=Submitted→Submitted
 *      (the enum value is preserved but is_draft=true signals pre-submit)
 *   2. Write an AuditLog row explaining why and which issues blocked.
 *   3. Queue ApplicationRevertedToDraftNotification to the parent.
 *
 * Idempotent: a second run finds the already-reverted (now is_draft=true)
 * rows excluded by the scope filter and does nothing.
 */
class RevalidateApplications extends Command
{
    protected $signature = 'applications:revalidate
                            {--apply : Revert failing applications to draft (default is dry run)}';

    protected $description = 'Rerun the completeness engine over submitted applications; revert invalid ones to draft when --apply.';

    public function handle(ApplicationCompletenessService $engine): int
    {
        $dryRun = ! (bool) $this->option('apply');

        $this->info($dryRun
            ? '[DRY RUN] Scanning submitted applications for post-submit drift...'
            : 'Revalidating submitted applications and reverting invalid ones...');
        $this->newLine();

        $scope = Application::query()
            ->where('is_draft', false)
            ->where('status', ApplicationStatus::Submitted)
            ->orderBy('id');

        $total = (clone $scope)->count();
        $failing = [];

        $scope->chunkById(200, function ($chunk) use ($engine, &$failing) {
            foreach ($chunk as $app) {
                $result = $engine->evaluate($app, forFinalization: true);
                // Valid if: all sections complete AND no blocking documents.
                // unverified is excluded at submission gate (same as finalize).
                if (! $result['is_complete'] || ! $result['is_valid']) {
                    $failing[] = [
                        'application' => $app,
                        'result' => $result,
                    ];
                }
            }
        });

        $this->line(sprintf('Scanned: %d submitted applications', $total));
        $this->line(sprintf('Failing: %d', count($failing)));

        if (empty($failing)) {
            $this->newLine();
            $this->info('All submitted applications pass validation. Nothing to do.');

            return self::SUCCESS;
        }

        $this->newLine();
        $this->info('Per-application detail:');
        foreach ($failing as $row) {
            $app = $row['application'];
            $blocking = $row['result']['blocking_issues'];
            $this->line(sprintf(
                '  Application #%d (camper %d): %d blocking issue%s',
                $app->id,
                $app->camper_id,
                count($blocking),
                count($blocking) === 1 ? '' : 's',
            ));
            foreach (array_slice($blocking, 0, 4) as $issue) {
                $this->line(sprintf('     · [%s] %s', $issue['section'], $issue['label']));
            }
            if (count($blocking) > 4) {
                $this->line(sprintf('     · … and %d more', count($blocking) - 4));
            }
        }

        if ($dryRun) {
            $this->newLine();
            $this->comment('No rows were changed. Re-run with --apply to revert these applications to draft.');

            return self::SUCCESS;
        }

        // ── Apply: revert each failing row in its own transaction ──────────
        $this->newLine();
        $reverted = 0;
        foreach ($failing as $row) {
            try {
                $this->revertOne($row['application'], $row['result']['blocking_issues']);
                $reverted++;
            } catch (\Throwable $e) {
                $this->error(sprintf(
                    'Failed to revert application #%d: %s',
                    $row['application']->id,
                    $e->getMessage(),
                ));
            }
        }

        $this->newLine();
        $this->info(sprintf('Reverted %d application%s to draft.', $reverted, $reverted === 1 ? '' : 's'));

        return self::SUCCESS;
    }

    /**
     * @param  list<array{section: string, label: string, key: string}>  $blockingIssues
     */
    private function revertOne(Application $application, array $blockingIssues): void
    {
        DB::transaction(function () use ($application, $blockingIssues) {
            $previousSubmittedAt = $application->submitted_at;

            $application->is_draft = true;
            $application->submitted_at = null;
            $application->save();

            AuditLog::create([
                'request_id' => (string) \Illuminate\Support\Str::uuid(),
                'user_id' => null, // system
                'event_type' => 'data_change',
                'auditable_type' => Application::class,
                'auditable_id' => $application->id,
                'action' => 'application.reverted.revalidation',
                'description' => sprintf(
                    'System reverted application #%d from submitted to draft after revalidation found %d blocking issue%s.',
                    $application->id,
                    count($blockingIssues),
                    count($blockingIssues) === 1 ? '' : 's',
                ),
                'old_values' => [
                    'is_draft' => false,
                    'submitted_at' => $previousSubmittedAt?->toISOString(),
                ],
                'new_values' => [
                    'is_draft' => true,
                    'submitted_at' => null,
                ],
                'metadata' => [
                    'blocking_issues' => array_map(fn ($i) => [
                        'section' => $i['section'],
                        'key' => $i['key'],
                        'label' => $i['label'],
                    ], $blockingIssues),
                ],
                'created_at' => now(),
            ]);
        });

        // Parent notification — queued so a slow mail driver doesn't stall
        // the command. Loaded post-transaction to avoid double-loading.
        $parent = $application->camper?->user;
        if ($parent) {
            $parent->notify(new ApplicationRevertedToDraftNotification($application, $blockingIssues));
        }

        $this->line(sprintf('  ✔ Application #%d → draft', $application->id));
    }
}
