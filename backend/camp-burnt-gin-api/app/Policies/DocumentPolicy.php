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

        if ($document->documentable_type === 'App\\Models\\MedicalRecord' && $user->isMedicalProvider()) {
            $medicalRecord = \App\Models\MedicalRecord::find($document->documentable_id);
            if (! $medicalRecord) {
                return false;
            }

            $camperId = $medicalRecord->camper_id;
            $hasAccessViaProviderLink = \App\Models\MedicalProviderLink::where('camper_id', $camperId)
                ->where('is_used', true)
                ->exists();

            return $hasAccessViaProviderLink;
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
        return $user->isAdmin() || $user->isParent() || $user->isMedicalProvider();
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
