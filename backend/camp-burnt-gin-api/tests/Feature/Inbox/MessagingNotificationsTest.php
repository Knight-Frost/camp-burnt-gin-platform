<?php

namespace Tests\Feature\Inbox;

use App\Jobs\SendNotificationJob;
use App\Models\Conversation;
use App\Models\Role;
use App\Models\User;
use App\Notifications\NewConversationNotification;
use App\Notifications\NewMessageNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Tests that the messaging notification pipeline fires correctly:
 *  - In-app bell (database channel) written immediately via notifyNow()
 *  - External email queued via SendNotificationJob on the notifications queue
 *  - Notification preferences gate the email path but never the database path
 *  - Split-channel factories produce the correct channel overrides
 */
class MessagingNotificationsTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $parent;
    protected Conversation $conversation;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::firstOrCreate(['name' => 'admin'], ['description' => 'Administrator']);
        $parentRole = Role::firstOrCreate(['name' => 'applicant'], ['description' => 'Parent/Guardian']);

        $this->admin = User::factory()->create(['role_id' => $adminRole->id, 'mfa_enabled' => true]);
        $this->parent = User::factory()->create(['role_id' => $parentRole->id]);

        $this->conversation = Conversation::factory()->create([
            'created_by_id' => $this->admin->id,
        ]);

        $this->conversation->participantRecords()->createMany([
            ['user_id' => $this->admin->id, 'joined_at' => now()],
            ['user_id' => $this->parent->id, 'joined_at' => now()],
        ]);
    }

    // ─── New Message: Email Queuing ───────────────────────────────────────────

    #[Test]
    public function sending_a_message_queues_email_notification_for_recipient(): void
    {
        Queue::fake();
        Sanctum::actingAs($this->admin);

        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            ['body' => 'Hello from admin']
        )->assertStatus(201);

        Queue::assertPushedOn('notifications', SendNotificationJob::class, function ($job) {
            return $job->notifiable->id === $this->parent->id
                && $job->notification instanceof NewMessageNotification;
        });
    }

    #[Test]
    public function sender_does_not_receive_email_notification_for_own_message(): void
    {
        Queue::fake();
        Sanctum::actingAs($this->admin);

        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            ['body' => 'My own message']
        )->assertStatus(201);

        Queue::assertNotPushed(SendNotificationJob::class, function ($job) {
            return $job->notifiable->id === $this->admin->id;
        });
    }

    #[Test]
    public function new_message_email_job_targets_notifications_queue(): void
    {
        Queue::fake();
        Sanctum::actingAs($this->parent);

        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            ['body' => 'Hello from parent']
        )->assertStatus(201);

        Queue::assertPushedOn('notifications', SendNotificationJob::class);
    }

    // ─── New Message: Database Notification (Bell) ───────────────────────────

    #[Test]
    public function sending_a_message_writes_database_notification_immediately(): void
    {
        Queue::fake();
        Sanctum::actingAs($this->admin);

        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            ['body' => 'Sync bell test']
        )->assertStatus(201);

        $this->assertDatabaseHas('notifications', [
            'notifiable_type' => User::class,
            'notifiable_id' => $this->parent->id,
            'type' => NewMessageNotification::class,
        ]);
    }

    #[Test]
    public function database_notification_is_written_even_when_queue_is_down(): void
    {
        // Simulate no queue worker by using Queue::fake() — jobs are captured, not executed.
        // The database notification must still be written because notifyNow() is synchronous.
        Queue::fake();
        Sanctum::actingAs($this->admin);

        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            ['body' => 'Should appear in bell immediately']
        )->assertStatus(201);

        // In-app bell notification is in the database right now
        $this->assertDatabaseHas('notifications', [
            'notifiable_type' => User::class,
            'notifiable_id' => $this->parent->id,
            'type' => NewMessageNotification::class,
        ]);

        // Email job is queued — not yet sent, waiting for worker
        Queue::assertPushed(SendNotificationJob::class, function ($job) {
            return $job->notification instanceof NewMessageNotification;
        });
    }

    // ─── New Message: Notification Preferences ───────────────────────────────

    #[Test]
    public function email_not_queued_when_recipient_has_messages_preference_disabled(): void
    {
        Queue::fake();

        $this->parent->update([
            'notification_preferences' => ['messages' => false],
        ]);

        Sanctum::actingAs($this->admin);

        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            ['body' => 'Quiet notification test']
        )->assertStatus(201);

        Queue::assertNotPushed(SendNotificationJob::class, function ($job) {
            return $job->notifiable->id === $this->parent->id
                && $job->notification instanceof NewMessageNotification;
        });
    }

    #[Test]
    public function database_notification_is_always_written_regardless_of_preference(): void
    {
        Queue::fake();

        $this->parent->update([
            'notification_preferences' => ['messages' => false],
        ]);

        Sanctum::actingAs($this->admin);

        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            ['body' => 'Bell should still work']
        )->assertStatus(201);

        // Database notification is unconditional — preference only gates email
        $this->assertDatabaseHas('notifications', [
            'notifiable_type' => User::class,
            'notifiable_id' => $this->parent->id,
            'type' => NewMessageNotification::class,
        ]);
    }

    #[Test]
    public function email_is_queued_when_messages_preference_is_explicitly_true(): void
    {
        Queue::fake();

        $this->parent->update([
            'notification_preferences' => ['messages' => true],
        ]);

        Sanctum::actingAs($this->admin);

        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            ['body' => 'Explicit opt-in test']
        )->assertStatus(201);

        Queue::assertPushed(SendNotificationJob::class, function ($job) {
            return $job->notifiable->id === $this->parent->id
                && $job->notification instanceof NewMessageNotification;
        });
    }

    // ─── New Message: Factory Channel Overrides ───────────────────────────────

    #[Test]
    public function for_database_factory_returns_database_only_channels(): void
    {
        $conv = $this->conversation;
        $message = \App\Models\Message::factory()->create([
            'conversation_id' => $conv->id,
            'sender_id' => $this->admin->id,
        ]);

        $notification = NewMessageNotification::forDatabase($message, $conv);

        $this->assertSame(['database'], $notification->via($this->parent));
    }

    #[Test]
    public function for_mail_factory_returns_mail_only_channels(): void
    {
        $conv = $this->conversation;
        $message = \App\Models\Message::factory()->create([
            'conversation_id' => $conv->id,
            'sender_id' => $this->admin->id,
        ]);

        $notification = NewMessageNotification::forMail($message, $conv);

        $this->assertSame(['mail'], $notification->via($this->parent));
    }

    // ─── New Conversation: Email Queuing ─────────────────────────────────────

    #[Test]
    public function creating_a_conversation_queues_email_notification_for_participants(): void
    {
        Queue::fake();
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/inbox/conversations', [
            'subject' => 'New Conversation Test',
            'participant_ids' => [$this->parent->id],
            'category' => 'general',
        ])->assertStatus(201);

        Queue::assertPushedOn('notifications', SendNotificationJob::class, function ($job) {
            return $job->notifiable->id === $this->parent->id
                && $job->notification instanceof NewConversationNotification;
        });
    }

    #[Test]
    public function creating_a_conversation_does_not_email_the_creator(): void
    {
        Queue::fake();
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/inbox/conversations', [
            'subject' => 'Creator should not be emailed',
            'participant_ids' => [$this->parent->id],
            'category' => 'general',
        ])->assertStatus(201);

        Queue::assertNotPushed(SendNotificationJob::class, function ($job) {
            return $job->notifiable->id === $this->admin->id;
        });
    }

    // ─── New Conversation: Database Notification (Bell) ──────────────────────

    #[Test]
    public function creating_a_conversation_writes_database_notification_immediately(): void
    {
        Queue::fake();
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/inbox/conversations', [
            'subject' => 'Instant bell test',
            'participant_ids' => [$this->parent->id],
            'category' => 'general',
        ])->assertStatus(201);

        // Bell notification must be in the DB immediately — not waiting for the queue
        $this->assertDatabaseHas('notifications', [
            'notifiable_type' => User::class,
            'notifiable_id' => $this->parent->id,
            'type' => NewConversationNotification::class,
        ]);
    }

    // ─── New Conversation: Notification Preferences ──────────────────────────

    #[Test]
    public function new_conversation_email_not_queued_when_preference_disabled(): void
    {
        Queue::fake();

        $this->parent->update([
            'notification_preferences' => ['messages' => false],
        ]);

        Sanctum::actingAs($this->admin);

        $this->postJson('/api/inbox/conversations', [
            'subject' => 'Quiet conversation',
            'participant_ids' => [$this->parent->id],
            'category' => 'general',
        ])->assertStatus(201);

        Queue::assertNotPushed(SendNotificationJob::class, function ($job) {
            return $job->notifiable->id === $this->parent->id
                && $job->notification instanceof NewConversationNotification;
        });
    }

    #[Test]
    public function new_conversation_database_notification_written_even_when_email_disabled(): void
    {
        Queue::fake();

        $this->parent->update([
            'notification_preferences' => ['messages' => false],
        ]);

        Sanctum::actingAs($this->admin);

        $this->postJson('/api/inbox/conversations', [
            'subject' => 'Bell despite no email',
            'participant_ids' => [$this->parent->id],
            'category' => 'general',
        ])->assertStatus(201);

        $this->assertDatabaseHas('notifications', [
            'notifiable_type' => User::class,
            'notifiable_id' => $this->parent->id,
            'type' => NewConversationNotification::class,
        ]);
    }

    // ─── New Conversation: Factory Channel Overrides ──────────────────────────

    #[Test]
    public function new_conversation_for_database_factory_returns_database_only(): void
    {
        $notification = NewConversationNotification::forDatabase($this->conversation);

        $this->assertSame(['database'], $notification->via($this->parent));
    }

    #[Test]
    public function new_conversation_for_mail_factory_returns_mail_only(): void
    {
        $notification = NewConversationNotification::forMail($this->conversation);

        $this->assertSame(['mail'], $notification->via($this->parent));
    }

    // ─── Idempotency: No Duplicate Notifications ─────────────────────────────

    #[Test]
    public function duplicate_message_via_same_idempotency_key_does_not_send_second_notification(): void
    {
        Queue::fake();
        Sanctum::actingAs($this->admin);
        $key = 'test-idempotency-key-123';

        // First send — should queue notification
        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            ['body' => 'First send', 'idempotency_key' => $key]
        )->assertStatus(201);

        // Second send with same key — should return existing message, no new notification
        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            ['body' => 'Duplicate send', 'idempotency_key' => $key]
        )->assertStatus(201);

        // Only one notification job should have been queued
        Queue::assertPushed(SendNotificationJob::class, 1);
    }

    // ─── Multi-Participant: All Recipients Notified ───────────────────────────

    #[Test]
    public function message_notifies_all_participants_except_sender(): void
    {
        Queue::fake();

        $secondParent = User::factory()->create([
            'role_id' => Role::where('name', 'applicant')->first()->id,
        ]);
        $this->conversation->participantRecords()->create([
            'user_id' => $secondParent->id,
            'joined_at' => now(),
        ]);

        Sanctum::actingAs($this->admin);

        $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            ['body' => 'Multi-recipient test']
        )->assertStatus(201);

        Queue::assertPushed(SendNotificationJob::class, 2);

        Queue::assertPushed(SendNotificationJob::class, function ($job) {
            return $job->notifiable->id === $this->parent->id;
        });

        Queue::assertPushed(SendNotificationJob::class, function ($job) use ($secondParent) {
            return $job->notifiable->id === $secondParent->id;
        });
    }
}
