<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Http\Requests\Allergy\StoreAllergyRequest;
use App\Http\Requests\Allergy\UpdateAllergyRequest;
use App\Models\Allergy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for managing allergy resources.
 *
 * This controller handles CRUD operations for camper allergies.
 * All actions are protected by AllergyPolicy authorization.
 */
class AllergyController extends Controller
{
    /**
     * Display a listing of allergies.
     *
     * Accessible by administrators and medical providers only.
     * Parents access their children's allergies via show endpoint.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Allergy::class);

        $allergies = Allergy::with('camper')->paginate(15);

        return response()->json([
            'data' => $allergies->items(),
            'meta' => [
                'current_page' => $allergies->currentPage(),
                'last_page' => $allergies->lastPage(),
                'per_page' => $allergies->perPage(),
                'total' => $allergies->total(),
            ],
        ]);
    }

    /**
     * Store a newly created allergy.
     */
    public function store(StoreAllergyRequest $request): JsonResponse
    {
        $this->authorize('create', Allergy::class);

        $allergy = Allergy::create($request->validated());
        $allergy->load('camper');

        return response()->json([
            'message' => 'Allergy created successfully.',
            'data' => $allergy,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified allergy.
     */
    public function show(Allergy $allergy): JsonResponse
    {
        $this->authorize('view', $allergy);

        $allergy->load('camper');

        return response()->json([
            'data' => $allergy,
        ]);
    }

    /**
     * Update the specified allergy.
     */
    public function update(UpdateAllergyRequest $request, Allergy $allergy): JsonResponse
    {
        $this->authorize('update', $allergy);

        $allergy->update($request->validated());

        return response()->json([
            'message' => 'Allergy updated successfully.',
            'data' => $allergy,
        ]);
    }

    /**
     * Remove the specified allergy.
     */
    public function destroy(Allergy $allergy): JsonResponse
    {
        $this->authorize('delete', $allergy);

        $allergy->delete();

        return response()->json([
            'message' => 'Allergy deleted successfully.',
        ]);
    }
}
