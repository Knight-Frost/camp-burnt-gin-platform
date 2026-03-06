<?php

namespace App\Services\Auth;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

/**
 * Service for authentication operations.
 *
 * Contains business logic for user registration, login, and credential validation.
 */
class AuthService
{
    /**
     * Register a new user with applicant role.
     *
     * @param  array<string, mixed>  $data
     */
    public function register(array $data): User
    {
        $parentRole = Role::where('name', 'applicant')->first();

        return User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role_id' => $parentRole?->id,
        ]);
    }

    /**
     * Authenticate a user with email and password.
     *
     * Implements account lockout after 5 failed attempts for 5 minutes.
     * Prevents brute force attacks on authentication endpoint.
     *
     * @param  array<string, mixed>  $credentials
     * @return array<string, mixed>
     */
    public function login(array $credentials): array
    {
        $user = User::where('email', $credentials['email'])->first();

        if (! $user) {
            return [
                'success' => false,
                'message' => 'Invalid credentials.',
            ];
        }

        if ($user->isLockedOut()) {
            $minutesRemaining = $user->getLockoutMinutesRemaining();

            return [
                'success' => false,
                'message' => "Account locked due to too many failed attempts. Try again in {$minutesRemaining} minute(s).",
                'lockout' => true,
                'retry_after' => $minutesRemaining * 60,
            ];
        }

        if (! Hash::check($credentials['password'], $user->password)) {
            $user->recordFailedLogin();
            $user = $user->fresh();

            // Check if this attempt triggered a lockout
            if ($user->isLockedOut()) {
                $minutesRemaining = $user->getLockoutMinutesRemaining();

                return [
                    'success' => false,
                    'message' => "Account locked due to too many failed attempts. Try again in {$minutesRemaining} minute(s).",
                    'lockout' => true,
                    'retry_after' => $minutesRemaining * 60,
                ];
            }

            return [
                'success' => false,
                'message' => 'Invalid credentials.',
                'attempts_remaining' => max(0, 5 - $user->failed_login_attempts),
            ];
        }

        if ($user->mfa_enabled && empty($credentials['mfa_code'])) {
            return [
                'success' => true,
                'mfa_required' => true,
            ];
        }

        if ($user->mfa_enabled && ! $this->verifyMfaCode($user, $credentials['mfa_code'])) {
            $user->recordFailedLogin();

            return [
                'success' => false,
                'message' => 'Invalid MFA code.',
                'attempts_remaining' => max(0, 5 - $user->fresh()->failed_login_attempts),
            ];
        }

        $user->resetFailedLogins();

        $token = $user->createToken('auth-token')->plainTextToken;

        return [
            'success' => true,
            'user' => $user->load('role'),
            'token' => $token,
        ];
    }

    /**
     * Verify MFA code for a user.
     */
    protected function verifyMfaCode(User $user, ?string $code): bool
    {
        if (! $code || ! $user->mfa_secret) {
            return false;
        }

        $google2fa = new \PragmaRX\Google2FA\Google2FA;

        return $google2fa->verifyKey($user->mfa_secret, $code);
    }
}
