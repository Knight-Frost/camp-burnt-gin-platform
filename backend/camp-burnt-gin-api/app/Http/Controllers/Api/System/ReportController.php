<?php

namespace App\Http\Controllers\Api\System;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Services\System\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Controller for report generation.
 *
 * Provides administrative reports as downloadable CSV files.
 * Implements FR-16, FR-17, FR-18: Report generation requirements.
 */
class ReportController extends Controller
{
    public function __construct(
        protected ReportService $reportService
    ) {}

    /**
     * Summary statistics for the Reports dashboard.
     *
     * Returns aggregate counts for campers, applications (by status),
     * and session enrollment — consumed by AdminReportsPage.
     */
    public function summary(): JsonResponse
    {
        $this->authorize('viewAny', Application::class);

        $apps = Application::selectRaw('status, COUNT(*) as count')->groupBy('status')->pluck('count', 'status');

        $sessions = CampSession::withCount('applications')->get()->map(fn ($s) => [
            'id'         => $s->id,
            'name'       => $s->name,
            'capacity'   => $s->capacity,
            'enrolled'   => $s->applications_count,
        ]);

        $timeline = Application::selectRaw("DATE_FORMAT(submitted_at, '%Y-%m') as month, COUNT(*) as count")
            ->whereNotNull('submitted_at')
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->map(fn ($r) => ['month' => $r->month, 'count' => (int) $r->count]);

        return response()->json([
            'success' => true,
            'data' => [
                'total_campers'              => Camper::count(),
                'total_applications'         => Application::count(),
                'applications_by_status'     => $apps,
                'accepted_applications'      => $apps['accepted'] ?? 0,
                'pending_applications'       => ($apps['pending'] ?? 0) + ($apps['submitted'] ?? 0) + ($apps['under_review'] ?? 0),
                'rejected_applications'      => $apps['rejected'] ?? 0,
                'sessions'                   => $sessions,
                'applications_over_time'     => $timeline,
            ],
        ]);
    }

    /**
     * Build a CSV StreamedResponse from headers and rows.
     *
     * @param  list<string>          $headers
     * @param  list<list<mixed>>     $rows
     */
    private function csvResponse(array $headers, array $rows, string $filename): StreamedResponse
    {
        return response()->streamDownload(function () use ($headers, $rows) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel renders special characters correctly
            fputcsv($handle, $headers);
            foreach ($rows as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * Download applications report as CSV.
     */
    public function applications(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', Application::class);

        $filters = $request->only(['status', 'camp_session_id', 'date_from', 'date_to']);
        $report = $this->reportService->generateApplicationsReport($filters);

        $headers = ['ID', 'Camper Name', 'Parent Name', 'Parent Email', 'Camp Session', 'Camp Name', 'Status', 'Submitted At', 'Reviewed At', 'Reviewer'];
        $rows = collect($report['data'])->map(fn ($r) => [
            $r['id'],
            $r['camper_name'],
            $r['parent_name'],
            $r['parent_email'],
            $r['camp_session'],
            $r['camp_name'],
            $r['status'],
            $r['submitted_at'] ?? '',
            $r['reviewed_at'] ?? '',
            $r['reviewer'] ?? '',
        ])->toArray();

        return $this->csvResponse($headers, $rows, 'applications-'.now()->format('Y-m-d').'.csv');
    }

    /**
     * Download accepted applicants report as CSV.
     */
    public function acceptedApplicants(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', Application::class);

        $filters = $request->only(['camp_session_id']);
        $report = $this->reportService->generateAcceptedApplicantsReport($filters);

        $headers = ['Camper ID', 'Camper Name', 'Date of Birth', 'Age', 'Parent Name', 'Parent Email', 'Camp Session', 'Session Dates', 'Approved At'];
        $rows = collect($report['data'])->map(fn ($r) => [
            $r['camper_id'],
            $r['camper_name'],
            $r['date_of_birth'],
            $r['age'],
            $r['parent_name'],
            $r['parent_email'],
            $r['camp_session'],
            $r['session_dates'],
            $r['approved_at'] ?? '',
        ])->toArray();

        return $this->csvResponse($headers, $rows, 'accepted-applicants-'.now()->format('Y-m-d').'.csv');
    }

    /**
     * Download rejected applicants report as CSV.
     */
    public function rejectedApplicants(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', Application::class);

        $filters = $request->only(['camp_session_id']);
        $report = $this->reportService->generateRejectedApplicantsReport($filters);

        $headers = ['Camper ID', 'Camper Name', 'Parent Name', 'Parent Email', 'Camp Session', 'Rejected At', 'Notes'];
        $rows = collect($report['data'])->map(fn ($r) => [
            $r['camper_id'],
            $r['camper_name'],
            $r['parent_name'],
            $r['parent_email'],
            $r['camp_session'],
            $r['rejected_at'] ?? '',
            $r['notes'] ?? '',
        ])->toArray();

        return $this->csvResponse($headers, $rows, 'rejected-applicants-'.now()->format('Y-m-d').'.csv');
    }

    /**
     * Download mailing labels as CSV.
     */
    public function mailingLabels(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', Application::class);

        $request->validate([
            'status' => ['nullable', 'string'],
            'camp_session_id' => ['nullable', 'exists:camp_sessions,id'],
        ]);

        $labels = $this->reportService->generateMailingLabels($request->only(['status', 'camp_session_id']));

        $headers = ['Recipient Name', 'Camper Name', 'Email'];
        $rows = array_map(fn ($r) => [$r['recipient_name'], $r['camper_name'], $r['email']], $labels);

        return $this->csvResponse($headers, $rows, 'mailing-labels-'.now()->format('Y-m-d').'.csv');
    }

    /**
     * Download identification labels as CSV.
     *
     * camp_session_id is optional; omitting it returns labels for all approved campers.
     */
    public function idLabels(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', Application::class);

        $request->validate([
            'camp_session_id' => ['nullable', 'exists:camp_sessions,id'],
        ]);

        $campSessionId = $request->integer('camp_session_id') ?: null;
        $labels = $this->reportService->generateIdLabels($campSessionId);

        $headers = ['Camper Name', 'Date of Birth', 'Age', 'Session Name', 'Has Severe Allergies', 'Severe Allergies'];
        $rows = array_map(fn ($r) => [
            $r['camper_name'],
            $r['date_of_birth'],
            $r['age'],
            $r['session_name'],
            $r['has_severe_allergies'] ? 'Yes' : 'No',
            implode('; ', $r['severe_allergies']),
        ], $labels);

        return $this->csvResponse($headers, $rows, 'id-labels-'.now()->format('Y-m-d').'.csv');
    }
}
