<?php

namespace App\Notifications;

use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the parent/guardian when the system reverts their application
 * from submitted back to draft because the completeness engine found
 * issues post-submission (e.g. medical exam form expired, section fields
 * no longer meet the current validation rules).
 *
 * HIPAA: no PHI in mail body. The mail only points the parent to the
 * in-app view; all specifics are surfaced there.
 */
class ApplicationRevertedToDraftNotification extends Notification
{
    use Queueable;

    /**
     * @param  list<array{section: string, label: string, key: string}>  $blockingIssues
     */
    public function __construct(
        protected Application $application,
        protected array $blockingIssues,
    ) {}

    public function via(object $notifiable): array
    {
        $prefs = $notifiable->notification_preferences ?? [];
        $emailEnabled = $prefs['applications'] ?? true;

        return $emailEnabled ? ['mail', 'database'] : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Action Needed: Your Camp Burnt Gin Application')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('We reviewed your camp application and found some required information that needs to be completed or updated before we can process it.')
            ->line('Your application has been returned to draft so you can make the needed updates. No information you previously entered has been lost — you can continue editing from where you left off.')
            ->action('Review Your Application', config('app.frontend_url').'/applicant/applications')
            ->line('If you have any questions, please reply to this email or contact camp staff.')
            ->salutation('Camp Burnt Gin');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'application_reverted_to_draft',
            'title' => 'Action needed on your camp application',
            'message' => 'We found some required information that needs attention. Your application is back in draft — open it to review the items that need updating.',
            'application_id' => $this->application->id,
            'issue_count' => count($this->blockingIssues),
            // Section names only — no specific field values — keeps PHI
            // out of the stored notification row.
            'issue_sections' => array_values(array_unique(array_column($this->blockingIssues, 'section'))),
        ];
    }
}
