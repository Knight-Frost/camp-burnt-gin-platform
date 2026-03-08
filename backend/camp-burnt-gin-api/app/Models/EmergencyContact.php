<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * EmergencyContact model — stores a person to call if a camper needs help.
 *
 * Each camper can have multiple emergency contacts. The is_primary flag marks
 * the person to call first. The is_authorized_pickup flag indicates whether
 * this contact is allowed to pick the camper up from camp — a legal safety
 * measure to prevent unauthorised releases.
 *
 * PHI encryption:
 *  - All personal details (name, phone numbers, email, relationship) are
 *    encrypted at rest to protect the privacy of both the contact and the
 *    camper they are associated with.
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
        'camper_id',           // Links this contact to a specific camper.
        'name',                // Full name of the emergency contact.
        'relationship',        // How this person relates to the camper (e.g. "Parent").
        'phone_primary',       // Main phone number — always required.
        'phone_secondary',     // Optional backup phone number.
        'email',               // Optional email address.
        'is_primary',          // True if this is the first-call contact.
        'is_authorized_pickup', // True if this person may pick up the camper.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * PHI fields are AES-256 encrypted at rest using Laravel's encrypted cast.
     * Boolean flags are cast from database 0/1 integers to PHP true/false.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Contact details are PHI — encrypted so they cannot be read from the raw DB.
            'name'                 => 'encrypted',
            'relationship'         => 'encrypted',
            'phone_primary'        => 'encrypted',
            'phone_secondary'      => 'encrypted',
            'email'                => 'encrypted',
            // Boolean flags stored as tiny integers in MySQL.
            'is_primary'           => 'boolean',
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
