<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * RiskFactor — A single configurable risk scoring condition.
 *
 * Each factor maps to a detectable clinical condition (seizures, g-tube, etc.).
 * The PHP service detects whether the condition is present; this model stores
 * what it's worth (points) and whether it's currently active.
 *
 * Medical staff can adjust points and toggle factors via the Risk Management UI.
 */
class RiskFactor extends Model
{
    protected $fillable = [
        'key',
        'label',
        'category',
        'points',
        'per_item',
        'source_model',
        'tooltip',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'points' => 'integer',
        'per_item' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    /** Active factors in display order. */
    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order')->orderBy('category');
    }

    /** All factors keyed by their machine-readable key for O(1) lookup. */
    public static function indexedByKey(): array
    {
        return static::all()->keyBy('key')->toArray();
    }
}
