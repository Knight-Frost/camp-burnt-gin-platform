<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Adds HTTP security headers to every API response.
 *
 * HSTS is only emitted in production so local HTTPS workarounds are not broken.
 * Note: Content-Security-Policy must also be enforced at the reverse-proxy level
 *       (nginx/Apache) for complete coverage.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        // Prevent MIME-type sniffing
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // Deny framing entirely (clickjacking protection)
        $response->headers->set('X-Frame-Options', 'DENY');

        // Legacy XSS filter (belt-and-suspenders; CSP supersedes this)
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        // Leak only origin when navigating to HTTPS, nothing for HTTP
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Disable browser features not required by this app
        $response->headers->set(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
        );

        // HSTS: tell browsers to always use HTTPS.
        // Only sent in production — avoids breaking local dev over HTTP.
        if (config('app.env') === 'production') {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=63072000; includeSubDomains; preload'
            );
        }

        return $response;
    }
}
