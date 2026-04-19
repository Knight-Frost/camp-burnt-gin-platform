<?php

namespace App\Http\Controllers\Api\Risk;

use App\Http\Controllers\Controller;
use App\Models\RiskThreshold;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * RiskThresholdController — Medical staff interface for configuring supervision
 * level and complexity tier score boundaries.
 *
 * Allows the medical director to raise or lower score thresholds based on
 * available staffing and camp capacity — without code changes.
 */
class RiskThresholdController extends Controller
{
    /**
     * GET /api/risk-thresholds
     * All thresholds grouped by type (supervision | complexity).
     */
    public function index(): JsonResponse
    {
        $this->authorize('viewAny', RiskThreshold::class);

        $thresholds = RiskThreshold::orderBy('threshold_type')
            ->orderBy('min_score')
            ->get()
            ->groupBy('threshold_type');

        return response()->json(['data' => $thresholds]);
    }

    /**
     * PUT /api/risk-thresholds/{riskThreshold}
     * Update score boundaries or labels for a threshold.
     * Invalidates risk engine cache after save.
     */
    public function update(Request $request, RiskThreshold $riskThreshold): JsonResponse
    {
        $this->authorize('update', $riskThreshold);

        $validated = $request->validate([
            'label' => 'sometimes|string|max:255',
            'min_score' => 'sometimes|integer|min:0|max:100',
            'max_score' => 'nullable|integer|min:0|max:100',
            'staffing_ratio' => 'nullable|string|max:50',
            'intervention_description' => 'nullable|string|max:255',
            'sort_order' => 'integer|min:0',
        ]);

        $riskThreshold->update($validated);
        SpecialNeedsRiskAssessmentService::invalidateCache();

        return response()->json([
            'message' => 'Risk threshold updated successfully.',
            'data' => $riskThreshold->fresh(),
        ]);
    }
}
