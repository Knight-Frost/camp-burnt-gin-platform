<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Message model representing a single message within a conversation.
 *
 * Messages are immutable write-once records. No editing is supported
 * to maintain audit integrity for HIPAA compliance. Idempotency key
 * prevents duplicate submission on network retry.
 */
class Message extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'conversation_id',
        'sender_id',
        'body',
        'idempotency_key',
    ];

    /**
     * Get the conversation this message belongs to.
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * Get the user who sent this message.
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /**
     * Get all documents attached to this message.
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(Document::class, 'message_id');
    }

    /**
     * Get all read receipts for this message.
     */
    public function reads(): HasMany
    {
        return $this->hasMany(MessageRead::class);
    }

    /**
     * Determine if this message has been read by a specific user.
     */
    public function isReadBy(User $user): bool
    {
        return $this->reads()->where('user_id', $user->id)->exists();
    }

    /**
     * Determine if this message has attachments.
     */
    public function hasAttachments(): bool
    {
        return $this->attachments()->exists();
    }

    /**
     * Get attachment count for this message.
     */
    public function attachmentCount(): int
    {
        return $this->attachments()->count();
    }

    /**
     * Mark this message as read by a user.
     *
     * System messages (sender_id = null) are also marked read.
     */
    public function markAsReadBy(User $user): void
    {
        // Never create a read receipt if the user sent the message
        if ($this->sender_id !== null && $this->sender_id === $user->id) {
            return;
        }
        if (!$this->isReadBy($user)) {
            $this->reads()->create([
                'user_id' => $user->id,
                'read_at' => now(),
            ]);
        }
    }

    /**
     * Scope to filter messages in a conversation.
     */
    public function scopeInConversation($query, int $conversationId)
    {
        return $query->where('conversation_id', $conversationId);
    }

    /**
     * Scope to filter messages sent by a user.
     */
    public function scopeSentBy($query, User $user)
    {
        return $query->where('sender_id', $user->id);
    }

    /**
     * Scope to filter unread messages for a user.
     *
     * Includes system messages (sender_id = null) as they have no sender
     * and should always appear as unread until explicitly opened.
     */
    public function scopeUnreadBy($query, User $user)
    {
        return $query->whereDoesntHave('reads', function ($q) use ($user) {
            $q->where('user_id', $user->id);
        })->where(function ($q) use ($user) {
            $q->whereNull('sender_id')
              ->orWhere('sender_id', '!=', $user->id);
        });
    }

    /**
     * Scope to order by newest first.
     */
    public function scopeNewest($query)
    {
        return $query->orderByDesc('created_at');
    }

    /**
     * Scope to order by oldest first.
     */
    public function scopeOldest($query)
    {
        return $query->orderBy('created_at');
    }
}
