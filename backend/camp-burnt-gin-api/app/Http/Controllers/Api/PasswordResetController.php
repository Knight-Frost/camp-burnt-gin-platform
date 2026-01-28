<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PasswordResetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for password reset operations.
 *
 * Handles sending reset links and processing password resets.
 * Implements FR-3: Account recovery and password reset.
 */
class PasswordResetController extends Controller
{
    public function __construct(
        protected PasswordResetService $passwordResetService
    ) {}

    /**
     * Send a password reset link to the given email.
     */
    public function sendResetLink(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        $result = $this->passwordResetService->sendResetLink($request->email);

        return response()->json([
            'message' => 'If an account exists with this email, a password reset link has been sent.',
        ]);
    }

    /**
     * Reset the user's password.
     */
    public function reset(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', 'min:8'],
        ]);

        $result = $this->passwordResetService->resetPassword(
            $request->email,
            $request->token,
            $request->password
        );

        if (!$result['success']) {
            return response()->json([
                'message' => $result['message'],
            ], Response::HTTP_BAD_REQUEST);
        }

        return response()->json([
            'message' => 'Password has been reset successfully.',
        ]);
    }
}
