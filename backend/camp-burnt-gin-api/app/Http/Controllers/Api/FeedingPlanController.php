<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\FeedingPlan\StoreFeedingPlanRequest;
use App\Http\Requests\FeedingPlan\UpdateFeedingPlanRequest;
use App\Models\FeedingPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for managing feeding plan resources.
 *
 * This controller handles operations for camper feeding plans,
 * including specialized dietary needs and tube feeding protocols.
 * All actions are protected by FeedingPlanPolicy.
 */
class FeedingPlanController extends Controller
{
    /**
     * Display a listing of feeding plans.
     *
     * Accessible by administrators and medical providers only.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', FeedingPlan::class);

        $feedingPlans = FeedingPlan::with('camper')->paginate(15);

        return response()->json([
            'data' => $feedingPlans->items(),
            'meta' => [
                'current_page' => $feedingPlans->currentPage(),
                'last_page' => $feedingPlans->lastPage(),
                'per_page' => $feedingPlans->perPage(),
                'total' => $feedingPlans->total(),
            ],
        ]);
    }

    /**
     * Store a newly created feeding plan.
     */
    public function store(StoreFeedingPlanRequest $request): JsonResponse
    {
        $this->authorize('create', FeedingPlan::class);

        $feedingPlan = FeedingPlan::create($request->validated());
        $feedingPlan->load('camper');

        return response()->json([
            'message' => 'Feeding plan created successfully.',
            'data' => $feedingPlan,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified feeding plan.
     */
    public function show(FeedingPlan $feedingPlan): JsonResponse
    {
        $this->authorize('view', $feedingPlan);

        $feedingPlan->load('camper');

        return response()->json([
            'data' => $feedingPlan,
        ]);
    }

    /**
     * Update the specified feeding plan.
     */
    public function update(UpdateFeedingPlanRequest $request, FeedingPlan $feedingPlan): JsonResponse
    {
        $this->authorize('update', $feedingPlan);

        $feedingPlan->update($request->validated());

        return response()->json([
            'message' => 'Feeding plan updated successfully.',
            'data' => $feedingPlan,
        ]);
    }

    /**
     * Remove the specified feeding plan.
     */
    public function destroy(FeedingPlan $feedingPlan): JsonResponse
    {
        $this->authorize('delete', $feedingPlan);

        $feedingPlan->delete();

        return response()->json([
            'message' => 'Feeding plan deleted successfully.',
        ]);
    }
}
