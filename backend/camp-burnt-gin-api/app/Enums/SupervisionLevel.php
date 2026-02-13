<?php

namespace App\Enums;

/**
 * Enumeration of camper supervision levels.
 *
 * This enum defines the valid supervision classifications for campers
 * based on medical complexity and behavioral needs, directly determining
 * staff-to-camper ratios for safe program delivery.
 */
enum SupervisionLevel: string
{
    case Standard = 'standard';
    case Enhanced = 'enhanced';
    case OneToOne = 'one_to_one';

    /**
     * Get a human-readable label for the supervision level.
     */
    public function label(): string
    {
        return match ($this) {
            self::Standard => 'Standard',
            self::Enhanced => 'Enhanced',
            self::OneToOne => 'One-to-One',
        };
    }

    /**
     * Get the staff-to-camper ratio for this supervision level.
     *
     * These ratios ensure adequate staffing for camper safety and
     * appropriate support for medical and behavioral needs.
     */
    public function getStaffingRatio(): string
    {
        return match ($this) {
            self::Standard => '1:6',
            self::Enhanced => '1:3',
            self::OneToOne => '1:1',
        };
    }
}
