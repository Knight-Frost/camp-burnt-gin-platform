<?php

namespace App\Policies;

use App\Models\Allergy;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Policy for authorizing actions on Allergy resources.
 *
 * Allergy information is critical for camper safety and is accessible
 * by administrators, medical providers, and the camper's parent/guardian.
 */
class AllergyPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any allergies.
     *
     * Administrators and medical providers can view the list.
     * Parents access their own allergies through scoped queries.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Determine whether the user can view the allergy.
     *
     * Administrators have full access.
     * Medical providers can only view for campers they have valid provider links for.
     * Parents can only view allergies for their own children.
     */
    public function view(User $user, Allergy $allergy): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Medical providers require valid, non-revoked, unexpired provider link
            return \App\Models\MedicalProviderLink::where('camper_id', $allergy->camper_id)
                ->where('is_used', true)
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->exists();
        }

        if ($user->isParent() && $user->ownsCamper($allergy->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can create allergies.
     *
     * Administrators, medical providers, and parents can record allergies.
     * Medical providers may document allergies discovered during care.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider() || $user->isParent();
    }

    /**
     * Determine whether the user can update the allergy.
     *
     * Administrators have full access.
     * Medical providers can update only for campers they have valid provider links for.
     * Parents can update allergies for their own children.
     */
    public function update(User $user, Allergy $allergy): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Medical providers require valid, non-revoked, unexpired provider link
            return \App\Models\MedicalProviderLink::where('camper_id', $allergy->camper_id)
                ->where('is_used', true)
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->exists();
        }

        if ($user->isParent() && $user->ownsCamper($allergy->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can delete the allergy.
     *
     * AUTHORIZATION DESIGN NOTE:
     * Medical providers can create and update allergies but cannot delete them.
     * This intentional design ensures that:
     * - Providers can document allergies discovered during care
     * - Providers can update treatment protocols
     * - Providers cannot remove allergy records from the system
     * - All provider modifications are audited via PHI audit middleware
     * - Parents retain final authority over their child's medical record
     *
     * This follows HIPAA best practices for medical record integrity
     * and audit trail completeness.
     *
     * Administrators have full access.
     * Parents can delete allergies for their own children.
     * Medical providers cannot delete allergy records.
     */
    public function delete(User $user, Allergy $allergy): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isParent() && $user->ownsCamper($allergy->camper)) {
            return true;
        }

        return false;
    }
}
