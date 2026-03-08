<?php

namespace App\Notifications\Medical;

use App\Models\MedicalProviderLink;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * ProviderSubmissionReceivedNotification — confirms that a medical provider has completed their form.
 *
 * After an external provider submits medical information via their provider link, this notification
 * fires to inform the relevant parents and administrators that the data has been received and is
 * now available in the camper's medical record.
 *
 * Implements FR-23: Provider submission notification.
 *
 * Who receives this notification?
 *   - The applicant (parent) who owns the camper: so they know the provider completed the task
 *   - Admin users: so medical staff can review the new data promptly
 *
 * Channels:
 *   - mail: formal confirmation email
 *   - database: in-app alert visible in the notification bell on the dashboard
 *
 * Queue: uses Queueable so this does not block the provider's form submission response.
 */
class ProviderSubmissionReceivedNotification extends Notification
{
    use Queueable;

    /**
     * Accept the link record which contains the camper, provider, and submission timestamp.
     */
    public function __construct(
        protected MedicalProviderLink $link
    ) {}

    /**
     * Get the delivery channels for this notification.
     *
     * Both "mail" and "database" so the recipient gets an email AND an in-app notification.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    /**
     * Build the email confirming the provider's submission.
     *
     * Tells the recipient who submitted the form, for which camper, and when.
     * Includes a direct link to the camper's medical record for immediate review.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Medical Information Received - Camp Burnt Gin')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('Medical information has been submitted for '.$this->link->camper->full_name.'.')
            // Show provider name if recorded, fall back to email address
            ->line('Provider: '.($this->link->provider_name ?? $this->link->provider_email))
            // Format the submission timestamp for easy reading
            ->line('Submitted: '.$this->link->submitted_at->format('F j, Y \a\t g:i A'))
            // Deep link to the camper's medical record so reviewers can act immediately
            ->action('View Medical Record', config('app.frontend_url').'/campers/'.$this->link->camper_id.'/medical')
            ->salutation('Camp Burnt Gin');
    }

    /**
     * Build the in-app (database) notification payload.
     *
     * Stored in the notifications table and displayed in the notification bell.
     * The "type" key is used by the frontend to select the right icon and colour.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type'           => 'provider_submission_received',
            'camper_id'      => $this->link->camper_id,
            'camper_name'    => $this->link->camper->full_name,
            'provider_email' => $this->link->provider_email,
            // ISO 8601 format so the frontend can render "submitted 3 hours ago"
            'submitted_at'   => $this->link->submitted_at->toIso8601String(),
        ];
    }
}
