<?php

namespace App\Policies;

use App\Models\Medication;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Policy for authorizing actions on Medication resources.
 *
 * Medication information is essential for proper camper care and is
 * accessible by administrators, medical providers, and the camper's
 * parent/guardian.
 */
class MedicationPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any medications.
     *
     * Administrators and medical providers can view the list.
     * Parents access their own medications through scoped queries.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Determine whether the user can view the medication.
     *
     * Administrators have full access.
     * Medical providers can view for care purposes.
     * Parents can only view medications for their own children.
     */
    public function view(User $user, Medication $medication): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            return true;
        }

        if ($user->isParent() && $user->ownsCamper($medication->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can create medications.
     *
     * Administrators, medical providers, and parents can record medications.
     * Medical providers may document medications during care.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider() || $user->isParent();
    }

    /**
     * Determine whether the user can update the medication.
     *
     * Administrators have full access.
     * Medical providers can update medication information.
     * Parents can update medications for their own children.
     */
    public function update(User $user, Medication $medication): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            return true;
        }

        if ($user->isParent() && $user->ownsCamper($medication->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can delete the medication.
     *
     * Administrators have full access.
     * Parents can delete medications for their own children.
     * Medical providers cannot delete medication records.
     */
    public function delete(User $user, Medication $medication): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isParent() && $user->ownsCamper($medication->camper)) {
            return true;
        }

        return false;
    }
}
