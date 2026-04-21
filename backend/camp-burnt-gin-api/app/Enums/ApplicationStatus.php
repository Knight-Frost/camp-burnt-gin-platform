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
    // The parent is still filling out the form — not yet officially submitted.
    case Draft = 'draft';

    // The parent has fully submitted the application; nobody has looked at it yet.
    case Submitted = 'submitted';

    // Staff are actively reviewing the application right now.
    case UnderReview = 'under_review';

    // The camper has been accepted — they can attend camp!
    case Approved = 'approved';

    // The application was not accepted after review.
    case Rejected = 'rejected';

    // The application was cancelled by an administrator.
    case Cancelled = 'cancelled';

    // The session is full; the camper is queued and may be promoted if space opens.
    case Waitlisted = 'waitlisted';

    // The application was voluntarily withdrawn by the parent before or after approval.
    // This is a parent-initiated action only — use Cancelled for admin-initiated termination.
    case Withdrawn = 'withdrawn';

    /**
     * Returns a friendly, readable version of the status for display in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Submitted => 'Submitted',
            self::UnderReview => 'Under Review',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
            self::Cancelled => 'Cancelled',
            self::Waitlisted => 'Waitlisted',
            self::Withdrawn => 'Withdrawn',
        };
    }

    /**
     * Returns true if the application has reached a lifecycle end state
     * for the applicant's perspective — meaning the parent should be able
     * to start a fresh reapplication rather than being blocked by a slot
     * still held by this row. The admin-only `canTransitionTo()` rules
     * are looser (Cancelled may be reversed back to UnderReview) but
     * that reversal is an administrative exception, not a reason to
     * block the parent from reapplying in the meantime.
     */
    public function isFinal(): bool
    {
        return in_array($this, [
            self::Approved,
            self::Rejected,
            self::Cancelled,
            self::Withdrawn,
        ], strict: true);
    }

    /**
     * Returns true if the application can still be promoted off the waitlist.
     * Waitlisted applications are not final — staff can approve them when capacity opens.
     */
    public function isPromotable(): bool
    {
        return $this === self::Waitlisted;
    }

    /**
     * Returns true if the application can still be edited by the parent.
     * Once a final decision is made, editing is locked.
     */
    public function isEditable(): bool
    {
        // Draft: parent still filling out the form (always editable).
        // Submitted / UnderReview: admin hasn't made a final decision yet —
        // parents may still correct or supplement data while awaiting review.
        return in_array($this, [
            self::Draft,
            self::Submitted,
            self::UnderReview,
        ], strict: true);
    }

    /**
     * Returns true if the given status is a valid next state from this status.
     *
     * This method encodes the authoritative state transition rules.
     * Admin review transitions are enforced by ApplicationService.
     * The applicant submit flow (draft → submitted) uses finalize() and is NOT
     * routed through canTransitionTo() — it bypasses the admin review gate.
     * Parent-initiated withdrawal uses withdrawApplication() and is also not routed here.
     *
     * Transition table:
     *   Draft        → Submitted (applicant submits via finalize())
     *   Submitted    → UnderReview, Approved, Rejected, Waitlisted, Cancelled (admin)
     *   UnderReview  → Approved, Rejected, Waitlisted, Cancelled, Submitted (admin)
     *   Approved     → Rejected (reversal), Cancelled (admin cancellation)
     *   Rejected     → Approved (re-approval only — cannot re-open to UnderReview)
     *   Waitlisted   → Approved, Rejected, Cancelled
     *   Cancelled    → UnderReview (admin reversal — re-queues for fresh decision)
     *   Withdrawn    → no valid transitions (irreversible, parent-initiated)
     *
     * Self-transitions (same → same) are always invalid.
     */
    public function canTransitionTo(ApplicationStatus $new): bool
    {
        // Self-transitions are meaningless — no state should transition to itself.
        if ($this === $new) {
            return false;
        }

        return match ($this) {
            // Applicant submit flow: draft may only move to submitted.
            self::Draft => $new === self::Submitted,
            self::Submitted => in_array($new, [
                self::UnderReview,
                self::Approved,
                self::Rejected,
                self::Waitlisted,
                self::Cancelled,
            ], strict: true),
            self::UnderReview => in_array($new, [
                self::Approved,
                self::Rejected,
                self::Waitlisted,
                self::Cancelled,
                self::Submitted,
            ], strict: true),
            // Reversal: an approved application may only move to rejected (reversal)
            // or cancelled (admin-initiated cancellation of enrollment).
            self::Approved => in_array($new, [
                self::Rejected,
                self::Cancelled,
            ], strict: true),
            // Re-approval only: a rejected application may only be directly re-approved.
            self::Rejected => $new === self::Approved,
            // Waitlisted applications may be promoted, declined, or cancelled.
            self::Waitlisted => in_array($new, [
                self::Approved,
                self::Rejected,
                self::Cancelled,
            ], strict: true),
            // Admin reversal of a cancellation — forces back to UnderReview for
            // audit trail clarity ("cancelled then re-reviewed", not "silently approved").
            self::Cancelled => $new === self::UnderReview,
            // Withdrawn is parent-initiated and permanent.
            self::Withdrawn => false,
        };
    }
}
