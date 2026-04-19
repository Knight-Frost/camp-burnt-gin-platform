<?php

namespace App\Notifications\Medical;

use App\Models\MedicalFollowUp;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification sent when a medical follow-up task is due or overdue.
 *
 * HIPAA Compliance: No PHI in email body. Follow-up details only accessible in-app.
 */
class MedicalFollowUpDueNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected MedicalFollowUp $followUp
    ) {}

    public function via(object $notifiable): array
    {
        $prefs = $notifiable->notification_preferences ?? [];
        $channels = ['database'];

        $emailEnabled = $prefs['medical_alerts_email'] ?? true;
        if ($emailEnabled && $notifiable->email) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toDatabase(object $notifiable): array
    {
        $isOverdue = $this->followUp->isOverdue();

        return [
            'type' => 'medical_follow_up_due',
            'title' => $isOverdue ? 'Overdue Follow-Up Task' : 'Follow-Up Task Due Today',
            'message' => $isOverdue
                ? 'A medical follow-up task is overdue. Please review in the medical portal.'
                : 'A medical follow-up task is due today.',
            'follow_up_id' => $this->followUp->id,
            'priority' => $this->followUp->priority,
            'due_date' => $this->followUp->due_date,
            'url' => '/medical/follow-ups',
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $isOverdue = $this->followUp->isOverdue();

        return (new MailMessage)
            ->subject($isOverdue
                ? 'Camp Burnt Gin — Overdue Medical Follow-Up'
                : 'Camp Burnt Gin — Medical Follow-Up Due Today')
            ->greeting('Hello, '.$notifiable->name.',')
            ->line($isOverdue
                ? 'A medical follow-up task assigned to you is past its due date.'
                : 'A medical follow-up task assigned to you is due today.')
            ->line('For the safety of our campers, details are only accessible after logging in.')
            ->action('Review Follow-Up Tasks', url('/medical/follow-ups'))
            ->salutation('Camp Burnt Gin Medical Team');
    }
}
