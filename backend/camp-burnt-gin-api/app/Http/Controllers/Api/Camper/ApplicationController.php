<?php

namespace App\Http\Controllers\Api\Camper;

use App\Enums\ApplicationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Application\ReviewApplicationRequest;
use App\Http\Requests\Application\SignApplicationRequest;
use App\Http\Requests\Application\StoreApplicationRequest;
use App\Http\Requests\Application\UpdateApplicationRequest;
use App\Models\Application;
use App\Notifications\Camper\ApplicationSubmittedNotification;
use App\Services\Camper\ApplicationService;
use App\Services\SystemNotificationService;
use App\Traits\QueuesNotifications;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for managing camp application resources.
 *
 * This controller handles CRUD operations for camp applications.
 * All actions are protected by ApplicationPolicy authorization.
 * Implements FR-4 through FR-6, FR-9, FR-12, FR-14, FR-27, FR-28.
 */
class ApplicationController extends Controller
{
    use QueuesNotifications;

    public function __construct(
        protected ApplicationService $applicationService,
        protected SystemNotificationService $systemNotifications,
    ) {}

    /**
     * Display a listing of applications with search and filter support.
     *
     * Administrators see all applications with full filtering.
     * Parents see only applications for their own children.
     * Medical providers are denied access.
     * Implements FR-14: Search and filter applications.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isAdmin()) {
            $this->authorize('viewAny', Application::class);
            $query = Application::with([
                'camper.user',
                'camper.medicalRecord',
                'campSession.camp',
                'reviewer',
            ]);

            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }

            if ($request->filled('camp_session_id')) {
                $query->where('camp_session_id', $request->camp_session_id);
            }

            if ($request->filled('search')) {
                $search = $request->search;
                $query->whereHas('camper', function ($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%");
                })->orWhereHas('camper.user', function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            }

            if ($request->filled('date_from')) {
                $query->whereDate('submitted_at', '>=', $request->date_from);
            }

            if ($request->filled('date_to')) {
                $query->whereDate('submitted_at', '<=', $request->date_to);
            }

            if ($request->boolean('drafts_only')) {
                $query->where('is_draft', true);
            }

            $sortField = $request->get('sort', 'created_at');
            $sortDir = $request->get('direction', 'desc');
            $allowedSorts = ['created_at', 'submitted_at', 'status', 'reviewed_at'];
            if (in_array($sortField, $allowedSorts)) {
                $query->orderBy($sortField, $sortDir === 'asc' ? 'asc' : 'desc');
            }

            $applications = $query->paginate($request->get('per_page', 15));
        } elseif ($user->isApplicant()) {
            $camperIds = $user->campers()->pluck('id');
            $applications = Application::whereIn('camper_id', $camperIds)
                ->with([
                    'camper.user',
                    'camper.medicalRecord',
                    'campSession.camp',
                    'reviewer',
                ])
                ->latest()
                ->paginate(15);
        } else {
            $this->authorize('viewAny', Application::class);
            $applications = collect()->paginate(15);
        }

        return response()->json([
            'data' => $applications->items(),
            'meta' => [
                'current_page' => $applications->currentPage(),
                'last_page' => $applications->lastPage(),
                'per_page' => $applications->perPage(),
                'total' => $applications->total(),
            ],
        ]);
    }

    /**
     * Store a newly created application.
     *
     * Supports draft mode for saving incomplete applications.
     * Implements FR-4: Save and return to draft.
     *
     * Wraps application creation and notification queueing in a transaction
     * to prevent inconsistent state between database and notification queue.
     */
    public function store(StoreApplicationRequest $request): JsonResponse
    {
        $this->authorize('create', Application::class);

        $data = $request->validated();
        $isDraft = $request->boolean('is_draft', false);

        $data['is_draft'] = $isDraft;
        $data['status'] = ApplicationStatus::Pending;

        if (! $isDraft) {
            $data['submitted_at'] = now();
        }

        $application = DB::transaction(function () use ($data, $isDraft) {
            $application = Application::create($data);
            $application->load(['camper', 'campSession']);

            if (! $isDraft) {
                $this->queueNotification(
                    $application->camper->user,
                    new ApplicationSubmittedNotification($application)
                );
                // System inbox notification
                $camperName = $application->camper->first_name . ' ' . $application->camper->last_name;
                $this->systemNotifications->applicationSubmitted(
                    $application->camper->user, $application->id, $camperName
                );
            }

            return $application;
        });

        return response()->json([
            'message' => $isDraft ? 'Application draft saved.' : 'Application submitted successfully.',
            'data' => $application,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified application.
     */
    public function show(Application $application): JsonResponse
    {
        $this->authorize('view', $application);

        $application->load(['camper', 'campSession.camp', 'reviewer']);

        return response()->json([
            'data' => $application,
        ]);
    }

    /**
     * Update the specified application.
     *
     * Supports updating draft applications and editing submitted ones.
     * Implements FR-5 and FR-6: Edit submitted and previously submitted applications.
     */
    public function update(UpdateApplicationRequest $request, Application $application): JsonResponse
    {
        $this->authorize('update', $application);

        $data = $request->validated();

        if ($application->isDraft() && $request->has('submit') && $request->boolean('submit')) {
            $data['is_draft'] = false;
            $data['submitted_at'] = now();
        }

        $application->update($data);

        if (isset($data['is_draft']) && $data['is_draft'] === false && $application->wasChanged('is_draft')) {
            $this->queueNotification(
                $application->camper->user,
                new ApplicationSubmittedNotification($application)
            );
        }

        return response()->json([
            'message' => 'Application updated successfully.',
            'data' => $application,
        ]);
    }

    /**
     * Remove the specified application.
     *
     * Only administrators can delete applications.
     */
    public function destroy(Application $application): JsonResponse
    {
        $this->authorize('delete', $application);

        $application->delete();

        return response()->json([
            'message' => 'Application deleted successfully.',
        ]);
    }

    /**
     * Review and update the status of an application.
     *
     * Only administrators can review applications.
     * Enforces medical document compliance before approval.
     * Sends acceptance/rejection letters as appropriate.
     * Implements FR-15, FR-18: Admin review and letters.
     */
    public function review(ReviewApplicationRequest $request, Application $application): JsonResponse
    {
        $this->authorize('review', $application);

        $newStatus = ApplicationStatus::from($request->validated('status'));

        // Delegate business logic to ApplicationService
        $result = $this->applicationService->reviewApplication(
            application: $application,
            newStatus: $newStatus,
            notes: $request->validated('notes'),
            reviewedBy: $request->user()
        );

        // Handle compliance failure
        if (! $result['success']) {
            return response()->json([
                'message' => 'Application cannot be approved due to incomplete medical documentation.',
                'errors' => [
                    'compliance' => 'Required medical documents are missing, expired, or unverified.',
                ],
                'compliance_details' => $result['compliance_details'],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return response()->json([
            'message' => 'Application reviewed successfully.',
            'data' => $application->fresh(),
        ]);
    }

    /**
     * Sign an application digitally.
     *
     * Implements FR-9: Digital signature support.
     */
    public function sign(SignApplicationRequest $request, Application $application): JsonResponse
    {
        $this->authorize('update', $application);

        if ($application->isSigned()) {
            return response()->json([
                'message' => 'Application has already been signed.',
            ], Response::HTTP_BAD_REQUEST);
        }

        $application->update([
            'signature_data' => $request->validated('signature_data'),
            'signature_name' => $request->validated('signature_name'),
            'signed_at' => now(),
            'signed_ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Application signed successfully.',
            'data' => $application,
        ]);
    }
}
