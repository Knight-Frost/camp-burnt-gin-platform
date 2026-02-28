<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Conversation model representing a message thread between users.
 *
 * Conversations maintain threaded communication with optional context
 * linking to applications, campers, or camp sessions. All conversations
 * are RBAC-controlled through ConversationPolicy.
 */
class Conversation extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'created_by_id',
        'subject',
        'category',
        'application_id',
        'camper_id',
        'camp_session_id',
        'last_message_at',
        'is_archived',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
            'is_archived' => 'boolean',
        ];
    }

    /**
     * Get the user who created this conversation.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    /**
     * Get the application this conversation is linked to.
     */
    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    /**
     * Get the camper this conversation is linked to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the camp session this conversation is linked to.
     */
    public function campSession(): BelongsTo
    {
        return $this->belongsTo(CampSession::class);
    }

    /**
     * Get all messages in this conversation.
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('created_at');
    }

    /**
     * Get the most recent message in this conversation.
     */
    public function lastMessage(): HasOne
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    /**
     * Get all participants in this conversation.
     */
    public function participants(): HasManyThrough
    {
        return $this->hasManyThrough(
            User::class,
            ConversationParticipant::class,
            'conversation_id',
            'id',
            'id',
            'user_id'
        )->whereNull('conversation_participants.left_at');
    }

    /**
     * Get all participant records for this conversation.
     */
    public function participantRecords(): HasMany
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    /**
     * Get active participant records (not left).
     */
    public function activeParticipantRecords(): HasMany
    {
        return $this->hasMany(ConversationParticipant::class)->whereNull('left_at');
    }

    /**
     * Determine if this conversation is linked to an application.
     */
    public function isLinkedToApplication(): bool
    {
        return $this->application_id !== null;
    }

    /**
     * Determine if this conversation is linked to a camper.
     */
    public function isLinkedToCamper(): bool
    {
        return $this->camper_id !== null;
    }

    /**
     * Determine if this conversation is linked to a camp session.
     */
    public function isLinkedToCampSession(): bool
    {
        return $this->camp_session_id !== null;
    }

    /**
     * Determine if a user is a participant in this conversation.
     */
    public function hasParticipant(User $user): bool
    {
        return $this->participantRecords()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->exists();
    }

    /**
     * Get unread message count for a specific user.
     */
    public function getUnreadCountForUser(User $user): int
    {
        return $this->messages()
            ->whereDoesntHave('reads', function ($query) use ($user) {
                $query->where('user_id', $user->id);
            })
            ->where('sender_id', '!=', $user->id)
            ->count();
    }

    /**
     * Scope to filter conversations where user is a participant.
     */
    public function scopeForUser($query, User $user)
    {
        return $query->whereHas('participantRecords', function ($q) use ($user) {
            $q->where('user_id', $user->id)->whereNull('left_at');
        });
    }

    /**
     * Scope to filter active (non-archived) conversations.
     */
    public function scopeActive($query)
    {
        return $query->where('is_archived', false);
    }

    /**
     * Scope to filter archived conversations.
     */
    public function scopeArchived($query)
    {
        return $query->where('is_archived', true);
    }

    /**
     * Scope to order by most recent activity.
     */
    public function scopeRecentActivity($query)
    {
        return $query->orderByDesc('last_message_at');
    }

    /**
     * Scope to filter by application.
     */
    public function scopeForApplication($query, int $applicationId)
    {
        return $query->where('application_id', $applicationId);
    }

    /**
     * Scope to filter by camper.
     */
    public function scopeForCamper($query, int $camperId)
    {
        return $query->where('camper_id', $camperId);
    }

    /**
     * Scope to filter by camp session.
     */
    public function scopeForCampSession($query, int $campSessionId)
    {
        return $query->where('camp_session_id', $campSessionId);
    }
}
