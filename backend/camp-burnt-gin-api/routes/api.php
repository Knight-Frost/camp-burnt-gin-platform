<?php

use App\Http\Controllers\Api\AllergyController;
use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CamperController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\EmergencyContactController;
use App\Http\Controllers\Api\MedicalRecordController;
use App\Http\Controllers\Api\MedicationController;
use App\Http\Controllers\Api\MfaController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\MedicalProviderLinkController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\UserProfileController;
use App\Http\Controllers\Api\CampController;
use App\Http\Controllers\Api\CampSessionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Camp Burnt Gin API routes. All routes require authentication and are
| protected by role-based middleware and model policies.
|
*/

/*
|--------------------------------------------------------------------------
| Public Authentication Routes
|--------------------------------------------------------------------------
|
| Routes for user registration, login, and password recovery.
| These routes do not require authentication.
|
*/
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])->name('auth.register');
    Route::post('/login', [AuthController::class, 'login'])->name('auth.login');
    Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLink'])->name('password.email');
    Route::post('/reset-password', [PasswordResetController::class, 'reset'])->name('password.reset');
});

/*
|--------------------------------------------------------------------------
| Medical Provider Link Access Routes (Token-based, No Auth Required)
|--------------------------------------------------------------------------
|
| Routes for medical providers to access forms via secure, expiring links.
| Authentication is via the secure token, not user credentials.
|
*/
Route::prefix('provider-access')->group(function () {
    Route::get('/{token}', [MedicalProviderLinkController::class, 'accessForm'])->name('provider-access.form');
    Route::post('/{token}/submit', [MedicalProviderLinkController::class, 'submitForm'])->name('provider-access.submit');
    Route::post('/{token}/upload', [MedicalProviderLinkController::class, 'uploadDocument'])->name('provider-access.upload');
});

Route::middleware('auth:sanctum')->group(function () {

    /*
    |--------------------------------------------------------------------------
    | Authenticated User Routes
    |--------------------------------------------------------------------------
    */
    Route::get('/user', [AuthController::class, 'user'])->name('auth.user');
    Route::post('/logout', [AuthController::class, 'logout'])->name('auth.logout');

    /*
    |--------------------------------------------------------------------------
    | User Profile Routes (Pre-fill Support)
    |--------------------------------------------------------------------------
    |
    | Profile data for returning applicants to pre-fill recurring fields.
    | Implements FR-7: Pre-fill recurring fields for returning applicants.
    |
    */
    Route::prefix('profile')->group(function () {
        Route::get('/', [UserProfileController::class, 'show'])->name('profile.show');
        Route::put('/', [UserProfileController::class, 'update'])->name('profile.update');
        Route::get('/prefill', [UserProfileController::class, 'prefillData'])->name('profile.prefill');
    });

    /*
    |--------------------------------------------------------------------------
    | Public Camp Information Routes
    |--------------------------------------------------------------------------
    */
    Route::prefix('camps')->group(function () {
        Route::get('/', [CampController::class, 'index'])->name('camps.index');
        Route::get('/{camp}', [CampController::class, 'show'])->name('camps.show');
        Route::post('/', [CampController::class, 'store'])->middleware('admin')->name('camps.store');
        Route::put('/{camp}', [CampController::class, 'update'])->middleware('admin')->name('camps.update');
        Route::delete('/{camp}', [CampController::class, 'destroy'])->middleware('admin')->name('camps.destroy');
    });

    Route::prefix('sessions')->group(function () {
        Route::get('/', [CampSessionController::class, 'index'])->name('sessions.index');
        Route::get('/{session}', [CampSessionController::class, 'show'])->name('sessions.show');
        Route::post('/', [CampSessionController::class, 'store'])->middleware('admin')->name('sessions.store');
        Route::put('/{session}', [CampSessionController::class, 'update'])->middleware('admin')->name('sessions.update');
        Route::delete('/{session}', [CampSessionController::class, 'destroy'])->middleware('admin')->name('sessions.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | MFA Setup Routes
    |--------------------------------------------------------------------------
    */
    Route::prefix('mfa')->group(function () {
        Route::post('/setup', [MfaController::class, 'setup'])->name('mfa.setup');
        Route::post('/verify', [MfaController::class, 'verify'])->name('mfa.verify');
        Route::post('/disable', [MfaController::class, 'disable'])->name('mfa.disable');
    });

    /*
    |--------------------------------------------------------------------------
    | Notification Routes
    |--------------------------------------------------------------------------
    */
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index'])->name('notifications.index');
        Route::put('/{notification}/read', [NotificationController::class, 'markAsRead'])->name('notifications.read');
        Route::put('/read-all', [NotificationController::class, 'markAllAsRead'])->name('notifications.read-all');
    });

    /*
    |--------------------------------------------------------------------------
    | Document Upload Routes
    |--------------------------------------------------------------------------
    */
    Route::prefix('documents')->group(function () {
        Route::get('/', [DocumentController::class, 'index'])->name('documents.index');
        Route::post('/', [DocumentController::class, 'store'])->name('documents.store');
        Route::get('/{document}', [DocumentController::class, 'show'])->name('documents.show');
        Route::get('/{document}/download', [DocumentController::class, 'download'])->name('documents.download');
        Route::delete('/{document}', [DocumentController::class, 'destroy'])->name('documents.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Medical Provider Link Management Routes
    |--------------------------------------------------------------------------
    */
    Route::prefix('provider-links')->group(function () {
        Route::get('/', [MedicalProviderLinkController::class, 'index'])->name('provider-links.index');
        Route::post('/', [MedicalProviderLinkController::class, 'store'])->name('provider-links.store');
        Route::get('/{providerLink}', [MedicalProviderLinkController::class, 'show'])->name('provider-links.show');
        Route::post('/{providerLink}/revoke', [MedicalProviderLinkController::class, 'revoke'])->name('provider-links.revoke');
        Route::post('/{providerLink}/resend', [MedicalProviderLinkController::class, 'resend'])
            ->middleware('admin')
            ->name('provider-links.resend');
    });

    /*
    |--------------------------------------------------------------------------
    | Report Routes (Admin Only)
    |--------------------------------------------------------------------------
    */
    Route::middleware('admin')->prefix('reports')->group(function () {
        Route::get('/applications', [ReportController::class, 'applications'])->name('reports.applications');
        Route::get('/accepted', [ReportController::class, 'acceptedApplicants'])->name('reports.accepted');
        Route::get('/rejected', [ReportController::class, 'rejectedApplicants'])->name('reports.rejected');
        Route::get('/mailing-labels', [ReportController::class, 'mailingLabels'])->name('reports.mailing-labels');
        Route::get('/id-labels', [ReportController::class, 'idLabels'])->name('reports.id-labels');
    });

    /*
    |--------------------------------------------------------------------------
    | Camper Routes
    |--------------------------------------------------------------------------
    |
    | Camper management endpoints. Accessible by administrators and parents.
    | Parents can only access their own children via policy enforcement.
    | Medical providers have no access to camper endpoints.
    |
    */
    Route::prefix('campers')->group(function () {
        Route::get('/', [CamperController::class, 'index'])->name('campers.index');
        Route::post('/', [CamperController::class, 'store'])->name('campers.store');
        Route::get('/{camper}', [CamperController::class, 'show'])->name('campers.show');
        Route::put('/{camper}', [CamperController::class, 'update'])->name('campers.update');
        Route::delete('/{camper}', [CamperController::class, 'destroy'])->name('campers.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Application Routes
    |--------------------------------------------------------------------------
    |
    | Camp application endpoints. Accessible by administrators and parents.
    | Parents can only access applications for their own children.
    | Medical providers have no access to application endpoints.
    |
    */
    Route::prefix('applications')->group(function () {
        Route::get('/', [ApplicationController::class, 'index'])->name('applications.index');
        Route::post('/', [ApplicationController::class, 'store'])->name('applications.store');
        Route::get('/{application}', [ApplicationController::class, 'show'])->name('applications.show');
        Route::put('/{application}', [ApplicationController::class, 'update'])->name('applications.update');
        Route::post('/{application}/sign', [ApplicationController::class, 'sign'])->name('applications.sign');
        Route::delete('/{application}', [ApplicationController::class, 'destroy'])
            ->middleware('admin')
            ->name('applications.destroy');
        Route::post('/{application}/review', [ApplicationController::class, 'review'])
            ->middleware('admin')
            ->name('applications.review');
    });

    /*
    |--------------------------------------------------------------------------
    | Medical Record Routes
    |--------------------------------------------------------------------------
    |
    | Medical record endpoints containing HIPAA-protected health information.
    | Accessible by administrators, medical providers, and parents (own children).
    |
    */
    Route::prefix('medical-records')->group(function () {
        Route::get('/', [MedicalRecordController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('medical-records.index');
        Route::post('/', [MedicalRecordController::class, 'store'])->name('medical-records.store');
        Route::get('/{medicalRecord}', [MedicalRecordController::class, 'show'])->name('medical-records.show');
        Route::put('/{medicalRecord}', [MedicalRecordController::class, 'update'])->name('medical-records.update');
        Route::delete('/{medicalRecord}', [MedicalRecordController::class, 'destroy'])
            ->middleware('admin')
            ->name('medical-records.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Emergency Contact Routes
    |--------------------------------------------------------------------------
    |
    | Emergency contact endpoints. Medical providers can view for emergencies.
    | Only administrators and parents can modify contact information.
    |
    */
    Route::prefix('emergency-contacts')->group(function () {
        Route::get('/', [EmergencyContactController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('emergency-contacts.index');
        Route::post('/', [EmergencyContactController::class, 'store'])->name('emergency-contacts.store');
        Route::get('/{emergencyContact}', [EmergencyContactController::class, 'show'])->name('emergency-contacts.show');
        Route::put('/{emergencyContact}', [EmergencyContactController::class, 'update'])->name('emergency-contacts.update');
        Route::delete('/{emergencyContact}', [EmergencyContactController::class, 'destroy'])->name('emergency-contacts.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Allergy Routes
    |--------------------------------------------------------------------------
    |
    | Allergy information endpoints. Critical for camper safety.
    | Accessible by administrators, medical providers, and parents.
    |
    */
    Route::prefix('allergies')->group(function () {
        Route::get('/', [AllergyController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('allergies.index');
        Route::post('/', [AllergyController::class, 'store'])->name('allergies.store');
        Route::get('/{allergy}', [AllergyController::class, 'show'])->name('allergies.show');
        Route::put('/{allergy}', [AllergyController::class, 'update'])->name('allergies.update');
        Route::delete('/{allergy}', [AllergyController::class, 'destroy'])->name('allergies.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Medication Routes
    |--------------------------------------------------------------------------
    |
    | Medication information endpoints. Essential for proper camper care.
    | Accessible by administrators, medical providers, and parents.
    |
    */
    Route::prefix('medications')->group(function () {
        Route::get('/', [MedicationController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('medications.index');
        Route::post('/', [MedicationController::class, 'store'])->name('medications.store');
        Route::get('/{medication}', [MedicationController::class, 'show'])->name('medications.show');
        Route::put('/{medication}', [MedicationController::class, 'update'])->name('medications.update');
        Route::delete('/{medication}', [MedicationController::class, 'destroy'])->name('medications.destroy');
    });
});
