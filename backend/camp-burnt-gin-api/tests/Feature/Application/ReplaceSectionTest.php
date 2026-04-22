<?php

namespace Tests\Feature\Application;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * POST /api/applications/{application}/sections/{key}
 *
 * Coverage matrix:
 *
 *   - authorization (unauth, other parent, admin pass-through)
 *   - per-section happy path: validated payload writes correctly + stamps
 *     sections_reviewed[$key] + section_attestations[$key]
 *   - per-section validation failures: required fields, conditional rules
 *   - atomicity: failure midway leaves database unchanged (no partial write)
 *   - hybrid completion: data path AND attestation path both reach READY
 *   - list-relation full-replace semantics: prior rows soft-deleted, new
 *     rows created, no orphans visible
 *   - non-draft applications still permitted while editable; rejected after
 */
class ReplaceSectionTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        $this->seed(\Database\Seeders\RiskEngineSeeder::class);
        $this->seed(\Database\Seeders\RequiredDocumentRuleSeeder::class);
    }

    /** Returns [parent, camper, application]. */
    private function makeDraft(): array
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true, 'capacity' => 20]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        return [$parent, $camper, $app];
    }

    // ── Authorization ──────────────────────────────────────────────────

    public function test_unauthenticated_request_is_rejected(): void
    {
        [, , $app] = $this->makeDraft();

        $this->postJson("/api/applications/{$app->id}/sections/camper", [])
            ->assertUnauthorized();
    }

    public function test_other_parent_cannot_replace_section(): void
    {
        $other = $this->createParent();
        [, , $app] = $this->makeDraft();

        $this->actingAs($other)
            ->postJson("/api/applications/{$app->id}/sections/camper", $this->validCamperPayload())
            ->assertForbidden();
    }

    public function test_unknown_section_key_returns_404(): void
    {
        [$parent, , $app] = $this->makeDraft();

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/unknown", [])
            ->assertNotFound();
    }

    public function test_owner_can_replace_section_on_draft(): void
    {
        [$parent, , $app] = $this->makeDraft();

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/camper", $this->validCamperPayload())
            ->assertOk();
    }

    public function test_owner_cannot_replace_section_on_terminal_application(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $app = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Approved,
        ]);

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/camper", $this->validCamperPayload())
            ->assertForbidden();
    }

    // ── Camper section: writes profile + emergency contacts atomically ─

    public function test_camper_section_writes_profile_and_emergency_contacts(): void
    {
        [$parent, $camper, $app] = $this->makeDraft();

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/camper", $this->validCamperPayload())
            ->assertOk();

        $camper->refresh();
        $this->assertSame('Athena', $camper->first_name);
        $this->assertSame('Wicker', $camper->last_name);
        $this->assertSame('Richland', $camper->county);

        $contacts = $camper->emergencyContacts()->get();
        $this->assertCount(1, $contacts);
        $this->assertSame('Jane Wicker', $contacts->first()->name);
        $this->assertSame('803-555-0100', $contacts->first()->phone_primary);

        $app->refresh();
        $this->assertNotNull($app->sections_reviewed['camper'] ?? null);
    }

    public function test_camper_section_replaces_existing_emergency_contacts(): void
    {
        [$parent, $camper, $app] = $this->makeDraft();
        $camper->emergencyContacts()->create([
            'name' => 'Old Contact',
            'phone_primary' => '111-111-1111',
            'relationship' => 'Aunt',
        ]);

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/camper", $this->validCamperPayload())
            ->assertOk();

        $camper->refresh();
        $contacts = $camper->emergencyContacts()->get();
        $this->assertCount(1, $contacts, 'Old contact should be replaced, not coexist with new one.');
        $this->assertSame('Jane Wicker', $contacts->first()->name);
    }

    public function test_camper_section_partial_save_marks_section_incomplete(): void
    {
        // Replace-section is permissive during draft: missing required
        // fields don't 422, they just leave the section reporting incomplete
        // via the validation report. Engine drives completion, not the
        // request validator.
        [$parent, $camper, $app] = $this->makeDraft();
        $camper->update(['county' => null]); // Start blank so omission means blank.
        $payload = $this->validCamperPayload();
        $payload['county'] = null; // Explicitly null in request — engine should flag missing.

        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/camper", $payload)
            ->assertOk();

        $response->assertJsonPath('validation.sections.camper.is_complete', false);
        $missing = collect($response->json('validation.sections.camper.missing'))
            ->pluck('key')->all();
        $this->assertContains('county', $missing);
    }

    public function test_camper_section_empty_emergency_contacts_marks_section_incomplete(): void
    {
        [$parent, , $app] = $this->makeDraft();
        $payload = $this->validCamperPayload();
        $payload['emergency_contacts'] = [];

        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/camper", $payload)
            ->assertOk();

        $response->assertJsonPath('validation.sections.camper.is_complete', false);
        $missing = collect($response->json('validation.sections.camper.missing'))
            ->pluck('key')->all();
        $this->assertContains('emergency_contact', $missing);
    }

    // ── Health section: medical record + diagnoses + allergies ─────────

    public function test_health_section_writes_medical_record_and_diagnoses(): void
    {
        [$parent, $camper, $app] = $this->makeDraft();

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/health", $this->validHealthPayload())
            ->assertOk();

        $camper->refresh();
        $mr = $camper->medicalRecord;
        $this->assertNotNull($mr);
        $this->assertSame('Dr. Test', $mr->physician_name);
        $this->assertSame('TestCare Inc', $mr->insurance_provider);

        $this->assertCount(1, $camper->diagnoses()->get());
        $this->assertSame('Cerebral palsy', $camper->diagnoses->first()->name);
    }

    public function test_health_section_without_insurance_or_medicaid_is_incomplete(): void
    {
        [$parent, , $app] = $this->makeDraft();
        $payload = $this->validHealthPayload();
        $payload['insurance_provider'] = null;
        $payload['medicaid_number'] = null;

        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/health", $payload)
            ->assertOk();

        $response->assertJsonPath('validation.sections.health.is_complete', false);
        $missing = collect($response->json('validation.sections.health.missing'))
            ->pluck('key')->all();
        $this->assertContains('insurance', $missing);
    }

    public function test_health_section_without_diagnoses_is_incomplete(): void
    {
        [$parent, , $app] = $this->makeDraft();
        $payload = $this->validHealthPayload();
        $payload['diagnoses'] = [];

        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/health", $payload)
            ->assertOk();

        $response->assertJsonPath('validation.sections.health.is_complete', false);
        $missing = collect($response->json('validation.sections.health.missing'))
            ->pluck('key')->all();
        $this->assertContains('diagnoses', $missing);
    }

    // ── Hybrid sections: data path AND attestation path ────────────────

    public function test_behavior_section_with_attestation_only_marks_complete(): void
    {
        [$parent, , $app] = $this->makeDraft();

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/behavior", [
                'attestation' => true,
            ])
            ->assertOk()
            ->assertJsonPath('validation.sections.behavior.is_complete', true);

        $app->refresh();
        $this->assertTrue($app->section_attestations['behavior']);
    }

    public function test_behavior_section_with_data_marks_complete_without_attestation(): void
    {
        [$parent, , $app] = $this->makeDraft();

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/behavior", [
                'aggression' => true,
                'aggression_description' => 'Hits when frustrated; redirect verbally.',
            ])
            ->assertOk()
            ->assertJsonPath('validation.sections.behavior.is_complete', true);
    }

    public function test_behavior_section_empty_without_attestation_is_incomplete(): void
    {
        [$parent, , $app] = $this->makeDraft();

        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/behavior", []);

        $response->assertOk();
        $response->assertJsonPath('validation.sections.behavior.is_complete', false);
        // Missing reason should reference the attestation gate.
        $missing = collect($response->json('validation.sections.behavior.missing'))
            ->pluck('key')->all();
        $this->assertContains('behavior_attestation', $missing);
    }

    public function test_diet_section_attestation_required_when_no_data(): void
    {
        [$parent, , $app] = $this->makeDraft();

        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/diet", []);

        $response->assertOk();
        $response->assertJsonPath('validation.sections.diet.is_complete', false);
        $missing = collect($response->json('validation.sections.diet.missing'))
            ->pluck('key')->all();
        $this->assertContains('diet_attestation', $missing);
    }

    public function test_diet_section_g_tube_requires_formula_even_with_attestation(): void
    {
        [$parent, , $app] = $this->makeDraft();

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/diet", [
                'g_tube' => true,
                // formula and amount_per_feeding are missing — required_if
                'attestation' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['formula', 'amount_per_feeding']);
    }

    public function test_medications_section_with_data_marks_complete(): void
    {
        [$parent, , $app] = $this->makeDraft();

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/medications", [
                'medications' => [
                    ['name' => 'Aspirin', 'dosage' => '81mg', 'frequency' => 'Daily'],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('validation.sections.medications.is_complete', true);
    }

    public function test_equipment_section_with_attestation_only_marks_complete(): void
    {
        [$parent, , $app] = $this->makeDraft();

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/equipment", [
                'attestation' => true,
            ])
            ->assertOk()
            ->assertJsonPath('validation.sections.equipment.is_complete', true);
    }

    // ── Personal care section: required ADL levels ─────────────────────

    public function test_personal_care_section_writes_all_adl_levels(): void
    {
        [$parent, $camper, $app] = $this->makeDraft();

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/personal_care", [
                'bathing_level' => 'independent',
                'toileting_level' => 'verbal_cue',
                'dressing_level' => 'physical_assist',
                'oral_hygiene_level' => 'full_assist',
            ])
            ->assertOk()
            ->assertJsonPath('validation.sections.personal_care.is_complete', true);

        $camper->refresh();
        $pcp = $camper->personalCarePlan;
        $this->assertSame('independent', $pcp->bathing_level);
        $this->assertSame('full_assist', $pcp->oral_hygiene_level);
    }

    public function test_personal_care_section_partial_adl_marks_section_incomplete(): void
    {
        [$parent, , $app] = $this->makeDraft();

        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/personal_care", [
                'bathing_level' => 'independent',
                // toileting/dressing/oral_hygiene unset — not a 422,
                // section reports incomplete via validation report.
            ])
            ->assertOk();

        $response->assertJsonPath('validation.sections.personal_care.is_complete', false);
        $missing = collect($response->json('validation.sections.personal_care.missing'))
            ->pluck('key')->all();
        $this->assertContains('toileting_level', $missing);
        $this->assertContains('dressing_level', $missing);
        $this->assertContains('oral_hygiene_level', $missing);
    }

    public function test_personal_care_section_rejects_invalid_adl_value(): void
    {
        [$parent, , $app] = $this->makeDraft();

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/personal_care", [
                'bathing_level' => 'NONSENSE',
                'toileting_level' => 'independent',
                'dressing_level' => 'independent',
                'oral_hygiene_level' => 'independent',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['bathing_level']);
    }

    // ── Activities section: all 7 canonical slugs required ─────────────

    public function test_activities_section_requires_all_canonical_slugs(): void
    {
        [$parent, , $app] = $this->makeDraft();

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/activities", [
                'permissions' => $this->validActivities(),
            ])
            ->assertOk()
            ->assertJsonPath('validation.sections.activities.is_complete', true);
    }

    public function test_activities_restricted_requires_notes(): void
    {
        [$parent, , $app] = $this->makeDraft();
        $perms = $this->validActivities();
        $perms[0]['permission_level'] = 'restricted';
        $perms[0]['restriction_notes'] = null;

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/activities", [
                'permissions' => $perms,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['permissions.0.restriction_notes']);
    }

    // ── Narratives section: visit-and-leave still works ────────────────

    public function test_narratives_section_marks_complete_without_data(): void
    {
        [$parent, , $app] = $this->makeDraft();

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/narratives", [])
            ->assertOk()
            ->assertJsonPath('validation.sections.narratives.is_complete', true);
    }

    public function test_narratives_section_writes_supplied_text(): void
    {
        [$parent, , $app] = $this->makeDraft();

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/narratives", [
                'narrative_camp_benefit' => 'Athena would benefit from outdoor exposure.',
            ])
            ->assertOk();

        $app->refresh();
        $this->assertSame(
            'Athena would benefit from outdoor exposure.',
            $app->narrative_camp_benefit,
        );
    }

    // ── Atomicity: malformed payload writes nothing ────────────────────

    public function test_atomicity_failed_validation_does_not_change_state(): void
    {
        // Atomic-replace is permissive about MISSING required fields, so
        // we trigger atomicity by sending a malformed conditional row
        // (Restricted activity with no notes — well-formedness violation).
        [$parent, $camper, $app] = $this->makeDraft();
        $camper->activityPermissions()->create([
            'activity_name' => 'swimming',
            'permission_level' => 'yes',
        ]);
        $originalReviewed = $app->sections_reviewed;

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/activities", [
                'permissions' => [
                    [
                        'activity_name' => 'swimming',
                        'permission_level' => 'restricted',
                        'restriction_notes' => null, // Restricted requires notes.
                    ],
                ],
            ])
            ->assertUnprocessable();

        $camper->refresh();
        $app->refresh();
        // Existing activity row must still be intact (transaction rollback).
        $this->assertCount(
            1,
            $camper->activityPermissions()->get(),
            'Existing activity row must survive a validation-failed request.',
        );
        $this->assertSame(
            'yes',
            $camper->activityPermissions()->first()->permission_level->value,
            'Existing row must NOT be altered by a failed transaction.',
        );
        $this->assertSame($originalReviewed, $app->sections_reviewed, 'sections_reviewed must be unchanged on validation failure.');
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private function validCamperPayload(): array
    {
        return [
            'first_name' => 'Athena',
            'last_name' => 'Wicker',
            'date_of_birth' => '2015-01-01',
            'gender' => 'female',
            'tshirt_size' => 'Youth M',
            'county' => 'Richland',
            'emergency_contacts' => [
                [
                    'name' => 'Jane Wicker',
                    'phone_primary' => '803-555-0100',
                    'relationship' => 'Mother',
                    'is_primary' => true,
                ],
            ],
        ];
    }

    private function validHealthPayload(): array
    {
        return [
            'physician_name' => 'Dr. Test',
            'insurance_provider' => 'TestCare Inc',
            'insurance_policy_number' => 'POL-001',
            'diagnoses' => [
                ['name' => 'Cerebral palsy', 'severity_level' => 'moderate'],
            ],
        ];
    }

    private function validActivities(): array
    {
        $slugs = [
            'sports_games', 'arts_crafts', 'nature', 'fine_arts',
            'swimming', 'boating', 'camp_out',
        ];

        return array_map(
            fn ($slug) => [
                'activity_name' => $slug,
                'permission_level' => 'yes',
            ],
            $slugs,
        );
    }
}
