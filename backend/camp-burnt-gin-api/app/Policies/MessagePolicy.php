<?php

namespace App\Policies;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;

/**
 * MessagePolicy enforces authorization for message operations.
 *
 * Messages can only be created by conversation participants.
 * Messages are immutable (no updates allowed).
 * Only admins can soft delete messages for moderation.
 */
class MessagePolicy
{
    /**
     * Determine if the user can view any messages.
     *
     * Users can view messages in conversations they participate in.
     */
    public function viewAny(User $user, Conversation $conversation): bool
    {
        return $conversation->hasParticipant($user) || $user->isAdmin();
    }

    /**
     * Determine if the user can view the message.
     *
     * Users can view messages in conversations they are part of.
     */
    public function view(User $user, Message $message): bool
    {
        return $message->conversation->hasParticipant($user) || $user->isAdmin();
    }

    /**
     * Determine if the user can create messages in the conversation.
     *
     * Only active participants can send messages.
     */
    public function create(User $user, Conversation $conversation): bool
    {
        // User must be an active participant
        if (!$conversation->hasParticipant($user)) {
            return false;
        }

        // Archived conversations cannot receive new messages
        if ($conversation->is_archived) {
            return false;
        }

        return true;
    }

    /**
     * Determine if the user can update the message.
     *
     * Messages are immutable. No updates allowed for audit integrity.
     */
    public function update(User $user, Message $message): bool
    {
        return false;
    }

    /**
     * Determine if the user can delete the message.
     *
     * Only admins can soft delete messages for moderation purposes.
     * Message sender cannot delete their own messages.
     */
    public function delete(User $user, Message $message): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine if the user can restore a deleted message.
     *
     * Only admins can restore soft-deleted messages.
     */
    public function restore(User $user, Message $message): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine if the user can permanently delete the message.
     *
     * Permanent deletion is not allowed for HIPAA compliance.
     */
    public function forceDelete(User $user, Message $message): bool
    {
        return false;
    }

    /**
     * Determine if the user can attach files to the message.
     *
     * Same rules as create - must be an active participant.
     */
    public function attachFiles(User $user, Conversation $conversation): bool
    {
        return $this->create($user, $conversation);
    }

    /**
     * Determine if the user can view attachments on the message.
     *
     * Users can view attachments if they can view the message.
     */
    public function viewAttachments(User $user, Message $message): bool
    {
        return $this->view($user, $message);
    }
}
