<?php

namespace App\Policies;

use App\Models\AssistiveDevice;
use App\Models\MedicalProviderLink;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Policy for authorizing actions on AssistiveDevice resources.
 *
 * Assistive device information contributes to accessibility planning
 * and risk assessment, requiring appropriate access controls.
 */
class AssistiveDevicePolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any assistive devices.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Determine whether the user can view the assistive device.
     */
    public function view(User $user, AssistiveDevice $assistiveDevice): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            return MedicalProviderLink::where('camper_id', $assistiveDevice->camper_id)
                ->where('is_used', true)
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->exists();
        }

        if ($user->isApplicant() && $user->ownsCamper($assistiveDevice->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can create assistive devices.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider() || $user->isApplicant();
    }

    /**
     * Determine whether the user can update the assistive device.
     */
    public function update(User $user, AssistiveDevice $assistiveDevice): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            return MedicalProviderLink::where('camper_id', $assistiveDevice->camper_id)
                ->where('is_used', true)
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->exists();
        }

        if ($user->isApplicant() && $user->ownsCamper($assistiveDevice->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can delete the assistive device.
     */
    public function delete(User $user, AssistiveDevice $assistiveDevice): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($assistiveDevice->camper)) {
            return true;
        }

        return false;
    }
}
