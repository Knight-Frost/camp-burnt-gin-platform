<?php

namespace App\Enums;

/**
 * Enumeration of activity permission levels.
 *
 * This enum defines the valid permission classifications for camper
 * participation in camp activities, enabling appropriate safety
 * restrictions and accommodations.
 */
enum ActivityPermissionLevel: string
{
    case No = 'no';
    case Yes = 'yes';
    case Restricted = 'restricted';

    /**
     * Get a human-readable label for the permission level.
     */
    public function label(): string
    {
        return match ($this) {
            self::No => 'Not Permitted',
            self::Yes => 'Permitted',
            self::Restricted => 'Restricted',
        };
    }

    /**
     * Determine if this permission level requires restriction notes.
     *
     * Restricted activities must document specific limitations or
     * accommodations required for safe participation.
     */
    public function requiresNotes(): bool
    {
        return $this === self::Restricted;
    }
}
