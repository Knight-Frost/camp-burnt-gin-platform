<?php

namespace App\Console\Commands;

use App\Models\Camper;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Command to calculate and update record retention dates for campers.
 *
 * Implements medical record retention compliance:
 * - 13 years after last camp session, OR
 * - Until camper's 19th birthday
 * - Whichever is LONGER
 *
 * Scheduled to run daily to keep retention dates current.
 */
class CalculateRecordRetention extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'campers:calculate-retention
                            {--dry-run : Display what would be updated without modifying database}
                            {--camper= : Calculate for specific camper ID only}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Calculate and update medical record retention dates for campers';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $isDryRun = $this->option('dry-run');
        $specificCamperId = $this->option('camper');

        $this->info('Starting record retention calculation...');
        if ($isDryRun) {
            $this->warn('DRY RUN MODE - No database changes will be made');
        }

        $query = Camper::query();

        if ($specificCamperId) {
            $query->where('id', $specificCamperId);
        }

        $processedCount = 0;
        $updatedCount = 0;
        $errorCount = 0;

        $query->chunk(100, function ($campers) use ($isDryRun, &$processedCount, &$updatedCount, &$errorCount) {
            foreach ($campers as $camper) {
                try {
                    $processedCount++;

                    $retentionDate = $this->calculateRetentionDate($camper);
                    $currentRetentionDate = $camper->record_retention_until;

                    if ($currentRetentionDate?->eq($retentionDate)) {
                        // No change needed
                        continue;
                    }

                    if ($isDryRun) {
                        $this->line(sprintf(
                            'Would update Camper #%d: %s -> %s',
                            $camper->id,
                            $currentRetentionDate?->format('Y-m-d') ?? 'null',
                            $retentionDate->format('Y-m-d')
                        ));
                    } else {
                        $camper->update(['record_retention_until' => $retentionDate]);
                    }

                    $updatedCount++;
                } catch (\Throwable $e) {
                    $errorCount++;
                    $this->error(sprintf(
                        'Error processing Camper #%d: %s',
                        $camper->id ?? 'unknown',
                        $e->getMessage()
                    ));
                }
            }
        });

        $this->newLine();
        $this->info("Retention calculation complete:");
        $this->table(
            ['Metric', 'Count'],
            [
                ['Processed', $processedCount],
                ['Updated', $updatedCount],
                ['Errors', $errorCount],
            ]
        );

        return $errorCount > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Calculate retention date for a camper.
     *
     * Formula: MAX(last_session_date + 13 years, 19th_birthday)
     */
    protected function calculateRetentionDate(Camper $camper): Carbon
    {
        // Get last session end date from applications
        $lastSessionDate = $camper->applications()
            ->with('campSession')
            ->get()
            ->pluck('campSession.end_date')
            ->filter()
            ->max();

        // Calculate session-based retention (13 years after last session)
        $sessionBasedRetention = $lastSessionDate
            ? Carbon::parse($lastSessionDate)->addYears(13)
            : now()->addYears(13); // Default if no sessions

        // Calculate age-based retention (19th birthday)
        $ageBasedRetention = Carbon::parse($camper->date_of_birth)->addYears(19);

        // Return whichever is longer
        return $sessionBasedRetention->gt($ageBasedRetention)
            ? $sessionBasedRetention
            : $ageBasedRetention;
    }
}
