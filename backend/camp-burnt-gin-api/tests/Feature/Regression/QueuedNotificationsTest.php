<?php

namespace Tests\Feature\Regression;

use App\Jobs\SendNotificationJob;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Notifications\Camper\ApplicationStatusChangedNotification;
use App\Notifications\Camper\ApplicationSubmittedNotification;
use App\Notifications\Camper\WaitlistedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression tests for queued notifications.
 *
 * Verifies that notifications are dispatched to the queue instead of
 * being sent synchronously, improving response times.
 */
class QueuedNotificationsTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        Queue::fake();
    }

    public function test_application_submission_queues_notification(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true, 'capacity' => 20]);
        $camper = Camper::factory()->create([
            'user_id' => $parent->id,
            'first_name' => 'Alice',
            'last_name' => 'Smith',
            'date_of_birth' => '2010-01-01',
            'gender' => 'female',
            'tshirt_size' => 'Youth M',
            'county' => 'Richland',
        ]);

        \Tests\Support\TestApplicationFixture::buildCamperMinimum($camper);
        \Tests\Support\TestApplicationFixture::attachRequiredDocuments($camper);

        $application = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'signed_at' => now(),
            'signature_name' => 'Jane Smith',
            'sections_reviewed' => \Tests\Support\TestApplicationFixture::reviewedOptionalSections(),
        ]);
        \Tests\Support\TestApplicationFixture::attachConsents($application, 'Jane Smith');

        $response = $this->actingAs($parent)->postJson("/api/applications/{$application->id}/finalize");

        $response->assertOk();

        // Verify notification was queued (not sent synchronously)
        Queue::assertPushed(SendNotificationJob::class, function ($job) {
            return $job->notification instanceof ApplicationSubmittedNotification;
        });
    }

    public function test_draft_application_does_not_queue_notification(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = \App\Models\CampSession::factory()->create();

        // Save as draft
        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => 'draft',
        ]);

        $response->assertStatus(201);

        // Verify NO notification was queued for draft
        Queue::assertNotPushed(SendNotificationJob::class);
    }

    public function test_converting_draft_to_submitted_queues_notification(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true, 'capacity' => 20]);
        $camper = Camper::factory()->create([
            'user_id' => $parent->id,
            'first_name' => 'Alice',
            'last_name' => 'Smith',
            'date_of_birth' => '2010-01-01',
            'gender' => 'female',
            'tshirt_size' => 'Youth M',
            'county' => 'Richland',
        ]);

        \Tests\Support\TestApplicationFixture::buildCamperMinimum($camper);
        \Tests\Support\TestApplicationFixture::attachRequiredDocuments($camper);

        $application = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'signed_at' => now(),
            'signature_name' => 'Jane Smith',
            'sections_reviewed' => \Tests\Support\TestApplicationFixture::reviewedOptionalSections(),
        ]);
        \Tests\Support\TestApplicationFixture::attachConsents($application, 'Jane Smith');

        // Finalize via the correct endpoint
        $response = $this->actingAs($parent)->postJson("/api/applications/{$application->id}/finalize");

        $response->assertOk();

        Queue::assertPushed(SendNotificationJob::class, function ($job) {
            return $job->notification instanceof ApplicationSubmittedNotification;
        });
    }

    public function test_application_under_review_queues_status_changed_notification(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => 'submitted',
        ]);

        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'under_review',
            'notes' => null,
        ]);

        $response->assertStatus(200);

        Queue::assertPushed(SendNotificationJob::class, function ($job) {
            return $job->notification instanceof ApplicationStatusChangedNotification;
        });
    }

    public function test_approved_does_not_queue_status_changed_email_uses_letter_instead(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => 'submitted',
        ]);

        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'approved',
            'notes' => null,
            'override_incomplete' => true,
        ]);

        $response->assertStatus(200);

        // ApplicationStatusChangedNotification email must NOT be queued for approved.
        // The AcceptanceLetterNotification (self-queued via ShouldQueue) handles email.
        Queue::assertNotPushed(SendNotificationJob::class, function ($job) {
            return $job->notification instanceof ApplicationStatusChangedNotification;
        });
    }

    public function test_waitlisted_queues_waitlisted_notification(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => 'submitted',
        ]);

        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'waitlisted',
            'notes' => null,
        ]);

        $response->assertStatus(200);

        Queue::assertPushed(SendNotificationJob::class, function ($job) {
            return $job->notification instanceof WaitlistedNotification;
        });
    }

    public function test_waitlisted_does_not_queue_generic_status_changed_notification(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => 'submitted',
        ]);

        $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'waitlisted',
        ])->assertStatus(200);

        Queue::assertNotPushed(SendNotificationJob::class, function ($job) {
            return $job->notification instanceof ApplicationStatusChangedNotification;
        });
    }

    private function makeFinalizeReadyApplication(mixed $parent, mixed $session): Application
    {
        $camper = Camper::factory()->create([
            'user_id' => $parent->id,
            'first_name' => 'Alice',
            'last_name' => 'Smith',
            'date_of_birth' => '2010-01-01',
            'gender' => 'female',
            'tshirt_size' => 'Youth M',
            'county' => 'Richland',
        ]);

        \Tests\Support\TestApplicationFixture::buildCamperMinimum($camper);
        \Tests\Support\TestApplicationFixture::attachRequiredDocuments($camper);

        $application = Application::factory()->draft()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'signed_at' => now(),
            'signature_name' => 'Jane Smith',
            'sections_reviewed' => \Tests\Support\TestApplicationFixture::reviewedOptionalSections(),
        ]);
        \Tests\Support\TestApplicationFixture::attachConsents($application, 'Jane Smith');

        return $application;
    }

    public function test_notification_job_targets_correct_user(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true, 'capacity' => 20]);
        $application = $this->makeFinalizeReadyApplication($parent, $session);

        $this->actingAs($parent)->postJson("/api/applications/{$application->id}/finalize")->assertOk();

        // Verify job contains the correct notifiable user
        Queue::assertPushed(SendNotificationJob::class, function ($job) use ($parent) {
            return $job->notifiable->id === $parent->id;
        });
    }

    public function test_notification_job_uses_notifications_queue(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true, 'capacity' => 20]);
        $application = $this->makeFinalizeReadyApplication($parent, $session);

        $this->actingAs($parent)->postJson("/api/applications/{$application->id}/finalize")->assertOk();

        // Verify job is queued on 'notifications' queue
        Queue::assertPushedOn('notifications', SendNotificationJob::class);
    }

    public function test_multiple_application_submissions_queue_multiple_notifications(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true, 'capacity' => 20]);

        $app1 = $this->makeFinalizeReadyApplication($parent, $session);
        $app2 = $this->makeFinalizeReadyApplication($parent, $session);

        $this->actingAs($parent)->postJson("/api/applications/{$app1->id}/finalize")->assertOk();
        $this->actingAs($parent)->postJson("/api/applications/{$app2->id}/finalize")->assertOk();

        // Verify two notifications were queued
        Queue::assertPushed(SendNotificationJob::class, 2);
    }

    public function test_notification_job_has_retry_configuration(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['is_active' => true, 'capacity' => 20]);
        $application = $this->makeFinalizeReadyApplication($parent, $session);

        $this->actingAs($parent)->postJson("/api/applications/{$application->id}/finalize")->assertOk();

        // Verify job has retry settings
        Queue::assertPushed(SendNotificationJob::class, function ($job) {
            return $job->tries === 3 &&
                   $job->backoff === [60, 300, 900] &&
                   $job->maxExceptions === 3;
        });
    }
}
