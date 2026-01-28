<?php

namespace Database\Factories;

use App\Models\Role;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating Role model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Role>
 */
class RoleFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = Role::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->word(),
            'description' => fake()->sentence(),
        ];
    }

    /**
     * Create an admin role.
     */
    public function admin(): static
    {
        return $this->state(fn (array $attributes) => [
            'name' => 'admin',
            'description' => 'Administrator with full access',
        ]);
    }

    /**
     * Create a parent role.
     */
    public function parent(): static
    {
        return $this->state(fn (array $attributes) => [
            'name' => 'parent',
            'description' => 'Parent or guardian of campers',
        ]);
    }

    /**
     * Create a medical provider role.
     */
    public function medical(): static
    {
        return $this->state(fn (array $attributes) => [
            'name' => 'medical',
            'description' => 'Medical provider with limited access',
        ]);
    }
}
