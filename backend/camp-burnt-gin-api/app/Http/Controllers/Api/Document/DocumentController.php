<?php

namespace App\Http\Controllers\Api\Document;

use App\Http\Controllers\Controller;
use App\Http\Requests\Document\StoreDocumentRequest;
use App\Models\Document;
use App\Services\Document\DocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Controller for document upload and management.
 *
 * Handles file uploads, downloads, and validation.
 * Implements FR-34 and FR-35: File upload and validation requirements.
 */
class DocumentController extends Controller
{
    public function __construct(
        protected DocumentService $documentService
    ) {}

    /**
     * List documents accessible to the current user.
     * Supports optional filtering via: documentable_type, documentable_id, verification_status, search.
     */
    public function index(Request $request): JsonResponse
    {
        $user               = $request->user();
        $documentableType   = $request->input('documentable_type');
        $documentableId     = $request->input('documentable_id');
        $verificationStatus = $request->input('verification_status');
        $search             = $request->input('search');

        if ($user->isAdmin()) {
            $query = Document::with('documentable', 'uploader')->latest();

            if ($documentableType) {
                $query->where('documentable_type', $documentableType);
            }
            if ($documentableId) {
                $query->where('documentable_id', (int) $documentableId);
            }
            if ($verificationStatus) {
                $query->where('verification_status', $verificationStatus);
            }
            if ($search) {
                $query->whereHas('uploader', fn ($q) => $q->where('name', 'like', "%{$search}%"));
            }

            $documents = $query->paginate(20);

        } elseif ($user->isMedicalProvider()) {
            // Camp medical staff can view all documents attached to campers and medical records.
            $medicalRecordIds = \App\Models\MedicalRecord::pluck('id');
            $camperIds        = \App\Models\Camper::pluck('id');

            $query = Document::with('documentable', 'uploader')
                ->where(function ($q) use ($camperIds, $medicalRecordIds, $user) {
                    $q->where(function ($inner) use ($camperIds) {
                        $inner->where('documentable_type', 'App\\Models\\Camper')
                              ->whereIn('documentable_id', $camperIds);
                    })->orWhere(function ($inner) use ($medicalRecordIds) {
                        $inner->where('documentable_type', 'App\\Models\\MedicalRecord')
                              ->whereIn('documentable_id', $medicalRecordIds);
                    })->orWhere('uploaded_by', $user->id);
                });

            if ($documentableType) {
                $query->where('documentable_type', $documentableType);
            }
            if ($documentableId) {
                $query->where('documentable_id', (int) $documentableId);
            }

            $documents = $query->latest()->paginate(15);

        } elseif ($user->isApplicant()) {
            $camperIds = $user->campers()->pluck('id');

            $query = Document::with('documentable', 'uploader')
                ->where(function ($q) use ($camperIds, $user) {
                    $q->where(function ($inner) use ($camperIds) {
                        $inner->where('documentable_type', 'App\\Models\\Camper')
                              ->whereIn('documentable_id', $camperIds);
                    })->orWhere('uploaded_by', $user->id);
                });

            if ($documentableType) {
                $query->where('documentable_type', $documentableType);
            }
            if ($documentableId) {
                $query->where('documentable_id', (int) $documentableId);
            }

            $documents = $query->latest()->paginate(15);

        } else {
            $documents = Document::with('documentable', 'uploader')
                ->where('uploaded_by', $user->id)
                ->latest()
                ->paginate(15);
        }

        return response()->json([
            'data' => array_map([$this, 'transformDocument'], $documents->items()),
            'meta' => [
                'current_page' => $documents->currentPage(),
                'last_page'    => $documents->lastPage(),
                'per_page'     => $documents->perPage(),
                'total'        => $documents->total(),
            ],
        ]);
    }

    /**
     * Verify (approve or reject) a document. Admin only.
     */
    public function verify(Request $request, Document $document): JsonResponse
    {
        $this->authorize('update', $document);

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:approved,rejected'],
        ]);

        $document->update([
            'verification_status' => \App\Enums\DocumentVerificationStatus::from($validated['status']),
            'verified_by'         => $request->user()->id,
            'verified_at'         => now(),
        ]);

        return response()->json([
            'message' => 'Document ' . $validated['status'] . '.',
            'data'    => $this->transformDocument($document->refresh()),
        ]);
    }

    /**
     * Upload a new document.
     */
    public function store(StoreDocumentRequest $request): JsonResponse
    {
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
     * Display document metadata.
     */
    public function show(Document $document): JsonResponse
    {
        $this->authorize('view', $document);

        return response()->json([
            'data' => $document->load('documentable', 'uploader'),
        ]);
    }

    /**
     * Download a document file.
     *
     * Security enforcement:
     * - Rejected files (scan_passed = false): Cannot be downloaded by anyone
     * - Pending review files (scan_passed = null): Admin only
     * - Approved files (scan_passed = true): All authorized users
     */
    public function download(Document $document): StreamedResponse|JsonResponse
    {
        $this->authorize('view', $document);

        if ($document->scan_passed === false) {
            return response()->json([
                'message' => 'Document failed security check and cannot be downloaded.',
            ], Response::HTTP_FORBIDDEN);
        }

        if (! $document->isSecure() && ! auth()->user()->isAdmin()) {
            return response()->json([
                'message' => 'Document is pending security review. Contact an administrator.',
            ], Response::HTTP_FORBIDDEN);
        }

        return $this->documentService->download($document);
    }

    /**
     * Transform a Document model into the API response shape expected by the frontend.
     *
     * Maps internal field names to the frontend contract and appends an authenticated
     * download URL. The original_filename is encrypted at rest; decryption errors are
     * caught gracefully so a single bad record never breaks the full list response.
     *
     * @return array<string, mixed>
     */
    private function transformDocument(Document $document): array
    {
        // original_filename is encrypted — guard against DecryptException on bad records.
        try {
            $fileName = $document->original_filename;
        } catch (\Exception) {
            $fileName = "Document #{$document->id}";
        }

        // verification_status is a backed enum; getRawOriginal avoids ValueError on bad/legacy values.
        $rawStatus = $document->getRawOriginal('verification_status');
        $verificationStatus = in_array($rawStatus, ['pending', 'approved', 'rejected'], true)
            ? $rawStatus
            : 'pending';

        return [
            'id'                  => $document->id,
            'file_name'           => $fileName,
            'document_type'       => $document->document_type,
            'mime_type'           => $document->mime_type,
            'size'                => $document->file_size,
            'scan_passed'         => $document->scan_passed,
            'verification_status' => $verificationStatus,
            'uploaded_by_name'    => $document->uploader?->name,
            'documentable_name'   => $this->resolveDocumentableName($document),
            'created_at'          => $document->created_at,
            'url'                 => url("/api/documents/{$document->id}/download"),
        ];
    }

    /**
     * Return a human-readable name for the document's parent entity (if applicable).
     */
    private function resolveDocumentableName(Document $document): ?string
    {
        if ($document->documentable_type === 'App\\Models\\Camper') {
            return $document->documentable?->full_name;
        }

        return null;
    }

    /**
     * Delete a document.
     */
    public function destroy(Document $document): JsonResponse
    {
        $this->authorize('delete', $document);

        $this->documentService->delete($document);

        return response()->json([
            'message' => 'Document deleted successfully.',
        ]);
    }
}
