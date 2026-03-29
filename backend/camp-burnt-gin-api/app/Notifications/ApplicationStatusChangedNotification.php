<?php

namespace App\Notifications;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification sent when an application status changes.
 *
 * Notifies the parent of application status updates.
 * Implements FR-28: Status change notifications.
 */
class ApplicationStatusChangedNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected Application $application,
        protected string $previousStatus
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
        $message = (new MailMessage)
            ->greeting('Hello '.$notifiable->name.',');

        if ($this->application->status === ApplicationStatus::Approved) {
            $message->subject('Application Approved! - Camp Burnt Gin')
                ->line('Great news! Your application has been approved.')
                ->line('Camper: '.$this->application->camper->full_name)
                ->line('Camp Session: '.$this->application->campSession->name)
                ->line('Session Dates: '.$this->application->campSession->start_date->format('F j').' - '.$this->application->campSession->end_date->format('F j, Y'))
                ->line('We look forward to seeing '.$this->application->camper->first_name.' at camp!');
        } elseif ($this->application->status === ApplicationStatus::Rejected) {
            $message->subject('Application Update - Camp Burnt Gin')
                ->line('We regret to inform you that your application was not approved at this time.')
                ->line('Camper: '.$this->application->camper->full_name)
                ->line('Camp Session: '.$this->application->campSession->name);

            if ($this->application->notes) {
                $message->line('Notes: '.$this->application->notes);
            }

            $message->line('If you have any questions, please contact us.');
        } else {
            $message->subject('Application Status Update - Camp Burnt Gin')
                ->line('Your application status has been updated.')
                ->line('Camper: '.$this->application->camper->full_name)
                ->line('New Status: '.$this->application->status->label());
        }

        return $message
            ->action('View Application', config('app.frontend_url').'/applications/'.$this->application->id)
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
            'type' => 'application_status_changed',
            'application_id' => $this->application->id,
            'camper_name' => $this->application->camper->full_name,
            'camp_session' => $this->application->campSession->name,
            'previous_status' => $this->previousStatus,
            'new_status' => $this->application->status->value,
            'changed_at' => now()->toIso8601String(),
        ];
    }
}
