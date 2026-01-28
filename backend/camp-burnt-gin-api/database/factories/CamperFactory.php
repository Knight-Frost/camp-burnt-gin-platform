<?php

namespace Database\Factories;

use App\Models\Camper;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating Camper model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Camper>
 */
class CamperFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = Camper::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'date_of_birth' => fake()->dateTimeBetween('-17 years', '-6 years'),
            'gender' => fake()->randomElement(['male', 'female', 'other', null]),
        ];
    }

    /**
     * Create a camper for a specific user.
     */
    public function forUser(User $user): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => $user->id,
        ]);
    }
}
