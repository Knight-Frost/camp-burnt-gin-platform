<?php

namespace Tests\Feature\Regression;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Document;
use App\Services\Document\DocumentService;
use App\Services\Document\DocumentUniquenessEnforcer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression coverage for BUG-216: the document table allowed unlimited
 * rows per (documentable_type, documentable_id, document_type).
 * Every upload via the applicant flow called Document::create() blindly,
 * which is how Application #2 ended up with 9 Medical Exam Forms, 9
 * Immunization Records, and 8 Insurance Cards all "live" at once.
 *
 * The fix is three layers of defence:
 *   1. DocumentService::upload archives the existing live row before
 *      creating a new one (application-layer idempotency).
 *   2. MySQL functional unique index documents_live_ownership_unique
 *      (DB-layer invariant; absent on SQLite).
 *   3. DocumentUniquenessEnforcer cleanup command for legacy data.
 *
 * These tests target the app-layer invariants since SQLite (used in
 * tests) does not support the functional index. The DB constraint is
 * verified separately on MySQL via tinker after the migration runs.
 */
class DocumentUniquenessTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        Queue::fake();
        Storage::fake('local');
    }

    private function buildSubmittedApplication(): Application
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create([
            'first_name' => 'Athena', 'last_name' => 'Wicker',
            'date_of_birth' => '2015-01-01', 'gender' => 'female',
            'tshirt_size' => 'Youth M', 'county' => 'Richland',
        ]);
        $camper->medicalRecord()->create([]);
        $session = CampSession::factory()->create(['portal_open' => true, 'is_active' => true]);

        return Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft' => false,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => now(),
        ]);
    }

    public function test_upload_twice_same_owner_and_type_keeps_only_one_live_row(): void
    {
        $app = $this->buildSubmittedApplication();
        $user = $app->camper->user;
        $service = app(DocumentService::class);

        $firstFile = UploadedFile::fake()->image('first.png');
        $result1 = $service->upload($firstFile, [
            'documentable_type' => Application::class,
            'documentable_id' => $app->id,
            'document_type' => 'insurance_card',
        ], $user);
        $this->assertTrue($result1['success']);

        $secondFile = UploadedFile::fake()->image('second.png');
        $result2 = $service->upload($secondFile, [
            'documentable_type' => Application::class,
            'documentable_id' => $app->id,
            'document_type' => 'insurance_card',
        ], $user);
        $this->assertTrue($result2['success']);

        $liveCount = Document::where('documentable_type', Application::class)
            ->where('documentable_id', $app->id)
            ->where('document_type', 'insurance_card')
            ->whereNull('archived_at')
            ->count();

        $this->assertSame(1, $liveCount, 'exactly one LIVE row per (owner, type)');

        $totalCount = Document::where('documentable_type', Application::class)
            ->where('documentable_id', $app->id)
            ->where('document_type', 'insurance_card')
            ->count();
        $this->assertSame(2, $totalCount, 'history preserved: old row archived, not deleted');

        $live = Document::where('documentable_type', Application::class)
            ->where('documentable_id', $app->id)
            ->where('document_type', 'insurance_card')
            ->whereNull('archived_at')
            ->first();
        $this->assertSame('second.png', $live->original_filename, 'newest upload survives');
    }

    public function test_different_document_types_coexist_on_same_application(): void
    {
        $app = $this->buildSubmittedApplication();
        $user = $app->camper->user;
        $service = app(DocumentService::class);

        foreach (['official_medical_form', 'immunization_record', 'insurance_card'] as $type) {
            $r = $service->upload(
                UploadedFile::fake()->image("$type.png"),
                [
                    'documentable_type' => Application::class,
                    'documentable_id' => $app->id,
                    'document_type' => $type,
                ],
                $user,
            );
            $this->assertTrue($r['success']);
        }

        $liveCount = Document::where('documentable_type', Application::class)
            ->where('documentable_id', $app->id)
            ->whereNull('archived_at')
            ->count();

        $this->assertSame(3, $liveCount, 'three different types, three live rows');
    }

    public function test_uniqueness_enforcer_archives_pre_existing_duplicates(): void
    {
        $app = $this->buildSubmittedApplication();

        // Simulate the pre-fix state: blindly insert 5 duplicate rows
        // with DB::table to bypass any model-level guards.
        foreach (range(1, 5) as $i) {
            \DB::table('documents')->insert([
                'documentable_type' => Application::class,
                'documentable_id' => $app->id,
                'document_type' => 'immunization_record',
                'uploaded_by' => $app->camper->user_id,
                'original_filename' => "file$i.pdf",
                'stored_filename' => "file$i.pdf",
                'mime_type' => 'application/pdf',
                'file_size' => 100,
                'disk' => 'local',
                'path' => "documents/file$i.pdf",
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->assertSame(5, Document::where('documentable_id', $app->id)
            ->where('document_type', 'immunization_record')->whereNull('archived_at')->count());

        $report = app(DocumentUniquenessEnforcer::class)->archiveDuplicates(dryRun: false);

        $this->assertSame(1, $report['groups_found']);
        $this->assertSame(4, $report['rows_archived']);

        $this->assertSame(1, Document::where('documentable_id', $app->id)
            ->where('document_type', 'immunization_record')->whereNull('archived_at')->count());
    }

    public function test_canonical_documents_list_excludes_archived_for_both_roles(): void
    {
        $app = $this->buildSubmittedApplication();
        $parent = $app->camper->user;
        $admin = $this->createAdmin();

        // One live, one archived of the same type.
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $app->camper_id,
            'document_type' => 'immunization_record',
            'uploaded_by' => $parent->id,
            'original_filename' => 'live.pdf', 'stored_filename' => 'live.pdf',
            'mime_type' => 'application/pdf', 'file_size' => 100,
            'disk' => 'local', 'path' => 'documents/live.pdf',
            'submitted_at' => now(),
            'is_verified' => true,
        ]);
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $app->camper_id,
            'document_type' => 'immunization_record',
            'uploaded_by' => $parent->id,
            'original_filename' => 'archived.pdf', 'stored_filename' => 'archived.pdf',
            'mime_type' => 'application/pdf', 'file_size' => 100,
            'disk' => 'local', 'path' => 'documents/archived.pdf',
            'submitted_at' => now()->subDay(),
            'archived_at' => now()->subDay(),
        ]);

        $applicantDocs = $this->actingAs($parent)
            ->getJson("/api/applications/{$app->id}")
            ->json('canonical.sections.documents.list');

        $adminDocs = $this->actingAs($admin)
            ->getJson("/api/applications/{$app->id}")
            ->json('canonical.sections.documents.list');

        $this->assertCount(1, $applicantDocs,
            'applicant must see exactly one live immunization record, not the archive');
        $this->assertCount(1, $adminDocs,
            'admin must see exactly one live immunization record, not the archive');
        $this->assertSame('live.pdf', $applicantDocs[0]['original_filename']);
        $this->assertSame('live.pdf', $adminDocs[0]['original_filename']);
    }

    public function test_admin_and_applicant_see_identical_document_count_after_dedupe(): void
    {
        // The symptom screenshots showed the applicant seeing many duplicate
        // rows. After the fix both roles must see the same live-set.
        $app = $this->buildSubmittedApplication();
        $parent = $app->camper->user;
        $admin = $this->createAdmin();

        foreach (['official_medical_form', 'immunization_record', 'insurance_card'] as $type) {
            Document::create([
                'documentable_type' => Application::class,
                'documentable_id' => $app->id,
                'document_type' => $type,
                'uploaded_by' => $parent->id,
                'original_filename' => "$type.pdf",
                'stored_filename' => "$type.pdf",
                'mime_type' => 'application/pdf',
                'file_size' => 100,
                'disk' => 'local',
                'path' => "documents/$type.pdf",
                'submitted_at' => now(),
                'is_verified' => true,
                'expiration_date' => $type === 'official_medical_form' ? now()->addYear() : null,
            ]);
        }

        $applicantDocs = $this->actingAs($parent)
            ->getJson("/api/applications/{$app->id}")
            ->json('canonical.sections.documents.list');
        $adminDocs = $this->actingAs($admin)
            ->getJson("/api/applications/{$app->id}")
            ->json('canonical.sections.documents.list');

        $this->assertCount(3, $applicantDocs);
        $this->assertCount(3, $adminDocs);

        $applicantTypes = collect($applicantDocs)->pluck('document_type')->sort()->values()->all();
        $adminTypes = collect($adminDocs)->pluck('document_type')->sort()->values()->all();
        $this->assertSame($applicantTypes, $adminTypes,
            'both roles must see identical document types, no duplicates, no missing');
    }
}
