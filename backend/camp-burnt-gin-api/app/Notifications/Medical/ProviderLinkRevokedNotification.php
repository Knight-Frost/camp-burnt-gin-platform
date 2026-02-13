<?php

namespace App\Notifications\Medical;

use App\Models\MedicalProviderLink;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification sent when a provider link is revoked.
 *
 * Notifies the parent/guardian that their provider link has been revoked.
 * Implements FR-24: Link revocation notification.
 */
class ProviderLinkRevokedNotification extends Notification
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
            ->subject('Medical Provider Link Revoked - Camp Burnt Gin')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('The medical provider link for '.$this->link->camper->full_name.' has been revoked.')
            ->line('Provider: '.($this->link->provider_name ?? $this->link->provider_email))
            ->line('If you need to send a new link to your medical provider, you can do so from your account.')
            ->action('Manage Provider Links', config('app.frontend_url').'/provider-links')
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
            'type' => 'provider_link_revoked',
            'camper_id' => $this->link->camper_id,
            'camper_name' => $this->link->camper->full_name,
            'provider_email' => $this->link->provider_email,
            'revoked_at' => $this->link->revoked_at->toIso8601String(),
        ];
    }
}
