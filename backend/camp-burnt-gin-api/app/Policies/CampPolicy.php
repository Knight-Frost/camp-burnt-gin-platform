<?php

namespace App\Policies;

use App\Models\Camp;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Policy for authorizing actions on Camp resources.
 *
 * Camps are publicly viewable to all authenticated users.
 * Only administrators can create, update, or delete camps.
 */
class CampPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any camps.
     *
     * All authenticated users can view the list of camps.
     * Non-admins will have the list filtered to show only active camps.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can view the camp.
     *
     * All authenticated users can view camp details.
     */
    public function view(User $user, Camp $camp): bool
    {
        return true;
    }

    /**
     * Determine whether the user can create camps.
     *
     * Only administrators can create new camps.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can update the camp.
     *
     * Only administrators can update camps.
     */
    public function update(User $user, Camp $camp): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can delete the camp.
     *
     * Only administrators can delete camps.
     */
    public function delete(User $user, Camp $camp): bool
    {
        return $user->isAdmin();
    }
}
