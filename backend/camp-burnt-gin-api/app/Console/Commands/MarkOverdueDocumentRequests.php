<?php

namespace App\Console\Commands;

use App\Enums\DocumentRequestStatus;
use App\Enums\DocumentReviewAction;
use App\Models\Camper;
use App\Models\Document;
use App\Models\DocumentRequest;
use App\Models\DocumentReviewEvent;
use App\Models\User;
use App\Services\SystemNotificationService;
use Illuminate\Console\Command;

/**
 * MarkOverdueDocumentRequests — daily job that identifies past-due document requests,
 * flips their status to Overdue, records a review event, and notifies applicants.
 *
 * Idempotent: a request that is already Overdue is NOT notified again (checked via
 * document_review_events — if an 'overdue' event already exists for today's run, skip).
 * This prevents flooding applicants with repeated overdue notifications on every daily run.
 *
 * Decision D3: reuses the existing scheduler infrastructure (see routes/console.php or
 * Kernel.php) rather than building a separate deadline-polling mechanism.
 */
class MarkOverdueDocumentRequests extends Command
{
    protected $signature = 'documents:mark-overdue {--dry-run : Report what would be marked without making changes}';

    protected $description = 'Mark document requests past their due date as overdue and notify applicants.';

    public function __construct(private readonly SystemNotificationService $notifications)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        // Find requests that are past due and still open (awaiting upload or already overdue).
        $candidates = DocumentRequest::whereNotNull('due_date')
            ->where('due_date', '<', now()->startOfDay())
            ->whereIn('status', [
                DocumentRequestStatus::AwaitingUpload->value,
                // Also re-check requests that were previously marked overdue
                // but never fulfilled — ensures they stay visible as overdue.
            ])
            ->whereNull('deleted_at')
            ->with('applicant', 'camper', 'latestDocument')
            ->get();

        $marked = 0;
        $skipped = 0;

        foreach ($candidates as $request) {
            // Idempotency guard: only send one overdue notification per request.
            // Query document_review_events directly — does NOT require a document to
            // exist (overdue most commonly fires before any upload has occurred).
            $alreadyNotified = DocumentReviewEvent::where('document_request_id', $request->id)
                ->where('action', DocumentReviewAction::Overdue->value)
                ->exists();

            if ($dryRun) {
                $this->line("Would mark overdue: DocumentRequest #{$request->id} ({$request->document_type}) — already notified: ".($alreadyNotified ? 'yes' : 'no'));
                $marked++;
                continue;
            }

            // Always flip status to Overdue (may already be Overdue — idempotent).
            $request->update(['status' => DocumentRequestStatus::Overdue]);

            if (! $alreadyNotified) {
                // Record the overdue event (performed_by = null = system-generated).
                // document is nullable — pass latestDocument if present, null otherwise.
                /** @var Document|null $latestDoc */
                $latestDoc = $request->latestDocument;
                DocumentReviewEvent::recordOverdue($request, $latestDoc);

                // Notify the applicant.
                /** @var User|null $applicant */
                $applicant = $request->applicant;
                if ($applicant) {
                    /** @var Camper|null $camper */
                    $camper = $request->camper;
                    $camperName = $camper?->full_name;
                    $this->notifications->documentOverdue(
                        $applicant,
                        $request->id,
                        $request->document_type,
                        $camperName,
                    );
                }

                $marked++;
            } else {
                $skipped++;
            }
        }

        $this->info("Marked overdue: {$marked}. Skipped (already notified): {$skipped}.");

        return self::SUCCESS;
    }
}
