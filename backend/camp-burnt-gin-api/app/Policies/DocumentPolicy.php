<?php

namespace App\Policies;

use App\Models\Document;
use App\Models\User;

/**
 * Policy for Document resource authorization.
 *
 * Controls access to uploaded documents based on ownership and roles.
 * Implements FR-34: Document access control.
 */
class DocumentPolicy
{
    /**
     * Determine whether the user can view any documents.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can view the document.
     */
    public function view(User $user, Document $document): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($document->uploaded_by === $user->id) {
            return true;
        }

        if ($document->documentable_type === 'App\\Models\\Camper') {
            return $user->campers()->where('id', $document->documentable_id)->exists();
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff can view documents attached to campers or medical records.
            if ($document->documentable_type === 'App\\Models\\Camper') {
                return true;
            }

            if ($document->documentable_type === 'App\\Models\\MedicalRecord') {
                return true;
            }
        }

        return false;
    }

    /**
     * Determine whether the user can create documents.
     *
     * Admins, parents, and medical providers can upload documents.
     * Specific authorization for what they can attach to is handled
     * in StoreDocumentRequest.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isApplicant() || $user->isMedicalProvider();
    }

    /**
     * Determine whether the user can delete the document.
     */
    public function delete(User $user, Document $document): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $document->uploaded_by === $user->id;
    }
}
