<?php

namespace Tests\Feature\Application;

use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Diagnosis;
use App\Models\MedicalRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression coverage for the 2026-04-22 forensic audit's headline bugs.
 *
 * Each test captures one root cause from the audit so we cannot silently
 * regress it. See docs/bug-tracking/BUG_TRACKER.md for the audit summary.
 */
class SectionFlushRegressionTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        $this->seed(\Database\Seeders\RiskEngineSeeder::class);
        $this->seed(\Database\Seeders\RequiredDocumentRuleSeeder::class);
    }

    /**
     * RC-1: stampSectionReviewed used to wrap its updateApplication call in a
     * silent try/catch, so a failed stamp left the section incomplete with no
     * user-visible error. The new atomic endpoint stamps reviewed AS PART OF
     * the same transaction as the data write — either both land or neither.
     * If the data write fails, the stamp must NOT land.
     */
    public function test_failed_section_replace_does_not_stamp_reviewed(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'sections_reviewed' => null,
        ]);
        // Set up a Restricted activity row missing notes — well-formedness
        // violation that triggers a 422 from the request validator.
        $camper->activityPermissions()->create([
            'activity_name' => 'swimming',
            'permission_level' => 'yes',
        ]);

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/activities", [
                'permissions' => [
                    [
                        'activity_name' => 'swimming',
                        'permission_level' => 'restricted',
                        'restriction_notes' => null,
                    ],
                ],
            ])
            ->assertUnprocessable();

        $app->refresh();
        $this->assertEmpty(
            $app->sections_reviewed ?? [],
            'sections_reviewed must remain empty when the section replace failed validation. '
                .'A stamped review on a failed write is the headline silent-failure bug we eliminated.'
        );
    }

    /**
     * RC-1 corollary: a successful section replace ALWAYS stamps reviewed.
     * The frontend no longer makes a separate stampSectionReviewed call;
     * the stamp is part of the same DB transaction as the data write.
     */
    public function test_successful_section_replace_stamps_reviewed_atomically(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'sections_reviewed' => null,
        ]);

        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/behavior", [
                'attestation' => true,
            ])
            ->assertOk();

        $app->refresh();
        $this->assertNotNull(
            $app->sections_reviewed['behavior'] ?? null,
            'sections_reviewed.behavior must be set on a successful replace.'
        );
        $this->assertTrue(
            $app->section_attestations['behavior'] ?? false,
            'section_attestations.behavior must be set when attestation=true.'
        );
    }

    /**
     * RC-4: the legacy flushSection auto-deleted the existing emergency
     * contact when the form's EC fields were partially blank. The new
     * atomic-replace endpoint does NOT touch emergency_contacts unless the
     * payload explicitly includes them — so a partial blank UI no longer
     * destroys data. The frontend's flushSection only includes
     * emergency_contacts when name+phone are both present.
     */
    public function test_partial_camper_payload_does_not_destroy_emergency_contacts(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $existingEc = $camper->emergencyContacts()->create([
            'name' => 'Important Contact',
            'phone_primary' => '555-1212',
            'relationship' => 'Aunt',
        ]);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        // Payload with NO emergency_contacts key at all — the parent's UI
        // had blank EC fields, so the frontend omitted them entirely.
        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/camper", [
                'first_name' => 'Updated',
                'last_name' => 'Name',
            ])
            ->assertOk();

        $this->assertNotNull(
            $existingEc->fresh(),
            'Existing emergency contact must survive a section replace that omits emergency_contacts entirely.'
        );
    }

    /**
     * RC-5: list-relation writes used to be N individual API calls (one per
     * row). A network drop midway left some rows committed and others not.
     * The new atomic endpoint is one transactional call — partial writes
     * are impossible. Confirm a malformed second row rolls back the first.
     */
    public function test_malformed_row_rolls_back_entire_section_write(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);
        $existingPerm = $camper->activityPermissions()->create([
            'activity_name' => 'swimming',
            'permission_level' => 'yes',
        ]);

        // First row well-formed, second row malformed (Restricted requires notes).
        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/activities", [
                'permissions' => [
                    [
                        'activity_name' => 'swimming',
                        'permission_level' => 'no',
                    ],
                    [
                        'activity_name' => 'boating',
                        'permission_level' => 'restricted',
                        'restriction_notes' => null,
                    ],
                ],
            ])
            ->assertUnprocessable();

        $camper->refresh();
        $perms = $camper->activityPermissions()->get();
        $this->assertCount(
            1,
            $perms,
            'Existing row must survive a transactional rollback — never partial state.'
        );
        $this->assertSame(
            'yes',
            $perms->first()->permission_level->value,
            'Existing permission_level=yes must NOT have been changed to "no" — entire transaction rolled back.'
        );
        $this->assertSame(
            $existingPerm->id,
            $perms->first()->id,
            'Same row, not a recreated one with a new id.',
        );
    }

    /**
     * Multi-camper isolation: BUG-240 + BUG-241 + BUG-242 originally
     * eliminated cross-camper draft contamination. Verify that two drafts
     * for two different campers under the same parent + same session
     * remain fully isolated through the new atomic-replace endpoint —
     * writing to one does not bleed into the other.
     */
    public function test_two_drafts_for_two_campers_remain_isolated(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camperA = Camper::factory()->create([
            'user_id' => $parent->id,
            'first_name' => 'CamperA',
        ]);
        $camperB = Camper::factory()->create([
            'user_id' => $parent->id,
            'first_name' => 'CamperB',
        ]);
        $appA = Application::factory()->draft()->create([
            'camper_id' => $camperA->id,
            'camp_session_id' => $session->id,
        ]);
        $appB = Application::factory()->draft()->create([
            'camper_id' => $camperB->id,
            'camp_session_id' => $session->id,
        ]);

        // Replace camper section on App A.
        $this->actingAs($parent)
            ->postJson("/api/applications/{$appA->id}/sections/camper", [
                'first_name' => 'AthenaA',
                'last_name' => 'Smith',
                'date_of_birth' => '2014-03-12',
                'gender' => 'female',
                'tshirt_size' => 'Youth M',
                'county' => 'Richland',
                'emergency_contacts' => [
                    ['name' => 'EC for A', 'phone_primary' => '111-1111', 'relationship' => 'Mother'],
                ],
            ])
            ->assertOk();

        $camperA->refresh();
        $camperB->refresh();
        $this->assertSame('AthenaA', $camperA->first_name);
        $this->assertSame('CamperB', $camperB->first_name, 'Camper B must not have been touched by writes to App A.');
        $this->assertCount(1, $camperA->emergencyContacts()->get());
        $this->assertCount(0, $camperB->emergencyContacts()->get(), 'Camper B must have no EC even after Camper A got one.');

        // Now replace App B's camper section.
        $this->actingAs($parent)
            ->postJson("/api/applications/{$appB->id}/sections/camper", [
                'first_name' => 'AthenaB',
                'last_name' => 'Jones',
                'date_of_birth' => '2016-08-22',
                'gender' => 'male',
                'tshirt_size' => 'Youth L',
                'county' => 'Lexington',
                'emergency_contacts' => [
                    ['name' => 'EC for B', 'phone_primary' => '222-2222', 'relationship' => 'Father'],
                ],
            ])
            ->assertOk();

        $camperA->refresh();
        $camperB->refresh();
        // Cross-check both still hold their own data.
        $this->assertSame('AthenaA', $camperA->first_name);
        $this->assertSame('AthenaB', $camperB->first_name);
        $this->assertSame('Richland', $camperA->county);
        $this->assertSame('Lexington', $camperB->county);
        $this->assertSame('EC for A', $camperA->emergencyContacts()->first()->name);
        $this->assertSame('EC for B', $camperB->emergencyContacts()->first()->name);
    }

    /**
     * RC-6: hybrid section completion. Empty section + checked attestation
     * → complete. Empty section + unchecked → incomplete. Adding data later
     * keeps the section complete regardless of attestation. This is the
     * "section header completion" rule the user reported broken.
     */
    public function test_hybrid_section_completion_three_states(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        // State A: empty + no attestation → INCOMPLETE
        $r1 = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/medications", []);
        $r1->assertOk()->assertJsonPath('validation.sections.medications.is_complete', false);

        // State B: empty + attestation → COMPLETE
        $r2 = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/medications", [
                'attestation' => true,
            ]);
        $r2->assertOk()->assertJsonPath('validation.sections.medications.is_complete', true);

        // State C: data + (toggle attestation off) → still COMPLETE
        $r3 = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/medications", [
                'medications' => [
                    ['name' => 'Albuterol', 'dosage' => '90mcg', 'frequency' => 'PRN'],
                ],
                'attestation' => false,
            ]);
        $r3->assertOk()->assertJsonPath('validation.sections.medications.is_complete', true);

        // State D: data cleared + attestation off → back to INCOMPLETE
        $r4 = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/medications", [
                'medications' => [],
                'attestation' => false,
            ]);
        $r4->assertOk()->assertJsonPath('validation.sections.medications.is_complete', false);
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2026-04-23 audit — Health & Consents completion fixes.
    //
    // Before this audit a parent who selected "No insurance" on the Health
    // form saw the section permanently red (the engine required a provider
    // OR medicaid number, with no recognition of "no insurance" as a valid
    // answer). Consents was even worse: the only writer was the submission
    // pre-flight, so the pill could never turn green during draft.
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Build a Camper + MedicalRecord + Diagnosis that satisfies every
     * Health-section rule EXCEPT insurance. Individual tests then set
     * the insurance_type/details to prove the insurance gate in isolation.
     */
    private function makeHealthReadyCamper($parent): Camper
    {
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        MedicalRecord::query()->create([
            'camper_id' => $camper->id,
            'physician_name' => 'Dr. Test',
        ]);
        Diagnosis::query()->create([
            'camper_id' => $camper->id,
            'name' => 'Cerebral palsy',
            'severity_level' => 'moderate',
        ]);

        return $camper;
    }

    /**
     * Root cause 1 (2026-04-23): the engine used to require an insurance
     * provider OR medicaid number, so "No insurance" — a valid UI answer —
     * left the Health pill permanently red. insurance_type='none' must now
     * count as a complete answer on its own.
     */
    public function test_health_completes_when_insurance_type_is_none(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camper = $this->makeHealthReadyCamper($parent);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/health", [
                'insurance_type' => 'none',
                'physician_name' => 'Dr. Test',
                'diagnoses' => [
                    ['name' => 'Cerebral palsy', 'severity_level' => 'moderate'],
                ],
            ]);

        $response->assertOk()
            ->assertJsonPath('validation.sections.health.is_complete', true);
    }

    /**
     * Symmetric coverage: a record with insurance_type still null (parent
     * hasn't picked a radio yet) must remain INCOMPLETE. Without this, the
     * fix above could mask a new "silently complete on load" regression.
     */
    public function test_health_incomplete_when_insurance_type_null(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camper = $this->makeHealthReadyCamper($parent);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/health", [
                // insurance_type deliberately omitted — parent skipped the radio.
                'physician_name' => 'Dr. Test',
                'diagnoses' => [
                    ['name' => 'Cerebral palsy', 'severity_level' => 'moderate'],
                ],
            ]);

        $response->assertOk()
            ->assertJsonPath('validation.sections.health.is_complete', false);
    }

    /**
     * Medicaid selection requires a medicaid_number. Selecting "Medicaid"
     * without filling the number is a half-answer and must stay incomplete.
     */
    public function test_health_medicaid_without_number_stays_incomplete(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camper = $this->makeHealthReadyCamper($parent);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $withoutNumber = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/health", [
                'insurance_type' => 'medicaid',
                'physician_name' => 'Dr. Test',
                'diagnoses' => [['name' => 'Cerebral palsy', 'severity_level' => 'moderate']],
            ]);
        $withoutNumber->assertOk()
            ->assertJsonPath('validation.sections.health.is_complete', false);

        $withNumber = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/health", [
                'insurance_type' => 'medicaid',
                'medicaid_number' => 'MCD-12345',
                'physician_name' => 'Dr. Test',
                'diagnoses' => [['name' => 'Cerebral palsy', 'severity_level' => 'moderate']],
            ]);
        $withNumber->assertOk()
            ->assertJsonPath('validation.sections.health.is_complete', true);
    }

    /**
     * "Other" (private) insurance requires insurance_provider. Symmetric
     * to the medicaid test: partial answers on either branch stay
     * incomplete, full answers complete.
     */
    public function test_health_other_insurance_without_provider_stays_incomplete(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camper = $this->makeHealthReadyCamper($parent);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $withoutProvider = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/health", [
                'insurance_type' => 'other',
                'physician_name' => 'Dr. Test',
                'diagnoses' => [['name' => 'Cerebral palsy', 'severity_level' => 'moderate']],
            ]);
        $withoutProvider->assertOk()
            ->assertJsonPath('validation.sections.health.is_complete', false);

        $withProvider = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/health", [
                'insurance_type' => 'other',
                'insurance_provider' => 'BlueShield',
                'physician_name' => 'Dr. Test',
                'diagnoses' => [['name' => 'Cerebral palsy', 'severity_level' => 'moderate']],
            ]);
        $withProvider->assertOk()
            ->assertJsonPath('validation.sections.health.is_complete', true);
    }

    /**
     * Root cause 2 (2026-04-23): Consents used to only be persisted during
     * submission pre-flight, so the pill could never turn green during
     * draft. The new consents section-replace endpoint writes all 7
     * ApplicationConsent rows AND stamps Application.signed_at in one
     * transaction — the engine sees both atomically.
     */
    public function test_consents_section_flush_completes_the_pill(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $this->assertNull($app->signed_at, 'Precondition: signed_at starts null.');
        $this->assertSame(0, $app->consents()->count(), 'Precondition: no consent rows.');

        $response = $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/consents", [
                'consents' => [
                    ['consent_type' => 'general'],
                    ['consent_type' => 'photos'],
                    ['consent_type' => 'liability'],
                    ['consent_type' => 'activity'],
                    ['consent_type' => 'authorization'],
                    ['consent_type' => 'medication'],
                    ['consent_type' => 'hipaa'],
                ],
                'guardian_name' => 'Parent Guardian',
                'guardian_relationship' => 'Mother',
                'guardian_signature' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
                'signed_at' => now()->subMinute()->toIso8601String(),
            ]);

        $response->assertOk()
            ->assertJsonPath('validation.sections.consents.is_complete', true);

        $app->refresh();
        $this->assertNotNull(
            $app->signed_at,
            'signed_at must be stamped by the consents section-replace — this is what validateConsents checks.',
        );
        $this->assertSame(
            7,
            $app->consents()->count(),
            'Exactly 7 ApplicationConsent rows must exist after the flush.',
        );
    }

    /**
     * Consents is all-or-nothing by design. A request missing any of the
     * required fields (guardian name, signature, fewer than 7 types, etc.)
     * must 422 — and critically must NOT partially stamp signed_at on the
     * Application, which would put the engine in a half-state.
     */
    public function test_consents_section_flush_422s_without_polluting_state(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $app = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        // Missing guardian_name + short consents list.
        $this->actingAs($parent)
            ->postJson("/api/applications/{$app->id}/sections/consents", [
                'consents' => [
                    ['consent_type' => 'general'],
                ],
                'guardian_signature' => 'data:image/png;base64,iVBORw0KGgoAAAA',
                'signed_at' => now()->subMinute()->toIso8601String(),
            ])
            ->assertUnprocessable();

        $app->refresh();
        $this->assertNull(
            $app->signed_at,
            'signed_at must remain null after a 422 — no half-stamped legal state.',
        );
        $this->assertSame(
            0,
            $app->consents()->count(),
            'No ApplicationConsent rows may be created by a rejected request.',
        );
    }
}
