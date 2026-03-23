<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Models\Camper;
use App\Models\TreatmentLog;
use App\Models\MedicalIncident;
use App\Models\MedicalFollowUp;
use App\Models\MedicalVisit;
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
     * All queries are scoped to today or the last 7 days to keep numbers
     * operationally relevant. No PHI record data is returned — only counts
     * and limited recent-activity previews.
     */
    public function index(Request $request): JsonResponse
    {
        // Re-use the TreatmentLog viewAny gate as the access check for dashboard data.
        $this->authorize('viewAny', TreatmentLog::class);

        // Define the two reference dates used across multiple queries below.
        $today   = Carbon::today()->toDateString();
        $weekAgo = Carbon::today()->subDays(7)->toDateString();

        // --- Camper overview counts ---

        // Total number of campers in the system.
        $totalCampers = Camper::count();

        // Campers with at least one severe or life-threatening allergy on file.
        $campersWithSevereAllergies = Camper::whereHas('allergies', function ($q) {
            $q->whereIn('severity', ['severe', 'life_threatening']);
        })->count();

        // Campers who have at least one active medication record.
        $campersOnMedications = Camper::whereHas('medications')->count();

        // Campers with at least one currently active medical restriction.
        $campersWithRestrictions = Camper::whereHas('restrictions', function ($q) {
            $q->where('is_active', true);
        })->count();

        // Campers who have not yet had a medical record created — useful for flagging
        // incomplete intake paperwork before a camper arrives at camp.
        $campersWithoutMedicalRecord = Camper::doesntHave('medicalRecord')->count();

        // --- Follow-up urgency summary ---

        // Tasks due exactly today that are not yet resolved.
        $followUpsDueToday = MedicalFollowUp::whereDate('due_date', $today)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();

        // Tasks whose due date has already passed and are still unresolved.
        $overdueFollowUps = MedicalFollowUp::whereDate('due_date', '<', $today)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();

        // All tasks that are neither completed nor cancelled — the full open workload.
        $openFollowUps = MedicalFollowUp::whereNotIn('status', ['completed', 'cancelled'])->count();

        // --- Recent activity feed (last 7 days, capped at 5 items each) ---

        // The 5 most recent treatment log entries.
        $recentTreatments = TreatmentLog::with(['camper', 'recorder'])
            ->orderByDesc('treatment_date')
            ->orderByDesc('treatment_time')
            ->limit(5)
            ->get();

        // The 5 most recent incident reports.
        $recentIncidents = MedicalIncident::with(['camper', 'recorder'])
            ->orderByDesc('incident_date')
            ->orderByDesc('incident_time')
            ->limit(5)
            ->get();

        // The 5 most recent health center visits.
        $recentVisits = MedicalVisit::with(['camper', 'recorder'])
            ->orderByDesc('visit_date')
            ->orderByDesc('visit_time')
            ->limit(5)
            ->get();

        // --- Treatment type breakdown (last 7 days) ---

        // A count-per-type map (e.g., { "medication": 12, "observation": 5 }) that
        // powers any chart or summary widget on the dashboard.
        $treatmentTypeCounts = TreatmentLog::whereDate('treatment_date', '>=', $weekAgo)
            ->selectRaw('type, count(*) as count')
            ->groupBy('type')
            ->pluck('count', 'type');

        return response()->json([
            'data' => [
                'campers' => [
                    'total'                    => $totalCampers,
                    'with_severe_allergies'    => $campersWithSevereAllergies,
                    'on_medications'           => $campersOnMedications,
                    'with_active_restrictions' => $campersWithRestrictions,
                    'missing_medical_record'   => $campersWithoutMedicalRecord,
                ],
                'follow_ups' => [
                    'due_today' => $followUpsDueToday,
                    'overdue'   => $overdueFollowUps,
                    'open'      => $openFollowUps,
                ],
                'recent_activity' => [
                    'treatments' => $recentTreatments,
                    'incidents'  => $recentIncidents,
                    'visits'     => $recentVisits,
                ],
                'treatment_type_counts' => $treatmentTypeCounts,
            ],
        ]);
    }
}
