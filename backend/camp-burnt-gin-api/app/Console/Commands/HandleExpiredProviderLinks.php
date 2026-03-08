<?php

namespace App\Console\Commands;

use App\Services\Medical\MedicalProviderLinkService;
use Illuminate\Console\Command;

/**
 * HandleExpiredProviderLinks — processes medical provider links that have passed their expiry date.
 *
 * When a parent invites an external doctor to submit medical information, a secure link
 * with an expiration date is generated. If the doctor never submits before the link expires,
 * this command detects those expired links and sends notification emails so the parent
 * and administrator are aware they need to follow up.
 *
 * Implements FR-23: Link expiration notifications.
 * This command is intended to run on a schedule (e.g., daily via the task scheduler).
 */
class HandleExpiredProviderLinks extends Command
{
    /**
     * The artisan command name. Run with: php artisan provider-links:handle-expired
     *
     * @var string
     */
    protected $signature = 'provider-links:handle-expired';

    /**
     * A short description shown when running `php artisan list`.
     *
     * @var string
     */
    protected $description = 'Process expired medical provider links and send notifications';

    /**
     * Inject the MedicalProviderLinkService which contains the business logic
     * for detecting and handling expired links.
     */
    public function __construct(
        protected MedicalProviderLinkService $linkService
    ) {
        parent::__construct();
    }

    /**
     * Run the command: delegate to the link service and report how many links were processed.
     */
    public function handle(): int
    {
        // The service handles all the logic — finding expired links and sending notifications.
        $count = $this->linkService->handleExpiredLinks();

        $this->info("Processed {$count} expired provider links.");

        return Command::SUCCESS;
    }
}
