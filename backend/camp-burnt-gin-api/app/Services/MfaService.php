<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;

/**
 * Service for Multi-Factor Authentication operations.
 *
 * Handles TOTP-based MFA setup, verification, and management.
 * Implements FR-2 and NFR-5: MFA requirements.
 */
class MfaService
{
    protected Google2FA $google2fa;

    public function __construct()
    {
        $this->google2fa = new Google2FA();
    }

    /**
     * Initialize MFA setup for a user.
     *
     * @return array<string, mixed>
     */
    public function initializeSetup(User $user): array
    {
        $secret = $this->google2fa->generateSecretKey();

        $user->update(['mfa_secret' => $secret]);

        $qrCodeUrl = $this->google2fa->getQRCodeUrl(
            config('app.name', 'Camp Burnt Gin'),
            $user->email,
            $secret
        );

        return [
            'secret' => $secret,
            'qr_code_url' => $qrCodeUrl,
        ];
    }

    /**
     * Verify a TOTP code and enable MFA.
     *
     * @return array<string, mixed>
     */
    public function verifyAndEnable(User $user, string $code): array
    {
        if (!$user->mfa_secret) {
            return [
                'success' => false,
                'message' => 'MFA setup has not been initialized.',
            ];
        }

        try {
            if (!$this->google2fa->verifyKey($user->mfa_secret, $code)) {
                return [
                    'success' => false,
                    'message' => 'Invalid verification code.',
                ];
            }
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Invalid verification code.',
            ];
        }

        $user->update([
            'mfa_enabled' => true,
            'mfa_verified_at' => now(),
        ]);

        return [
            'success' => true,
        ];
    }

    /**
     * Verify a TOTP code for login.
     */
    public function verifyCode(User $user, string $code): bool
    {
        if (!$user->mfa_secret) {
            return false;
        }

        try {
            return $this->google2fa->verifyKey($user->mfa_secret, $code);
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Disable MFA for a user.
     *
     * @return array<string, mixed>
     */
    public function disable(User $user, string $code, string $password): array
    {
        if (!$user->mfa_secret) {
            return [
                'success' => false,
                'message' => 'MFA is not enabled for this account.',
            ];
        }

        if (!Hash::check($password, $user->password)) {
            return [
                'success' => false,
                'message' => 'Invalid password.',
            ];
        }

        try {
            if (!$this->google2fa->verifyKey($user->mfa_secret, $code)) {
                return [
                    'success' => false,
                    'message' => 'Invalid verification code.',
                ];
            }
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Invalid verification code.',
            ];
        }

        $user->update([
            'mfa_enabled' => false,
            'mfa_secret' => null,
            'mfa_verified_at' => null,
        ]);

        return ['success' => true];
    }
}
