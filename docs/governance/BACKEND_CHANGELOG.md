# Changelog

All notable changes to the Camp Burnt Gin API project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Phase 10 — Documentation and Codebase Guide (2026-03-06)

#### Added

- `CODEBASE_GUIDE.md` at project root — comprehensive guide covering folder structure, data flow diagrams, debugging reference, database table index, security layers, and environment setup. Suitable for onboarding and bug investigation.

#### Updated

- `docs/governance/BACKEND_CHANGELOG.md` — Phases 8, 9, and post-phase fixes added.
- `docs/backend/ROLES_AND_PERMISSIONS.md` — "Parent" role references updated to "Applicant" throughout; hierarchy notation updated; role assignment description updated.
- `docs/backend/AUDIT_LOGGING.md` — Phase 9 audit log enhancements documented: human descriptions, category mapping, export endpoint.
- `BUG_TRACKER.md` — status updated for all Phase 8–10 resolved items; new post-phase bugs added (BUG-049 through BUG-053); summary table updated.

---

### Post-Phase 8 Fixes (2026-03-06)

#### Fixed

- `ConversationController::store()` — `hasNonAdminParticipants` check was `$role !== 'admin'`, treating `super_admin` as a non-admin. Corrected to `!in_array($role, ['admin', 'super_admin'], true)`. Applicants can now start conversations with super admins. (BUG-049)
- `InboxPage.tsx` — folder switching caused a brief blank/skeleton flash because `setConversations([])` was called immediately in `changeFolder`. Fix: stale content stays visible during load; new data replaces it atomically. Top loading bar overlay replaces skeleton rows. (BUG-050)
- `useAuthInit.ts` — token was read from `localStorage` but written to `sessionStorage` on login, causing logout on every page refresh. All three `localStorage` references corrected to `sessionStorage`. (BUG-051)
- `StatusBadge.tsx` — `under_review` status badge was green (matching `approved`). Changed to light yellow background with dark amber text. `pending` status badge changed from green to grey to distinguish it from approved/active states. (BUG-052, BUG-053)

---

### Phase 9 — Audit Log Redesign (2026-03-06)

#### Changed

- `AuditLogController` fully rewritten:
  - `buildQuery(Request $request)` — shared filter builder used by both `index()` and `export()`.
  - `formatEntries(array $items)` — enriches each entry with `human_description`, `category`, and `entity_label`.
  - `buildHumanDescription(...)` — maps 20+ action/entity combinations to plain-English sentences (e.g., "Super Administrator approved Application #42").
  - `mapCategory(string $eventType)` — maps backend event type strings to display categories: Authentication, Messaging, Applications, Notifications, Security, Medical, Administrative, Documents, System.
  - `shortEntityType(string $type)` — strips namespace from Eloquent model class names for display.
  - `export(Request $request)` — new endpoint `GET /audit-log/export?format=csv|json`. Returns up to 5,000 rows as a file download.
- `routes/api.php` — single `GET /audit-log` route replaced with a prefixed group: `GET /audit-log` (index) and `GET /audit-log/export` (export), both under `role:super_admin` middleware.
- `admin.types.ts` — `AuditLogEntry` interface extended with `category`, `human_description`, `entity_label`.
- `admin.api.ts` — `getAuditLog()` updated to accept `event_type` and `entity_type` params; `exportAuditLog()` added as a blob-download function.
- `AuditLogPage.tsx` — fully redesigned:
  - Timeline layout with expandable entry rows.
  - `CategoryBadge` — colored pill with icon per event category.
  - `AuditEntryRow` — displays human description, category badge, user/IP/entity meta, timestamp + relative time, expand/collapse toggle.
  - `MetadataPanel` — translates raw route/method/status metadata into plain English ("Action performed: Viewed a camper profile", "Result: Success").
  - `DiffBlock` — before/after value comparison with human-readable field labels.
  - User agent parsed to "Chrome 145 on macOS" instead of raw UA string.
  - Export buttons (CSV, JSON), collapsible filter panel, pagination.

#### Fixed

- BUG-013: Audit log displayed vague raw action names with no human-readable context, no categories, no before/after values, no export.

---

### Phase 8 — Inbox / Messaging Restructure (2026-03-06)

#### Added

- Migration `2026_03_06_000001_add_per_user_state_to_conversation_participants_table.php` — adds `is_starred BOOLEAN`, `is_important BOOLEAN`, `trashed_at TIMESTAMP NULL` to `conversation_participants`. **Run `php artisan migrate` before testing inbox folders.**
- All 8 inbox folders implemented: Inbox, Starred, Important, Sent, Drafts, Trash, Scheduled, Archive.
- Per-user folder state persisted to backend via `ConversationParticipant` fields.
- Three-pane Gmail-style layout: folder pane, message list pane, thread viewer pane.
- Floating compose modal with rich text editor (bold, italic, underline, lists), attachment support.
- Bulk actions toolbar: archive, delete, mark read/unread.
- Stale-while-revalidate folder loading: old content visible while new data loads, replaced atomically.
- Top loading bar overlay on folder switch (replaces skeleton row flash).

#### Fixed

- BUG-015: Starred state was client-only (localStorage). Now persisted to `conversation_participants.is_starred`.
- BUG-016: Inbox missing Drafts, Sent, Trash with restore, Scheduled, Important folder. All implemented.

---

### Phase 7 — Notifications and Recent Updates (2026-03-06)

#### Fixed

- `ApplicationStatusChangedNotification::via()` — now reads `notification_preferences.application_updates` from the notifiable user before including the `mail` channel. Previously, email was always sent regardless of user preferences.
- `ApplicationSubmittedNotification::via()` — same fix as above; respects `application_updates` preference.
- `NewMessageNotification::via()` — now reads `notification_preferences.messages` before including `mail`. Previously always sent email.
- `NewConversationNotification::via()` — same fix; respects `messages` preference.
- `NotificationController::index()` — previously returned raw `DatabaseNotification` Eloquent models, causing `title` and `message` to be absent from the response (they live inside the `data` JSON column, not as top-level fields). Controller now maps each notification to an explicit shape: `id`, `type`, `title`, `message`, `data`, `read_at`, `created_at`. The frontend can now render human-readable notification content directly.
- `NotificationController::index()` — `unread_only` filter previously used separate query paths; consolidated to a single conditional for clarity.
- `Notification` TypeScript type — `id` corrected from `number` to `string` (Laravel DatabaseNotifications use UUID primary keys). `read_at` type widened to `string | null`.
- `ApplicantDashboardPage` — `pendingCount` filter used `'submitted'` which is not a valid `ApplicationStatus` value; corrected to `'pending'`.

#### Changed

- All notification `toArray()` methods now include `title` and `message` fields so stored notifications are self-describing. This eliminates blank notification cards in the Recent Updates widget.
- `SettingsPage` notification preferences are now fetched on component mount rather than only when the notifications tab is first opened. This eliminates a race condition where an in-flight preference load would overwrite an optimistic toggle update made by the user immediately after opening the tab.
- `handleNotifToggle` in `SettingsPage` now guards against simultaneous saves (early return when `savingNotif !== null`) and uses the functional `setState` updater to avoid stale closure bugs.
- All notification preference toggles are now disabled while any one is saving, preventing duplicate toast messages.
- Notification preference toggle descriptions added to the Settings UI so users understand what each toggle controls.
- `notifications.api.ts` — `getNotifications()` return type updated to `NotificationsResponse` (custom shape with `unread_count` in meta). `markNotificationRead()` parameter type updated to `string` to match UUID ids.
- `ApplicantDashboardPage` "Recent Updates" widget rebuilt: shows notification type icon, human-readable title, body message, relative timestamp, unread indicator dot, per-item mark-as-read on click, and a "Mark all read" shortcut button.
- `NotificationPanel` (slide-out panel) `handleMarkRead` parameter type updated to `string` to match UUID ids.

---

### Phase 6 — Medical Portal Fixes & Feature Completion (2026-03-06, continued)

#### Fixed

- `CamperPolicy::view()` — medical providers can now view individual camper profiles. Required for clinical workflows: recording treatments against a named camper, reviewing medical records, and uploading documents. Medical role still cannot list, create, update, or delete campers.
- `MedicalTreatmentLogPage` — handled the case where `camperId` is absent (global `/medical/treatments` nav route). Previously called `getCamper(NaN)` → 403/404 → "Failed to load data" for all medical staff navigating from the sidebar. Now conditionally skips the `getCamper` call and fetches all treatment logs when no camper context is present.
- `treatment_logs` migration — `title` column changed from `string(255)` to `text`. The `encrypted` cast produces Base64-encoded ciphertext that exceeds VARCHAR(255) for any non-trivial input, causing silent data truncation. `text` type (65,535 bytes) accommodates all encrypted values.

#### Changed

- Auth token storage changed from `localStorage` to `sessionStorage`. Eliminates the multi-tab session collision bug where logging into one tab overwrote the token used by all other tabs. Each browser tab now maintains an isolated session, enabling testing of multiple roles simultaneously without interference. Normal single-tab production use is unaffected.
- Medical portal navigation — Announcements nav item added. Route `/medical/announcements` now renders the read-only `ParentAnnouncementsPage` for medical staff. Medical staff can view announcements but cannot create, edit, or delete them.

---

### Phase 6 — Medical Portal Rebuild (2026-03-06)

#### Added

- `TreatmentLog` model (`app/Models/TreatmentLog.php`) with PHI encryption on `title`, `description`, `outcome`, `follow_up_notes` via Laravel `encrypted` cast
- `TreatmentType` enum (`app/Enums/TreatmentType.php`) with cases: `MedicationAdministered`, `FirstAid`, `Observation`, `Emergency`, `Other`
- `TreatmentLogPolicy` (`app/Policies/TreatmentLogPolicy.php`) — admin full access; medical staff can create and update own entries only; no delete for medical role
- `StoreTreatmentLogRequest` and `UpdateTreatmentLogRequest` form requests with HIPAA-appropriate validation
- `TreatmentLogController` (`app/Http/Controllers/Api/Medical/TreatmentLogController.php`) with index (filterable by camper_id, date range, type), store, show, update, destroy
- Migration `2026_03_06_000010_create_treatment_logs_table.php` — adds `treatment_logs` table with indexes on `[camper_id, treatment_date]` and `recorded_by`
- Treatment log routes under `role:admin,medical` middleware; destroy restricted to `admin` middleware only
- `TreatmentLog::class => TreatmentLogPolicy::class` registered in `AppServiceProvider`
- **Frontend — `MedicalTreatmentLogPage`**: full treatment log UI with add-entry form, type badges, expandable log entries, follow-up indicators; supports both `/medical/treatments` (all campers) and `/medical/records/:camperId/treatments` (per-camper)
- **Frontend — `MedicalDocumentsPage`**: drag-and-drop upload zone, upload progress tracking, download via blob URL, per-camper document listing
- **Frontend** routes for `/medical/treatments`, `/medical/records/:camperId/treatments`, `/medical/records/:camperId/documents`, `/medical/inbox`
- **Frontend** `MedicalLayout` nav items: Treatment Logs, Inbox (previously missing)
- **Frontend** `ROUTES` constants: `MEDICAL_TREATMENT_LOGS`, `MEDICAL_RECORD_TREATMENTS`, `MEDICAL_RECORD_DOCUMENTS`
- **i18n** (en + es): `medical.treatments.*`, `medical.documents.*`, `medical.modal.*` namespaces; common keys `notes`, `description`, `download`, `permitted`, `not_permitted`

#### Changed

- `MedicalRecordPolicy` — removed `MedicalProviderLink` gate from `view()` and `update()`; medical staff have direct access as logged-in users
- `AllergyPolicy`, `MedicationPolicy`, `DiagnosisPolicy`, `BehavioralProfilePolicy`, `FeedingPlanPolicy`, `AssistiveDevicePolicy`, `ActivityPermissionPolicy` — same provider link gate removal; medical staff can now create and update (but not delete) all sub-records
- `DocumentPolicy` — medical staff can access all `Camper` and `MedicalRecord` documents without a provider link check
- `DocumentController::index()` — added `isMedicalProvider()` branch fetching all camper and medical record documents
- **Frontend** `MedicalRecordPage` — rebuilt from read-only viewer to full edit UI with 14 modal types for inline editing of all medical sub-resources
- **Frontend** `medical.api.ts` — added write operations for all medical sub-resources; added full `TreatmentLog` API section with TypeScript interfaces; added `getCamperDocuments()`, `uploadDocument()`, `downloadDocument()`

#### Fixed

- BUG-007: Medical portal was read-only for camp medical staff; root cause was `MedicalProviderLink` policy gate designed for external unauthenticated providers being incorrectly applied to logged-in medical role users
- BUG-028: Medical portal missing write capabilities, treatment log, and document management — all implemented in this phase
- BUG-034: `/medical/inbox` route missing; route and nav item added

---

### Frontend — Phase 5 Continuation (2026-03-06)

#### Fixed

- `SuperAdminDashboardPage` quick links corrected: `/admin/applications` and `/admin/campers` changed to `/super-admin/applications` and `/super-admin/campers` — super admins now navigate within the Super Admin portal shell.
- `AdminApplicationsPage` "Review" link is now portal-context-aware using `useLocation`. When the page is loaded inside `/super-admin/applications`, review links correctly navigate to `/super-admin/applications/:id`.
- `AdminCampersPage` "View Risk" and "View" links are now portal-context-aware. When loaded inside `/super-admin/campers`, all camper links resolve to `/super-admin/campers/:id`.
- `ApplicationReviewPage` "Back to Applications" link is now portal-context-aware. When loaded inside the Super Admin portal, the back link returns to `/super-admin/applications`.
- `CamperDetailPage` T-Shirt Size field corrected from `camper.t_shirt_size` to `camper.tshirt_size` — field was silently resolving to `undefined` due to property name mismatch with the `Camper` TypeScript type.
- `FormManagementPage` header description updated to clearly explain the feature purpose: supplemental PDF/Word form templates that applicants must complete, optionally scoped to a camp session.

---

## [1.1.0] - 2026-03-01

### Overview

Patch and feature release addressing bugs identified during structured QA testing, completing the announcement and calendar systems, adding form template management, and extending the audit logging and user management APIs.

### Added

- `UserController` at `app/Http/Controllers/Api/System/UserController.php` — paginated user listing, role update, account deactivation, and account reactivation under `role:super_admin` middleware
- `FormTemplateController` at `app/Http/Controllers/Api/System/FormTemplateController.php` — CRUD operations and download endpoint for uploaded PDF/Word form templates; files stored at `storage/app/form-templates/`
- `FormTemplate` model and migration (`2026_02_28_000001_create_form_templates_table.php`)
- `AuditLogController` at `app/Http/Controllers/Api/System/AuditLogController.php` — `GET /api/audit-log` with search parameter support, under `role:super_admin` middleware
- Notification preferences backend: migration (`2026_02_27_115413_add_notification_preferences_to_users_table.php`), model fields, and controller endpoints on `UserProfileController`
- `CalendarEventsController` — `GET/POST/PUT/DELETE /api/calendar` endpoints for camp event management
- Announcements pin and urgent flags on `AnnouncementsController`
- `GET /api/users` and `PUT /api/users/{id}/role` routes registered under `role:super_admin`

### Fixed

- `AuditLogController::index()` response structure corrected to return `{ data, meta: { current_page, last_page, per_page, total, from, to } }` (previously returned flat paginator)
- `AuthController::register()` now calls `->load('role')` before returning the user object, resolving the null role crash on first login
- `ReportController` updated to return `StreamedResponse` with `Content-Type: text/csv`; `id_labels` export handles `camp_session_id` as optional
- Account lockout threshold corrected to 5 attempts (was incorrectly set to 10 in `User.php` and `AuthService.php`)
- `ProfilePage` MFA handlers now propagate actual backend error messages instead of generic fallback strings

### Testing

- Test suite expanded to 308 passing tests with 708 assertions
- Feature tests added for `UserController`, `FormTemplateController`, `AuditLogController`, and `CalendarEventsController`
- Account lockout threshold tests corrected to match implementation

---

## [1.0.0] - 2026-02-11

### Overview

Initial production release of the Camp Burnt Gin API backend. This release represents a complete, production-ready API system for managing camp registrations, medical information, and administrative workflows with HIPAA-compliant PHI handling.

**Release Highlights:**
- Complete authentication and authorization system with MFA support
- Comprehensive medical information management with PHI audit logging
- Application workflow with digital signatures and review process
- Document management with security scanning
- Medical provider secure link system
- Administrative reporting capabilities
- Full test coverage (228 tests, 430 assertions)
- Security audit completed with zero vulnerabilities

### Added

#### Authentication and Security
- User registration with email/password authentication
- Token-based authentication via Laravel Sanctum
- Multi-factor authentication (MFA) using TOTP
- MFA enrollment with QR code generation
- Password reset flow with secure tokens (60-minute expiration)
- Role-based access control (Admin, Parent, Medical roles)
- Policy-based authorization for fine-grained access control
- Rate limiting on authentication endpoints (5 attempts/minute)
- Account lockout after 5 failed login attempts (15-minute cooldown)
- Token expiration (60 minutes) for HIPAA compliance
- Session encryption with APP_KEY
- Bcrypt password hashing (cost factor 14)

#### User Management
- User profile management (view, update)
- Role assignment system
- Pre-fill data endpoint for returning applicants
- User-owned camper relationships

#### Camp Management
- Camp CRUD operations (Create, Read, Update, Delete)
- Camp session management with dates and capacity tracking
- Age requirements (min/max) for sessions
- Registration windows (open/close dates)
- Session capacity limits
- Active/inactive status flags

#### Camper Management
- Camper profile creation and management
- Parent-owned camper relationships
- Camper information (name, DOB, gender)
- Authorization checks for camper access

#### Application Management
- Application creation with draft mode
- Application submission workflow
- Digital signature capture and storage
- Application review by administrators
- Status transitions (pending → under_review → approved/rejected/waitlisted)
- Application cancellation by parents
- Unique constraint (one application per camper per session)
- Application search and filtering
- Application status notifications

#### Medical Information Management
- Medical record CRUD operations
- Allergy tracking with severity levels (mild, moderate, severe, life-threatening)
- Medication tracking with dosage and frequency
- Emergency contact management with pickup authorization
- PHI access restricted by role and ownership
- Audit logging for all PHI access (HIPAA compliance)

#### Medical Provider Integration
- Secure provider link generation (64-character tokens)
- Token expiration (72 hours default)
- Single-use link enforcement
- Provider submission without authentication
- Link revocation capability
- Provider access audit logging

#### Document Management
- File upload with validation (MIME type, size, extension)
- Supported file types (PDF, images, Word documents)
- File size limit (10 MB)
- Security scanning (quarantine-based approval)
- Document download with authorization
- Document deletion by owner or admin
- Polymorphic associations (attach to campers, medical records, applications)
- Unscanned document protection (admin-only access)

#### Notification System
- Email notifications for application status changes
- Database notification storage for in-app display
- Notification read status tracking
- Acceptance and rejection letter generation
- Provider link notifications
- Application submission notifications
- Asynchronous notification dispatch via queue
- Notification retry logic (3 attempts with exponential backoff)

#### Reporting System
- Applications report with filtering and statistics
- Accepted applicants report
- Rejected applicants report
- Mailing labels data generation
- ID labels with allergy information
- Admin-only access restriction

#### Audit Logging
- PHI access logging via middleware
- Authentication event logging
- Administrative action logging
- Audit log database table with indexed queries
- Request ID correlation for distributed tracing
- Graceful failure handling (audit failures don't block requests)
- HIPAA-compliant audit trail

#### API Features
- RESTful API design with consistent response formats
- Pagination for list endpoints (default 15 items per page)
- Request validation via Form Request classes
- JSON response format for all endpoints
- Standard HTTP status codes
- Rate limiting (60 requests/minute general, tiered for sensitive endpoints)
- CORS configuration support
- Request ID middleware for tracing

### Testing
- 228 automated tests with 430 assertions
- Feature tests for all major workflows
- Unit tests for business logic
- Policy tests for authorization
- Test coverage for authentication, application workflow, medical records
- Fast test execution (~2-3 seconds for full suite)

### Documentation
- Comprehensive API reference documentation
- System architecture documentation
- Security documentation with HIPAA compliance notes
- Data model documentation
- Testing guide
- Environment setup guide
- Contributing guidelines
- Business rules documentation
- Roles and permissions matrix
- Backend completion status document

### Security
- Security audit completed February 11, 2026
- 29 security, performance, and architectural issues resolved
- Zero vulnerabilities remaining
- Enterprise-grade security posture
- HIPAA Technical Safeguards compliance
- Input validation on all endpoints
- SQL injection prevention via Eloquent ORM
- XSS prevention via JSON responses
- CSRF protection
- Secure password storage with bcrypt
- API token hashing (SHA-256)
- MFA secret encryption
- Audit logging for compliance

### Infrastructure
- Laravel 12.x framework
- PHP 8.2+ requirement
- MySQL 8.0+ database
- Redis support for caching and queues
- Queue worker support via Supervisor
- File storage (local, S3-compatible)
- Email delivery via SMTP, SendGrid, Mailgun, SES

### Changed
- None (initial release)

### Deprecated
- None (initial release)

### Removed
- None (initial release)

### Fixed
- None (initial release)

### Security
- All known security vulnerabilities addressed in security audit

---

## Version History

### Version Numbering

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR version** (1.x.x): Incompatible API changes
- **MINOR version** (x.1.x): New functionality in a backwards-compatible manner
- **PATCH version** (x.x.1): Backwards-compatible bug fixes

### Release Types

- **Major Release** (1.0.0, 2.0.0): Significant new features, breaking changes
- **Minor Release** (1.1.0, 1.2.0): New features, backwards-compatible
- **Patch Release** (1.0.1, 1.0.2): Bug fixes, security patches

---

## Migration Guides

### Migrating from Pre-Release to 1.0.0

**Database:**
- No migration required (initial release)
- Run `php artisan migrate` for fresh installation

**Configuration:**
- Copy `.env.example` to `.env`
- Configure all required environment variables
- Generate application key: `php artisan key:generate`

**Dependencies:**
- Run `composer install --no-dev --optimize-autoloader`

---

## Future Releases

### Planned for 1.1.0
- Payment processing integration
- Advanced reporting with custom filters
- Bulk operations for administrators
- Enhanced notification preferences
- Calendar view for camp sessions

See [FUTURE_WORK.md](./FUTURE_WORK.md) for detailed roadmap.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing to this project.

---

## Links

- [Repository](https://github.com/your-org/camp-burnt-gin-api)
- [Documentation](./README.md)
- [Issue Tracker](https://github.com/your-org/camp-burnt-gin-api/issues)
- [Security Policy](./SECURITY.md)

---

**Document Status:** Authoritative
**Maintained By:** Development Team
**Last Updated:** March 2026
