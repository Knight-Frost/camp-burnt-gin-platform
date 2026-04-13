<?php

namespace Database\Factories;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageRecipient;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Message>
 */
class MessageFactory extends Factory
{
    protected $model = Message::class;

    /**
     * Pending TO recipients to create after the message is persisted.
     * Set via withToRecipient() / withCcRecipient() / withBccRecipient().
     *
     * @var array<array{user: User, type: string}>
     */
    protected array $pendingRecipients = [];

    public function definition(): array
    {
        return [
            'conversation_id' => Conversation::factory(),
            'sender_id' => User::factory(),
            'body' => fake()->paragraph(),
            'idempotency_key' => Str::uuid()->toString(),
            'parent_message_id' => null, // null for root messages
            'reply_type' => null, // null for non-replies; 'reply' or 'reply_all' for replies
        ];
    }

    // ── Recipient helpers ─────────────────────────────────────────────────────
    //
    // MessageRecipient rows are NOT created by default because many test
    // scenarios only need the message body (e.g., read-receipt tests, basic
    // conversation listing). Opt in to recipient creation with these states.
    //
    // BCC privacy rule: getRecipientsForUser() must be used for API responses;
    // BCC recipients are invisible to anyone other than the sender.

    /**
     * Add a TO recipient for this message.
     * Creates a MessageRecipient row (recipient_type='to') after the message is saved.
     */
    public function withToRecipient(User $user): static
    {
        return $this->afterCreating(function (Message $message) use ($user) {
            MessageRecipient::firstOrCreate(
                ['message_id' => $message->id, 'user_id' => $user->id],
                ['recipient_type' => 'to', 'is_read' => false]
            );
        });
    }

    /**
     * Add a CC recipient for this message.
     */
    public function withCcRecipient(User $user): static
    {
        return $this->afterCreating(function (Message $message) use ($user) {
            MessageRecipient::firstOrCreate(
                ['message_id' => $message->id, 'user_id' => $user->id],
                ['recipient_type' => 'cc', 'is_read' => false]
            );
        });
    }

    /**
     * Add a BCC recipient for this message.
     * BCC recipients are only visible to the sender via Message::getRecipientsForUser().
     */
    public function withBccRecipient(User $user): static
    {
        return $this->afterCreating(function (Message $message) use ($user) {
            MessageRecipient::firstOrCreate(
                ['message_id' => $message->id, 'user_id' => $user->id],
                ['recipient_type' => 'bcc', 'is_read' => false]
            );
        });
    }

    // ── Positional states ─────────────────────────────────────────────────────

    /** Message sent in a specific conversation. */
    public function inConversation(Conversation $conversation): static
    {
        return $this->state(fn () => ['conversation_id' => $conversation->id]);
    }

    /** Message sent by a specific user. */
    public function sentBy(User $user): static
    {
        return $this->state(fn () => ['sender_id' => $user->id]);
    }

    /** Message with specific body text. */
    public function withBody(string $body): static
    {
        return $this->state(fn () => ['body' => $body]);
    }

    /** Reply to a specific parent message. */
    public function replyTo(Message $parent): static
    {
        return $this->state(fn () => [
            'parent_message_id' => $parent->id,
            'reply_type' => 'reply',
        ]);
    }

    /** Reply-all to a specific parent message. */
    public function replyAllTo(Message $parent): static
    {
        return $this->state(fn () => [
            'parent_message_id' => $parent->id,
            'reply_type' => 'reply_all',
        ]);
    }
}
