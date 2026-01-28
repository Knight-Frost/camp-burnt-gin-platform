<?php

namespace App\Enums;

/**
 * Enumeration of possible application statuses.
 *
 * This enum defines the valid states an application can be in
 * throughout the registration and review workflow.
 */
enum ApplicationStatus: string
{
    case Pending = 'pending';
    case UnderReview = 'under_review';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Waitlisted = 'waitlisted';
    case Cancelled = 'cancelled';

    /**
     * Get a human-readable label for the status.
     */
    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::UnderReview => 'Under Review',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
            self::Waitlisted => 'Waitlisted',
            self::Cancelled => 'Cancelled',
        };
    }

    /**
     * Determine if this status represents a final decision.
     */
    public function isFinal(): bool
    {
        return in_array($this, [
            self::Approved,
            self::Rejected,
            self::Cancelled,
        ]);
    }

    /**
     * Determine if this status allows the application to be edited.
     */
    public function isEditable(): bool
    {
        return in_array($this, [
            self::Pending,
            self::UnderReview,
        ]);
    }
}
