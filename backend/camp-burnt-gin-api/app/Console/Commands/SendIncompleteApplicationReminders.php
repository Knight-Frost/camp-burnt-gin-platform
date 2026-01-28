<?php

namespace App\Console\Commands;

use App\Models\Application;
use App\Notifications\IncompleteApplicationReminderNotification;
use Illuminate\Console\Command;

/**
 * Command to send reminders for incomplete applications.
 *
 * Sends notifications to parents with draft applications older than specified days.
 * Implements FR-29: Incomplete application reminders.
 */
class SendIncompleteApplicationReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'applications:send-reminders {--days=7 : Days after which to send reminders}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send reminders for incomplete/draft applications';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $days = (int) $this->option('days');

        $draftApplications = Application::where('is_draft', true)
            ->whereNull('submitted_at')
            ->where('created_at', '<=', now()->subDays($days))
            ->with(['camper.user', 'campSession'])
            ->get();

        $count = 0;
        foreach ($draftApplications as $application) {
            if ($application->campSession->registration_closes_at?->isFuture()) {
                $application->camper->user->notify(new IncompleteApplicationReminderNotification($application));
                $count++;
            }
        }

        $this->info("Sent {$count} incomplete application reminders.");

        return Command::SUCCESS;
    }
}
