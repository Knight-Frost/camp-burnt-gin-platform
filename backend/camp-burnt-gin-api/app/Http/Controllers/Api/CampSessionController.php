<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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

        $sessions = $query->orderBy('start_date')->get();

        return response()->json([
            'data' => $sessions,
        ]);
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
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'camp_id' => ['required', 'exists:camps,id'],
            'name' => ['required', 'string', 'max:255'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'capacity' => ['required', 'integer', 'min:1'],
            'min_age' => ['nullable', 'integer', 'min:0'],
            'max_age' => ['nullable', 'integer', 'min:0', 'gte:min_age'],
            'registration_opens_at' => ['nullable', 'date'],
            'registration_closes_at' => ['nullable', 'date', 'after:registration_opens_at'],
            'is_active' => ['boolean'],
        ]);

        $session = CampSession::create($request->all());

        return response()->json([
            'message' => 'Camp session created successfully.',
            'data' => $session,
        ], Response::HTTP_CREATED);
    }

    /**
     * Update the specified camp session.
     */
    public function update(Request $request, CampSession $session): JsonResponse
    {
        $request->validate([
            'camp_id' => ['sometimes', 'exists:camps,id'],
            'name' => ['sometimes', 'string', 'max:255'],
            'start_date' => ['sometimes', 'date'],
            'end_date' => ['sometimes', 'date', 'after:start_date'],
            'capacity' => ['sometimes', 'integer', 'min:1'],
            'min_age' => ['nullable', 'integer', 'min:0'],
            'max_age' => ['nullable', 'integer', 'min:0'],
            'registration_opens_at' => ['nullable', 'date'],
            'registration_closes_at' => ['nullable', 'date'],
            'is_active' => ['boolean'],
        ]);

        $session->update($request->all());

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
        $session->delete();

        return response()->json([
            'message' => 'Camp session deleted successfully.',
        ]);
    }
}
