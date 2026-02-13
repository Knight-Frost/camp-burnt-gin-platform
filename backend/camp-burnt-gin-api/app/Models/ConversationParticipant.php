<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ConversationParticipant model representing user membership in conversations.
 *
 * Tracks which users are participants in each conversation with metadata
 * for join/leave timestamps. Used for authorization checks and participant
 * management.
 */
class ConversationParticipant extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'conversation_id',
        'user_id',
        'joined_at',
        'left_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'joined_at' => 'datetime',
            'left_at' => 'datetime',
        ];
    }

    /**
     * Get the conversation this participant belongs to.
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * Get the user who is a participant.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Determine if the participant has left the conversation.
     */
    public function hasLeft(): bool
    {
        return $this->left_at !== null;
    }

    /**
     * Determine if the participant is currently active.
     */
    public function isActive(): bool
    {
        return $this->left_at === null;
    }

    /**
     * Mark participant as having left the conversation.
     */
    public function markAsLeft(): void
    {
        $this->update(['left_at' => now()]);
    }

    /**
     * Rejoin the conversation (clear left_at).
     */
    public function rejoin(): void
    {
        $this->update(['left_at' => null]);
    }

    /**
     * Scope to filter active participants.
     */
    public function scopeActive($query)
    {
        return $query->whereNull('left_at');
    }

    /**
     * Scope to filter participants who have left.
     */
    public function scopeLeft($query)
    {
        return $query->whereNotNull('left_at');
    }

    /**
     * Scope to filter by conversation.
     */
    public function scopeForConversation($query, int $conversationId)
    {
        return $query->where('conversation_id', $conversationId);
    }

    /**
     * Scope to filter by user.
     */
    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }
}
