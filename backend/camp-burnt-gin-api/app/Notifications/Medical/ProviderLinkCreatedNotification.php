<?php

namespace App\Notifications\Medical;

use App\Models\MedicalProviderLink;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * ProviderLinkCreatedNotification — the email sent to an external medical provider when a link is created.
 *
 * This is the primary delivery mechanism for the MedicalProviderLink system. When an admin creates
 * a provider link, this notification fires and sends an email to the provider's address containing
 * a clickable button with the secure access URL.
 *
 * Security note: This notification receives the PLAIN-TEXT token (not the hash). The plain token
 * is embedded in the URL so the provider can click through. The token is NOT stored in the database —
 * only its bcrypt hash is. Once this notification fires, the plain token is discarded from memory.
 *
 * Implements FR-19: Secure provider link notification.
 *
 * The link expires at a known time (shown in the email) and is single-use — once submitted,
 * the URL becomes invalid and the provider is told it has been used.
 *
 * Channel: mail only (the provider is external and has no in-app account).
 * Queue: uses Queueable so the email dispatches asynchronously.
 */
class ProviderLinkCreatedNotification extends Notification
{
    use Queueable;

    /**
     * Accept the link record (for metadata like camper name and expiry) and the plain-text token
     * (used once to build the access URL, then never referenced again).
     */
    public function __construct(
        protected MedicalProviderLink $link,
        // plainToken is passed separately because it's never stored on the model
        protected string $plainToken
    ) {}

    /**
     * Get the delivery channels for this notification.
     *
     * Mail only — the provider has no user account in this system.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Build the email sent to the medical provider.
     *
     * The plain token is embedded in the frontend URL so clicking the button
     * opens the provider form without requiring any login. The email clearly
     * states when the link expires and that it is single-use.
     */
    public function toMail(object $notifiable): MailMessage
    {
        // Combine the frontend base URL with the plain token to form the access link
        $accessUrl = config('app.frontend_url').'/provider-access/'.$this->plainToken;

        return (new MailMessage)
            ->subject('Medical Information Request - Camp Burnt Gin')
            ->greeting('Hello,')
            ->line('You have been requested to provide medical information for a camper at Camp Burnt Gin.')
            ->line('Camper: '.$this->link->camper->full_name)
            // The action button embeds the plain token in the URL — clicking it opens the form
            ->action('Complete Medical Form', $accessUrl)
            // Tell the provider exactly when the link stops working
            ->line('This link will expire on '.$this->link->expires_at->format('F j, Y \a\t g:i A').'.')
            ->line('This is a secure, single-use link. Once you submit the information, the link will no longer be valid.')
            ->salutation('Camp Burnt Gin');
    }
}
