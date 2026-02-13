<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CampSession\StoreCampSessionRequest;
use App\Http\Requests\CampSession\UpdateCampSessionRequest;
use App\Models\CampSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for camp session management.
 *
 * Provides camp session listing and admin management capabilities.
 */
class CampSessionController extends Controller
{
    /**
     * Display a listing of camp sessions.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', CampSession::class);

        $query = CampSession::with('camp');

        if (! $request->user()->isAdmin()) {
            $query->where('is_active', true);
        }

        if ($request->filled('camp_id')) {
            $query->where('camp_id', $request->camp_id);
        }

        if ($request->boolean('available_only')) {
            $query->where('registration_opens_at', '<=', now())
                ->where('registration_closes_at', '>=', now());
        }

        // PERFORMANCE: Paginate to prevent loading all sessions at once
        $sessions = $query->orderBy('start_date')
            ->paginate(config('app.pagination_per_page', 15));

        return response()->json($sessions);
    }

    /**
     * Display the specified camp session.
     */
    public function show(CampSession $session): JsonResponse
    {
        $session->load('camp');

        return response()->json([
            'data' => $session,
        ]);
    }

    /**
     * Store a newly created camp session.
     */
    public function store(StoreCampSessionRequest $request): JsonResponse
    {
        $this->authorize('create', CampSession::class);

        $session = CampSession::create($request->validated());

        return response()->json([
            'message' => 'Camp session created successfully.',
            'data' => $session,
        ], Response::HTTP_CREATED);
    }

    /**
     * Update the specified camp session.
     */
    public function update(UpdateCampSessionRequest $request, CampSession $session): JsonResponse
    {
        $this->authorize('update', $session);

        $session->update($request->validated());

        return response()->json([
            'message' => 'Camp session updated successfully.',
            'data' => $session,
        ]);
    }

    /**
     * Remove the specified camp session.
     */
    public function destroy(CampSession $session): JsonResponse
    {
        $this->authorize('delete', $session);

        $session->delete();

        return response()->json([
            'message' => 'Camp session deleted successfully.',
        ]);
    }
}
