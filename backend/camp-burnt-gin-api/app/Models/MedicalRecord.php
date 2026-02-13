<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * MedicalRecord model representing health information for a camper.
 *
 * Each camper has a single medical record containing physician details,
 * insurance information, and any special medical needs or dietary
 * restrictions that staff should be aware of.
 *
 * PHI fields are encrypted at rest using Laravel's encrypted casting.
 */
class MedicalRecord extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',
        'physician_name',
        'physician_phone',
        'insurance_provider',
        'insurance_policy_number',
        'special_needs',
        'dietary_restrictions',
        'notes',
        'has_seizures',
        'last_seizure_date',
        'seizure_description',
        'has_neurostimulator',
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
            'physician_name' => 'encrypted',
            'physician_phone' => 'encrypted',
            'insurance_provider' => 'encrypted',
            'insurance_policy_number' => 'encrypted',
            'special_needs' => 'encrypted',
            'dietary_restrictions' => 'encrypted',
            'notes' => 'encrypted',
            'has_seizures' => 'boolean',
            'last_seizure_date' => 'date',
            'seizure_description' => 'encrypted',
            'has_neurostimulator' => 'boolean',
        ];
    }

    /**
     * Get the camper this medical record belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Determine if the camper has insurance information on file.
     */
    public function hasInsurance(): bool
    {
        return $this->insurance_provider !== null
            && $this->insurance_policy_number !== null;
    }

    /**
     * Determine if the camper has a physician on file.
     */
    public function hasPhysician(): bool
    {
        return $this->physician_name !== null;
    }

    /**
     * Determine if the camper requires a seizure action plan.
     *
     * Seizure action plans are mandatory when a camper has a history of
     * seizures, ensuring staff have appropriate emergency protocols.
     */
    public function requiresSeizurePlan(): bool
    {
        return $this->has_seizures === true;
    }
}
