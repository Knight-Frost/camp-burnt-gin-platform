<?php

namespace Database\Factories;

use App\Models\Camper;
use App\Models\MedicalRecord;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating MedicalRecord model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\MedicalRecord>
 */
class MedicalRecordFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = MedicalRecord::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'camper_id' => Camper::factory(),
            'physician_name' => 'Dr. '.fake()->name(),
            'physician_phone' => fake()->phoneNumber(),
            'insurance_provider' => fake()->company().' Insurance',
            'insurance_policy_number' => fake()->regexify('[A-Z]{3}[0-9]{9}'),
            'special_needs' => fake()->optional()->paragraph(),
            'dietary_restrictions' => fake()->optional()->sentence(),
            'notes' => fake()->optional()->paragraph(),
        ];
    }

    /**
     * Create a medical record for a specific camper.
     */
    public function forCamper(Camper $camper): static
    {
        return $this->state(fn (array $attributes) => [
            'camper_id' => $camper->id,
        ]);
    }
}
