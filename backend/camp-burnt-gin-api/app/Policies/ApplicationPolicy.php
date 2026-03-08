<?php

namespace App\Policies;

use App\Models\Application;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * ApplicationPolicy — Authorization rules for camp Applications.
 *
 * An Application is the formal registration a parent submits to enroll
 * their child at camp. This policy controls who can view, create, edit,
 * delete, and review applications.
 *
 * Access summary:
 *  - Admins        → full access to all applications, including review/approve
 *  - Applicants    → access only to applications for their own children
 *  - Medical staff → no access (applications are administrative, not clinical)
 *
 * Note: "Applicant" is the role name for parents/guardians in this system.
 */
class ApplicationPolicy
{
    // This trait adds helper methods like allow() and deny() used by Laravel internals.
    use HandlesAuthorization;

    /**
     * Can the user browse the full list of all applications?
     *
     * Only admins see every application. Parents use scoped queries
     * that automatically filter to their own applications.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user view a specific application?
     *
     * Admins see any application. A parent may only see the application
     * that belongs to their child. Medical staff are excluded entirely.
     */
    public function view(User $user, Application $application): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // A parent may view the application only if they own the camper
        // that the application was submitted for.
        if ($user->isApplicant() && $user->ownsCamper($application->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user submit a new application?
     *
     * Admins can create applications on behalf of families.
     * Parents create applications to register their children for camp.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isApplicant();
    }

    /**
     * Can the user edit an existing application?
     *
     * Admins may update any application at any time.
     * Parents can only edit their own child's application, and only while
     * the application is still in an editable state (e.g., not yet submitted
     * or approved). The isEditable() check enforces that workflow rule.
     */
    public function update(User $user, Application $application): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // Parent can edit only their own child's application,
        // and only if the current status permits changes.
        if ($user->isApplicant() && $user->ownsCamper($application->camper)) {
            // isEditable() returns false for submitted/approved applications.
            return $application->isEditable();
        }

        return false;
    }

    /**
     * Can the user delete an application?
     *
     * Only admins can permanently delete applications for data-integrity reasons.
     * Parents may cancel an application through a separate workflow, but they
     * cannot remove the record entirely.
     */
    public function delete(User $user, Application $application): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user review (approve or reject) an application?
     *
     * Reviewing is an admin-only workflow — it represents the camp staff
     * making an official decision on the child's enrollment.
     */
    public function review(User $user, Application $application): bool
    {
        return $user->isAdmin();
    }
}
