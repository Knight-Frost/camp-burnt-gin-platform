<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Locks in the contract that PruneDraftDocuments only touches documents that
 * are truly abandoned applicant drafts, never documents that an admin has
 * archived and never documents that have been submitted to staff.
 */
class PruneDraftDocumentsTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    private function makeDoc(array $attrs): Document
    {
        $doc = Document::create(array_merge([
            'documentable_type'   => \App\Models\Camper::class,
            'documentable_id'     => 1,
            'document_type'       => 'supplementary',
            'original_filename'   => 'x.pdf',
            'stored_filename'     => 'x.pdf',
            'path'                => 'documents/x.pdf',
            'mime_type'           => 'application/pdf',
            'file_size'           => 100,
            'uploaded_by'         => $this->createParent()->id,
        ], $attrs));

        // Eloquent stamps created_at itself — force the backdated value for
        // tests that simulate stale drafts.
        if (isset($attrs['created_at']) || isset($attrs['archived_at']) || isset($attrs['submitted_at'])) {
            Document::withoutTimestamps(function () use ($doc, $attrs) {
                if (isset($attrs['created_at'])) {
                    $doc->created_at = $attrs['created_at'];
                }
                if (isset($attrs['archived_at'])) {
                    $doc->archived_at = $attrs['archived_at'];
                }
                if (isset($attrs['submitted_at'])) {
                    $doc->submitted_at = $attrs['submitted_at'];
                }
                $doc->save();
            });
        }
        return $doc->fresh() ?? $doc;
    }

    public function test_stale_draft_is_soft_deleted(): void
    {
        $stale = $this->makeDoc([
            'submitted_at' => null,
            'created_at'   => now()->subDays(60),
        ]);

        $this->artisan('documents:prune-drafts', ['--days' => 30])
            ->assertSuccessful();

        $this->assertSoftDeleted('documents', ['id' => $stale->id]);
    }

    public function test_recent_draft_is_left_alone(): void
    {
        $fresh = $this->makeDoc([
            'submitted_at' => null,
            'created_at'   => now()->subDays(2),
        ]);

        $this->artisan('documents:prune-drafts', ['--days' => 30])
            ->assertSuccessful();

        $this->assertDatabaseHas('documents', [
            'id'         => $fresh->id,
            'deleted_at' => null,
        ]);
    }

    public function test_submitted_document_is_never_pruned(): void
    {
        $old = $this->makeDoc([
            'submitted_at' => now()->subDays(90),
            'created_at'   => now()->subDays(120),
        ]);

        $this->artisan('documents:prune-drafts', ['--days' => 30])
            ->assertSuccessful();

        $this->assertDatabaseHas('documents', [
            'id'         => $old->id,
            'deleted_at' => null,
        ]);
    }

    public function test_archived_document_is_never_pruned(): void
    {
        // Archive is an admin workflow; the prune command must not compete with
        // it. Even an old archived draft should stay intact so admins retain
        // control of their archive pile.
        $archivedOld = $this->makeDoc([
            'submitted_at' => null,
            'created_at'   => now()->subDays(120),
            'archived_at'  => now()->subDays(60),
        ]);

        $this->artisan('documents:prune-drafts', ['--days' => 30])
            ->assertSuccessful();

        $this->assertDatabaseHas('documents', [
            'id'         => $archivedOld->id,
            'deleted_at' => null,
        ]);
    }

    public function test_dry_run_changes_nothing(): void
    {
        $stale = $this->makeDoc([
            'submitted_at' => null,
            'created_at'   => now()->subDays(60),
        ]);

        $this->artisan('documents:prune-drafts', ['--days' => 30, '--dry-run' => true])
            ->assertSuccessful();

        $this->assertDatabaseHas('documents', [
            'id'         => $stale->id,
            'deleted_at' => null,
        ]);
    }
}
