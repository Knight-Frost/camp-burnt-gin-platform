<?php

namespace App\Notifications;

use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification sent when a new message is received in a conversation.
 *
 * Alerts participants of new messages without exposing PHI in email content.
 * Message body and attachments are only accessible in-app after authentication.
 *
 * HIPAA Compliance: No PHI in email body.
 */
class NewMessageNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected Message $message,
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
     * IMPORTANT: No PHI or message content is included in the email.
     * Users must log in to view the actual message.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $mailMessage = (new MailMessage)
            ->subject('New Message - Camp Burnt Gin')
            ->greeting('Hello ' . $notifiable->name . ',')
            ->line('You have received a new message in a conversation.')
            ->line('Conversation: ' . $this->conversation->subject)
            ->line('From: ' . $this->message->sender->name);

        if ($this->message->hasAttachments()) {
            $attachmentCount = $this->message->attachmentCount();
            $mailMessage->line("This message includes {$attachmentCount} attachment(s).");
        }

        $mailMessage->line('Please log in to view the full message and respond.')
            ->action('View Message', config('app.frontend_url') . '/inbox/conversations/' . $this->conversation->id)
            ->salutation('Camp Burnt Gin');

        return $mailMessage;
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
            'type' => 'new_message',
            'message_id' => $this->message->id,
            'conversation_id' => $this->conversation->id,
            'conversation_subject' => $this->conversation->subject,
            'sender_name' => $this->message->sender->name,
            'sender_id' => $this->message->sender->id,
            'has_attachments' => $this->message->hasAttachments(),
            'attachment_count' => $this->message->attachmentCount(),
            'created_at' => $this->message->created_at->toIso8601String(),
        ];
    }
}
