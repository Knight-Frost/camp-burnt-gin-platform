<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware to ensure the authenticated user is an administrator.
 *
 * This middleware provides a convenient shorthand for routes that
 * require administrator access. It is equivalent to using
 * EnsureUserHasRole with the 'admin' role.
 *
 * Usage in routes:
 *   ->middleware('admin')
 */
class EnsureUserIsAdmin
{
    /**
     * Handle an incoming request.
     *
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

        if (! $user->isAdmin()) {
            return response()->json([
                'message' => 'Access denied. Administrator privileges required.',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
