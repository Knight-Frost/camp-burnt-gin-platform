<?php

namespace App\Policies;

use App\Models\MedicalProviderLink;
use App\Models\User;

/**
 * MedicalProviderLinkPolicy — controls who can manage links to external medical providers.
 *
 * A medical provider link is a secure, time-limited token sent to an outside doctor
 * or medical professional so they can submit a camper's medical information directly.
 * This policy determines who can create, view, revoke, or resend those links.
 * Implements FR-19 through FR-25: Provider link access control.
 */
class MedicalProviderLinkPolicy
{
    /**
     * Can the user see any provider links at all?
     * Admins and the camper's parent can view links — medical staff cannot.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isApplicant();
    }

    /**
     * Can the user view a specific provider link?
     * Admins see all links. Parents can only see links for their own camper.
     */
    public function view(User $user, MedicalProviderLink $link): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $user->ownsCamper($link->camper);
    }

    /**
     * Can the user create a new provider link?
     * Both admins and parents can invite an external medical provider.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isApplicant();
    }

    /**
     * Can the user revoke (cancel) an active provider link?
     *
     * Parents can revoke their own camper's links (FR-24).
     * Administrators can revoke any link.
     */
    public function revoke(User $user, MedicalProviderLink $link): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $user->ownsCamper($link->camper);
    }

    /**
     * Can the user resend or regenerate a provider link?
     *
     * Only administrators can resend/regenerate links (FR-25).
     */
    public function resend(User $user, MedicalProviderLink $link): bool
    {
        return $user->isAdmin();
    }
}
