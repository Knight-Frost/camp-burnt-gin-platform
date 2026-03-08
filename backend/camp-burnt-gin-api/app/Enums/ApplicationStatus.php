<?php

namespace App\Enums;

/**
 * ApplicationStatus — tracks where a camp application is in the review process.
 *
 * Think of it like a checklist: a parent submits an application, staff review it,
 * and it moves through stages until a final decision is made. This enum lists
 * every possible stage so the rest of the app always uses the same exact words.
 */
enum ApplicationStatus: string
{
    // The application was submitted but nobody has looked at it yet.
    case Pending = 'pending';

    // Staff are actively reviewing the application right now.
    case UnderReview = 'under_review';

    // The camper has been accepted — they can attend camp!
    case Approved = 'approved';

    // The application was not accepted after review.
    case Rejected = 'rejected';

    // The camper is on the waiting list in case a spot opens up.
    case Waitlisted = 'waitlisted';

    // The application was withdrawn or called off before a decision.
    case Cancelled = 'cancelled';

    /**
     * Returns a friendly, readable version of the status for display in the UI.
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
     * Returns true if the application has reached a permanent end state.
     * Final statuses cannot be changed back — the decision is done.
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
     * Returns true if the application can still be edited by the parent.
     * Once a final decision is made or it's waitlisted, editing is locked.
     */
    public function isEditable(): bool
    {
        return in_array($this, [
            self::Pending,
            self::UnderReview,
        ]);
    }
}
