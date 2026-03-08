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
 * AuthController — Handles all core authentication actions.
 *
 * This is the front door of the API for user identity. It is responsible for:
 *   - Creating new accounts (register)
 *   - Signing users in and issuing API tokens (login)
 *   - Signing users out and revoking their token (logout)
 *   - Returning the currently-signed-in user's profile (user)
 *
 * The heavy lifting (credential checking, rate limiting, MFA checks) lives in
 * AuthService, keeping this controller thin and easy to read.
 */
class AuthController extends Controller
{
    // Laravel injects AuthService automatically via the constructor.
    public function __construct(
        protected AuthService $authService
    ) {}

    /**
     * Register a new user account.
     *
     * POST /api/auth/register
     *
     * Step-by-step:
     *   1. Laravel validates the incoming request using RegisterRequest rules.
     *   2. AuthService creates the User record in the database.
     *   3. A verification email is dispatched so the user can confirm their address.
     *   4. A Sanctum API token is minted and returned so the user is immediately logged in.
     *   5. The new user object (with their role) and the token are returned as JSON.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        // AuthService handles hashing the password and setting the default role.
        $user = $this->authService->register($request->validated());

        // Trigger email verification notification.
        $user->sendEmailVerificationNotification();

        // Create a personal API token — the plain-text value is only available here; store it securely on the client.
        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Account created successfully. Please check your email to verify your address.',
            'data' => [
                // Load the `role` relationship so the frontend knows what the user can access.
                'user' => $user->load('role'),
                'token' => $token,
            ],
        ], Response::HTTP_CREATED);
    }

    /**
     * Authenticate a user and issue an API token.
     *
     * POST /api/auth/login
     *
     * Step-by-step:
     *   1. Validated credentials are passed to AuthService.
     *   2. If login fails (bad password, lockout) a 401 is returned with detail.
     *   3. If the user has MFA enabled, a prompt is returned instead of a token.
     *   4. On full success, the user object and their new token are returned.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        // AuthService checks credentials, tracks failed attempts, and enforces lockouts.
        $result = $this->authService->login($request->validated());

        if (! $result['success']) {
            $response = [
                'success' => false,
                'message' => $result['message'],
            ];

            // Include lockout information if account is locked
            if (isset($result['lockout']) && $result['lockout']) {
                // Tell the client how many seconds to wait before retrying.
                $response['lockout'] = true;
                $response['retry_after'] = $result['retry_after'];
            }

            // Include remaining attempts for failed login
            if (isset($result['attempts_remaining'])) {
                // Warn the user how many tries they have left before a lockout.
                $response['attempts_remaining'] = $result['attempts_remaining'];
            }

            return response()->json($response, Response::HTTP_UNAUTHORIZED);
        }

        // If MFA is required, don't issue a token yet — the client must call the MFA verify endpoint.
        if ($result['mfa_required'] ?? false) {
            return response()->json([
                'success' => true,
                'message' => 'MFA verification required.',
                'mfa_required' => true,
            ], Response::HTTP_OK);
        }

        // Full success — return user profile and the new API token.
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
     *
     * POST /api/auth/logout
     *
     * Deletes only the specific token that was used for this request, not all tokens.
     * This means the user stays logged in on other devices/tabs.
     */
    public function logout(Request $request): JsonResponse
    {
        // currentAccessToken() refers to the Sanctum token attached to this HTTP request.
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    /**
     * Get the authenticated user's profile.
     *
     * GET /api/auth/user
     *
     * Used by the frontend on app load to restore the session and determine role-based routing.
     * The `role` relationship is eager-loaded so the frontend receives the role name in one request.
     */
    public function user(Request $request): JsonResponse
    {
        return response()->json([
            // load('role') fetches the role record from the DB and attaches it to the user object.
            'data' => $request->user()->load('role'),
        ]);
    }
}
