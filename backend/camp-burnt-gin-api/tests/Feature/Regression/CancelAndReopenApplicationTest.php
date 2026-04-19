<?php

namespace Tests\Feature\Regression;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\Conversation;
use App\Models\CampSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Covers the admin cancel-with-confirmation + reverse-cancellation flow
 * added in the admin-review polish pass.
 *
 * Contracts:
 *   - `ApplicationStatus::Cancelled` may now transition to `UnderReview`
 *     (admin reversal). All other outgoing transitions stay forbidden.
 *   - Cancel produces an inbox message subject "Application cancelled".
 *   - Reopen produces an inbox message subject "Application reopened".
 *   - Reviewer notes from the cancel action are included verbatim in the
 *     parent-facing inbox message body.
 */
class CancelAndReopenApplicationTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    public function test_cancelled_can_transition_to_under_review(): void
    {
        $this->assertTrue(
            ApplicationStatus::Cancelled->canTransitionTo(ApplicationStatus::UnderReview),
            'Admin must be able to reverse a cancellation back into review.',
        );
    }

    public function test_cancelled_cannot_transition_to_anything_except_under_review(): void
    {
        foreach ([
            ApplicationStatus::Submitted,
            ApplicationStatus::Approved,
            ApplicationStatus::Rejected,
            ApplicationStatus::Waitlisted,
            ApplicationStatus::Withdrawn,
            ApplicationStatus::Cancelled,  // self-transition blocked
        ] as $target) {
            $this->assertFalse(
                ApplicationStatus::Cancelled->canTransitionTo($target),
                "Cancelled→{$target->value} must be blocked (only UnderReview is permitted).",
            );
        }
    }

    public function test_cancel_sends_cancellation_inbox_message_with_reviewer_notes(): void
    {
        $admin  = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create([
            'first_name' => 'Rhea', 'last_name' => 'Linden',
        ]);
        $session = CampSession::factory()->create(['is_active' => true]);
        $application = Application::factory()->create([
            'camper_id'       => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft'        => false,
            'status'          => ApplicationStatus::UnderReview,
            'submitted_at'    => now(),
        ]);

        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'cancelled',
            'notes'  => 'Session capacity redistributed across age groups.',
        ]);
        $response->assertOk();

        $this->assertSame(
            ApplicationStatus::Cancelled,
            $application->fresh()->status,
        );

        // Inbox conversation is created for the parent. The SystemNotification
        // service stores the application link on related_entity_* columns.
        $conversation = Conversation::where('related_entity_type', 'App\\Models\\Application')
            ->where('related_entity_id', $application->id)
            ->where('system_event_type', 'application.cancelled')
            ->first();
        $this->assertNotNull($conversation, 'A cancellation inbox message must be sent to the parent.');
        $this->assertStringContainsStringIgnoringCase(
            'cancelled',
            $conversation->subject ?? '',
            'Conversation subject should mention that the application was cancelled.',
        );

        $message = $conversation->messages()->first();
        $this->assertNotNull($message);
        $this->assertStringContainsString(
            'Session capacity redistributed',
            $message->body,
            'Reviewer notes must be included verbatim in the cancellation message body.',
        );
    }

    public function test_reopen_sends_reinstated_inbox_message(): void
    {
        $admin  = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create([
            'first_name' => 'Rhea', 'last_name' => 'Linden',
        ]);
        $session = CampSession::factory()->create(['is_active' => true]);
        $application = Application::factory()->create([
            'camper_id'       => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft'        => false,
            'status'          => ApplicationStatus::Cancelled,
            'submitted_at'    => now(),
        ]);

        $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'under_review',
        ])->assertOk();

        $this->assertSame(
            ApplicationStatus::UnderReview,
            $application->fresh()->status,
        );

        $conversation = Conversation::where('related_entity_type', 'App\\Models\\Application')
            ->where('related_entity_id', $application->id)
            ->where('system_event_type', 'application.reinstated')
            ->first();
        $this->assertNotNull($conversation, 'A reinstatement inbox message must be sent to the parent.');
    }
}
