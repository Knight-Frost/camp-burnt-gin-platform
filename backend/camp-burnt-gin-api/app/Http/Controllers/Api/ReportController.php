<?php

namespace App\Http\Controllers\Api;

use App\Enums\ApplicationStatus;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controller for report generation.
 *
 * Provides administrative reports for applications, labels, and letters.
 * Implements FR-16, FR-17, FR-18: Report generation requirements.
 */
class ReportController extends Controller
{
    public function __construct(
        protected ReportService $reportService
    ) {}

    /**
     * Generate applications report.
     */
    public function applications(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'camp_session_id', 'date_from', 'date_to']);

        $report = $this->reportService->generateApplicationsReport($filters);

        return response()->json([
            'data' => $report['data'],
            'summary' => $report['summary'],
        ]);
    }

    /**
     * Generate list of accepted applicants.
     */
    public function acceptedApplicants(Request $request): JsonResponse
    {
        $filters = $request->only(['camp_session_id']);

        $report = $this->reportService->generateAcceptedApplicantsReport($filters);

        return response()->json([
            'data' => $report['data'],
            'total' => $report['total'],
        ]);
    }

    /**
     * Generate list of rejected applicants.
     */
    public function rejectedApplicants(Request $request): JsonResponse
    {
        $filters = $request->only(['camp_session_id']);

        $report = $this->reportService->generateRejectedApplicantsReport($filters);

        return response()->json([
            'data' => $report['data'],
            'total' => $report['total'],
        ]);
    }

    /**
     * Generate mailing labels data.
     */
    public function mailingLabels(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['nullable', 'string'],
            'camp_session_id' => ['nullable', 'exists:camp_sessions,id'],
        ]);

        $labels = $this->reportService->generateMailingLabels($request->only(['status', 'camp_session_id']));

        return response()->json([
            'data' => $labels,
            'total' => count($labels),
        ]);
    }

    /**
     * Generate identification labels data.
     */
    public function idLabels(Request $request): JsonResponse
    {
        $request->validate([
            'camp_session_id' => ['required', 'exists:camp_sessions,id'],
        ]);

        $labels = $this->reportService->generateIdLabels($request->camp_session_id);

        return response()->json([
            'data' => $labels,
            'total' => count($labels),
        ]);
    }
}
