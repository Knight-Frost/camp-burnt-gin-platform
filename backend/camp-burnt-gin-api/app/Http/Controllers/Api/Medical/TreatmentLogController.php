<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Http\Requests\TreatmentLog\StoreTreatmentLogRequest;
use App\Http\Requests\TreatmentLog\UpdateTreatmentLogRequest;
use App\Models\Camper;
use App\Models\TreatmentLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for managing treatment log resources.
 *
 * Allows camp medical staff to record, view, and update clinical
 * interventions, medication administrations, observations, and
 * emergency responses for individual campers.
 *
 * All actions are protected by TreatmentLogPolicy.
 */
class TreatmentLogController extends Controller
{
    /**
     * Display a listing of treatment logs.
     *
     * Supports filtering by camper_id and date range.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', TreatmentLog::class);

        $query = TreatmentLog::with(['camper', 'recorder'])
            ->orderByDesc('treatment_date')
            ->orderByDesc('treatment_time');

        if ($request->filled('camper_id')) {
            $query->where('camper_id', $request->integer('camper_id'));
        }

        if ($request->filled('from')) {
            $query->whereDate('treatment_date', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('treatment_date', '<=', $request->input('to'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        $logs = $query->paginate(25);

        return response()->json([
            'data' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page'    => $logs->lastPage(),
                'per_page'     => $logs->perPage(),
                'total'        => $logs->total(),
            ],
        ]);
    }

    /**
     * Store a newly created treatment log entry.
     *
     * The recorded_by field is automatically set to the authenticated user.
     * If a medication is recorded, the response includes allergy conflict
     * warnings so the medic can make an informed clinical decision.
     */
    public function store(StoreTreatmentLogRequest $request): JsonResponse
    {
        $this->authorize('create', TreatmentLog::class);

        $log = TreatmentLog::create(array_merge(
            $request->validated(),
            ['recorded_by' => $request->user()->id]
        ));

        $log->load(['camper', 'recorder', 'medicalVisit']);

        // Allergy conflict check — warn if the administered medication
        // matches any of the camper's recorded allergens.
        $allergyWarnings = [];
        $medicationGiven = $request->validated('medication_given');
        if ($medicationGiven) {
            $camper = Camper::with('allergies')->find($log->camper_id);
            if ($camper) {
                $allergyWarnings = TreatmentLog::detectAllergyConflicts(
                    $medicationGiven,
                    $camper->allergies
                );
            }
        }

        $response = [
            'message' => 'Treatment log created successfully.',
            'data'    => $log,
        ];

        if (! empty($allergyWarnings)) {
            $response['allergy_warnings'] = $allergyWarnings;
        }

        return response()->json($response, Response::HTTP_CREATED);
    }

    /**
     * Display the specified treatment log entry.
     */
    public function show(TreatmentLog $treatmentLog): JsonResponse
    {
        $this->authorize('view', $treatmentLog);

        $treatmentLog->load(['camper', 'recorder', 'medicalVisit']);

        return response()->json([
            'data' => $treatmentLog,
        ]);
    }

    /**
     * Update the specified treatment log entry.
     */
    public function update(UpdateTreatmentLogRequest $request, TreatmentLog $treatmentLog): JsonResponse
    {
        $this->authorize('update', $treatmentLog);

        $treatmentLog->update($request->validated());
        $treatmentLog->load(['camper', 'recorder', 'medicalVisit']);

        return response()->json([
            'message' => 'Treatment log updated successfully.',
            'data'    => $treatmentLog,
        ]);
    }

    /**
     * Remove the specified treatment log entry.
     *
     * Only administrators can delete treatment logs.
     */
    public function destroy(TreatmentLog $treatmentLog): JsonResponse
    {
        $this->authorize('delete', $treatmentLog);

        $treatmentLog->delete();

        return response()->json([
            'message' => 'Treatment log deleted successfully.',
        ]);
    }
}
