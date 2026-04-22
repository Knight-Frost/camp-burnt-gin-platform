<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;

/**
 * Message model — a single message posted inside a Conversation thread.
 *
 * Messages are write-once records: once created they are never edited.
 * This immutability is intentional — it preserves the audit trail so that
 * conversations involving PHI or legal decisions cannot be altered after the fact.
 *
 * Key design details:
 *  - sender_id is nullable to support system-generated messages (automated alerts,
 *    status change notifications) that have no human author.
 *  - idempotency_key prevents the same message from being stored twice if a client
 *    retries a failed network request. The controller checks this key before inserting.
 *  - Read receipts are stored in the message_reads table (one row per user per message).
 *    markAsReadBy() creates a receipt; isReadBy() checks for one.
 *  - Soft deletes allow "deleted" messages to be recovered and ensure the
 *    conversation's unread count logic stays consistent.
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
        'conversation_id',  // FK — which conversation this message belongs to.
        'sender_id',        // FK — the User who sent it; null for system messages.
        'body',             // The message text.
        'idempotency_key',  // Unique client-generated key to prevent duplicate sends on retry.
        'parent_message_id', // FK — the message this is replying to (null for root messages).
        'reply_type',       // 'reply' | 'reply_all' | null — how this message was sent.
    ];

    /**
     * Get the conversation this message is part of.
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * Get the user who sent this message.
     *
     * Returns null for system-generated messages (sender_id = NULL).
     * The FK is 'sender_id' instead of the default 'user_id'.
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /**
     * Legacy inline attachments — Documents that were uploaded INTO this
     * message (documentable_type=Message, message_id=this.id).
     *
     * Kept for backward compatibility with messages created before Phase 2.
     * New attachments go through attachedDocuments() instead, which references
     * an existing Document without duplicating it. shapeMessage() merges
     * both sources into a single attachments[] array in the API response.
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(Document::class, 'message_id');
    }

    /**
     * Phase 2 attachments — existing Documents referenced by this message
     * via the message_document_links pivot.
     *
     * Unlike attachments(), these Documents live in the Documents module
     * (documentable_type = Camper, Application, etc.) and the link row
     * merely records "this message references that doc." Destroying the
     * link leaves the Document intact.
     */
    public function attachedDocuments(): BelongsToMany
    {
        return $this->belongsToMany(
            Document::class,
            'message_document_links',
            'message_id',
            'document_id'
        )->withPivot(['id', 'attached_by', 'created_at']);
    }

    /**
     * Unified attachment list combining legacy inline attachments and new
     * linked-document references. Deduped by document id so a doc that
     * somehow exists in both sources appears only once.
     *
     * Callers that need a uniform "all attachments for this message" view
     * should use this instead of attachments() or attachedDocuments()
     * directly. shapeMessage() and accessAttachment() both use this.
     */
    public function allAttachments(): Collection
    {
        $legacy = $this->relationLoaded('attachments')
            ? $this->attachments
            : $this->attachments()->get();

        $linked = $this->relationLoaded('attachedDocuments')
            ? $this->attachedDocuments
            : $this->attachedDocuments()->get();

        // Later values overwrite earlier — legacy first, linked last.
        // A doc that's both inline and linked (shouldn't happen) resolves
        // to the linked copy, which is the one with the pivot metadata.
        return $legacy->keyBy('id')->merge($linked->keyBy('id'))->values();
    }

    /**
     * Get all TO/CC/BCC recipient records for this message.
     *
     * WARNING: Do NOT expose this relation directly in API responses — BCC recipients
     * are included and must be filtered through getRecipientsForUser() before serializing.
     */
    public function recipients(): HasMany
    {
        return $this->hasMany(MessageRecipient::class);
    }

    /**
     * Get the parent message that this message is replying to.
     *
     * Returns null for root messages (new conversations) or when the parent was deleted.
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'parent_message_id');
    }

    /**
     * Get all direct replies to this message.
     */
    public function replies(): HasMany
    {
        return $this->hasMany(Message::class, 'parent_message_id');
    }

    /**
     * Get all read receipts for this message.
     *
     * Each MessageRead row records that a specific user has opened the message.
     */
    public function reads(): HasMany
    {
        return $this->hasMany(MessageRead::class);
    }

    /**
     * Determine if a specific user has already read this message.
     *
     * Checks the message_reads table for a matching (message_id, user_id) row.
     */
    public function isReadBy(User $user): bool
    {
        return $this->reads()->where('user_id', $user->id)->exists();
    }

    /**
     * Determine if this message has any file attachments.
     */
    public function hasAttachments(): bool
    {
        return $this->attachments()->exists();
    }

    /**
     * Get the total number of file attachments on this message.
     */
    public function attachmentCount(): int
    {
        return $this->attachments()->count();
    }

    /**
     * Mark this message as read by a given user.
     *
     * Guards:
     *  1. If the user is the sender, no receipt is created — you don't "read" your own message.
     *  2. If a receipt already exists, no duplicate is inserted (idempotent).
     *
     * System messages (sender_id = null) bypass guard #1 and are always marked read.
     */
    public function markAsReadBy(User $user): void
    {
        // Skip receipt creation if the user is the one who sent the message.
        if ($this->sender_id !== null && $this->sender_id === $user->id) {
            return;
        }
        // Only create a receipt if one doesn't already exist for this user.
        if (! $this->isReadBy($user)) {
            $this->reads()->create([
                'user_id' => $user->id,
                'read_at' => now(),
            ]);
        }
    }

    /**
     * Return the recipient list visible to a given viewer.
     *
     * BCC privacy rule (mirrors Gmail):
     *   - Sender sees: TO + CC + BCC
     *   - TO/CC recipient sees: TO + CC only
     *   - BCC recipient sees: TO + CC only (their own BCC status is not revealed)
     *
     * Recipients are eager-loaded if possible; if not yet loaded, a query is run.
     * The result is a Collection of MessageRecipient models with 'user' loaded.
     *
     * This method is the ONLY approved way to produce recipient data for API responses.
     *
     * @param  User  $viewer  The user whose API response is being built
     * @return Collection<MessageRecipient>
     */
    public function getRecipientsForUser(User $viewer): Collection
    {
        // Load recipients with their user relationship if not already loaded
        if (! $this->relationLoaded('recipients')) {
            $this->load('recipients.user');
        }

        $allRecipients = $this->recipients;

        // Sender sees everything, including BCC
        if ($this->sender_id !== null && $this->sender_id === $viewer->id) {
            return $allRecipients;
        }

        // Everyone else: hide all BCC entries to prevent privacy leakage
        return $allRecipients->filter(fn ($r) => $r->recipient_type !== 'bcc')->values();
    }

    /**
     * Query scope — filter messages belonging to a specific conversation.
     */
    public function scopeInConversation($query, int $conversationId)
    {
        return $query->where('conversation_id', $conversationId);
    }

    /**
     * Query scope — filter messages sent by a specific user.
     */
    public function scopeSentBy($query, User $user)
    {
        return $query->where('sender_id', $user->id);
    }

    /**
     * Query scope — filter messages that the given user has not yet read.
     *
     * Includes system messages (sender_id = NULL) as unread because they have
     * no sender and should appear as new until the user explicitly opens them.
     */
    public function scopeUnreadBy($query, User $user)
    {
        return $query->whereDoesntHave('reads', function ($q) use ($user) {
            $q->where('user_id', $user->id);
        })->where(function ($q) use ($user) {
            // Include system messages (no sender) OR messages not sent by this user.
            $q->whereNull('sender_id')
                ->orWhere('sender_id', '!=', $user->id);
        });
    }

    /**
     * Query scope — order messages newest first (most recent at top).
     */
    public function scopeNewest($query)
    {
        return $query->orderByDesc('created_at');
    }

    /**
     * Query scope — order messages oldest first (chronological reading order).
     */
    public function scopeOldest($query)
    {
        return $query->orderBy('created_at');
    }
}
