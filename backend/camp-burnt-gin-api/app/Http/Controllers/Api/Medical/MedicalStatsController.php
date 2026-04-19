<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Models\Camper;
use App\Models\MedicalFollowUp;
use App\Models\MedicalIncident;
use App\Models\MedicalVisit;
use App\Models\TreatmentLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * MedicalStatsController
 *
 * Provides the aggregate numbers that power the Medical Dashboard — the command
 * center view that medical staff see first when they log in. Instead of loading
 * every individual record and counting on the frontend, this controller runs
 * focused database COUNT queries so the dashboard loads quickly even with many campers.
 *
 * The response is organised into four sections:
 *   - campers: high-level population health summary
 *   - follow_ups: urgency snapshot (overdue, due today, total open)
 *   - recent_activity: the last 5 treatments, incidents, and visits from the past 7 days
 *   - treatment_type_counts: breakdown of treatment categories for the past 7 days
 *
 * Access is gated using the TreatmentLog 'viewAny' permission as a proxy,
 * meaning only admins and medical providers can fetch this dashboard data.
 */
class MedicalStatsController extends Controller
{
    /**
     * Return aggregated medical dashboard statistics.
     *
     * Camper counts and follow-up urgency numbers are always global (session-independent)
     * because they reflect the total clinical population. The activity feed and treatment
     * type breakdown respect an optional session_id filter so medical staff can scope
     * the dashboard to the currently selected session.
     *
     * Activity feed uses limit-based queries (most recent N records) rather than a
     * fixed time window — this guarantees the feed is never empty just because the
     * system has been idle for a few days.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', TreatmentLog::class);

        $today = Carbon::today()->toDateString();

        // Optional session scope — passed by the frontend when a session is selected.
        $sessionId = $request->filled('session_id') ? $request->integer('session_id') : null;

        // --- Camper overview counts (always global — total clinical population) ---

        $totalCampers = Camper::active()->count();

        $campersWithSevereAllergies = Camper::active()->whereHas('allergies', function ($q) {
            $q->whereIn('severity', ['severe', 'life_threatening']);
        })->count();

        $campersOnMedications = Camper::active()->whereHas('medications')->count();

        $campersWithRestrictions = Camper::active()->whereHas('restrictions', function ($q) {
            $q->where('is_active', true);
        })->count();

        $campersWithoutMedicalRecord = Camper::active()->doesntHave('medicalRecord')->count();

        // --- Follow-up urgency summary (session-scoped when session_id is provided) ---

        $followUpBase = MedicalFollowUp::query();
        if ($sessionId) {
            $followUpBase->where('camp_session_id', $sessionId);
        }

        $followUpsDueToday = (clone $followUpBase)
            ->whereDate('due_date', $today)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();

        $overdueFollowUps = (clone $followUpBase)
            ->whereDate('due_date', '<', $today)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();

        $openFollowUps = (clone $followUpBase)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();

        // --- Recent activity feed (most recent 5 of each type, session-scoped) ---
        //
        // Limit-based rather than date-bounded: always returns the most recent records
        // regardless of when they were created. This prevents an empty feed after
        // quiet periods or on a freshly seeded database.
        //
        // Only non-PHI columns plus the authorized summary fields (title, chief_complaint)
        // are selected — full notes/dosage/description columns are never sent here.

        $recentTreatments = TreatmentLog::select([
            'id', 'camper_id', 'camp_session_id', 'recorded_by', 'type',
            'treatment_date', 'treatment_time', 'title', 'created_at',
        ])
            ->with(['camper:id,first_name,last_name', 'recorder:id,name'])
            ->when($sessionId, fn ($q) => $q->where('camp_session_id', $sessionId))
            ->orderByDesc('treatment_date')
            ->orderByDesc('treatment_time')
            ->limit(5)
            ->get();

        $recentIncidents = MedicalIncident::select([
            'id', 'camper_id', 'camp_session_id', 'recorded_by', 'severity',
            'incident_date', 'incident_time', 'title', 'created_at',
        ])
            ->with(['camper:id,first_name,last_name', 'recorder:id,name'])
            ->when($sessionId, fn ($q) => $q->where('camp_session_id', $sessionId))
            ->orderByDesc('incident_date')
            ->orderByDesc('incident_time')
            ->limit(5)
            ->get();

        $recentVisits = MedicalVisit::select([
            'id', 'camper_id', 'camp_session_id', 'recorded_by', 'disposition',
            'visit_date', 'visit_time', 'chief_complaint', 'created_at',
        ])
            ->with(['camper:id,first_name,last_name', 'recorder:id,name'])
            ->when($sessionId, fn ($q) => $q->where('camp_session_id', $sessionId))
            ->orderByDesc('visit_date')
            ->orderByDesc('visit_time')
            ->limit(5)
            ->get();

        // --- Treatment type breakdown (all-time, session-scoped) ---

        $treatmentTypeCounts = TreatmentLog::query()
            ->when($sessionId, fn ($q) => $q->where('camp_session_id', $sessionId))
            ->selectRaw('type, count(*) as count')
            ->groupBy('type')
            ->pluck('count', 'type');

        return response()->json([
            'data' => [
                'campers' => [
                    'total' => $totalCampers,
                    'with_severe_allergies' => $campersWithSevereAllergies,
                    'on_medications' => $campersOnMedications,
                    'with_active_restrictions' => $campersWithRestrictions,
                    'missing_medical_record' => $campersWithoutMedicalRecord,
                ],
                'follow_ups' => [
                    'due_today' => $followUpsDueToday,
                    'overdue' => $overdueFollowUps,
                    'open' => $openFollowUps,
                ],
                'recent_activity' => [
                    'treatments' => $recentTreatments,
                    'incidents' => $recentIncidents,
                    'visits' => $recentVisits,
                ],
                'treatment_type_counts' => $treatmentTypeCounts,
            ],
        ]);
    }
}
