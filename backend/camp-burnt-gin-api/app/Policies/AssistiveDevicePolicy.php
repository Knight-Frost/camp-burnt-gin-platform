<?php

namespace App\Policies;

use App\Models\AssistiveDevice;
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
            // Camp medical staff have direct access to all camper assistive device records.
            return true;
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
            // Camp medical staff may update assistive device records during active care.
            return true;
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
