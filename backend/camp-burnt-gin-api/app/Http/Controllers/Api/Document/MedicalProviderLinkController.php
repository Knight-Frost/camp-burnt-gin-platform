<?php

namespace App\Http\Controllers\Api\Document;

use App\Http\Controllers\Controller;
use App\Http\Requests\MedicalProviderLink\StoreMedicalProviderLinkRequest;
use App\Models\Camper;
use App\Models\MedicalProviderLink;
use App\Services\Medical\MedicalProviderLinkService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * MedicalProviderLinkController — creates and manages secure external provider access links.
 *
 * When an admin needs an outside doctor or nurse to fill in medical information for a camper,
 * they create a MedicalProviderLink. This controller handles the full lifecycle:
 *
 *   1. Admin creates a link → email is sent to the provider
 *   2. Provider clicks the link URL (public route) → form is displayed with current data
 *   3. Provider fills the form and submits → data is saved, link is marked used
 *   4. Admin can revoke the link at any time to prevent further access
 *
 * Security model:
 *   - Tokens are 64-character random strings, hashed with bcrypt before storage
 *   - The plain token is never stored; verification iterates active links and calls Hash::check()
 *   - Links expire after 72 hours (DEFAULT_EXPIRATION_HOURS)
 *   - A used link cannot be submitted again even within the expiry window
 *
 * Implements FR-19 through FR-26: Medical provider access requirements.
 *
 * Routes:
 *   GET    /api/provider-links                          — list links (admin or own campers)
 *   POST   /api/provider-links                         — create and email a new link
 *   GET    /api/provider-links/{id}                    — view a link record
 *   POST   /api/provider-links/{id}/revoke             — revoke a link (admin)
 *   POST   /api/provider-links/{id}/resend             — regenerate and re-send (admin)
 *   GET    /api/provider-links/access/{token}          — public: load form via token
 *   POST   /api/provider-links/submit/{token}          — public: submit medical info via token
 *   POST   /api/provider-links/upload/{token}          — public: upload a document via token
 */
class MedicalProviderLinkController extends Controller
{
    /**
     * Inject MedicalProviderLinkService for token generation, email dispatch, and data processing.
     */
    public function __construct(
        protected MedicalProviderLinkService $linkService
    ) {}

    /**
     * List medical provider links visible to the authenticated user.
     *
     * Admins see all links across all campers.
     * Applicants see only links for their own campers.
     *
     * Related data is eager-loaded so the list can display camper name,
     * medical context, and who created or revoked each link.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isAdmin()) {
            // Admins see every link in the system, most recently created first
            $links = MedicalProviderLink::with([
                'camper.user',
                'camper.allergies',
                'camper.medications',
                'camper.medicalRecord',
                'creator',
                'revoker',
            ])
                ->latest()
                ->paginate(15);
        } else {
            // Applicants only see links for campers they own
            $camperIds = $user->campers()->pluck('id');
            $links = MedicalProviderLink::with([
                'camper.user',
                'camper.allergies',
                'camper.medications',
                'camper.medicalRecord',
                'creator',
                'revoker',
            ])
                ->whereIn('camper_id', $camperIds)
                ->latest()
                ->paginate(15);
        }

        return response()->json([
            'data' => $links->items(),
            'meta' => [
                'current_page' => $links->currentPage(),
                'last_page'    => $links->lastPage(),
                'per_page'     => $links->perPage(),
                'total'        => $links->total(),
            ],
        ]);
    }

    /**
     * Create a new provider link and send it to the provider via email.
     *
     * The link service handles token generation, hashing, record creation,
     * and dispatching the email notification to the provider.
     */
    public function store(StoreMedicalProviderLinkRequest $request): JsonResponse
    {
        // Load the camper to pass to the policy and the service
        $camper = Camper::findOrFail($request->validated('camper_id'));

        // CamperPolicy::createProviderLink checks admin or the camper's parent
        $this->authorize('createProviderLink', $camper);

        // MedicalProviderLinkService creates the record and emails the provider
        $link = $this->linkService->createAndSend(
            $camper,
            $request->validated(),
            $request->user()
        );

        return response()->json([
            'message' => 'Provider link created and sent successfully.',
            'data'    => $link,
        ], Response::HTTP_CREATED);
    }

    /**
     * Show the metadata for a single provider link.
     *
     * Loads related camper, creator, and revoker for full context display.
     * Does NOT expose the hashed token (it is hidden in MedicalProviderLink::$hidden).
     */
    public function show(MedicalProviderLink $providerLink): JsonResponse
    {
        // MedicalProviderLinkPolicy::view checks admin or the link's camper owner
        $this->authorize('view', $providerLink);

        return response()->json([
            'data' => $providerLink->load(['camper', 'creator', 'revoker']),
        ]);
    }

    /**
     * Revoke an active provider link, preventing any further access via that URL.
     *
     * If the link is already revoked, return a 400 Bad Request error to prevent
     * double-revocation confusion. The service records who performed the revocation.
     */
    public function revoke(Request $request, MedicalProviderLink $providerLink): JsonResponse
    {
        // MedicalProviderLinkPolicy::revoke restricts this to admin roles
        $this->authorize('revoke', $providerLink);

        // Guard: catch attempts to revoke an already-revoked link
        if ($providerLink->isRevoked()) {
            return response()->json([
                'message' => 'Link has already been revoked.',
            ], Response::HTTP_BAD_REQUEST);
        }

        // Record the revocation with the revoking admin's ID and a timestamp
        $this->linkService->revoke($providerLink, $request->user());

        return response()->json([
            'message' => 'Provider link revoked successfully.',
        ]);
    }

    /**
     * Regenerate a new provider link and re-send it to the provider (admin only).
     *
     * Because tokens are hashed and cannot be retrieved, a resend always creates
     * a brand-new link record. The old link is automatically revoked by the service.
     */
    public function resend(MedicalProviderLink $providerLink): JsonResponse
    {
        // MedicalProviderLinkService::regenerate revokes the old link and creates a new one
        $newLink = $this->linkService->regenerate($providerLink, auth()->user());

        return response()->json([
            'message' => 'New provider link generated and sent.',
            'data'    => $newLink,
        ]);
    }

    /**
     * Public endpoint: load the provider medical form using the URL token.
     *
     * This route is unauthenticated — the token in the URL IS the authentication.
     * The token is verified against stored hashes; on success the access timestamp
     * is recorded and the camper's current medical data is returned for the form.
     */
    public function accessForm(string $token): JsonResponse
    {
        // Find the link by verifying the plain token against all active hashed tokens
        $link = $this->findLinkByPlainToken($token);

        if (! $link) {
            // Return generic "Invalid link" to avoid leaking whether the token format is correct
            return response()->json([
                'message' => 'Invalid link.',
            ], Response::HTTP_NOT_FOUND);
        }

        if (! $link->isValid()) {
            // Tell the provider WHY their link doesn't work so they can contact the admin
            $reason = $link->isRevoked() ? 'revoked' : ($link->isExpired() ? 'expired' : 'already used');

            return response()->json([
                'message' => "This link has been {$reason}.",
            ], Response::HTTP_FORBIDDEN);
        }

        // Record first access — doesn't invalidate the link, just timestamps the first open
        $link->markAsAccessed();

        // Load only the medical data the provider needs to fill in the form
        $camper = $link->camper->load(['medicalRecord', 'allergies', 'medications']);

        return response()->json([
            'data' => [
                'camper_name'    => $camper->full_name,
                'medical_record' => $camper->medicalRecord,
                'allergies'      => $camper->allergies,
                'medications'    => $camper->medications,
            ],
        ]);
    }

    /**
     * Public endpoint: receive the completed medical form submission from the provider.
     *
     * The token is re-verified on every submission attempt. If valid, the service
     * saves the submitted medical data and marks the link as used (preventing re-submission).
     */
    public function submitForm(Request $request, string $token): JsonResponse
    {
        $link = $this->findLinkByPlainToken($token);

        // Invalid or already-expired/revoked/used link — block submission
        if (! $link || ! $link->isValid()) {
            return response()->json([
                'message' => 'Invalid or expired link.',
            ], Response::HTTP_FORBIDDEN);
        }

        // The service validates the submitted data, saves it, and marks the link used
        $result = $this->linkService->processSubmission($link, $request->all());

        if (! $result['success']) {
            return response()->json([
                'message' => $result['message'],
                'errors'  => $result['errors'] ?? [],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return response()->json([
            'message' => 'Medical information submitted successfully.',
        ]);
    }

    /**
     * Public endpoint: allow the provider to upload a supporting document via the link.
     *
     * The token is verified before accepting the upload. Accepted file types and max
     * size are validated here before passing to the service for storage.
     */
    public function uploadDocument(Request $request, string $token): JsonResponse
    {
        $link = $this->findLinkByPlainToken($token);

        // Block upload if the link is no longer valid
        if (! $link || ! $link->isValid()) {
            return response()->json([
                'message' => 'Invalid or expired link.',
            ], Response::HTTP_FORBIDDEN);
        }

        $request->validate([
            // Accept common medical document formats; limit to 10 MB
            'file'          => ['required', 'file', 'mimes:pdf,jpeg,jpg,png', 'max:10240'],
            'document_type' => ['nullable', 'string', 'max:100'],
        ]);

        // The service stores the file and links it to the camper's record
        $result = $this->linkService->uploadDocument($link, $request->file('file'), $request->document_type);

        if (! $result['success']) {
            return response()->json([
                'message' => $result['message'],
            ], Response::HTTP_BAD_REQUEST);
        }

        return response()->json([
            'message' => 'Document uploaded successfully.',
            'data'    => $result['document'],
        ], Response::HTTP_CREATED);
    }

    /**
     * Find an active MedicalProviderLink by verifying a plain-text token against stored hashes.
     *
     * Why iterate instead of querying by token? Because the token is stored as a bcrypt hash,
     * and bcrypt is not reversible — we cannot do a WHERE clause on the hash. Instead, we
     * fetch all non-expired, unused links and run Hash::check() on each one.
     *
     * Security note: this approach prevents hash enumeration attacks because the response
     * time is roughly constant regardless of whether the token is valid or not.
     */
    protected function findLinkByPlainToken(string $plainToken): ?MedicalProviderLink
    {
        // Pre-filter to active links only to minimise the number of Hash::check() calls
        $potentialLinks = MedicalProviderLink::where('expires_at', '>', now())
            ->where('is_used', false)
            ->whereNull('revoked_at')
            ->get();

        foreach ($potentialLinks as $link) {
            // Hash::check() runs bcrypt on plainToken and compares to the stored hash
            if (MedicalProviderLink::verifyToken($plainToken, $link->token)) {
                return $link;
            }
        }

        // No link matched — return null so the caller can return a 404 or 403
        return null;
    }
}
