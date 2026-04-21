<?php

namespace App\Http\Controllers\Api\Camp;

use App\Enums\ApplicationStatus;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\CampSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * SessionDashboardController — per-session operational statistics and application listing.
 *
 * Provides the rich data payload that drives the SessionDetailPage in the admin portal.
 * Staff use this to monitor a session's capacity, review queue, and enrolment trends
 * without navigating through separate screens.
 *
 * Routes (all admin-only):
 *   GET /api/sessions/{session}/dashboard     — operational stats for one session
 *   GET /api/sessions/{session}/applications  — paginated application list for this session
 *
 * Authorization reuses CampSessionPolicy::view so any admin or super_admin can call these.
 * Medical providers do NOT have access — they use the camper directory instead.
 */
class SessionDashboardController extends Controller
{
    /**
     * Return operational statistics for a single session.
     *
     * GET /api/sessions/{session}/dashboard
     *
     * Returns:
     *  - session metadata (dates, capacity, registration window)
     *  - capacity_stats (enrolled, remaining, fill %)
     *  - application_stats (count per status, acceptance rate)
     *  - recent_applications (latest 10 for the activity feed)
     *  - age_distribution (enrolled campers grouped into age bands)
     *  - gender_distribution (enrolled campers grouped by gender)
     */
    public function dashboard(CampSession $session): JsonResponse
    {
        $this->authorize('view', $session);

        // ── Application counts per status ────────────────────────────────────────
        // selectRaw + groupBy produces a flat map of status → count without loading
        // every application row. Exclude drafts — they are not in the review queue.
        $statusCounts = Application::where('camp_session_id', $session->id)
            ->where('status', '!=', ApplicationStatus::Draft->value)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        $enrolled = (int) ($statusCounts[ApplicationStatus::Approved->value] ?? 0);
        $pending = (int) (
            ($statusCounts[ApplicationStatus::Submitted->value] ?? 0) +
            ($statusCounts[ApplicationStatus::UnderReview->value] ?? 0)
        );
        $rejected = (int) ($statusCounts[ApplicationStatus::Rejected->value] ?? 0);
        $waitlisted = (int) ($statusCounts[ApplicationStatus::Waitlisted->value] ?? 0);
        $cancelled = (int) ($statusCounts[ApplicationStatus::Cancelled->value] ?? 0);

        $totalSubmitted = $enrolled + $pending + $rejected + $waitlisted + $cancelled;
        $remaining = max(0, $session->capacity - $enrolled);
        $fillPct = $session->capacity > 0
            ? (int) round(($enrolled / $session->capacity) * 100)
            : 0;
        $acceptanceRate = $totalSubmitted > 0
            ? (int) round(($enrolled / $totalSubmitted) * 100)
            : 0;

        // ── Recent applications (activity feed) ──────────────────────────────────
        // Only basic camper name is needed here — avoid eager-loading PHI.
        $recentApplications = Application::where('camp_session_id', $session->id)
            ->where('status', '!=', ApplicationStatus::Draft->value)
            ->with(['camper' => fn ($q) => $q->select('id', 'first_name', 'last_name')])
            ->orderByDesc('submitted_at')
            ->take(10)
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'camper_name' => trim(($a->camper?->first_name ?? '').' '.($a->camper?->last_name ?? '')),
                'status' => $a->status->value,
                'submitted_at' => $a->submitted_at?->toIso8601String(),
                'reviewed_at' => $a->reviewed_at?->toIso8601String(),
            ]);

        // ── Family / camper registration metrics ────────────────────────────────
        // registered_families: distinct parent accounts with at least one formally submitted
        // application (drafts excluded — a draft is not a registration).
        $registeredFamilies = Application::where('camp_session_id', $session->id)
            ->where('status', '!=', ApplicationStatus::Draft->value)
            ->join('campers', 'applications.camper_id', '=', 'campers.id')
            ->distinct()
            ->count('campers.user_id');

        // registered_campers: enrolled campers — those with an approved application for
        // this session. Submitted/under_review/waitlisted are not yet enrolled.
        $registeredCampers = Application::where('camp_session_id', $session->id)
            ->where('status', ApplicationStatus::Approved->value)
            ->distinct()
            ->count('camper_id');

        // multi_camper_families: families that have ≥2 registered campers for this session
        $multiCamperFamilies = Application::where('camp_session_id', $session->id)
            ->where('status', '!=', ApplicationStatus::Draft->value)
            ->join('campers', 'applications.camper_id', '=', 'campers.id')
            ->selectRaw('campers.user_id')
            ->groupBy('campers.user_id')
            ->havingRaw('COUNT(DISTINCT applications.camper_id) >= 2')
            ->get()
            ->count();

        // ── Age distribution (enrolled only) — computed in SQL ──────────────────
        // CASE WHEN in selectRaw + GROUP BY performs a single aggregation query
        // instead of loading every enrolled camper row into PHP memory. This
        // scales to large sessions without memory growth.
        $approvedCamperIds = Application::where('camp_session_id', $session->id)
            ->where('status', ApplicationStatus::Approved->value)
            ->pluck('camper_id');

        $ageCounts = \App\Models\Camper::whereIn('id', $approvedCamperIds)
            ->whereNotNull('date_of_birth')
            ->selectRaw("
                CASE
                    WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) <= 8  THEN '6-8'
                    WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) <= 11 THEN '9-11'
                    WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) <= 14 THEN '12-14'
                    WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) <= 17 THEN '15-17'
                    ELSE '18+'
                END as age_group,
                COUNT(*) as count
            ")
            ->groupBy('age_group')
            ->pluck('count', 'age_group');

        $ageGroups = [
            '6-8' => (int) ($ageCounts['6-8'] ?? 0),
            '9-11' => (int) ($ageCounts['9-11'] ?? 0),
            '12-14' => (int) ($ageCounts['12-14'] ?? 0),
            '15-17' => (int) ($ageCounts['15-17'] ?? 0),
            '18+' => (int) ($ageCounts['18+'] ?? 0),
        ];

        // ── Gender distribution (enrolled only) — PHP normalisation ─────────────
        // Kept in PHP to handle mixed-case or non-standard gender values cleanly.
        // Only gender column is fetched — no PHI loaded.
        $genderCounts = ['male' => 0, 'female' => 0, 'other' => 0, 'unknown' => 0];
        $genderRows = \App\Models\Camper::whereIn('id', $approvedCamperIds)
            ->selectRaw('LOWER(COALESCE(gender, "unknown")) as g')
            ->pluck('g');

        foreach ($genderRows as $g) {
            $key = array_key_exists($g, $genderCounts) ? $g : 'other';
            $genderCounts[$key]++;
        }

        return response()->json([
            'data' => [
                'session' => [
                    'id' => $session->id,
                    'name' => $session->name,
                    // Camp is fixed for this deployment; the Camp model was removed
                    // when the schema collapsed Camp→CampSession. Kept in the payload
                    // for backwards compatibility with existing frontend consumers.
                    'camp' => 'Camp Burnt Gin',
                    'start_date' => $session->start_date?->toDateString(),
                    'end_date' => $session->end_date?->toDateString(),
                    'capacity' => $session->capacity,
                    'is_active' => $session->is_active,
                    'portal_open' => $session->portal_open,
                    'registration_opens_at' => $session->registration_opens_at?->toIso8601String(),
                    'registration_closes_at' => $session->registration_closes_at?->toIso8601String(),
                ],
                'capacity_stats' => [
                    'enrolled' => $enrolled,
                    'remaining' => $remaining,
                    'capacity' => $session->capacity,
                    'fill_percentage' => $fillPct,
                    'is_at_capacity' => $enrolled >= $session->capacity,
                ],
                'application_stats' => [
                    'total_submitted' => $totalSubmitted,
                    'approved' => $enrolled,
                    'pending' => $pending,
                    'rejected' => $rejected,
                    'waitlisted' => $waitlisted,
                    'cancelled' => $cancelled,
                    'acceptance_rate' => $acceptanceRate,
                ],
                'family_stats' => [
                    'registered_families' => $registeredFamilies,
                    'registered_campers' => $registeredCampers,
                    'active_applications' => $pending,
                    'multi_camper_families' => $multiCamperFamilies,
                ],
                'recent_applications' => $recentApplications,
                'age_distribution' => $ageGroups,
                'gender_distribution' => $genderCounts,
            ],
        ]);
    }

    /**
     * List all non-draft applications for a specific session.
     *
     * GET /api/sessions/{session}/applications
     *
     * Supports optional ?status= filter (e.g. ?status=waitlisted).
     * Returns the same paginated structure as ApplicationController::index().
     */
    public function applications(CampSession $session, Request $request): JsonResponse
    {
        $this->authorize('view', $session);

        $query = Application::where('camp_session_id', $session->id)
            ->where('status', '!=', ApplicationStatus::Draft->value)
            ->with(['camper.user', 'reviewer'])
            ->orderByDesc('submitted_at');

        // Optional status filter — useful for viewing just the waitlist
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $applications = $query->paginate(15);

        return response()->json([
            'data' => $applications->items(),
            'meta' => [
                'current_page' => $applications->currentPage(),
                'last_page' => $applications->lastPage(),
                'per_page' => $applications->perPage(),
                'total' => $applications->total(),
            ],
        ]);
    }
}
