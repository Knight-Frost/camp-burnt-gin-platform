<?php

namespace App\Enums;

/**
 * DocumentReviewAction — all possible actions recorded in document_review_events.
 *
 * Using a PHP enum backed by string rather than a DB ENUM means new actions can
 * be added without an ALTER TABLE migration. The application layer validates values;
 * the column stores plain VARCHAR.
 */
enum DocumentReviewAction: string
{
    // Admin created a formal document request (document not yet uploaded).
    case Requested = 'requested';

    // Applicant uploaded a file (draft; not yet sent to admin).
    case Uploaded = 'uploaded';

    // Applicant clicked Send — document is now in the admin review queue.
    case Sent = 'sent';

    // Admin opened the document for review.
    case Viewed = 'viewed';

    // Document is actively being reviewed by an admin.
    case UnderReview = 'under_review';

    // Admin accepted the document's content.
    case Approved = 'approved';

    // Admin rejected the document's content; same request reopens for resubmission.
    case Rejected = 'rejected';

    // Applicant uploaded a corrected version after a rejection.
    case Resubmitted = 'resubmitted';

    // Due date passed with no upload — stamped by the overdue detection job.
    case Overdue = 'overdue';

    // Admin created a new request to replace a previously closed or expired one.
    case ReRequested = 're_requested';

    // Admin added a free-form note without changing the document status.
    case NoteAdded = 'note_added';

    // ── Application-level events ──────────────────────────────────────────
    // Event rows with these actions have document_id = null and represent
    // something that happened to the APPLICATION as a whole. They share the
    // same table so the review timeline is a single append-only stream —
    // reviewers see document actions and application actions interleaved.

    // Admin clicked "Start Review" (soft-claim).
    case ReviewStarted = 'review_started';

    // Admin approved the application (final decision).
    case ApplicationApproved = 'application_approved';

    // Admin rejected the application (final decision).
    case ApplicationRejected = 'application_rejected';

    // Admin waitlisted the application.
    case ApplicationWaitlisted = 'application_waitlisted';

    // Admin cancelled the application (reversible).
    case ApplicationCancelled = 'application_cancelled';

    // Admin reopened a cancelled application back to under_review.
    case ApplicationReopened = 'application_reopened';

    public function label(): string
    {
        return match ($this) {
            self::Requested => 'Document requested',
            self::Uploaded => 'File uploaded',
            self::Sent => 'Submitted for review',
            self::Viewed => 'Opened by reviewer',
            self::UnderReview => 'Under review',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
            self::Resubmitted => 'Resubmitted',
            self::Overdue => 'Marked overdue',
            self::ReRequested => 'Re-requested',
            self::NoteAdded => 'Note added',
            self::ReviewStarted => 'Review started',
            self::ApplicationApproved => 'Application approved',
            self::ApplicationRejected => 'Application rejected',
            self::ApplicationWaitlisted => 'Application waitlisted',
            self::ApplicationCancelled => 'Application cancelled',
            self::ApplicationReopened => 'Application reopened',
        };
    }

    public function isAdminAction(): bool
    {
        return match ($this) {
            self::Approved, self::Rejected, self::Viewed, self::UnderReview,
            self::Requested, self::ReRequested, self::NoteAdded,
            self::ReviewStarted, self::ApplicationApproved, self::ApplicationRejected,
            self::ApplicationWaitlisted, self::ApplicationCancelled, self::ApplicationReopened => true,
            default => false,
        };
    }

    public function isApplicantAction(): bool
    {
        return match ($this) {
            self::Uploaded, self::Sent, self::Resubmitted => true,
            default => false,
        };
    }

    /**
     * Whether the event pertains to the application as a whole (vs. a
     * specific document). Lets UIs render these differently — the review
     * history panel groups application-level events above document ones.
     */
    public function isApplicationLevel(): bool
    {
        return match ($this) {
            self::ReviewStarted, self::ApplicationApproved, self::ApplicationRejected,
            self::ApplicationWaitlisted, self::ApplicationCancelled, self::ApplicationReopened => true,
            default => false,
        };
    }
}
