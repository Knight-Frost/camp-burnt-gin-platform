<?php

namespace App\Http\Controllers\Api\Risk;

use App\Http\Controllers\Controller;
use App\Models\RiskAssessment;
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

    /**
     * GET /api/risk-thresholds/impact?min_score=N&max_score=M&threshold_type=supervision
     *
     * Returns the count of current camper assessments whose risk_score falls within
     * the given range. Used by the UI to show "X campers would be affected" before
     * a threshold change is saved.
     */
    public function impact(Request $request): JsonResponse
    {
        $this->authorize('viewAny', RiskThreshold::class);

        $validated = $request->validate([
            'min_score'      => 'required|integer|min:0|max:100',
            'max_score'      => 'nullable|integer|min:0|max:100',
            'threshold_type' => 'sometimes|string|in:supervision,complexity',
        ]);

        $min = (int) $validated['min_score'];
        $max = isset($validated['max_score']) ? (int) $validated['max_score'] : null;

        $query = RiskAssessment::where('is_current', true)
            ->where('risk_score', '>=', $min);

        if ($max !== null) {
            $query->where('risk_score', '<=', $max);
        }

        $count = $query->count();

        return response()->json([
            'data' => [
                'affected_camper_count' => $count,
                'min_score' => $min,
                'max_score' => $max,
            ],
        ]);
    }
}
