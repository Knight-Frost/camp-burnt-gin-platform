<?php

namespace App\Http\Middleware;

use App\Services\Auth\MfaService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * EnsureMfaStepUp — Step-up authentication gate for sensitive and destructive actions.
 *
 * Unlike the broad MFA enrollment checks that were previously fused into role
 * middleware, this middleware is applied only to individual routes that perform
 * high-risk operations: approving/rejecting applications, hard deletes, user
 * deactivation, bulk exports, and similar irreversible actions.
 *
 * Two-stage check:
 *
 *   Stage 1 — Enrollment:
 *     The user must have MFA enrolled (mfa_enabled = true). If they do not,
 *     they cannot complete a step-up challenge, so the request is denied with
 *     mfa_setup_required: true. The frontend responds by directing the user to
 *     their profile to enroll before retrying the action.
 *
 *   Stage 2 — Recent verification:
 *     Even with MFA enrolled, the user must have completed a step-up challenge
 *     within the last N minutes (default 15, configurable via
 *     auth.mfa_step_up_ttl_minutes). If the cache grant is absent or expired,
 *     the request is denied with mfa_step_up_required: true. The frontend opens
 *     a TOTP prompt, posts to /api/mfa/step-up to create the grant, then
 *     retries the original request automatically.
 *
 * This middleware must run AFTER role-check middleware in the pipeline — it
 * assumes the caller already has the right role, and only gates on MFA state.
 *
 * Roles exempt from this requirement:
 *   - applicant — no high-risk routes are accessible to this role
 *   (enforced implicitly; applicants never reach routes that carry mfa.step_up)
 */
class EnsureMfaStepUp
{
    public function __construct(protected MfaService $mfaService) {}

    /**
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null) {
            return response()->json([
                'message' => 'Authentication required.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        // Stage 1: The user must have MFA enrolled to be capable of step-up.
        // Without a secret on file there is nothing to verify against.
        if (! $user->mfa_enabled) {
            return response()->json([
                'message' => 'This action requires multi-factor authentication. '
                    .'Please enable MFA in your security settings, then try again.',
                'mfa_step_up_required' => true,
                'mfa_not_enrolled'     => true,
            ], Response::HTTP_FORBIDDEN);
        }

        // Stage 2: The user must have completed a step-up challenge recently.
        // The MfaService checks for a short-lived cache key set by /api/mfa/step-up.
        if (! $this->mfaService->hasValidStepUp($user)) {
            return response()->json([
                'message' => 'This action requires recent MFA verification. '
                    .'Please re-verify your identity to continue.',
                'mfa_step_up_required' => true,
                'mfa_not_enrolled'     => false,
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
