<?php

namespace Tests\Feature\Regression;

use App\Enums\AllergySeverity;
use App\Enums\DiagnosisSeverity;
use App\Models\Allergy;
use App\Models\AssistiveDevice;
use App\Models\Camper;
use App\Models\Diagnosis;
use App\Models\EmergencyContact;
use App\Models\Medication;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression coverage for BUG-214 root fix: all five child-row controllers
 * (Medication, Allergy, Diagnosis, EmergencyContact, AssistiveDevice) now
 * write via CamperChildRowUpserter so retries of the submission flow do
 * not produce duplicates at the DB level.
 *
 * Before this change, the CamperChildRowDeduper ran at finalize() to clean
 * up duplicates that blind Model::create() had already written. That was a
 * symptom patch — an edit between retries would produce two signatures,
 * both survived the dedupe, and the admin saw "Baclofen 10mg" alongside
 * "Baclofen 15mg" as if they were distinct.
 *
 * These tests assert the invariant at write time: posting the same row
 * twice to the same camper does not create a second row.
 */
class IdempotentChildRowWritesTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        Queue::fake();
    }

    private function makeCamperForParent(\App\Models\User $parent): Camper
    {
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

    public function test_posting_identical_medication_twice_yields_one_row(): void
    {
        $parent = $this->createParent();
        $camper = $this->makeCamperForParent($parent);

        $payload = [
            'camper_id' => $camper->id,
            'name' => 'Baclofen',
            'dosage' => '10mg',
            'frequency' => 'Three times daily',
            'purpose' => 'Muscle relaxant',
        ];

        $this->actingAs($parent)->postJson('/api/medications', $payload)->assertCreated();
        $this->actingAs($parent)->postJson('/api/medications', $payload)->assertOk();
        $this->actingAs($parent)->postJson('/api/medications', $payload)->assertOk();

        $this->assertSame(1, Medication::where('camper_id', $camper->id)->count());
    }

    public function test_different_medications_create_distinct_rows(): void
    {
        $parent = $this->createParent();
        $camper = $this->makeCamperForParent($parent);

        $this->actingAs($parent)->postJson('/api/medications', [
            'camper_id' => $camper->id, 'name' => 'Baclofen', 'dosage' => '10mg',
            'frequency' => 'TID', 'purpose' => 'Muscle',
        ])->assertCreated();

        // Different dosage — same drug, different clinical entity.
        $this->actingAs($parent)->postJson('/api/medications', [
            'camper_id' => $camper->id, 'name' => 'Baclofen', 'dosage' => '20mg',
            'frequency' => 'TID', 'purpose' => 'Muscle',
        ])->assertCreated();

        // Different drug entirely.
        $this->actingAs($parent)->postJson('/api/medications', [
            'camper_id' => $camper->id, 'name' => 'Vitamin D', 'dosage' => '1000 IU',
            'frequency' => 'Daily', 'purpose' => 'Supplement',
        ])->assertCreated();

        $this->assertSame(3, Medication::where('camper_id', $camper->id)->count());
    }

    public function test_posting_identical_allergy_twice_yields_one_row(): void
    {
        $parent = $this->createParent();
        $camper = $this->makeCamperForParent($parent);

        $payload = [
            'camper_id' => $camper->id,
            'allergen' => 'Penicillin',
            'severity' => AllergySeverity::Moderate->value,
            'reaction' => 'Rash',
            'treatment' => 'Benadryl',
        ];

        $this->actingAs($parent)->postJson('/api/allergies', $payload)->assertCreated();
        $this->actingAs($parent)->postJson('/api/allergies', $payload)->assertOk();

        $this->assertSame(1, Allergy::where('camper_id', $camper->id)->count());
    }

    public function test_posting_identical_diagnosis_twice_yields_one_row(): void
    {
        $parent = $this->createParent();
        $camper = $this->makeCamperForParent($parent);

        $payload = [
            'camper_id' => $camper->id,
            'name' => 'Cerebral palsy',
            'description' => 'Spastic quadriplegic',
            'severity_level' => DiagnosisSeverity::Moderate->value,
        ];

        $this->actingAs($parent)->postJson('/api/diagnoses', $payload)->assertCreated();
        $this->actingAs($parent)->postJson('/api/diagnoses', $payload)->assertOk();

        $this->assertSame(1, Diagnosis::where('camper_id', $camper->id)->count());
    }

    public function test_posting_identical_emergency_contact_twice_yields_one_row(): void
    {
        $parent = $this->createParent();
        $camper = $this->makeCamperForParent($parent);

        $payload = [
            'camper_id' => $camper->id,
            'name' => 'Margaret Howell',
            'relationship' => 'Grandmother',
            'phone_primary' => '8035550412',
            'is_primary' => false,
            'is_guardian' => false,
            'is_authorized_pickup' => true,
        ];

        $this->actingAs($parent)->postJson('/api/emergency-contacts', $payload)->assertCreated();
        $this->actingAs($parent)->postJson('/api/emergency-contacts', $payload)->assertOk();

        $this->assertSame(1, EmergencyContact::where('camper_id', $camper->id)->count());
    }

    public function test_posting_identical_assistive_device_twice_yields_one_row(): void
    {
        $parent = $this->createParent();
        $camper = $this->makeCamperForParent($parent);

        $payload = [
            'camper_id' => $camper->id,
            'device_type' => 'Manual Wheelchair',
            'requires_transfer_assistance' => true,
            'notes' => 'Standard',
        ];

        $this->actingAs($parent)->postJson('/api/assistive-devices', $payload)->assertCreated();
        $this->actingAs($parent)->postJson('/api/assistive-devices', $payload)->assertOk();

        $this->assertSame(1, AssistiveDevice::where('camper_id', $camper->id)->count());
    }

    public function test_retry_of_full_submission_does_not_duplicate_child_rows(): void
    {
        // Mimics the real-world retry scenario: network hiccup mid-submission
        // causes the applicant flow to POST the entire array twice. None of
        // the five child tables should end up with duplicates.
        $parent = $this->createParent();
        $camper = $this->makeCamperForParent($parent);

        $this->submitFullSet($parent, $camper);
        $this->submitFullSet($parent, $camper);
        $this->submitFullSet($parent, $camper);

        $this->assertSame(1, Medication::where('camper_id', $camper->id)->count(),
            'medications must not duplicate on retry');
        $this->assertSame(1, Allergy::where('camper_id', $camper->id)->count(),
            'allergies must not duplicate on retry');
        $this->assertSame(1, Diagnosis::where('camper_id', $camper->id)->count(),
            'diagnoses must not duplicate on retry');
        $this->assertSame(1, EmergencyContact::where('camper_id', $camper->id)->count(),
            'emergency contacts must not duplicate on retry');
        $this->assertSame(1, AssistiveDevice::where('camper_id', $camper->id)->count(),
            'assistive devices must not duplicate on retry');
    }

    private function submitFullSet(\App\Models\User $parent, Camper $camper): void
    {
        $this->actingAs($parent)->postJson('/api/medications', [
            'camper_id' => $camper->id, 'name' => 'Baclofen', 'dosage' => '10mg',
            'frequency' => 'TID', 'purpose' => 'Muscle',
        ]);
        $this->actingAs($parent)->postJson('/api/allergies', [
            'camper_id' => $camper->id, 'allergen' => 'Penicillin',
            'severity' => AllergySeverity::Moderate->value,
            'reaction' => 'Rash', 'treatment' => 'Benadryl',
        ]);
        $this->actingAs($parent)->postJson('/api/diagnoses', [
            'camper_id' => $camper->id, 'name' => 'Cerebral palsy',
            'description' => 'Spastic quad',
            'severity_level' => DiagnosisSeverity::Moderate->value,
        ]);
        $this->actingAs($parent)->postJson('/api/emergency-contacts', [
            'camper_id' => $camper->id, 'name' => 'Margaret Howell',
            'relationship' => 'Grandmother', 'phone_primary' => '8035550412',
            'is_primary' => false, 'is_guardian' => false,
            'is_authorized_pickup' => true,
        ]);
        $this->actingAs($parent)->postJson('/api/assistive-devices', [
            'camper_id' => $camper->id, 'device_type' => 'Manual Wheelchair',
            'requires_transfer_assistance' => true, 'notes' => 'Standard',
        ]);
    }
}
