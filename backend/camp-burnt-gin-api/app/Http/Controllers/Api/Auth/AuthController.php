<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\User;
use App\Services\Auth\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for authentication operations.
 *
 * Handles user registration, login, logout, and token management.
 */
class AuthController extends Controller
{
    public function __construct(
        protected AuthService $authService
    ) {}

    /**
     * Register a new user account.
     *
     * Creates an applicant account and sends an email verification link.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = $this->authService->register($request->validated());

        // Trigger email verification notification.
        $user->sendEmailVerificationNotification();

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Account created successfully. Please check your email to verify your address.',
            'data' => [
                'user' => $user->load('role'),
                'token' => $token,
            ],
        ], Response::HTTP_CREATED);
    }

    /**
     * Authenticate a user and issue an API token.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->authService->login($request->validated());

        if (! $result['success']) {
            $response = [
                'success' => false,
                'message' => $result['message'],
            ];

            // Include lockout information if account is locked
            if (isset($result['lockout']) && $result['lockout']) {
                $response['lockout'] = true;
                $response['retry_after'] = $result['retry_after'];
            }

            // Include remaining attempts for failed login
            if (isset($result['attempts_remaining'])) {
                $response['attempts_remaining'] = $result['attempts_remaining'];
            }

            return response()->json($response, Response::HTTP_UNAUTHORIZED);
        }

        if ($result['mfa_required'] ?? false) {
            return response()->json([
                'success' => true,
                'message' => 'MFA verification required.',
                'mfa_required' => true,
            ], Response::HTTP_OK);
        }

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'data' => [
                'user' => $result['user'],
                'token' => $result['token'],
            ],
        ]);
    }

    /**
     * Log out the current user and revoke their token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    /**
     * Get the authenticated user's profile.
     */
    public function user(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->load('role'),
        ]);
    }
}
