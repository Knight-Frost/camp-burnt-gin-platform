<?php

namespace App\Policies;

use App\Models\CampSession;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Policy for authorizing actions on CampSession resources.
 *
 * Camp sessions are publicly viewable to all authenticated users.
 * Only administrators can create, update, or delete camp sessions.
 */
class CampSessionPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any camp sessions.
     *
     * All authenticated users can view the list of camp sessions.
     * Non-admins will have the list filtered to show only active sessions.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can view the camp session.
     *
     * All authenticated users can view camp session details.
     */
    public function view(User $user, CampSession $session): bool
    {
        return true;
    }

    /**
     * Determine whether the user can create camp sessions.
     *
     * Only administrators can create new camp sessions.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can update the camp session.
     *
     * Only administrators can update camp sessions.
     */
    public function update(User $user, CampSession $session): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can delete the camp session.
     *
     * Only administrators can delete camp sessions.
     */
    public function delete(User $user, CampSession $session): bool
    {
        return $user->isAdmin();
    }
}
