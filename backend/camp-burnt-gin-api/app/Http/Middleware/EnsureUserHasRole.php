<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware to ensure the authenticated user has one of the required roles.
 *
 * This middleware enforces role-based access control at the route level.
 * It accepts one or more role names and verifies that the authenticated
 * user possesses at least one of the specified roles.
 *
 * Usage in routes:
 *   ->middleware('role:admin')
 *   ->middleware('role:admin,medical')
 */
class EnsureUserHasRole
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  ...$roles  One or more role names that are permitted
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if ($user === null) {
            return response()->json([
                'message' => 'Authentication required.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if ($user->role === null) {
            return response()->json([
                'message' => 'Access denied. No role assigned.',
            ], Response::HTTP_FORBIDDEN);
        }

        // super_admin inherits all role privileges
        if ($user->isSuperAdmin()) {
            return $next($request);
        }

        foreach ($roles as $role) {
            if ($user->hasRole($role)) {
                return $next($request);
            }
        }

        return response()->json([
            'message' => 'Access denied. Insufficient permissions.',
        ], Response::HTTP_FORBIDDEN);
    }
}
