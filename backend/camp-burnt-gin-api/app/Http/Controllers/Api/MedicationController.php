<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Medication\StoreMedicationRequest;
use App\Http\Requests\Medication\UpdateMedicationRequest;
use App\Models\Medication;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for managing medication resources.
 *
 * This controller handles CRUD operations for camper medications.
 * All actions are protected by MedicationPolicy authorization.
 */
class MedicationController extends Controller
{
    /**
     * Display a listing of medications.
     *
     * Accessible by administrators and medical providers only.
     * Parents access their children's medications via show endpoint.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Medication::class);

        $medications = Medication::with('camper')->paginate(15);

        return response()->json([
            'data' => $medications->items(),
            'meta' => [
                'current_page' => $medications->currentPage(),
                'last_page' => $medications->lastPage(),
                'per_page' => $medications->perPage(),
                'total' => $medications->total(),
            ],
        ]);
    }

    /**
     * Store a newly created medication.
     */
    public function store(StoreMedicationRequest $request): JsonResponse
    {
        $this->authorize('create', Medication::class);

        $medication = Medication::create($request->validated());
        $medication->load('camper');

        return response()->json([
            'message' => 'Medication created successfully.',
            'data' => $medication,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified medication.
     */
    public function show(Medication $medication): JsonResponse
    {
        $this->authorize('view', $medication);

        $medication->load('camper');

        return response()->json([
            'data' => $medication,
        ]);
    }

    /**
     * Update the specified medication.
     */
    public function update(UpdateMedicationRequest $request, Medication $medication): JsonResponse
    {
        $this->authorize('update', $medication);

        $medication->update($request->validated());

        return response()->json([
            'message' => 'Medication updated successfully.',
            'data' => $medication,
        ]);
    }

    /**
     * Remove the specified medication.
     */
    public function destroy(Medication $medication): JsonResponse
    {
        $this->authorize('delete', $medication);

        $medication->delete();

        return response()->json([
            'message' => 'Medication deleted successfully.',
        ]);
    }
}
