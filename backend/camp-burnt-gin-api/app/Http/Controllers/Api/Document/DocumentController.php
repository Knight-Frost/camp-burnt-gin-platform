<?php

namespace App\Http\Controllers\Api\Document;

use App\Http\Controllers\Controller;
use App\Http\Requests\Document\StoreDocumentRequest;
use App\Models\Application;
use App\Models\AuditLog;
use App\Models\Document;
use App\Models\DocumentReviewEvent;
use App\Models\MedicalRecord;
use App\Services\Document\DocumentMatchingService;
use App\Services\Document\DocumentReviewService;
use App\Services\Document\DocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * DocumentController — manages file upload, listing, verification, download, and deletion.
 *
 * Documents in this system are polymorphic — they can be attached to a Camper, a MedicalRecord,
 * or other entity types (via documentable_type and documentable_id). This controller handles
 * the HTTP layer while DocumentService handles the actual storage operations.
 *
 * Implements FR-34 and FR-35: File upload and validation requirements.
 *
 * Authorization model (three-tier visibility):
 *   - Admin:           sees all documents; can filter by type, owner, and verification status
 *   - Medical user:    sees documents for all campers and medical records + their own uploads
 *   - Applicant:       sees only documents attached to their own campers + their own uploads
 *   - Other:           sees only documents they personally uploaded
 *
 * Security controls on download:
 *   - Files that failed malware scanning (scan_passed = false) cannot be downloaded by anyone
 *   - Files pending review (scan_passed = null) can only be downloaded by admins
 *   - Files that passed scanning (scan_passed = true) can be downloaded by any authorized user
 *
 * Routes:
 *   GET    /api/documents                       — list documents (role-filtered)
 *   POST   /api/documents                       — upload a new document
 *   GET    /api/documents/{document}            — view document metadata
 *   GET    /api/documents/{document}/download   — download file (security-gated)
 *   PATCH  /api/documents/{document}/verify     — approve or reject (admin)
 *   DELETE /api/documents/{document}            — delete document
 */
class DocumentController extends Controller
{
    /**
     * Inject DocumentService via constructor for file storage operations.
     */
    public function __construct(
        protected DocumentService $documentService,
        protected DocumentReviewService $reviewService,
        protected DocumentMatchingService $matchingService,
    ) {}

    /**
     * List documents accessible to the authenticated user.
     *
     * The query is branched by role because each role has very different visibility rules.
     * Filters (documentable_type, documentable_id, verification_status, search) are applied
     * on top of the role-scoped base query.
     *
     * Pagination is always applied to prevent loading hundreds of files at once.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $documentableType = $request->input('documentable_type');
        $documentableId = $request->input('documentable_id');
        $verificationStatus = $request->input('verification_status');
        $search = $request->input('search');
        // When true, show only archived documents; when false (default), hide them.
        $includeArchived = filter_var($request->input('include_archived', false), FILTER_VALIDATE_BOOLEAN);

        if ($user->isAdmin()) {
            // Admins see everything; apply optional admin-specific filters
            $query = Document::with('documentable', 'uploader')->latest();

            // Archive filter: by default exclude archived documents from the active workflow view.
            // Pass ?include_archived=true to see only archived documents (the Archived tab).
            if ($includeArchived) {
                $query->whereNotNull('archived_at');
            } else {
                $query->whereNull('archived_at');
            }

            // Submission gate — two invariants admins depend on:
            //
            //   1. The document itself has been submitted (submitted_at IS NOT NULL).
            //      Draft documents are the uploader's private staging area.
            //
            //   2. If the document is attached to an Application, that Application
            //      must itself be submitted (is_draft = false AND submitted_at set).
            //      An Application-polymorphic document with submitted_at set while
            //      the parent Application is still a draft is a BROKEN state — it
            //      used to leak applicant staging PHI into the admin queue. This
            //      filter is the last line of defence: even if something upstream
            //      stamps submitted_at prematurely, the admin queue stays clean.
            $query->whereNotNull('submitted_at');
            $this->excludeDocumentsForDraftApplications($query);

            // Optional filter: restrict to a specific entity type (e.g., "App\Models\Camper")
            if ($documentableType) {
                $query->where('documentable_type', $documentableType);
            }
            if ($documentableId) {
                $query->where('documentable_id', (int) $documentableId);
            }
            if ($verificationStatus) {
                $query->where('verification_status', $verificationStatus);
            }
            // Search by the name of the person who uploaded the document
            if ($search) {
                $query->whereHas('uploader', fn ($q) => $q->where('name', 'like', "%{$search}%"));
            }

            $documents = $query->paginate(20);
        } elseif ($user->isMedicalProvider()) {
            // Medical staff see documents attached to active campers and their medical records,
            // plus any documents they personally uploaded.
            // Scoping to is_active=true prevents PHI enumeration for rejected or withdrawn applicants —
            // medical staff should only see records for campers currently enrolled at camp.
            $medicalRecordIds = \App\Models\MedicalRecord::where('is_active', true)->pluck('id');
            $camperIds = \App\Models\Camper::where('is_active', true)->pluck('id');

            $query = Document::with('documentable', 'uploader')
                ->where(function ($q) use ($camperIds, $medicalRecordIds, $user) {
                    $q->where(function ($inner) use ($camperIds) {
                        // Documents attached directly to campers
                        $inner->where('documentable_type', 'App\\Models\\Camper')
                            ->whereIn('documentable_id', $camperIds);
                    })->orWhere(function ($inner) use ($medicalRecordIds) {
                        // Documents attached to medical records
                        $inner->where('documentable_type', 'App\\Models\\MedicalRecord')
                            ->whereIn('documentable_id', $medicalRecordIds);
                    })->orWhere('uploaded_by', $user->id); // Their own uploads
                });

            // Optional type and ID filters still apply within the allowed set
            if ($documentableType) {
                $query->where('documentable_type', $documentableType);
            }
            if ($documentableId) {
                $query->where('documentable_id', (int) $documentableId);
            }

            // Medical providers only see submitted documents — drafts are still private
            // staging uploads by the applicant and have not been formally sent to staff.
            // Application-polymorphic documents additionally respect their parent
            // application's submission state (see excludeDocumentsForDraftApplications).
            $query->whereNotNull('submitted_at');
            $this->excludeDocumentsForDraftApplications($query);

            $documents = $query->latest()->paginate(15);
        } elseif ($user->isApplicant()) {
            // Applicants see only documents for their own campers and their own uploads
            $camperIds = $user->campers()->pluck('id');

            $query = Document::with('documentable', 'uploader')
                ->where(function ($q) use ($camperIds, $user) {
                    $q->where(function ($inner) use ($camperIds) {
                        // Documents attached to campers that belong to this applicant
                        $inner->where('documentable_type', 'App\\Models\\Camper')
                            ->whereIn('documentable_id', $camperIds);
                    })->orWhere('uploaded_by', $user->id); // Their own uploads
                })
                // Applicants who "deleted" a submitted document get their view
                // hidden via applicant_hidden_at. The record and file stay put
                // for admin/audit purposes but must not come back in the
                // uploader's own list.
                ->whereNull('applicant_hidden_at');

            if ($documentableType) {
                $query->where('documentable_type', $documentableType);
            }
            if ($documentableId) {
                $query->where('documentable_id', (int) $documentableId);
            }

            $documents = $query->latest()->paginate(15);
        } else {
            // Fallback: any other role sees only documents they personally uploaded.
            // Still respect applicant_hidden_at — the fallback role is acting
            // as the uploader from the row's perspective.
            $documents = Document::with('documentable', 'uploader')
                ->where('uploaded_by', $user->id)
                ->whereNull('applicant_hidden_at')
                ->latest()
                ->paginate(15);
        }

        return response()->json([
            // transformDocument maps internal fields to the API contract the frontend expects
            'data' => array_map([$this, 'transformDocument'], $documents->items()),
            'meta' => [
                'current_page' => $documents->currentPage(),
                'last_page' => $documents->lastPage(),
                'per_page' => $documents->perPage(),
                'total' => $documents->total(),
            ],
        ]);
    }

    /**
     * Approve or reject a document (admin only).
     *
     * Sets verification_status, records the verifying admin's ID, and timestamps the action.
     * Status must be either "approved" or "rejected" — no other values are accepted.
     */
    public function verify(Request $request, Document $document): JsonResponse
    {
        // DocumentPolicy::update restricts this to admin roles
        $this->authorize('update', $document);

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:approved,rejected'],
            // Reason is required when rejecting — surfaces to applicant and review timeline.
            'reason' => ['required_if:status,rejected', 'nullable', 'string', 'max:2000'],
        ]);

        /** @var \App\Models\User $admin */
        $admin = $request->user();

        $updated = match ($validated['status']) {
            'approved' => $this->reviewService->approve($document, $admin),
            'rejected' => $this->reviewService->reject($document, $admin, $validated['reason'] ?? 'No reason provided.'),
        };

        return response()->json([
            'message' => 'Document '.$validated['status'].'.',
            'data' => $this->transformDocument($updated),
        ]);
    }

    /**
     * Upload a new document file.
     *
     * Validation (file type, size, required fields) is handled by StoreDocumentRequest.
     * DocumentService::upload handles storage, thumbnail generation, and virus scan queuing.
     */
    public function store(StoreDocumentRequest $request): JsonResponse
    {
        // Delegate all storage logic to the service; it returns success/failure with the model
        $result = $this->documentService->upload(
            $request->file('file'),
            $request->validated(),
            $request->user()
        );

        if (! $result['success']) {
            return response()->json([
                'message' => $result['message'],
            ], Response::HTTP_BAD_REQUEST);
        }

        return response()->json([
            'message' => 'Document uploaded successfully.',
            'data' => $this->transformDocument($result['document']),
        ], Response::HTTP_CREATED);
    }

    /**
     * Display metadata for a single document.
     *
     * Does not return the file itself — use the /download endpoint for that.
     */
    public function show(Request $request, Document $document): JsonResponse
    {
        // DocumentPolicy::view checks the user is authorized to see this document
        $this->authorize('view', $document);

        // Log metadata access — viewing document metadata (including the decrypted
        // original_filename which can contain PHI) counts as a PHI access event
        // under HIPAA §164.312(b). This is separate from the download audit log.
        AuditLog::logPhiAccess(
            'document_view',
            $request->user(),
            $document,
            ['document_type' => $document->document_type]
        );

        return response()->json([
            'data' => $document->load('documentable', 'uploader'),
        ]);
    }

    /**
     * Download a document file as a binary stream.
     *
     * Three-level security gate:
     *   1. DocumentPolicy::view — is the user authorized to access this document at all?
     *   2. scan_passed === false — file failed malware scan; no one can download it
     *   3. isSecure() / !isAdmin() — pending files are admin-only until scan passes
     *
     * Security enforcement:
     *   - Rejected files (scan_passed = false): Cannot be downloaded by anyone
     *   - Pending review files (scan_passed = null): Admin only
     *   - Approved files (scan_passed = true): All authorized users
     */
    public function download(Request $request, Document $document): StreamedResponse|JsonResponse
    {
        // First check: does this user have general access to this document?
        $this->authorize('view', $document);

        // Second check: file failed security scan — block all downloads without exception
        if ($document->scan_passed === false) {
            return response()->json([
                'message' => 'Document failed security check and cannot be downloaded.',
            ], Response::HTTP_FORBIDDEN);
        }

        // Third check: file is still pending scan review — only admins may access it early
        if (! $document->isSecure() && ! $request->user()->isAdmin()) {
            return response()->json([
                'message' => 'Document is pending security review. Contact an administrator.',
            ], Response::HTTP_FORBIDDEN);
        }

        // Log PHI access before streaming — satisfies HIPAA §164.312(b) Audit Controls.
        AuditLog::logPhiAccess(
            'document_download',
            $request->user(),
            $document,
            ['document_type' => $document->document_type]
        );

        // All checks passed — stream the file to the client via DocumentService
        return $this->documentService->download($document);
    }

    /**
     * Transform a Document model into the API response shape expected by the frontend.
     *
     * This private method centralises the field mapping so index(), store(), and verify()
     * all return documents in the exact same shape. It handles two edge cases:
     *   1. original_filename is encrypted — a DecryptException on bad data returns a fallback name
     *   2. verification_status is a backed enum — getRawOriginal() avoids a ValueError on
     *      legacy or invalid values that don't match the enum's defined cases
     *
     * Add a WHERE clause that excludes documents whose parent Application is
     * still a draft. Safe to call on any Document query builder — it only
     * affects rows where documentable_type is App\Models\Application. Rows
     * attached to Camper, MedicalRecord, Message, etc. pass through unchanged.
     *
     * This is the admin/medical-side last line of defence: even if some call
     * path stamps submitted_at on a doc whose parent application is a draft,
     * it still will not appear in the admin review queue.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<Document>  $query
     */
    private function excludeDocumentsForDraftApplications($query): void
    {
        $query->where(function ($q) {
            // Non-Application docs pass unconditionally.
            $q->where('documentable_type', '!=', \App\Models\Application::class)
                ->orWhereNull('documentable_type')
                // Application-polymorphic docs must have a parent app that has
                // status != 'draft' AND has a submitted_at timestamp.
                ->orWhereExists(function ($sub) {
                    $sub->select(\Illuminate\Support\Facades\DB::raw(1))
                        ->from('applications')
                        ->whereColumn('applications.id', 'documents.documentable_id')
                        ->where('documents.documentable_type', \App\Models\Application::class)
                        ->where('applications.status', '!=', \App\Enums\ApplicationStatus::Draft->value)
                        ->whereNotNull('applications.submitted_at');
                });
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function transformDocument(Document $document): array
    {
        // original_filename is encrypted — guard against DecryptException on corrupt records
        try {
            $fileName = $document->original_filename;
        } catch (\Exception) {
            // Fallback so a single bad record doesn't crash the whole list response
            $fileName = "Document #{$document->id}";
        }

        // getRawOriginal() bypasses enum casting — prevents ValueError if the DB has an unexpected value
        $rawStatus = $document->getRawOriginal('verification_status');
        $verificationStatus = in_array($rawStatus, ['pending', 'approved', 'rejected'], true)
            ? $rawStatus
            : 'pending'; // Default to "pending" for any unrecognised legacy values

        // Resolve the camper this document belongs to so the applicant UI can
        // tab/group documents per child without having to follow the
        // documentable polymorph on the client. For Camper-type documents the
        // answer is trivially the documentable_id; for Application-type the
        // answer requires a join to the application's camper. Unowned documents
        // (messaging-only, etc.) have null. No PHI leak — this only returns an
        // id and name the caller is already authorized to see via the
        // index/show gates.
        $resolvedCamperId = match ($document->documentable_type) {
            'App\\Models\\Camper' => $document->documentable_id,
            'App\\Models\\Application' => optional($document->documentable)->camper_id,
            default => null,
        };

        return [
            'id' => $document->id,
            'file_name' => $fileName,
            'document_type' => $document->document_type,
            'mime_type' => $document->mime_type,
            // Frontend uses "size" not "file_size" — this mapping bridges the naming gap
            'size' => $document->file_size,
            'scan_passed' => $document->scan_passed,
            'verification_status' => $verificationStatus,
            'uploaded_by_name' => $document->uploader?->name,
            // Human-readable name of the entity this document is attached to (e.g., camper name)
            'documentable_name' => $this->resolveDocumentableName($document),
            'documentable_type' => $document->documentable_type,
            'documentable_id' => $document->documentable_id,
            // Derived camper linkage — see $resolvedCamperId above. Null for
            // documents that don't belong to a specific child (e.g. messaging
            // attachments, paper packets not yet matched). Used client-side for
            // the camper-tab filter on the applicant documents page.
            'camper_id' => $resolvedCamperId,
            'created_at' => $document->created_at,
            'archived_at' => $document->archived_at,
            'submitted_at' => $document->submitted_at,
            // Null for admin/medical-visible rows; a timestamp only appears in
            // an admin response when the applicant has hidden the doc from
            // their own view. Admin UI renders a badge off this field.
            'applicant_hidden_at' => $document->applicant_hidden_at,
            // Null = still in the applicant's "Ready to Send" queue.
            // Set = pushed via the inbox messaging flow (message_document_links).
            'sent_at' => $document->sent_at,
            // Authenticated download URL — the frontend uses this to trigger the download
            'url' => url("/api/documents/{$document->id}/download"),
        ];
    }

    /**
     * Resolve a human-readable name for the entity this document is attached to.
     *
     * Used in the admin document list to show "attached to: John Doe" instead of a raw ID.
     * Returns null for standalone documents (no documentable) or unrecognised types.
     */
    private function resolveDocumentableName(Document $document): ?string
    {
        return match ($document->documentable_type) {
            // full_name is a computed accessor on the Camper model (first_name + last_name)
            'App\\Models\\Camper' => $document->documentable?->full_name,
            // For application and medical record documents, show the associated camper's name.
            // instanceof check required for PHPStan to narrow the type from Model to Application/MedicalRecord.
            'App\\Models\\Application' => $document->documentable instanceof Application
                ? $document->documentable->camper?->full_name
                : null,
            'App\\Models\\MedicalRecord' => $document->documentable instanceof MedicalRecord
                ? $document->documentable->camper?->full_name
                : null,
            default => null,
        };
    }

    /**
     * Submit a draft document to staff (applicant action).
     *
     * Sets submitted_at = now(), making the document visible to admins for the first time.
     * This enforces the "upload ≠ submission" privacy model — applicants can upload and
     * review files before committing to send them to staff.
     *
     * Authorization: only the uploader (or an admin) may submit a document.
     */
    public function submit(Request $request, Document $document): JsonResponse
    {
        $this->authorize('view', $document);

        // Guard: already submitted — idempotent, not an error
        if ($document->submitted_at !== null) {
            return response()->json([
                'message' => 'Document already submitted.',
                'data' => $this->transformDocument($document),
            ]);
        }

        // Only the uploader or an admin may submit
        $user = $request->user();
        if (! $user->isAdmin() && $document->uploaded_by !== $user->id) {
            return response()->json([
                'message' => 'You do not have permission to submit this document.',
            ], Response::HTTP_FORBIDDEN);
        }

        // Integrity guard — a document attached to a draft Application must NOT
        // be independently submittable. The correct lifecycle is:
        //   1. applicant uploads doc → draft (submitted_at=null)
        //   2. applicant finalizes application → finalize() cascades
        //      submitted_at=now() to every linked doc atomically
        //
        // Allowing this endpoint to flip submitted_at on a draft-linked doc
        // was the bug that leaked staging PHI into the admin queue: the doc
        // looked submitted, admin queries matched it, the parent application
        // was still a hidden draft. Refuse here so future callers cannot
        // reintroduce the leak.
        if ($document->documentable_type === \App\Models\Application::class) {
            $parentApp = \App\Models\Application::find($document->documentable_id);
            if ($parentApp && ($parentApp->isDraft() || $parentApp->submitted_at === null)) {
                return response()->json([
                    'message' => 'This document is attached to a draft application. Submit the application itself; its documents will become visible to staff at that point.',
                    'errors' => ['document' => 'parent_application_is_draft'],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        $document->update(['submitted_at' => now()]);

        AuditLog::logPhiAccess(
            'document_submit',
            $user,
            $document,
            ['document_type' => $document->document_type]
        );

        // Match to originating request, advance request status, record timeline event,
        // and notify admins that a new document is ready for review.
        $this->reviewService->recordSent($document->fresh(), $user);

        return response()->json([
            'message' => 'Document submitted to staff.',
            'data' => $this->transformDocument($document->fresh()),
        ]);
    }

    /**
     * Archive a document — hide it from the active workflow view without deleting it.
     *
     * Archived documents remain in the database and can be restored at any time.
     * This is the preferred non-destructive cleanup action for admins.
     */
    public function archive(Document $document): JsonResponse
    {
        $this->authorize('archive', $document);

        $document->update(['archived_at' => now()]);

        AuditLog::logPhiAccess(
            'document_archive',
            request()->user(),
            $document,
            ['document_type' => $document->document_type]
        );

        return response()->json([
            'message' => 'Document archived.',
            'data' => $this->transformDocument($document->fresh()),
        ]);
    }

    /**
     * Restore a previously archived document back to the active workflow view.
     */
    public function restore(Document $document): JsonResponse
    {
        $this->authorize('archive', $document);

        $document->update(['archived_at' => null]);

        AuditLog::logPhiAccess(
            'document_restore',
            request()->user(),
            $document,
            ['document_type' => $document->document_type]
        );

        return response()->json([
            'message' => 'Document restored.',
            'data' => $this->transformDocument($document->fresh()),
        ]);
    }

    /**
     * Delete or hide a document.
     *
     * One endpoint, two semantically different outcomes. The branch is driven
     * by the combination of actor role and record state, never by a client
     * flag — callers cannot bypass the split. The current behavior was:
     *
     *   applicant clicks "Delete" on a submitted insurance card
     *     → soft-delete cascades to the admin queue
     *     → compliance record effectively destroyed by the uploader
     *
     * New behavior:
     *
     *   Admin action, any state
     *     → force-delete: row and file are permanently destroyed. The admin
     *       already has ::archive() as the non-destructive option. Delete
     *       means delete.
     *
     *   Applicant action, pristine draft (canForceDelete())
     *     → force-delete: the doc was never submitted or attached, so no
     *       system record is lost.
     *
     *   Applicant action, submitted / attached / archived doc
     *     → hide: flip applicant_hidden_at so the document disappears from
     *       the uploader's own list. Admin, medical, audit queries are
     *       unaffected. The file and row stay intact.
     *
     * Every branch writes an AuditLog entry BEFORE mutating state so the
     * trail survives even if the row itself is force-deleted.
     */
    public function destroy(Request $request, Document $document): JsonResponse
    {
        $user = $request->user();

        // The non-admin uploader pathway for non-pristine documents: downgrade
        // to hide. We authorize via the ::hide ability so a user who is not
        // the uploader gets a clean 403 rather than a misleading "deleted"
        // response shape.
        if (! $user->isAdmin() && ! $document->canForceDelete()) {
            $this->authorize('hide', $document);

            if ($document->applicant_hidden_at === null) {
                AuditLog::logPhiAccess(
                    'document_hide',
                    $user,
                    $document,
                    [
                        'document_type' => $document->document_type,
                        'was_submitted' => $document->submitted_at !== null,
                    ]
                );

                $document->update(['applicant_hidden_at' => now()]);
            }

            return response()->json([
                'message' => 'Document hidden from your view. Camp staff still have access to this record.',
                'data' => $this->transformDocument($document->fresh()),
            ]);
        }

        // Force-delete path: admin (any doc) or uploader of a pristine draft.
        $this->authorize('delete', $document);

        // Snapshot minimal metadata BEFORE the row disappears so the audit
        // entry still points at something meaningful after force-delete runs.
        AuditLog::logPhiAccess(
            'document_delete',
            $user,
            $document,
            [
                'document_type' => $document->document_type,
                'was_submitted' => $document->submitted_at !== null,
                'was_attached_to_message' => $document->message_id !== null,
                'actor_role' => $user->isAdmin() ? 'admin' : 'uploader',
            ]
        );

        // forceDelete triggers the Document::forceDeleting hook which removes
        // the physical file from disk.
        $this->documentService->forceDelete($document);

        return response()->json([
            'message' => 'Document deleted successfully.',
        ]);
    }

    /**
     * Return the chronological review event history for a single document.
     *
     * GET /api/documents/{document}/review-history
     */
    public function reviewHistory(Request $request, Document $document): JsonResponse
    {
        $this->authorize('view', $document);

        $events = $document->reviewEvents()
            ->with('performer:id,name,email')
            ->get()
            ->map(fn ($event) => [
                'id' => $event->id,
                'action' => $event->action->value,
                'action_label' => $event->action->label(),
                'performed_by' => $event->performer
                    ? ['id' => $event->performer->id, 'name' => $event->performer->name]
                    : null,
                'reason' => $event->reason,
                'notes' => $event->notes,
                'created_at' => $event->created_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $events]);
    }
}
