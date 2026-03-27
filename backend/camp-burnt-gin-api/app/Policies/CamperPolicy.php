<?php

namespace App\Policies;

use App\Models\Camper;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * CamperPolicy — Authorization rules for Camper records.
 *
 * A "Camper" is a child registered to attend camp. This policy decides
 * who is allowed to view, create, edit, or delete a camper profile.
 *
 * Access summary:
 *  - Admins        → full access to every camper
 *  - Applicants    → access only to their own children (ownsCamper check)
 *  - Medical staff → read/view access to support clinical workflows
 *
 * This policy is registered automatically by Laravel's AuthServiceProvider
 * because the model and policy names follow the naming convention.
 */
class CamperPolicy
{
    // This trait adds helper methods like allow() and deny() used by Laravel internals.
    use HandlesAuthorization;

    /**
     * Can the user browse the full camper list?
     *
     * Only admins see the full directory. Parents only ever see their
     * own children, so scoped queries are used instead of this gate.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user view a specific camper's profile?
     *
     * Three groups are allowed — we check each in order and return true
     * as soon as one matches so we don't do unnecessary work.
     */
    public function view(User $user, Camper $camper): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // A parent may view their own child's profile.
        // ownsCamper() confirms the camper belongs to this user account.
        if ($user->isApplicant() && $user->ownsCamper($camper)) {
            return true;
        }

        // Medical providers need to see camper profiles to record treatments,
        // review records, and upload documents during a camp session.
        // Restricted to active (approved) campers only — medical staff must not
        // access data for applicants who have not yet been accepted to camp.
        if ($user->isMedicalProvider()) {
            return $user->canAccessCamperAsMedical($camper);
        }

        return false;
    }

    /**
     * Can the user create a new camper profile?
     *
     * Admins can create campers on behalf of families. Parents create
     * camper profiles when registering their child for camp.
     * Medical staff never create camper profiles — that is not their role.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isApplicant();
    }

    /**
     * Can the user edit an existing camper's profile?
     *
     * Admins may update any camper. A parent can only edit their
     * own child's profile (ownsCamper enforces this).
     * Medical staff cannot edit camper profiles — they work with medical records.
     */
    public function update(User $user, Camper $camper): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // Parent can update only their own child.
        if ($user->isApplicant() && $user->ownsCamper($camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user delete a camper profile?
     *
     * Deletion is a serious action that removes a child from the system.
     * The same ownership rules as update apply — admins or the child's parent only.
     */
    public function delete(User $user, Camper $camper): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // Parent can delete only their own child's profile.
        if ($user->isApplicant() && $user->ownsCamper($camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user create a medical provider link for this camper?
     *
     * A "provider link" associates a medical provider account with a specific
     * camper so they can access that child's medical data. Only admins and
     * the child's own parent may authorise this connection (FR-19).
     */
    public function createProviderLink(User $user, Camper $camper): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // Only the parent who owns this camper can create a provider link.
        if ($user->isApplicant() && $user->ownsCamper($camper)) {
            return true;
        }

        return false;
    }
}
