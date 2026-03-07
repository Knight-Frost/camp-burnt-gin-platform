<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Models\MedicalRestriction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class MedicalRestrictionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', MedicalRestriction::class);

        $query = MedicalRestriction::with(['camper', 'creator'])
            ->orderByDesc('created_at');

        if ($request->filled('camper_id')) {
            $query->where('camper_id', $request->integer('camper_id'));
        }
        if ($request->filled('restriction_type')) {
            $query->where('restriction_type', $request->input('restriction_type'));
        }
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $restrictions = $query->paginate(25);

        return response()->json([
            'data' => $restrictions->items(),
            'meta' => [
                'current_page' => $restrictions->currentPage(),
                'last_page'    => $restrictions->lastPage(),
                'per_page'     => $restrictions->perPage(),
                'total'        => $restrictions->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', MedicalRestriction::class);

        $validated = $request->validate([
            'camper_id'        => 'required|integer|exists:campers,id',
            'restriction_type' => 'required|string|in:activity,dietary,environmental,medication,other',
            'description'      => 'required|string|max:2000',
            'start_date'       => 'nullable|date',
            'end_date'         => 'nullable|date|after_or_equal:start_date',
            'is_active'        => 'boolean',
            'notes'            => 'nullable|string|max:2000',
        ]);

        $restriction = MedicalRestriction::create(array_merge(
            $validated,
            ['created_by' => $request->user()->id]
        ));

        $restriction->load(['camper', 'creator']);

        return response()->json([
            'message' => 'Medical restriction created successfully.',
            'data'    => $restriction,
        ], Response::HTTP_CREATED);
    }

    public function show(MedicalRestriction $medicalRestriction): JsonResponse
    {
        $this->authorize('view', $medicalRestriction);
        $medicalRestriction->load(['camper', 'creator']);

        return response()->json(['data' => $medicalRestriction]);
    }

    public function update(Request $request, MedicalRestriction $medicalRestriction): JsonResponse
    {
        $this->authorize('update', $medicalRestriction);

        $validated = $request->validate([
            'restriction_type' => 'sometimes|string|in:activity,dietary,environmental,medication,other',
            'description'      => 'sometimes|string|max:2000',
            'start_date'       => 'nullable|date',
            'end_date'         => 'nullable|date',
            'is_active'        => 'boolean',
            'notes'            => 'nullable|string|max:2000',
        ]);

        $medicalRestriction->update($validated);
        $medicalRestriction->load(['camper', 'creator']);

        return response()->json([
            'message' => 'Medical restriction updated successfully.',
            'data'    => $medicalRestriction,
        ]);
    }

    public function destroy(MedicalRestriction $medicalRestriction): JsonResponse
    {
        $this->authorize('delete', $medicalRestriction);
        $medicalRestriction->delete();

        return response()->json(['message' => 'Medical restriction deleted successfully.']);
    }
}
