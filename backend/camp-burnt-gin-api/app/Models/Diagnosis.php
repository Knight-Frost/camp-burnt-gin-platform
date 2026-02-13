<?php

namespace App\Models;

use App\Enums\DiagnosisSeverity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Diagnosis model representing a medical condition for a camper.
 *
 * Each diagnosis tracks a specific medical condition with severity
 * classification and clinical notes to support appropriate care
 * planning and risk assessment.
 *
 * PHI fields are encrypted at rest using Laravel's encrypted casting.
 */
class Diagnosis extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',
        'name',
        'description',
        'severity_level',
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
            'description' => 'encrypted',
            'severity_level' => DiagnosisSeverity::class,
            'notes' => 'encrypted',
        ];
    }

    /**
     * Get the camper this diagnosis belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the risk score contribution from this diagnosis.
     *
     * Used by the risk assessment engine to calculate overall camper
     * medical complexity and supervision requirements.
     */
    public function getRiskScore(): int
    {
        return $this->severity_level->getRiskScore();
    }
}
