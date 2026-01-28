<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Document\StoreDocumentRequest;
use App\Models\Document;
use App\Services\DocumentService;
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
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isAdmin()) {
            $documents = Document::with('documentable', 'uploader')
                ->latest()
                ->paginate(15);
        } elseif ($user->isParent()) {
            $camperIds = $user->campers()->pluck('id');
            $documents = Document::with('documentable', 'uploader')
                ->where(function ($query) use ($camperIds) {
                    $query->where(function ($q) use ($camperIds) {
                        $q->where('documentable_type', 'App\\Models\\Camper')
                            ->whereIn('documentable_id', $camperIds);
                    })->orWhere('uploaded_by', auth()->id());
                })
                ->latest()
                ->paginate(15);
        } else {
            $documents = Document::with('documentable', 'uploader')
                ->where('uploaded_by', $user->id)
                ->latest()
                ->paginate(15);
        }

        return response()->json([
            'data' => $documents->items(),
            'meta' => [
                'current_page' => $documents->currentPage(),
                'last_page' => $documents->lastPage(),
                'per_page' => $documents->perPage(),
                'total' => $documents->total(),
            ],
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

        if (!$result['success']) {
            return response()->json([
                'message' => $result['message'],
            ], Response::HTTP_BAD_REQUEST);
        }

        return response()->json([
            'message' => 'Document uploaded successfully.',
            'data' => $result['document'],
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
     */
    public function download(Document $document): StreamedResponse|JsonResponse
    {
        $this->authorize('view', $document);

        if (!$document->isSecure() && !auth()->user()->isAdmin()) {
            return response()->json([
                'message' => 'Document is pending security scan.',
            ], Response::HTTP_FORBIDDEN);
        }

        return $this->documentService->download($document);
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
