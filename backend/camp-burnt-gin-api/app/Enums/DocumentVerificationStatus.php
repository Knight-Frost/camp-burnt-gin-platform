<?php

namespace App\Enums;

/**
 * Enumeration of document verification statuses.
 *
 * Tracks the verification lifecycle of medical compliance documents
 * to ensure proper review before application approval.
 */
enum DocumentVerificationStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';

    /**
     * Get a human-readable label for the verification status.
     */
    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending Verification',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
        };
    }

    /**
     * Determine if the document is verified and approved.
     */
    public function isApproved(): bool
    {
        return $this === self::Approved;
    }

    /**
     * Determine if the document is pending review.
     */
    public function isPending(): bool
    {
        return $this === self::Pending;
    }

    /**
     * Determine if the document was rejected.
     */
    public function isRejected(): bool
    {
        return $this === self::Rejected;
    }
}
