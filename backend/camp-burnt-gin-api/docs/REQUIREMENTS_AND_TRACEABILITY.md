# Requirements and Traceability Matrix

This document provides a comprehensive mapping of system requirements to their implementation status. It serves as the authoritative Requirements Traceability Matrix (RTM) for the Camp Burnt Gin API backend system.

---

## Table of Contents

1. [Document Purpose](#document-purpose)
2. [Requirement Categories](#requirement-categories)
3. [Functional Requirements](#functional-requirements)
4. [Non-Functional Requirements](#non-functional-requirements)
5. [Traceability Matrix](#traceability-matrix)
6. [Frontend-Dependent Requirements](#frontend-dependent-requirements)
7. [Verification Summary](#verification-summary)

---

## Document Purpose

This Requirements and Traceability Matrix serves to:

1. **Document all system requirements** — Functional and non-functional
2. **Map requirements to implementations** — Trace each requirement to its backend component
3. **Identify completion status** — Clearly state what is complete vs. pending frontend
4. **Support auditing and verification** — Enable requirement-by-requirement validation
5. **Guide frontend development** — Clarify which backend capabilities exist

---

## Requirement Categories

Requirements are organized into the following categories:

| Category | Code | Description |
|----------|------|-------------|
| Authentication | FR-AUTH | User authentication and session management |
| User Management | FR-USER | User profiles and account management |
| Camp Management | FR-CAMP | Camp programs and session configuration |
| Camper Management | FR-CAMPER | Camper profiles and registration |
| Applications | FR-APP | Application lifecycle and workflow |
| Medical Information | FR-MED | Health records and medical data |
| Documents | FR-DOC | File uploads and management |
| Notifications | FR-NOTIF | System notifications |
| Reporting | FR-RPT | Administrative reports |
| Security | NFR-SEC | Security requirements |
| Performance | NFR-PERF | Performance requirements |
| Usability | NFR-USE | Usability requirements |

---

## Functional Requirements

### Authentication Requirements (FR-AUTH)

| ID | Requirement | Priority | Status | Backend Component |
|----|-------------|----------|--------|-------------------|
| FR-AUTH-01 | System shall allow new users to register with email and password | High | **Complete** | `AuthController::register`, `AuthService::register` |
| FR-AUTH-02 | System shall authenticate users with email and password | High | **Complete** | `AuthController::login`, `AuthService::login` |
| FR-AUTH-03 | System shall generate secure API tokens upon successful authentication | High | **Complete** | `AuthService::login`, Sanctum |
| FR-AUTH-04 | System shall allow users to logout and invalidate their token | High | **Complete** | `AuthController::logout` |
| FR-AUTH-05 | System shall support password reset via email | High | **Complete** | `PasswordResetController`, `PasswordResetService` |
| FR-AUTH-06 | System shall support multi-factor authentication via TOTP | High | **Complete** | `MfaController`, `MfaService`, Google2FA |
| FR-AUTH-07 | System shall allow users to enable MFA with QR code enrollment | Medium | **Complete** | `MfaService::initializeSetup` |
| FR-AUTH-08 | System shall allow users to disable MFA with verification | Medium | **Complete** | `MfaService::disable` |
| FR-AUTH-09 | System shall enforce password complexity requirements | High | **Complete** | `RegisterRequest` validation rules |
| FR-AUTH-10 | Password reset tokens shall expire after 60 minutes | High | **Complete** | `PasswordResetService::resetPassword` |

### User Management Requirements (FR-USER)

| ID | Requirement | Priority | Status | Backend Component |
|----|-------------|----------|--------|-------------------|
| FR-USER-01 | Users shall be able to view their profile information | Medium | **Complete** | `UserProfileController::show` |
| FR-USER-02 | Users shall be able to update their name and email | Medium | **Complete** | `UserProfileController::update` |
| FR-USER-03 | System shall provide pre-fill data for returning applicants | Medium | **Complete** | `UserProfileController::prefill` |
| FR-USER-04 | System shall support three user roles: admin, parent, medical | High | **Complete** | `Role` model, `roles` table |
| FR-USER-05 | New registrations shall default to parent role | High | **Complete** | `AuthService::register` |

### Camp Management Requirements (FR-CAMP)

| ID | Requirement | Priority | Status | Backend Component |
|----|-------------|----------|--------|-------------------|
| FR-CAMP-01 | Administrators shall be able to create camp programs | High | **Complete** | `CampController::store` |
| FR-CAMP-02 | Administrators shall be able to update camp programs | High | **Complete** | `CampController::update` |
| FR-CAMP-03 | Administrators shall be able to delete camp programs | Medium | **Complete** | `CampController::destroy` |
| FR-CAMP-04 | Users shall be able to view active camp programs | High | **Complete** | `CampController::index` |
| FR-CAMP-05 | Administrators shall be able to create camp sessions | High | **Complete** | `CampSessionController::store` |
| FR-CAMP-06 | Camp sessions shall include dates, capacity, and age limits | High | **Complete** | `camp_sessions` migration |
| FR-CAMP-07 | Camp sessions shall have registration windows | Medium | **Complete** | `registration_opens_at`, `registration_closes_at` fields |
| FR-CAMP-08 | System shall track session capacity | Medium | **Complete** | `capacity` field in `camp_sessions` |

### Camper Management Requirements (FR-CAMPER)

| ID | Requirement | Priority | Status | Backend Component |
|----|-------------|----------|--------|-------------------|
| FR-CAMPER-01 | Parents shall be able to register campers | High | **Complete** | `CamperController::store` |
| FR-CAMPER-02 | Camper profiles shall include name, DOB, and gender | High | **Complete** | `campers` migration |
| FR-CAMPER-03 | Parents shall only view their own campers | High | **Complete** | `CamperPolicy::view` |
| FR-CAMPER-04 | Administrators shall be able to view all campers | High | **Complete** | `CamperPolicy::viewAny` |
| FR-CAMPER-05 | Parents shall be able to update their campers | Medium | **Complete** | `CamperController::update`, `CamperPolicy` |
| FR-CAMPER-06 | System shall calculate camper age from date of birth | Medium | **Complete** | `Camper::ageAsOf()` |

### Application Requirements (FR-APP)

| ID | Requirement | Priority | Status | Backend Component |
|----|-------------|----------|--------|-------------------|
| FR-APP-01 | Parents shall be able to submit applications for campers | High | **Complete** | `ApplicationController::store` |
| FR-APP-02 | Applications shall be linked to specific camp sessions | High | **Complete** | `camper_id`, `camp_session_id` foreign keys |
| FR-APP-03 | System shall prevent duplicate applications per camper per session | High | **Complete** | Unique constraint in migration |
| FR-APP-04 | Applications shall support draft mode for partial completion | High | **Complete** | `is_draft` field, `ApplicationController` |
| FR-APP-05 | Parents shall be able to update draft applications | Medium | **Complete** | `ApplicationController::update` |
| FR-APP-06 | Parents shall be able to submit draft applications | High | **Complete** | `submit` field in update request |
| FR-APP-07 | System shall capture digital signatures on applications | High | **Complete** | `signature_data`, `signature_name`, `signed_at`, `signed_ip_address` |
| FR-APP-08 | Signature shall record timestamp and IP address | Medium | **Complete** | `ApplicationController::sign` |
| FR-APP-09 | Applications shall track status throughout lifecycle | High | **Complete** | `ApplicationStatus` enum |
| FR-APP-10 | System shall support statuses: pending, under_review, approved, rejected, waitlisted, cancelled | High | **Complete** | `ApplicationStatus` enum cases |
| FR-APP-11 | Administrators shall be able to search applications | High | **Complete** | `ApplicationController::index` with search |
| FR-APP-12 | Administrators shall be able to filter applications by status | High | **Complete** | `ApplicationController::index` with filters |
| FR-APP-13 | Administrators shall be able to filter applications by session | Medium | **Complete** | `camp_session_id` filter |
| FR-APP-14 | Administrators shall be able to filter applications by date range | Medium | **Complete** | `date_from`, `date_to` filters |
| FR-APP-15 | Administrators shall be able to review and change application status | High | **Complete** | `ApplicationController::review` |
| FR-APP-16 | Review shall record reviewer, timestamp, and notes | High | **Complete** | `reviewed_by`, `reviewed_at`, `notes` fields |
| FR-APP-17 | System shall send acceptance letters upon approval | High | **Complete** | `LetterService::sendAcceptanceLetter` |
| FR-APP-18 | System shall send rejection letters upon rejection | High | **Complete** | `LetterService::sendRejectionLetter` |

### Medical Information Requirements (FR-MED)

| ID | Requirement | Priority | Status | Backend Component |
|----|-------------|----------|--------|-------------------|
| FR-MED-01 | Campers shall have associated medical records | High | **Complete** | `MedicalRecord` model, `medical_records` table |
| FR-MED-02 | Medical records shall include physician and insurance information | High | **Complete** | Migration fields |
| FR-MED-03 | Medical records shall support special needs and dietary restrictions | High | **Complete** | `special_needs`, `dietary_restrictions` fields |
| FR-MED-04 | Campers shall have associated allergy records | High | **Complete** | `Allergy` model, `allergies` table |
| FR-MED-05 | Allergies shall include allergen, severity, reaction, and treatment | High | **Complete** | Migration fields |
| FR-MED-06 | System shall support allergy severity levels: mild, moderate, severe, life-threatening | High | **Complete** | `AllergySeverity` enum |
| FR-MED-07 | Campers shall have associated medication records | High | **Complete** | `Medication` model, `medications` table |
| FR-MED-08 | Medications shall include name, dosage, frequency, and prescriber | High | **Complete** | Migration fields |
| FR-MED-09 | Campers shall have associated emergency contacts | High | **Complete** | `EmergencyContact` model |
| FR-MED-10 | Emergency contacts shall include name, relationship, phones, email | High | **Complete** | Migration fields |
| FR-MED-11 | Emergency contacts shall track primary contact and authorized pickup | Medium | **Complete** | `is_primary`, `is_authorized_pickup` fields |
| FR-MED-12 | Medical providers shall be able to view and update medical information | High | **Complete** | Policies with medical role support |
| FR-MED-13 | Parents shall be able to create secure links for medical providers | High | **Complete** | `MedicalProviderLinkController::store` |
| FR-MED-14 | Provider links shall expire after configurable period (default 72 hours) | High | **Complete** | `expires_at` field, link validation |
| FR-MED-15 | Provider links shall be single-use | High | **Complete** | `is_used` field, `markAsUsed()` |
| FR-MED-16 | Parents shall be able to revoke provider links | High | **Complete** | `MedicalProviderLinkController::revoke` |
| FR-MED-17 | Administrators shall be able to resend provider links | Medium | **Complete** | `MedicalProviderLinkController::resend` |
| FR-MED-18 | Providers shall access forms without creating accounts | High | **Complete** | Token-based access endpoints |
| FR-MED-19 | Provider submissions shall create/update medical records | High | **Complete** | `MedicalProviderLinkService::processSubmission` |
| FR-MED-20 | System shall notify parents when providers submit information | High | **Complete** | `ProviderSubmissionReceivedNotification` |

### Document Requirements (FR-DOC)

| ID | Requirement | Priority | Status | Backend Component |
|----|-------------|----------|--------|-------------------|
| FR-DOC-01 | Users shall be able to upload documents | High | **Complete** | `DocumentController::store` |
| FR-DOC-02 | System shall validate file MIME types | High | **Complete** | `DocumentService::validateMimeType` |
| FR-DOC-03 | System shall enforce maximum file size (10 MB) | High | **Complete** | `DocumentService::validateFileSize` |
| FR-DOC-04 | System shall support PDF, images, and Word documents | High | **Complete** | `ALLOWED_MIME_TYPES` constant |
| FR-DOC-05 | System shall perform security scanning on uploads | High | **Complete** | `DocumentService::performSecurityScan` |
| FR-DOC-06 | System shall block dangerous file extensions | High | **Complete** | Extension check in security scan |
| FR-DOC-07 | Users shall be able to download their documents | Medium | **Complete** | `DocumentController::download` |
| FR-DOC-08 | Documents shall be attached to campers, records, or applications | Medium | **Complete** | Polymorphic `documentable` relationship |
| FR-DOC-09 | Medical providers shall be able to upload documents via links | High | **Complete** | `MedicalProviderLinkService::uploadDocument` |

### Notification Requirements (FR-NOTIF)

| ID | Requirement | Priority | Status | Backend Component |
|----|-------------|----------|--------|-------------------|
| FR-NOTIF-01 | System shall send email notifications for key events | High | **Complete** | Notification classes |
| FR-NOTIF-02 | System shall notify on application submission | High | **Complete** | `ApplicationSubmittedNotification` |
| FR-NOTIF-03 | System shall notify on application status change | High | **Complete** | `ApplicationStatusChangedNotification` |
| FR-NOTIF-04 | System shall notify providers of new access links | High | **Complete** | `ProviderLinkCreatedNotification` |
| FR-NOTIF-05 | System shall notify on provider link revocation | Medium | **Complete** | `ProviderLinkRevokedNotification` |
| FR-NOTIF-06 | System shall notify when provider links expire | Low | **Complete** | `ProviderLinkExpiredNotification` |
| FR-NOTIF-07 | System shall store notifications in database | Medium | **Complete** | `notifications` table |
| FR-NOTIF-08 | Users shall be able to view notification history | Medium | **Complete** | `NotificationController::index` |
| FR-NOTIF-09 | Users shall be able to mark notifications as read | Low | **Complete** | `NotificationController::markRead` |

### Reporting Requirements (FR-RPT)

| ID | Requirement | Priority | Status | Backend Component |
|----|-------------|----------|--------|-------------------|
| FR-RPT-01 | Administrators shall be able to generate application reports | High | **Complete** | `ReportController::applications` |
| FR-RPT-02 | Application reports shall support status filtering | High | **Complete** | `ReportService::generateApplicationsReport` |
| FR-RPT-03 | Administrators shall be able to list accepted applicants | High | **Complete** | `ReportController::accepted` |
| FR-RPT-04 | Administrators shall be able to list rejected applicants | High | **Complete** | `ReportController::rejected` |
| FR-RPT-05 | System shall generate mailing label data | Medium | **Complete** | `ReportController::mailingLabels` |
| FR-RPT-06 | System shall generate ID badge label data | Medium | **Complete** | `ReportController::idLabels` |
| FR-RPT-07 | ID labels shall include severe allergy information | High | **Complete** | `ReportService::generateIdLabels` |

---

## Non-Functional Requirements

### Security Requirements (NFR-SEC)

| ID | Requirement | Priority | Status | Implementation |
|----|-------------|----------|--------|----------------|
| NFR-SEC-01 | All API communication shall use HTTPS | High | **Complete** | Infrastructure configuration |
| NFR-SEC-02 | Passwords shall be hashed using bcrypt | High | **Complete** | Laravel Hash facade |
| NFR-SEC-03 | API tokens shall be hashed before storage | High | **Complete** | Sanctum token hashing |
| NFR-SEC-04 | System shall implement role-based access control | High | **Complete** | Policies, middleware |
| NFR-SEC-05 | Authorization shall be enforced at multiple layers | High | **Complete** | Route middleware, policies |
| NFR-SEC-06 | Medical data shall be protected per HIPAA guidelines | High | **Complete** | Access controls, audit logging |
| NFR-SEC-07 | Uploaded files shall be scanned for malware | High | **Complete** | `DocumentService::performSecurityScan` |
| NFR-SEC-08 | Input shall be validated before processing | High | **Complete** | Form Request classes |
| NFR-SEC-09 | System shall prevent SQL injection | High | **Complete** | Eloquent ORM parameterized queries |
| NFR-SEC-10 | System shall log security-relevant events | High | **Complete** | Laravel logging |
| NFR-SEC-11 | Provider links shall use cryptographically secure tokens | High | **Complete** | 64-char random tokens |
| NFR-SEC-12 | MFA secrets shall be hidden from API responses | High | **Complete** | `$hidden` model attribute |

### Performance Requirements (NFR-PERF)

| ID | Requirement | Priority | Status | Implementation |
|----|-------------|----------|--------|----------------|
| NFR-PERF-01 | API responses shall return within 2 seconds | Medium | **Complete** | Efficient queries, indexing |
| NFR-PERF-02 | Database queries shall use appropriate indexes | Medium | **Complete** | Index definitions in migrations |
| NFR-PERF-03 | Pagination shall be supported for list endpoints | Medium | **Complete** | Laravel pagination |
| NFR-PERF-04 | System shall support caching for configuration | Low | **Complete** | Laravel config caching |

### Maintainability Requirements (NFR-MAINT)

| ID | Requirement | Priority | Status | Implementation |
|----|-------------|----------|--------|----------------|
| NFR-MAINT-01 | Code shall follow Laravel conventions | High | **Complete** | Architecture adherence |
| NFR-MAINT-02 | Business logic shall be separated from controllers | High | **Complete** | Service layer pattern |
| NFR-MAINT-03 | Database schema shall be defined via migrations | High | **Complete** | `database/migrations/` |
| NFR-MAINT-04 | Authorization rules shall be centralized in policies | High | **Complete** | `app/Policies/` |
| NFR-MAINT-05 | Validation rules shall be centralized in form requests | High | **Complete** | `app/Http/Requests/` |
| NFR-MAINT-06 | System shall include automated tests | High | **Complete** | `tests/Feature/Api/` |

---

## Traceability Matrix

### Requirements to Components

| Requirement Category | Controller | Service | Policy | Model | Migration |
|---------------------|------------|---------|--------|-------|-----------|
| FR-AUTH | AuthController, MfaController, PasswordResetController | AuthService, MfaService, PasswordResetService | — | User | users, password_reset_tokens |
| FR-USER | UserProfileController | — | — | User, Role | users, roles |
| FR-CAMP | CampController, CampSessionController | — | — | Camp, CampSession | camps, camp_sessions |
| FR-CAMPER | CamperController | — | CamperPolicy | Camper | campers |
| FR-APP | ApplicationController | LetterService | ApplicationPolicy | Application | applications |
| FR-MED | MedicalRecordController, AllergyController, MedicationController, EmergencyContactController, MedicalProviderLinkController | MedicalProviderLinkService | MedicalRecordPolicy, AllergyPolicy, MedicationPolicy, EmergencyContactPolicy, MedicalProviderLinkPolicy | MedicalRecord, Allergy, Medication, EmergencyContact, MedicalProviderLink | medical_records, allergies, medications, emergency_contacts, medical_provider_links |
| FR-DOC | DocumentController | DocumentService | DocumentPolicy | Document | documents |
| FR-NOTIF | NotificationController | — | — | — | notifications |
| FR-RPT | ReportController | ReportService, LetterService | — | — | — |

### Components to Files

| Component Type | Location | Count |
|---------------|----------|-------|
| Controllers | `app/Http/Controllers/Api/` | 16 |
| Services | `app/Services/` | 7 |
| Policies | `app/Policies/` | 8 |
| Models | `app/Models/` | 12 |
| Migrations | `database/migrations/` | 19 |
| Form Requests | `app/Http/Requests/` | 20+ |
| Notifications | `app/Notifications/` | 9 |
| Enums | `app/Enums/` | 2 |
| Middleware | `app/Http/Middleware/` | 2 |

---

## Frontend-Dependent Requirements

The following requirements are **partially met** by the backend and require frontend implementation for full completion:

| ID | Requirement | Backend Status | Frontend Needed |
|----|-------------|----------------|-----------------|
| FR-UI-01 | User-friendly registration form | API ready | Form UI |
| FR-UI-02 | Login form with MFA support | API ready | Form UI with code input |
| FR-UI-03 | Dashboard for parents | API ready | Dashboard UI |
| FR-UI-04 | Dashboard for administrators | API ready | Admin dashboard UI |
| FR-UI-05 | Application form with draft auto-save | API ready | Form UI with auto-save logic |
| FR-UI-06 | Digital signature capture | API ready | Canvas/signature pad UI |
| FR-UI-07 | Application search and filtering interface | API ready | Search/filter UI |
| FR-UI-08 | Medical information entry forms | API ready | Form UIs |
| FR-UI-09 | Document upload interface | API ready | File upload UI |
| FR-UI-10 | Notification display | API ready | Notification UI/badge |
| FR-UI-11 | Report generation interface | API ready | Report selection/display UI |
| FR-UI-12 | Medical provider form (token-based) | API ready | Provider form UI |
| FR-UI-13 | QR code display for MFA setup | API provides URL | QR code rendering |

### Backend Readiness for Frontend

All backend APIs are **fully implemented and tested**. Frontend development can proceed with confidence that:

1. All endpoints are functional and documented
2. Validation rules are enforced server-side
3. Authorization is properly enforced
4. Error responses follow consistent format
5. Pagination is implemented for list endpoints
6. Search and filtering are supported where specified

---

## Verification Summary

### Requirements Completion

| Category | Total | Complete | Partial | Pending |
|----------|-------|----------|---------|---------|
| FR-AUTH | 10 | 10 | 0 | 0 |
| FR-USER | 5 | 5 | 0 | 0 |
| FR-CAMP | 8 | 8 | 0 | 0 |
| FR-CAMPER | 6 | 6 | 0 | 0 |
| FR-APP | 18 | 18 | 0 | 0 |
| FR-MED | 20 | 20 | 0 | 0 |
| FR-DOC | 9 | 9 | 0 | 0 |
| FR-NOTIF | 9 | 9 | 0 | 0 |
| FR-RPT | 7 | 7 | 0 | 0 |
| NFR-SEC | 12 | 12 | 0 | 0 |
| NFR-PERF | 4 | 4 | 0 | 0 |
| NFR-MAINT | 6 | 6 | 0 | 0 |
| **Total** | **114** | **114** | **0** | **0** |

### Backend Completion

**All 114 backend requirements are FULLY IMPLEMENTED.**

### Frontend-Dependent Items

13 requirements require frontend implementation for user-facing functionality. The backend provides all necessary API support for these requirements.

---

## Conclusion

The Camp Burnt Gin API backend has achieved 100% completion of defined backend requirements. The system is fully prepared for frontend integration, with all APIs functional, tested, and documented.

The traceability matrix demonstrates clear mapping from requirements to implementation components, supporting verification and maintenance activities.
