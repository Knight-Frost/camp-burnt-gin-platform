<?php

namespace App\Http\Controllers\Api\Camper;

use App\Http\Controllers\Controller;
use App\Http\Requests\Camper\StoreCamperRequest;
use App\Http\Requests\Camper\UpdateCamperRequest;
use App\Models\AuditLog;
use App\Models\Camper;
use App\Services\Document\DocumentEnforcementService;
use App\Services\Medical\MedicalAlertService;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * CamperController — Full CRUD for camper profiles, plus medical intelligence endpoints.
 *
 * A "camper" is a child registered in the system by their parent (applicant).
 * This controller manages who can see and change camper records:
 *
 *   - Admins      → full visibility and control over all campers.
 *   - Medical     → read access to all campers (clinical workflows).
 *   - Applicants  → see and manage only their own children.
 *
 * Beyond basic CRUD, it also exposes three computed endpoints that derive
 * clinical intelligence directly from the camper's medical record at request
 * time — no separate alerts table needed.
 *
 * All actions are gated by CamperPolicy authorization rules.
 */
class CamperController extends Controller
{
    /**
     * Display a listing of campers.
     *
     * GET /api/campers
     *
     * The response data varies by the caller's role:
     *   - Admin       → all campers, with user/medical data, plus optional name/ID search.
     *   - Medical     → all campers, with deeper medical record detail (allergies, meds, diagnoses).
     *   - Applicant   → only campers belonging to the authenticated user.
     *   - Other roles → empty result set (no error, just nothing returned).
     *
     * Results are paginated in pages of 15.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isAdmin()) {
            // Confirm this admin is allowed to list all campers via CamperPolicy.
            $this->authorize('viewAny', Camper::class);
            // Only surface campers whose families have at least one formally-submitted
            // application. Pre-submission campers are private to the family.
            // Eager-load only the non-draft applications — PHI lives in show(), not here.
            $query = Camper::whereHas('applications', fn ($q) => $q->where('is_draft', false))
                ->with([
                    'user',
                    'applications' => fn ($q) => $q->where('is_draft', false)->with('campSession'),
                ]);
            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    // full_name is a virtual computed attribute — not a stored DB column.
                    // Search first_name and last_name separately to avoid a SQL column-not-found error.
                    $q->where('first_name', 'like', '%'.$search.'%')
                        ->orWhere('last_name', 'like', '%'.$search.'%');
                    if (ctype_digit($search)) {
                        $q->orWhere('id', (int) $search);
                    }
                });
            }
            // Filter by session — narrows to campers who have at least one application
            // for the specified camp session ID.
            if ($request->filled('session_id')) {
                $query->whereHas('applications', function ($q) use ($request) {
                    $q->where('camp_session_id', $request->session_id);
                });
            }
            $campers = $query->paginate(15);
        } elseif ($user->isMedicalProvider()) {
            // Medical providers see only operationally active campers — those with at least
            // one approved application. Campers whose applications have been reversed or
            // cancelled are excluded from clinical workflows until re-approved.
            //
            // PHI chains (allergies/medications/diagnoses) are NOT eager-loaded here:
            // the fields are encrypted and decryption is O(n) per row, so pulling them
            // into a paginated list triggers DecryptException under realistic data sizes.
            // Detail-level PHI is loaded by the show() endpoint only.
            $query = Camper::active();
            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    // Same fix as admin branch — full_name is virtual, search real columns.
                    $q->where('first_name', 'like', '%'.$search.'%')
                        ->orWhere('last_name', 'like', '%'.$search.'%');
                    if (ctype_digit($search)) {
                        $q->orWhere('id', (int) $search);
                    }
                });
            }
            $campers = $query->paginate(15);
        } elseif ($user->isApplicant()) {
            // Parents only see the campers they personally registered — scoped via the relationship.
            $campers = $user->campers()->paginate(15);
        } else {
            // User has no recognised role — return empty result.
            return response()->json([
                'data' => [],
                'meta' => [
                    'current_page' => 1,
                    'last_page' => 1,
                    'per_page' => 15,
                    'total' => 0,
                ],
            ]);
        }

        // Shape pagination metadata consistently so the frontend can build page controls.
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
     *
     * POST /api/campers
     *
     * Step-by-step:
     *   1. CamperPolicy confirms the authenticated user may create a camper.
     *   2. Validated data from StoreCamperRequest is used (no raw input).
     *   3. For non-admin callers the user_id is forced to their own ID — they
     *      cannot create a camper on behalf of a different parent account.
     *   4. The new camper record is saved and returned.
     */
    public function store(StoreCamperRequest $request): JsonResponse
    {
        $this->authorize('create', Camper::class);

        $data = $request->validated();

        // Prevent a non-admin from supplying a different user_id and hijacking another account's campers.
        if (! $request->user()->isAdmin()) {
            $data['user_id'] = $request->user()->id;
        }

        // Camper identity = (user_id, first_name, last_name, date_of_birth).
        // Creating the same tuple twice returns the existing row instead of a
        // duplicate profile. A parent restarting the application flow must
        // not end up with two Camper rows for the same child (BUG-215).
        // Includes soft-deleted rows so "deleted" duplicates get restored
        // rather than recreated behind them.
        //
        // whereDate() is used for date_of_birth so the comparison works
        // across both MySQL (date column) and SQLite (stores date+time).
        $existing = Camper::withTrashed()
            ->where('user_id', $data['user_id'])
            ->where('first_name', $data['first_name'])
            ->where('last_name', $data['last_name'])
            ->whereDate('date_of_birth', $data['date_of_birth'])
            ->first();

        if ($existing !== null) {
            if ($existing->trashed()) {
                $existing->restore();
            }

            // Apply any newly-provided non-identity fields (e.g. updated t-shirt
            // size, gender correction). Identity fields are excluded so they
            // cannot be overwritten via this idempotent path.
            $mutable = array_diff_key($data, array_flip([
                'user_id', 'first_name', 'last_name', 'date_of_birth',
            ]));
            if (! empty($mutable)) {
                $existing->fill($mutable)->save();
            }

            return response()->json([
                'message' => 'Existing camper returned (idempotent create).',
                'data' => $existing,
            ], Response::HTTP_OK);
        }

        $camper = Camper::create($data);

        return response()->json([
            'message' => 'Camper created successfully.',
            'data' => $camper,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified camper.
     *
     * GET /api/campers/{camper}
     *
     * CamperPolicy ensures the viewer is either an admin, medical provider,
     * or the parent of this specific camper.
     * The user relationship and all camp applications (with session info) are eager-loaded.
     */
    public function show(Camper $camper): JsonResponse
    {
        $this->authorize('view', $camper);

        // Load the parent user account, submitted application history, and all clinical sub-records.
        // PHI fields are decrypted at read-time by Eloquent casts; this is intentional for
        // the individual show endpoint (not a list) — only privileged roles reach this via CamperPolicy.
        // Draft applications are excluded so the admin Applications section only shows
        // formally-submitted records — preventing draft `status='submitted'` rows from
        // appearing as if the family has already applied.
        $camper->load([
            'user',
            'applications' => fn ($q) => $q->where('is_draft', false)->with('campSession'),
            'behavioralProfile',
            'emergencyContacts',
            'medicalRecord',
            'diagnoses',
            'allergies',
            'medications',
            'feedingPlan',
            'personalCarePlan',
            'assistiveDevices',
            'activityPermissions',
        ]);

        return response()->json([
            'data' => $camper,
        ]);
    }

    /**
     * Update the specified camper.
     *
     * PUT/PATCH /api/campers/{camper}
     *
     * UpdateCamperRequest validates the incoming fields before they reach the model.
     * CamperPolicy ensures only admins or the camper's own parent can update.
     */
    public function update(UpdateCamperRequest $request, Camper $camper): JsonResponse
    {
        $this->authorize('update', $camper);

        $data = $request->validated();
        $oldSnapshot = array_intersect_key($camper->only(array_keys($data)), $data);

        $camper->update($data);

        $newSnapshot = array_intersect_key($camper->fresh()->only(array_keys($data)), $data);

        if ($oldSnapshot !== $newSnapshot) {
            AuditLog::logContentChange(
                auditable: $camper,
                editor: $request->user(),
                oldValues: $oldSnapshot,
                newValues: $newSnapshot,
            );
        }

        return response()->json([
            'message' => 'Camper updated successfully.',
            'data' => $camper,
        ]);
    }

    /**
     * Remove the specified camper.
     *
     * DELETE /api/campers/{camper}
     *
     * Soft-deletes the camper record (the model uses SoftDeletes).
     * Only admins are permitted to delete campers via CamperPolicy.
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
     * Get computed medical alerts for the specified camper.
     *
     * GET /api/campers/{camper}/medical-alerts
     *
     * Alerts are derived in real-time from the camper's clinical record:
     * severe / life-threatening allergies, seizure history, neurostimulator
     * presence, critical diagnoses, and required medications. No separate
     * alerts table is needed — the computation stays close to the source data.
     *
     * Medical staff see these alerts prominently when opening a camper's
     * record so critical information is never buried in sub-sections.
     *
     * The service is injected by Laravel's container — no manual instantiation needed.
     */
    public function medicalAlerts(Camper $camper, MedicalAlertService $alertService): JsonResponse
    {
        // CamperPolicy enforces that only authorized roles can view this camper's data.
        $this->authorize('view', $camper);

        // The service inspects allergies, diagnoses, and medications to produce alert objects.
        $alerts = $alertService->alertsFor($camper);

        return response()->json([
            'data' => $alerts,
        ]);
    }

    /**
     * Get risk assessment summary for the specified camper.
     *
     * GET /api/campers/{camper}/risk-summary
     *
     * Returns medical complexity risk score, supervision level,
     * complexity tier, and active risk flags for care planning
     * and staffing ratio determination.
     *
     * This helps the camp determine how many staff members are needed per
     * camper based on their individual medical complexity.
     */
    public function riskSummary(Camper $camper, SpecialNeedsRiskAssessmentService $riskService): JsonResponse
    {
        $this->authorize('view', $camper);

        // Risk assessment data is operational/clinical information for staff only.
        // Applicants (parents) can view their own child's camper profile via CamperPolicy::view,
        // but they must not access risk scores, supervision assignments, or medical flags —
        // those are internal staffing decisions, not parent-facing data.
        if (auth()->user()->isApplicant()) {
            abort(403, 'Risk assessment data is not accessible to applicants.');
        }

        // The service scores the camper's medical record and returns a structured assessment.
        $assessment = $riskService->assessCamper($camper);

        // Determine effective supervision level (may differ if a clinical override is in place)
        $storedAssessment = $assessment['assessment'];
        $effectiveLevel = $storedAssessment->effectiveSupervisionLevel();

        return response()->json([
            'data' => [
                // Numeric score driving all other tier/level decisions.
                'risk_score' => $assessment['risk_score'],
                // Enum value (e.g., "high") for programmatic use in the frontend.
                'supervision_level' => $assessment['supervision_level']->value,
                // Human-readable label (e.g., "High Supervision") for display.
                'supervision_label' => $assessment['supervision_level']->label(),
                // Staff-to-camper ratio string (e.g., "1:2") for scheduling.
                'staffing_ratio' => $assessment['supervision_level']->getStaffingRatio(),
                // Effective level (respects clinical override if one is set)
                'effective_supervision_level' => $effectiveLevel->value,
                'effective_supervision_label' => $effectiveLevel->label(),
                'effective_staffing_ratio' => $effectiveLevel->getStaffingRatio(),
                'medical_complexity_tier' => $assessment['medical_complexity_tier']->value,
                'complexity_label' => $assessment['medical_complexity_tier']->label(),
                // Individual flags (e.g., "seizure_history") that contributed to the score.
                'flags' => $assessment['flags'],
                // Review state — lets the compact card show the review badge
                'review_status' => $storedAssessment->review_status->value,
                'review_status_label' => $storedAssessment->review_status->label(),
                'is_overridden' => $storedAssessment->isOverridden(),
            ],
        ]);
    }

    /**
     * Get medical document compliance status for the specified camper.
     *
     * GET /api/campers/{camper}/compliance
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

        // The service inspects required vs. uploaded documents and returns a compliance summary.
        $compliance = $documentEnforcement->checkCompliance($camper);

        return response()->json([
            'data' => $compliance,
        ]);
    }

    /**
     * Return stable, non-medical prefill data for a camper.
     *
     * GET /api/campers/{camper}/prefill
     *
     * Used by the "Apply for a new session" flow so returning applicants do not
     * have to re-enter stable information (guardian details, address, county, etc.)
     * they already provided. Only data that is safe to carry forward is included:
     *
     *   ✓  Camper basic profile (name, DOB, gender, tshirt, county, address,
     *      preferred_name, needs_interpreter, preferred_language)
     *   ✓  Guardian 1 / Guardian 2 / Emergency contact (full structured contact)
     *   ✓  Whether this is a returning application (attended_before = true)
     *
     *   ✗  Medical record (diagnoses, allergies, medications, physician info)
     *   ✗  Behavioral profile, feeding plan, personal care plan
     *   ✗  Assistive devices, activity permissions
     *   ✗  Documents, consents, signatures
     *
     * Authorization: applicants may only request prefill for their own camper.
     * The standard CamperPolicy::view() gate is used — no separate policy needed.
     */
    public function prefill(Camper $camper): JsonResponse
    {
        $this->authorize('view', $camper);

        // Load emergency contacts once (guardians + plain emergency contacts).
        /** @var \Illuminate\Database\Eloquent\Collection<int, \App\Models\EmergencyContact> $contacts */
        $contacts = $camper->emergencyContacts()->get();

        $guardian1 = $contacts->first(fn ($c) => $c->is_guardian && $c->is_primary);
        $guardian2 = $contacts->first(fn ($c) => $c->is_guardian && ! $c->is_primary);
        $ec = $contacts->first(fn ($c) => ! $c->is_guardian);

        // Determine if this camper has at least one previously submitted application.
        // This drives the "attended_before" and "first_application" flags in the form.
        $hasSubmitted = $camper->applications()
            ->where('is_draft', false)
            ->whereNotNull('submitted_at')
            ->exists();

        // applicant_address is hidden from default serialization — expose it manually.
        return response()->json([
            'data' => [
                'camper' => [
                    'first_name' => (string) ($camper->first_name ?? ''),
                    'last_name' => (string) ($camper->last_name ?? ''),
                    'preferred_name' => (string) ($camper->preferred_name ?? ''),
                    'date_of_birth' => (string) ($camper->date_of_birth ?? ''),
                    'gender' => (string) ($camper->gender ?? ''),
                    'tshirt_size' => (string) ($camper->tshirt_size ?? ''),
                    'county' => (string) ($camper->county ?? ''),
                    'needs_interpreter' => (bool) ($camper->needs_interpreter ?? false),
                    'preferred_language' => (string) ($camper->preferred_language ?? ''),
                    // applicant_address is PHI encrypted at rest; safe to return to the
                    // applicant who originally submitted it (their own data).
                    'address' => (string) ($camper->applicant_address ?? ''),
                    'city' => (string) ($camper->applicant_city ?? ''),
                    'state' => (string) ($camper->applicant_state ?? ''),
                    'zip' => (string) ($camper->applicant_zip ?? ''),
                ],
                'guardian1' => $guardian1 ? [
                    'name' => (string) ($guardian1->name ?? ''),
                    'relationship' => (string) ($guardian1->relationship ?? ''),
                    'phone_home' => (string) ($guardian1->phone_primary ?? ''),
                    'phone_work' => (string) ($guardian1->phone_work ?? ''),
                    'phone_cell' => (string) ($guardian1->phone_secondary ?? ''),
                    'email' => (string) ($guardian1->email ?? ''),
                    'address' => (string) ($guardian1->address ?? ''),
                    'city' => (string) ($guardian1->city ?? ''),
                    'state' => (string) ($guardian1->state ?? ''),
                    'zip' => (string) ($guardian1->zip ?? ''),
                    'primary_language' => (string) ($guardian1->primary_language ?? ''),
                    'interpreter_needed' => (bool) ($guardian1->interpreter_needed ?? false),
                ] : null,
                'guardian2' => $guardian2 ? [
                    'name' => (string) ($guardian2->name ?? ''),
                    'relationship' => (string) ($guardian2->relationship ?? ''),
                    'phone_home' => (string) ($guardian2->phone_primary ?? ''),
                    'phone_work' => (string) ($guardian2->phone_work ?? ''),
                    'phone_cell' => (string) ($guardian2->phone_secondary ?? ''),
                    'email' => (string) ($guardian2->email ?? ''),
                    'address' => (string) ($guardian2->address ?? ''),
                    'city' => (string) ($guardian2->city ?? ''),
                    'state' => (string) ($guardian2->state ?? ''),
                    'zip' => (string) ($guardian2->zip ?? ''),
                    'primary_language' => (string) ($guardian2->primary_language ?? ''),
                    'interpreter_needed' => (bool) ($guardian2->interpreter_needed ?? false),
                ] : null,
                'emergency_contact' => $ec ? [
                    'name' => (string) ($ec->name ?? ''),
                    'relationship' => (string) ($ec->relationship ?? ''),
                    'phone_home' => (string) ($ec->phone_primary ?? ''),
                    'phone_work' => (string) ($ec->phone_work ?? ''),
                    'phone_cell' => (string) ($ec->phone_secondary ?? ''),
                    'address' => (string) ($ec->address ?? ''),
                    'city' => (string) ($ec->city ?? ''),
                    'state' => (string) ($ec->state ?? ''),
                    'zip' => (string) ($ec->zip ?? ''),
                    'primary_language' => (string) ($ec->primary_language ?? ''),
                    'interpreter_needed' => (bool) ($ec->interpreter_needed ?? false),
                ] : null,
                // Tells the form whether attended_before / first_application should be set.
                'has_prior_submitted_application' => $hasSubmitted,
            ],
        ]);
    }
}
