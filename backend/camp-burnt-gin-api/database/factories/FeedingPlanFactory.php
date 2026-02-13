<?php

namespace Database\Factories;

use App\Models\Camper;
use App\Models\FeedingPlan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating FeedingPlan model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\FeedingPlan>
 */
class FeedingPlanFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = FeedingPlan::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $specialDiet = fake()->boolean(30);
        $gTube = fake()->boolean(15);

        $diets = ['Gluten-Free', 'Dairy-Free', 'Vegetarian', 'Vegan', 'Nut-Free', 'Low Sugar'];
        $formulas = ['Pediasure', 'Boost', 'Ensure', 'Nutren Junior', 'Compleat Pediatric'];

        return [
            'camper_id' => Camper::factory(),
            'special_diet' => $specialDiet,
            'diet_description' => $specialDiet ? fake()->randomElement($diets).' diet' : null,
            'g_tube' => $gTube,
            'formula' => $gTube ? fake()->randomElement($formulas) : null,
            'amount_per_feeding' => $gTube ? fake()->randomElement(['240ml', '300ml', '360ml']) : null,
            'feedings_per_day' => $gTube ? fake()->numberBetween(3, 6) : null,
            'feeding_times' => $gTube ? ['08:00', '12:00', '18:00'] : null,
            'bolus_only' => $gTube ? fake()->boolean(70) : false,
            'notes' => fake()->optional()->sentence(),
        ];
    }

    /**
     * Create a feeding plan with G-tube requirements.
     */
    public function withGTube(): static
    {
        return $this->state(fn (array $attributes) => [
            'g_tube' => true,
            'formula' => fake()->randomElement(['Pediasure', 'Boost', 'Ensure']),
            'amount_per_feeding' => fake()->randomElement(['240ml', '300ml', '360ml']),
            'feedings_per_day' => fake()->numberBetween(3, 6),
            'feeding_times' => ['08:00', '12:00', '18:00'],
            'bolus_only' => true,
        ]);
    }

    /**
     * Create a feeding plan with special diet only (no G-tube).
     */
    public function specialDietOnly(): static
    {
        return $this->state(fn (array $attributes) => [
            'special_diet' => true,
            'diet_description' => fake()->randomElement(['Gluten-Free', 'Dairy-Free', 'Vegetarian']).' diet',
            'g_tube' => false,
            'formula' => null,
            'amount_per_feeding' => null,
            'feedings_per_day' => null,
            'feeding_times' => null,
            'bolus_only' => false,
        ]);
    }

    /**
     * Create a feeding plan for a specific camper.
     */
    public function forCamper(Camper $camper): static
    {
        return $this->state(fn (array $attributes) => [
            'camper_id' => $camper->id,
        ]);
    }
}
