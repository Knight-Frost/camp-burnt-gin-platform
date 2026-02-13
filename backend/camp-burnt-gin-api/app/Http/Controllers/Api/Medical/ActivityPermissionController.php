<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Http\Requests\ActivityPermission\StoreActivityPermissionRequest;
use App\Http\Requests\ActivityPermission\UpdateActivityPermissionRequest;
use App\Models\ActivityPermission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for managing activity permission resources.
 *
 * This controller handles operations for camper activity participation
 * restrictions and accommodations. All actions are protected by
 * ActivityPermissionPolicy.
 */
class ActivityPermissionController extends Controller
{
    /**
     * Display a listing of activity permissions.
     *
     * Accessible by administrators and medical providers only.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', ActivityPermission::class);

        $permissions = ActivityPermission::with('camper')->paginate(15);

        return response()->json([
            'data' => $permissions->items(),
            'meta' => [
                'current_page' => $permissions->currentPage(),
                'last_page' => $permissions->lastPage(),
                'per_page' => $permissions->perPage(),
                'total' => $permissions->total(),
            ],
        ]);
    }

    /**
     * Store a newly created activity permission.
     */
    public function store(StoreActivityPermissionRequest $request): JsonResponse
    {
        $this->authorize('create', ActivityPermission::class);

        $permission = ActivityPermission::create($request->validated());
        $permission->load('camper');

        return response()->json([
            'message' => 'Activity permission created successfully.',
            'data' => $permission,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified activity permission.
     */
    public function show(ActivityPermission $activityPermission): JsonResponse
    {
        $this->authorize('view', $activityPermission);

        $activityPermission->load('camper');

        return response()->json([
            'data' => $activityPermission,
        ]);
    }

    /**
     * Update the specified activity permission.
     */
    public function update(UpdateActivityPermissionRequest $request, ActivityPermission $activityPermission): JsonResponse
    {
        $this->authorize('update', $activityPermission);

        $activityPermission->update($request->validated());

        return response()->json([
            'message' => 'Activity permission updated successfully.',
            'data' => $activityPermission,
        ]);
    }

    /**
     * Remove the specified activity permission.
     */
    public function destroy(ActivityPermission $activityPermission): JsonResponse
    {
        $this->authorize('delete', $activityPermission);

        $activityPermission->delete();

        return response()->json([
            'message' => 'Activity permission deleted successfully.',
        ]);
    }
}
