# Changelog

All notable changes to the Camp Burnt Gin API project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

No changes pending release.

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
