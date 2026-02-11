<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MfaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for Multi-Factor Authentication operations.
 *
 * Handles MFA setup, verification, and disabling.
 * Implements FR-2 and NFR-5: MFA requirements.
 */
class MfaController extends Controller
{
    public function __construct(
        protected MfaService $mfaService
    ) {}

    /**
     * Initialize MFA setup for the current user.
     *
     * Returns a QR code and secret for authenticator app setup.
     */
    public function setup(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->mfa_enabled) {
            return response()->json([
                'message' => 'MFA is already enabled for this account.',
            ], Response::HTTP_BAD_REQUEST);
        }

        $setupData = $this->mfaService->initializeSetup($user);

        return response()->json([
            'message' => 'MFA setup initialized. Scan the QR code with your authenticator app.',
            'data' => $setupData,
        ]);
    }

    /**
     * Verify and enable MFA for the current user.
     */
    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $user = $request->user();
        $result = $this->mfaService->verifyAndEnable($user, $request->code);

        if (! $result['success']) {
            return response()->json([
                'message' => $result['message'],
            ], Response::HTTP_UNAUTHORIZED);
        }

        return response()->json([
            'message' => 'MFA has been enabled successfully.',
            'data' => [
                'recovery_codes' => $result['recovery_codes'] ?? [],
            ],
        ]);
    }

    /**
     * Disable MFA for the current user.
     */
    public function disable(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'size:6'],
            'password' => ['required', 'string'],
        ]);

        $user = $request->user();
        $result = $this->mfaService->disable($user, $request->code, $request->password);

        if (! $result['success']) {
            return response()->json([
                'message' => $result['message'],
            ], Response::HTTP_BAD_REQUEST);
        }

        return response()->json([
            'message' => 'MFA has been disabled.',
        ]);
    }
}
