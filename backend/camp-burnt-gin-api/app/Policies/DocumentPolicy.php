<?php

namespace App\Policies;

use App\Models\Document;
use App\Models\User;

/**
 * DocumentPolicy — Authorization rules for uploaded Document records.
 *
 * Documents are files uploaded and attached to other models (e.g., a Camper
 * profile or a MedicalRecord). Access depends on who uploaded the file and
 * what model it is attached to ("documentable").
 *
 * Access summary:
 *  - Admins        → full access to all documents
 *  - Applicants    → access to documents they uploaded, or attached to their child
 *  - Medical staff → view and upload documents on ACTIVE campers/medical-records only
 *
 * Only admins may verify or reject uploaded documents (the update action).
 * Implements FR-34: Document access control.
 */
class DocumentPolicy
{
    /**
     * Can the user browse the full document list?
     *
     * Only admins see every document. Other users query documents
     * through the model they are attached to (e.g., camper documents).
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user view a specific document?
     *
     * Access is granted by several independent checks — we return true
     * as soon as any one of them passes.
     */
    public function view(User $user, Document $document): bool
    {
        // The person who uploaded the document can always view it — even if
        // the parent application is still a draft. They need to be able to
        // preview and delete their own staging uploads.
        if ($document->uploaded_by === $user->id) {
            return true;
        }

        // Admins and medical staff may never view a document that is still in
        // the applicant's private staging area. Two staging signals close the
        // door: (a) the document itself has no submitted_at, OR (b) the
        // document is attached to an Application that is still is_draft=true
        // or has no submitted_at. Either condition = staging = deny.
        $isStaging = $document->isDraft() || $this->parentApplicationIsDraft($document);

        // Admins see every submitted document belonging to a submitted app.
        if ($user->isAdmin()) {
            return ! $isStaging;
        }

        // Staging documents stay private to the uploader, full stop.
        if ($isStaging) {
            return false;
        }

        // Medical providers can view documents only for ACTIVE (enrolled) campers and their
        // medical records. Scoping to active campers prevents PHI enumeration for applicants
        // who were rejected, withdrawn, or not yet approved. The documentable relationship
        // is loaded here to check is_active — one query per authorization call is acceptable.
        if ($user->isMedicalProvider()) {
            if ($document->documentable_type === 'App\\Models\\Camper') {
                return $document->documentable?->is_active === true;
            }
            if ($document->documentable_type === 'App\\Models\\MedicalRecord') {
                return $document->documentable?->is_active === true;
            }
        }

        // If the document is attached to a Camper, the parent who owns that
        // camper can view it. campers() scopes the query to this user's children.
        if ($document->documentable_type === 'App\\Models\\Camper') {
            return $user->campers()->where('id', $document->documentable_id)->exists();
        }

        // Application-linked documents: the owning parent can view once submitted.
        if ($document->documentable_type === 'App\\Models\\Application') {
            /** @var \App\Models\Application|null $application */
            $application = $document->documentable;
            if ($application instanceof \App\Models\Application && $application->camper) {
                return $user->campers()->where('id', $application->camper->id)->exists();
            }
        }

        return false;
    }

    /**
     * True when the document is attached to an Application that has not yet
     * been submitted by the family. Such documents are applicant staging PHI
     * and must not leak to admin or medical reviewers, even if submitted_at
     * happens to be set on the document row itself (belt-and-suspenders).
     */
    private function parentApplicationIsDraft(Document $document): bool
    {
        if ($document->documentable_type !== \App\Models\Application::class) {
            return false;
        }

        /** @var \App\Models\Application|null $app */
        $app = $document->documentable;
        if (! $app instanceof \App\Models\Application) {
            return false;
        }

        return $app->is_draft === true || $app->submitted_at === null;
    }

    /**
     * Can the user upload a new document?
     *
     * Admins, parents, and medical providers may upload documents.
     * The specific model they are allowed to attach the document to
     * is further validated inside StoreDocumentRequest.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isApplicant() || $user->isMedicalProvider();
    }

    /**
     * Can the user update (verify or reject) a document?
     *
     * Verification is an administrative action — only admins may approve
     * or reject documents that parents and medical providers have uploaded.
     */
    public function update(User $user, Document $document): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user delete a document?
     *
     * Admins can delete any document. The person who originally uploaded
     * a document may also remove it (they "own" what they submitted).
     */
    public function delete(User $user, Document $document): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // The uploader may delete their own document.
        return $document->uploaded_by === $user->id;
    }
}
