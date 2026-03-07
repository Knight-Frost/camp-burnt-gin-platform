<?php

namespace App\Enums;

enum IncidentSeverity: string
{
    case Minor    = 'minor';
    case Moderate = 'moderate';
    case Severe   = 'severe';
    case Critical = 'critical';

    public function label(): string
    {
        return match($this) {
            self::Minor    => 'Minor',
            self::Moderate => 'Moderate',
            self::Severe   => 'Severe',
            self::Critical => 'Critical',
        };
    }

    public function requiresEscalation(): bool
    {
        return match($this) {
            self::Severe, self::Critical => true,
            default => false,
        };
    }
}
