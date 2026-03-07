<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Models\MedicalIncident;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class MedicalIncidentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', MedicalIncident::class);

        $query = MedicalIncident::with(['camper', 'recorder'])
            ->orderByDesc('incident_date')
            ->orderByDesc('incident_time');

        if ($request->filled('camper_id')) {
            $query->where('camper_id', $request->integer('camper_id'));
        }
        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }
        if ($request->filled('severity')) {
            $query->where('severity', $request->input('severity'));
        }
        if ($request->filled('from')) {
            $query->whereDate('incident_date', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('incident_date', '<=', $request->input('to'));
        }

        $incidents = $query->paginate(25);

        return response()->json([
            'data' => $incidents->items(),
            'meta' => [
                'current_page' => $incidents->currentPage(),
                'last_page'    => $incidents->lastPage(),
                'per_page'     => $incidents->perPage(),
                'total'        => $incidents->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', MedicalIncident::class);

        $validated = $request->validate([
            'camper_id'           => 'required|integer|exists:campers,id',
            'treatment_log_id'    => 'nullable|integer|exists:treatment_logs,id',
            'type'                => 'required|string|in:behavioral,medical,injury,environmental,emergency,other',
            'severity'            => 'required|string|in:minor,moderate,severe,critical',
            'location'            => 'nullable|string|max:255',
            'title'               => 'required|string|max:500',
            'description'         => 'required|string|max:5000',
            'witnesses'           => 'nullable|string|max:2000',
            'escalation_required' => 'boolean',
            'escalation_notes'    => 'nullable|string|max:2000',
            'incident_date'       => 'required|date|before_or_equal:today',
            'incident_time'       => 'nullable|date_format:H:i',
        ]);

        $incident = MedicalIncident::create(array_merge(
            $validated,
            ['recorded_by' => $request->user()->id]
        ));

        $incident->load(['camper', 'recorder']);

        return response()->json([
            'message' => 'Medical incident recorded successfully.',
            'data'    => $incident,
        ], Response::HTTP_CREATED);
    }

    public function show(MedicalIncident $medicalIncident): JsonResponse
    {
        $this->authorize('view', $medicalIncident);
        $medicalIncident->load(['camper', 'recorder', 'treatmentLog']);

        return response()->json(['data' => $medicalIncident]);
    }

    public function update(Request $request, MedicalIncident $medicalIncident): JsonResponse
    {
        $this->authorize('update', $medicalIncident);

        $validated = $request->validate([
            'type'                => 'sometimes|string|in:behavioral,medical,injury,environmental,emergency,other',
            'severity'            => 'sometimes|string|in:minor,moderate,severe,critical',
            'location'            => 'nullable|string|max:255',
            'title'               => 'sometimes|string|max:500',
            'description'         => 'sometimes|string|max:5000',
            'witnesses'           => 'nullable|string|max:2000',
            'escalation_required' => 'boolean',
            'escalation_notes'    => 'nullable|string|max:2000',
            'incident_date'       => 'sometimes|date|before_or_equal:today',
            'incident_time'       => 'nullable|date_format:H:i',
            'treatment_log_id'    => 'nullable|integer|exists:treatment_logs,id',
        ]);

        $medicalIncident->update($validated);
        $medicalIncident->load(['camper', 'recorder']);

        return response()->json([
            'message' => 'Medical incident updated successfully.',
            'data'    => $medicalIncident,
        ]);
    }

    public function destroy(MedicalIncident $medicalIncident): JsonResponse
    {
        $this->authorize('delete', $medicalIncident);
        $medicalIncident->delete();

        return response()->json(['message' => 'Medical incident deleted successfully.']);
    }
}
