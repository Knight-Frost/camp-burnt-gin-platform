<?php

namespace App\Notifications\Medical;

use App\Models\MedicalIncident;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification dispatched when a critical or severe medical incident is logged.
 *
 * HIPAA Compliance: NO PHI in the notification body or email. The notification
 * tells supervisors that an incident exists and directs them to log in — the
 * full clinical details are only accessible after authentication.
 *
 * Channels:
 *  - database: immediate in-app bell notification
 *  - mail:     queued email (no PHI — login prompt only)
 */
class CriticalIncidentLoggedNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected MedicalIncident $incident
    ) {}

    public function via(object $notifiable): array
    {
        // Respect the user's notification preferences if set.
        $prefs = $notifiable->notification_preferences ?? [];

        $channels = ['database'];

        // Only send email if the user has enabled medical_alerts emails (or has no preference set = default on).
        $emailEnabled = $prefs['medical_alerts_email'] ?? true;
        if ($emailEnabled && $notifiable->email) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    /** In-app database notification payload. */
    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => 'medical_incident_critical',
            'title' => 'Critical Incident Logged',
            'message' => 'A '.$this->incident->severity.' medical incident has been recorded. Review in the medical portal.',
            'incident_id' => $this->incident->id,
            'severity' => $this->incident->severity,
            'incident_type' => $this->incident->type,
            'recorded_at' => $this->incident->created_at?->toIso8601String(),
            'url' => '/medical/incidents',
        ];
    }

    /**
     * Email notification — NO PHI in subject or body per HIPAA constraint.
     * Email is a prompt to log in, not a clinical summary.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Camp Burnt Gin — Medical Alert Requires Attention')
            ->greeting('Hello, '.$notifiable->name.',')
            ->line('A medical incident requiring your attention has been logged in the Camp Burnt Gin system.')
            ->line('For the safety and privacy of our campers, incident details are only available after logging in.')
            ->action('View in Medical Portal', url('/medical/incidents'))
            ->line('If you did not expect this notification, please contact your administrator.')
            ->salutation('Camp Burnt Gin Medical Team');
    }
}
