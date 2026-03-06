<?php

namespace App\Policies;

use App\Models\ActivityPermission;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Policy for authorizing actions on ActivityPermission resources.
 *
 * Activity permissions determine camper participation in camp activities
 * based on medical or safety considerations, requiring appropriate
 * access controls for risk management.
 */
class ActivityPermissionPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any activity permissions.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Determine whether the user can view the activity permission.
     */
    public function view(User $user, ActivityPermission $activityPermission): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff have direct access to all camper activity permissions.
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($activityPermission->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can create activity permissions.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider() || $user->isApplicant();
    }

    /**
     * Determine whether the user can update the activity permission.
     */
    public function update(User $user, ActivityPermission $activityPermission): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may update activity permissions during active care.
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($activityPermission->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can delete the activity permission.
     */
    public function delete(User $user, ActivityPermission $activityPermission): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($activityPermission->camper)) {
            return true;
        }

        return false;
    }
}
