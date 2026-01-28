<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MedicalRecord\StoreMedicalRecordRequest;
use App\Http\Requests\MedicalRecord\UpdateMedicalRecordRequest;
use App\Models\MedicalRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for managing medical record resources.
 *
 * This controller handles CRUD operations for HIPAA-protected
 * medical records. All actions are protected by MedicalRecordPolicy.
 */
class MedicalRecordController extends Controller
{
    /**
     * Display a listing of medical records.
     *
     * Accessible by administrators and medical providers only.
     * Parents access their children's records via show endpoint.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', MedicalRecord::class);

        $medicalRecords = MedicalRecord::with('camper')->paginate(15);

        return response()->json([
            'data' => $medicalRecords->items(),
            'meta' => [
                'current_page' => $medicalRecords->currentPage(),
                'last_page' => $medicalRecords->lastPage(),
                'per_page' => $medicalRecords->perPage(),
                'total' => $medicalRecords->total(),
            ],
        ]);
    }

    /**
     * Store a newly created medical record.
     */
    public function store(StoreMedicalRecordRequest $request): JsonResponse
    {
        $this->authorize('create', MedicalRecord::class);

        $medicalRecord = MedicalRecord::create($request->validated());
        $medicalRecord->load('camper');

        return response()->json([
            'message' => 'Medical record created successfully.',
            'data' => $medicalRecord,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified medical record.
     */
    public function show(MedicalRecord $medicalRecord): JsonResponse
    {
        $this->authorize('view', $medicalRecord);

        $medicalRecord->load('camper');

        return response()->json([
            'data' => $medicalRecord,
        ]);
    }

    /**
     * Update the specified medical record.
     */
    public function update(UpdateMedicalRecordRequest $request, MedicalRecord $medicalRecord): JsonResponse
    {
        $this->authorize('update', $medicalRecord);

        $medicalRecord->update($request->validated());

        return response()->json([
            'message' => 'Medical record updated successfully.',
            'data' => $medicalRecord,
        ]);
    }

    /**
     * Remove the specified medical record.
     *
     * Only administrators can delete medical records.
     */
    public function destroy(MedicalRecord $medicalRecord): JsonResponse
    {
        $this->authorize('delete', $medicalRecord);

        $medicalRecord->delete();

        return response()->json([
            'message' => 'Medical record deleted successfully.',
        ]);
    }
}
