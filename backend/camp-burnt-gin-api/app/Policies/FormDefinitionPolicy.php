<?php

namespace App\Policies;

use App\Models\FormDefinition;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * FormDefinitionPolicy — authorization rules for the application form versioning system.
 *
 * Access summary:
 *  - Any authenticated user   → may read the active form schema (needed for applicant rendering)
 *  - Admin / Super Admin      → may browse all form definitions and their sections/fields
 *  - Super Admin only         → may create, edit, delete, and publish form definitions
 *
 * Rationale for super_admin only on mutations: form structure changes are high-impact
 * system configuration. A mistaken edit could break the applicant experience for all
 * families. Regular admins retain read access to understand what applicants are filling
 * out, but cannot make structural changes.
 */
class FormDefinitionPolicy
{
    use HandlesAuthorization;

    /**
     * Browse all form definition versions.
     * Admin and super_admin can see the form version history.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * View a specific form definition (including sections and fields).
     * Any authenticated user may read — applicants need this to render the active form.
     */
    public function view(User $user, FormDefinition $form): bool
    {
        return true; // any authenticated user
    }

    /**
     * Create a new form definition (draft).
     * Super admin only — creating a new version is a governance action.
     */
    public function create(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    /**
     * Update a form definition's metadata (name, description).
     * Super admin only, and only while the definition is in 'draft' status.
     */
    public function update(User $user, FormDefinition $form): bool
    {
        return $user->isSuperAdmin() && $form->isEditable();
    }

    /**
     * Permanently delete a form definition.
     * Super admin only, and only if it has never been published (status = 'draft').
     * Active and archived definitions cannot be deleted to preserve audit history.
     */
    public function delete(User $user, FormDefinition $form): bool
    {
        return $user->isSuperAdmin() && $form->status === 'draft';
    }

    /**
     * Publish a draft definition, making it the live active form.
     * Super admin only, and only when the definition is in 'draft' status.
     * Active and archived definitions cannot be re-published.
     */
    public function publish(User $user, FormDefinition $form): bool
    {
        return $user->isSuperAdmin() && $form->status === 'draft';
    }

    /**
     * Duplicate an existing definition into a new draft.
     * Super admin only.
     */
    public function duplicate(User $user, FormDefinition $form): bool
    {
        return $user->isSuperAdmin();
    }
}
