<?php

namespace App\Notifications\Medical;

use App\Models\MedicalProviderLink;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * ProviderLinkRevokedNotification — notifies the parent/guardian when their provider link is revoked.
 *
 * When an admin revokes a MedicalProviderLink, the applicant (parent) who owns that camper's
 * application should be informed so they know the link is no longer active and can take action
 * (e.g., request a new link if still needed).
 *
 * This notification is NOT sent to the provider — it goes to the applicant who submitted
 * the application. The provider is silently blocked from the URL instead.
 *
 * Implements FR-24: Link revocation notification.
 *
 * Channels:
 *   - mail: formal notification by email
 *   - database: in-app notification so the parent sees it in their notification bell
 *
 * Queue: uses Queueable so neither channel blocks the admin's revoke action.
 */
class ProviderLinkRevokedNotification extends Notification
{
    use Queueable;

    /**
     * Accept the revoked link so its camper and provider details can be included in the message.
     */
    public function __construct(
        protected MedicalProviderLink $link
    ) {}

    /**
     * Get the delivery channels for this notification.
     *
     * Both "mail" and "database" — the parent gets an email AND an in-app alert.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    /**
     * Build the email sent to the applicant informing them of the revocation.
     *
     * Includes the camper name and provider identity so the parent understands which
     * link was revoked. Provides a link to manage their provider links if needed.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Medical Provider Link Revoked - Camp Burnt Gin')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('The medical provider link for '.$this->link->camper->full_name.' has been revoked.')
            // Show provider name if available, fall back to email address
            ->line('Provider: '.($this->link->provider_name ?? $this->link->provider_email))
            ->line('If you need to send a new link to your medical provider, you can do so from your account.')
            // Link to the provider links management page on the frontend
            ->action('Manage Provider Links', config('app.frontend_url').'/provider-links')
            ->salutation('Camp Burnt Gin');
    }

    /**
     * Build the in-app (database) notification payload.
     *
     * This data is stored in the notifications table and retrieved by the
     * NotificationController to display in the notification bell on the dashboard.
     * The "type" field is used by the frontend to determine which icon/colour to show.
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
            // ISO 8601 format so the frontend can parse and display "revoked 2 hours ago"
            'revoked_at' => $this->link->revoked_at->toIso8601String(),
        ];
    }
}
