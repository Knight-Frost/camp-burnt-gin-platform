<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Diagnosis\StoreDiagnosisRequest;
use App\Http\Requests\Diagnosis\UpdateDiagnosisRequest;
use App\Models\Diagnosis;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for managing diagnosis resources.
 *
 * This controller handles CRUD operations for camper diagnoses,
 * which contribute to medical complexity assessment and supervision
 * level determination. All actions are protected by DiagnosisPolicy.
 */
class DiagnosisController extends Controller
{
    /**
     * Display a listing of diagnoses.
     *
     * Accessible by administrators and medical providers only.
     * Parents access their children's diagnoses via camper relationship.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Diagnosis::class);

        $diagnoses = Diagnosis::with('camper')->paginate(15);

        return response()->json([
            'data' => $diagnoses->items(),
            'meta' => [
                'current_page' => $diagnoses->currentPage(),
                'last_page' => $diagnoses->lastPage(),
                'per_page' => $diagnoses->perPage(),
                'total' => $diagnoses->total(),
            ],
        ]);
    }

    /**
     * Store a newly created diagnosis.
     */
    public function store(StoreDiagnosisRequest $request): JsonResponse
    {
        $this->authorize('create', Diagnosis::class);

        $diagnosis = Diagnosis::create($request->validated());
        $diagnosis->load('camper');

        return response()->json([
            'message' => 'Diagnosis created successfully.',
            'data' => $diagnosis,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified diagnosis.
     */
    public function show(Diagnosis $diagnosis): JsonResponse
    {
        $this->authorize('view', $diagnosis);

        $diagnosis->load('camper');

        return response()->json([
            'data' => $diagnosis,
        ]);
    }

    /**
     * Update the specified diagnosis.
     */
    public function update(UpdateDiagnosisRequest $request, Diagnosis $diagnosis): JsonResponse
    {
        $this->authorize('update', $diagnosis);

        $diagnosis->update($request->validated());

        return response()->json([
            'message' => 'Diagnosis updated successfully.',
            'data' => $diagnosis,
        ]);
    }

    /**
     * Remove the specified diagnosis.
     */
    public function destroy(Diagnosis $diagnosis): JsonResponse
    {
        $this->authorize('delete', $diagnosis);

        $diagnosis->delete();

        return response()->json([
            'message' => 'Diagnosis deleted successfully.',
        ]);
    }
}
