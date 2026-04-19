<?php

namespace App\Console\Commands;

use App\Models\Camper;
use App\Services\Camper\CamperChildRowDeduper;
use Illuminate\Console\Command;

/**
 * Clean up the duplicate rows that BUG-214 left in the database before the
 * finalize-time dedupe was added.
 *
 * Usage:
 *   php artisan campers:dedupe-children                 # all campers, dry run
 *   php artisan campers:dedupe-children --apply         # all campers, delete
 *   php artisan campers:dedupe-children --camper=42 --apply
 *
 * Tables affected: medications, allergies, emergency_contacts, diagnoses,
 * assistive_devices. Dedup key is the natural-key fingerprint; the newest
 * (highest id) row of each signature is kept.
 */
class DedupeCamperChildRows extends Command
{
    protected $signature = 'campers:dedupe-children
                            {--camper= : Restrict to a single camper id}
                            {--apply : Actually delete duplicate rows (default is dry run)}';

    protected $description = 'Remove exact duplicate rows from a camper\'s child tables (BUG-214 cleanup).';

    public function handle(CamperChildRowDeduper $deduper): int
    {
        $dryRun = ! (bool) $this->option('apply');

        $query = Camper::query();
        if ($camperId = $this->option('camper')) {
            $query->where('id', $camperId);
        }

        $totals = [
            'campers_scanned' => 0,
            'medications' => 0,
            'allergies' => 0,
            'emergency_contacts' => 0,
            'diagnoses' => 0,
            'assistive_devices' => 0,
        ];

        $query->chunk(100, function ($campers) use ($deduper, $dryRun, &$totals) {
            foreach ($campers as $camper) {
                $totals['campers_scanned']++;

                if ($dryRun) {
                    $deleted = $this->simulate($deduper, $camper);
                } else {
                    $deleted = $deduper->dedupeForCamper($camper);
                }

                foreach ($deleted as $table => $count) {
                    $totals[$table] += $count;
                }
            }
        });

        $this->newLine();
        $this->info($dryRun ? '[DRY RUN] Would delete:' : 'Deleted:');
        $this->table(
            ['Table', 'Rows'],
            collect($totals)->except('campers_scanned')->map(fn ($v, $k) => [$k, $v])->values()->all(),
        );
        $this->line(sprintf('Scanned %d campers.', $totals['campers_scanned']));
        if ($dryRun) {
            $this->newLine();
            $this->comment('No rows were deleted. Re-run with --apply to commit.');
        }

        return self::SUCCESS;
    }

    /**
     * Dry-run: count what WOULD be deleted without touching the DB. Runs
     * the same signature comparison as the deduper but inside a wrapped
     * transaction that we always roll back.
     *
     * @return array{medications: int, allergies: int, emergency_contacts: int, diagnoses: int, assistive_devices: int}
     */
    private function simulate(CamperChildRowDeduper $deduper, Camper $camper): array
    {
        \Illuminate\Support\Facades\DB::beginTransaction();

        try {
            $deleted = $deduper->dedupeForCamper($camper);

            return $deleted;
        } finally {
            \Illuminate\Support\Facades\DB::rollBack();
        }
    }
}
