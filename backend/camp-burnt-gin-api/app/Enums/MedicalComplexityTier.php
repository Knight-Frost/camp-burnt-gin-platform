<?php

namespace App\Enums;

/**
 * Enumeration of medical complexity tiers.
 *
 * This enum defines the valid medical complexity classifications for
 * campers, providing a high-level categorization of overall health
 * status and care requirements.
 */
enum MedicalComplexityTier: string
{
    case Low = 'low';
    case Moderate = 'moderate';
    case High = 'high';

    /**
     * Get a human-readable label for the complexity tier.
     */
    public function label(): string
    {
        return match ($this) {
            self::Low => 'Low Complexity',
            self::Moderate => 'Moderate Complexity',
            self::High => 'High Complexity',
        };
    }

    /**
     * Get the minimum risk score threshold for this complexity tier.
     *
     * Used by the risk assessment engine to categorize campers based
     * on cumulative medical risk factors.
     */
    public function getThreshold(): int
    {
        return match ($this) {
            self::Low => 0,
            self::Moderate => 26,
            self::High => 51,
        };
    }
}
