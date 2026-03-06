<?php

namespace App\Policies;

use App\Models\Diagnosis;
use App\Models\MedicalProviderLink;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Policy for authorizing actions on Diagnosis resources.
 *
 * Diagnoses contain HIPAA-protected health information and require
 * strict access controls. Administrators, medical providers with
 * valid links, and the camper's parent/guardian may access these records.
 */
class DiagnosisPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any diagnoses.
     *
     * Administrators and medical providers can view the list.
     * Parents access their children's diagnoses through scoped queries.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Determine whether the user can view the diagnosis.
     *
     * Administrators have full access.
     * Medical providers can only view diagnoses for campers they're linked to.
     * Parents can only view diagnoses for their own children.
     */
    public function view(User $user, Diagnosis $diagnosis): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            return MedicalProviderLink::where('camper_id', $diagnosis->camper_id)
                ->where('is_used', true)
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->exists();
        }

        if ($user->isApplicant() && $user->ownsCamper($diagnosis->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can create diagnoses.
     *
     * Administrators, medical providers, and parents can create diagnoses.
     * Medical providers may document diagnoses discovered during care.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider() || $user->isApplicant();
    }

    /**
     * Determine whether the user can update the diagnosis.
     *
     * Administrators have full access.
     * Medical providers can update diagnoses for campers they're linked to.
     * Parents can update diagnoses for their own children.
     */
    public function update(User $user, Diagnosis $diagnosis): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            return MedicalProviderLink::where('camper_id', $diagnosis->camper_id)
                ->where('is_used', true)
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->exists();
        }

        if ($user->isApplicant() && $user->ownsCamper($diagnosis->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can delete the diagnosis.
     *
     * Only administrators and parents can delete diagnoses.
     * Medical providers cannot delete diagnosis records to maintain
     * audit trail integrity and ensure parents retain final authority
     * over their child's medical record.
     */
    public function delete(User $user, Diagnosis $diagnosis): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($diagnosis->camper)) {
            return true;
        }

        return false;
    }
}
