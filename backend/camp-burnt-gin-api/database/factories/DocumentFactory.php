<?php

namespace Database\Factories;

use App\Models\Camper;
use App\Models\Document;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating Document model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Document>
 */
class DocumentFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = Document::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'documentable_type' => 'App\\Models\\Camper',
            'documentable_id' => Camper::factory(),
            'original_filename' => fake()->word().'.pdf',
            'stored_filename' => fake()->uuid().'.pdf',
            'path' => 'documents/'.fake()->uuid().'.pdf',
            'file_size' => fake()->numberBetween(1000, 5000000),
            'mime_type' => 'application/pdf',
            'disk' => 'local',
            'is_scanned' => fake()->boolean(80),
            'scan_passed' => function (array $attributes) {
                return $attributes['is_scanned'] ? fake()->boolean(90) : null;
            },
            'uploaded_by' => \App\Models\User::factory(),
        ];
    }

    /**
     * Create a scanned and passed document.
     */
    public function scannedPassed(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_scanned' => true,
            'scan_passed' => true,
        ]);
    }

    /**
     * Create a scanned but failed document.
     */
    public function scannedFailed(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_scanned' => true,
            'scan_passed' => false,
        ]);
    }

    /**
     * Create an unscanned document.
     */
    public function notScanned(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_scanned' => false,
            'scan_passed' => null,
        ]);
    }
}
