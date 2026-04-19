<?php

namespace App\Services\Auth;

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use Laravel\Socialite\Two\User as SocialiteOAuthTwoUser;

/**
 * SocialAuthService — OAuth identity resolution and account lifecycle.
 *
 * Responsibilities:
 *  - Resolve an incoming OAuth identity to one of three outcomes:
 *    'login'         → existing linked account; issue a Sanctum token (or MFA pending)
 *    'register'      → new email; create an applicant account and link it
 *    'link_required' → email matches an existing non-linked account; require password confirmation
 *  - Create and update SocialAccount records
 *  - Generate one-time codes for secure token delivery to the SPA
 *  - Handle MFA pending state for social-authenticated users
 *
 * Security guarantees:
 *  - A provider_id can only be linked to one system user (unique constraint)
 *  - Linking to an existing account always requires password confirmation
 *  - Inactive and soft-deleted accounts are rejected
 *  - One-time codes expire in 30 seconds and burn on first use
 *  - MFA pending tokens expire in 5 minutes and burn on use
 */
class SocialAuthService
{
    /**
     * Resolve an incoming OAuth callback to an auth outcome.
     *
     * Returns an array with a required 'action' key:
     *   'login'         → 'token' and 'user' are set (or 'mfa_required' + 'mfa_pending_token')
     *   'register'      → 'token' and 'user' are set (or 'mfa_required' + 'mfa_pending_token')
     *   'link_required' → 'link_token' and 'masked_email' are set; no token issued
     *
     * @return array<string, mixed>
     */
    public function resolveCallback(string $provider, SocialiteUser $socialUser): array
    {
        // 1. Check if this provider_id is already linked to a system account.
        $existingSocial = SocialAccount::where('provider', $provider)
            ->where('provider_id', $socialUser->getId())
            ->first();

        if ($existingSocial) {
            $user = User::withTrashed()->find($existingSocial->user_id);

            if (! $user) {
                return ['action' => 'error', 'message' => 'Account not found. Please contact support.'];
            }

            // Soft-deleted accounts are permanently rejected.
            if ($user->trashed()) {
                return ['action' => 'error', 'message' => 'This account has been deactivated. Please contact an administrator.'];
            }

            // Administratively deactivated accounts cannot log in.
            if (! $user->is_active) {
                return ['action' => 'error', 'message' => 'This account has been deactivated. Please contact an administrator.'];
            }

            // Update stored tokens (they may have rotated since last login).
            $this->updateSocialTokens($existingSocial, $socialUser);

            return $this->buildAuthResult('login', $user, $provider);
        }

        // 2. No existing link — check if the email matches a non-linked account.
        $providerEmail = $socialUser->getEmail();

        if ($providerEmail) {
            $existingUser = User::where('email', $providerEmail)->first();

            if ($existingUser) {
                if ($existingUser->trashed() || ! $existingUser->is_active) {
                    return ['action' => 'error', 'message' => 'This account has been deactivated. Please contact an administrator.'];
                }

                // Email collision: return a link token so the user can prove ownership
                // by entering their password. We never silently link accounts.
                $linkToken = $this->storeLinkPending($provider, $socialUser, $existingUser->id);

                return [
                    'action' => 'link_required',
                    'link_token' => $linkToken,
                    'masked_email' => $this->maskEmail($providerEmail),
                ];
            }
        }

        // 3. Completely new identity — create an applicant account.
        $user = $this->createUserFromSocial($provider, $socialUser);
        AuditLog::logAuth('social_register', $user, ['provider' => $provider]);

        return $this->buildAuthResult('register', $user, $provider);
    }

    /**
     * Confirm an account link after the user supplies their password.
     *
     * @return array<string, mixed>
     */
    public function confirmLink(string $linkToken, string $password): array
    {
        /** @var array<string, mixed>|null $pending */
        $pending = Cache::get("social_link_pending:{$linkToken}");

        if (! $pending) {
            return ['success' => false, 'message' => 'This link session has expired. Please try signing in with Google again.'];
        }

        $user = User::find($pending['user_id']);

        if (! $user || $user->trashed() || ! $user->is_active) {
            Cache::forget("social_link_pending:{$linkToken}");

            return ['success' => false, 'message' => 'Account not found or deactivated.'];
        }

        // Social-only users cannot confirm via password (they have none).
        if (! $user->hasPassword()) {
            Cache::forget("social_link_pending:{$linkToken}");

            return ['success' => false, 'message' => 'This account does not have a password set. Please contact support.'];
        }

        if (! Hash::check($password, $user->password)) {
            return ['success' => false, 'message' => 'Incorrect password. Please try again.'];
        }

        // Password verified — create the social account link.
        SocialAccount::create([
            'user_id' => $user->id,
            'provider' => (string) ($pending['provider'] ?? ''),
            'provider_id' => (string) ($pending['provider_id'] ?? ''),
            'provider_email' => $pending['provider_email'],
            'provider_name' => $pending['provider_name'],
            'avatar_url' => $pending['avatar_url'],
            'access_token' => $pending['access_token'],
            'refresh_token' => $pending['refresh_token'],
            'token_expires_at' => $pending['token_expires_at'],
        ]);

        Cache::forget("social_link_pending:{$linkToken}");

        AuditLog::logAuth('social_link_account', $user, ['provider' => (string) ($pending['provider'] ?? '')]);

        $result = $this->buildAuthResult('login', $user, (string) ($pending['provider'] ?? ''));
        $result['just_linked'] = true;

        return $result;
    }

    /**
     * Complete the social login MFA challenge.
     *
     * @return array<string, mixed>
     */
    public function completeMfaChallenge(string $mfaPendingToken, string $mfaCode): array
    {
        /** @var array<string, mixed>|null $pending */
        $pending = Cache::get("social_mfa_pending:{$mfaPendingToken}");

        if (! $pending) {
            return ['success' => false, 'message' => 'MFA session expired. Please sign in with Google again.'];
        }

        $user = User::find($pending['user_id']);

        if (! $user || ! $user->mfa_enabled || ! $user->mfa_secret) {
            Cache::forget("social_mfa_pending:{$mfaPendingToken}");

            return ['success' => false, 'message' => 'MFA verification failed.'];
        }

        $google2fa = new \PragmaRX\Google2FA\Google2FA;

        if (! $google2fa->verifyKey($user->mfa_secret, $mfaCode)) {
            return ['success' => false, 'message' => 'Invalid verification code. Please try again.'];
        }

        Cache::forget("social_mfa_pending:{$mfaPendingToken}");

        $user->resetFailedLogins();
        $token = $user->createToken('auth-token')->plainTextToken;
        AuditLog::logAuth('social_login', $user, ['provider' => (string) ($pending['provider'] ?? ''), 'mfa_completed' => true]);

        return [
            'success' => true,
            'action' => (string) ($pending['action'] ?? 'login'),
            'user' => $user->load('role'),
            'token' => $token,
        ];
    }

    /**
     * Exchange a one-time code for the auth result payload.
     *
     * The code is consumed immediately — it cannot be replayed.
     *
     * @return array<string, mixed>|null
     */
    public function exchangeOneTimeCode(string $code): ?array
    {
        $key = "social_otc:{$code}";

        /** @var array<string, mixed>|null $payload */
        $payload = Cache::get($key);

        if (! $payload) {
            return null;
        }

        Cache::forget($key);

        return $payload;
    }

    /**
     * Unlink a social provider from a user account.
     *
     * Prevents lockout: requires that the user either has a password set or
     * has another social provider still linked before the unlink is allowed.
     *
     * @return array<string, mixed>
     */
    public function unlink(User $user, string $provider): array
    {
        $social = $user->socialAccounts()->where('provider', $provider)->first();

        if (! $social) {
            return ['success' => false, 'message' => ucfirst($provider).' account is not linked.'];
        }

        $remainingProviders = $user->socialAccounts()->where('provider', '!=', $provider)->count();

        if (! $user->hasPassword() && $remainingProviders === 0) {
            return [
                'success' => false,
                'message' => 'You must set a password before unlinking your '.ucfirst($provider).' account to avoid being locked out.',
                'requires_password' => true,
            ];
        }

        $social->delete();
        AuditLog::logAuth('social_unlink_account', $user, ['provider' => $provider]);

        return ['success' => true, 'message' => ucfirst($provider).' account unlinked successfully.'];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Build the standard auth result array, handling MFA branching.
     *
     * @return array<string, mixed>
     */
    private function buildAuthResult(string $action, User $user, string $provider): array
    {
        $user->resetFailedLogins();

        if ($user->mfa_enabled) {
            $mfaPendingToken = Str::random(40);

            Cache::put("social_mfa_pending:{$mfaPendingToken}", [
                'user_id' => $user->id,
                'provider' => $provider,
                'action' => $action,
            ], now()->addMinutes(5));

            AuditLog::logAuth('social_mfa_required', $user, ['provider' => $provider]);

            return [
                'action' => $action,
                'mfa_required' => true,
                'mfa_pending_token' => $mfaPendingToken,
            ];
        }

        $token = $user->createToken('auth-token')->plainTextToken;
        AuditLog::logAuth('social_login', $user, ['provider' => $provider, 'action' => $action]);

        return [
            'action' => $action,
            'mfa_required' => false,
            'user' => $user->load('role'),
            'token' => $token,
        ];
    }

    /**
     * Create a new applicant user from a social identity.
     */
    private function createUserFromSocial(string $provider, SocialiteUser $socialUser): User
    {
        $applicantRole = Role::where('name', 'applicant')->first();

        $user = User::create([
            'name' => $socialUser->getName() ?? $socialUser->getEmail() ?? 'New User',
            'email' => $socialUser->getEmail(),
            'password' => null,
            'role_id' => $applicantRole?->id,
            'is_active' => true,
            // Google guarantees email ownership — auto-verify immediately
            'email_verified_at' => now(),
        ]);

        $oauthUser = $socialUser instanceof SocialiteOAuthTwoUser ? $socialUser : null;

        SocialAccount::create([
            'user_id' => $user->id,
            'provider' => $provider,
            'provider_id' => $socialUser->getId(),
            'provider_email' => $socialUser->getEmail(),
            'provider_name' => $socialUser->getName(),
            'avatar_url' => $socialUser->getAvatar(),
            'access_token' => $oauthUser?->token,
            'refresh_token' => $oauthUser?->refreshToken,
            'token_expires_at' => ($oauthUser && $oauthUser->expiresIn)
                ? now()->addSeconds((int) $oauthUser->expiresIn)
                : null,
        ]);

        return $user;
    }

    /**
     * Refresh the stored OAuth tokens for a previously linked account.
     */
    private function updateSocialTokens(SocialAccount $social, SocialiteUser $socialUser): void
    {
        $oauthUser = $socialUser instanceof SocialiteOAuthTwoUser ? $socialUser : null;

        $social->update([
            'provider_email' => $socialUser->getEmail(),
            'provider_name' => $socialUser->getName(),
            'avatar_url' => $socialUser->getAvatar(),
            'access_token' => $oauthUser?->token,
            'refresh_token' => $oauthUser !== null ? $oauthUser->refreshToken : $social->refresh_token,
            'token_expires_at' => ($oauthUser && $oauthUser->expiresIn)
                ? now()->addSeconds((int) $oauthUser->expiresIn)
                : $social->token_expires_at,
        ]);
    }

    /**
     * Store a pending link request in cache, keyed by a random token.
     * Expires in 5 minutes — the user must complete linking in one sitting.
     */
    private function storeLinkPending(string $provider, SocialiteUser $socialUser, int $userId): string
    {
        $token = Str::random(40);
        $oauthUser = $socialUser instanceof SocialiteOAuthTwoUser ? $socialUser : null;

        Cache::put("social_link_pending:{$token}", [
            'provider' => $provider,
            'provider_id' => $socialUser->getId(),
            'provider_email' => $socialUser->getEmail(),
            'provider_name' => $socialUser->getName(),
            'avatar_url' => $socialUser->getAvatar(),
            'access_token' => $oauthUser?->token,
            'refresh_token' => $oauthUser?->refreshToken,
            'token_expires_at' => ($oauthUser && $oauthUser->expiresIn)
                ? now()->addSeconds((int) $oauthUser->expiresIn)
                : null,
            'user_id' => $userId,
        ], now()->addMinutes(5));

        return $token;
    }

    /**
     * Generate a one-time code for secure token delivery to the SPA.
     * Payload is stored in cache for 30 seconds.
     *
     * @param  array<string, mixed>  $payload
     */
    public function generateOneTimeCode(array $payload): string
    {
        $code = Str::random(48);
        Cache::put("social_otc:{$code}", $payload, now()->addSeconds(30));

        return $code;
    }

    /**
     * Mask an email address for display in the link_required prompt.
     * "john.doe@example.com" → "jo*****e@example.com"
     */
    private function maskEmail(string $email): string
    {
        [$local, $domain] = explode('@', $email, 2);
        $len = strlen($local);

        if ($len <= 3) {
            return str_repeat('*', $len).'@'.$domain;
        }

        return substr($local, 0, 2).str_repeat('*', $len - 3).substr($local, -1).'@'.$domain;
    }
}
