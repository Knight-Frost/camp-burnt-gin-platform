<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Models\MedicalVisit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class MedicalVisitController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', MedicalVisit::class);

        $query = MedicalVisit::with(['camper', 'recorder'])
            ->orderByDesc('visit_date')
            ->orderByDesc('visit_time');

        if ($request->filled('camper_id')) {
            $query->where('camper_id', $request->integer('camper_id'));
        }
        if ($request->filled('disposition')) {
            $query->where('disposition', $request->input('disposition'));
        }
        if ($request->filled('from')) {
            $query->whereDate('visit_date', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('visit_date', '<=', $request->input('to'));
        }

        $visits = $query->paginate(25);

        return response()->json([
            'data' => $visits->items(),
            'meta' => [
                'current_page' => $visits->currentPage(),
                'last_page'    => $visits->lastPage(),
                'per_page'     => $visits->perPage(),
                'total'        => $visits->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', MedicalVisit::class);

        $validated = $request->validate([
            'camper_id'                => 'required|integer|exists:campers,id',
            'visit_date'               => 'required|date|before_or_equal:today',
            'visit_time'               => 'nullable|date_format:H:i',
            'chief_complaint'          => 'required|string|max:500',
            'symptoms'                 => 'required|string|max:5000',
            'vitals'                   => 'nullable|array',
            'vitals.temp'              => 'nullable|numeric|min:90|max:110',
            'vitals.pulse'             => 'nullable|integer|min:30|max:300',
            'vitals.bp_systolic'       => 'nullable|integer|min:50|max:300',
            'vitals.bp_diastolic'      => 'nullable|integer|min:20|max:200',
            'vitals.weight'            => 'nullable|numeric|min:0|max:1000',
            'vitals.spo2'              => 'nullable|integer|min:50|max:100',
            'treatment_provided'       => 'nullable|string|max:5000',
            'medications_administered' => 'nullable|string|max:2000',
            'disposition'              => 'required|string|in:returned_to_activity,monitoring,sent_home,emergency_transfer,other',
            'disposition_notes'        => 'nullable|string|max:2000',
            'follow_up_required'       => 'boolean',
            'follow_up_notes'          => 'nullable|string|max:2000',
        ]);

        $visit = MedicalVisit::create(array_merge(
            $validated,
            ['recorded_by' => $request->user()->id]
        ));

        $visit->load(['camper', 'recorder']);

        return response()->json([
            'message' => 'Medical visit recorded successfully.',
            'data'    => $visit,
        ], Response::HTTP_CREATED);
    }

    public function show(MedicalVisit $medicalVisit): JsonResponse
    {
        $this->authorize('view', $medicalVisit);
        $medicalVisit->load(['camper', 'recorder']);

        return response()->json(['data' => $medicalVisit]);
    }

    public function update(Request $request, MedicalVisit $medicalVisit): JsonResponse
    {
        $this->authorize('update', $medicalVisit);

        $validated = $request->validate([
            'visit_date'               => 'sometimes|date|before_or_equal:today',
            'visit_time'               => 'nullable|date_format:H:i',
            'chief_complaint'          => 'sometimes|string|max:500',
            'symptoms'                 => 'sometimes|string|max:5000',
            'vitals'                   => 'nullable|array',
            'vitals.temp'              => 'nullable|numeric|min:90|max:110',
            'vitals.pulse'             => 'nullable|integer|min:30|max:300',
            'vitals.bp_systolic'       => 'nullable|integer|min:50|max:300',
            'vitals.bp_diastolic'      => 'nullable|integer|min:20|max:200',
            'vitals.weight'            => 'nullable|numeric|min:0|max:1000',
            'vitals.spo2'              => 'nullable|integer|min:50|max:100',
            'treatment_provided'       => 'nullable|string|max:5000',
            'medications_administered' => 'nullable|string|max:2000',
            'disposition'              => 'sometimes|string|in:returned_to_activity,monitoring,sent_home,emergency_transfer,other',
            'disposition_notes'        => 'nullable|string|max:2000',
            'follow_up_required'       => 'boolean',
            'follow_up_notes'          => 'nullable|string|max:2000',
        ]);

        $medicalVisit->update($validated);
        $medicalVisit->load(['camper', 'recorder']);

        return response()->json([
            'message' => 'Medical visit updated successfully.',
            'data'    => $medicalVisit,
        ]);
    }

    public function destroy(MedicalVisit $medicalVisit): JsonResponse
    {
        $this->authorize('delete', $medicalVisit);
        $medicalVisit->delete();

        return response()->json(['message' => 'Medical visit deleted successfully.']);
    }
}
