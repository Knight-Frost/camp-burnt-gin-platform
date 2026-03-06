<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Notifications\Auth\EmailVerificationNotification;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * EmailVerificationController — Email address verification endpoints.
 *
 * Handles email verification link validation and resend requests
 * for the SPA frontend. Uses Laravel signed URLs for secure token-less
 * verification without requiring a separate tokens table.
 */
class EmailVerificationController extends Controller
{
    /**
     * Verify the user's email address.
     *
     * POST /auth/email/verify
     *
     * Expects signed URL parameters passed from the frontend as JSON body:
     *   - id:        user ID from the verification link
     *   - hash:      sha1 hash of the email address
     *   - expires:   timestamp from the signed URL
     *   - signature: HMAC signature from the signed URL
     */
    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'id'        => ['required', 'integer'],
            'hash'      => ['required', 'string'],
            'expires'   => ['required', 'integer'],
            'signature' => ['required', 'string'],
        ]);

        // Validate the signed URL parameters against the backend verification route.
        $signedRoute = route('verification.verify', [
            'id'   => $request->integer('id'),
            'hash' => $request->string('hash'),
        ]);
        $urlToVerify = $signedRoute.'?expires='.$request->integer('expires').'&signature='.$request->string('signature');

        if (! \Illuminate\Support\Facades\URL::hasValidSignature(
            \Illuminate\Http\Request::create($urlToVerify)
        )) {
            return response()->json(['message' => 'Invalid or expired verification link.'], 422);
        }

        $user = \App\Models\User::findOrFail($request->integer('id'));

        // Verify the hash matches the user's email.
        if (! hash_equals(sha1($user->getEmailForVerification()), (string) $request->string('hash'))) {
            return response()->json(['message' => 'Invalid verification link.'], 422);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email already verified.']);
        }

        $user->markEmailAsVerified();
        event(new Verified($user));

        return response()->json(['message' => 'Email verified successfully.']);
    }

    /**
     * Resend the email verification notification.
     *
     * POST /auth/email/resend
     *
     * Requires authentication. Throttled to prevent abuse.
     */
    public function resend(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email already verified.']);
        }

        $user->notify(new EmailVerificationNotification);

        return response()->json(['message' => 'Verification email sent.']);
    }
}
