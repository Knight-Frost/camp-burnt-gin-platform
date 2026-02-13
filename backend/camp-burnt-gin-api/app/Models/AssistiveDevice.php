<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * AssistiveDevice model representing mobility aids and assistive technology.
 *
 * Each device tracks the type of assistive equipment, transfer assistance
 * requirements, and usage notes to support appropriate accessibility
 * accommodations and staff training needs.
 */
class AssistiveDevice extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',
        'device_type',
        'requires_transfer_assistance',
        'notes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'requires_transfer_assistance' => 'boolean',
        ];
    }

    /**
     * Get the camper this assistive device belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Determine if this device requires specialized staff training.
     *
     * Transfer assistance and certain assistive devices require staff
     * to have appropriate training for safe operation and assistance.
     */
    public function requiresTraining(): bool
    {
        return $this->requires_transfer_assistance === true;
    }

    /**
     * Determine if this device affects mobility accessibility.
     *
     * Certain device types require specific accessibility accommodations
     * for camp facilities and activities.
     */
    public function isMobilityDevice(): bool
    {
        $mobilityDevices = [
            'wheelchair',
            'walker',
            'crutches',
            'cane',
            'gait trainer',
            'stander',
        ];

        return in_array(strtolower($this->device_type), $mobilityDevices);
    }
}
