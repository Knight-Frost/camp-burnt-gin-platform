<?php

namespace Tests\Feature\Regression;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression coverage for Phase-4 canonical read model.
 *
 * GET /api/applications/{id} now returns a `canonical` key with an
 * 11-section structural projection AND a meta.compliance block whose
 * per-issue entries carry both admin_label and applicant_label. The
 * frontend renders from these fields directly — no local isExpired()
 * recomputation — which is how the admin/applicant "different truth for
 * the same row" bug is prevented.
 */
class ApplicationAggregateReadModelTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        Queue::fake();
    }

    private function buildSubmittedApplication(): Application
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
        $session = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);

        return Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => now(),
        ]);
    }

    public function test_show_returns_canonical_key_alongside_legacy_data(): void
    {
        $app = $this->buildSubmittedApplication();
        $parent = $app->camper->user;

        $response = $this->actingAs($parent)
            ->getJson("/api/applications/{$app->id}")
            ->assertOk();

        $response->assertJsonStructure(['data', 'canonical']);
    }

    public function test_canonical_payload_has_all_eleven_sections(): void
    {
        $app = $this->buildSubmittedApplication();
        $parent = $app->camper->user;

        $canonical = $this->actingAs($parent)
            ->getJson("/api/applications/{$app->id}")
            ->assertOk()
            ->json('canonical');

        // All 11 sections always structurally present — even when empty.
        $this->assertArrayHasKey('sections', $canonical);
        foreach ([
            'camper', 'health', 'behavior', 'equipment', 'diet',
            'personal_care', 'activities', 'medications', 'narratives',
            'documents', 'consents',
        ] as $section) {
            $this->assertArrayHasKey(
                $section,
                $canonical['sections'],
                "canonical.sections must always include $section",
            );
        }
    }

    public function test_canonical_payload_has_compliance_meta_with_issues_array(): void
    {
        $app = $this->buildSubmittedApplication();
        $parent = $app->camper->user;

        $canonical = $this->actingAs($parent)
            ->getJson("/api/applications/{$app->id}")
            ->assertOk()
            ->json('canonical');

        $this->assertArrayHasKey('meta', $canonical);
        $this->assertArrayHasKey('compliance', $canonical['meta']);
        $this->assertArrayHasKey('is_compliant', $canonical['meta']['compliance']);
        $this->assertArrayHasKey('issues', $canonical['meta']['compliance']);
    }

    public function test_admin_and_applicant_see_same_section_structure(): void
    {
        $app = $this->buildSubmittedApplication();
        $parent = $app->camper->user;
        $admin = $this->createAdmin();

        $applicantCanonical = $this->actingAs($parent)
            ->getJson("/api/applications/{$app->id}")
            ->assertOk()
            ->json('canonical.sections');

        $adminCanonical = $this->actingAs($admin)
            ->getJson("/api/applications/{$app->id}")
            ->assertOk()
            ->json('canonical.sections');

        $this->assertSame(
            array_keys($applicantCanonical),
            array_keys($adminCanonical),
            'admin and applicant must see the same set of sections',
        );
    }

    public function test_documents_carry_server_computed_compliance_metadata(): void
    {
        $app = $this->buildSubmittedApplication();
        $parent = $app->camper->user;

        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $app->camper_id,
            'document_type' => 'immunization_record',
            'original_filename' => 'immunization.pdf',
            'stored_filename' => 'immunization.pdf',
            'path' => 'documents/immunization.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'uploaded_by' => $parent->id,
            'submitted_at' => now(),
            'is_verified' => true,
        ]);

        $list = $this->actingAs($parent)
            ->getJson("/api/applications/{$app->id}")
            ->assertOk()
            ->json('canonical.sections.documents.list');

        $this->assertNotEmpty($list);
        $doc = $list[0];
        // Server-computed compliance fields — frontends MUST render these
        // directly and must not recompute.
        $this->assertArrayHasKey('is_submitted', $doc);
        $this->assertArrayHasKey('is_expired', $doc);
        $this->assertArrayHasKey('is_verified', $doc);
        $this->assertArrayHasKey('compliance_status', $doc);
        $this->assertArrayHasKey('admin_label', $doc);
        $this->assertArrayHasKey('applicant_label', $doc);
    }

    public function test_admin_documents_list_filters_drafts(): void
    {
        $app = $this->buildSubmittedApplication();
        $parent = $app->camper->user;
        $admin = $this->createAdmin();

        // A submitted doc — both admin and applicant see it.
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $app->camper_id,
            'document_type' => 'immunization_record',
            'original_filename' => 'imm.pdf', 'stored_filename' => 'imm.pdf',
            'path' => 'documents/imm.pdf', 'mime_type' => 'application/pdf',
            'file_size' => 1024, 'uploaded_by' => $parent->id,
            'submitted_at' => now(), 'is_verified' => true,
        ]);
        // A draft doc — only applicant sees it.
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $app->camper_id,
            'document_type' => 'insurance_card',
            'original_filename' => 'ins.pdf', 'stored_filename' => 'ins.pdf',
            'path' => 'documents/ins.pdf', 'mime_type' => 'application/pdf',
            'file_size' => 1024, 'uploaded_by' => $parent->id,
            'submitted_at' => null,
        ]);

        $applicantDocs = $this->actingAs($parent)
            ->getJson("/api/applications/{$app->id}")
            ->json('canonical.sections.documents.list');

        $adminDocs = $this->actingAs($admin)
            ->getJson("/api/applications/{$app->id}")
            ->json('canonical.sections.documents.list');

        $this->assertCount(2, $applicantDocs, 'applicant sees submitted + draft');
        $this->assertCount(1, $adminDocs, 'admin sees submitted only');
    }
}
