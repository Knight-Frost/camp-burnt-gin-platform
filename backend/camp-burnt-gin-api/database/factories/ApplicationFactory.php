<?php

namespace Database\Factories;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating Application model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Application>
 */
class ApplicationFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = Application::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'camper_id' => Camper::factory(),
            'camp_session_id' => CampSession::factory(),
            'status' => ApplicationStatus::Pending,
            'submitted_at' => now(),
            'reviewed_at' => null,
            'reviewed_by' => null,
            'notes' => fake()->optional()->sentence(),
        ];
    }

    /**
     * Create an approved application.
     */
    public function approved(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ApplicationStatus::Approved,
            'reviewed_at' => now(),
        ]);
    }

    /**
     * Create a rejected application.
     */
    public function rejected(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ApplicationStatus::Rejected,
            'reviewed_at' => now(),
        ]);
    }

    /**
     * Create an application under review.
     */
    public function underReview(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ApplicationStatus::UnderReview,
        ]);
    }
}
