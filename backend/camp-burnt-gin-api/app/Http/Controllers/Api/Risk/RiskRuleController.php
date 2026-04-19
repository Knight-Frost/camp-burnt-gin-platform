<?php

namespace App\Http\Controllers\Api\Risk;

use App\Http\Controllers\Controller;
use App\Models\RiskRule;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * RiskRuleController — Medical staff interface for configuring conditional scoring rules.
 *
 * Rules add bonus points when a combination of factors is present.
 * Example: IF seizures AND life_threatening_allergy THEN +5 pts.
 */
class RiskRuleController extends Controller
{
    /** GET /api/risk-rules */
    public function index(): JsonResponse
    {
        $this->authorize('viewAny', RiskRule::class);

        return response()->json(['data' => RiskRule::orderBy('name')->get()]);
    }

    /** POST /api/risk-rules */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', RiskRule::class);

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:risk_rules,name',
            'description' => 'nullable|string|max:2000',
            'conditions' => 'required|array|min:1',
            'conditions.*.factor_key' => 'required|string|exists:risk_factors,key',
            'conditions.*.present' => 'boolean',
            'points_adjustment' => 'required|integer|min:-50|max:50',
            'is_active' => 'boolean',
        ]);

        $rule = RiskRule::create($validated);
        SpecialNeedsRiskAssessmentService::invalidateCache();

        return response()->json([
            'message' => 'Risk rule created.',
            'data' => $rule,
        ], Response::HTTP_CREATED);
    }

    /** PUT /api/risk-rules/{riskRule} */
    public function update(Request $request, RiskRule $riskRule): JsonResponse
    {
        $this->authorize('update', $riskRule);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255|unique:risk_rules,name,'.$riskRule->id,
            'description' => 'nullable|string|max:2000',
            'conditions' => 'sometimes|array|min:1',
            'conditions.*.factor_key' => 'required_with:conditions|string|exists:risk_factors,key',
            'conditions.*.present' => 'boolean',
            'points_adjustment' => 'sometimes|integer|min:-50|max:50',
            'is_active' => 'boolean',
        ]);

        $riskRule->update($validated);
        SpecialNeedsRiskAssessmentService::invalidateCache();

        return response()->json([
            'message' => 'Risk rule updated.',
            'data' => $riskRule->fresh(),
        ]);
    }

    /** DELETE /api/risk-rules/{riskRule} */
    public function destroy(RiskRule $riskRule): JsonResponse
    {
        $this->authorize('delete', $riskRule);

        $riskRule->delete();
        SpecialNeedsRiskAssessmentService::invalidateCache();

        return response()->json(['message' => 'Risk rule deleted.']);
    }
}
