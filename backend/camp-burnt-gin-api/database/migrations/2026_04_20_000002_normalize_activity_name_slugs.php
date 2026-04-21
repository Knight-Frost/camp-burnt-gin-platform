<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Normalise activity_name values from display labels to canonical slugs.
 *
 * Prior versions of handleSubmit (legacy waterfall) and AdminApplicationEditPage
 * stored human-readable labels ('Sports & Games', 'Camp Out', etc.) as the
 * activity_name. The completeness engine queries by canonical slug. This
 * migration converts any label-format rows to the correct slug format.
 *
 * The controller already uses updateOrCreate(camper_id, activity_name) so after
 * normalisation there will be at most one row per (camper_id, slug).
 */
return new class extends Migration
{
    private const LABEL_TO_SLUG = [
        'Sports & Games' => 'sports_games',
        'Sports' => 'sports_games',
        'Arts & Crafts' => 'arts_crafts',
        'Nature Activities' => 'nature',
        'Nature' => 'nature',
        'Fine Arts' => 'fine_arts',
        'Swimming' => 'swimming',
        'Boating' => 'boating',
        'Camping' => 'camp_out',
        'Camp Out' => 'camp_out',
    ];

    public function up(): void
    {
        foreach (self::LABEL_TO_SLUG as $label => $slug) {
            // Delete label-format rows for campers that already have the slug variant.
            // Uses two queries instead of DELETE...JOIN so it runs on both MySQL and SQLite.
            $camperIdsWithSlug = DB::table('activity_permissions')
                ->where('activity_name', $slug)
                ->pluck('camper_id');

            if ($camperIdsWithSlug->isNotEmpty()) {
                DB::table('activity_permissions')
                    ->where('activity_name', $label)
                    ->whereIn('camper_id', $camperIdsWithSlug)
                    ->delete();
            }

            // Rename any remaining label-format rows (no slug duplicate exists) to the slug.
            DB::table('activity_permissions')
                ->where('activity_name', $label)
                ->update(['activity_name' => $slug]);
        }
    }

    public function down(): void
    {
        // Normalisation is not reversible.
    }
};
