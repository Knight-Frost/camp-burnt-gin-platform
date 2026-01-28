<?php

namespace App\Notifications;

use App\Models\MedicalProviderLink;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification sent when a provider link expires.
 *
 * Notifies the parent/guardian that their provider link has expired.
 * Implements FR-23: Link expiration notification.
 */
class ProviderLinkExpiredNotification extends Notification
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
        return ['mail', 'database'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Medical Provider Link Expired - Camp Burnt Gin')
            ->greeting('Hello ' . $notifiable->name . ',')
            ->line('The medical provider link for ' . $this->link->camper->full_name . ' has expired.')
            ->line('Provider: ' . ($this->link->provider_name ?? $this->link->provider_email))
            ->line('The medical provider did not complete the form before the expiration date.')
            ->line('You can send a new link to your provider from your account.')
            ->action('Send New Link', config('app.frontend_url') . '/provider-links/new?camper=' . $this->link->camper_id)
            ->salutation('Camp Burnt Gin');
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'provider_link_expired',
            'camper_id' => $this->link->camper_id,
            'camper_name' => $this->link->camper->full_name,
            'provider_email' => $this->link->provider_email,
            'expired_at' => $this->link->expires_at->toIso8601String(),
        ];
    }
}
