<?php

namespace App\Notifications;

use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification for sending rejection letters.
 *
 * Formal rejection letter sent when an application is not approved.
 * Implements FR-18: Digital rejection letters.
 */
class RejectionLetterNotification extends Notification
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

        $message = (new MailMessage)
            ->subject('Application Update - ' . $camp->name)
            ->greeting('Dear ' . $notifiable->name . ',')
            ->line('Thank you for your interest in ' . $camp->name . '.')
            ->line('')
            ->line('After careful review, we regret to inform you that we are unable to accept the application for ' . $this->application->camper->full_name . ' for the ' . $session->name . ' session at this time.');

        if ($this->application->notes) {
            $message->line('')
                ->line('**Additional Information:**')
                ->line($this->application->notes);
        }

        return $message
            ->line('')
            ->line('We encourage you to apply for future camp sessions. If you have any questions, please do not hesitate to contact us.')
            ->action('View Other Sessions', config('app.frontend_url') . '/sessions')
            ->line('')
            ->line('Thank you for your understanding.')
            ->salutation('Sincerely,' . "\n" . 'Camp Burnt Gin');
    }
}
