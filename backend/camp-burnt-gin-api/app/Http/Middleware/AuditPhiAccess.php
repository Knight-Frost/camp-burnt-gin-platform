<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware to audit PHI access for HIPAA compliance.
 *
 * Logs all access to endpoints containing protected health information.
 * Records user, timestamp, resource accessed, and action performed.
 *
 * Implements graceful degradation: if audit logging fails, the request
 * proceeds but the failure is logged to error log for investigation.
 */
class AuditPhiAccess
{
    /**
     * PHI-related route patterns that require audit logging.
     */
    protected array $phiRoutePatterns = [
        'medical-records.*',
        'allergies.*',
        'medications.*',
        'emergency-contacts.*',
        'documents.*',
        'provider-access.*',
        'applications.show',
        'applications.store',
        'applications.review',
        'campers.show',
    ];

    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if ($this->shouldAudit($request, $response)) {
            $this->logPhiAccess($request, $response);
        }

        return $response;
    }

    /**
     * Determine if this request should be audited.
     */
    protected function shouldAudit(Request $request, Response $response): bool
    {
        if (! $request->user()) {
            return $request->routeIs('provider-access.*');
        }

        $route = $request->route();
        if (! $route) {
            return false;
        }

        $routeName = $route->getName();
        if (! $routeName) {
            return false;
        }

        foreach ($this->phiRoutePatterns as $pattern) {
            if (\Illuminate\Support\Str::is($pattern, $routeName)) {
                return $response->isSuccessful();
            }
        }

        return false;
    }

    /**
     * Log the PHI access event.
     *
     * Implements graceful error handling: if audit log fails,
     * log to error log but DO NOT fail the request.
     */
    protected function logPhiAccess(Request $request, Response $response): void
    {
        try {
            $route = $request->route();
            $action = $this->determineAction($request);

            AuditLog::create([
                'request_id' => $request->header('X-Request-ID'),
                'user_id' => $request->user()?->id,
                'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
                'action' => $action,
                'description' => sprintf(
                    '%s %s',
                    $request->method(),
                    $request->path()
                ),
                'metadata' => [
                    'route' => $route?->getName(),
                    'method' => $request->method(),
                    'status' => $response->getStatusCode(),
                    'route_parameters' => $this->sanitizeParameters($route?->parameters() ?? []),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // Log the audit failure but DO NOT block the request
            // This prevents audit system issues from causing service outages
            Log::error('AUDIT LOG FAILED - PHI access not recorded', [
                'exception' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_id' => $request->header('X-Request-ID'),
                'user_id' => $request->user()?->id,
                'route' => $request->route()?->getName(),
                'method' => $request->method(),
                'path' => $request->path(),
                'ip' => $request->ip(),
            ]);

            // Optionally: dispatch alert/notification about audit failure
            // This is critical for HIPAA compliance monitoring
        }
    }

    /**
     * Determine the action being performed.
     */
    protected function determineAction(Request $request): string
    {
        $routeName = $request->route()?->getName();

        // Special case: review routes are updates even though they use POST
        if ($routeName && str_ends_with($routeName, '.review')) {
            return 'update';
        }

        return match ($request->method()) {
            'GET' => 'view',
            'POST' => 'create',
            'PUT', 'PATCH' => 'update',
            'DELETE' => 'delete',
            default => 'access',
        };
    }

    /**
     * Sanitize route parameters to avoid logging sensitive data.
     */
    protected function sanitizeParameters(array $parameters): array
    {
        $sanitized = [];

        foreach ($parameters as $key => $value) {
            if (in_array($key, ['token', 'password', 'secret'])) {
                $sanitized[$key] = '[REDACTED]';
            } elseif (is_object($value) && method_exists($value, 'getKey')) {
                $sanitized[$key] = $value->getKey();
            } else {
                $sanitized[$key] = is_scalar($value) ? $value : gettype($value);
            }
        }

        return $sanitized;
    }
}
