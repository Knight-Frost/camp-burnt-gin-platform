<?php

namespace Database\Factories;

use App\Models\Camper;
use App\Models\MedicalProviderLink;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating MedicalProviderLink model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\MedicalProviderLink>
 */
class MedicalProviderLinkFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = MedicalProviderLink::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'camper_id' => Camper::factory(),
            'created_by' => \App\Models\User::factory(),
            'token' => fake()->uuid(),
            'provider_email' => fake()->unique()->safeEmail(),
            'provider_name' => fake()->name(),
            'expires_at' => now()->addDays(7),
            'is_used' => false,
        ];
    }

    /**
     * Create a used provider link.
     */
    public function used(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_used' => true,
            'accessed_at' => now(),
            'submitted_at' => now(),
        ]);
    }

    /**
     * Create an expired provider link.
     */
    public function expired(): static
    {
        return $this->state(fn (array $attributes) => [
            'expires_at' => now()->subDay(),
        ]);
    }
}
