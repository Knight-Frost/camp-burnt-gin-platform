<?php

namespace App\Policies;

use App\Models\Application;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Policy for authorizing actions on Application resources.
 *
 * Applications can only be accessed by their camper's parent/guardian
 * or administrators. Medical providers have no access to applications.
 */
class ApplicationPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any applications.
     *
     * Only administrators can view the full list of applications.
     * Parents access their own applications through scoped queries.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can view the application.
     *
     * Administrators have full access.
     * Parents can only view applications for their own children.
     * Medical providers cannot view applications.
     */
    public function view(User $user, Application $application): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($application->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can create applications.
     *
     * Administrators and parents can create applications.
     * Medical providers cannot create applications.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isApplicant();
    }

    /**
     * Determine whether the user can update the application.
     *
     * Administrators have full access.
     * Parents can only update applications for their own children,
     * and only if the application status allows editing.
     * Medical providers cannot update applications.
     */
    public function update(User $user, Application $application): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($application->camper)) {
            return $application->isEditable();
        }

        return false;
    }

    /**
     * Determine whether the user can delete the application.
     *
     * Only administrators can delete applications.
     * Parents may cancel applications but not delete them.
     */
    public function delete(User $user, Application $application): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can review the application.
     *
     * Only administrators can review and approve/reject applications.
     */
    public function review(User $user, Application $application): bool
    {
        return $user->isAdmin();
    }
}
