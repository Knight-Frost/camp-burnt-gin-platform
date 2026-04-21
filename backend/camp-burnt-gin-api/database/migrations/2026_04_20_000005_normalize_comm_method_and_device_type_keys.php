<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Normalises legacy English-label strings stored in:
 *   behavioral_profiles.communication_methods  (JSON array)
 *   assistive_devices.device_type              (plain string)
 *
 * Before this migration, the frontend stored translated display labels
 * (e.g. "Verbal speech", "CPAP / BiPAP") directly.  After BUG-227/228,
 * the frontend stores canonical keys (e.g. "verbal", "cpap").
 *
 * This migration backfills existing rows so the UI renders correctly and
 * the completeness engine can match by key.
 */
return new class extends Migration
{
    // ---------------------------------------------------------------------------
    // Label → canonical key maps (English only — only English was ever stored)
    // ---------------------------------------------------------------------------

    private array $commMethodMap = [
        'Verbal speech'   => 'verbal',
        'AAC device'      => 'aac_device',
        'Sign language'   => 'sign_language',
        'Picture symbols' => 'picture_symbols',
        'Gestures'        => 'gestures',
        'Written text'    => 'written',
        'Eye gaze'        => 'eye_gaze',
    ];

    private array $deviceTypeMap = [
        'Wheelchair (manual)'               => 'wheelchair_manual',
        'Wheelchair (power)'                => 'wheelchair_power',
        'Walker'                            => 'walker',
        'Crutches'                          => 'crutches',
        'Cane'                              => 'cane',
        'Leg brace(s)'                      => 'leg_brace',
        'CPAP / BiPAP'                      => 'cpap',
        'Hearing aid'                       => 'hearing_aid',
        'Cochlear implant'                  => 'cochlear',
        'Glasses / contacts'                => 'glasses',
        'Prosthetic limb'                   => 'prosthetic',
        'Orthotics / AFOs'                  => 'orthotics',
        'Computerized communication device' => 'comm_device',
        'Gait trainer'                      => 'gait_trainer',
        'Other'                             => 'other',
    ];

    public function up(): void
    {
        // ── behavioral_profiles.communication_methods ─────────────────────
        $profiles = DB::table('behavioral_profiles')
            ->whereNotNull('communication_methods')
            ->get(['id', 'communication_methods']);

        foreach ($profiles as $profile) {
            $methods = json_decode($profile->communication_methods, true);
            if (! is_array($methods)) {
                continue;
            }

            $normalized = array_values(array_map(
                fn (string $m) => $this->commMethodMap[$m] ?? $m,
                $methods
            ));

            if ($normalized !== $methods) {
                DB::table('behavioral_profiles')
                    ->where('id', $profile->id)
                    ->update(['communication_methods' => json_encode($normalized)]);
            }
        }

        // ── assistive_devices.device_type ─────────────────────────────────
        foreach ($this->deviceTypeMap as $label => $key) {
            DB::table('assistive_devices')
                ->where('device_type', $label)
                ->update(['device_type' => $key]);
        }
    }

    public function down(): void
    {
        $reverseCommMap   = array_flip($this->commMethodMap);
        $reverseDeviceMap = array_flip($this->deviceTypeMap);

        $profiles = DB::table('behavioral_profiles')
            ->whereNotNull('communication_methods')
            ->get(['id', 'communication_methods']);

        foreach ($profiles as $profile) {
            $methods = json_decode($profile->communication_methods, true);
            if (! is_array($methods)) {
                continue;
            }

            $restored = array_values(array_map(
                fn (string $m) => $reverseCommMap[$m] ?? $m,
                $methods
            ));

            if ($restored !== $methods) {
                DB::table('behavioral_profiles')
                    ->where('id', $profile->id)
                    ->update(['communication_methods' => json_encode($restored)]);
            }
        }

        foreach ($reverseDeviceMap as $key => $label) {
            DB::table('assistive_devices')
                ->where('device_type', $key)
                ->update(['device_type' => $label]);
        }
    }
};
