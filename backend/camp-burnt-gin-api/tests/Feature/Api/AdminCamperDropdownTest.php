<?php

namespace Tests\Feature\Api;

use App\Enums\ApplicationStatus;
use App\Enums\SubmissionSource;
use App\Models\Application;
use App\Models\Camper;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Locks in the contract behind the admin "Request Document" modal's Child
 * dropdown.
 *
 * The prior bug: admin opens Request Document, picks Jack Frost (a paper
 * applicant), and the Child select is empty. Root cause was twofold — the
 * admin branch of GET /campers ignored the user_id query param AND wrapped
 * the query in Camper::active(), which filters to enrolled campers (children
 * with an approved application). A family whose only application is a
 * pending paper_self draft has a real Camper row with is_active=false, so
 * active() excluded them and the dropdown rendered empty.
 *
 * The fix: when the admin passes user_id, the endpoint returns every Camper
 * belonging to that parent, regardless of enrollment status. Without user_id
 * the original Directory behaviour (enrolled only) is preserved.
 */
class AdminCamperDropdownTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    private User $admin;

    private User $paperApplicant;

    private Camper $paperCamper;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();

        $this->admin = $this->createAdmin();
        $this->paperApplicant = $this->createParent();

        // A paper-submitted family with a child and a pending paper application.
        // Camper::is_active defaults to false — only flipped true when an
        // application is approved.
        $this->paperCamper = Camper::factory()->create([
            'user_id' => $this->paperApplicant->id,
            'is_active' => false,
        ]);
        Application::factory()->create([
            'camper_id' => $this->paperCamper->id,
            'status' => ApplicationStatus::Submitted,
            'submission_source' => SubmissionSource::PaperSelf,
        ]);
    }

    #[Test]
    public function admin_can_see_paper_applicants_child_when_filtering_by_user_id(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->getJson('/api/campers?user_id='.$this->paperApplicant->id)
            ->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains(
            $this->paperCamper->id,
            $ids,
            'The paper applicant\'s camper must appear in the admin dropdown even without an approved application.',
        );
    }

    #[Test]
    public function admin_directory_mode_still_excludes_non_enrolled_campers(): void
    {
        Sanctum::actingAs($this->admin);

        // No user_id → directory mode. The paper camper (is_active=false)
        // must NOT show up. This guards against accidentally flattening
        // the two modes into one and regressing the Camper Directory page.
        $response = $this->getJson('/api/campers')->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertNotContains(
            $this->paperCamper->id,
            $ids,
            'Directory mode (no user_id) must remain enrollment-gated.',
        );
    }

    #[Test]
    public function admin_dropdown_scopes_strictly_to_requested_parent(): void
    {
        // A second family's camper must never leak into the results when
        // admin filters by user_id — horizontal privilege boundary.
        $otherParent = $this->createParent();
        $otherCamper = Camper::factory()->create([
            'user_id' => $otherParent->id,
            'is_active' => false,
        ]);

        Sanctum::actingAs($this->admin);

        $response = $this->getJson('/api/campers?user_id='.$this->paperApplicant->id)
            ->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertNotContains(
            $otherCamper->id,
            $ids,
            'user_id filter must be strict — another family\'s camper must not appear.',
        );
    }

    #[Test]
    public function every_application_has_a_camper_invariant(): void
    {
        // Schema-level invariant: applications.camper_id is non-nullable FK.
        // This test is a regression-proof marker: if someone ever makes that
        // column nullable, this test fails loudly because of the NOT NULL
        // constraint it relies on.
        $this->expectException(\Illuminate\Database\QueryException::class);

        Application::factory()->create([
            'camper_id' => null,
            'status' => ApplicationStatus::Draft,
            'submission_source' => SubmissionSource::PaperAdmin,
        ]);
    }
}
