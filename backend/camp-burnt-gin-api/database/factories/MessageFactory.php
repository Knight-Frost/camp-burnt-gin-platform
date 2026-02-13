<?php

namespace Database\Factories;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * Factory for creating Message model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Message>
 */
class MessageFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = Message::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'conversation_id' => Conversation::factory(),
            'sender_id' => User::factory(),
            'body' => fake()->paragraph(),
            'idempotency_key' => Str::uuid()->toString(),
        ];
    }

    /**
     * Create a message in a specific conversation.
     */
    public function inConversation(Conversation $conversation): static
    {
        return $this->state(fn (array $attributes) => [
            'conversation_id' => $conversation->id,
        ]);
    }

    /**
     * Create a message sent by a specific user.
     */
    public function sentBy(User $user): static
    {
        return $this->state(fn (array $attributes) => [
            'sender_id' => $user->id,
        ]);
    }

    /**
     * Create a message with specific body content.
     */
    public function withBody(string $body): static
    {
        return $this->state(fn (array $attributes) => [
            'body' => $body,
        ]);
    }
}
