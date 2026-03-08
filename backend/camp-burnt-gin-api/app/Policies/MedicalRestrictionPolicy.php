<?php

namespace App\Policies;

use App\Models\MedicalRestriction;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * MedicalRestrictionPolicy — controls who can manage a camper's medical restrictions.
 *
 * Medical restrictions are formal constraints placed on a camper's activities or diet
 * based on their health needs (e.g., "no swimming due to ear condition"). Because these
 * restrictions directly affect safety, only administrators and trained medical staff
 * are permitted to create, view, edit, or remove them.
 */
class MedicalRestrictionPolicy
{
    use HandlesAuthorization;

    /**
     * Can the user see a list of all medical restrictions?
     * Only admins and medical staff can browse the full list.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user view a single medical restriction record?
     * Only admins and medical staff can view individual restriction records.
     */
    public function view(User $user, MedicalRestriction $medicalRestriction): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user create a new medical restriction?
     * Only admins and medical staff can add restrictions — parents cannot.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user edit an existing medical restriction?
     * Only admins and medical staff can update restrictions.
     */
    public function update(User $user, MedicalRestriction $medicalRestriction): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user delete a medical restriction?
     * Only admins and medical staff can remove restrictions.
     */
    public function delete(User $user, MedicalRestriction $medicalRestriction): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }
}
