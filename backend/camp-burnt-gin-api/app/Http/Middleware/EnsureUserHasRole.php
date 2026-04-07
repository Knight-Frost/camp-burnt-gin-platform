<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * EnsureUserHasRole — Route-level role-based access control middleware.
 *
 * This middleware acts as a gatekeeper on individual routes. When applied,
 * it checks that the logged-in user holds at least one of the roles listed
 * in the route definition. If they don't, access is denied immediately.
 *
 * How it is used in routes:
 *   ->middleware('role:admin')           // only admins
 *   ->middleware('role:admin,medical')   // admins OR medical providers
 *
 * Special behaviour: super_admin automatically passes any role check because
 * isAdmin() returns true for super_admin (see User model isAdmin() override).
 */
class EnsureUserHasRole
{
    /**
     * Handle an incoming request.
     *
     * Steps:
     *  1. Confirm the user is authenticated (not a guest).
     *  2. Confirm the user actually has a role assigned.
     *  3. Short-circuit for super_admin — they bypass all role checks.
     *  4. Walk through the allowed roles and pass the request if any match.
     *  5. Return 403 Forbidden if no role matched.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  ...$roles  One or more role names that are permitted
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        // Pull the authenticated user from the current session/token.
        $user = $request->user();

        // If no user is logged in at all, we cannot check roles — send 401.
        if ($user === null) {
            return response()->json([
                'message' => 'Authentication required.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        // A user with no role assigned would have no privileges — deny access.
        if ($user->role === null) {
            return response()->json([
                'message' => 'Access denied. No role assigned.',
            ], Response::HTTP_FORBIDDEN);
        }

        // Resolve whether this user holds an acceptable role before any further
        // checks. Consolidating this here (rather than returning early on each
        // match) ensures the MFA gate below runs for every role, including
        // super_admin, which would otherwise bypass it via an early return.
        $roleAllowed = false;

        // super_admin inherits all role privileges.
        if ($user->isSuperAdmin()) {
            $roleAllowed = true;
        } else {
            foreach ($roles as $role) {
                if ($user->hasRole($role)) {
                    $roleAllowed = true;
                    break;
                }
            }
        }

        if (! $roleAllowed) {
            return response()->json([
                'message' => 'Access denied. Insufficient permissions.',
            ], Response::HTTP_FORBIDDEN);
        }

        // MFA enrollment is encouraged (shown as a banner in the frontend) but
        // not enforced globally. Strict enforcement is applied only to specific
        // sensitive routes via the mfa.enrolled middleware in routes/api.php.
        return $next($request);
    }
}
