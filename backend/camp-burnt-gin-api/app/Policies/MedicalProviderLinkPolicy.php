<?php

namespace App\Policies;

use App\Models\MedicalProviderLink;
use App\Models\User;

/**
 * Policy for MedicalProviderLink resource authorization.
 *
 * Controls access to provider links based on ownership and roles.
 * Implements FR-19 through FR-25: Provider link access control.
 */
class MedicalProviderLinkPolicy
{
    /**
     * Determine whether the user can view any provider links.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isParent();
    }

    /**
     * Determine whether the user can view the provider link.
     */
    public function view(User $user, MedicalProviderLink $link): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $user->ownsCamper($link->camper);
    }

    /**
     * Determine whether the user can create provider links.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isParent();
    }

    /**
     * Determine whether the user can revoke the provider link.
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
     * Determine whether the user can resend/regenerate the provider link.
     *
     * Only administrators can resend/regenerate links (FR-25).
     */
    public function resend(User $user, MedicalProviderLink $link): bool
    {
        return $user->isAdmin();
    }
}
