<?php

namespace App\Enums;

/**
 * Enumeration of allergy severity levels.
 *
 * This enum defines the valid severity classifications for camper
 * allergies, enabling appropriate response protocols based on risk.
 */
enum AllergySeverity: string
{
    case Mild = 'mild';
    case Moderate = 'moderate';
    case Severe = 'severe';
    case LifeThreatening = 'life_threatening';

    /**
     * Get a human-readable label for the severity level.
     */
    public function label(): string
    {
        return match ($this) {
            self::Mild => 'Mild',
            self::Moderate => 'Moderate',
            self::Severe => 'Severe',
            self::LifeThreatening => 'Life-Threatening',
        };
    }

    /**
     * Determine if this severity level requires immediate medical attention.
     */
    public function requiresImmediateAttention(): bool
    {
        return in_array($this, [
            self::Severe,
            self::LifeThreatening,
        ]);
    }
}
