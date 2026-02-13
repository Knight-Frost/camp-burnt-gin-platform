<?php

namespace Database\Factories;

use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating Conversation model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Conversation>
 */
class ConversationFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = Conversation::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'created_by_id' => User::factory(),
            'subject' => fake()->sentence(),
            'application_id' => null,
            'camper_id' => null,
            'camp_session_id' => null,
            'last_message_at' => now(),
            'is_archived' => false,
        ];
    }

    /**
     * Create a conversation linked to an application.
     */
    public function forApplication(?int $applicationId = null): static
    {
        return $this->state(fn (array $attributes) => [
            'application_id' => $applicationId ?? Application::factory(),
        ]);
    }

    /**
     * Create a conversation linked to a camper.
     */
    public function forCamper(?int $camperId = null): static
    {
        return $this->state(fn (array $attributes) => [
            'camper_id' => $camperId ?? Camper::factory(),
        ]);
    }

    /**
     * Create a conversation linked to a camp session.
     */
    public function forCampSession(?int $campSessionId = null): static
    {
        return $this->state(fn (array $attributes) => [
            'camp_session_id' => $campSessionId ?? CampSession::factory(),
        ]);
    }

    /**
     * Create an archived conversation.
     */
    public function archived(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_archived' => true,
        ]);
    }

    /**
     * Create a conversation with a specific creator.
     */
    public function createdBy(User $user): static
    {
        return $this->state(fn (array $attributes) => [
            'created_by_id' => $user->id,
        ]);
    }
}
