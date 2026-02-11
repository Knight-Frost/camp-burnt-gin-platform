<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Medication model representing a medication taken by a camper.
 *
 * Medications track prescribed and over-the-counter medications
 * that campers need during their stay, including dosage information
 * and administration schedules for camp medical staff.
 */
class Medication extends Model
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
        'dosage',
        'frequency',
        'purpose',
        'prescribing_physician',
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
            'name' => 'encrypted',
            'dosage' => 'encrypted',
            'frequency' => 'encrypted',
            'purpose' => 'encrypted',
            'prescribing_physician' => 'encrypted',
            'notes' => 'encrypted',
        ];
    }

    /**
     * Get the camper this medication belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Determine if this medication was prescribed by a physician.
     */
    public function isPrescribed(): bool
    {
        return $this->prescribing_physician !== null;
    }
}
