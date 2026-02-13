<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * BehavioralProfile model representing behavioral characteristics for a camper.
 *
 * Each camper has a single behavioral profile tracking safety risks,
 * supervision needs, and developmental status to support appropriate
 * staffing ratios and accommodation planning.
 *
 * PHI fields are encrypted at rest using Laravel's encrypted casting.
 */
class BehavioralProfile extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',
        'aggression',
        'self_abuse',
        'wandering_risk',
        'one_to_one_supervision',
        'developmental_delay',
        'functioning_age_level',
        'communication_methods',
        'notes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * PHI fields are encrypted at rest for HIPAA compliance.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'aggression' => 'boolean',
            'self_abuse' => 'boolean',
            'wandering_risk' => 'boolean',
            'one_to_one_supervision' => 'boolean',
            'developmental_delay' => 'boolean',
            'communication_methods' => 'array',
            'notes' => 'encrypted',
        ];
    }

    /**
     * Get the camper this behavioral profile belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Determine if this profile indicates high-risk behaviors.
     *
     * High-risk behaviors include aggression, self-abuse, or wandering,
     * which require enhanced supervision and safety protocols.
     */
    public function hasHighRiskBehaviors(): bool
    {
        return $this->aggression
            || $this->self_abuse
            || $this->wandering_risk;
    }

    /**
     * Determine if this profile requires one-to-one supervision.
     */
    public function requiresOneToOne(): bool
    {
        return $this->one_to_one_supervision === true;
    }
}
