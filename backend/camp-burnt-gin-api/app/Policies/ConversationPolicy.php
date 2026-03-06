<?php

namespace App\Policies;

use App\Models\Conversation;
use App\Models\User;

/**
 * ConversationPolicy enforces RBAC rules for conversation operations.
 *
 * Implements role-based restrictions:
 * - Parents can only message admins
 * - Admins can message anyone
 * - Medical providers cannot initiate conversations
 * - All participants can view and reply to their conversations
 */
class ConversationPolicy
{
    /**
     * Determine if the user can view any conversations.
     *
     * Admins can view all conversations.
     * Parents and medical providers can only view their own.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine if the user can view the conversation.
     *
     * Users can view conversations they are participants in.
     * Admins can view all conversations.
     */
    public function view(User $user, Conversation $conversation): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $conversation->hasParticipant($user);
    }

    /**
     * Determine if the user can create conversations.
     *
     * Parents can create conversations with admins only.
     * Admins can create conversations with anyone.
     * Medical providers cannot create conversations.
     *
     * Note: Participant role validation must be performed in the service layer
     * before calling this policy. This policy only checks the user's own role.
     *
     * @param User $user The user attempting to create
     * @param bool $hasNonAdminParticipants Whether non-admin participants are included
     */
    public function create(User $user, bool $hasNonAdminParticipants = false): bool
    {
        // Medical providers cannot initiate conversations
        if ($user->isMedicalProvider()) {
            return false;
        }

        // Admins can create conversations with anyone
        if ($user->isAdmin()) {
            return true;
        }

        // Parents can only create conversations with admins
        if ($user->isApplicant()) {
            // Reject if trying to message non-admins
            return !$hasNonAdminParticipants;
        }

        return false;
    }

    /**
     * Determine if the user can update the conversation.
     *
     * Only admins and the creator can update conversation metadata.
     * Updates include archiving and subject changes.
     */
    public function update(User $user, Conversation $conversation): bool
    {
        return $user->isAdmin() || $conversation->created_by_id === $user->id;
    }

    /**
     * Determine if the user can archive the conversation.
     *
     * System-generated notifications cannot be archived — they live in the
     * System tab indefinitely for audit purposes.
     * Creators can archive their own conversations.
     * Admins can archive any user conversation.
     */
    public function archive(User $user, Conversation $conversation): bool
    {
        if ($conversation->is_system_generated) {
            return false;
        }

        return $user->isAdmin() || $conversation->created_by_id === $user->id;
    }

    /**
     * Determine if the user can delete (soft delete) the conversation.
     *
     * Only admins can delete conversations for compliance reasons.
     */
    public function delete(User $user, Conversation $conversation): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine if the user can restore a deleted conversation.
     *
     * Only admins can restore conversations.
     */
    public function restore(User $user, Conversation $conversation): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine if the user can permanently delete the conversation.
     *
     * Permanent deletion is not allowed for HIPAA compliance.
     */
    public function forceDelete(User $user, Conversation $conversation): bool
    {
        return false;
    }

    /**
     * Determine if the user can add participants to the conversation.
     *
     * Only admins can add participants.
     * Medical providers can only be added by admins to relevant conversations.
     */
    public function addParticipant(User $user, Conversation $conversation, User $newParticipant): bool
    {
        if (!$user->isAdmin()) {
            return false;
        }

        // Prevent adding user who is already a participant
        if ($conversation->hasParticipant($newParticipant)) {
            return false;
        }

        // Ensure role-based restrictions are maintained
        // Medical providers can only be added to camper-related conversations
        if ($newParticipant->isMedicalProvider() && !$conversation->isLinkedToCamper()) {
            return false;
        }

        return true;
    }

    /**
     * Determine if the user can remove participants from the conversation.
     *
     * Only admins can remove participants.
     * Cannot remove the conversation creator.
     */
    public function removeParticipant(User $user, Conversation $conversation, User $participant): bool
    {
        if (!$user->isAdmin()) {
            return false;
        }

        // Cannot remove the creator
        if ($conversation->created_by_id === $participant->id) {
            return false;
        }

        return true;
    }

    /**
     * Determine if the user can leave the conversation.
     *
     * System-generated notifications cannot be left — the user remains
     * a participant so they can always access their notification history.
     * Participants can leave conversations except the creator.
     * Admins can always leave.
     */
    public function leave(User $user, Conversation $conversation): bool
    {
        // System notifications cannot be left
        if ($conversation->is_system_generated) {
            return false;
        }

        // Must be a participant
        if (!$conversation->hasParticipant($user)) {
            return false;
        }

        // Creator cannot leave their own conversation (must archive instead)
        if ($conversation->created_by_id === $user->id) {
            return false;
        }

        return true;
    }
}
