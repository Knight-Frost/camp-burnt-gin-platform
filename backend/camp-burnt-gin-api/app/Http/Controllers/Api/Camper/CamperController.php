<?php

namespace App\Http\Controllers\Api\Camper;

use App\Http\Controllers\Controller;
use App\Http\Requests\Camper\StoreCamperRequest;
use App\Http\Requests\Camper\UpdateCamperRequest;
use App\Models\Camper;
use App\Services\Document\DocumentEnforcementService;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;
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
            $query = Camper::with(['user', 'medicalRecord.allergies', 'medicalRecord.medications']);
            if ($request->filled('search')) {
                $query->where('full_name', 'like', '%' . $request->input('search') . '%');
            }
            $campers = $query->paginate(15);
        } elseif ($user->isMedicalProvider()) {
            // Medical providers can browse all camper profiles to support clinical workflows.
            $query = Camper::with(['medicalRecord.allergies', 'medicalRecord.medications', 'medicalRecord.diagnoses']);
            if ($request->filled('search')) {
                $query->where('full_name', 'like', '%' . $request->input('search') . '%');
            }
            $campers = $query->paginate(15);
        } elseif ($user->isApplicant()) {
            $campers = $user->campers()->paginate(15);
        } else {
            // User has no recognised role — return empty result.
            return response()->json([
                'data' => [],
                'meta' => [
                    'current_page' => 1,
                    'last_page'    => 1,
                    'per_page'     => 15,
                    'total'        => 0,
                ],
            ]);
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

    /**
     * Get risk assessment summary for the specified camper.
     *
     * Returns medical complexity risk score, supervision level,
     * complexity tier, and active risk flags for care planning
     * and staffing ratio determination.
     */
    public function riskSummary(Camper $camper, SpecialNeedsRiskAssessmentService $riskService): JsonResponse
    {
        $this->authorize('view', $camper);

        $assessment = $riskService->assessCamper($camper);

        return response()->json([
            'data' => [
                'risk_score' => $assessment['risk_score'],
                'supervision_level' => $assessment['supervision_level']->value,
                'supervision_label' => $assessment['supervision_level']->label(),
                'staffing_ratio' => $assessment['supervision_level']->getStaffingRatio(),
                'medical_complexity_tier' => $assessment['medical_complexity_tier']->value,
                'complexity_label' => $assessment['medical_complexity_tier']->label(),
                'flags' => $assessment['flags'],
            ],
        ]);
    }

    /**
     * Get medical document compliance status for the specified camper.
     *
     * Returns compliance status including required documents, missing documents,
     * expired documents, and unverified documents. Used by parents to understand
     * what documentation is needed and by administrators to verify application
     * readiness for approval.
     *
     * Authorization: Admin, valid medical provider link, or parent (own camper only).
     */
    public function complianceStatus(Camper $camper, DocumentEnforcementService $documentEnforcement): JsonResponse
    {
        $this->authorize('view', $camper);

        $compliance = $documentEnforcement->checkCompliance($camper);

        return response()->json([
            'data' => $compliance,
        ]);
    }
}
