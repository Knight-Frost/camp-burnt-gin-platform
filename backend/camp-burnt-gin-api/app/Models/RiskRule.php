<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * RiskRule — A conditional bonus rule for the risk scoring engine.
 *
 * When all conditions in a rule are satisfied by the camper's detected factors,
 * the points_adjustment is added to the total score. This allows medical staff
 * to encode clinical logic like "IF seizures AND life_threatening_allergy THEN +10".
 */
class RiskRule extends Model
{
    protected $fillable = [
        'name',
        'description',
        'conditions',
        'points_adjustment',
        'is_active',
    ];

    protected $casts = [
        'conditions' => 'array',
        'points_adjustment' => 'integer',
        'is_active' => 'boolean',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Evaluate this rule against a set of detected factor keys.
     *
     * @param  array<string>  $detectedKeys  Keys of factors that are present for a camper.
     */
    public function matches(array $detectedKeys): bool
    {
        foreach ($this->conditions as $condition) {
            $key = $condition['factor_key'] ?? null;
            $mustBePresent = $condition['present'] ?? true;

            if (! $key) {
                continue;
            }

            $isPresent = in_array($key, $detectedKeys, true);

            if ($mustBePresent && ! $isPresent) {
                return false;
            }

            if (! $mustBePresent && $isPresent) {
                return false;
            }
        }

        return true;
    }
}
