<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
        $query = Camp::with('sessions');

        if (! $request->user()->isAdmin()) {
            $query->where('is_active', true);
        }

        $camps = $query->get();

        return response()->json([
            'data' => $camps,
        ]);
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
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'location' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ]);

        $camp = Camp::create($request->all());

        return response()->json([
            'message' => 'Camp created successfully.',
            'data' => $camp,
        ], Response::HTTP_CREATED);
    }

    /**
     * Update the specified camp.
     */
    public function update(Request $request, Camp $camp): JsonResponse
    {
        $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'location' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ]);

        $camp->update($request->all());

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
        $camp->delete();

        return response()->json([
            'message' => 'Camp deleted successfully.',
        ]);
    }
}
