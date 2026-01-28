<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Camper\StoreCamperRequest;
use App\Http\Requests\Camper\UpdateCamperRequest;
use App\Models\Camper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for managing camper resources.
 *
 * This controller handles CRUD operations for camper profiles.
 * All actions are protected by CamperPolicy authorization.
 */
class CamperController extends Controller
{
    /**
     * Display a listing of campers.
     *
     * Administrators see all campers.
     * Parents see only their own children.
     * Medical providers are denied access.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isAdmin()) {
            $this->authorize('viewAny', Camper::class);
            $campers = Camper::with('user')->paginate(15);
        } elseif ($user->isParent()) {
            $campers = $user->campers()->paginate(15);
        } else {
            $this->authorize('viewAny', Camper::class);
            $campers = collect()->paginate(15);
        }

        return response()->json([
            'data' => $campers->items(),
            'meta' => [
                'current_page' => $campers->currentPage(),
                'last_page' => $campers->lastPage(),
                'per_page' => $campers->perPage(),
                'total' => $campers->total(),
            ],
        ]);
    }

    /**
     * Store a newly created camper.
     */
    public function store(StoreCamperRequest $request): JsonResponse
    {
        $this->authorize('create', Camper::class);

        $data = $request->validated();

        if (! $request->user()->isAdmin()) {
            $data['user_id'] = $request->user()->id;
        }

        $camper = Camper::create($data);

        return response()->json([
            'message' => 'Camper created successfully.',
            'data' => $camper,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified camper.
     */
    public function show(Camper $camper): JsonResponse
    {
        $this->authorize('view', $camper);

        $camper->load(['user', 'applications.campSession']);

        return response()->json([
            'data' => $camper,
        ]);
    }

    /**
     * Update the specified camper.
     */
    public function update(UpdateCamperRequest $request, Camper $camper): JsonResponse
    {
        $this->authorize('update', $camper);

        $camper->update($request->validated());

        return response()->json([
            'message' => 'Camper updated successfully.',
            'data' => $camper,
        ]);
    }

    /**
     * Remove the specified camper.
     */
    public function destroy(Camper $camper): JsonResponse
    {
        $this->authorize('delete', $camper);

        $camper->delete();

        return response()->json([
            'message' => 'Camper deleted successfully.',
        ]);
    }
}
