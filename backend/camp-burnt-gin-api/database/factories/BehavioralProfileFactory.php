<?php

namespace Database\Factories;

use App\Models\BehavioralProfile;
use App\Models\Camper;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating BehavioralProfile model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\BehavioralProfile>
 */
class BehavioralProfileFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = BehavioralProfile::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $communicationMethods = [
            'Verbal',
            'Sign Language',
            'Picture Cards',
            'Communication Device',
            'Written',
            'Gestures',
        ];

        return [
            'camper_id' => Camper::factory(),
            'aggression' => fake()->boolean(20),
            'self_abuse' => fake()->boolean(15),
            'wandering_risk' => fake()->boolean(25),
            'one_to_one_supervision' => fake()->boolean(10),
            'developmental_delay' => fake()->boolean(30),
            'functioning_age_level' => fake()->optional()->randomElement(['3-5 years', '6-8 years', '9-12 years']),
            'communication_methods' => fake()->optional()->randomElements($communicationMethods, fake()->numberBetween(1, 3)),
            'notes' => fake()->optional()->paragraph(),
        ];
    }

    /**
     * Create a behavioral profile with high-risk indicators.
     */
    public function highRisk(): static
    {
        return $this->state(fn (array $attributes) => [
            'aggression' => true,
            'wandering_risk' => true,
        ]);
    }

    /**
     * Create a behavioral profile requiring one-to-one supervision.
     */
    public function oneToOne(): static
    {
        return $this->state(fn (array $attributes) => [
            'one_to_one_supervision' => true,
        ]);
    }

    /**
     * Create a behavioral profile with wandering risk.
     */
    public function wanderingRisk(): static
    {
        return $this->state(fn (array $attributes) => [
            'wandering_risk' => true,
        ]);
    }

    /**
     * Create a behavioral profile with developmental delay.
     */
    public function developmentalDelay(): static
    {
        return $this->state(fn (array $attributes) => [
            'developmental_delay' => true,
            'functioning_age_level' => fake()->randomElement(['3-5 years', '6-8 years']),
        ]);
    }

    /**
     * Create a behavioral profile for a specific camper.
     */
    public function forCamper(Camper $camper): static
    {
        return $this->state(fn (array $attributes) => [
            'camper_id' => $camper->id,
        ]);
    }
}
