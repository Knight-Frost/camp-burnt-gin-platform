<?php

namespace App\Policies;

use App\Models\Camper;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Policy for authorizing actions on Camper resources.
 *
 * Campers can only be accessed by their parent/guardian or administrators.
 * Medical providers do not have direct access to camper profiles.
 */
class CamperPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any campers.
     *
     * Only administrators can view the full list of campers.
     * Parents access their own campers through scoped queries.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can view the camper.
     *
     * Administrators have full access.
     * Parents can only view their own children.
     * Medical providers cannot view camper profiles directly.
     */
    public function view(User $user, Camper $camper): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can create campers.
     *
     * Administrators and parents can create camper profiles.
     * Medical providers cannot create camper profiles.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isApplicant();
    }

    /**
     * Determine whether the user can update the camper.
     *
     * Administrators have full access.
     * Parents can only update their own children.
     * Medical providers cannot update camper profiles.
     */
    public function update(User $user, Camper $camper): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can delete the camper.
     *
     * Administrators have full access.
     * Parents can only delete their own children.
     * Medical providers cannot delete camper profiles.
     */
    public function delete(User $user, Camper $camper): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can create a medical provider link for the camper.
     *
     * Administrators and parents can create provider links.
     * Parents can only create links for their own children.
     * Implements FR-19: Secure provider link creation.
     */
    public function createProviderLink(User $user, Camper $camper): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($camper)) {
            return true;
        }

        return false;
    }
}
