<?php

namespace App\Providers;

use App\Models\Allergy;
use App\Models\Application;
use App\Models\Camper;
use App\Models\Document;
use App\Models\EmergencyContact;
use App\Models\MedicalProviderLink;
use App\Models\MedicalRecord;
use App\Models\Medication;
use App\Policies\AllergyPolicy;
use App\Policies\ApplicationPolicy;
use App\Policies\CamperPolicy;
use App\Policies\DocumentPolicy;
use App\Policies\EmergencyContactPolicy;
use App\Policies\MedicalProviderLinkPolicy;
use App\Policies\MedicalRecordPolicy;
use App\Policies\MedicationPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * Application service provider for registering services and bootstrapping.
 *
 * This provider registers authorization policies and other application-wide
 * services required for the Camp Burnt Gin backend.
 */
class AppServiceProvider extends ServiceProvider
{
    /**
     * The policy mappings for the application.
     *
     * @var array<class-string, class-string>
     */
    protected array $policies = [
        Camper::class => CamperPolicy::class,
        Application::class => ApplicationPolicy::class,
        MedicalRecord::class => MedicalRecordPolicy::class,
        EmergencyContact::class => EmergencyContactPolicy::class,
        Allergy::class => AllergyPolicy::class,
        Medication::class => MedicationPolicy::class,
        Document::class => DocumentPolicy::class,
        MedicalProviderLink::class => MedicalProviderLinkPolicy::class,
    ];

    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->registerPolicies();
        $this->configureRateLimiting();
    }

    /**
     * Register the application's policies.
     */
    protected function registerPolicies(): void
    {
        foreach ($this->policies as $model => $policy) {
            Gate::policy($model, $policy);
        }
    }

    /**
     * Configure rate limiting for the application.
     *
     * Implements strict rate limits for HIPAA-compliant operations
     * to prevent brute-force attacks and resource exhaustion.
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip())
                ->response(function () {
                    return response()->json([
                        'message' => 'Too many authentication attempts. Please try again later.',
                    ], 429);
                });
        });

        RateLimiter::for('provider-link', function (Request $request) {
            return Limit::perMinutes(5, 10)->by($request->ip())
                ->response(function () {
                    return response()->json([
                        'message' => 'Too many provider link attempts. Please try again later.',
                    ], 429);
                });
        });

        RateLimiter::for('mfa', function (Request $request) {
            return Limit::perMinute(5)->by($request->user()?->id ?: $request->ip())
                ->response(function () {
                    return response()->json([
                        'message' => 'Too many MFA attempts. Please try again later.',
                    ], 429);
                });
        });

        RateLimiter::for('uploads', function (Request $request) {
            return Limit::perHour(10)->by($request->user()?->id ?: $request->ip())
                ->response(function () {
                    return response()->json([
                        'message' => 'Upload limit exceeded. Please try again later.',
                    ], 429);
                });
        });

        RateLimiter::for('sensitive', function (Request $request) {
            return Limit::perHour(30)->by($request->user()?->id ?: $request->ip())
                ->response(function () {
                    return response()->json([
                        'message' => 'Rate limit exceeded for sensitive operations.',
                    ], 429);
                });
        });
    }
}
