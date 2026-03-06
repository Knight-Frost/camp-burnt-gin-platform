<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Represents a personal emergency contact for a user account.
 *
 * These are account-level contacts used across all of a user's camper
 * applications, distinct from camper-specific emergency contacts.
 */
class UserEmergencyContact extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'relationship',
        'phone',
        'email',
        'is_primary',
    ];

    protected function casts(): array
    {
        return [
            'is_primary' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
