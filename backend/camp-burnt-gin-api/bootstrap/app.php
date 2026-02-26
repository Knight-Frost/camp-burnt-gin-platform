<?php

use App\Http\Middleware\AddRequestId;
use App\Http\Middleware\AuditPhiAccess;
use App\Http\Middleware\EnsureUserHasRole;
use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\EnsureUserIsMedicalProvider;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            /**
             * Configure rate limiting for API endpoints.
             *
             * Implements tiered rate limiting to prevent brute force attacks and abuse:
             * - Authentication endpoints: Strict limits to prevent credential stuffing
             * - Sensitive operations: Moderate limits for MFA, provider links, uploads
             * - General API: Standard limits for normal operations
             */
            RateLimiter::for('api', function (Request $request) {
                return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
            });

            RateLimiter::for('auth', function (Request $request) {
                return [
                    Limit::perMinute(5)->by($request->ip()),
                    Limit::perHour(20)->by($request->ip()),
                ];
            });

            RateLimiter::for('mfa', function (Request $request) {
                return [
                    Limit::perMinute(3)->by($request->user()?->id ?: $request->ip()),
                    Limit::perHour(10)->by($request->user()?->id ?: $request->ip()),
                ];
            });

            RateLimiter::for('provider-link', function (Request $request) {
                return [
                    Limit::perMinute(2)->by($request->ip()),
                    Limit::perHour(10)->by($request->ip()),
                ];
            });

            RateLimiter::for('uploads', function (Request $request) {
                return [
                    Limit::perMinute(5)->by($request->user()?->id ?: $request->ip()),
                    Limit::perHour(50)->by($request->user()?->id ?: $request->ip()),
                ];
            });

            RateLimiter::for('sensitive', function (Request $request) {
                return [
                    Limit::perMinute(10)->by($request->user()?->id ?: $request->ip()),
                    Limit::perHour(100)->by($request->user()?->id ?: $request->ip()),
                ];
            });
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(\Illuminate\Http\Middleware\HandleCors::class);
        $middleware->append(AddRequestId::class);
        $middleware->append(AuditPhiAccess::class);

        $middleware->alias([
            'role' => EnsureUserHasRole::class,
            'admin' => EnsureUserIsAdmin::class,
            'medical' => EnsureUserIsMedicalProvider::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Authentication required.',
                ], Response::HTTP_UNAUTHORIZED);
            }
        });

        $exceptions->render(function (AccessDeniedHttpException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Access denied.',
                ], Response::HTTP_FORBIDDEN);
            }
        });

        $exceptions->render(function (ModelNotFoundException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Resource not found.',
                ], Response::HTTP_NOT_FOUND);
            }
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Endpoint not found.',
                ], Response::HTTP_NOT_FOUND);
            }
        });
    })->create();
