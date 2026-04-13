<?php

namespace Database\Factories;

use App\Enums\DocumentVerificationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\Document;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Document>
 */
class DocumentFactory extends Factory
{
    protected $model = Document::class;

    public function definition(): array
    {
        $isScanned = fake()->boolean(80);
        $uuid = fake()->uuid();
        $year = date('Y');
        $month = date('m');

        // Match DocumentService::getStoragePath() format: documents/{EntityType}/{year}/{month}/
        $path = "documents/Camper/{$year}/{$month}/{$uuid}.pdf";

        return [
            'documentable_type' => 'App\\Models\\Camper',
            'documentable_id' => Camper::factory(),
            'document_type' => fake()->randomElement([
                'official_medical_form', 'immunization_record', 'insurance_card',
                'physician_clearance', 'consent_form', null,
            ]),
            'original_filename' => fake()->word().'.pdf',
            'stored_filename' => $uuid.'.pdf',
            'path' => $path,
            'file_size' => fake()->numberBetween(50000, 5000000),
            'mime_type' => 'application/pdf',
            'disk' => 'local',
            'is_scanned' => $isScanned,
            'scan_passed' => $isScanned ? fake()->boolean(92) : null,
            'scanned_at' => $isScanned ? now()->subHours(fake()->numberBetween(1, 48)) : null,
            'uploaded_by' => User::factory(),
            // All factory documents default to submitted (visible to admin).
            // Use ->draft() state for the unsubmitted case.
            'submitted_at' => now()->subDays(fake()->numberBetween(1, 30)),
            // Verification
            'verification_status' => DocumentVerificationStatus::Pending,
            'verified_by' => null,
            'verified_at' => null,
            'expiration_date' => fake()->optional(0.3)->dateTimeBetween('now', '+3 years')?->format('Y-m-d'),
            'archived_at' => null,
            'message_id' => null,
        ];
    }

    /**
     * Submitted document — visible to admins in the review queue.
     * This is the default state; provided as an explicit state for readability.
     */
    public function submitted(): static
    {
        return $this->state(fn () => [
            'submitted_at' => now()->subDays(fake()->numberBetween(1, 30)),
        ]);
    }

    /**
     * Draft document — applicant has uploaded but not yet submitted to staff.
     * Drafts are filtered out of all admin queries (submitted_at IS NOT NULL).
     */
    public function draft(): static
    {
        return $this->state(fn () => [
            'submitted_at' => null,
        ]);
    }

    /** Scanned and clean — safe for review. */
    public function scannedPassed(): static
    {
        return $this->state(fn () => [
            'is_scanned' => true,
            'scan_passed' => true,
            'scanned_at' => now()->subHours(fake()->numberBetween(1, 24)),
        ]);
    }

    /** Scanned but failed virus/content check. */
    public function scannedFailed(): static
    {
        return $this->state(fn () => [
            'is_scanned' => true,
            'scan_passed' => false,
            'scanned_at' => now()->subHours(fake()->numberBetween(1, 24)),
        ]);
    }

    /** Not yet scanned — just uploaded. */
    public function notScanned(): static
    {
        return $this->state(fn () => [
            'is_scanned' => false,
            'scan_passed' => null,
            'scanned_at' => null,
        ]);
    }

    /** Admin has approved this document after review. */
    public function approved(): static
    {
        return $this->state(function () {
            $verifier = User::whereHas('role', fn ($q) => $q->whereIn('name', ['admin', 'super_admin']))->first();

            return [
                'verification_status' => DocumentVerificationStatus::Approved,
                'verified_by' => $verifier?->id ?? User::factory()->admin(),
                'verified_at' => now()->subDays(fake()->numberBetween(1, 30)),
                'is_scanned' => true,
                'scan_passed' => true,
                'scanned_at' => now()->subDays(fake()->numberBetween(1, 30)),
            ];
        });
    }

    /** Document rejected during verification. */
    public function rejected(): static
    {
        return $this->state(fn () => [
            'verification_status' => DocumentVerificationStatus::Rejected,
        ]);
    }

    /**
     * Official medical form (Form 4523-ENG-DPH).
     * The document_type value that admin review checks for in the
     * "Application Components" section and DocumentEnforcementService.
     */
    public function officialMedicalForm(): static
    {
        return $this->state(fn () => [
            'document_type' => 'official_medical_form',
            'original_filename' => 'medical_form_4523.pdf',
        ]);
    }

    /** Immunization record — universal required document for all campers. */
    public function immunizationRecord(): static
    {
        return $this->state(fn () => [
            'document_type' => 'immunization_record',
            'original_filename' => 'immunization_record.pdf',
        ]);
    }

    /** Insurance card — universal required document for all campers. */
    public function insuranceCard(): static
    {
        return $this->state(fn () => [
            'document_type' => 'insurance_card',
            'original_filename' => 'insurance_card.pdf',
        ]);
    }

    /**
     * Document attached to an Application (not a Camper).
     * Pass the Application model to link correctly.
     */
    public function forApplication(Application $application): static
    {
        return $this->state(fn () => [
            'documentable_type' => 'App\\Models\\Application',
            'documentable_id' => $application->id,
            'path' => 'documents/Application/'.date('Y').'/'.date('m').'/'.fake()->uuid().'.pdf',
        ]);
    }

    /** Archived document — moved out of active view. */
    public function archived(): static
    {
        return $this->state(fn () => [
            'archived_at' => now()->subDays(fake()->numberBetween(1, 60)),
        ]);
    }
}
