<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\SocialAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider as SocialiteDriver;
use Symfony\Component\HttpFoundation\Response;

/**
 * SocialAuthController — Google (and future OAuth provider) authentication.
 *
 * Flow overview:
 *
 *   1. Frontend calls GET /api/auth/{provider}/redirect
 *      → This endpoint returns the Google OAuth authorization URL.
 *
 *   2. Frontend redirects the user's browser to that URL.
 *      → Google's consent screen is shown.
 *
 *   3. Google redirects back to GET /api/auth/{provider}/callback
 *      → The backend exchanges the authorization code for user data.
 *      → One of three outcomes:
 *          a) Login / register: generates a one-time code, redirects to
 *             {FRONTEND_URL}/auth/callback?code=<otc>
 *          b) Link required: redirects to
 *             {FRONTEND_URL}/auth/callback?link_required=1&link_token=<tok>&masked_email=<e>
 *          c) MFA required: generates a one-time code carrying the mfa_pending_token, redirects to
 *             {FRONTEND_URL}/auth/callback?code=<otc>
 *          d) Error: redirects to
 *             {FRONTEND_URL}/auth/callback?error=<message>
 *
 *   4. Frontend's OAuthCallbackPage reads query params and either:
 *      - Calls POST /api/auth/social/exchange to swap the OTC for a real token
 *      - Shows a link-account dialog and calls POST /api/auth/social/link-confirm
 *      - Shows the MFA digit entry and calls POST /api/auth/social/mfa-verify
 *
 * Supported providers: google (extensible to github, microsoft, etc.)
 */
class SocialAuthController extends Controller
{
    public function __construct(
        protected SocialAuthService $socialAuthService
    ) {}

    /**
     * Return the Google OAuth authorization URL.
     *
     * GET /api/auth/{provider}/redirect
     *
     * The frontend retrieves this URL and redirects the browser to it.
     * We use stateless() because we are a token-based API (no PHP sessions).
     */
    public function redirect(string $provider): JsonResponse
    {
        if (! $this->isSupportedProvider($provider)) {
            return response()->json(['message' => 'Unsupported provider.'], Response::HTTP_NOT_FOUND);
        }

        /** @var SocialiteDriver $driver */
        $driver = Socialite::driver($provider);
        $url = $driver->stateless()->redirect()->getTargetUrl();

        return response()->json(['url' => $url]);
    }

    /**
     * Handle the OAuth callback from the provider.
     *
     * GET /api/auth/{provider}/callback
     *
     * This endpoint is called by the provider (Google), not the frontend directly.
     * It always ends with a redirect back to the SPA so the user lands in the
     * correct frontend state.
     */
    public function callback(string $provider): RedirectResponse
    {
        if (! $this->isSupportedProvider($provider)) {
            return $this->redirectToFrontend(['error' => 'Unsupported authentication provider.']);
        }

        try {
            /** @var SocialiteDriver $driver */
            $driver = Socialite::driver($provider);
            $socialUser = $driver->stateless()->user();
        } catch (\Throwable $e) {
            Log::warning('Social auth callback failed', [
                'provider' => $provider,
                'error' => $e->getMessage(),
            ]);

            return $this->redirectToFrontend(['error' => 'Authentication failed. Please try again.']);
        }

        if (! $socialUser->getEmail()) {
            return $this->redirectToFrontend(['error' => 'Your Google account does not have a verified email address. Please use email and password to sign in.']);
        }

        try {
            $result = $this->socialAuthService->resolveCallback($provider, $socialUser);
        } catch (\Throwable $e) {
            Log::error('Social auth resolution failed', [
                'provider' => $provider,
                'error' => $e->getMessage(),
            ]);

            return $this->redirectToFrontend(['error' => 'Authentication failed. Please try again.']);
        }

        return match ($result['action']) {
            'error' => $this->redirectToFrontend(['error' => (string) ($result['message'] ?? 'Unknown error.')]),

            'link_required' => $this->redirectToFrontend([
                'link_required' => '1',
                'link_token' => (string) ($result['link_token'] ?? ''),
                'masked_email' => (string) ($result['masked_email'] ?? ''),
            ]),

            default => $this->buildCallbackRedirect($result),
        };
    }

    /**
     * Exchange a one-time code for the actual auth payload.
     *
     * POST /api/auth/social/exchange
     *
     * The OTC is stored in cache for 30 seconds and burns on first use.
     * The response shape mirrors the standard login response so the frontend
     * can reuse the same token-storage logic.
     */
    public function exchange(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string|size:48']);

        $payload = $this->socialAuthService->exchangeOneTimeCode((string) $request->input('code'));

        if (! $payload) {
            return response()->json(
                ['message' => 'Authentication session expired. Please sign in with Google again.'],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        // MFA required: return the mfa_pending_token so the frontend can show the TOTP dialog.
        if ($payload['mfa_required'] ?? false) {
            return response()->json([
                'success' => true,
                'mfa_required' => true,
                'mfa_pending_token' => (string) ($payload['mfa_pending_token'] ?? ''),
            ]);
        }

        $userId = $payload['user_id'] ?? null;
        $user = $userId ? User::find((int) $userId) : null;

        if (! $user instanceof User) {
            return response()->json(
                ['message' => 'Authentication session expired. Please sign in with Google again.'],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        return response()->json([
            'success' => true,
            'message' => $this->successMessage((string) ($payload['action'] ?? 'login')),
            'data' => [
                'user' => $this->buildUserArray($user),
                'token' => (string) ($payload['token'] ?? ''),
                'action' => (string) ($payload['action'] ?? 'login'),
            ],
        ]);
    }

    /**
     * Confirm an account link after the user supplies their password.
     *
     * POST /api/auth/social/link-confirm
     */
    public function linkConfirm(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'link_token' => 'required|string',
            'password' => 'required|string',
        ]);

        $result = $this->socialAuthService->confirmLink(
            (string) $validated['link_token'],
            (string) $validated['password']
        );

        if (! $result['success']) {
            $message = (string) ($result['message'] ?? 'Authentication failed.');
            $status = str_contains($message, 'expired')
                ? Response::HTTP_UNPROCESSABLE_ENTITY
                : Response::HTTP_UNAUTHORIZED;

            return response()->json(['message' => $message], $status);
        }

        // MFA required after linking
        if ($result['mfa_required'] ?? false) {
            return response()->json([
                'success' => true,
                'mfa_required' => true,
                'mfa_pending_token' => (string) ($result['mfa_pending_token'] ?? ''),
            ]);
        }

        $user = $result['user'] ?? null;
        assert($user instanceof User);

        return response()->json([
            'success' => true,
            'message' => 'Google account linked successfully.',
            'data' => [
                'user' => $this->buildUserArray($user),
                'token' => (string) ($result['token'] ?? ''),
                'action' => 'login',
                'just_linked' => (bool) ($result['just_linked'] ?? false),
            ],
        ]);
    }

    /**
     * Complete the MFA challenge that follows a social login.
     *
     * POST /api/auth/social/mfa-verify
     */
    public function mfaVerify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mfa_pending_token' => 'required|string',
            'mfa_code' => 'required|string|size:6',
        ]);

        $result = $this->socialAuthService->completeMfaChallenge(
            (string) $validated['mfa_pending_token'],
            (string) $validated['mfa_code']
        );

        if (! $result['success']) {
            return response()->json(['message' => (string) ($result['message'] ?? 'MFA verification failed.')], Response::HTTP_UNAUTHORIZED);
        }

        $user = $result['user'] ?? null;
        assert($user instanceof User);

        return response()->json([
            'success' => true,
            'message' => $this->successMessage((string) ($result['action'] ?? 'login')),
            'data' => [
                'user' => $this->buildUserArray($user),
                'token' => (string) ($result['token'] ?? ''),
                'action' => (string) ($result['action'] ?? 'login'),
            ],
        ]);
    }

    /**
     * Unlink a social provider from the authenticated user's account.
     *
     * DELETE /api/auth/social/{provider}
     *
     * Requires auth:sanctum + verified. Prevents lockout by checking the
     * user has an alternative login method before allowing the unlink.
     */
    public function unlink(Request $request, string $provider): JsonResponse
    {
        if (! $this->isSupportedProvider($provider)) {
            return response()->json(['message' => 'Unsupported provider.'], Response::HTTP_NOT_FOUND);
        }

        $authUser = $request->user();
        assert($authUser instanceof User);

        $result = $this->socialAuthService->unlink($authUser, $provider);

        if (! $result['success']) {
            $response = ['message' => (string) ($result['message'] ?? 'Unlink failed.')];
            if ($result['requires_password'] ?? false) {
                $response['requires_password'] = 'true';
            }

            return response()->json($response, Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return response()->json(['message' => (string) ($result['message'] ?? 'Unlinked.')]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    private function isSupportedProvider(string $provider): bool
    {
        return in_array($provider, ['google'], true);
    }

    /** @param array<string, mixed> $result */
    private function buildCallbackRedirect(array $result): RedirectResponse
    {
        if ($result['mfa_required'] ?? false) {
            $code = $this->socialAuthService->generateOneTimeCode([
                'mfa_required' => true,
                'mfa_pending_token' => (string) ($result['mfa_pending_token'] ?? ''),
                'action' => (string) ($result['action'] ?? 'login'),
            ]);

            return $this->redirectToFrontend(['code' => $code]);
        }

        $resultUser = $result['user'] ?? null;
        $code = $this->socialAuthService->generateOneTimeCode([
            'action' => (string) ($result['action'] ?? 'login'),
            'mfa_required' => false,
            'user_id' => $resultUser instanceof User ? $resultUser->id : null,
            'token' => (string) ($result['token'] ?? ''),
        ]);

        return $this->redirectToFrontend(['code' => $code]);
    }

    /** @param array<string, string> $params */
    private function redirectToFrontend(array $params): RedirectResponse
    {
        $frontendUrl = rtrim((string) config('app.frontend_url', 'http://localhost:3000'), '/');
        $query = http_build_query($params);

        return redirect("{$frontendUrl}/auth/callback?{$query}");
    }

    private function buildUserArray(User $user): array
    {
        // Eager-load the role relation if the caller didn't already.
        // Without this, $user->toArray() emits no role/roles fields, and the
        // SPA's post-login redirect (which keys off user.roles[0].name) never
        // navigates — leaving the OAuth callback page stuck on "Signing In…".
        // Mirrors AuthController's $user->load('role') pattern.
        $user->loadMissing('role');

        $data = $user->toArray();
        $data['avatar_url'] = $user->avatar_path
            ? Storage::disk('public')->url($user->avatar_path)
            : null;
        $data['has_password'] = $user->hasPassword();
        $data['social_providers'] = $user->socialAccounts()
            ->get(['provider', 'provider_email', 'avatar_url'])
            ->toArray();

        return $data;
    }

    private function successMessage(string $action): string
    {
        return match ($action) {
            'register' => 'Account created successfully with Google.',
            default => 'Signed in with Google successfully.',
        };
    }
}
