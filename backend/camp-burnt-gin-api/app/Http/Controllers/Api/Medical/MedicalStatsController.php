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

class MedicalStatsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', TreatmentLog::class);

        $today   = Carbon::today()->toDateString();
        $weekAgo = Carbon::today()->subDays(7)->toDateString();

        // Camper overview
        $totalCampers = Camper::count();
        $campersWithSevereAllergies = Camper::whereHas('allergies', function ($q) {
            $q->whereIn('severity', ['severe', 'life_threatening']);
        })->count();
        $campersOnMedications = Camper::whereHas('medications')->count();
        $campersWithRestrictions = Camper::whereHas('restrictions', function ($q) {
            $q->where('is_active', true);
        })->count();
        $campersWithoutMedicalRecord = Camper::doesntHave('medicalRecord')->count();

        // Follow-up summary
        $followUpsDueToday = MedicalFollowUp::whereDate('due_date', $today)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();
        $overdueFollowUps = MedicalFollowUp::whereDate('due_date', '<', $today)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();
        $openFollowUps = MedicalFollowUp::whereNotIn('status', ['completed', 'cancelled'])->count();

        // Recent activity (last 7 days)
        $recentTreatments = TreatmentLog::with(['camper', 'recorder'])
            ->whereDate('treatment_date', '>=', $weekAgo)
            ->orderByDesc('treatment_date')
            ->orderByDesc('treatment_time')
            ->limit(5)
            ->get();

        $recentIncidents = MedicalIncident::with(['camper', 'recorder'])
            ->whereDate('incident_date', '>=', $weekAgo)
            ->orderByDesc('incident_date')
            ->orderByDesc('incident_time')
            ->limit(5)
            ->get();

        $recentVisits = MedicalVisit::with(['camper', 'recorder'])
            ->whereDate('visit_date', '>=', $weekAgo)
            ->orderByDesc('visit_date')
            ->orderByDesc('visit_time')
            ->limit(5)
            ->get();

        // Treatment log breakdown (last 7 days)
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
