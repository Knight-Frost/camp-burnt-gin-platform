<?php

namespace App\Models;

use App\Enums\AllergySeverity;
use Illuminate\Database\Eloquent\Casts\Attribute;
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
     * Attributes appended to JSON/array output.
     *
     * Exposes 'name' as an alias for 'allergen' so the frontend
     * can consistently read allergy.name without a field-name mismatch.
     *
     * @var list<string>
     */
    protected $appends = ['name'];

    /**
     * Alias allergen as 'name' for frontend compatibility.
     */
    protected function name(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->allergen,
        );
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
