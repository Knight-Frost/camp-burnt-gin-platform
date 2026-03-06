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
        ?string $subject,
        array $participantIds,
        ?int $applicationId = null,
        ?int $camperId = null,
        ?int $campSessionId = null,
        string $category = 'general'
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
            $campSessionId,
            $category
        ) {
            // Create conversation
            $conversation = Conversation::create([
                'created_by_id' => $creator->id,
                'subject' => $subject,
                'category' => $category,
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

            return $conversation->load(['participants.role', 'creator']);
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
     * Get conversations for a user, filtered by folder.
     *
     * Folders:
     *  - inbox        Active non-archived user conversations (default)
     *  - starred      Conversations the user starred
     *  - important    Conversations the user marked important
     *  - sent         Conversations created by the user
     *  - archive      Archived conversations
     *  - trash        Conversations the user moved to trash
     *  - system       System-generated notifications
     *  - all          Everything not trashed (backwards-compat)
     *
     * @param User        $user
     * @param int         $perPage
     * @param bool|null   $systemOnly  Deprecated filter — prefer folder param
     * @param string      $folder
     * @return LengthAwarePaginator
     */
    public function getUserConversations(
        User $user,
        int $perPage = 25,
        ?bool $systemOnly = null,
        string $folder = 'inbox'
    ): LengthAwarePaginator {
        $query = Conversation::query()
            ->forUser($user)
            ->with(['creator', 'lastMessage.sender.role', 'participants.role', 'activeParticipantRecords'])
            ->recentActivity();

        switch ($folder) {
            case 'inbox':
                $query->active()
                      ->userConversations()
                      ->whereHas('participantRecords', function ($q) use ($user) {
                          $q->where('user_id', $user->id)->whereNull('trashed_at');
                      });
                break;

            case 'starred':
                $query->whereHas('participantRecords', function ($q) use ($user) {
                    $q->where('user_id', $user->id)
                      ->where('is_starred', true)
                      ->whereNull('trashed_at');
                });
                break;

            case 'important':
                $query->whereHas('participantRecords', function ($q) use ($user) {
                    $q->where('user_id', $user->id)
                      ->where('is_important', true)
                      ->whereNull('trashed_at');
                });
                break;

            case 'sent':
                $query->where('created_by_id', $user->id)
                      ->whereHas('participantRecords', function ($q) use ($user) {
                          $q->where('user_id', $user->id)->whereNull('trashed_at');
                      });
                break;

            case 'archive':
                $query->archived()
                      ->whereHas('participantRecords', function ($q) use ($user) {
                          $q->where('user_id', $user->id)->whereNull('trashed_at');
                      });
                break;

            case 'trash':
                // Bypass the default forUser scope — include left participants too
                $query->whereHas('participantRecords', function ($q) use ($user) {
                    $q->where('user_id', $user->id)->whereNotNull('trashed_at');
                });
                break;

            case 'system':
                $query->active()
                      ->systemGenerated()
                      ->whereHas('participantRecords', function ($q) use ($user) {
                          $q->where('user_id', $user->id)->whereNull('trashed_at');
                      });
                break;

            case 'all':
            default:
                $query->whereHas('participantRecords', function ($q) use ($user) {
                    $q->where('user_id', $user->id)->whereNull('trashed_at');
                });
                break;
        }

        // Legacy systemOnly filter (used when folder is not 'system')
        if ($folder !== 'system' && $systemOnly === true) {
            $query->systemGenerated();
        } elseif ($systemOnly === false) {
            $query->userConversations();
        }

        return $query->paginate($perPage);
    }

    /**
     * Toggle the starred state for a user's participation in a conversation.
     *
     * @return bool New is_starred value
     */
    public function toggleStar(Conversation $conversation, User $user): bool
    {
        $participant = \App\Models\ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        return $participant->toggleStar();
    }

    /**
     * Toggle the important state for a user's participation in a conversation.
     *
     * @return bool New is_important value
     */
    public function toggleImportant(Conversation $conversation, User $user): bool
    {
        $participant = \App\Models\ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        return $participant->toggleImportant();
    }

    /**
     * Move a conversation to the user's trash.
     */
    public function trashConversation(Conversation $conversation, User $user): void
    {
        \App\Models\ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->update(['trashed_at' => now()]);

        AuditLog::create([
            'request_id'      => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id'         => $user->id,
            'event_type'      => 'conversation',
            'auditable_type'  => Conversation::class,
            'auditable_id'    => $conversation->id,
            'action'          => 'trashed',
            'description'     => "User {$user->id} moved conversation to trash: {$conversation->subject}",
            'ip_address'      => request()->ip(),
            'user_agent'      => request()->userAgent(),
            'created_at'      => now(),
        ]);
    }

    /**
     * Restore a conversation from the user's trash.
     */
    public function restoreFromTrash(Conversation $conversation, User $user): void
    {
        \App\Models\ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->update(['trashed_at' => null]);

        AuditLog::create([
            'request_id'      => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id'         => $user->id,
            'event_type'      => 'conversation',
            'auditable_type'  => Conversation::class,
            'auditable_id'    => $conversation->id,
            'action'          => 'restored_from_trash',
            'description'     => "User {$user->id} restored conversation from trash: {$conversation->subject}",
            'ip_address'      => request()->ip(),
            'user_agent'      => request()->userAgent(),
            'created_at'      => now(),
        ]);
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
                $query->whereDoesntHave('reads', function ($q) use ($user) {
                    $q->where('user_id', $user->id);
                })->where(function ($q) use ($user) {
                    // Include system messages (sender_id = null) as unread
                    $q->whereNull('sender_id')
                      ->orWhere('sender_id', '!=', $user->id);
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
