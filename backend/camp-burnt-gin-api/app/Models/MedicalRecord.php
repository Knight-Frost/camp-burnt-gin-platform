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
    ];

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
}
