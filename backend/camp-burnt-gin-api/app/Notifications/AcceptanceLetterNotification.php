<?php

namespace App\Notifications;

use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification for sending acceptance letters.
 *
 * Formal acceptance letter sent when an application is approved.
 * Implements FR-18: Digital acceptance letters.
 */
class AcceptanceLetterNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected Application $application
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
        $session = $this->application->campSession;
        $camp = $session->camp;

        return (new MailMessage)
            ->subject('Congratulations! Application Accepted - '.$camp->name)
            ->greeting('Dear '.$notifiable->name.',')
            ->line('We are delighted to inform you that the application for '.$this->application->camper->full_name.' has been accepted!')
            ->line('')
            ->line('**Camp Details:**')
            ->line('Camp: '.$camp->name)
            ->line('Session: '.$session->name)
            ->line('Dates: '.$session->start_date->format('F j').' - '.$session->end_date->format('F j, Y'))
            ->line('Location: '.$camp->location)
            ->line('')
            ->line('Please review the camp information and ensure all required forms are completed before the session begins.')
            ->action('View Application Details', config('app.frontend_url').'/applications/'.$this->application->id)
            ->line('')
            ->line('We look forward to seeing '.$this->application->camper->first_name.' at camp!')
            ->salutation('Warm regards,'."\n".'Camp Burnt Gin');
    }
}
