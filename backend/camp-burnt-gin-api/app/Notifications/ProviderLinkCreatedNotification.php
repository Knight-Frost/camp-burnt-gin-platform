<?php

namespace App\Notifications;

use App\Models\MedicalProviderLink;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification sent to medical providers when a link is created.
 *
 * Contains the secure access URL for completing medical information.
 * Implements FR-19: Secure provider link notification.
 */
class ProviderLinkCreatedNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected MedicalProviderLink $link
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $accessUrl = config('app.frontend_url') . '/provider-access/' . $this->link->token;

        return (new MailMessage)
            ->subject('Medical Information Request - Camp Burnt Gin')
            ->greeting('Hello,')
            ->line('You have been requested to provide medical information for a camper at Camp Burnt Gin.')
            ->line('Camper: ' . $this->link->camper->full_name)
            ->action('Complete Medical Form', $accessUrl)
            ->line('This link will expire on ' . $this->link->expires_at->format('F j, Y \a\t g:i A') . '.')
            ->line('This is a secure, single-use link. Once you submit the information, the link will no longer be valid.')
            ->salutation('Camp Burnt Gin');
    }
}
