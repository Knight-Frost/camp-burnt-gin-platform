<?php

namespace App\Enums;

/**
 * SupervisionLevel — defines how closely a camper needs to be watched by staff.
 *
 * Based on a camper's medical complexity and behavioral needs, this enum sets
 * the required staff-to-camper ratio. More complex needs mean more dedicated
 * attention from a staff member, which helps keep every camper safe.
 */
enum SupervisionLevel: string
{
    // Routine supervision — shared across a group of up to six campers per staff member.
    case Standard = 'standard';

    // Extra attention — shared across a smaller group of up to three campers per staff.
    case Enhanced = 'enhanced';

    // A dedicated staff member assigned solely to this one camper at all times.
    case OneToOne = 'one_to_one';

    /**
     * Returns a friendly label for the supervision level to display in the UI.
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
     * Returns a fallback staffing ratio string for this supervision level.
     *
     * @deprecated Use SpecialNeedsRiskAssessmentService::getStaffingRatioForLevel() instead,
     * which reads the configured value from the risk_thresholds table. This method
     * returns the original seeded defaults and will not reflect changes made via the
     * Risk Management UI.
     *
     * Kept for backward compatibility with legacy endpoints and tests.
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
