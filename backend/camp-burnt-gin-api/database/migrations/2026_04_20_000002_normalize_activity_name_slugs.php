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
        'Sports & Games'   => 'sports_games',
        'Sports'           => 'sports_games',
        'Arts & Crafts'    => 'arts_crafts',
        'Nature Activities' => 'nature',
        'Nature'           => 'nature',
        'Fine Arts'        => 'fine_arts',
        'Swimming'         => 'swimming',
        'Boating'          => 'boating',
        'Camping'          => 'camp_out',
        'Camp Out'         => 'camp_out',
    ];

    public function up(): void
    {
        foreach (self::LABEL_TO_SLUG as $label => $slug) {
            // For each label-format row, if a slug-format row already exists for
            // the same camper, delete the label duplicate. Otherwise rename it.
            DB::statement("
                DELETE ap FROM activity_permissions ap
                INNER JOIN activity_permissions ap2
                    ON ap2.camper_id = ap.camper_id AND ap2.activity_name = ?
                WHERE ap.activity_name = ?
            ", [$slug, $label]);

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
