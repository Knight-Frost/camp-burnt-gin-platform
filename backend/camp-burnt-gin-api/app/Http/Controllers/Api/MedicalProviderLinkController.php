<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MedicalProviderLink\StoreMedicalProviderLinkRequest;
use App\Models\Camper;
use App\Models\MedicalProviderLink;
use App\Services\MedicalProviderLinkService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for medical provider link management.
 *
 * Handles creation, access, and revocation of secure provider links.
 * Implements FR-19 through FR-26: Medical provider access requirements.
 */
class MedicalProviderLinkController extends Controller
{
    public function __construct(
        protected MedicalProviderLinkService $linkService
    ) {}

    /**
     * List provider links accessible to the current user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isAdmin()) {
            $links = MedicalProviderLink::with(['camper', 'creator'])
                ->latest()
                ->paginate(15);
        } else {
            $camperIds = $user->campers()->pluck('id');
            $links = MedicalProviderLink::with(['camper', 'creator'])
                ->whereIn('camper_id', $camperIds)
                ->latest()
                ->paginate(15);
        }

        return response()->json([
            'data' => $links->items(),
            'meta' => [
                'current_page' => $links->currentPage(),
                'last_page' => $links->lastPage(),
                'per_page' => $links->perPage(),
                'total' => $links->total(),
            ],
        ]);
    }

    /**
     * Create and send a new provider link.
     */
    public function store(StoreMedicalProviderLinkRequest $request): JsonResponse
    {
        $camper = Camper::findOrFail($request->validated('camper_id'));
        $this->authorize('createProviderLink', $camper);

        $link = $this->linkService->createAndSend(
            $camper,
            $request->validated(),
            $request->user()
        );

        return response()->json([
            'message' => 'Provider link created and sent successfully.',
            'data' => $link,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display a specific provider link.
     */
    public function show(MedicalProviderLink $providerLink): JsonResponse
    {
        $this->authorize('view', $providerLink);

        return response()->json([
            'data' => $providerLink->load(['camper', 'creator', 'revoker']),
        ]);
    }

    /**
     * Revoke a provider link.
     */
    public function revoke(Request $request, MedicalProviderLink $providerLink): JsonResponse
    {
        $this->authorize('revoke', $providerLink);

        if ($providerLink->isRevoked()) {
            return response()->json([
                'message' => 'Link has already been revoked.',
            ], Response::HTTP_BAD_REQUEST);
        }

        $this->linkService->revoke($providerLink, $request->user());

        return response()->json([
            'message' => 'Provider link revoked successfully.',
        ]);
    }

    /**
     * Resend a provider link (admin only).
     */
    public function resend(MedicalProviderLink $providerLink): JsonResponse
    {
        if ($providerLink->isRevoked() || $providerLink->is_used) {
            $newLink = $this->linkService->regenerate($providerLink, auth()->user());

            return response()->json([
                'message' => 'New provider link generated and sent.',
                'data' => $newLink,
            ]);
        }

        $this->linkService->resend($providerLink);

        return response()->json([
            'message' => 'Provider link resent successfully.',
        ]);
    }

    /**
     * Access the provider form via token (public route).
     */
    public function accessForm(string $token): JsonResponse
    {
        $link = MedicalProviderLink::where('token', $token)->first();

        if (!$link) {
            return response()->json([
                'message' => 'Invalid link.',
            ], Response::HTTP_NOT_FOUND);
        }

        if (!$link->isValid()) {
            $reason = $link->isRevoked() ? 'revoked' : ($link->isExpired() ? 'expired' : 'already used');
            return response()->json([
                'message' => "This link has been {$reason}.",
            ], Response::HTTP_FORBIDDEN);
        }

        $link->markAsAccessed();

        $camper = $link->camper->load(['medicalRecord', 'allergies', 'medications']);

        return response()->json([
            'data' => [
                'camper_name' => $camper->full_name,
                'medical_record' => $camper->medicalRecord,
                'allergies' => $camper->allergies,
                'medications' => $camper->medications,
            ],
        ]);
    }

    /**
     * Submit medical information via provider link.
     */
    public function submitForm(Request $request, string $token): JsonResponse
    {
        $link = MedicalProviderLink::where('token', $token)->first();

        if (!$link || !$link->isValid()) {
            return response()->json([
                'message' => 'Invalid or expired link.',
            ], Response::HTTP_FORBIDDEN);
        }

        $result = $this->linkService->processSubmission($link, $request->all());

        if (!$result['success']) {
            return response()->json([
                'message' => $result['message'],
                'errors' => $result['errors'] ?? [],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return response()->json([
            'message' => 'Medical information submitted successfully.',
        ]);
    }

    /**
     * Upload document via provider link.
     */
    public function uploadDocument(Request $request, string $token): JsonResponse
    {
        $link = MedicalProviderLink::where('token', $token)->first();

        if (!$link || !$link->isValid()) {
            return response()->json([
                'message' => 'Invalid or expired link.',
            ], Response::HTTP_FORBIDDEN);
        }

        $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,jpeg,jpg,png', 'max:10240'],
            'document_type' => ['nullable', 'string', 'max:100'],
        ]);

        $result = $this->linkService->uploadDocument($link, $request->file('file'), $request->document_type);

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
}
