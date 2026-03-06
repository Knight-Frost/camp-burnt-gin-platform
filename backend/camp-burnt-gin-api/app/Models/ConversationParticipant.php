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
        'is_starred',
        'is_important',
        'trashed_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'joined_at'    => 'datetime',
            'left_at'      => 'datetime',
            'is_starred'   => 'boolean',
            'is_important' => 'boolean',
            'trashed_at'   => 'datetime',
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
     * Toggle the starred state and return the new value.
     */
    public function toggleStar(): bool
    {
        $newValue = ! $this->is_starred;
        $this->update(['is_starred' => $newValue]);
        return $newValue;
    }

    /**
     * Toggle the important state and return the new value.
     */
    public function toggleImportant(): bool
    {
        $newValue = ! $this->is_important;
        $this->update(['is_important' => $newValue]);
        return $newValue;
    }

    /**
     * Move this conversation to the user's trash.
     */
    public function trash(): void
    {
        $this->update(['trashed_at' => now()]);
    }

    /**
     * Restore from trash.
     */
    public function restore(): void
    {
        $this->update(['trashed_at' => null]);
    }

    /**
     * Determine if this conversation is trashed for this user.
     */
    public function isTrashed(): bool
    {
        return $this->trashed_at !== null;
    }

    /**
     * Scope: only trashed participant records.
     */
    public function scopeTrashed($query)
    {
        return $query->whereNotNull('trashed_at');
    }

    /**
     * Scope: only non-trashed participant records.
     */
    public function scopeNotTrashed($query)
    {
        return $query->whereNull('trashed_at');
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
