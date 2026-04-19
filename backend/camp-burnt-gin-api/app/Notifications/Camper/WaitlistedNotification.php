<?php

namespace App\Notifications\Camper;

use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification sent when an application is placed on the waitlist.
 *
 * Informs the parent clearly that the session is full, their application has
 * been saved to the waitlist, and that they will be contacted if a spot opens.
 * A generic ApplicationStatusChangedNotification would not explain the waitlist
 * process — this class provides that context.
 *
 * Channel: mail + database, gated by application_updates preference.
 * Dispatch: via SendNotificationJob (QueuesNotifications trait in ApplicationService).
 * HIPAA: no PHI. Camper name and session name are not PHI.
 */
class WaitlistedNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected Application $application
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        $prefs = $notifiable->notification_preferences ?? [];
        $emailEnabled = $prefs['application_updates'] ?? true;

        return $emailEnabled ? ['mail', 'database'] : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $session = $this->application->campSession;

        return (new MailMessage)
            ->subject('Application Waitlisted — Camp Burnt Gin')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('Thank you for applying to Camp Burnt Gin.')
            ->line('The **'.$session->name.'** session is currently full. Your application for **'.$this->application->camper->full_name.'** has been placed on the waitlist.')
            ->line('**What happens next:**')
            ->line('If a spot becomes available, our staff will contact you as soon as possible. Please ensure your contact information is up to date.')
            ->line('You do not need to take any action at this time. Your place on the waitlist is held automatically.')
            ->action('View Application', config('app.frontend_url').'/applicant/applications/'.$this->application->id)
            ->line('If you have any questions, please contact us directly.')
            ->salutation('Camp Burnt Gin');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'application_waitlisted',
            'title' => 'Application waitlisted — '.$this->application->camper->full_name,
            'message' => 'The application for '.$this->application->camper->full_name.' has been placed on the waitlist for '.$this->application->campSession->name.'. We will be in touch if a spot opens.',
            'application_id' => $this->application->id,
            'camper_name' => $this->application->camper->full_name,
            'camp_session' => $this->application->campSession->name,
            'waitlisted_at' => now()->toIso8601String(),
        ];
    }
}
