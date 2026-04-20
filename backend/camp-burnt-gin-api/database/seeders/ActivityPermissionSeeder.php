<?php

namespace Database\Seeders;

use App\Enums\ActivityPermissionLevel;
use App\Models\ActivityPermission;
use App\Models\Camper;
use Illuminate\Database\Seeder;

/**
 * Seeder — default activity permission records.
 *
 * Creates one row per canonical activity slug per camper (if none exists yet).
 * Slugs MUST match ApplicationCompletenessService::CANONICAL_ACTIVITIES exactly —
 * the completeness engine validates permissions by slug, not by display label.
 *
 * Canonical slugs:
 *   sports_games, arts_crafts, nature, fine_arts,
 *   swimming, boating, camping, camp_out
 */
class ActivityPermissionSeeder extends Seeder
{
    /**
     * Canonical activity slugs — must stay in sync with
     * ApplicationCompletenessService::CANONICAL_ACTIVITIES.
     *
     * @var array<string>
     */
    protected array $defaultActivities = [
        'sports_games',
        'arts_crafts',
        'nature',
        'fine_arts',
        'swimming',
        'boating',
        'camping',
        'camp_out',
    ];

    public function run(): void
    {
        $campers = Camper::all();
        $createdCount = 0;

        foreach ($campers as $camper) {
            foreach ($this->defaultActivities as $slug) {
                $exists = ActivityPermission::where('camper_id', $camper->id)
                    ->where('activity_name', $slug)
                    ->exists();

                if (! $exists) {
                    ActivityPermission::create([
                        'camper_id' => $camper->id,
                        'activity_name' => $slug,
                        'permission_level' => ActivityPermissionLevel::Yes,
                        'restriction_notes' => null,
                    ]);

                    $createdCount++;
                }
            }
        }

        $this->command->line("  Activity permissions seeded: {$createdCount} rows across ".count($campers).' camper(s).');
    }
}
