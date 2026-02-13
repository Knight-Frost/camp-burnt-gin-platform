<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\BehavioralProfile\StoreBehavioralProfileRequest;
use App\Http\Requests\BehavioralProfile\UpdateBehavioralProfileRequest;
use App\Models\BehavioralProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for managing behavioral profile resources.
 *
 * This controller handles operations for camper behavioral profiles,
 * which track safety risks, supervision needs, and developmental status.
 * All actions are protected by BehavioralProfilePolicy.
 */
class BehavioralProfileController extends Controller
{
    /**
     * Display a listing of behavioral profiles.
     *
     * Accessible by administrators and medical providers only.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', BehavioralProfile::class);

        $profiles = BehavioralProfile::with('camper')->paginate(15);

        return response()->json([
            'data' => $profiles->items(),
            'meta' => [
                'current_page' => $profiles->currentPage(),
                'last_page' => $profiles->lastPage(),
                'per_page' => $profiles->perPage(),
                'total' => $profiles->total(),
            ],
        ]);
    }

    /**
     * Store a newly created behavioral profile.
     */
    public function store(StoreBehavioralProfileRequest $request): JsonResponse
    {
        $this->authorize('create', BehavioralProfile::class);

        $profile = BehavioralProfile::create($request->validated());
        $profile->load('camper');

        return response()->json([
            'message' => 'Behavioral profile created successfully.',
            'data' => $profile,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified behavioral profile.
     */
    public function show(BehavioralProfile $behavioralProfile): JsonResponse
    {
        $this->authorize('view', $behavioralProfile);

        $behavioralProfile->load('camper');

        return response()->json([
            'data' => $behavioralProfile,
        ]);
    }

    /**
     * Update the specified behavioral profile.
     */
    public function update(UpdateBehavioralProfileRequest $request, BehavioralProfile $behavioralProfile): JsonResponse
    {
        $this->authorize('update', $behavioralProfile);

        $behavioralProfile->update($request->validated());

        return response()->json([
            'message' => 'Behavioral profile updated successfully.',
            'data' => $behavioralProfile,
        ]);
    }

    /**
     * Remove the specified behavioral profile.
     */
    public function destroy(BehavioralProfile $behavioralProfile): JsonResponse
    {
        $this->authorize('delete', $behavioralProfile);

        $behavioralProfile->delete();

        return response()->json([
            'message' => 'Behavioral profile deleted successfully.',
        ]);
    }
}
