<?php

namespace App\Models;

use App\Enums\AllergySeverity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Allergy model representing a known allergy for a camper.
 *
 * Allergies track the allergen, severity level, typical reaction,
 * and recommended treatment. This information is critical for
 * ensuring camper safety during camp activities.
 */
class Allergy extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',
        'allergen',
        'severity',
        'reaction',
        'treatment',
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
            'allergen' => 'encrypted',
            'severity' => AllergySeverity::class,
            'reaction' => 'encrypted',
            'treatment' => 'encrypted',
        ];
    }

    /**
     * Get the camper this allergy belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Determine if this allergy requires immediate medical attention.
     */
    public function requiresImmediateAttention(): bool
    {
        return $this->severity->requiresImmediateAttention();
    }
}
