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
     * Medical providers can only view for campers they have valid provider links for.
     * Parents can only view medications for their own children.
     */
    public function view(User $user, Medication $medication): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Medical providers require valid, non-revoked, unexpired provider link
            return \App\Models\MedicalProviderLink::where('camper_id', $medication->camper_id)
                ->where('is_used', true)
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->exists();
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
     * Medical providers can update only for campers they have valid provider links for.
     * Parents can update medications for their own children.
     */
    public function update(User $user, Medication $medication): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Medical providers require valid, non-revoked, unexpired provider link
            return \App\Models\MedicalProviderLink::where('camper_id', $medication->camper_id)
                ->where('is_used', true)
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->exists();
        }

        if ($user->isParent() && $user->ownsCamper($medication->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can delete the medication.
     *
     * AUTHORIZATION DESIGN NOTE:
     * Medical providers can create and update medications but cannot delete them.
     * This intentional design ensures that:
     * - Providers can document medications discovered during care
     * - Providers can update dosage or frequency as medically appropriate
     * - Providers cannot remove medication records from the system
     * - All provider modifications are audited via PHI audit middleware
     * - Parents retain final authority over their child's medical record
     *
     * This follows HIPAA best practices for medical record integrity
     * and audit trail completeness.
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
