<?php

namespace App\Console\Commands;

use App\Models\Camper;
use Illuminate\Console\Command;

/**
 * Command to identify and flag campers whose records have exceeded retention period.
 *
 * This command does NOT delete records. It identifies campers past their
 * retention date and flags them for manual review and archival by administrators.
 * This prevents accidental deletion while enforcing retention compliance.
 *
 * Actual archival/deletion should be performed manually after administrative
 * review to ensure regulatory compliance and prevent data loss.
 */
class ArchiveExpiredRecords extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'records:identify-expired
                            {--export= : Export list of expired records to file}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Identify campers whose records have exceeded retention period (does not delete)';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $exportPath = $this->option('export');

        $this->info('Identifying records past retention period...');

        $expiredCampers = Camper::whereNotNull('record_retention_until')
            ->where('record_retention_until', '<', now())
            ->with(['user', 'applications'])
            ->get();

        if ($expiredCampers->isEmpty()) {
            $this->info('No records past retention period found.');

            return self::SUCCESS;
        }

        $this->warn(sprintf(
            'Found %d camper(s) past retention period:',
            $expiredCampers->count()
        ));

        $tableData = $expiredCampers->map(function ($camper) {
            return [
                'ID' => $camper->id,
                'Name' => sprintf('%s %s', $camper->first_name, $camper->last_name),
                'DOB' => $camper->date_of_birth->format('Y-m-d'),
                'Retention Until' => $camper->record_retention_until->format('Y-m-d'),
                'Days Overdue' => now()->diffInDays($camper->record_retention_until),
                'Applications' => $camper->applications->count(),
            ];
        })->toArray();

        $this->table(
            ['ID', 'Name', 'DOB', 'Retention Until', 'Days Overdue', 'Applications'],
            $tableData
        );

        if ($exportPath) {
            $this->exportToFile($expiredCampers, $exportPath);
        }

        $this->newLine();
        $this->warn('IMPORTANT: These records should be reviewed by an administrator before archival.');
        $this->warn('This command does NOT automatically delete records.');
        $this->info('To proceed with archival, export the list and follow your organization\'s data retention policy.');

        return self::SUCCESS;
    }

    /**
     * Export expired camper list to file.
     */
    protected function exportToFile($campers, string $path): void
    {
        $csv = fopen($path, 'w');

        // Write header
        fputcsv($csv, [
            'Camper ID',
            'First Name',
            'Last Name',
            'Date of Birth',
            'Retention Until',
            'Days Overdue',
            'Parent User ID',
            'Parent Email',
            'Application Count',
        ]);

        // Write data
        foreach ($campers as $camper) {
            fputcsv($csv, [
                $camper->id,
                $camper->first_name,
                $camper->last_name,
                $camper->date_of_birth->format('Y-m-d'),
                $camper->record_retention_until->format('Y-m-d'),
                now()->diffInDays($camper->record_retention_until),
                $camper->user_id,
                $camper->user?->email,
                $camper->applications->count(),
            ]);
        }

        fclose($csv);

        $this->info(sprintf('Exported %d records to: %s', $campers->count(), $path));
    }
}
