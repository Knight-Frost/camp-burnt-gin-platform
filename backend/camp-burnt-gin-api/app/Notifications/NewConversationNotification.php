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
 */
class NewConversationNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected Conversation $conversation
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
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
            ->greeting('Hello ' . $notifiable->name . ',')
            ->line('You have been added to a new conversation.')
            ->line('Subject: ' . $this->conversation->subject)
            ->line('Please log in to view the full conversation and respond.')
            ->action('View Conversation', config('app.frontend_url') . '/inbox/conversations/' . $this->conversation->id)
            ->salutation('Camp Burnt Gin');
    }

    /**
     * Get the array representation of the notification.
     *
     * Stored in database notifications table for in-app display.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'new_conversation',
            'conversation_id' => $this->conversation->id,
            'conversation_subject' => $this->conversation->subject,
            'created_by' => $this->conversation->creator->name,
            'created_at' => $this->conversation->created_at->toIso8601String(),
        ];
    }
}
