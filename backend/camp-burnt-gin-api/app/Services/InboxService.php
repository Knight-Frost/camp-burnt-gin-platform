<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\User;
use App\Notifications\NewConversationNotification;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * InboxService handles conversation management operations.
 *
 * Provides business logic for:
 * - Creating conversations with participants
 * - Managing participant membership
 * - Archiving and filtering conversations
 * - Transaction boundaries for multi-step operations
 *
 * All operations include audit logging and notification delivery.
 */
class InboxService
{
    /**
     * Create a new conversation with initial participants.
     *
     * @param User $creator User creating the conversation
     * @param string $subject Conversation subject line
     * @param array $participantIds Array of user IDs to include as participants
     * @param int|null $applicationId Optional application context
     * @param int|null $camperId Optional camper context
     * @param int|null $campSessionId Optional camp session context
     * @return Conversation
     * @throws \Exception
     */
    public function createConversation(
        User $creator,
        string $subject,
        array $participantIds,
        ?int $applicationId = null,
        ?int $camperId = null,
        ?int $campSessionId = null
    ): Conversation {
        // Validate participant list
        if (empty($participantIds)) {
            throw new \InvalidArgumentException('Participant list cannot be empty');
        }

        // Remove creator from participant list if present (they're added automatically)
        $participantIds = array_diff($participantIds, [$creator->id]);

        if (empty($participantIds)) {
            throw new \InvalidArgumentException('Cannot create conversation with only yourself');
        }

        // Validate max participants
        if (count($participantIds) > 10) {
            throw new \InvalidArgumentException('Maximum 10 participants allowed per conversation');
        }

        return DB::transaction(function () use (
            $creator,
            $subject,
            $participantIds,
            $applicationId,
            $camperId,
            $campSessionId
        ) {
            // Create conversation
            $conversation = Conversation::create([
                'created_by_id' => $creator->id,
                'subject' => $subject,
                'application_id' => $applicationId,
                'camper_id' => $camperId,
                'camp_session_id' => $campSessionId,
                'last_message_at' => now(),
                'is_archived' => false,
            ]);

            // Add creator as participant
            $this->addParticipant($conversation, $creator);

            // Fetch and add other participants
            $participantUsers = User::whereIn('id', $participantIds)->get();

            // Verify all requested users exist
            if ($participantUsers->count() !== count($participantIds)) {
                throw new \InvalidArgumentException('One or more participants do not exist');
            }

            foreach ($participantUsers as $participant) {
                $this->addParticipant($conversation, $participant);

                // Notify new participant
                $participant->notify(new NewConversationNotification($conversation));
            }

            // Audit log
            AuditLog::create([
                'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
                'user_id' => $creator->id,
                'event_type' => 'conversation',
                'auditable_type' => Conversation::class,
                'auditable_id' => $conversation->id,
                'action' => 'created',
                'description' => "Conversation created: {$subject}",
                'new_values' => $conversation->toArray(),
                'metadata' => [
                    'participant_ids' => $participantIds,
                    'application_id' => $applicationId,
                    'camper_id' => $camperId,
                ],
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'created_at' => now(),
            ]);

            return $conversation->load(['participants', 'creator']);
        });
    }

    /**
     * Add a participant to a conversation.
     *
     * @param Conversation $conversation
     * @param User $user
     * @return ConversationParticipant
     */
    public function addParticipant(Conversation $conversation, User $user): ConversationParticipant
    {
        // Check if user is already a participant
        $existing = ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            // If they left, rejoin them
            if ($existing->hasLeft()) {
                $existing->rejoin();

                AuditLog::create([
                    'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
                    'user_id' => auth()->id(),
                    'event_type' => 'conversation',
                    'auditable_type' => Conversation::class,
                    'auditable_id' => $conversation->id,
                    'action' => 'participant_rejoined',
                    'description' => "User {$user->id} rejoined conversation {$conversation->id}",
                    'metadata' => ['participant_id' => $user->id],
                    'ip_address' => request()->ip(),
                    'user_agent' => request()->userAgent(),
                    'created_at' => now(),
                ]);
            }

            return $existing;
        }

        // Create new participant record
        $participant = ConversationParticipant::create([
            'conversation_id' => $conversation->id,
            'user_id' => $user->id,
            'joined_at' => now(),
        ]);

        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => auth()->id(),
            'event_type' => 'conversation',
            'auditable_type' => Conversation::class,
            'auditable_id' => $conversation->id,
            'action' => 'participant_added',
            'description' => "User {$user->id} added to conversation {$conversation->id}",
            'metadata' => ['participant_id' => $user->id],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);

        return $participant;
    }

    /**
     * Remove a participant from a conversation.
     *
     * @param Conversation $conversation
     * @param User $user
     * @return void
     */
    public function removeParticipant(Conversation $conversation, User $user): void
    {
        $participant = ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->first();

        if ($participant) {
            $participant->markAsLeft();

            AuditLog::create([
                'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
                'user_id' => auth()->id(),
                'event_type' => 'conversation',
                'auditable_type' => Conversation::class,
                'auditable_id' => $conversation->id,
                'action' => 'participant_removed',
                'description' => "User {$user->id} removed from conversation {$conversation->id}",
                'metadata' => ['participant_id' => $user->id],
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'created_at' => now(),
            ]);
        }
    }

    /**
     * Archive a conversation.
     *
     * @param Conversation $conversation
     * @return Conversation
     */
    public function archiveConversation(Conversation $conversation): Conversation
    {
        $conversation->update(['is_archived' => true]);

        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => auth()->id(),
            'event_type' => 'conversation',
            'auditable_type' => Conversation::class,
            'auditable_id' => $conversation->id,
            'action' => 'archived',
            'description' => "Conversation archived: {$conversation->subject}",
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);

        return $conversation->fresh();
    }

    /**
     * Unarchive a conversation.
     *
     * @param Conversation $conversation
     * @return Conversation
     */
    public function unarchiveConversation(Conversation $conversation): Conversation
    {
        $conversation->update(['is_archived' => false]);

        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => auth()->id(),
            'event_type' => 'conversation',
            'auditable_type' => Conversation::class,
            'auditable_id' => $conversation->id,
            'action' => 'unarchived',
            'description' => "Conversation unarchived: {$conversation->subject}",
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);

        return $conversation->fresh();
    }

    /**
     * Get conversations for a user with pagination.
     *
     * @param User $user
     * @param bool $includeArchived
     * @param int $perPage
     * @return LengthAwarePaginator
     */
    public function getUserConversations(
        User $user,
        bool $includeArchived = false,
        int $perPage = 25
    ): LengthAwarePaginator {
        $query = Conversation::query()
            ->forUser($user)
            ->with(['creator', 'lastMessage.sender', 'activeParticipantRecords.user'])
            ->recentActivity();

        if (!$includeArchived) {
            $query->active();
        }

        return $query->paginate($perPage);
    }

    /**
     * Get unread conversation count for a user.
     *
     * Optimized single-query implementation to avoid N+1 problem.
     *
     * @param User $user
     * @return int
     */
    public function getUnreadConversationCount(User $user): int
    {
        return Conversation::forUser($user)
            ->active()
            ->whereHas('messages', function ($query) use ($user) {
                $query->where('sender_id', '!=', $user->id)
                    ->whereDoesntHave('reads', function ($q) use ($user) {
                        $q->where('user_id', $user->id);
                    });
            })
            ->count();
    }

    /**
     * Update conversation timestamp to current time.
     *
     * Called when a new message is added.
     *
     * @param Conversation $conversation
     * @return void
     */
    public function updateConversationTimestamp(Conversation $conversation): void
    {
        $conversation->update(['last_message_at' => now()]);
    }

    /**
     * Verify a user is an active participant in a conversation.
     *
     * @param Conversation $conversation
     * @param User $user
     * @return bool
     */
    public function verifyParticipantStatus(Conversation $conversation, User $user): bool
    {
        return $conversation->hasParticipant($user);
    }

    /**
     * Get conversation participants excluding a specific user.
     *
     * @param Conversation $conversation
     * @param User $excludeUser
     * @return Collection
     */
    public function getParticipantsExcept(Conversation $conversation, User $excludeUser): Collection
    {
        return $conversation->participants()->where('users.id', '!=', $excludeUser->id)->get();
    }

    /**
     * Soft delete a conversation.
     *
     * Only admins can perform this operation.
     *
     * @param Conversation $conversation
     * @return void
     */
    public function deleteConversation(Conversation $conversation): void
    {
        $conversation->delete();

        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => auth()->id(),
            'event_type' => 'conversation',
            'auditable_type' => Conversation::class,
            'auditable_id' => $conversation->id,
            'action' => 'soft_deleted',
            'description' => "Conversation soft deleted: {$conversation->subject}",
            'old_values' => $conversation->toArray(),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);
    }
}
