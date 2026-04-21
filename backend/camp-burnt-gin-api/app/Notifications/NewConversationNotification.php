<?php

namespace App\Notifications;

use App\Models\Conversation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification sent when a user is added to a new conversation.
 *
 * Notifies participants of new conversation creation without exposing
 * PHI in email content. All sensitive content remains in-app only.
 *
 * HIPAA Compliance: No PHI in email body.
 *
 * Channel strategy (mirrors NewMessageNotification):
 *   - Database (in-app bell): sent synchronously via notifyNow() in InboxService
 *     so the notification appears immediately without requiring a queue worker.
 *   - Email: queued via SendNotificationJob so mail failures cannot delay the
 *     HTTP response or roll back the conversation transaction.
 *
 * Use the static factories:
 *   - NewConversationNotification::forDatabase($conv) → ['database'] only, not Queueable
 *   - NewConversationNotification::forMail($conv)     → ['mail'] only, Queueable
 */
class NewConversationNotification extends Notification
{
    use Queueable;

    /** @var array<int, string>|null When set, overrides the via() logic. */
    private ?array $channelsOverride = null;

    public function __construct(
        protected Conversation $conversation
    ) {}

    /**
     * Returns a database-only instance for synchronous in-app notification.
     * The Queueable trait is present but unused — callers should use notifyNow().
     */
    public static function forDatabase(Conversation $conversation): self
    {
        $instance = new self($conversation);
        $instance->channelsOverride = ['database'];

        return $instance;
    }

    /**
     * Returns a mail-only instance intended for queued delivery via SendNotificationJob.
     * Gating on notification_preferences is handled in InboxService before dispatch.
     */
    public static function forMail(Conversation $conversation): self
    {
        $instance = new self($conversation);
        $instance->channelsOverride = ['mail'];

        return $instance;
    }

    /**
     * Get the notification's delivery channels.
     *
     * When channelsOverride is set (via forDatabase/forMail factories), returns
     * exactly those channels. Otherwise falls back to prefs-based logic for
     * any direct callers that don't use the factory pattern.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if ($this->channelsOverride !== null) {
            return $this->channelsOverride;
        }

        $prefs = $notifiable->notification_preferences ?? [];
        $emailEnabled = $prefs['messages'] ?? true;

        return $emailEnabled ? ['mail', 'database'] : ['database'];
    }

    /**
     * Get the mail representation of the notification.
     *
     * IMPORTANT: No PHI is included in the email. Users must log in
     * to view full conversation details.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('New Conversation - Camp Burnt Gin')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('You have been added to a new conversation.')
            ->line('Subject: '.$this->conversation->subject)
            ->line('Please log in to view the full conversation and respond.')
            ->action('View Conversation', $this->inboxUrl($notifiable, $this->conversation->id))
            ->salutation('Camp Burnt Gin');
    }

    /**
     * Builds the correct portal inbox URL for the given user's role.
     * Uses ?conversationId= so the inbox auto-selects the conversation on load.
     */
    private function inboxUrl(object $notifiable, int $conversationId): string
    {
        $prefix = match (true) {
            $notifiable->isSuperAdmin() => 'super-admin',
            $notifiable->isAdmin() => 'admin',
            $notifiable->isMedicalProvider() => 'medical',
            default => 'applicant',
        };

        return config('app.frontend_url')."/{$prefix}/inbox?conversationId={$conversationId}";
    }

    /**
     * Get the array representation of the notification.
     *
     * Stored in database notifications table for in-app display.
     * The title and message fields are used by the Recent Updates widget.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $subject = $this->conversation->subject;
        $createdBy = $this->conversation->creator?->name ?? 'Camp Staff';

        return [
            'type' => 'new_conversation',
            'title' => "New conversation: {$subject}",
            'message' => "{$createdBy} has started a conversation with you: \"{$subject}\".",
            'conversation_id' => $this->conversation->id,
            'conversation_subject' => $subject,
            'created_by' => $createdBy,
            'created_at' => $this->conversation->created_at->toIso8601String(),
        ];
    }
}
