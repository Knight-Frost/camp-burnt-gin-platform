<?php

namespace App\Policies;

use App\Models\EmergencyContact;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Policy for authorizing actions on EmergencyContact resources.
 *
 * Emergency contacts are accessible by administrators, medical providers
 * (for emergency response), and the camper's parent/guardian.
 */
class EmergencyContactPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any emergency contacts.
     *
     * Administrators and medical providers can view the list.
     * Parents access their own contacts through scoped queries.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Determine whether the user can view the emergency contact.
     *
     * Administrators have full access.
     * Medical providers can only view for campers they have valid provider links for.
     * Parents can only view contacts for their own children.
     */
    public function view(User $user, EmergencyContact $emergencyContact): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Medical providers require valid, non-revoked, unexpired provider link
            return \App\Models\MedicalProviderLink::where('camper_id', $emergencyContact->camper_id)
                ->where('is_used', true)
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->exists();
        }

        if ($user->isApplicant() && $user->ownsCamper($emergencyContact->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can create emergency contacts.
     *
     * Administrators and parents can create emergency contacts.
     * Medical providers cannot create contacts.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isApplicant();
    }

    /**
     * Determine whether the user can update the emergency contact.
     *
     * Administrators have full access.
     * Parents can update contacts for their own children.
     * Medical providers cannot modify contact information.
     */
    public function update(User $user, EmergencyContact $emergencyContact): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($emergencyContact->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can delete the emergency contact.
     *
     * Administrators have full access.
     * Parents can delete contacts for their own children.
     * Medical providers cannot delete contacts.
     */
    public function delete(User $user, EmergencyContact $emergencyContact): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($emergencyContact->camper)) {
            return true;
        }

        return false;
    }
}
