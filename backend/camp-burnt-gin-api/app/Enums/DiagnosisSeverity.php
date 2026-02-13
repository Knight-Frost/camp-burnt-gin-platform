<?php

namespace App\Enums;

/**
 * Enumeration of diagnosis severity levels.
 *
 * This enum defines the valid severity classifications for camper
 * diagnoses, enabling appropriate risk assessment and care planning
 * based on medical complexity.
 */
enum DiagnosisSeverity: string
{
    case Mild = 'mild';
    case Moderate = 'moderate';
    case Severe = 'severe';

    /**
     * Get a human-readable label for the severity level.
     */
    public function label(): string
    {
        return match ($this) {
            self::Mild => 'Mild',
            self::Moderate => 'Moderate',
            self::Severe => 'Severe',
        };
    }

    /**
     * Get the risk score contribution for this severity level.
     *
     * Used by the risk assessment engine to calculate overall camper
     * medical complexity and supervision requirements.
     */
    public function getRiskScore(): int
    {
        return match ($this) {
            self::Mild => 0,
            self::Moderate => 3,
            self::Severe => 5,
        };
    }
}
