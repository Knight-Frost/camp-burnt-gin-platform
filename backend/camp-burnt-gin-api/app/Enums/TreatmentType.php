<?php

namespace App\Enums;

/**
 * Enumeration of treatment log types for camp medical staff records.
 */
enum TreatmentType: string
{
    case MedicationAdministered = 'medication_administered';
    case FirstAid                = 'first_aid';
    case Observation             = 'observation';
    case Emergency               = 'emergency';
    case Other                   = 'other';

    /**
     * Return a human-readable label for each type.
     */
    public function label(): string
    {
        return match ($this) {
            self::MedicationAdministered => 'Medication Administered',
            self::FirstAid               => 'First Aid',
            self::Observation            => 'Observation',
            self::Emergency              => 'Emergency',
            self::Other                  => 'Other',
        };
    }
}
