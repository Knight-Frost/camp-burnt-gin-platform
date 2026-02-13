<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Camp\StoreCampRequest;
use App\Http\Requests\Camp\UpdateCampRequest;
use App\Models\Camp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for camp program management.
 *
 * Provides public camp listing and admin management capabilities.
 */
class CampController extends Controller
{
    /**
     * Display a listing of camps.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Camp::class);

        $query = Camp::with('sessions');

        if (! $request->user()->isAdmin()) {
            $query->where('is_active', true);
        }

        // PERFORMANCE: Paginate to prevent loading all camps at once
        $camps = $query->paginate(config('app.pagination_per_page', 15));

        return response()->json($camps);
    }

    /**
     * Display the specified camp.
     */
    public function show(Camp $camp): JsonResponse
    {
        $camp->load('sessions');

        return response()->json([
            'data' => $camp,
        ]);
    }

    /**
     * Store a newly created camp.
     */
    public function store(StoreCampRequest $request): JsonResponse
    {
        $this->authorize('create', Camp::class);

        $camp = Camp::create($request->validated());

        return response()->json([
            'message' => 'Camp created successfully.',
            'data' => $camp,
        ], Response::HTTP_CREATED);
    }

    /**
     * Update the specified camp.
     */
    public function update(UpdateCampRequest $request, Camp $camp): JsonResponse
    {
        $this->authorize('update', $camp);

        $camp->update($request->validated());

        return response()->json([
            'message' => 'Camp updated successfully.',
            'data' => $camp,
        ]);
    }

    /**
     * Remove the specified camp.
     */
    public function destroy(Camp $camp): JsonResponse
    {
        $this->authorize('delete', $camp);

        $camp->delete();

        return response()->json([
            'message' => 'Camp deleted successfully.',
        ]);
    }
}
