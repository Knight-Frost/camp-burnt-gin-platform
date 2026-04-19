<?php

namespace Tests\Feature\Regression;

use App\Enums\AllergySeverity;
use App\Enums\ApplicationStatus;
use App\Enums\DiagnosisSeverity;
use App\Models\Allergy;
use App\Models\Application;
use App\Models\AssistiveDevice;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Diagnosis;
use App\Models\EmergencyContact;
use App\Models\Medication;
use App\Services\Camper\CamperChildRowDeduper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression coverage for BUG-214: the applicant submission flow posted
 * every child-row (medications, allergies, emergency contacts, diagnoses,
 * assistive devices) with `create()`, so retrying the flow duplicated
 * every row. The admin review page then rendered the same medication
 * fifteen times in a row.
 *
 * Encrypted PHI columns can't be deduped in SQL (random-IV ciphertexts
 * are different on every write). The fix is a PHP pass that fingerprints
 * rows by natural key and removes copies — wired into finalize() so
 * every submit lands in a clean state.
 */
class ChildRowDedupeTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        Queue::fake();
    }

    private function buildCamper(): Camper
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create([
            'first_name' => 'Athena',
            'last_name' => 'Wicker',
            'date_of_birth' => '2015-01-01',
            'gender' => 'female',
            'tshirt_size' => 'Youth M',
            'county' => 'Richland',
        ]);
        $camper->medicalRecord()->create([]);

        return $camper;
    }

    public function test_deduper_collapses_identical_medication_rows(): void
    {
        $camper = $this->buildCamper();

        for ($i = 0; $i < 15; $i++) {
            Medication::create([
                'camper_id' => $camper->id,
                'name' => 'Baclofen',
                'dosage' => '10mg',
                'frequency' => 'Three times daily',
                'purpose' => 'Muscle relaxant',
            ]);
        }

        $counts = app(CamperChildRowDeduper::class)->dedupeForCamper($camper);

        $this->assertSame(14, $counts['medications']);
        $this->assertSame(1, Medication::where('camper_id', $camper->id)->count());
    }

    public function test_deduper_preserves_distinct_medications(): void
    {
        // Different natural-key fingerprints must survive: a camper may
        // legitimately have multiple medications of the same name at
        // different dosages (unlikely) or just different drugs.
        $camper = $this->buildCamper();

        Medication::create([
            'camper_id' => $camper->id,
            'name' => 'Baclofen',
            'dosage' => '10mg',
            'frequency' => 'Three times daily',
            'purpose' => 'Muscle relaxant',
        ]);
        Medication::create([
            'camper_id' => $camper->id,
            'name' => 'Vitamin D3',
            'dosage' => '1000 IU',
            'frequency' => 'Once daily',
            'purpose' => 'Supplement',
        ]);
        Medication::create([
            'camper_id' => $camper->id,
            'name' => 'Baclofen',
            'dosage' => '20mg', // different dosage → distinct row
            'frequency' => 'Three times daily',
            'purpose' => 'Muscle relaxant',
        ]);

        $counts = app(CamperChildRowDeduper::class)->dedupeForCamper($camper);

        $this->assertSame(0, $counts['medications']);
        $this->assertSame(3, Medication::where('camper_id', $camper->id)->count());
    }

    public function test_deduper_handles_all_five_tables(): void
    {
        $camper = $this->buildCamper();

        // Seed duplicates across every table.
        foreach (range(1, 5) as $_) {
            Medication::create([
                'camper_id' => $camper->id,
                'name' => 'Baclofen', 'dosage' => '10mg',
                'frequency' => 'TID', 'purpose' => 'Muscle',
            ]);
            Allergy::create([
                'camper_id' => $camper->id,
                'allergen' => 'Penicillin',
                'severity' => AllergySeverity::Moderate,
                'reaction' => 'Rash', 'treatment' => 'Benadryl',
            ]);
            EmergencyContact::create([
                'camper_id' => $camper->id,
                'name' => 'Margaret Howell',
                'relationship' => 'Grandmother',
                'phone_primary' => '8035550412',
                'is_primary' => false,
                'is_guardian' => false,
                'is_authorized_pickup' => true,
            ]);
            Diagnosis::create([
                'camper_id' => $camper->id,
                'name' => 'Cerebral palsy',
                'description' => 'Spastic quad',
                'severity_level' => DiagnosisSeverity::Moderate,
            ]);
            AssistiveDevice::create([
                'camper_id' => $camper->id,
                'device_type' => 'Manual Wheelchair',
                'requires_transfer_assistance' => true,
                'notes' => 'Standard',
            ]);
        }

        $counts = app(CamperChildRowDeduper::class)->dedupeForCamper($camper);

        $this->assertSame(4, $counts['medications']);
        $this->assertSame(4, $counts['allergies']);
        $this->assertSame(4, $counts['emergency_contacts']);
        $this->assertSame(4, $counts['diagnoses']);
        $this->assertSame(4, $counts['assistive_devices']);

        $this->assertSame(1, Medication::where('camper_id', $camper->id)->count());
        $this->assertSame(1, Allergy::where('camper_id', $camper->id)->count());
        $this->assertSame(1, EmergencyContact::where('camper_id', $camper->id)->count());
        $this->assertSame(1, Diagnosis::where('camper_id', $camper->id)->count());
        $this->assertSame(1, AssistiveDevice::where('camper_id', $camper->id)->count());
    }

    public function test_finalize_dedupes_before_flipping_to_submitted(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create([
            'first_name' => 'Athena',
            'last_name' => 'Wicker',
            'date_of_birth' => '2015-01-01',
            'gender' => 'female',
            'tshirt_size' => 'Youth M',
            'county' => 'Richland',
        ]);
        \Tests\Support\TestApplicationFixture::buildCamperMinimum($camper);
        \Tests\Support\TestApplicationFixture::attachRequiredDocuments($camper);

        // Simulate a retried submission: the same medication exists 6 times.
        for ($i = 0; $i < 6; $i++) {
            Medication::create([
                'camper_id' => $camper->id,
                'name' => 'Baclofen', 'dosage' => '10mg',
                'frequency' => 'TID', 'purpose' => 'Muscle',
            ]);
        }

        $session = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);
        $draft = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft' => true,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => null,
            'signed_at' => now(),
            'signature_name' => 'Jane Parent',
            'sections_reviewed' => \Tests\Support\TestApplicationFixture::reviewedOptionalSections(),
        ]);
        \Tests\Support\TestApplicationFixture::attachConsents($draft);

        $this->actingAs($parent)
            ->postJson("/api/applications/{$draft->id}/finalize")
            ->assertOk();

        $this->assertSame(
            1,
            Medication::where('camper_id', $camper->id)->count(),
            'finalize must collapse duplicate medications as part of the submit transaction',
        );
    }
}
