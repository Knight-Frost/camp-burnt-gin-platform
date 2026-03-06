<?php

namespace App\Providers;

use App\Models\ActivityPermission;
use App\Models\Allergy;
use App\Models\Application;
use App\Models\AssistiveDevice;
use App\Models\BehavioralProfile;
use App\Models\Camp;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Conversation;
use App\Models\Diagnosis;
use App\Models\Document;
use App\Models\EmergencyContact;
use App\Models\FeedingPlan;
use App\Models\MedicalProviderLink;
use App\Models\MedicalRecord;
use App\Models\Medication;
use App\Models\Message;
use App\Models\Role;
use App\Models\UserEmergencyContact;
use App\Observers\AssistiveDeviceObserver;
use App\Observers\BehavioralProfileObserver;
use App\Observers\DiagnosisObserver;
use App\Observers\FeedingPlanObserver;
use App\Observers\MedicalRecordObserver;
use App\Policies\ActivityPermissionPolicy;
use App\Policies\AllergyPolicy;
use App\Policies\ApplicationPolicy;
use App\Policies\AssistiveDevicePolicy;
use App\Policies\BehavioralProfilePolicy;
use App\Policies\CamperPolicy;
use App\Policies\CampPolicy;
use App\Policies\CampSessionPolicy;
use App\Policies\ConversationPolicy;
use App\Policies\DiagnosisPolicy;
use App\Policies\DocumentPolicy;
use App\Policies\EmergencyContactPolicy;
use App\Policies\FeedingPlanPolicy;
use App\Policies\MedicalProviderLinkPolicy;
use App\Policies\MedicalRecordPolicy;
use App\Policies\MedicationPolicy;
use App\Policies\MessagePolicy;
use App\Policies\RolePolicy;
use App\Policies\UserEmergencyContactPolicy;
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
        ActivityPermission::class => ActivityPermissionPolicy::class,
        AssistiveDevice::class => AssistiveDevicePolicy::class,
        BehavioralProfile::class => BehavioralProfilePolicy::class,
        Diagnosis::class => DiagnosisPolicy::class,
        FeedingPlan::class => FeedingPlanPolicy::class,
        Camp::class => CampPolicy::class,
        CampSession::class => CampSessionPolicy::class,
        // Inbox Messaging System policies (explicit registration)
        Conversation::class => ConversationPolicy::class,
        Message::class => MessagePolicy::class,
        // Role delegation governance policy
        Role::class => RolePolicy::class,
        // User profile emergency contacts
        UserEmergencyContact::class => UserEmergencyContactPolicy::class,
    ];

    /**
     * Register any application services.
     */
    public function register(): void {}

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->registerPolicies();
        $this->registerObservers();
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
     * Register model observers for automatic risk reassessment.
     *
     * Observers trigger risk assessment recalculation when medical data
     * changes, ensuring supervision levels remain accurate as camper
     * conditions are updated.
     */
    protected function registerObservers(): void
    {
        MedicalRecord::observe(MedicalRecordObserver::class);
        Diagnosis::observe(DiagnosisObserver::class);
        BehavioralProfile::observe(BehavioralProfileObserver::class);
        FeedingPlan::observe(FeedingPlanObserver::class);
        AssistiveDevice::observe(AssistiveDeviceObserver::class);
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
