<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * EmergencyContact model representing an emergency contact for a camper.
 *
 * Emergency contacts are individuals who can be reached in case of
 * an emergency. Contacts may be designated as primary contacts or
 * authorized for camper pickup.
 */
class EmergencyContact extends Model
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
        'relationship',
        'phone_primary',
        'phone_secondary',
        'email',
        'is_primary',
        'is_authorized_pickup',
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
            'relationship' => 'encrypted',
            'phone_primary' => 'encrypted',
            'phone_secondary' => 'encrypted',
            'email' => 'encrypted',
            'is_primary' => 'boolean',
            'is_authorized_pickup' => 'boolean',
        ];
    }

    /**
     * Get the camper this emergency contact belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }
}
