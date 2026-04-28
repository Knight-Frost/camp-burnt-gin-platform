<?php

namespace App\Enums;

/**
 * DocumentRequestStatus — full lifecycle of a document request.
 *
 * Flow:
 *   awaiting_upload → uploaded → scanning → under_review → approved
 *                                                        ↘ rejected → awaiting_upload (re-request)
 *
 * Overdue is a virtual status assigned when due_date passes with no upload.
 */
enum DocumentRequestStatus: string
{
    case AwaitingUpload = 'awaiting_upload';
    case Uploaded = 'uploaded';
    case Scanning = 'scanning';
    case UnderReview = 'under_review';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Overdue = 'overdue';

    public function label(): string
    {
        return match ($this) {
            self::AwaitingUpload => 'Awaiting Upload',
            self::Uploaded => 'Uploaded',
            self::Scanning => 'Scanning',
            self::UnderReview => 'Under Review',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
            self::Overdue => 'Overdue',
        };
    }

    public function isTerminal(): bool
    {
        return match ($this) {
            self::Approved => true,
            default => false,
        };
    }

    public function canUpload(): bool
    {
        return match ($this) {
            // Uploaded is included so the applicant can replace a staged file before submitting.
            self::AwaitingUpload, self::Uploaded, self::Rejected, self::Overdue => true,
            default => false,
        };
    }

    /** Whether an admin reminder is meaningful for this status. */
    public function canRemind(): bool
    {
        return match ($this) {
            self::AwaitingUpload, self::Uploaded, self::Overdue => true,
            default => false,
        };
    }
}
