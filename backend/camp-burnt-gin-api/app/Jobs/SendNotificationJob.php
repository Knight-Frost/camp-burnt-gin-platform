<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Job to send notifications asynchronously.
 *
 * Improves API response times by offloading email/SMS sending to background workers.
 * Implements retry logic for transient failures (SMTP timeouts, network issues).
 */
class SendNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Number of times to retry the job.
     */
    public int $tries = 3;

    /**
     * Seconds to wait before retrying (exponential backoff).
     *
     * @var array<int>
     */
    public array $backoff = [60, 300, 900]; // 1min, 5min, 15min

    /**
     * Maximum number of seconds to wait before retrying.
     */
    public int $maxExceptions = 3;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public mixed $notifiable,
        public Notification $notification
    ) {
        $this->onQueue('notifications');
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $this->notifiable->notify($this->notification);
    }

    /**
     * Calculate retry delay for this attempt.
     */
    public function backoff(): array
    {
        return $this->backoff;
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        \Log::error('Notification job failed', [
            'notifiable_type' => get_class($this->notifiable),
            'notifiable_id' => $this->notifiable->id ?? null,
            'notification_type' => get_class($this->notification),
            'exception' => $exception->getMessage(),
        ]);
    }
}
