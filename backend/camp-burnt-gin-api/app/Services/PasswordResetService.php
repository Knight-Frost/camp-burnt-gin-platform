<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\PasswordResetNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Service for password reset operations.
 *
 * Handles token generation, validation, and password updates.
 * Implements FR-3: Account recovery and password reset.
 */
class PasswordResetService
{
    /**
     * Token expiration time in minutes.
     */
    protected const TOKEN_EXPIRATION_MINUTES = 60;

    /**
     * Send a password reset link to the given email.
     *
     * @return array<string, mixed>
     */
    public function sendResetLink(string $email): array
    {
        $user = User::where('email', $email)->first();

        if (!$user) {
            return ['success' => true];
        }

        $token = Str::random(64);

        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $email],
            [
                'token' => Hash::make($token),
                'created_at' => now(),
            ]
        );

        $user->notify(new PasswordResetNotification($token));

        return ['success' => true];
    }

    /**
     * Reset the user's password using the provided token.
     *
     * @return array<string, mixed>
     */
    public function resetPassword(string $email, string $token, string $password): array
    {
        $record = DB::table('password_reset_tokens')
            ->where('email', $email)
            ->first();

        if (!$record) {
            return [
                'success' => false,
                'message' => 'Invalid password reset request.',
            ];
        }

        if (!Hash::check($token, $record->token)) {
            return [
                'success' => false,
                'message' => 'Invalid password reset token.',
            ];
        }

        $createdAt = \Carbon\Carbon::parse($record->created_at);
        if ($createdAt->addMinutes(self::TOKEN_EXPIRATION_MINUTES)->isPast()) {
            return [
                'success' => false,
                'message' => 'Password reset token has expired.',
            ];
        }

        $user = User::where('email', $email)->first();

        if (!$user) {
            return [
                'success' => false,
                'message' => 'User not found.',
            ];
        }

        $user->update([
            'password' => Hash::make($password),
        ]);

        DB::table('password_reset_tokens')
            ->where('email', $email)
            ->delete();

        return ['success' => true];
    }
}
