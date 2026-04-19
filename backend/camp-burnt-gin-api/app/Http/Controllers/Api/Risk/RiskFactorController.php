<?php

namespace App\Http\Controllers\Api\Risk;

use App\Http\Controllers\Controller;
use App\Models\RiskFactor;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * RiskFactorController — Medical staff interface for configuring risk factor scoring.
 *
 * Provides full CRUD for risk_factors. Any write operation invalidates the risk
 * engine cache so the next assessment picks up the new values immediately.
 *
 * Access restricted to medical and admin roles (not applicants).
 */
class RiskFactorController extends Controller
{
    /**
     * GET /api/risk-factors
     * List all risk factors grouped by category, ordered by sort_order.
     */
    public function index(): JsonResponse
    {
        $this->authorize('viewAny', RiskFactor::class);

        $factors = RiskFactor::orderBy('category')
            ->orderBy('sort_order')
            ->get()
            ->groupBy('category')
            ->map(fn ($group) => $group->values());

        return response()->json(['data' => $factors]);
    }

    /**
     * POST /api/risk-factors
     * Create a new risk factor. Key must be unique and snake_case.
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', RiskFactor::class);

        $validated = $request->validate([
            'key' => 'required|string|max:100|unique:risk_factors,key|regex:/^[a-z_]+$/',
            'label' => 'required|string|max:255',
            'category' => 'required|string|in:medical,behavioral,physical,feeding,allergy',
            'points' => 'required|integer|min:0|max:100',
            'per_item' => 'boolean',
            'source_model' => 'nullable|string|max:100',
            'tooltip' => 'nullable|string|max:2000',
            'is_active' => 'boolean',
            'sort_order' => 'integer|min:0',
        ]);

        $factor = RiskFactor::create($validated);
        SpecialNeedsRiskAssessmentService::invalidateCache();

        return response()->json([
            'message' => 'Risk factor created successfully.',
            'data' => $factor,
        ], Response::HTTP_CREATED);
    }

    /**
     * GET /api/risk-factors/{riskFactor}
     * Return a single risk factor.
     */
    public function show(RiskFactor $riskFactor): JsonResponse
    {
        $this->authorize('view', $riskFactor);

        return response()->json(['data' => $riskFactor]);
    }

    /**
     * PUT /api/risk-factors/{riskFactor}
     * Update a risk factor. Invalidates risk engine cache after save.
     */
    public function update(Request $request, RiskFactor $riskFactor): JsonResponse
    {
        $this->authorize('update', $riskFactor);

        $validated = $request->validate([
            'label' => 'sometimes|string|max:255',
            'category' => 'sometimes|string|in:medical,behavioral,physical,feeding,allergy',
            'points' => 'sometimes|integer|min:0|max:100',
            'per_item' => 'boolean',
            'source_model' => 'nullable|string|max:100',
            'tooltip' => 'nullable|string|max:2000',
            'is_active' => 'boolean',
            'sort_order' => 'integer|min:0',
        ]);

        $riskFactor->update($validated);
        SpecialNeedsRiskAssessmentService::invalidateCache();

        return response()->json([
            'message' => 'Risk factor updated successfully.',
            'data' => $riskFactor->fresh(),
        ]);
    }

    /**
     * DELETE /api/risk-factors/{riskFactor}
     * Permanently remove a risk factor. Invalidates cache.
     * Restricted to super_admin — deleting built-in factors can break detection logic.
     */
    public function destroy(RiskFactor $riskFactor): JsonResponse
    {
        $this->authorize('delete', $riskFactor);

        $riskFactor->delete();
        SpecialNeedsRiskAssessmentService::invalidateCache();

        return response()->json(['message' => 'Risk factor deleted successfully.']);
    }
}
