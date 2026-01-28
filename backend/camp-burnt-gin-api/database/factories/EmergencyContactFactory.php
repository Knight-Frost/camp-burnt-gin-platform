<?php

namespace Database\Factories;

use App\Models\Camper;
use App\Models\EmergencyContact;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating EmergencyContact model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\EmergencyContact>
 */
class EmergencyContactFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = EmergencyContact::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'camper_id' => Camper::factory(),
            'name' => fake()->name(),
            'relationship' => fake()->randomElement(['Mother', 'Father', 'Grandparent', 'Aunt', 'Uncle', 'Guardian']),
            'phone_primary' => fake()->phoneNumber(),
            'phone_secondary' => fake()->optional()->phoneNumber(),
            'email' => fake()->optional()->safeEmail(),
            'is_primary' => false,
            'is_authorized_pickup' => fake()->boolean(),
        ];
    }

    /**
     * Create a primary emergency contact.
     */
    public function primary(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_primary' => true,
        ]);
    }

    /**
     * Create a contact authorized for pickup.
     */
    public function authorizedPickup(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_authorized_pickup' => true,
        ]);
    }

    /**
     * Create a contact for a specific camper.
     */
    public function forCamper(Camper $camper): static
    {
        return $this->state(fn (array $attributes) => [
            'camper_id' => $camper->id,
        ]);
    }
}
