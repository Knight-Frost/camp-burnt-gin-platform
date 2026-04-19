<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * RiskThreshold — Score boundary defining a supervision level or complexity tier.
 *
 * Medical directors can adjust these cutoffs to match camp capacity and staffing.
 * Raising a threshold (e.g. Enhanced from 21+ to 31+) effectively relaxes the
 * supervision requirement; lowering it tightens it.
 */
class RiskThreshold extends Model
{
    protected $fillable = [
        'threshold_type',
        'level_value',
        'label',
        'min_score',
        'max_score',
        'staffing_ratio',
        'intervention_description',
        'sort_order',
    ];

    protected $casts = [
        'min_score' => 'integer',
        'max_score' => 'integer',
        'sort_order' => 'integer',
    ];

    /** Supervision thresholds ordered by min_score ascending. */
    public static function supervisionLevels(): \Illuminate\Database\Eloquent\Collection
    {
        return static::where('threshold_type', 'supervision')
            ->orderBy('min_score')
            ->get();
    }

    /** Complexity tier thresholds ordered by min_score ascending. */
    public static function complexityTiers(): \Illuminate\Database\Eloquent\Collection
    {
        return static::where('threshold_type', 'complexity')
            ->orderBy('min_score')
            ->get();
    }

    /**
     * Find the threshold whose range covers the given score.
     * Returns the last threshold if the score exceeds all defined ranges.
     */
    public static function resolveForScore(string $type, int $score): ?self
    {
        /** @var \Illuminate\Database\Eloquent\Collection<int, self> $thresholds */
        $thresholds = static::where('threshold_type', $type)->orderBy('min_score')->get();

        $match = null;
        foreach ($thresholds as $threshold) {
            if ($score >= $threshold->min_score) {
                if ($threshold->max_score === null || $score <= $threshold->max_score) {
                    return $threshold;
                }
                $match = $threshold; // keep last one that min_score was satisfied
            }
        }

        return $match;
    }
}
