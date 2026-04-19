<?php

namespace App\Console\Commands;

use App\Models\Camper;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * MergeDuplicateCampers — consolidate duplicate Camper rows that exist for
 * the same parent user (same first_name + last_name + date_of_birth).
 *
 * This is a one-shot cleanup that runs BEFORE the new unique index migration
 * so that the index doesn't fail on existing data.
 *
 * Usage:
 *   php artisan campers:merge-duplicates                 # dry run, report only
 *   php artisan campers:merge-duplicates --apply         # actually merge
 *   php artisan campers:merge-duplicates --user=5        # restrict to one user
 *
 * Merge strategy:
 *   - Within each (user_id, first_name, last_name, date_of_birth) group, the
 *     surviving Camper is the one with the highest id (most recently created).
 *   - All HasMany child rows (applications, medications, allergies, diagnoses,
 *     emergency_contacts, assistive_devices, activity_permissions, medical
 *     visits/incidents/follow-ups/restrictions) are re-pointed to the survivor.
 *   - HasOne child rows (medical_record, behavioral_profile, feeding_plan,
 *     personal_care_plan) are re-pointed ONLY if the survivor doesn't already
 *     have one. If the survivor has one, the loser's row is soft-deleted.
 *   - Polymorphic documents are re-pointed (documentable_id).
 *   - The loser Camper itself is soft-deleted so the record-retention window
 *     is preserved.
 *
 * Ambiguous cases (flagged, NOT merged):
 *   - Both duplicates have a non-final Application for the same camp_session.
 *     Two simultaneously-active applications is a state the system cannot
 *     resolve automatically — it's an admin decision about which row to keep.
 */
class MergeDuplicateCampers extends Command
{
    protected $signature = 'campers:merge-duplicates
                            {--user= : Restrict to a single user id}
                            {--apply : Actually merge duplicates (default is dry run)}';

    protected $description = 'Merge duplicate Camper rows (same user, same name + DOB) ahead of the uniqueness migration.';

    /**
     * Tables and their camper_id column that need re-pointing.
     * All of these are HasMany — many rows per camper allowed.
     */
    private const HAS_MANY_TABLES = [
        'applications',
        'medications',
        'allergies',
        'diagnoses',
        'emergency_contacts',
        'assistive_devices',
        'medical_incidents',
        'medical_follow_ups',
        'medical_visits',
        'medical_restrictions',
        'treatment_logs',
        'risk_assessments',
    ];

    /**
     * HasMany tables that ALSO carry a unique index on (camper_id, <column>),
     * so a naive UPDATE would collide when the loser and survivor both have
     * a row with the same <column> value. For these, we delete conflicting
     * loser rows first, then re-point the rest.
     *
     * table => discriminator column within (camper_id, column) unique index
     */
    private const CONSTRAINED_HAS_MANY_TABLES = [
        'activity_permissions' => 'activity_name',
    ];

    /**
     * HasOne tables — at most one row per camper. If both campers have one,
     * the loser's row must be deleted rather than re-pointed (would violate
     * an implicit uniqueness in application logic).
     */
    private const HAS_ONE_TABLES = [
        'medical_records',
        'behavioral_profiles',
        'feeding_plans',
        'personal_care_plans',
    ];

    public function handle(): int
    {
        $dryRun = ! (bool) $this->option('apply');
        $userFilter = $this->option('user');

        $this->info($dryRun ? '[DRY RUN] Analyzing duplicate campers...' : 'Merging duplicate campers...');
        $this->newLine();

        $groups = $this->findDuplicateGroups($userFilter);

        if ($groups->isEmpty()) {
            $this->info('No duplicate campers found.');

            return self::SUCCESS;
        }

        $totals = [
            'groups_found' => 0,
            'groups_merged' => 0,
            'groups_skipped' => 0,
            'campers_retired' => 0,
        ];
        $perTable = [];
        $ambiguous = [];

        foreach ($groups as $group) {
            $totals['groups_found']++;

            // Load full Camper models with their applications so we can check ambiguity.
            $ids = $group->pluck('id')->all();
            $campers = Camper::withTrashed()
                ->with(['applications' => fn ($q) => $q->where('is_draft', false)])
                ->whereIn('id', $ids)
                ->orderByDesc('id')
                ->get();

            $survivor = $campers->first();
            $losers = $campers->slice(1);

            if ($this->hasOverlappingActiveApplications($survivor, $losers)) {
                $totals['groups_skipped']++;
                $ambiguous[] = [
                    'user_id' => $survivor->user_id,
                    'name' => "{$survivor->first_name} {$survivor->last_name}",
                    'dob' => $survivor->date_of_birth?->format('Y-m-d'),
                    'ids' => $campers->pluck('id')->all(),
                    'reason' => 'Duplicate campers have non-final applications for the same session',
                ];

                continue;
            }

            if ($dryRun) {
                $plan = $this->simulateMerge($survivor, $losers);
                foreach ($plan as $table => $count) {
                    $perTable[$table] = ($perTable[$table] ?? 0) + $count;
                }
                $totals['groups_merged']++;
                $totals['campers_retired'] += $losers->count();
            } else {
                $plan = $this->applyMerge($survivor, $losers);
                foreach ($plan as $table => $count) {
                    $perTable[$table] = ($perTable[$table] ?? 0) + $count;
                }
                $totals['groups_merged']++;
                $totals['campers_retired'] += $losers->count();
            }
        }

        $this->renderReport($dryRun, $totals, $perTable, $ambiguous);

        return self::SUCCESS;
    }

    /**
     * Find all duplicate groups — (user_id, first_name, last_name, date_of_birth)
     * tuples with more than one Camper row.
     *
     * Returns a collection of collections; inner collections hold {id, user_id,
     * first_name, last_name, date_of_birth} stdClasses.
     */
    private function findDuplicateGroups(?string $userFilter): \Illuminate\Support\Collection
    {
        $query = DB::table('campers')
            ->select('id', 'user_id', 'first_name', 'last_name', 'date_of_birth')
            ->whereNull('deleted_at');

        if ($userFilter !== null) {
            $query->where('user_id', (int) $userFilter);
        }

        $rows = $query->get();

        return $rows
            ->groupBy(fn ($r) => implode('|', [
                $r->user_id,
                mb_strtolower(trim((string) $r->first_name)),
                mb_strtolower(trim((string) $r->last_name)),
                (string) $r->date_of_birth,
            ]))
            ->filter(fn ($group) => $group->count() > 1)
            ->values();
    }

    /**
     * Returns true if the survivor AND at least one loser both have non-final
     * applications for the same camp session. This signals that a human needs
     * to decide which Camper identity is the "real" one.
     */
    private function hasOverlappingActiveApplications(Camper $survivor, \Illuminate\Support\Collection $losers): bool
    {
        $survivorSessionIds = $survivor->applications
            ->filter(fn ($a) => ! $a->status->isFinal())
            ->pluck('camp_session_id')
            ->filter()
            ->all();

        if (empty($survivorSessionIds)) {
            return false;
        }

        foreach ($losers as $loser) {
            $loserSessionIds = $loser->applications
                ->filter(fn ($a) => ! $a->status->isFinal())
                ->pluck('camp_session_id')
                ->filter()
                ->all();

            if (! empty(array_intersect($survivorSessionIds, $loserSessionIds))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Count what WOULD be re-pointed without touching the DB. Runs the merge
     * inside a transaction that is always rolled back.
     *
     * @return array<string,int>
     */
    private function simulateMerge(Camper $survivor, \Illuminate\Support\Collection $losers): array
    {
        DB::beginTransaction();

        try {
            return $this->performMerge($survivor, $losers);
        } finally {
            DB::rollBack();
        }
    }

    /**
     * Commit the merge for real.
     *
     * @return array<string,int>
     */
    private function applyMerge(Camper $survivor, \Illuminate\Support\Collection $losers): array
    {
        return DB::transaction(fn () => $this->performMerge($survivor, $losers));
    }

    /**
     * Core merge logic — re-point children, collapse HasOnes, soft-delete losers.
     *
     * @return array<string,int> table => rows affected
     */
    private function performMerge(Camper $survivor, \Illuminate\Support\Collection $losers): array
    {
        $result = [];
        $loserIds = $losers->pluck('id')->all();
        if (empty($loserIds)) {
            return $result;
        }

        // HasMany: simple re-point.
        foreach (self::HAS_MANY_TABLES as $table) {
            if (! $this->tableExists($table)) {
                continue;
            }
            $count = DB::table($table)
                ->whereIn('camper_id', $loserIds)
                ->update(['camper_id' => $survivor->id]);
            if ($count > 0) {
                $result[$table] = $count;
            }
        }

        // Constrained HasMany: tables where (camper_id, discriminator) is unique.
        // Delete loser rows whose discriminator already exists on survivor, then
        // re-point what remains.
        foreach (self::CONSTRAINED_HAS_MANY_TABLES as $table => $discriminator) {
            if (! $this->tableExists($table)) {
                continue;
            }

            // Discriminators already present on the survivor — loser rows with
            // these values would violate the unique index on re-point.
            $survivorDiscriminators = DB::table($table)
                ->where('camper_id', $survivor->id)
                ->pluck($discriminator)
                ->all();

            if (! empty($survivorDiscriminators)) {
                $conflicts = DB::table($table)
                    ->whereIn('camper_id', $loserIds)
                    ->whereIn($discriminator, $survivorDiscriminators)
                    ->delete();
                if ($conflicts > 0) {
                    $result[$table.' (conflict-deleted)'] = $conflicts;
                }
            }

            $moved = DB::table($table)
                ->whereIn('camper_id', $loserIds)
                ->update(['camper_id' => $survivor->id]);
            if ($moved > 0) {
                $result[$table] = $moved;
            }
        }

        // HasOne: re-point only if survivor doesn't already have a row in that table.
        foreach (self::HAS_ONE_TABLES as $table) {
            if (! $this->tableExists($table)) {
                continue;
            }
            $survivorHas = DB::table($table)
                ->where('camper_id', $survivor->id)
                ->whereNull('deleted_at')
                ->exists();

            if ($survivorHas) {
                // Loser rows are deleted — survivor keeps its own.
                $count = DB::table($table)
                    ->whereIn('camper_id', $loserIds)
                    ->delete();
                if ($count > 0) {
                    $result[$table.' (discarded)'] = $count;
                }
            } else {
                // Re-point the newest loser row to the survivor; delete any older ones.
                $rows = DB::table($table)
                    ->whereIn('camper_id', $loserIds)
                    ->orderByDesc('id')
                    ->get(['id']);

                $first = $rows->first();
                if ($first !== null) {
                    DB::table($table)->where('id', $first->id)->update(['camper_id' => $survivor->id]);
                    $result[$table] = ($result[$table] ?? 0) + 1;
                }
                $rest = $rows->slice(1)->pluck('id')->all();
                if (! empty($rest)) {
                    $deleted = DB::table($table)->whereIn('id', $rest)->delete();
                    $result[$table.' (discarded)'] = ($result[$table.' (discarded)'] ?? 0) + $deleted;
                }
            }
        }

        // Polymorphic documents — re-point documentable_id when documentable_type = Camper.
        if ($this->tableExists('documents')) {
            $count = DB::table('documents')
                ->where('documentable_type', Camper::class)
                ->whereIn('documentable_id', $loserIds)
                ->update(['documentable_id' => $survivor->id]);
            if ($count > 0) {
                $result['documents'] = $count;
            }
        }

        // Finally, soft-delete the losers. Data retention is preserved via SoftDeletes;
        // deleted_at is set but rows remain in the DB.
        $now = now();
        $retired = DB::table('campers')
            ->whereIn('id', $loserIds)
            ->whereNull('deleted_at')
            ->update(['deleted_at' => $now, 'updated_at' => $now]);

        if ($retired > 0) {
            $result['campers (soft-deleted)'] = $retired;
        }

        return $result;
    }

    private function tableExists(string $table): bool
    {
        return DB::getSchemaBuilder()->hasTable($table);
    }

    /**
     * @param  array<string,int>  $perTable
     * @param  list<array<string,mixed>>  $ambiguous
     */
    private function renderReport(bool $dryRun, array $totals, array $perTable, array $ambiguous): void
    {
        $this->newLine();
        $this->info($dryRun ? '=== DRY RUN REPORT ===' : '=== MERGE REPORT ===');
        $this->line(sprintf('Duplicate groups found:    %d', $totals['groups_found']));
        $this->line(sprintf('Groups merged:             %d', $totals['groups_merged']));
        $this->line(sprintf('Groups skipped (ambiguous):%d', $totals['groups_skipped']));
        $this->line(sprintf('Campers retired:           %d', $totals['campers_retired']));

        if (! empty($perTable)) {
            $this->newLine();
            $this->info($dryRun ? 'Rows that WOULD be re-pointed / deleted:' : 'Rows re-pointed / deleted:');
            ksort($perTable);
            $this->table(
                ['Table', 'Rows'],
                collect($perTable)->map(fn ($v, $k) => [$k, $v])->values()->all(),
            );
        }

        if (! empty($ambiguous)) {
            $this->newLine();
            $this->warn('Ambiguous groups (NOT merged — require manual review):');
            foreach ($ambiguous as $a) {
                $this->line(sprintf(
                    '  user_id=%d  %s (DOB %s)  ids=[%s]  — %s',
                    $a['user_id'],
                    $a['name'],
                    $a['dob'] ?? 'unknown',
                    implode(', ', $a['ids']),
                    $a['reason'],
                ));
            }
        }

        if ($dryRun) {
            $this->newLine();
            $this->comment('No changes were made. Re-run with --apply to commit.');
        }
    }
}
