<?php

namespace App\Policies;

use App\Models\ActivityPermission;
use App\Models\MedicalProviderLink;
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
            return MedicalProviderLink::where('camper_id', $activityPermission->camper_id)
                ->where('is_used', true)
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->exists();
        }

        if ($user->isParent() && $user->ownsCamper($activityPermission->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can create activity permissions.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider() || $user->isParent();
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
            return MedicalProviderLink::where('camper_id', $activityPermission->camper_id)
                ->where('is_used', true)
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->exists();
        }

        if ($user->isParent() && $user->ownsCamper($activityPermission->camper)) {
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

        if ($user->isParent() && $user->ownsCamper($activityPermission->camper)) {
            return true;
        }

        return false;
    }
}
