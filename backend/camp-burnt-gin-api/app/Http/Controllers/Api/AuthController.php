<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\Role;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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
     * Creates a parent account by default and returns an API token.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = $this->authService->register($request->validated());

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Account created successfully.',
            'data' => [
                'user' => $user,
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

        if (!$result['success']) {
            return response()->json([
                'message' => $result['message'],
            ], Response::HTTP_UNAUTHORIZED);
        }

        if ($result['mfa_required'] ?? false) {
            return response()->json([
                'message' => 'MFA verification required.',
                'mfa_required' => true,
            ], Response::HTTP_OK);
        }

        return response()->json([
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
