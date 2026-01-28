<?php

namespace App\Services;

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
     * Register a new user with parent role.
     *
     * @param array<string, mixed> $data
     */
    public function register(array $data): User
    {
        $parentRole = Role::where('name', 'parent')->first();

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
     * @param array<string, mixed> $credentials
     * @return array<string, mixed>
     */
    public function login(array $credentials): array
    {
        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            return [
                'success' => false,
                'message' => 'Invalid credentials.',
            ];
        }

        if ($user->mfa_enabled && empty($credentials['mfa_code'])) {
            return [
                'success' => true,
                'mfa_required' => true,
            ];
        }

        if ($user->mfa_enabled && !$this->verifyMfaCode($user, $credentials['mfa_code'])) {
            return [
                'success' => false,
                'message' => 'Invalid MFA code.',
            ];
        }

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
        if (!$code || !$user->mfa_secret) {
            return false;
        }

        $google2fa = new \PragmaRX\Google2FA\Google2FA();

        return $google2fa->verifyKey($user->mfa_secret, $code);
    }
}
