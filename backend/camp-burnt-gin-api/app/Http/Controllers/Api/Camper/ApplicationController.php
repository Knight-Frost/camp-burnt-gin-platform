<?php

namespace App\Http\Controllers\Api\Camper;

use App\Enums\ApplicationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Application\ReviewApplicationRequest;
use App\Http\Requests\Application\SignApplicationRequest;
use App\Http\Requests\Application\StoreApplicationRequest;
use App\Http\Requests\Application\UpdateApplicationRequest;
use App\Models\Application;
use App\Models\ApplicationConsent;
use App\Models\AuditLog;
use App\Models\Document;
use App\Models\DocumentRequest;
use App\Models\DocumentReviewEvent;
use App\Models\FormDefinition;
use App\Notifications\Camper\ApplicationSubmittedNotification;
use App\Services\Camper\ApplicationCompletenessService;
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
        protected ApplicationCompletenessService $completenessService,
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
        // Initialised here so the final return always has a defined value regardless of
        // which branch (admin / applicant / other) executes below.
        $queueTotal = null;

        if ($user->isAdmin()) {
            // CamperPolicy viewAny gate — confirms this admin role can list all applications.
            $this->authorize('viewAny', Application::class);
            // Eager-load related records so we don't hit the DB again for each application row.
            $query = Application::with([
                'camper.user',
                'campSession',
                'reviewer',
            ]);

            // Filter by status enum value (e.g., "submitted", "approved").
            // 'draft' is a valid status value — passing status=draft scopes to drafts.
            // Any other status value automatically excludes drafts since their status='draft'.
            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }

            // Narrow results to a single camp session (e.g., "Summer 2026 Week 1").
            if ($request->filled('camp_session_id')) {
                $query->where('camp_session_id', $request->camp_session_id);
            }

            // Filter by submission source — gives the admin a dedicated
            // "paper intake" queue separate from the digital-form queue.
            // Whitelisted against the enum to reject arbitrary SQL.
            if ($request->filled('submission_source')) {
                $valid = array_map(
                    fn ($c) => $c->value,
                    \App\Enums\SubmissionSource::cases(),
                );
                $requested = (string) $request->submission_source;
                if (in_array($requested, $valid, true)) {
                    $query->where('submission_source', $requested);
                }
            }

            // Full-text search across camper name and parent name/email.
            // Wrapped in a grouped where() so the OR between camper-name and parent-name
            // does NOT escape the surrounding AND conditions (status, session, is_draft).
            if ($request->filled('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->whereHas('camper', function ($q2) use ($search) {
                        $q2->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    })->orWhereHas('camper.user', function ($q2) use ($search) {
                        $q2->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
                });
            }

            // Date range filter on submitted_at (not created_at, so drafts aren't included).
            if ($request->filled('date_from')) {
                $query->whereDate('submitted_at', '>=', $request->date_from);
            }

            if ($request->filled('date_to')) {
                $query->whereDate('submitted_at', '<=', $request->date_to);
            }

            // Admin visibility rule:
            //
            //   • default (no flag)    → non-draft only (status != 'draft').
            //     Drafts are incomplete work-in-progress by the applicant and
            //     should not clutter the review queue.
            //   • include_drafts=true  → ALL statuses including draft. Opt-in
            //     escape hatch so admins can diagnose "an application already
            //     exists" situations where a draft is silently blocking.
            //   • drafts_only=true     → status='draft' only. Explicit view.
            //
            // drafts_only wins over include_drafts when both are sent.
            // Skip this block when a specific status was already filtered above.
            if (! $request->filled('status')) {
                if ($request->boolean('drafts_only')) {
                    $query->where('status', ApplicationStatus::Draft->value);
                } elseif (! $request->boolean('include_drafts')) {
                    $query->where('status', '!=', ApplicationStatus::Draft->value);
                }
            }

            // Dynamic sorting — only allow whitelisted columns to prevent SQL injection.
            // Default: submitted_at ASC (FIFO — oldest submission first) so the admin review
            // queue naturally surfaces the families who applied earliest at the top.
            $sortField = $request->get('sort', 'submitted_at');
            $sortDir = $request->get('direction', 'asc');
            $allowedSorts = ['created_at', 'submitted_at', 'status', 'reviewed_at', 'updated_at'];
            if (in_array($sortField, $allowedSorts)) {
                $query->orderBy($sortField, $sortDir === 'asc' ? 'asc' : 'desc');
            }
            // Stable secondary tiebreaker — ensures deterministic page order when two rows
            // share the same primary sort value (e.g., applications bulk-imported together).
            $query->orderBy('id', 'asc');

            $applications = $query->paginate($request->get('per_page', 15));

            // Queue stats — total active (non-final) submitted applications in the scoped session.
            // Provides the "X of Y pending" denominator for queue-position display on the frontend.
            // Only computed when a session is scoped; null in the global all-sessions view.
            $queueTotal = null;
            if ($request->filled('camp_session_id')) {
                $queueTotal = Application::where('camp_session_id', $request->camp_session_id)
                    ->whereIn('status', ['submitted', 'under_review', 'waitlisted'])
                    ->count();
            }
        } elseif ($user->isApplicant()) {
            // Collect the IDs of all campers owned by this parent, then scope the query.
            $camperIds = $user->campers()->pluck('id');
            $applications = Application::whereIn('camper_id', $camperIds)
                ->with([
                    'camper.user',
                    'campSession',
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
                    'last_page' => 1,
                    'per_page' => 15,
                    'total' => 0,
                ],
            ]);
        }

        // Inject queue_rank into each application array.
        //
        // Strategy: page-offset rank — the Nth item on page P gets rank (P-1)*perPage + N.
        // This equals the global FIFO position when the list is sorted by submitted_at ASC,
        // which is the default. Under a status filter it becomes the rank within that subset,
        // which is exactly what an admin needs ("which pending application came first?").
        //
        // Zero extra DB queries: we compute rank from the already-known page offset.
        //
        // BUG-3 FIX: Previously assigned rank to ALL non-draft submitted applications,
        // including approved, rejected, cancelled, and withdrawn records. This was misleading
        // because queue position is meaningless for already-processed (final-state) applications.
        // Now rank is ONLY assigned to active applications: submitted, under_review, waitlisted.
        // Final-state applications show null (rendered as "—" in the UI).
        $activeStatuses = [
            ApplicationStatus::Submitted->value,
            ApplicationStatus::UnderReview->value,
            ApplicationStatus::Waitlisted->value,
        ];
        $pageOffset = ($applications->currentPage() - 1) * $applications->perPage();
        $rankedItems = [];
        foreach ($applications->items() as $index => $app) {
            $arr = $app->toArray();  // triggers $appends (application_number, session) + casts
            $arr['queue_rank'] = (
                ! $app->isDraft()
                && $app->submitted_at !== null
                && in_array($app->status->value, $activeStatuses)
            )
                ? $pageOffset + $index + 1
                : null;
            $rankedItems[] = $arr;
        }

        return response()->json([
            'data' => $rankedItems,
            'meta' => [
                'current_page' => $applications->currentPage(),
                'last_page' => $applications->lastPage(),
                'per_page' => $applications->perPage(),
                'total' => $applications->total(),
                // Total active (non-final) applications in the current session scope.
                // Null when viewing all sessions (no session filter applied).
                'queue_total' => $queueTotal ?? null,
            ],
        ]);
    }

    /**
     * Store a newly created application.
     *
     * POST /api/applications
     *
     * Creates the application as status='draft' by default.
     * Only transitions to 'submitted' via the finalize endpoint.
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
        // ── Duplicate-prevention upsert gate ──────────────────────────────────
        // This is the ONLY place duplicate detection runs. The FormRequest
        // intentionally does not enforce `Rule::unique` because validation
        // would fire before this branch and short-circuit draft resumption.
        //
        // Outcomes, in priority order, with the row locked via SELECT ... FOR
        // UPDATE inside a transaction so two concurrent POSTs can't both pass:
        //
        //   • Draft exists             → update it with the new payload and
        //     return 200. Clicking "Continue" must NEVER silently create a
        //     second draft.
        //
        //   • Active non-draft exists  → 409 Conflict. "Active" means the
        //     application is still in the queue or enrolled — statuses
        //     Submitted, UnderReview, Approved, Waitlisted. The applicant
        //     must withdraw or have the admin act before reapplying.
        //
        //   • Final-state row exists   → allow a new application. Rejected,
        //     Cancelled, and Withdrawn are historical records and do NOT
        //     occupy the slot. The old row is preserved as audit history.
        if (isset($data['camper_id'], $data['camp_session_id'])) {
            $conflict = null;
            $resumed = null;

            DB::transaction(function () use ($data, &$conflict, &$resumed) {
                $rows = Application::where('camper_id', $data['camper_id'])
                    ->where('camp_session_id', $data['camp_session_id'])
                    ->lockForUpdate()
                    ->get();

                $draft = $rows->first(fn ($a) => $a->isDraft());
                // "Active" = the row still occupies the slot. Status enum's
                // isFinal() is the authority: Approved/Rejected/Cancelled/
                // Withdrawn are final and do NOT block reapplication; anything
                // else (Submitted/UnderReview/Waitlisted) does.
                $activeSubmitted = $rows->first(
                    fn ($a) => ! $a->isDraft() && ! $a->status->isFinal(),
                );

                if ($draft !== null) {
                    $draft->update(array_filter($data, fn ($v) => $v !== null));
                    $draft->load(['camper', 'campSession']);
                    $resumed = $draft;

                    return;
                }

                if ($activeSubmitted !== null) {
                    $conflict = $activeSubmitted;

                    return;
                }
                // Final-state row(s) only, or no row at all — fall through to
                // creation below. The row lock is released at commit.
            });

            if ($resumed !== null) {
                return response()->json([
                    'message' => 'Existing draft application returned.',
                    'data' => $resumed,
                ], Response::HTTP_OK);
            }

            if ($conflict !== null) {
                return response()->json([
                    'message' => 'You already have an active application for this camper and session.',
                    'existing_application_id' => $conflict->id,
                    'existing_application_status' => $conflict->status->value,
                ], Response::HTTP_CONFLICT);
            }
        }

        // status is always 'draft' on creation; finalize() transitions to 'submitted'.
        $data['status'] = ApplicationStatus::Draft;

        // Wrap creation in a transaction so the row and its eager-loads are consistent.
        //
        // Race-condition note: the upsert gate above holds a row-level lock
        // for the duration of its transaction, which serialises concurrent
        // POSTs for the same (camper, session) pair. The hard DB unique
        // constraint was removed in 2026_04_18_000002 to allow final-state
        // rows to coexist, so the QueryException fallback that used to guard
        // this block no longer has a condition to fire on. It's still
        // theoretically possible for two concurrent requests to race the
        // upsert-gate release → create window; that would produce two
        // historical rows, which is preferable to the old failure mode of
        // permanently locking the applicant out of reapplying.
        $application = DB::transaction(function () use ($data) {
            $application = Application::create($data);
            // Eager-load camper and session so downstream callers have all the data they need.
            $application->load(['camper', 'campSession']);

            return $application;
        });

        return response()->json([
            'message' => 'Application draft saved.',
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
            'camper.personalCarePlan',
            'camper.assistiveDevices',
            'camper.activityPermissions',
            'camper.documents',
            'campSession',
            'secondSession',
            'reviewer',
            'documents',
            'consents',
        ]);

        // Append queue_position only here (single-record fetch) to avoid the N+1 problem
        // that would occur if it were in $appends and fired on every list row.
        $application->append('queue_position');

        // Build the document collection visible on the application review page.
        //
        // Three sources are merged and deduplicated:
        //
        //   1. application.documents — Application-polymorphic docs (the canonical home
        //      after the paper-packet linkage fix; also covers admin-uploaded-on-behalf docs).
        //
        //   2. camper.documents — Camper-polymorphic docs uploaded by admins using the
        //      original "attach to camper" path (uploadDocumentOnBehalf in admin.api.ts).
        //      DocumentEnforcementService still resolves compliance by camper, so these
        //      remain valid on the Camper relation.
        //
        //   3. Orphaned docs — paper_application_packet records where documentable_type IS
        //      NULL, uploaded by this application's parent user.  These exist for rows that
        //      pre-date the backfill migration (2026_04_10_000002) or were uploaded while the
        //      migration was still pending.  Once the migration has run this set will normally
        //      be empty; the fallback ensures nothing disappears for reviewers in the interim.
        $camperDocs = $application->camper->documents ?? collect();
        $appDocs = $application->documents ?? collect();
        $applicantUserId = $application->camper?->user_id;
        // Scope orphaned docs to paper_application_packet only — this is the only
        // type that legitimately arrives with NULL documentable before the backfill
        // migration runs. Loading all orphaned documents for a user would surface
        // documents from sibling campers or other applications on the same account.
        $orphanedDocs = $applicantUserId
            ? \App\Models\Document::whereNull('documentable_type')
                ->whereNull('documentable_id')
                ->where('uploaded_by', $applicantUserId)
                ->where('document_type', 'paper_application_packet')
                ->whereNull('deleted_at')
                ->get()
            : collect();

        $merged = $appDocs->merge($camperDocs)->merge($orphanedDocs)->unique('id')->values();

        // Archive filter: exclude superseded docs for ALL viewers (BUG-216).
        // Only the current live copy per (owner, type) is user-visible;
        // historical archives remain in the DB for audit but are out of the
        // normal read path.
        $merged = $merged->filter(fn ($doc) => $doc->archived_at === null)->values();

        // Submission gate: admins only see submitted documents (submitted_at IS NOT NULL).
        // Applicants see all their own documents — including drafts — so they can review
        // staged uploads and know which ones still need to be submitted to staff.
        if (request()->user()?->isAdmin()) {
            $merged = $merged->filter(fn ($doc) => $doc->submitted_at !== null)->values();
        }

        // App-layer dedupe by (documentable_type, documentable_id,
        // document_type) — newest id wins. The DB functional unique index
        // enforces this too; the app-layer fallback protects against
        // legacy rows that predate the index (e.g. on SQLite test DBs).
        $byKey = [];
        foreach ($merged as $doc) {
            $key = ($doc->documentable_type ?? 'orphan')
                .'|'.($doc->documentable_id ?? 'orphan')
                .'|'.($doc->document_type ?? 'untyped');
            if (! isset($byKey[$key]) || $doc->id > $byKey[$key]->id) {
                $byKey[$key] = $doc;
            }
        }
        $merged = collect(array_values($byKey))->values();

        $application->setRelation('documents', $merged);

        // Canonical 11-section projection. Admin and applicant frontends
        // consume this shape; the legacy `data` key is kept temporarily so
        // old consumers don't 500 during the Phase 4 frontend cutover. It
        // will be removed once both portals are reading exclusively from
        // `canonical`.
        $canonical = new \App\Http\Resources\ApplicationResource($application);

        return response()->json([
            'data' => $application,
            'canonical' => $canonical->toArray(request()),
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

        // Optimistic concurrency guard — prevents stale overwrites when the applicant
        // has the form open in multiple tabs or when a slow network causes out-of-order
        // requests. The client sends the last updated_at it observed; if the server's
        // current value differs, a concurrent write already occurred.
        if ($request->has('last_known_updated_at')) {
            $clientTs = $request->string('last_known_updated_at')->toString();
            $serverTs = $application->updated_at?->toISOString() ?? '';
            if ($clientTs !== $serverTs) {
                return response()->json([
                    'message' => 'Application was modified by another request. Refresh and retry.',
                    'conflict' => true,
                    'server_updated_at' => $serverTs,
                ], Response::HTTP_CONFLICT);
            }
        }

        $data = $request->validated();

        // Snapshot editable content fields before mutation so the audit log can record
        // an accurate before/after diff. Only the fields that UpdateApplicationRequest
        // allows through are included — other fillable columns are not tracked here.
        $contentFields = [
            'notes',
            'submission_source',
            'narrative_rustic_environment',
            'narrative_staff_suggestions',
            'narrative_participation_concerns',
            'narrative_camp_benefit',
            'narrative_heat_tolerance',
            'narrative_transportation',
            'narrative_additional_info',
            'narrative_emergency_protocols',
        ];
        $oldSnapshot = $application->only($contentFields);

        // If an admin is changing the submission source TO paper, require that
        // a paper_application_packet already exist (or is being added in the
        // same review flow). Without this guard a digital application could be
        // re-flagged as paper to bypass the 7-consent gate with no paperwork
        // ever on file — producing an application that looks complete but has
        // neither digital nor physical signatures backing it.
        $currentSource = $application->submission_source instanceof \App\Enums\SubmissionSource
            ? $application->submission_source->value
            : ($application->submission_source ?? 'digital');
        if (array_key_exists('submission_source', $data)
            && in_array($data['submission_source'], ['paper_self', 'paper_admin'], true)
            && ($currentSource !== $data['submission_source'])
        ) {
            $packetExists = \App\Models\Document::query()
                ->where('document_type', 'paper_application_packet')
                ->whereNotNull('submitted_at')
                ->whereNull('archived_at')
                ->where(function ($q) use ($application) {
                    $q->where(function ($q2) use ($application) {
                        $q2->where('documentable_type', \App\Models\Application::class)
                            ->where('documentable_id', $application->id);
                    })->orWhere(function ($q2) use ($application) {
                        $q2->where('documentable_type', \App\Models\Camper::class)
                            ->where('documentable_id', $application->camper_id);
                    });
                })
                ->exists();

            if (! $packetExists) {
                return response()->json([
                    'message' => 'A completed paper application packet must be uploaded before this application can be marked as a paper submission.',
                    'errors' => ['submission_source' => ['Paper packet is required before setting a paper source.']],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        // sections_reviewed is a JSON object keyed by section slug. Callers
        // send partial patches ({ behavior: ts }) expecting a merge, but
        // Laravel's default Model::update() REPLACES the whole JSON value —
        // so a second patch for a different section would silently erase
        // the first. Merge explicitly to preserve prior review stamps.
        if (array_key_exists('sections_reviewed', $data) && is_array($data['sections_reviewed'])) {
            $existing = $application->sections_reviewed ?? [];
            $data['sections_reviewed'] = array_merge(
                is_array($existing) ? $existing : [],
                $data['sections_reviewed'],
            );
        }

        // Check if this is a "submit now" action on a previously saved draft.
        // Run the same completeness gate as finalize() — no bypass allowed.
        // IMPORTANT: apply the sections_reviewed merge above BEFORE running
        // the gate so a submit-in-one-request with fresh review stamps sees
        // them rather than an empty array.
        if ($application->isDraft() && $request->has('submit') && $request->boolean('submit')) {
            if (array_key_exists('sections_reviewed', $data)) {
                // Flush the review stamps into the model instance so the
                // completeness engine sees them during the pre-submit check.
                $application->sections_reviewed = $data['sections_reviewed'];
            }

            $report = $this->completenessService->check($application, forFinalization: true);

            if (! $report['is_complete']) {
                return response()->json([
                    'message' => 'Application is incomplete and cannot be submitted.',
                    'missing_fields' => $report['missing_fields'],
                    'missing_documents' => $report['missing_documents'],
                    'missing_consents' => $report['missing_consents'],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            // Transition status from draft → submitted. Do not set is_draft —
            // status is the single source of truth after Phase 3 of the refactor.
            $data['status'] = ApplicationStatus::Submitted->value;
            $data['submitted_at'] = now();
        }

        $application->update($data);

        // Write audit log if any content field changed.
        // Only log the fields that were actually present in the validated request
        // to keep the diff clean — unchanged fields are not recorded.
        $newSnapshot = array_intersect_key($application->only($contentFields), $data);
        $oldForDiff = array_intersect_key($oldSnapshot, $newSnapshot);
        $hasChanges = $oldForDiff !== $newSnapshot;

        if ($hasChanges) {
            AuditLog::logContentChange(
                auditable: $application,
                editor: $request->user(),
                oldValues: $oldForDiff,
                newValues: $newSnapshot,
            );
        }

        // If status just transitioned from draft → submitted, the parent needs a confirmation
        // notification. Both the email AND the in-app inbox notification must fire.
        if (
            isset($data['status'])
            && $data['status'] === ApplicationStatus::Submitted->value
            && $application->wasChanged('status')
        ) {
            $application->loadMissing('camper.user');
            $this->queueNotification(
                $application->camper->user,
                new ApplicationSubmittedNotification($application)
            );
            $camperName = $application->camper->first_name.' '.$application->camper->last_name;
            $this->systemNotifications->applicationSubmitted(
                $application->camper->user, $application->id, $camperName
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
     * Admins can delete any application. Applicants can only delete their own
     * draft (is_draft=true) applications — submitted applications are locked.
     * See ApplicationPolicy::delete() for the authorization rules.
     *
     * All deletions are written to the audit log before the record is removed
     * so there is always a permanent record of what was deleted, by whom, and when.
     */
    public function destroy(Application $application): JsonResponse
    {
        $this->authorize('delete', $application);

        $user = request()->user();

        // Capture snapshot before deletion for the audit trail.
        AuditLog::logAdminAction(
            'application.deleted',
            $user,
            "Application #{$application->id} deleted (status: {$application->status->value})"
                ." for camper #{$application->camper_id}",
            [
                'application_id' => $application->id,
                'camper_id' => $application->camper_id,
                'session_id' => $application->camp_session_id,
                'status' => $application->status->value,
                'deleted_by' => $user->id,
            ]
        );

        // Load the camper before deletion so we can check whether it becomes
        // orphaned. A camper with no remaining applications has no context in
        // the system and should be cleaned up. This is the primary path for
        // removing "New Camper" stub records created by initializeDraft PATH B
        // when the parent starts (and then abandons) a new application.
        $camper = \App\Models\Camper::find($application->camper_id);

        // Delete any linked draft blob BEFORE the application row is removed.
        // The FK on application_drafts.application_id is nullOnDelete — if we
        // delete the Application first, the DB sets application_id to NULL and
        // the blob becomes an unreachable zombie that reappears in the dashboard.
        // Deleting the blob first avoids the zombie entirely.
        \App\Models\ApplicationDraft::where('application_id', $application->id)->delete();

        $application->delete();

        // Cascade soft-delete: if this was the camper's only application, the
        // camper record is now orphaned. Keeping it creates phantom entries in
        // the parent's dashboard (the "New Camper" ghost). Deleting it here
        // keeps database state consistent with what the parent sees.
        // We do NOT enforce the policy here (the destroy() authorization above
        // already confirmed the caller may delete this application; cascading
        // to an orphaned camper is an internal clean-up, not a separate action).
        if ($camper !== null && $camper->applications()->count() === 0) {
            $camper->delete();
        }

        return response()->json([
            'message' => 'Application deleted successfully.',
        ]);
    }

    /**
     * Return a completeness report for an application before the admin approves.
     *
     * GET /api/applications/{application}/completeness
     *
     * Called by the frontend immediately when an admin clicks "Approve".
     * If is_complete is false, the frontend shows the warning modal with the
     * structured missing-data list. The admin can then choose to fix the gaps
     * or override and approve anyway.
     *
     * This endpoint is read-only and makes no state changes.
     */
    /**
     * Lightweight endpoint returning just the lifecycle IDs the form needs
     * to drive progressive per-section writes. Used by the draft-resume
     * flow: given a draft blob's application_id, the form needs the
     * camper + singleton relation IDs to hydrate its in-memory ID map
     * without pulling the full Application + PHI.
     *
     * Same authorization as /completeness (owner or admin).
     */
    public function lifecycleIds(Application $application): JsonResponse
    {
        $this->authorize('view', $application);

        $application->loadMissing([
            'camper.medicalRecord',
            'camper.behavioralProfile',
            'camper.feedingPlan',
        ]);

        // Top up any missing singleton relations — applications created
        // before the init-draft refactor may not have all four rows.
        $camper = $application->camper;
        if (! $camper) {
            abort(404, 'Application has no camper attached.');
        }
        $medicalRecord = $camper->medicalRecord ?? $camper->medicalRecord()->create([]);
        $behavioralProfile = $camper->behavioralProfile ?? $camper->behavioralProfile()->create([]);
        $feedingPlan = $camper->feedingPlan ?? $camper->feedingPlan()->create([]);

        return response()->json(['data' => [
            'application_id' => $application->id,
            'camper_id' => $camper->id,
            'medical_record_id' => $medicalRecord->id,
            'behavioral_profile_id' => $behavioralProfile->id,
            'feeding_plan_id' => $feedingPlan->id,
        ]]);
    }

    /**
     * Initialize a blank draft application for the applicant.
     *
     * POST /api/applications/initialize-draft
     * body: { camp_session_id, first_name?, last_name?, date_of_birth? }
     *
     * Creates an Application (is_draft=true) plus a Camper stub and empty
     * MedicalRecord row in one atomic transaction. The frontend form uses
     * the returned application_id to drive the validation engine during
     * editing — before this, the form had no Application row so
     * `/completeness` could not be called during filling.
     *
     * Idempotency: if the applicant already has a draft Application for
     * the same session, the existing row is returned instead. No duplicate
     * drafts are created even under aggressive double-submit.
     *
     * @return JsonResponse { data: { application_id, camper_id } }
     */
    public function initializeDraft(Request $request): JsonResponse
    {
        $this->authorize('create', Application::class);

        $data = $request->validate([
            'camp_session_id' => ['required', 'integer', 'exists:camp_sessions,id'],
            // Optional: reuse an existing Camper (reapplication flow). When
            // provided, the endpoint skips creating a new Camper stub and
            // attaches the new Application to the caller's existing record.
            'camper_id' => ['sometimes', 'nullable', 'integer', 'exists:campers,id'],
            // Seed fields used only when a brand-new Camper stub is created.
            'first_name' => ['sometimes', 'nullable', 'string', 'max:100'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:100'],
            'date_of_birth' => ['sometimes', 'nullable', 'date'],
            // Audit-trail link on reapplications — mirrors the field that
            // createApplication() accepts. When present, the new draft
            // carries a pointer back to the terminal application it succeeds.
            'reapplied_from_id' => ['sometimes', 'nullable', 'integer', 'exists:applications,id'],
            // Intake channel. Applicants may only set paper_self (they are
            // uploading their own scanned forms). paper_admin is admin-only
            // and is set via UpdateApplicationRequest. digital is the default.
            'submission_source' => ['sometimes', 'nullable', 'string', 'in:digital,paper_self'],
        ]);

        $user = $request->user();

        $source = $data['submission_source'] ?? 'digital';

        // Atomic: camper + application + singleton relations. Two paths:
        //
        // PATH A — camper_id provided (reapplication / known camper):
        //   Idempotent on (camper_id, camp_session_id, submission_source). A second
        //   call returns the existing draft for THAT specific camper. The full
        //   idempotency key MUST include camper_id — omitting it would allow a
        //   draft belonging to a different camper to be returned, causing cross-
        //   camper data contamination (HIPAA risk).
        //
        // PATH B — no camper_id (fresh application for a new child):
        //   Always creates a new stub. We deliberately skip idempotency here
        //   because we cannot know which of the caller's campers they intend.
        //   Resuming "the first draft found" without a camper discriminator is
        //   a data-leakage vector — a parent with two children applying to the
        //   same session would receive the wrong child's draft.
        //
        // Paper and digital drafts are kept separate (submission_source in key)
        // because they represent distinct intake paths.
        $result = DB::transaction(function () use ($data, $user, $source) {
            if (! empty($data['camper_id'])) {
                // ── PATH A: camper_id explicitly provided ────────────────────
                /** @var \App\Models\Camper $camper */
                $camper = \App\Models\Camper::with([
                    'medicalRecord', 'behavioralProfile', 'feedingPlan',
                ])->findOrFail($data['camper_id']);

                // Ownership gate — must be the caller's camper.
                if ($camper->user_id !== $user->id) {
                    abort(403, 'Cannot initialize an application for a camper you do not own.');
                }

                // Idempotency: resume existing draft for THIS camper + session + source.
                // A draft for a different camper is never returned here because camper_id
                // is part of the WHERE clause.
                $existing = Application::where('camper_id', $camper->id)
                    ->where('camp_session_id', $data['camp_session_id'])
                    ->where('status', ApplicationStatus::Draft->value)
                    ->where('submission_source', $source)
                    ->lockForUpdate()
                    ->first();

                if ($existing) {
                    // Return the existing draft's IDs — caller already has the right camper.
                    return [
                        'application_id' => $existing->id,
                        'camper_id' => $camper->id,
                        'medical_record_id' => optional($camper->medicalRecord)->id,
                        'behavioral_profile_id' => optional($camper->behavioralProfile)->id,
                        'feeding_plan_id' => optional($camper->feedingPlan)->id,
                    ];
                }

                // No existing draft — new application for this existing camper.
                // Top up any missing singleton relations (older campers may predate one).
                $medicalRecord = $camper->medicalRecord ?? $camper->medicalRecord()->create([]);
                $behavioralProfile = $camper->behavioralProfile ?? $camper->behavioralProfile()->create([]);
                $feedingPlan = $camper->feedingPlan ?? $camper->feedingPlan()->create([]);

                $application = Application::create([
                    'camper_id' => $camper->id,
                    'camp_session_id' => $data['camp_session_id'],
                    'status' => ApplicationStatus::Draft,
                    'submission_source' => $source,
                    'reapplied_from_id' => $data['reapplied_from_id'] ?? null,
                ]);

                return [
                    'application_id' => $application->id,
                    'camper_id' => $camper->id,
                    'medical_record_id' => $medicalRecord->id,
                    'behavioral_profile_id' => $behavioralProfile->id,
                    'feeding_plan_id' => $feedingPlan->id,
                ];
            }

            // ── PATH B: no camper_id — fresh application for a new child ────
            // Never resume a draft without an explicit camper discriminator,
            // but DO restore a soft-deleted stub rather than creating a duplicate.
            // Without this guard, every delete→restart cycle accumulates a new
            // "New Camper" phantom that resurfaces in the dashboard.
            $firstName = $data['first_name'] ?? 'New';
            $lastName = $data['last_name'] ?? 'Camper';
            $dateOfBirth = $data['date_of_birth'] ?? now()->subYears(10)->toDateString();

            $existingStub = \App\Models\Camper::withTrashed()
                ->where('user_id', $user->id)
                ->where('first_name', $firstName)
                ->where('last_name', $lastName)
                ->whereNotNull('deleted_at')
                ->latest('deleted_at')
                ->first();

            if ($existingStub !== null) {
                $existingStub->restore();
                $camper = $existingStub;
            } else {
                $camper = \App\Models\Camper::create([
                    'user_id' => $user->id,
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'date_of_birth' => $dateOfBirth,
                ]);
            }

            // Pre-create every singleton relation the form's progressive-
            // save logic writes to. Use the same idempotent pattern as PATH A:
            // if a relation already exists on a restored stub, reuse it.
            $medicalRecord = $camper->medicalRecord ?? $camper->medicalRecord()->create([]);
            $behavioralProfile = $camper->behavioralProfile ?? $camper->behavioralProfile()->create([]);
            $feedingPlan = $camper->feedingPlan ?? $camper->feedingPlan()->create([]);
            // Personal care plan uses an idempotent updateOrCreate endpoint
            // so no stub required here. Activity permissions, diagnoses,
            // allergies, medications, assistive devices, and emergency
            // contacts are list relations — the form syncs them on each
            // section transition.

            $application = Application::create([
                'camper_id' => $camper->id,
                'camp_session_id' => $data['camp_session_id'],
                'status' => ApplicationStatus::Draft,
                'submission_source' => $source,
            ]);

            return [
                'application_id' => $application->id,
                'camper_id' => $camper->id,
                'medical_record_id' => $medicalRecord->id,
                'behavioral_profile_id' => $behavioralProfile->id,
                'feeding_plan_id' => $feedingPlan->id,
            ];
        });

        return response()->json(['data' => $result], Response::HTTP_CREATED);
    }

    public function completeness(Application $application): JsonResponse
    {
        // Owner (applicant) + any admin can read their own application's
        // completeness. The `view` policy method already enforces that rule
        // — no need for a separate admin-only gate. This lets the applicant
        // form call the same endpoint the admin review page uses, keeping
        // a single source of truth for validation.
        $this->authorize('view', $application);

        // Return BOTH the flat legacy shape (used by IncompleteApprovalModal)
        // AND the rich engine output (used by ApplicationFormPage sidebar,
        // Submit gate, Issues Summary) in one payload. Single round trip.
        $flat = $this->completenessService->check($application);
        $rich = $this->completenessService->evaluate($application);

        return response()->json([
            'data' => array_merge($flat, [
                'validation' => $rich,
            ]),
        ]);
    }

    /**
     * Finalize a draft application — the applicant's official submission gate.
     *
     * POST /api/applications/{application}/finalize
     *
     * This is the two-phase submission endpoint. The frontend first creates the
     * application as is_draft=true (so child records can reference its ID), then
     * attaches documents, signature, and consents. This endpoint is called LAST
     * and performs the full completeness check before atomically marking the
     * application as officially submitted.
     *
     * On success: flips is_draft=false, stamps submitted_at, links the active
     * form definition, sends parent notifications, and returns the updated record.
     *
     * On failure: returns 422 with a structured report of all missing data,
     * including the key, label, and severity of each gap. The frontend uses
     * this to navigate the applicant to the exact failing section and field.
     *
     * Blocked if: the application is already submitted (not a draft), the caller
     * is not the owning parent, or any required data is absent.
     */
    public function finalize(Application $application, Request $request): JsonResponse
    {
        $this->authorize('finalize', $application);

        // Run the submission-time completeness check. Unlike the approval gate,
        // this does not block on unverified documents — the admin verifies those
        // after submission. The forFinalization flag skips the is_draft check
        // (we are about to flip that flag) and excludes unverified from is_complete.
        $report = $this->completenessService->check($application, forFinalization: true);

        if (! $report['is_complete']) {
            return response()->json([
                'message' => 'Application is incomplete and cannot be submitted.',
                'missing_fields' => $report['missing_fields'],
                'missing_documents' => $report['missing_documents'],
                'missing_consents' => $report['missing_consents'],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // All checks pass — atomically mark as submitted and send notifications.
        $application = DB::transaction(function () use ($application) {
            // ── Child-row dedupe ───────────────────────────────────────────
            // Five child tables (medications, allergies, emergency_contacts,
            // diagnoses, assistive_devices) use unconditional Model::create()
            // in their controllers. Every retry of the submission flow
            // duplicates every row in those tables for this camper. Their
            // fields are AES-256 encrypted at rest so SQL dedupe isn't an
            // option — we dedupe in PHP by natural-key signature before the
            // application flips submitted. See CamperChildRowDeduper and
            // BUG-214 for the full rationale.
            /** @var \App\Models\Camper|null $camper */
            $camper = $application->camper()->first();
            if ($camper !== null) {
                app(\App\Services\Camper\CamperChildRowDeduper::class)
                    ->dedupeForCamper($camper);
            }

            // Transition status from draft → submitted. This is the real submission moment.
            // submitted_at is stamped atomically here — never before, never after.
            $application->update([
                'status' => ApplicationStatus::Submitted,
                'submitted_at' => now(),
                'form_definition_id' => FormDefinition::where('status', 'active')->value('id'),
            ]);

            // ── Stale-draft cleanup ────────────────────────────────────────
            // A camper can legitimately have one draft per session in flight,
            // but the scenarios below leave orphan rows that appear in the
            // parent's drafts list alongside the submitted record:
            //   • Same-session duplicates: a prior submit attempt created a
            //     draft that the upsert gate later couldn't match (e.g. a
            //     session change mid-flow), so a second draft was born for
            //     the same (camper, session) pair.
            //   • Session-less shells: the reapplication flow starts drafts
            //     with camp_session_id=null. If the applicant abandons that
            //     shell and begins fresh, the null-session row never gets
            //     finalized and never matches a later upsert.
            //
            // Both patterns are cleaned here: for this camper, remove any
            // OTHER draft rows whose session matches the finalized application's
            // session OR whose session is null. Drafts for genuinely different
            // sessions (parent applying to multiple) are preserved.
            Application::where('camper_id', $application->camper_id)
                ->where('id', '!=', $application->id)
                ->where('status', ApplicationStatus::Draft->value)
                ->where(function ($q) use ($application) {
                    $q->where('camp_session_id', $application->camp_session_id)
                        ->orWhereNull('camp_session_id');
                })
                ->delete();

            // Clean up the ApplicationDraft JSON staging blobs.
            //
            // Primary path (new): delete by application_id FK. The form page
            // links the blob to its Application as soon as the draft row is
            // created, so every blob staged for THIS submission finalizes out
            // cleanly and unambiguously. No label drift, no nickname edge
            // cases.
            \App\Models\ApplicationDraft::where('application_id', $application->id)->delete();

            // Legacy fallback: blobs written before the application_id column
            // existed still have NULL for the FK. Delete only the "New Application"
            // sentinel label — it is the only label the form sets when no camper
            // name is available yet. First-name matching is intentionally removed:
            // when a parent has multiple children with the same first name it would
            // delete blobs for the other sibling's in-progress draft.
            /** @var \App\Models\Camper|null $camper */
            $camper = $application->camper()->first();
            if ($camper !== null) {
                \App\Models\ApplicationDraft::where('user_id', $camper->user_id)
                    ->whereNull('application_id')
                    ->where('label', 'New Application')
                    ->delete();
            }

            // Cascade submission to every draft document attached to this
            // application and its camper. Until the application is submitted,
            // those uploads are staging PHI — the admin queue filters them out.
            // Stamping submitted_at here (and only here) is how the applicant's
            // uploads become visible to staff: in a single atomic step, with
            // no intermediate window where the app is submitted but its docs
            // are not (or vice versa).
            $now = now();
            \App\Models\Document::where('documentable_type', \App\Models\Application::class)
                ->where('documentable_id', $application->id)
                ->whereNull('submitted_at')
                ->whereNull('archived_at')
                ->update(['submitted_at' => $now]);
            \App\Models\Document::where('documentable_type', \App\Models\Camper::class)
                ->where('documentable_id', $application->camper_id)
                ->whereNull('submitted_at')
                ->whereNull('archived_at')
                ->update(['submitted_at' => $now]);

            return $application;
        });

        // Dispatch notifications AFTER the transaction commits to prevent sending
        // emails for an application that was never actually persisted (e.g. if the
        // transaction rolled back). Queued notifications are safe here; synchronous
        // (sync driver) notifications should not run inside a transaction.
        $application->loadMissing('camper.user', 'campSession');
        $camperName = $application->camper->first_name.' '.$application->camper->last_name;

        $this->queueNotification(
            $application->camper->user,
            new ApplicationSubmittedNotification($application)
        );
        $this->systemNotifications->applicationSubmitted(
            $application->camper->user, $application->id, $camperName
        );

        return response()->json([
            'message' => 'Application submitted successfully.',
            'data' => $application,
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

        // Delegate business logic to ApplicationService.
        // override_incomplete is set by the frontend when the admin explicitly chose
        // "Approve Anyway" after seeing the missing-data warning modal.
        $result = $this->applicationService->reviewApplication(
            application: $application,
            newStatus: $newStatus,
            notes: $request->validated('notes'),
            reviewedBy: $request->user(),
            overrideIncomplete: (bool) $request->validated('override_incomplete', false),
            missingSummary: $request->validated('missing_summary', []),
        );

        // Handle attempt to review an unsubmitted draft — this should not happen in normal
        // usage (policy blocks it), but guard here for any direct API call.
        if (! $result['success'] && ($result['draft_not_reviewable'] ?? false)) {
            return response()->json([
                'message' => 'Draft applications cannot be reviewed. The application must be submitted by the applicant first.',
                'errors' => ['status' => 'Application is still a draft.'],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Handle invalid state transition — the current status cannot move to the requested one.
        if (! $result['success'] && ($result['invalid_transition'] ?? false)) {
            return response()->json([
                'message' => "Invalid status transition. The application cannot be moved to \"{$newStatus->value}\" from its current state.",
                'errors' => [
                    'status' => 'This status transition is not permitted for the application in its current state.',
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Handle capacity failure — the session is full; suggest waitlisting instead.
        if (! $result['success'] && ($result['capacity_exceeded'] ?? false)) {
            return response()->json([
                'message' => "Cannot approve: \"{$result['session_name']}\" is at full capacity ({$result['enrolled']}/{$result['capacity']} enrolled). Waitlist the applicant or archive another application to free a spot.",
                'errors' => [
                    'capacity' => 'Session is at capacity.',
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

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
     * Withdraw an application (parent-initiated).
     *
     * POST /api/applications/{application}/withdraw
     *
     * Parents may withdraw their own child's application from the following states:
     * Pending, UnderReview, Approved, Waitlisted. Withdrawal sets the status to
     * Withdrawn, which is a terminal state — it cannot be reversed.
     *
     * If the application was Approved at the time of withdrawal, the service
     * will deactivate the camper and medical record (same logic as admin reversal).
     *
     * Admins cannot use this endpoint — they use the /review endpoint with
     * status=cancelled for admin-initiated termination.
     *
     * Implements: Parent withdrawal workflow.
     */
    public function withdraw(Request $request, Application $application): JsonResponse
    {
        $this->authorize('withdraw', $application);

        $result = $this->applicationService->withdrawApplication(
            application: $application,
            withdrawnBy: $request->user()
        );

        // Idempotency: a second withdraw on an already-withdrawn application
        // must surface clearly rather than pretending it succeeded.
        if (! ($result['success'] ?? false)) {
            if ($result['already_withdrawn'] ?? false) {
                return response()->json([
                    'message' => 'Application has already been withdrawn.',
                    'errors' => ['status' => 'already_withdrawn'],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            if ($result['not_withdrawable'] ?? false) {
                return response()->json([
                    'message' => 'This application is no longer in a state that can be withdrawn.',
                    'errors' => ['status' => 'not_withdrawable'],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        return response()->json([
            'message' => 'Application withdrawn successfully.',
            'data' => $application->fresh(),
        ]);
    }

    /**
     * Store guardian consent records for an application.
     *
     * POST /api/applications/{application}/consents
     *
     * Accepts an array of 5 consent records (one per consent type) and bulk-upserts
     * them into the application_consents table. Idempotent — re-submitting replaces
     * existing records so the parent can correct a signed name after the fact.
     *
     * Each consent requires: consent_type, guardian_name, guardian_relationship,
     * guardian_signature, signed_at. applicant_signature is optional (only when
     * the camper is 18 or older).
     *
     * Implements the CYSHCN paper form Consents 1–5 requirement in a database record.
     */
    public function storeConsents(Request $request, Application $application): JsonResponse
    {
        // Only the application owner or an admin may submit consents.
        $this->authorize('update', $application);

        $validated = $request->validate([
            'consents' => ['required', 'array', 'min:1'],
            'consents.*.consent_type' => ['required', 'string', 'in:general,photos,liability,activity,authorization,medication,hipaa'],
            'consents.*.guardian_name' => ['required', 'string', 'max:255'],
            'consents.*.guardian_relationship' => ['required', 'string', 'max:100'],
            'consents.*.guardian_signature' => ['required', 'string'],
            'consents.*.applicant_signature' => ['nullable', 'string'],
            // before_or_equal:now blocks future-dated signatures. Without this,
            // a forged client request could stamp a consent as signed in 2099,
            // contaminating the legal audit trail. Uses 'now' (not 'today')
            // so that "signed right now" timestamps with today's time-of-day
            // are still valid — 'today' compares to midnight and would
            // reject any same-day timestamp after 00:00:00.
            'consents.*.signed_at' => ['required', 'date', 'before_or_equal:now'],
        ]);

        DB::transaction(function () use ($application, $validated) {
            foreach ($validated['consents'] as $consentData) {
                ApplicationConsent::updateOrCreate(
                    [
                        'application_id' => $application->id,
                        'consent_type' => $consentData['consent_type'],
                    ],
                    [
                        'guardian_name' => $consentData['guardian_name'],
                        'guardian_relationship' => $consentData['guardian_relationship'],
                        'guardian_signature' => $consentData['guardian_signature'],
                        'applicant_signature' => $consentData['applicant_signature'] ?? null,
                        'signed_at' => $consentData['signed_at'],
                    ]
                );
            }
        });

        return response()->json([
            'message' => 'Consents recorded successfully.',
            'data' => $application->consents()->get(),
        ]);
    }

    /**
     * Clone an existing application into a new reapplication draft.
     *
     * POST /api/applications/{application}/clone
     *
     * Creates a new draft Application for the same camper, linking it back to the
     * source application via reapplied_from_id. The parent then selects a new
     * session and submits the reapplication. All existing camper medical, behavioral,
     * and equipment data is already on file and does not need to be re-entered.
     *
     * Only the application owner (parent) can clone their own applications.
     * Only terminal applications (approved/rejected/cancelled/withdrawn) can be
     * cloned — this is enforced at both the policy layer and here.
     */
    public function clone(Request $request, Application $application): JsonResponse
    {
        // Uses the dedicated clone policy gate which enforces terminal-status requirement.
        $this->authorize('clone', $application);

        $newApplication = $this->applicationService->cloneApplication(
            source: $application,
            requestedBy: $request->user()
        );

        return response()->json([
            'message' => 'Reapplication draft created successfully.',
            'data' => $newApplication->load('camper', 'campSession'),
        ], Response::HTTP_CREATED);
    }

    /**
     * Sign an application digitally.
     *
     * POST /api/applications/{application}/sign
     *
     * Idempotent contract:
     *
     *   • Unsigned               → store the signature, return 200.
     *   • Signed + status=draft → overwrite with the incoming signature.
     *     The applicant is still editing, so re-signing is a legitimate
     *     action (e.g. they switched from typed to drawn).
     *   • Signed + status≠draft → return the existing signature. The
     *     legal record is locked but the endpoint must NOT error. The
     *     parent's submission flow retries `sign → consents → finalize`
     *     as a single unit, and a previous partial success must not
     *     convert into a blocking error on the next attempt.
     *
     * Under no condition does this endpoint return an error on a repeat
     * call — that was the source of BUG-209 ("Application has already
     * been signed" blocking submission).
     *
     * Implements FR-9: Digital signature support.
     */
    public function sign(SignApplicationRequest $request, Application $application): JsonResponse
    {
        // Only the application owner (parent) can sign — via ApplicationPolicy update gate.
        $this->authorize('update', $application);

        $alreadySigned = $application->isSigned();
        $isDraft = $application->isDraft();

        if (! $alreadySigned || $isDraft) {
            $application->update([
                // signature_data is typically a base64-encoded SVG or PNG of the
                // hand-drawn signature, or the typed name for typed signatures.
                'signature_data' => $request->validated('signature_data'),
                // The signer's typed name for readability on printed forms.
                'signature_name' => $request->validated('signature_name'),
                // UTC timestamp of when the signature was applied. Refreshed
                // on every accepted (re-)sign so the audit trail always names
                // the most recent signing moment.
                'signed_at' => now(),
                // Record the IP address for the legal audit trail.
                'signed_ip_address' => $request->ip(),
            ]);
        }

        return response()->json([
            'message' => $alreadySigned && ! $isDraft
                ? 'Application is already signed; existing signature preserved.'
                : 'Application signed successfully.',
            'data' => $application->fresh(),
        ]);
    }

    /**
     * Return a unified review history and activity timeline for an application.
     *
     * Aggregates:
     *   - Document review events for all documents attached to this application.
     *   - Document request events for requests scoped to this application.
     *
     * Ordered chronologically so the frontend can render a linear timeline.
     *
     * GET /api/applications/{application}/review-history
     */
    public function reviewHistory(Request $request, Application $application): JsonResponse
    {
        $this->authorize('view', $application);

        $events = DocumentReviewEvent::where('application_id', $application->id)
            ->with('performer:id,name')
            ->with('document:id,document_type,original_filename,verification_status')
            ->with('documentRequest:id,document_type,status')
            ->orderBy('created_at')
            ->get()
            ->map(fn (DocumentReviewEvent $event) => [
                'id' => $event->id,
                'action' => $event->action->value,
                'action_label' => $event->action->label(),
                'document_id' => $event->document_id,
                'document_type' => $event->document?->document_type ?? $event->documentRequest?->document_type,
                'document_request_id' => $event->document_request_id,
                'performed_by' => $event->performer
                    ? ['id' => $event->performer->id, 'name' => $event->performer->name]
                    : null,
                'reason' => $event->reason,
                'notes' => $event->notes,
                'created_at' => $event->created_at->toIso8601String(),
            ]);

        return response()->json([
            'data' => $events,
            'meta' => [
                'application_id' => $application->id,
                'reviewed_by' => $application->reviewed_by,
                'reviewed_at' => $application->reviewed_at?->toIso8601String(),
                'review_started_by' => $application->review_started_by,
                'review_started_at' => $application->review_started_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * List all documents attached to an application (live, unfiltered by role).
     *
     * GET /api/applications/{application}/documents
     *
     * Returns every Document polymorphically attached to this Application —
     * both direct attachments (documentable = Application) AND documents
     * attached to the camper that match this application's document requests.
     * This is what the reviewer workspace renders: it must show the
     * full document picture for the application, not just the canonical
     * section snapshot.
     *
     * Admin-only. Applicants should use /applications/{id} which returns the
     * canonical projection appropriate for their role.
     */
    public function documents(Request $request, Application $application): JsonResponse
    {
        // ApplicationPolicy view gate + admin middleware on the route both
        // enforce access; keeping the authorize() call makes the controller
        // self-contained and honors the "Policy authorization on every
        // resource endpoint" invariant from the safety gate.
        $this->authorize('view', $application);

        if (! $request->user()->isAdmin()) {
            return response()->json(['message' => 'Forbidden.'], Response::HTTP_FORBIDDEN);
        }

        // Documents directly attached to this Application (paper packets,
        // application-scoped uploads).
        $applicationDocs = Document::with(['uploader:id,name,email', 'documentRequest'])
            ->where('documentable_type', 'App\\Models\\Application')
            ->where('documentable_id', $application->id)
            ->whereNull('archived_at')
            ->whereNotNull('submitted_at')
            ->get();

        // Documents attached to this application's CAMPER. The reviewer needs
        // every submitted document for the child — immunization record,
        // insurance card, medical exam, admin-requested uploads, etc. — not
        // just the subset that happens to have a DocumentRequest row pointing
        // at this application. Before this broadening, applicant-uploaded
        // required docs (attached to Camper with no DocumentRequest) were
        // invisible to the reviewer and the panel read "No documents or
        // requests for this application yet" even when the file was in the
        // system.
        //
        // Scope is camper-wide on purpose: documents that cross applications
        // (e.g. a current immunization record uploaded for last year's app
        // and still valid for this year's) should remain visible. If you
        // specifically want per-application isolation, filter on
        // document_request.application_id in a later view — the raw data
        // stays inclusive.
        $camperDocs = Document::with(['uploader:id,name,email', 'documentRequest'])
            ->where('documentable_type', 'App\\Models\\Camper')
            ->where('documentable_id', $application->camper_id)
            ->whereNull('archived_at')
            ->whereNotNull('submitted_at')
            ->get();

        // Orphaned documents — no documentable_type/id — uploaded by this applicant.
        // These arrive when the applicant uses the supplementary UploadArea on the
        // My Documents page, which has no application context. Visible once either:
        //   - submitted_at is set (new flow: submit() called immediately on upload), OR
        //   - sent_at is set (legacy flow: doc was attached to an inbox message first).
        // The OR covers existing docs uploaded before the auto-submit fix was deployed.
        $applicantUserId = $application->camper?->user_id;
        $orphanedDocs = $applicantUserId
            ? Document::with(['uploader:id,name,email', 'documentRequest'])
                ->whereNull('documentable_type')
                ->whereNull('documentable_id')
                ->where('uploaded_by', $applicantUserId)
                ->whereNull('archived_at')
                ->where(function ($q) {
                    $q->whereNotNull('submitted_at')->orWhereNotNull('sent_at');
                })
                ->get()
            : collect();

        /** @var \Illuminate\Support\Collection<int, Document> $all */
        $all = $applicationDocs->concat($camperDocs)->concat($orphanedDocs)
            ->unique('id')
            ->sortByDesc('created_at')
            ->values();

        return response()->json([
            'data' => $all->map(fn (Document $doc) => [
                'id' => $doc->id,
                'document_type' => $doc->document_type,
                'original_filename' => $doc->original_filename,
                'mime_type' => $doc->mime_type,
                'file_size' => $doc->file_size,
                'verification_status' => $doc->verification_status,
                'submitted_at' => $doc->submitted_at?->toIso8601String(),
                'sent_at' => $doc->sent_at?->toIso8601String(),
                'created_at' => $doc->created_at?->toIso8601String(),
                'scan_passed' => $doc->scan_passed,
                'rejection_reason' => $doc->rejection_reason,
                'documentable_type' => $doc->documentable_type,
                'documentable_id' => $doc->documentable_id,
                'document_request_id' => $doc->document_request_id,
                'uploader' => $doc->uploader ? [
                    'id' => $doc->uploader->id,
                    'name' => $doc->uploader->name,
                    'email' => $doc->uploader->email,
                ] : null,
            ])->all(),
            'meta' => [
                'application_id' => $application->id,
                'camper_id' => $application->camper_id,
                'count' => $all->count(),
            ],
        ]);
    }

    /**
     * List all document requests (admin-issued asks) for an application.
     *
     * GET /api/applications/{application}/document-requests
     *
     * Returns every DocumentRequest scoped to this application, including
     * both awaiting-upload requests (no document yet) and completed requests
     * (document matched, possibly reviewed). The reviewer workspace uses this
     * to render the "Requested Documents" list — entries the UI should show
     * as Requested / Awaiting Upload / Submitted / Under Review / Approved /
     * Rejected / Overdue depending on request.status.
     */
    public function documentRequests(Request $request, Application $application): JsonResponse
    {
        $this->authorize('view', $application);

        if (! $request->user()->isAdmin()) {
            return response()->json(['message' => 'Forbidden.'], Response::HTTP_FORBIDDEN);
        }

        $requests = DocumentRequest::with([
            'requestedByAdmin:id,name',
            'latestDocument',
        ])
            ->where('application_id', $application->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $requests->map(fn (DocumentRequest $r) => [
                'id' => $r->id,
                'document_type' => $r->document_type,
                'status' => $r->status,
                'due_date' => $r->due_date?->toIso8601String(),
                'instructions' => $r->instructions,
                'rejection_reason' => $r->rejection_reason,
                'created_at' => $r->created_at?->toIso8601String(),
                'uploaded_at' => $r->uploaded_at?->toIso8601String(),
                'uploaded_file_name' => $r->uploaded_file_name,
                'reviewed_at' => $r->reviewed_at?->toIso8601String(),
                'is_overdue' => $r->isOverdue(),
                'camper_id' => $r->camper_id,
                'requested_by' => $r->requestedByAdmin ? [
                    'id' => $r->requestedByAdmin->id,
                    'name' => $r->requestedByAdmin->name,
                ] : null,
                'latest_document_id' => $r->latestDocument?->id,
            ])->all(),
            'meta' => [
                'application_id' => $application->id,
                'count' => $requests->count(),
            ],
        ]);
    }

    /**
     * Soft-claim a review on this application.
     *
     * POST /api/applications/{application}/start-review
     *
     * Records the current admin as the active reviewer and stamps the claim
     * time. The claim is NOT a lock — a different admin can claim it later,
     * which overwrites these fields. The final decision (approve / reject /
     * waitlist) writes to reviewed_by + reviewed_at, distinct columns so the
     * UI can show "Review started by Jane · Approved by Bob" when two
     * different admins were involved.
     *
     * Status transition: if the application is currently Submitted, it is
     * advanced to UnderReview so list views and queue counters reflect that
     * it's actively being handled. Applications already in UnderReview or
     * further states only update the claim fields.
     */
    public function startReview(Request $request, Application $application): JsonResponse
    {
        $this->authorize('review', $application);

        if ($application->isDraft()) {
            return response()->json([
                'message' => 'Draft applications cannot be reviewed.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $admin = $request->user();

        DB::transaction(function () use ($application, $admin) {
            $application->review_started_by = $admin->id;
            $application->review_started_at = now();

            if ($application->status === ApplicationStatus::Submitted) {
                $application->status = ApplicationStatus::UnderReview;
            }

            $application->save();

            // Append to the review-history ledger so the timeline shows
            // "Review started by [admin] on [date]" alongside document events.
            DocumentReviewEvent::recordApplicationEvent(
                application: $application,
                admin: $admin,
                action: \App\Enums\DocumentReviewAction::ReviewStarted,
            );
        });

        return response()->json([
            'message' => 'Review started.',
            'data' => $application->fresh()->load('reviewStarter:id,name'),
        ]);
    }
}
