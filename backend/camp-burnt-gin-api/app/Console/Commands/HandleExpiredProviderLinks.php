<?php

namespace App\Console\Commands;

use App\Services\MedicalProviderLinkService;
use Illuminate\Console\Command;

/**
 * Command to process expired medical provider links.
 *
 * Sends notifications when provider links expire without submission.
 * Implements FR-23: Link expiration notifications.
 */
class HandleExpiredProviderLinks extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'provider-links:handle-expired';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Process expired medical provider links and send notifications';

    public function __construct(
        protected MedicalProviderLinkService $linkService
    ) {
        parent::__construct();
    }

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $count = $this->linkService->handleExpiredLinks();

        $this->info("Processed {$count} expired provider links.");

        return Command::SUCCESS;
    }
}
