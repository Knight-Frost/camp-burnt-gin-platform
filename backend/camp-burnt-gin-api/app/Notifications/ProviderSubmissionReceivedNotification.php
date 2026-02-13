<?php

namespace App\Notifications;

use App\Models\MedicalProviderLink;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification sent when a provider submits medical information.
 *
 * Notifies parents and administrators of the submission.
 * Implements FR-23: Provider submission notification.
 */
class ProviderSubmissionReceivedNotification extends Notification
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
            ->subject('Medical Information Received - Camp Burnt Gin')
            ->greeting('Hello ' . $notifiable->name . ',')
            ->line('Medical information has been submitted for ' . $this->link->camper->full_name . '.')
            ->line('Provider: ' . ($this->link->provider_name ?? $this->link->provider_email))
            ->line('Submitted: ' . $this->link->submitted_at->format('F j, Y \a\t g:i A'))
            ->action('View Medical Record', config('app.frontend_url') . '/campers/' . $this->link->camper_id . '/medical')
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
            'type' => 'provider_submission_received',
            'camper_id' => $this->link->camper_id,
            'camper_name' => $this->link->camper->full_name,
            'provider_email' => $this->link->provider_email,
            'submitted_at' => $this->link->submitted_at->toIso8601String(),
        ];
    }
}
