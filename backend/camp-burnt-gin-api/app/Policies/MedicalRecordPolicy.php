<?php

namespace App\Policies;

use App\Models\MedicalRecord;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Policy for authorizing actions on MedicalRecord resources.
 *
 * Medical records contain HIPAA-protected health information and require
 * strict access controls. Administrators, medical providers, and the
 * camper's parent/guardian may access these records.
 */
class MedicalRecordPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any medical records.
     *
     * Administrators and medical providers can view the list.
     * Parents access their own records through scoped queries.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Determine whether the user can view the medical record.
     *
     * Administrators have full access.
     * Medical providers can only view records for campers they're linked to.
     * Parents can only view records for their own children.
     */
    public function view(User $user, MedicalRecord $medicalRecord): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Verify provider has an active link to this camper
            return \App\Models\MedicalProviderLink::where('camper_id', $medicalRecord->camper_id)
                ->where('is_used', true)
                ->exists();
        }

        if ($user->isParent() && $user->ownsCamper($medicalRecord->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can create medical records.
     *
     * Administrators and parents can create medical records.
     * Medical providers cannot create new records.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isParent();
    }

    /**
     * Determine whether the user can update the medical record.
     *
     * Administrators have full access.
     * Medical providers can only update records for campers they're linked to.
     * Parents can update records for their own children.
     */
    public function update(User $user, MedicalRecord $medicalRecord): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Verify provider has an active link to this camper
            return \App\Models\MedicalProviderLink::where('camper_id', $medicalRecord->camper_id)
                ->where('is_used', true)
                ->exists();
        }

        if ($user->isParent() && $user->ownsCamper($medicalRecord->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can delete the medical record.
     *
     * Only administrators can delete medical records.
     * Medical data should generally be retained for compliance.
     */
    public function delete(User $user, MedicalRecord $medicalRecord): bool
    {
        return $user->isAdmin();
    }
}
