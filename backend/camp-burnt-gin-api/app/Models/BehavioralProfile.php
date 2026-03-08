<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * BehavioralProfile model — stores behavioral characteristics and supervision needs for a camper.
 *
 * Each camper has exactly one behavioral profile. It captures safety-relevant flags
 * (aggression, self-harm risk, wandering) and supervision requirements that affect
 * staff-to-camper ratios and activity planning.
 *
 * PHI sensitivity: The "notes" field contains Protected Health Information and is
 * encrypted at rest using Laravel's built-in "encrypted" cast (AES-256-CBC via APP_KEY).
 *
 * Relationships: belongs to Camper (one-to-one from the camper side)
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
     * Boolean flags are stored as tinyint in MySQL; casting ensures PHP sees true/false.
     * "communication_methods" is a JSON array (e.g., ["verbal", "sign language"]).
     * "notes" is encrypted so raw database values are unreadable without the APP_KEY.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'aggression'             => 'boolean',
            'self_abuse'             => 'boolean',
            'wandering_risk'         => 'boolean',
            'one_to_one_supervision' => 'boolean',
            'developmental_delay'    => 'boolean',
            // Stored as JSON in the database; auto-decoded to PHP array on read
            'communication_methods'  => 'array',
            // PHI field — encrypted at rest for HIPAA compliance
            'notes'                  => 'encrypted',
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the camper this behavioral profile belongs to.
     *
     * The inverse of Camper::behavioralProfile() (hasOne).
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helper Methods
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Determine if this profile indicates high-risk behaviors.
     *
     * High-risk behaviors (aggression, self-abuse, or wandering) trigger enhanced
     * supervision protocols and must be flagged on activity rosters and incident forms.
     */
    public function hasHighRiskBehaviors(): bool
    {
        // Any single true flag qualifies as high-risk
        return $this->aggression
            || $this->self_abuse
            || $this->wandering_risk;
    }

    /**
     * Determine if this profile requires one-to-one supervision.
     *
     * When true, this camper must have a dedicated staff member at all times.
     * This directly affects staffing ratios for any session the camper attends.
     */
    public function requiresOneToOne(): bool
    {
        // Strict comparison ensures a null/missing value doesn't accidentally return true
        return $this->one_to_one_supervision === true;
    }
}
