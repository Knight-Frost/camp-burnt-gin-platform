<?php

use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\Auth\MfaController;
use App\Http\Controllers\Api\Auth\PasswordResetController;
use App\Http\Controllers\Api\Camp\CampController;
use App\Http\Controllers\Api\Camp\CampSessionController;
use App\Http\Controllers\Api\Camper\ApplicationController;
use App\Http\Controllers\Api\Camper\CamperController;
use App\Http\Controllers\Api\Camper\UserProfileController;
use App\Http\Controllers\Api\Document\DocumentController;
use App\Http\Controllers\Api\Document\MedicalProviderLinkController;
use App\Http\Controllers\Api\Medical\ActivityPermissionController;
use App\Http\Controllers\Api\Medical\AllergyController;
use App\Http\Controllers\Api\Medical\AssistiveDeviceController;
use App\Http\Controllers\Api\Medical\BehavioralProfileController;
use App\Http\Controllers\Api\Medical\DiagnosisController;
use App\Http\Controllers\Api\Medical\EmergencyContactController;
use App\Http\Controllers\Api\Medical\FeedingPlanController;
use App\Http\Controllers\Api\Medical\MedicalRecordController;
use App\Http\Controllers\Api\Medical\MedicationController;
use App\Http\Controllers\Api\Inbox\ConversationController;
use App\Http\Controllers\Api\Inbox\InboxUserController;
use App\Http\Controllers\Api\Inbox\MessageController;
use App\Http\Controllers\Api\System\HealthController;
use App\Http\Controllers\Api\System\NotificationController;
use App\Http\Controllers\Api\System\AuditLogController;
use App\Http\Controllers\Api\System\ReportController;
use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\CalendarEventController;
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
| Health Check Routes (No Authentication Required)
|--------------------------------------------------------------------------
|
| Operational health endpoints for monitoring and orchestration.
| These routes do not require authentication for liveness/readiness probes.
|
*/
Route::get('/health', [HealthController::class, 'liveness'])->name('health.liveness');
Route::get('/ready', [HealthController::class, 'readiness'])->name('health.readiness');

/*
|--------------------------------------------------------------------------
| Public Authentication Routes
|--------------------------------------------------------------------------
|
| Routes for user registration, login, and password recovery.
| These routes do not require authentication but have strict rate limiting
| to prevent brute force attacks and account enumeration.
|
*/
Route::prefix('auth')->middleware('throttle:auth')->group(function () {
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
| Strict rate limiting prevents token brute-force attempts.
|
*/
Route::prefix('provider-access')->middleware('throttle:provider-link')->group(function () {
    Route::get('/{token}', [MedicalProviderLinkController::class, 'accessForm'])->name('provider-access.form');
    Route::post('/{token}/submit', [MedicalProviderLinkController::class, 'submitForm'])->name('provider-access.submit');
    Route::post('/{token}/upload', [MedicalProviderLinkController::class, 'uploadDocument'])->name('provider-access.upload');
});

Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
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
        Route::get('/notification-preferences', [UserProfileController::class, 'getNotificationPreferences'])->name('profile.notification-preferences.show');
        Route::put('/notification-preferences', [UserProfileController::class, 'updateNotificationPreferences'])->name('profile.notification-preferences.update');
        Route::put('/password', [UserProfileController::class, 'changePassword'])->name('profile.password.update');
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
    Route::prefix('mfa')->middleware('throttle:mfa')->group(function () {
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
        Route::post('/', [DocumentController::class, 'store'])->middleware('throttle:uploads')->name('documents.store');
        Route::get('/{document}', [DocumentController::class, 'show'])->name('documents.show');
        Route::get('/{document}/download', [DocumentController::class, 'download'])->middleware('throttle:sensitive')->name('documents.download');
        Route::delete('/{document}', [DocumentController::class, 'destroy'])->name('documents.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Medical Provider Link Management Routes
    |--------------------------------------------------------------------------
    */
    Route::prefix('provider-links')->middleware('throttle:sensitive')->group(function () {
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
        Route::get('/{camper}/risk-summary', [CamperController::class, 'riskSummary'])->name('campers.risk-summary');
        Route::get('/{camper}/compliance-status', [CamperController::class, 'complianceStatus'])->name('campers.compliance-status');
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

    /*
    |--------------------------------------------------------------------------
    | CYSHCN (Special Health Care Needs) Routes
    |--------------------------------------------------------------------------
    |
    | Endpoints for managing special health care needs information including
    | diagnoses, behavioral profiles, feeding plans, assistive devices, and
    | activity permissions. All routes contain PHI and require strict access
    | controls for HIPAA compliance.
    |
    */

    /*
    | Diagnosis Routes
    */
    Route::prefix('diagnoses')->group(function () {
        Route::get('/', [DiagnosisController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('diagnoses.index');
        Route::post('/', [DiagnosisController::class, 'store'])->name('diagnoses.store');
        Route::get('/{diagnosis}', [DiagnosisController::class, 'show'])->name('diagnoses.show');
        Route::put('/{diagnosis}', [DiagnosisController::class, 'update'])->name('diagnoses.update');
        Route::delete('/{diagnosis}', [DiagnosisController::class, 'destroy'])->name('diagnoses.destroy');
    });

    /*
    | Behavioral Profile Routes
    */
    Route::prefix('behavioral-profiles')->group(function () {
        Route::get('/', [BehavioralProfileController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('behavioral-profiles.index');
        Route::post('/', [BehavioralProfileController::class, 'store'])->name('behavioral-profiles.store');
        Route::get('/{behavioralProfile}', [BehavioralProfileController::class, 'show'])->name('behavioral-profiles.show');
        Route::put('/{behavioralProfile}', [BehavioralProfileController::class, 'update'])->name('behavioral-profiles.update');
        Route::delete('/{behavioralProfile}', [BehavioralProfileController::class, 'destroy'])->name('behavioral-profiles.destroy');
    });

    /*
    | Feeding Plan Routes
    */
    Route::prefix('feeding-plans')->group(function () {
        Route::get('/', [FeedingPlanController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('feeding-plans.index');
        Route::post('/', [FeedingPlanController::class, 'store'])->name('feeding-plans.store');
        Route::get('/{feedingPlan}', [FeedingPlanController::class, 'show'])->name('feeding-plans.show');
        Route::put('/{feedingPlan}', [FeedingPlanController::class, 'update'])->name('feeding-plans.update');
        Route::delete('/{feedingPlan}', [FeedingPlanController::class, 'destroy'])->name('feeding-plans.destroy');
    });

    /*
    | Assistive Device Routes
    */
    Route::prefix('assistive-devices')->group(function () {
        Route::get('/', [AssistiveDeviceController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('assistive-devices.index');
        Route::post('/', [AssistiveDeviceController::class, 'store'])->name('assistive-devices.store');
        Route::get('/{assistiveDevice}', [AssistiveDeviceController::class, 'show'])->name('assistive-devices.show');
        Route::put('/{assistiveDevice}', [AssistiveDeviceController::class, 'update'])->name('assistive-devices.update');
        Route::delete('/{assistiveDevice}', [AssistiveDeviceController::class, 'destroy'])->name('assistive-devices.destroy');
    });

    /*
    | Activity Permission Routes
    */
    Route::prefix('activity-permissions')->group(function () {
        Route::get('/', [ActivityPermissionController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('activity-permissions.index');
        Route::post('/', [ActivityPermissionController::class, 'store'])->name('activity-permissions.store');
        Route::get('/{activityPermission}', [ActivityPermissionController::class, 'show'])->name('activity-permissions.show');
        Route::put('/{activityPermission}', [ActivityPermissionController::class, 'update'])->name('activity-permissions.update');
        Route::delete('/{activityPermission}', [ActivityPermissionController::class, 'destroy'])->name('activity-permissions.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Inbox Messaging Routes
    |--------------------------------------------------------------------------
    |
    | Internal messaging system for secure communication between parents,
    | administrators, and medical providers. All messages are HIPAA-compliant
    | with full audit trails. Rate limiting prevents abuse.
    |
    */

    // ─── Announcements ─────────────────────────────────────────────────────────
    Route::prefix('announcements')->group(function () {
        Route::get('/', [AnnouncementController::class, 'index'])->name('announcements.index');
        Route::get('/{announcement}', [AnnouncementController::class, 'show'])->name('announcements.show');
        Route::post('/', [AnnouncementController::class, 'store'])->middleware('admin')->name('announcements.store');
        Route::put('/{announcement}', [AnnouncementController::class, 'update'])->name('announcements.update');
        Route::delete('/{announcement}', [AnnouncementController::class, 'destroy'])->name('announcements.destroy');
        Route::post('/{announcement}/pin', [AnnouncementController::class, 'togglePin'])->middleware('admin')->name('announcements.pin');
    });

    // ─── Audit Log (Super Admin only) ─────────────────────────────────────────
    Route::get('/audit-log', [AuditLogController::class, 'index'])
        ->middleware('role:super_admin')
        ->name('audit-log.index');

    // ─── Calendar Events ───────────────────────────────────────────────────────
    Route::prefix('calendar')->group(function () {
        Route::get('/', [CalendarEventController::class, 'index'])->name('calendar.index');
        Route::get('/{calendarEvent}', [CalendarEventController::class, 'show'])->name('calendar.show');
        Route::post('/', [CalendarEventController::class, 'store'])->middleware('admin')->name('calendar.store');
        Route::put('/{calendarEvent}', [CalendarEventController::class, 'update'])->middleware('admin')->name('calendar.update');
        Route::delete('/{calendarEvent}', [CalendarEventController::class, 'destroy'])->middleware('admin')->name('calendar.destroy');
    });

    Route::prefix('inbox')->group(function () {
        /*
        | User Search Route (for compose recipient autocomplete)
        */
        Route::get('/users', [InboxUserController::class, 'index'])
            ->middleware('throttle:30,1')
            ->name('inbox.users.index');

        /*
        | Conversation Routes
        */
        Route::prefix('conversations')->group(function () {
            Route::get('/', [ConversationController::class, 'index'])
                ->middleware('throttle:60,1')
                ->name('inbox.conversations.index');
            Route::post('/', [ConversationController::class, 'store'])
                ->middleware('throttle:5,60')
                ->name('inbox.conversations.store');
            Route::get('/{conversation}', [ConversationController::class, 'show'])
                ->middleware('throttle:60,1')
                ->name('inbox.conversations.show');
            Route::post('/{conversation}/archive', [ConversationController::class, 'archive'])
                ->middleware('throttle:20,1')
                ->name('inbox.conversations.archive');
            Route::post('/{conversation}/unarchive', [ConversationController::class, 'unarchive'])
                ->middleware('throttle:20,1')
                ->name('inbox.conversations.unarchive');
            Route::post('/{conversation}/participants', [ConversationController::class, 'addParticipant'])
                ->middleware('throttle:10,60')
                ->name('inbox.conversations.add-participant');
            Route::delete('/{conversation}/participants/{user}', [ConversationController::class, 'removeParticipant'])
                ->middleware('throttle:10,60')
                ->name('inbox.conversations.remove-participant');
            Route::post('/{conversation}/leave', [ConversationController::class, 'leave'])
                ->middleware('throttle:10,60')
                ->name('inbox.conversations.leave');
            Route::delete('/{conversation}', [ConversationController::class, 'destroy'])
                ->middleware('admin')
                ->name('inbox.conversations.destroy');

            /*
            | Messages within Conversation Routes
            */
            Route::get('/{conversation}/messages', [MessageController::class, 'index'])
                ->middleware('throttle:60,1')
                ->name('inbox.conversations.messages.index');
            Route::post('/{conversation}/messages', [MessageController::class, 'store'])
                ->middleware('throttle:20,1')
                ->name('inbox.conversations.messages.store');
        });

        /*
        | Message Routes
        */
        Route::prefix('messages')->group(function () {
            Route::get('/unread-count', [MessageController::class, 'unreadCount'])
                ->middleware('throttle:60,1')
                ->name('inbox.messages.unread-count');
            Route::get('/{message}', [MessageController::class, 'show'])
                ->middleware('throttle:60,1')
                ->name('inbox.messages.show');
            Route::get('/{message}/attachments/{document}', [MessageController::class, 'downloadAttachment'])
                ->middleware('throttle:10,60')
                ->name('inbox.messages.download-attachment');
            Route::delete('/{message}', [MessageController::class, 'destroy'])
                ->middleware('admin')
                ->name('inbox.messages.destroy');
        });
    });
});
