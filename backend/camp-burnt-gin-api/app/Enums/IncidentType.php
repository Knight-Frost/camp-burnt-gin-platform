<?php

namespace App\Enums;

enum IncidentType: string
{
    case Behavioral    = 'behavioral';
    case Medical       = 'medical';
    case Injury        = 'injury';
    case Environmental = 'environmental';
    case Emergency     = 'emergency';
    case Other         = 'other';

    public function label(): string
    {
        return match($this) {
            self::Behavioral    => 'Behavioral',
            self::Medical       => 'Medical',
            self::Injury        => 'Injury',
            self::Environmental => 'Environmental',
            self::Emergency     => 'Emergency',
            self::Other         => 'Other',
        };
    }
}
