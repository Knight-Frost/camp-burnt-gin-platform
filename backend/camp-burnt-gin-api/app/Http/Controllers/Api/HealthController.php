<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Health check controller for operational monitoring.
 *
 * Provides liveness and readiness endpoints for Kubernetes/container orchestration.
 */
class HealthController extends Controller
{
    /**
     * Liveness probe - indicates if application is running.
     *
     * Returns 200 if the application process is alive.
     * Does NOT check dependencies (database, cache, etc.)
     */
    public function liveness(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'service' => config('app.name'),
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * Readiness probe - indicates if application can serve traffic.
     *
     * Checks critical dependencies before returning success.
     * Returns 200 if ready, 503 if not ready.
     */
    public function readiness(): JsonResponse
    {
        $checks = [
            'database' => $this->checkDatabase(),
            'storage' => $this->checkStorage(),
        ];

        $allHealthy = collect($checks)->every(fn ($check) => $check['healthy']);

        return response()->json([
            'status' => $allHealthy ? 'ready' : 'not_ready',
            'service' => config('app.name'),
            'checks' => $checks,
            'timestamp' => now()->toIso8601String(),
        ], $allHealthy ? Response::HTTP_OK : Response::HTTP_SERVICE_UNAVAILABLE);
    }

    /**
     * Check database connectivity.
     *
     * @return array<string, mixed>
     */
    protected function checkDatabase(): array
    {
        try {
            DB::connection()->getPdo();
            DB::connection()->getDatabaseName();

            return [
                'healthy' => true,
                'message' => 'Database connection successful',
            ];
        } catch (\Exception $e) {
            return [
                'healthy' => false,
                'message' => 'Database connection failed',
                'error' => app()->environment('production') ? 'Connection error' : $e->getMessage(),
            ];
        }
    }

    /**
     * Check storage accessibility.
     *
     * @return array<string, mixed>
     */
    protected function checkStorage(): array
    {
        try {
            $disk = \Illuminate\Support\Facades\Storage::disk('local');
            $testFile = '.health_check_'.time();

            // Write test file
            $disk->put($testFile, 'test');

            // Read test file
            $content = $disk->get($testFile);

            // Delete test file
            $disk->delete($testFile);

            return [
                'healthy' => $content === 'test',
                'message' => 'Storage read/write successful',
            ];
        } catch (\Exception $e) {
            return [
                'healthy' => false,
                'message' => 'Storage check failed',
                'error' => app()->environment('production') ? 'Storage error' : $e->getMessage(),
            ];
        }
    }
}
