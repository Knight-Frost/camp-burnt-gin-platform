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
 * ApplicationController — Full lifecycle management for camp applications.
 *
 * A camp application links a specific camper to a specific camp session.
 * It can exist as a draft (saved but not submitted) or as a submitted application
 * that moves through a review workflow: pending → under_review → accepted/rejected.
 *
 * Role-based visibility:
 *   - Admin     → sees all applications across all families, with full filtering.
 *   - Applicant → sees only applications for their own children.
 *   - Medical   → no access to this resource.
 *
 * Key features:
 *   - Draft mode lets parents save progress and return later.
 *   - Document compliance is enforced before an admin can approve.
 *   - Digital signatures are stored with IP and timestamp for legal record.
 *   - Notifications are queued inside a DB transaction to prevent partial state.
 *
 * Implements FR-4 through FR-6, FR-9, FR-12, FR-14, FR-15, FR-18, FR-27, FR-28.
 */
class ApplicationController extends Controller
{
    // QueuesNotifications provides a queueNotification() helper that wraps queue dispatch safely.
    use QueuesNotifications;

    public function __construct(
        protected ApplicationService $applicationService,
        protected SystemNotificationService $systemNotifications,
    ) {}

    /**
     * Display a listing of applications with search and filter support.
     *
     * GET /api/applications
     *
     * Admin callers receive a rich, filterable view of all applications.
     * Applicant callers receive only the applications for their own campers.
     * Any other role gets an empty paginated result (no 403, just nothing).
     *
     * Admin filter params:
     *   status, camp_session_id, search (name/email), date_from, date_to,
     *   drafts_only, sort (field), direction (asc/desc), per_page.
     *
     * Implements FR-14: Search and filter applications.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isAdmin()) {
            // CamperPolicy viewAny gate — confirms this admin role can list all applications.
            $this->authorize('viewAny', Application::class);
            // Eager-load related records so we don't hit the DB again for each application row.
            $query = Application::with([
                'camper.user',
                'camper.medicalRecord',
                'campSession.camp',
                'reviewer',
            ]);

            // Filter by status enum value (e.g., "pending", "accepted").
            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }

            // Narrow results to a single camp session (e.g., "Summer 2026 Week 1").
            if ($request->filled('camp_session_id')) {
                $query->where('camp_session_id', $request->camp_session_id);
            }

            // Full-text search across camper name and parent name/email.
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

            // Date range filter on submitted_at (not created_at, so drafts aren't included).
            if ($request->filled('date_from')) {
                $query->whereDate('submitted_at', '>=', $request->date_from);
            }

            if ($request->filled('date_to')) {
                $query->whereDate('submitted_at', '<=', $request->date_to);
            }

            // Optionally show only saved drafts (is_draft = true).
            if ($request->boolean('drafts_only')) {
                $query->where('is_draft', true);
            }

            // Dynamic sorting — only allow whitelisted columns to prevent SQL injection.
            $sortField = $request->get('sort', 'created_at');
            $sortDir = $request->get('direction', 'desc');
            $allowedSorts = ['created_at', 'submitted_at', 'status', 'reviewed_at'];
            if (in_array($sortField, $allowedSorts)) {
                $query->orderBy($sortField, $sortDir === 'asc' ? 'asc' : 'desc');
            }

            $applications = $query->paginate($request->get('per_page', 15));
        } elseif ($user->isApplicant()) {
            // Collect the IDs of all campers owned by this parent, then scope the query.
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
            // User has no recognised role — return empty result rather than 403.
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
     * POST /api/applications
     *
     * Supports draft mode for saving incomplete applications.
     * When is_draft is false, submitted_at is stamped and notifications are sent.
     *
     * The application creation and notification queueing are wrapped in a DB
     * transaction — if the notification dispatch fails, the application record
     * is also rolled back, keeping the database and queue in sync.
     *
     * Implements FR-4: Save and return to draft.
     */
    public function store(StoreApplicationRequest $request): JsonResponse
    {
        // ApplicationPolicy create gate — only applicants (and admins) can create.
        $this->authorize('create', Application::class);

        $data = $request->validated();
        // Default to draft mode if the client didn't explicitly pass is_draft.
        $isDraft = $request->boolean('is_draft', false);

        $data['is_draft'] = $isDraft;
        // All new applications start as Pending regardless of what the client sends.
        $data['status'] = ApplicationStatus::Pending;

        // Only stamp the submission timestamp when the application is actually submitted (not a draft).
        if (! $isDraft) {
            $data['submitted_at'] = now();
        }

        // Wrap creation + notification in a transaction so both succeed or both fail atomically.
        $application = DB::transaction(function () use ($data, $isDraft) {
            $application = Application::create($data);
            // Eager-load camper and session so the notification has all the data it needs.
            $application->load(['camper', 'campSession']);

            if (! $isDraft) {
                // Send a confirmation email to the parent via the queue.
                $this->queueNotification(
                    $application->camper->user,
                    new ApplicationSubmittedNotification($application)
                );
                // System inbox notification
                $camperName = $application->camper->first_name . ' ' . $application->camper->last_name;
                // Create an in-app system notification so the parent sees it in their inbox.
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
     *
     * GET /api/applications/{application}
     *
     * Returns the application with a comprehensive set of related data,
     * including all camper medical detail, behavioral profile, emergency contacts,
     * and attached documents — everything an admin needs for a full review.
     */
    public function show(Application $application): JsonResponse
    {
        // ApplicationPolicy view gate — admins see all; parents see only their own.
        $this->authorize('view', $application);

        // Deep-load all relationships needed by the ApplicationDetailPage.
        $application->load([
            'camper.user',
            'camper.medicalRecord.allergies',
            'camper.medicalRecord.medications',
            'camper.medicalRecord.diagnoses',
            'camper.emergencyContacts',
            'camper.behavioralProfile',
            'camper.feedingPlan',
            'camper.assistiveDevices',
            'camper.activityPermissions',
            'campSession.camp',
            'reviewer',
            'documents',
        ]);

        return response()->json([
            'data' => $application,
        ]);
    }

    /**
     * Update the specified application.
     *
     * PUT/PATCH /api/applications/{application}
     *
     * Handles two scenarios:
     *   1. Editing a draft (common — parent is filling out the form in stages).
     *   2. Promoting a draft to submitted by passing submit=true in the request.
     *
     * If the application transitions from draft to submitted, a confirmation
     * notification is queued for the parent.
     *
     * Implements FR-5 and FR-6: Edit submitted and previously submitted applications.
     */
    public function update(UpdateApplicationRequest $request, Application $application): JsonResponse
    {
        $this->authorize('update', $application);

        $data = $request->validated();

        // Check if this is a "submit now" action on a previously saved draft.
        if ($application->isDraft() && $request->has('submit') && $request->boolean('submit')) {
            $data['is_draft'] = false;
            $data['submitted_at'] = now();
        }

        $application->update($data);

        // If is_draft just flipped from true → false, the parent needs a confirmation notification.
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
     * DELETE /api/applications/{application}
     *
     * Only administrators can delete applications via ApplicationPolicy.
     * Applicants cannot delete their own applications once created.
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
     * POST /api/applications/{application}/review
     *
     * Only administrators can review applications.
     * The ApplicationService enforces medical document compliance before
     * allowing an approval — if documents are missing, expired, or unverified
     * the approval is blocked and the compliance details are returned.
     *
     * On approval or rejection, the ApplicationService also fires acceptance/
     * rejection letter notifications to the parent.
     *
     * Implements FR-15 (admin review) and FR-18 (acceptance/rejection letters).
     */
    public function review(ReviewApplicationRequest $request, Application $application): JsonResponse
    {
        // ApplicationPolicy review gate — restricts this action to admin roles.
        $this->authorize('review', $application);

        // Cast the raw string status to the typed ApplicationStatus enum.
        $newStatus = ApplicationStatus::from($request->validated('status'));

        // Delegate business logic to ApplicationService
        // The service handles compliance checks, status transitions, and notification dispatch.
        $result = $this->applicationService->reviewApplication(
            application: $application,
            newStatus: $newStatus,
            notes: $request->validated('notes'),
            reviewedBy: $request->user()
        );

        // Handle compliance failure — return the details so the admin knows what's missing.
        if (! $result['success']) {
            return response()->json([
                'message' => 'Application cannot be approved due to incomplete medical documentation.',
                'errors' => [
                    'compliance' => 'Required medical documents are missing, expired, or unverified.',
                ],
                // Include the full compliance breakdown so the admin can advise the parent.
                'compliance_details' => $result['compliance_details'],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return response()->json([
            'message' => 'Application reviewed successfully.',
            // fresh() re-fetches from DB to capture any changes made by the service.
            'data' => $application->fresh(),
        ]);
    }

    /**
     * Sign an application digitally.
     *
     * POST /api/applications/{application}/sign
     *
     * Stores the parent's digital signature, name, timestamp, and IP address.
     * Once signed, the application cannot be signed again (idempotent guard).
     * This creates a legal audit trail of who signed and from where.
     *
     * Implements FR-9: Digital signature support.
     */
    public function sign(SignApplicationRequest $request, Application $application): JsonResponse
    {
        // Only the application owner (parent) can sign — via ApplicationPolicy update gate.
        $this->authorize('update', $application);

        // Guard against duplicate signatures — an application can only be signed once.
        if ($application->isSigned()) {
            return response()->json([
                'message' => 'Application has already been signed.',
            ], Response::HTTP_BAD_REQUEST);
        }

        $application->update([
            // signature_data is typically a base64-encoded SVG or PNG of the hand-drawn signature.
            'signature_data' => $request->validated('signature_data'),
            // The signer's typed name for readability on printed forms.
            'signature_name' => $request->validated('signature_name'),
            // UTC timestamp of when the signature was applied.
            'signed_at' => now(),
            // Record the IP address for the legal audit trail.
            'signed_ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Application signed successfully.',
            'data' => $application,
        ]);
    }
}
