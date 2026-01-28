<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware to ensure the authenticated user is a medical provider or administrator.
 *
 * This middleware restricts access to medical-related routes. Administrators
 * are also permitted to access these routes for oversight purposes.
 *
 * Usage in routes:
 *   ->middleware('medical')
 */
class EnsureUserIsMedicalProvider
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

        if (! $user->isMedicalProvider() && ! $user->isAdmin()) {
            return response()->json([
                'message' => 'Access denied. Medical provider privileges required.',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
