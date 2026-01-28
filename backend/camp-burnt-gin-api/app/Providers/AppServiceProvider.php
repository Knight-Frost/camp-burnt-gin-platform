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
use Illuminate\Support\Facades\Gate;
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
}
