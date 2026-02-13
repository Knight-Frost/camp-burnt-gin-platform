# Frontend Architecture Considerations
## Camp Burnt Gin Application Software

**Document Type:** Technical Architecture Guidance
**Intended Audience:** Frontend Development Team
**Purpose:** Inform frontend planning, architecture, UI flows, component design, security boundaries, API contracts, and state management decisions
**Backend Version:** Laravel 12.0 API
**Date:** February 13, 2026
**Status:** Authoritative

---

## Document Alignment

This frontend architecture guidance document is aligned with the following project deliverables and specifications:

- **System Requirements Specification (SRS)** — Deliverable 2
- **Software Development & Design Document** — Deliverable 3 (CSCI475Project-Deliverable3)
- **Interview Documentation & Project Description** — Deliverable 1
- **Phase 1 Rubric** — CSCI 475 Phase 1 Rubric (ensuring traceability and demonstrability)

The frontend must remain:
- HIPAA compliant
- RBAC enforced
- MFA required
- Mobile-first responsive
- Modular and scalable
- Aligned with the Requirements Traceability Matrix (RTM)

---

## 1. Executive Summary

### 1.1 Backend Architecture Overview

The Camp Burnt Gin API backend is a comprehensive, enterprise-grade RESTful API built using Laravel 12.0 with PHP 8.2+. The system implements a robust, security-first architecture designed specifically to handle Protected Health Information (PHI) in compliance with HIPAA technical safeguards. The backend follows a strict Model-View-Controller (MVC) architectural pattern enhanced with a service layer for complex business logic, policy-based authorization, and comprehensive audit logging.

The backend has achieved 100% completion of all 114 defined requirements across functional and non-functional categories, including authentication, user management, camp management, camper registration, application workflows, medical information handling, document management, notifications, and administrative reporting. All backend APIs are production-ready, fully tested (228 automated tests with 430 assertions), and documented.

### 1.2 Backend Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Laravel | 12.0 | Core application framework |
| **Language** | PHP | 8.2+ | Server-side programming language |
| **Authentication** | Laravel Sanctum | 4.2 | Token-based API authentication |
| **Multi-Factor Authentication** | PragmaRX Google2FA | 9.0 | TOTP-based two-factor authentication |
| **Database** | MySQL/MariaDB | 8.0+ | Relational data persistence |
| **ORM** | Eloquent | Laravel 12 | Database abstraction and query building |
| **Validation** | Form Requests | Laravel 12 | Input validation and sanitization |
| **Authorization** | Policies + Middleware | Laravel 12 | Role-based access control enforcement |
| **Queue System** | Laravel Queues | Laravel 12 | Asynchronous job processing |
| **File Storage** | Laravel Storage | Laravel 12 | Document upload and retrieval |
| **Caching** | Database/Redis | Configurable | Performance optimization layer |
| **Email** | Laravel Mail | Laravel 12 | Notification delivery system |
| **Testing** | PHPUnit + Pest | Latest | Automated test suite |

### 1.3 Architectural Style

**Primary Pattern:** RESTful API with resource-oriented design

**Architectural Characteristics:**

| Characteristic | Implementation |
|---------------|----------------|
| **Stateless** | Token-based authentication eliminates server-side session state, enabling horizontal scalability |
| **Resource-Oriented** | All entities exposed as RESTful resources with standard HTTP verbs (GET, POST, PUT, DELETE) |
| **Layered Architecture** | Clear separation of concerns: Routes → Controllers → Services → Models → Database |
| **Service Layer Pattern** | Complex business logic encapsulated in dedicated service classes (AuthService, DocumentService, LetterService, MedicalProviderLinkService, etc.) |
| **Policy-Based Authorization** | Fine-grained access control using Laravel Policy classes enforcing ownership and role-based rules |
| **Repository Pattern** | Eloquent ORM provides abstraction over database queries with relationship management |
| **Event-Driven Notifications** | Asynchronous job queues for email notifications, document scanning, and time-consuming operations |
| **Defense-in-Depth Security** | Multi-layered security: Transport (TLS), Authentication (Sanctum + MFA), Authorization (Policies + Middleware), Input Validation (Form Requests), Audit Logging |

**API Design Standards:**

- **Content Type:** All requests and responses use `application/json`
- **Authentication Header:** `Authorization: Bearer {token}` for all protected endpoints
- **Base Path:** `/api` prefix for all API routes
- **Versioning Strategy:** Implicit v1 (no version in URL path currently; future versions would use `/api/v2` if breaking changes required)
- **Error Format:** Standardized JSON error responses with HTTP status codes and field-level validation errors
- **Pagination:** Cursor-based pagination for list endpoints with configurable page size (default 15 items)
- **Rate Limiting:** Multi-tier throttling based on endpoint sensitivity (5/min for auth, 60/min for general API)

### 1.4 Frontend Implications at a Glance

The frontend application must be architected to integrate seamlessly with the backend's security model, workflow requirements, and architectural constraints. Key implications include:

**Authentication & Session Management:**
- Implement secure token storage mechanism (recommend: httpOnly cookies or encrypted localStorage with additional client-side encryption)
- Handle 60-minute automatic token expiration with graceful session timeout UX
- Support MFA challenge flow during login with TOTP code input
- Implement account lockout detection and countdown timer display (15-minute lockout after 5 failed attempts)
- Provide password reset flow with token-based email verification

**Role-Based Access Control:**
- Implement route guards for three distinct user roles: Administrator, Parent, Medical Provider
- Conditionally render UI components based on user role and ownership
- Hide administrative functions from non-admin users at UI layer (not just authorization failure)
- Scope data queries client-side to prevent unauthorized data exposure in UI state
- Display "access denied" messages for forbidden operations with clear guidance

**Application Workflow State Management:**
- Support draft mode with auto-save functionality for incomplete applications
- Implement digital signature capture using canvas or signature pad library
- Track application status transitions through six states: pending, under_review, approved, rejected, waitlisted, cancelled
- Prevent editing of final state applications (approved, rejected, cancelled) at UI layer
- Display submission confirmation and status change notifications prominently

**File Upload & Document Security:**
- Implement client-side file validation: max 10 MB, allowed types (PDF, JPG, PNG, GIF, DOC, DOCX)
- Display upload progress with percentage and cancel functionality
- Prevent download of unscanned documents for non-admin users (check `scan_passed` flag)
- Handle expired medical provider links gracefully with clear error messaging
- Support drag-and-drop file upload with visual feedback

**Performance & Scalability:**
- Implement lazy loading for route components to reduce initial bundle size
- Use pagination for large data sets (applications, medical records, audit logs)
- Handle rate limiting gracefully with retry-after countdown timers for 429 responses
- Cache static data (camp sessions, role definitions) in client state with configurable TTL
- Implement optimistic UI updates for form submissions to improve perceived performance

**Security & HIPAA Compliance:**
- Prevent PHI from being cached in browser history or localStorage without encryption
- Clear sensitive data from application state on logout
- Implement automatic logout on token expiration with data wipe
- Avoid displaying PHI in URL parameters (use POST bodies or route parameters, not query strings)
- Log UI-triggered PHI access events for audit trail (coordinate with backend audit logging)
- Prevent sensitive data from appearing in browser console logs or error messages visible to users

**Data Model Alignment:**
- Structure frontend state to mirror backend Eloquent models: User, Camper, Application, MedicalRecord, Allergy, Medication, EmergencyContact, Document, etc.
- Maintain referential integrity in client state (camper → applications, camper → medical records)
- Implement form validation rules matching backend validation (field lengths, formats, required fields)
- Support polymorphic document relationships (documents belong to camper, medical record, or application)

---

## 2. Backend API Surface Analysis

This section provides a comprehensive catalog of all API endpoints exposed by the Camp Burnt Gin backend. Each endpoint is documented with HTTP method, full URL path, authentication requirements, role-based authorization, request payload structure, response format, error conditions, and HTTP status codes.

### 2.1 API Base Configuration

| Configuration | Value |
|--------------|-------|
| **Base URL** | `/api` |
| **Protocol** | HTTPS (enforced in production) |
| **Content Type** | `application/json` |
| **Authentication Method** | Bearer token via `Authorization` header |
| **Token Format** | `Authorization: Bearer {token_id}\|{token_string}` |
| **Character Encoding** | UTF-8 |
| **Date/Time Format** | ISO 8601 (`YYYY-MM-DDTHH:MM:SS.ssssssZ`) |
| **Pagination Format** | Laravel pagination with `data`, `links`, `meta` envelope |

### 2.2 Health Check Endpoints

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/api/health` | No | None | Liveness probe for load balancers |
| GET | `/api/ready` | No | None | Readiness probe for orchestration |

**GET /api/health**

**Request:** None

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-13T10:30:00.000000Z"
}
```

**GET /api/ready**

**Request:** None

**Response (200 OK):**
```json
{
  "status": "ready",
  "database": "connected",
  "cache": "available",
  "timestamp": "2026-02-13T10:30:00.000000Z"
}
```

### 2.3 Authentication Endpoints (Public)

All authentication endpoints are public (no token required) but implement aggressive rate limiting to prevent abuse.

**Rate Limit:** 5 requests/minute, 20 requests/hour per IP address

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| POST | `/api/auth/register` | No | None | Create new user account (defaults to parent role) |
| POST | `/api/auth/login` | No | None | Authenticate user and receive API token |
| POST | `/api/auth/forgot-password` | No | None | Request password reset email with token |
| POST | `/api/auth/reset-password` | No | None | Reset password using emailed token |

**POST /api/auth/register**

**Request Payload:**
```json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "password": "SecurePassword123!",
  "password_confirmation": "SecurePassword123!"
}
```

**Validation Rules:**
- `name`: required, string, max 255 characters
- `email`: required, email format, unique in users table
- `password`: required, min 12 characters, must contain uppercase, lowercase, number, symbol, confirmed, not compromised (checked against haveibeenpwned API)

**Response (201 Created):**
```json
{
  "user": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "role_id": 2,
    "role": {
      "id": 2,
      "name": "parent",
      "display_name": "Parent"
    },
    "mfa_enabled": false,
    "created_at": "2026-02-13T10:30:00.000000Z"
  },
  "token": "1|KpPJQm8tGqHZ5wNrYxV3LbC7DfMj4sRt"
}
```

**Error Response (422 Unprocessable Entity):**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["The email has already been taken."],
    "password": [
      "The password must be at least 12 characters.",
      "The password must contain at least one uppercase letter.",
      "The password has appeared in a data leak. Please choose a different password."
    ]
  }
}
```

**POST /api/auth/login**

**Request Payload (Without MFA):**
```json
{
  "email": "jane.doe@example.com",
  "password": "SecurePassword123!"
}
```

**Request Payload (With MFA Enabled):**
```json
{
  "email": "jane.doe@example.com",
  "password": "SecurePassword123!",
  "mfa_code": "123456"
}
```

**Validation Rules:**
- `email`: required, email format
- `password`: required, string
- `mfa_code`: required if user has MFA enabled, exactly 6 digits

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "role_id": 2,
    "role": {
      "id": 2,
      "name": "parent",
      "display_name": "Parent"
    },
    "mfa_enabled": true,
    "created_at": "2026-02-13T10:30:00.000000Z"
  },
  "token": "1|KpPJQm8tGqHZ5wNrYxV3LbC7DfMj4sRt",
  "expires_at": "2026-02-13T11:30:00.000000Z"
}
```

**Error Response (401 Unauthorized - Invalid Credentials):**
```json
{
  "message": "Invalid credentials."
}
```

**Error Response (403 Forbidden - Account Locked):**
```json
{
  "success": false,
  "message": "Account locked due to too many failed attempts. Try again in 14 minute(s).",
  "lockout": true,
  "retry_after": 840
}
```

**Error Response (422 Unprocessable Entity - MFA Required):**
```json
{
  "message": "MFA code is required.",
  "errors": {
    "mfa_code": ["The mfa code field is required when MFA is enabled."]
  }
}
```

**Error Response (422 Unprocessable Entity - Invalid MFA Code):**
```json
{
  "message": "Invalid MFA code.",
  "errors": {
    "mfa_code": ["The MFA code is invalid or has expired."]
  }
}
```

**POST /api/auth/forgot-password**

**Request Payload:**
```json
{
  "email": "jane.doe@example.com"
}
```

**Response (200 OK):**
```json
{
  "message": "Password reset link sent to your email address."
}
```

**Note:** Always returns 200 OK even if email doesn't exist (security best practice to prevent email enumeration).

**POST /api/auth/reset-password**

**Request Payload:**
```json
{
  "email": "jane.doe@example.com",
  "token": "64-character-reset-token-from-email",
  "password": "NewSecurePassword123!",
  "password_confirmation": "NewSecurePassword123!"
}
```

**Validation Rules:**
- `email`: required, email format, exists in users table
- `token`: required, string, valid unexpired token
- `password`: required, min 12 characters, uppercase, lowercase, number, symbol, confirmed, not compromised
- Token expires after 60 minutes

**Response (200 OK):**
```json
{
  "message": "Password has been reset successfully."
}
```

**Error Response (422 Unprocessable Entity - Invalid/Expired Token):**
```json
{
  "message": "This password reset token is invalid or has expired.",
  "errors": {
    "email": ["This password reset token is invalid."]
  }
}
```

### 2.4 Multi-Factor Authentication Endpoints (Authenticated)

**Rate Limit:** 3 requests/minute, 10 requests/hour per user

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| POST | `/api/mfa/setup` | Yes | Any | Initialize MFA enrollment, receive QR code |
| POST | `/api/mfa/verify` | Yes | Any | Verify TOTP code and enable MFA |
| POST | `/api/mfa/disable` | Yes | Any | Disable MFA (requires password + TOTP code) |

**POST /api/mfa/setup**

**Request:** None

**Response (200 OK):**
```json
{
  "secret": "BASE32ENCODEDSECRETKEY",
  "qr_code_url": "otpauth://totp/Camp%20Burnt%20Gin:jane.doe@example.com?secret=BASE32ENCODEDSECRETKEY&issuer=Camp%20Burnt%20Gin",
  "manual_entry_key": "BASE32 ENCODED SECRET KEY"
}
```

**Frontend Action:** Display QR code by encoding `qr_code_url` or provide manual entry instructions with formatted key.

**POST /api/mfa/verify**

**Request Payload:**
```json
{
  "code": "123456"
}
```

**Validation Rules:**
- `code`: required, exactly 6 digits, valid TOTP code generated from secret

**Response (200 OK):**
```json
{
  "message": "MFA has been enabled successfully.",
  "mfa_enabled": true,
  "mfa_verified_at": "2026-02-13T10:35:00.000000Z"
}
```

**Error Response (422 Unprocessable Entity - Invalid Code):**
```json
{
  "message": "The provided MFA code is invalid.",
  "errors": {
    "code": ["The MFA code is invalid. Please try again."]
  }
}
```

**POST /api/mfa/disable**

**Request Payload:**
```json
{
  "password": "SecurePassword123!",
  "code": "123456"
}
```

**Validation Rules:**
- `password`: required, string, matches current password
- `code`: required, exactly 6 digits, valid TOTP code

**Response (200 OK):**
```json
{
  "message": "MFA has been disabled successfully.",
  "mfa_enabled": false
}
```

**Error Response (422 Unprocessable Entity):**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "password": ["The password is incorrect."],
    "code": ["The MFA code is invalid."]
  }
}
```

### 2.5 User Profile Endpoints (Authenticated)

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/api/user` | Yes | Any | Get authenticated user profile |
| POST | `/api/logout` | Yes | Any | Logout and revoke current token |
| GET | `/api/profile` | Yes | Any | Get user profile (alias for `/api/user`) |
| PUT | `/api/profile` | Yes | Any | Update user profile (name, email) |
| GET | `/api/profile/prefill` | Yes | Parent | Get pre-fill data for returning applicants |

**GET /api/user**

**Request:** None (token in header)

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "role_id": 2,
  "role": {
    "id": 2,
    "name": "parent",
    "display_name": "Parent"
  },
  "mfa_enabled": true,
  "created_at": "2026-02-13T10:30:00.000000Z",
  "updated_at": "2026-02-13T10:30:00.000000Z"
}
```

**POST /api/logout**

**Request:** None

**Response (200 OK):**
```json
{
  "message": "Logged out successfully."
}
```

**Effect:** Current API token is permanently deleted from database.

**PUT /api/profile**

**Request Payload:**
```json
{
  "name": "Jane Marie Doe",
  "email": "jane.m.doe@example.com"
}
```

**Validation Rules:**
- `name`: required, string, max 255 characters
- `email`: required, email format, unique (excluding current user)

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Jane Marie Doe",
  "email": "jane.m.doe@example.com",
  "role_id": 2,
  "role": {
    "id": 2,
    "name": "parent",
    "display_name": "Parent"
  },
  "mfa_enabled": true,
  "updated_at": "2026-02-13T11:00:00.000000Z"
}
```

**GET /api/profile/prefill**

**Request:** None

**Response (200 OK):**
```json
{
  "campers": [
    {
      "id": 1,
      "first_name": "Sarah",
      "last_name": "Doe",
      "date_of_birth": "2015-03-15",
      "gender": "female"
    }
  ],
  "emergency_contacts": [
    {
      "name": "John Doe",
      "relationship": "father",
      "primary_phone": "555-0100",
      "is_primary": true
    }
  ]
}
```

**Purpose:** Allows returning parents to auto-populate forms with stable data from previous applications.

### 2.6 Camp Management Endpoints

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/api/camps` | Yes | Any | List all active camps (filtered by role) |
| GET | `/api/camps/{id}` | Yes | Any | Get camp details |
| POST | `/api/camps` | Yes | Admin | Create new camp program |
| PUT | `/api/camps/{id}` | Yes | Admin | Update camp program |
| DELETE | `/api/camps/{id}` | Yes | Admin | Delete camp program |

**GET /api/camps**

**Request:** None

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Camp Burnt Gin Summer 2026",
      "description": "Week-long summer camp for children with special health care needs",
      "location": "Burnt Gin Camp Facility, VA",
      "is_active": true,
      "created_at": "2025-11-01T10:00:00.000000Z",
      "sessions_count": 3
    }
  ]
}
```

**GET /api/camps/{id}**

**Request:** None

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Camp Burnt Gin Summer 2026",
  "description": "Week-long summer camp for children with special health care needs",
  "location": "Burnt Gin Camp Facility, VA",
  "is_active": true,
  "created_at": "2025-11-01T10:00:00.000000Z",
  "updated_at": "2025-11-01T10:00:00.000000Z",
  "sessions": [
    {
      "id": 1,
      "camp_id": 1,
      "name": "Session 1 - June 2026",
      "start_date": "2026-06-15",
      "end_date": "2026-06-21",
      "capacity": 50,
      "min_age": 8,
      "max_age": 18,
      "registration_opens_at": "2026-02-01T00:00:00.000000Z",
      "registration_closes_at": "2026-06-01T23:59:59.000000Z",
      "applications_count": 23
    }
  ]
}
```

**POST /api/camps** (Admin Only)

**Request Payload:**
```json
{
  "name": "Camp Burnt Gin Fall 2026",
  "description": "Fall weekend retreat",
  "location": "Burnt Gin Camp Facility, VA",
  "is_active": true
}
```

**Response (201 Created):**
```json
{
  "id": 2,
  "name": "Camp Burnt Gin Fall 2026",
  "description": "Fall weekend retreat",
  "location": "Burnt Gin Camp Facility, VA",
  "is_active": true,
  "created_at": "2026-02-13T11:00:00.000000Z"
}
```

**PUT /api/camps/{id}** (Admin Only)

**Request Payload:**
```json
{
  "name": "Camp Burnt Gin Fall Retreat 2026",
  "description": "Updated description",
  "is_active": false
}
```

**Response (200 OK):**
```json
{
  "id": 2,
  "name": "Camp Burnt Gin Fall Retreat 2026",
  "description": "Updated description",
  "location": "Burnt Gin Camp Facility, VA",
  "is_active": false,
  "updated_at": "2026-02-13T11:05:00.000000Z"
}
```

**DELETE /api/camps/{id}** (Admin Only)

**Request:** None

**Response (204 No Content)**

### 2.7 Camp Session Endpoints

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/api/sessions` | Yes | Any | List all sessions with filters |
| GET | `/api/sessions/{id}` | Yes | Any | Get session details |
| POST | `/api/sessions` | Yes | Admin | Create new session |
| PUT | `/api/sessions/{id}` | Yes | Admin | Update session |
| DELETE | `/api/sessions/{id}` | Yes | Admin | Delete session |

**GET /api/sessions**

**Query Parameters:**
- `camp_id` (optional): Filter by camp ID
- `is_active` (optional): Filter by active status (true/false)

**Request Example:** `GET /api/sessions?camp_id=1&is_active=true`

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "camp_id": 1,
      "name": "Session 1 - June 2026",
      "start_date": "2026-06-15",
      "end_date": "2026-06-21",
      "capacity": 50,
      "min_age": 8,
      "max_age": 18,
      "registration_opens_at": "2026-02-01T00:00:00.000000Z",
      "registration_closes_at": "2026-06-01T23:59:59.000000Z",
      "is_active": true,
      "applications_count": 23,
      "approved_count": 15,
      "available_spots": 35
    }
  ]
}
```

### 2.8 Camper Endpoints

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/api/campers` | Yes | Admin, Parent | List campers (Admin: all, Parent: own) |
| POST | `/api/campers` | Yes | Admin, Parent | Create camper profile |
| GET | `/api/campers/{id}` | Yes | Admin, Parent (own) | Get camper details |
| PUT | `/api/campers/{id}` | Yes | Admin, Parent (own) | Update camper |
| DELETE | `/api/campers/{id}` | Yes | Admin, Parent (own) | Soft delete camper |
| GET | `/api/campers/{id}/risk-summary` | Yes | Admin, Medical | Get risk assessment summary |
| GET | `/api/campers/{id}/compliance-status` | Yes | Admin | Get compliance status |

**GET /api/campers** (Scoped by Role)

**Request:** None

**Response (200 OK) - Parent:**
```json
{
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "first_name": "Sarah",
      "last_name": "Doe",
      "date_of_birth": "2015-03-15",
      "gender": "female",
      "age": 10,
      "created_at": "2026-01-10T10:00:00.000000Z"
    }
  ]
}
```

**POST /api/campers**

**Request Payload:**
```json
{
  "first_name": "Sarah",
  "last_name": "Doe",
  "date_of_birth": "2015-03-15",
  "gender": "female"
}
```

**Validation Rules:**
- `first_name`: required, string, max 255 characters
- `last_name`: required, string, max 255 characters
- `date_of_birth`: required, date format, before today
- `gender`: nullable, string, max 50 characters

**Response (201 Created):**
```json
{
  "id": 1,
  "user_id": 1,
  "first_name": "Sarah",
  "last_name": "Doe",
  "date_of_birth": "2015-03-15",
  "gender": "female",
  "age": 10,
  "created_at": "2026-02-13T11:00:00.000000Z"
}
```

**PUT /api/campers/{id}**

**Request Payload:**
```json
{
  "first_name": "Sarah Marie",
  "last_name": "Doe",
  "gender": "female"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "user_id": 1,
  "first_name": "Sarah Marie",
  "last_name": "Doe",
  "date_of_birth": "2015-03-15",
  "gender": "female",
  "age": 10,
  "updated_at": "2026-02-13T11:05:00.000000Z"
}
```

**DELETE /api/campers/{id}**

**Request:** None

**Response (204 No Content)**

**Note:** Soft delete (sets `deleted_at` timestamp) for HIPAA compliance and record retention.

### 2.9 Application Endpoints

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/api/applications` | Yes | Admin, Parent | List applications with search/filter |
| POST | `/api/applications` | Yes | Admin, Parent | Create application (supports draft mode) |
| GET | `/api/applications/{id}` | Yes | Admin, Parent (own) | Get application details |
| PUT | `/api/applications/{id}` | Yes | Admin, Parent (own) | Update application |
| POST | `/api/applications/{id}/sign` | Yes | Admin, Parent (own) | Digitally sign application |
| POST | `/api/applications/{id}/review` | Yes | Admin | Review application (approve/reject/waitlist) |
| DELETE | `/api/applications/{id}` | Yes | Admin | Delete application |

**GET /api/applications**

**Query Parameters:**
- `status` (optional): Filter by status (pending, under_review, approved, rejected, waitlisted, cancelled)
- `camp_session_id` (optional): Filter by session ID
- `date_from` (optional): Filter by submission date (YYYY-MM-DD)
- `date_to` (optional): Filter by submission date (YYYY-MM-DD)
- `search` (optional): Search by camper name
- `page` (optional): Page number for pagination (default: 1)
- `per_page` (optional): Items per page (default: 15)

**Request Example:** `GET /api/applications?status=under_review&camp_session_id=1&page=1`

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "camper_id": 1,
      "camp_session_id": 1,
      "status": "under_review",
      "is_draft": false,
      "submitted_at": "2026-02-10T14:30:00.000000Z",
      "reviewed_at": null,
      "reviewed_by": null,
      "signature_name": "Jane Doe",
      "signed_at": "2026-02-10T14:29:00.000000Z",
      "camper": {
        "id": 1,
        "first_name": "Sarah",
        "last_name": "Doe",
        "date_of_birth": "2015-03-15"
      },
      "camp_session": {
        "id": 1,
        "name": "Session 1 - June 2026",
        "start_date": "2026-06-15",
        "end_date": "2026-06-21"
      }
    }
  ],
  "links": {
    "first": "http://api.campburntgin.org/api/applications?page=1",
    "last": "http://api.campburntgin.org/api/applications?page=5",
    "prev": null,
    "next": "http://api.campburntgin.org/api/applications?page=2"
  },
  "meta": {
    "current_page": 1,
    "from": 1,
    "last_page": 5,
    "per_page": 15,
    "to": 15,
    "total": 67
  }
}
```

**POST /api/applications**

**Request Payload (Draft):**
```json
{
  "camper_id": 1,
  "camp_session_id": 1,
  "is_draft": true,
  "notes": "Partial application - saving for later"
}
```

**Request Payload (Submission - requires signature first):**
```json
{
  "camper_id": 1,
  "camp_session_id": 1,
  "is_draft": false
}
```

**Validation Rules:**
- `camper_id`: required, exists in campers table, owned by authenticated user (if parent)
- `camp_session_id`: required, exists in camp_sessions table, registration window must be open
- `is_draft`: boolean, default true
- Unique constraint: one application per camper per session

**Response (201 Created):**
```json
{
  "id": 1,
  "camper_id": 1,
  "camp_session_id": 1,
  "status": "pending",
  "is_draft": true,
  "submitted_at": null,
  "created_at": "2026-02-13T11:00:00.000000Z"
}
```

**Error Response (422 - Duplicate Application):**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "camper_id": ["This camper already has an application for this session."]
  }
}
```

**POST /api/applications/{id}/sign**

**Request Payload:**
```json
{
  "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "signature_name": "Jane Doe"
}
```

**Validation Rules:**
- `signature_data`: required, string (base64 encoded image)
- `signature_name`: required, string, max 255 characters

**Response (200 OK):**
```json
{
  "id": 1,
  "signature_name": "Jane Doe",
  "signed_at": "2026-02-13T11:05:00.000000Z",
  "signed_ip_address": "192.168.1.100",
  "is_signed": true
}
```

**POST /api/applications/{id}/review** (Admin Only)

**Request Payload:**
```json
{
  "status": "approved",
  "notes": "Application meets all requirements. Camper medical information complete."
}
```

**Validation Rules:**
- `status`: required, enum (approved, rejected, waitlisted)
- `notes`: required if status is rejected, optional otherwise

**Response (200 OK):**
```json
{
  "id": 1,
  "camper_id": 1,
  "camp_session_id": 1,
  "status": "approved",
  "is_draft": false,
  "submitted_at": "2026-02-10T14:30:00.000000Z",
  "reviewed_at": "2026-02-13T11:10:00.000000Z",
  "reviewed_by": 5,
  "notes": "Application meets all requirements. Camper medical information complete.",
  "reviewer": {
    "id": 5,
    "name": "Admin User",
    "email": "admin@campburntgin.org"
  }
}
```

**Side Effects:**
- Status change to "approved" triggers acceptance letter generation and email notification
- Status change to "rejected" triggers rejection letter generation and email notification
- Audit log entry created for review action

### 2.10 Medical Record Endpoints

**Role Restrictions:** Admin (full CRUD), Parent (own campers only), Medical (read-only + update)

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/api/medical-records` | Yes | Admin, Medical | List all medical records |
| POST | `/api/medical-records` | Yes | Admin, Parent | Create medical record |
| GET | `/api/medical-records/{id}` | Yes | Admin, Parent (own), Medical | Get medical record |
| PUT | `/api/medical-records/{id}` | Yes | Admin, Parent (own), Medical | Update medical record |
| DELETE | `/api/medical-records/{id}` | Yes | Admin | Delete medical record |

**GET /api/medical-records**

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "camper_id": 1,
      "physician_name": "Dr. Emily Smith",
      "physician_phone": "555-0200",
      "insurance_provider": "Blue Cross Blue Shield",
      "insurance_policy_number": "ABC123456789",
      "special_needs": "Requires assistance with mobility",
      "dietary_restrictions": "Gluten-free diet",
      "camper": {
        "id": 1,
        "first_name": "Sarah",
        "last_name": "Doe"
      }
    }
  ]
}
```

**POST /api/medical-records**

**Request Payload:**
```json
{
  "camper_id": 1,
  "physician_name": "Dr. Emily Smith",
  "physician_phone": "555-0200",
  "insurance_provider": "Blue Cross Blue Shield",
  "insurance_policy_number": "ABC123456789",
  "special_needs": "Requires assistance with mobility",
  "dietary_restrictions": "Gluten-free diet"
}
```

**Validation Rules:**
- `camper_id`: required, exists, one medical record per camper (unique constraint)
- `physician_name`: nullable, string, max 255
- `physician_phone`: nullable, string, max 20
- `insurance_provider`: nullable, string, max 255
- `insurance_policy_number`: nullable, string, max 100
- `special_needs`: nullable, text, max 5000 characters
- `dietary_restrictions`: nullable, text, max 2000 characters

**Response (201 Created):**
```json
{
  "id": 1,
  "camper_id": 1,
  "physician_name": "Dr. Emily Smith",
  "physician_phone": "555-0200",
  "insurance_provider": "Blue Cross Blue Shield",
  "insurance_policy_number": "ABC123456789",
  "special_needs": "Requires assistance with mobility",
  "dietary_restrictions": "Gluten-free diet",
  "created_at": "2026-02-13T11:15:00.000000Z"
}
```

### 2.11 Allergy Endpoints

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/api/allergies` | Yes | Admin, Medical | List all allergies |
| POST | `/api/allergies` | Yes | Admin, Parent, Medical | Create allergy |
| GET | `/api/allergies/{id}` | Yes | Admin, Parent (own), Medical | Get allergy details |
| PUT | `/api/allergies/{id}` | Yes | Admin, Parent (own), Medical | Update allergy |
| DELETE | `/api/allergies/{id}` | Yes | Admin, Parent (own) | Delete allergy |

**POST /api/allergies**

**Request Payload:**
```json
{
  "camper_id": 1,
  "allergen": "Peanuts",
  "severity": "life_threatening",
  "reaction": "Anaphylaxis, throat swelling, difficulty breathing",
  "treatment": "EpiPen administered immediately, call 911"
}
```

**Validation Rules:**
- `camper_id`: required, exists in campers table
- `allergen`: required, string, max 255
- `severity`: required, enum (mild, moderate, severe, life_threatening)
- `reaction`: nullable, text, max 2000 characters
- `treatment`: nullable, text, max 2000 characters

**Response (201 Created):**
```json
{
  "id": 1,
  "camper_id": 1,
  "allergen": "Peanuts",
  "severity": "life_threatening",
  "reaction": "Anaphylaxis, throat swelling, difficulty breathing",
  "treatment": "EpiPen administered immediately, call 911",
  "created_at": "2026-02-13T11:20:00.000000Z"
}
```

### 2.12 Medication Endpoints

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/api/medications` | Yes | Admin, Medical | List all medications |
| POST | `/api/medications` | Yes | Admin, Parent, Medical | Create medication |
| GET | `/api/medications/{id}` | Yes | Admin, Parent (own), Medical | Get medication details |
| PUT | `/api/medications/{id}` | Yes | Admin, Parent (own), Medical | Update medication |
| DELETE | `/api/medications/{id}` | Yes | Admin, Parent (own) | Delete medication |

**POST /api/medications**

**Request Payload:**
```json
{
  "camper_id": 1,
  "name": "Albuterol Inhaler",
  "dosage": "2 puffs",
  "frequency": "Every 4-6 hours as needed",
  "purpose": "Asthma control",
  "prescribing_physician": "Dr. Emily Smith",
  "notes": "Use before physical activity"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "camper_id": 1,
  "name": "Albuterol Inhaler",
  "dosage": "2 puffs",
  "frequency": "Every 4-6 hours as needed",
  "purpose": "Asthma control",
  "prescribing_physician": "Dr. Emily Smith",
  "notes": "Use before physical activity",
  "created_at": "2026-02-13T11:25:00.000000Z"
}
```

### 2.13 Emergency Contact Endpoints

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/api/emergency-contacts` | Yes | Admin, Medical | List all contacts |
| POST | `/api/emergency-contacts` | Yes | Admin, Parent | Create contact |
| GET | `/api/emergency-contacts/{id}` | Yes | Admin, Parent (own), Medical | Get contact details |
| PUT | `/api/emergency-contacts/{id}` | Yes | Admin, Parent (own) | Update contact |
| DELETE | `/api/emergency-contacts/{id}` | Yes | Admin, Parent (own) | Delete contact |

**POST /api/emergency-contacts**

**Request Payload:**
```json
{
  "camper_id": 1,
  "name": "John Doe",
  "relationship": "Father",
  "primary_phone": "555-0100",
  "secondary_phone": "555-0101",
  "email": "john.doe@example.com",
  "is_primary": true,
  "is_authorized_pickup": true
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "camper_id": 1,
  "name": "John Doe",
  "relationship": "Father",
  "primary_phone": "555-0100",
  "secondary_phone": "555-0101",
  "email": "john.doe@example.com",
  "is_primary": true,
  "is_authorized_pickup": true,
  "created_at": "2026-02-13T11:30:00.000000Z"
}
```

### 2.14 Document Endpoints

**Rate Limit:** Upload: 5/minute, 50/hour; Download: 10/minute, 100/hour

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/api/documents` | Yes | Admin, Parent (own) | List documents |
| POST | `/api/documents` | Yes | Admin, Parent | Upload document (multipart/form-data) |
| GET | `/api/documents/{id}` | Yes | Admin, Parent (own) | Get document metadata |
| GET | `/api/documents/{id}/download` | Yes | Admin, Parent (own) | Download document file |
| DELETE | `/api/documents/{id}` | Yes | Admin, Parent (own) | Delete document |

**POST /api/documents**

**Content-Type:** `multipart/form-data`

**Request Payload:**
```
file: [binary file data]
documentable_type: "App\Models\Camper"
documentable_id: 1
document_type: "medical"
```

**Validation Rules:**
- `file`: required, max 10 MB (10,485,760 bytes), mimes: pdf, jpg, jpeg, png, gif, doc, docx
- `documentable_type`: required, string (polymorphic model class)
- `documentable_id`: required, integer (polymorphic model ID)
- `document_type`: optional, string (category: medical, legal, identification)

**Response (201 Created):**
```json
{
  "id": 1,
  "documentable_type": "App\\Models\\Camper",
  "documentable_id": 1,
  "uploaded_by": 1,
  "document_type": "medical",
  "original_filename": "medical_form.pdf",
  "stored_filename": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
  "mime_type": "application/pdf",
  "file_size": 2048576,
  "is_scanned": false,
  "scan_passed": null,
  "created_at": "2026-02-13T11:35:00.000000Z"
}
```

**GET /api/documents/{id}/download**

**Request:** None

**Response (200 OK):**
- **Content-Type:** Original file MIME type
- **Content-Disposition:** `attachment; filename="original_filename.pdf"`
- **Body:** Binary file data

**Authorization Check:** User must be admin or own the documentable entity. Non-admin users cannot download unscanned files (`scan_passed` must be `true`).

**Error Response (403 Forbidden - Unscanned File):**
```json
{
  "message": "This document has not been security scanned yet. Please try again later."
}
```

### 2.15 Medical Provider Link Endpoints

**Rate Limit:** 10/minute, 100/hour

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/api/provider-links` | Yes | Admin, Parent (own) | List provider links |
| POST | `/api/provider-links` | Yes | Admin, Parent | Create provider link |
| GET | `/api/provider-links/{id}` | Yes | Admin, Parent (own) | Get link details |
| POST | `/api/provider-links/{id}/revoke` | Yes | Admin, Parent (own) | Revoke link |
| POST | `/api/provider-links/{id}/resend` | Yes | Admin | Regenerate and resend link |

**POST /api/provider-links**

**Request Payload:**
```json
{
  "camper_id": 1,
  "provider_email": "doctor@example.com",
  "message": "Please complete the medical information form for camp registration."
}
```

**Validation Rules:**
- `camper_id`: required, exists, owned by authenticated user (if parent)
- `provider_email`: required, email format
- `message`: optional, string, max 1000 characters

**Response (201 Created):**
```json
{
  "id": 1,
  "camper_id": 1,
  "provider_email": "doctor@example.com",
  "token": "64-character-cryptographically-secure-token",
  "expires_at": "2026-02-16T11:40:00.000000Z",
  "is_used": false,
  "revoked_at": null,
  "created_at": "2026-02-13T11:40:00.000000Z",
  "link_url": "https://app.campburntgin.org/provider/64-character-token"
}
```

**Side Effect:** Email sent to provider with secure link and parent's message.

### 2.16 Medical Provider Access Endpoints (Public with Token)

**Rate Limit:** 2/minute, 10/hour per IP

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/api/provider-access/{token}` | No | None | Access provider form (token validation) |
| POST | `/api/provider-access/{token}/submit` | No | None | Submit medical data via provider link |
| POST | `/api/provider-access/{token}/upload` | No | None | Upload document via provider link |

**GET /api/provider-access/{token}**

**Request:** None (token in URL path)

**Response (200 OK - Valid Token):**
```json
{
  "camper": {
    "id": 1,
    "first_name": "Sarah",
    "last_name": "Doe",
    "date_of_birth": "2015-03-15"
  },
  "expires_at": "2026-02-16T11:40:00.000000Z",
  "hours_remaining": 71
}
```

**Error Response (410 Gone - Expired/Used/Revoked Token):**
```json
{
  "message": "This link has expired, been used, or has been revoked."
}
```

**POST /api/provider-access/{token}/submit**

**Request Payload:**
```json
{
  "medical_record": {
    "physician_name": "Dr. Emily Smith",
    "physician_phone": "555-0200",
    "insurance_provider": "Blue Cross Blue Shield",
    "insurance_policy_number": "ABC123456789",
    "special_needs": "Requires assistance with mobility",
    "dietary_restrictions": "Gluten-free diet"
  },
  "allergies": [
    {
      "allergen": "Peanuts",
      "severity": "life_threatening",
      "reaction": "Anaphylaxis",
      "treatment": "EpiPen immediately"
    }
  ],
  "medications": [
    {
      "name": "Albuterol Inhaler",
      "dosage": "2 puffs",
      "frequency": "Every 4-6 hours as needed",
      "purpose": "Asthma control"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "message": "Medical information submitted successfully. Thank you for your contribution.",
  "link_used": true
}
```

**Side Effect:**
- Medical record created/updated
- Allergies and medications created
- Link marked as used (`is_used = true`, `used_at = timestamp`)
- Parent and admin notified via email
- Audit log entry created

### 2.17 Notification Endpoints

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/api/notifications` | Yes | Any | List user notifications (with unread filter) |
| PUT | `/api/notifications/{id}/read` | Yes | Any | Mark notification as read |
| PUT | `/api/notifications/read-all` | Yes | Any | Mark all notifications as read |

**GET /api/notifications**

**Query Parameters:**
- `unread` (optional): Filter unread notifications (true/false)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "type": "App\\Notifications\\ApplicationStatusChangedNotification",
      "data": {
        "application_id": 1,
        "old_status": "under_review",
        "new_status": "approved",
        "message": "Your application for Sarah Doe has been approved!"
      },
      "read_at": null,
      "created_at": "2026-02-13T11:10:00.000000Z"
    }
  ]
}
```

**PUT /api/notifications/{id}/read**

**Request:** None

**Response (200 OK):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "read_at": "2026-02-13T12:00:00.000000Z"
}
```

### 2.18 Report Endpoints (Admin Only)

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/api/reports/applications` | Yes | Admin | Generate applications report with filters |
| GET | `/api/reports/accepted` | Yes | Admin | List accepted applicants |
| GET | `/api/reports/rejected` | Yes | Admin | List rejected applicants |
| GET | `/api/reports/mailing-labels` | Yes | Admin | Generate mailing label data |
| GET | `/api/reports/id-labels` | Yes | Admin | Generate ID badge label data |

**GET /api/reports/applications**

**Query Parameters:**
- `status` (optional): Filter by application status
- `camp_session_id` (optional): Filter by session ID
- `date_from` (optional): Filter by submission date
- `date_to` (optional): Filter by submission date

**Response (200 OK):**
```json
{
  "summary": {
    "total_applications": 67,
    "pending": 12,
    "under_review": 20,
    "approved": 25,
    "rejected": 5,
    "waitlisted": 5
  },
  "applications": [
    {
      "id": 1,
      "camper_name": "Sarah Doe",
      "session_name": "Session 1 - June 2026",
      "status": "approved",
      "submitted_at": "2026-02-10T14:30:00.000000Z",
      "reviewed_at": "2026-02-13T11:10:00.000000Z"
    }
  ]
}
```

**GET /api/reports/id-labels**

**Response (200 OK):**
```json
{
  "labels": [
    {
      "camper_id": 1,
      "full_name": "Sarah Doe",
      "session_name": "Session 1 - June 2026",
      "severe_allergies": ["Peanuts (life-threatening)"],
      "emergency_contact": "John Doe - 555-0100"
    }
  ]
}
```

### 2.19 Common HTTP Status Codes

| Code | Status | Usage |
|------|--------|-------|
| 200 | OK | Successful GET, PUT, POST request with response body |
| 201 | Created | Successful POST request creating a new resource |
| 204 | No Content | Successful DELETE request with no response body |
| 400 | Bad Request | Malformed request syntax or invalid JSON |
| 401 | Unauthorized | Authentication failed, missing token, or expired token |
| 403 | Forbidden | Authenticated but not authorized (role/ownership check failed) |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate resource or conflicting state (e.g., duplicate application) |
| 410 | Gone | Resource permanently deleted or link expired |
| 422 | Unprocessable Entity | Validation failed, invalid input data |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |

### 2.20 Standard Error Response Format

All error responses follow a consistent JSON structure:

**Validation Error (422):**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "field_name": [
      "The field name is required.",
      "The field name must be at least 3 characters."
    ],
    "another_field": [
      "The another field must be a valid email address."
    ]
  }
}
```

**Authentication Error (401):**
```json
{
  "message": "Unauthenticated."
}
```

**Authorization Error (403):**
```json
{
  "message": "This action is unauthorized."
}
```

**Resource Not Found (404):**
```json
{
  "message": "Resource not found."
}
```

**Rate Limit Exceeded (429):**
```json
{
  "message": "Too Many Attempts."
}
```

**Rate Limit Headers:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1707666240
Retry-After: 42
```

---

## 3. Authentication & Session Architecture

### 3.1 Authentication Implementation: Laravel Sanctum

The backend implements token-based authentication using Laravel Sanctum 4.2, providing stateless API authentication suitable for single-page applications (SPAs) and mobile applications.

**Core Mechanism:** Personal Access Tokens

| Aspect | Implementation |
|--------|----------------|
| **Token Generation** | Cryptographically secure random token generated on successful login |
| **Token Format** | `{token_id}\|{random_string}` (e.g., `1\|KpPJQm8tGqHZ5wNrYxV3LbC7DfMj4sRt`) |
| **Token Storage (Server)** | SHA-256 hash stored in `personal_access_tokens` table |
| **Token Storage (Client)** | Plain-text token provided once and never recoverable server-side |
| **Token Transmission** | `Authorization: Bearer {token}` header on all authenticated requests |
| **Token Expiration** | 60 minutes from creation (configurable in `config/sanctum.php`) |
| **Token Abilities** | All tokens have `["*"]` abilities (full API access for authenticated user) |

### 3.2 Authentication Flow Architecture

**Registration Flow:**

```
1. Frontend collects user registration data
   ↓
2. POST /api/auth/register
   - name (required, max 255)
   - email (required, unique, valid email format)
   - password (required, min 12 chars, complexity rules, not compromised)
   - password_confirmation (required, must match password)
   ↓
3. Backend validation:
   - Email uniqueness check
   - Password complexity validation (uppercase, lowercase, number, symbol)
   - haveibeenpwned API check for compromised passwords
   ↓
4. If valid:
   - Password hashed with bcrypt (cost factor 12)
   - User created with role_id = 2 (parent) by default
   - API token generated and returned
   ↓
5. Frontend receives:
   - User object (id, name, email, role)
   - API token (store securely)
   ↓
6. Frontend stores token and redirects to dashboard
```

**Login Flow (Without MFA):**

```
1. Frontend collects credentials
   ↓
2. POST /api/auth/login
   - email
   - password
   ↓
3. Backend validation:
   - User lookup by email
   - Password verification (bcrypt comparison)
   - Account lockout check (lockout_until > now)
   - Failed login attempt tracking
   ↓
4. If valid and MFA not enabled:
   - Generate new API token
   - Set expiration = now + 60 minutes
   - Reset failed_login_attempts to 0
   - Return user + token
   ↓
5. If invalid:
   - Increment failed_login_attempts
   - If attempts >= 5: set lockout_until = now + 15 minutes
   - Return 401 or 403 (if locked)
   ↓
6. Frontend stores token and navigates to dashboard
```

**Login Flow (With MFA Enabled):**

```
1. Frontend collects credentials
   ↓
2. POST /api/auth/login
   - email
   - password
   ↓
3. Backend checks MFA status:
   - If mfa_enabled = true and mfa_code not provided
   - Return 422 with "MFA code required"
   ↓
4. Frontend displays MFA code input (6-digit TOTP)
   ↓
5. User enters code from authenticator app
   ↓
6. POST /api/auth/login
   - email
   - password
   - mfa_code (6 digits)
   ↓
7. Backend validates TOTP code:
   - Decrypt mfa_secret from database
   - Verify code against current time window (30-second intervals)
   - Allow ±1 window for clock skew tolerance
   ↓
8. If TOTP valid:
   - Generate API token
   - Return user + token
   ↓
9. If TOTP invalid:
   - Return 422 "Invalid MFA code"
   - Do NOT increment failed login attempts for invalid TOTP
   ↓
10. Frontend stores token and navigates to dashboard
```

**Token Expiration & Session Timeout:**

```
1. Token created with expires_at = now + 60 minutes
   ↓
2. Every API request checks:
   - Token hash matches database
   - expires_at > current time
   ↓
3. If expired:
   - Return 401 Unauthorized
   - Delete expired token from database
   ↓
4. Frontend receives 401:
   - Clear local token storage
   - Redirect to login page
   - Display "Session expired, please login again"
   ↓
5. No token refresh mechanism:
   - Deliberate security decision for PHI systems
   - HIPAA requires automatic session termination
   - User must re-authenticate after 60 minutes
```

### 3.3 Multi-Factor Authentication (MFA) Implementation

**Technology:** TOTP (Time-based One-Time Password) - RFC 6238

| Parameter | Value |
|-----------|-------|
| **Library** | PragmaRX Google2FA 9.0 |
| **Algorithm** | TOTP (Time-based One-Time Password) |
| **Hash Function** | SHA-1 (TOTP standard) |
| **Code Length** | 6 digits |
| **Time Step** | 30 seconds |
| **Window Tolerance** | ±1 period (allows for 30-second clock skew) |
| **Secret Length** | 160 bits (32 characters base32-encoded) |
| **QR Code Format** | `otpauth://totp/Camp%20Burnt%20Gin:{email}?secret={secret}&issuer=Camp%20Burnt%20Gin` |

**MFA Enrollment Flow:**

```
1. Authenticated user initiates MFA setup
   ↓
2. POST /api/mfa/setup
   ↓
3. Backend generates:
   - Cryptographically secure 160-bit secret
   - QR code URL (otpauth:// format)
   - Manual entry key (formatted with spaces for readability)
   ↓
4. Backend stores secret in users.mfa_secret (NOT yet enabled)
   ↓
5. Frontend receives:
   {
     "secret": "BASE32ENCODEDSECRETKEY",
     "qr_code_url": "otpauth://totp/...",
     "manual_entry_key": "XXXX XXXX XXXX XXXX"
   }
   ↓
6. Frontend displays:
   - QR code (render qr_code_url as QR image)
   - Manual entry key (for users who can't scan)
   - Instructions: "Scan with Google Authenticator, Authy, etc."
   ↓
7. User scans QR code with authenticator app
   ↓
8. Authenticator app displays 6-digit code
   ↓
9. User enters code into frontend verification form
   ↓
10. POST /api/mfa/verify
    - code: "123456"
   ↓
11. Backend validates code against secret:
    - If valid: Set mfa_enabled = true, mfa_verified_at = now
    - If invalid: Return 422 "Invalid MFA code"
   ↓
12. Frontend displays success message
    - "MFA enabled successfully"
    - "You will need your authenticator app for future logins"
```

**MFA Disable Flow:**

```
1. User requests to disable MFA
   ↓
2. Frontend collects:
   - Current password (security verification)
   - Current TOTP code (proof of possession)
   ↓
3. POST /api/mfa/disable
   - password: "current_password"
   - code: "123456"
   ↓
4. Backend validates:
   - Password matches current hashed password
   - TOTP code is valid for current secret
   ↓
5. If both valid:
   - Set mfa_enabled = false
   - Set mfa_secret = null
   - Set mfa_verified_at = null
   ↓
6. If invalid:
   - Return 422 with specific field errors
   ↓
7. Frontend displays confirmation
   - "MFA has been disabled"
   - Option to re-enable
```

### 3.4 Password Security Architecture

**Password Storage:**

| Aspect | Implementation |
|--------|----------------|
| **Hashing Algorithm** | bcrypt |
| **Cost Factor** | 12 (Laravel default, ~250ms to hash) |
| **Salt** | Unique random salt per password (bcrypt built-in) |
| **Hash Length** | 60 characters (bcrypt output format) |
| **Plaintext Storage** | Never stored, never recoverable |

**Password Validation Rules:**

| Rule | Requirement | Error Message |
|------|-------------|---------------|
| **Minimum Length** | 12 characters | "The password must be at least 12 characters." |
| **Uppercase** | At least one uppercase letter | "The password must contain at least one uppercase letter." |
| **Lowercase** | At least one lowercase letter | "The password must contain at least one lowercase letter." |
| **Number** | At least one digit | "The password must contain at least one number." |
| **Symbol** | At least one special character | "The password must contain at least one symbol." |
| **Confirmation** | Must match password_confirmation field | "The password confirmation does not match." |
| **Compromised Check** | Not in haveibeenpwned database | "The password has appeared in a data leak. Please choose a different password." |

**Password Reset Flow:**

```
1. User clicks "Forgot Password" on login page
   ↓
2. Frontend displays email input form
   ↓
3. POST /api/auth/forgot-password
   - email: "user@example.com"
   ↓
4. Backend processes:
   - Lookup user by email (if not found, still return 200 to prevent enumeration)
   - Generate cryptographically secure 64-character token
   - Hash token with SHA-256
   - Store hashed token in password_reset_tokens table
   - Set expiration = now + 60 minutes
   ↓
5. Backend sends email with reset link:
   - URL: https://app.campburntgin.org/reset-password?token={plaintext_token}&email={email}
   ↓
6. Frontend always displays: "If email exists, reset link sent"
   - Security: Prevents email enumeration
   ↓
7. User clicks link in email
   ↓
8. Frontend extracts token and email from URL
   ↓
9. Frontend displays password reset form:
   - Email (pre-filled, read-only)
   - New password (with strength indicator)
   - Confirm password
   ↓
10. POST /api/auth/reset-password
    - email
    - token (from URL)
    - password
    - password_confirmation
   ↓
11. Backend validates:
    - Token exists and matches hashed value
    - Token not expired (expires_at > now)
    - Password meets complexity requirements
   ↓
12. If valid:
    - Update user password with new bcrypt hash
    - Delete used token from password_reset_tokens
    - Revoke all existing API tokens (force re-login)
    - Return 200 success
   ↓
13. If invalid:
    - Return 422 "Invalid or expired token"
   ↓
14. Frontend redirects to login with success message
```

### 3.5 Account Lockout Mechanism

**Lockout Policy:**

| Parameter | Value | Purpose |
|-----------|-------|---------|
| **Failed Attempt Threshold** | 5 attempts | Prevent brute force attacks |
| **Lockout Duration** | 15 minutes | Balance security with usability |
| **Counter Storage** | `users.failed_login_attempts` | Persistent tracking |
| **Lockout Timestamp** | `users.lockout_until` | Expiration time |
| **Reset Condition** | Successful login | Clear counter on success |

**Lockout Flow:**

```
1. User attempts login with incorrect password
   ↓
2. Backend increments failed_login_attempts
   ↓
3. If failed_login_attempts < 5:
   - Return 401 with remaining attempts
   - Response: { "message": "Invalid credentials", "attempts_remaining": 3 }
   ↓
4. If failed_login_attempts >= 5:
   - Set lockout_until = now + 15 minutes
   - Return 403 Forbidden
   - Response: {
       "success": false,
       "message": "Account locked due to too many failed attempts. Try again in 14 minute(s).",
       "lockout": true,
       "retry_after": 840  // seconds
     }
   ↓
5. Subsequent login attempts during lockout:
   - Check if lockout_until > now
   - Return 403 with updated retry_after countdown
   ↓
6. After 15 minutes:
   - Lockout expires automatically
   - User can attempt login again
   - Counter resets to 0 on successful login
```

### 3.6 Frontend Token Storage Strategy

**Critical Security Requirement:** PHI application requires secure token storage to prevent unauthorized access to Protected Health Information.

**Storage Options Analysis:**

| Storage Method | Security | XSS Vulnerability | CSRF Vulnerability | Persistence | Recommendation |
|----------------|----------|-------------------|-------------------|-------------|----------------|
| **localStorage** | Low | High (accessible to scripts) | None | Persists across sessions | ❌ Not recommended for PHI |
| **sessionStorage** | Low | High (accessible to scripts) | None | Clears on tab close | ❌ Not recommended for PHI |
| **httpOnly Cookie** | High | Immune (not accessible to JS) | Requires CSRF token | Persists until expiry | ✅ Recommended |
| **Memory Only** | High | Medium (cleared on refresh) | None | Lost on refresh | ⚠️ Poor UX |
| **Encrypted localStorage** | Medium-High | Medium (encryption key in memory) | None | Persists across sessions | ✅ Acceptable alternative |

**Recommended Strategy: httpOnly Cookie + CSRF Protection**

```javascript
// Backend sets cookie on login response:
Set-Cookie: token={token}; HttpOnly; Secure; SameSite=Strict; Max-Age=3600; Path=/

// Frontend axios configuration:
axios.defaults.withCredentials = true;
axios.defaults.xsrfCookieName = 'XSRF-TOKEN';
axios.defaults.xsrfHeaderName = 'X-XSRF-TOKEN';

// All requests automatically include cookie
// No manual token management needed
```

**Alternative Strategy: Encrypted localStorage (if cookies not feasible)**

```javascript
// Install crypto library: npm install crypto-js
import CryptoJS from 'crypto-js';

// Generate encryption key on login (store in memory only)
const encryptionKey = CryptoJS.lib.WordArray.random(256/8).toString();

// Encrypt token before storing
const encryptedToken = CryptoJS.AES.encrypt(token, encryptionKey).toString();
localStorage.setItem('auth_token_enc', encryptedToken);

// Store encryption key in sessionStorage (cleared on tab close)
sessionStorage.setItem('auth_key', encryptionKey);

// Decrypt when needed
const encryptedToken = localStorage.getItem('auth_token_enc');
const encryptionKey = sessionStorage.getItem('auth_key');
const decryptedToken = CryptoJS.AES.decrypt(encryptedToken, encryptionKey).toString(CryptoJS.enc.Utf8);

// Clear on logout
localStorage.removeItem('auth_token_enc');
sessionStorage.removeItem('auth_key');
```

### 3.7 Frontend Session Management Considerations

**Token Expiration Handling:**

```javascript
// Axios interceptor for 401 responses
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      store.dispatch('auth/logout'); // Clear user state
      router.push({
        name: 'login',
        query: {
          redirect: router.currentRoute.value.fullPath,
          reason: 'session_expired'
        }
      });
      // Display user-friendly message
      ElMessage.warning('Your session has expired. Please login again.');
    }
    return Promise.reject(error);
  }
);
```

**Session Timeout Warning (Optional UX Enhancement):**

```javascript
// Track last activity time
let lastActivityTime = Date.now();
const SESSION_DURATION = 60 * 60 * 1000; // 60 minutes in milliseconds
const WARNING_BEFORE_EXPIRY = 5 * 60 * 1000; // Warn 5 minutes before expiry

// Update on user activity
['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
  document.addEventListener(event, () => {
    lastActivityTime = Date.now();
  }, true);
});

// Check session expiry every minute
setInterval(() => {
  const timeRemaining = SESSION_DURATION - (Date.now() - lastActivityTime);

  if (timeRemaining <= 0) {
    // Session expired
    store.dispatch('auth/logout');
    router.push('/login?reason=timeout');
  } else if (timeRemaining <= WARNING_BEFORE_EXPIRY && !warningShown) {
    // Show warning dialog
    ElMessageBox.confirm(
      `Your session will expire in ${Math.ceil(timeRemaining / 60000)} minutes. Do you want to continue?`,
      'Session Expiring',
      {
        confirmButtonText: 'Stay Logged In',
        cancelButtonText: 'Logout',
        type: 'warning'
      }
    ).then(() => {
      // User clicked "Stay Logged In" - refresh token by making any API call
      axios.get('/api/user').then(() => {
        lastActivityTime = Date.now();
        warningShown = false;
      });
    }).catch(() => {
      // User clicked "Logout" or closed dialog
      store.dispatch('auth/logout');
      router.push('/login');
    });
    warningShown = true;
  }
}, 60000); // Check every minute
```

**Logout Implementation:**

```javascript
// Complete logout flow
async function logout() {
  try {
    // Call backend to revoke token
    await axios.post('/api/logout');
  } catch (error) {
    // Continue logout even if API call fails
    console.error('Logout API error:', error);
  } finally {
    // Clear all client-side state
    localStorage.clear();
    sessionStorage.clear();

    // Clear Vuex/Pinia store
    store.dispatch('auth/clearUser');
    store.dispatch('app/clearAllData');

    // Clear axios default headers
    delete axios.defaults.headers.common['Authorization'];

    // Navigate to login
    router.push('/login');
  }
}
```

### 3.8 Protected Route Implementation

**Vue Router Navigation Guard:**

```javascript
// router/index.js
import { useAuthStore } from '@/stores/auth';

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const requiredRole = to.meta.role;

  if (requiresAuth) {
    if (!authStore.isAuthenticated) {
      // Not logged in, redirect to login
      next({
        name: 'login',
        query: { redirect: to.fullPath }
      });
      return;
    }

    // Verify token is still valid by checking user data
    if (!authStore.user) {
      try {
        await authStore.fetchUser(); // GET /api/user
      } catch (error) {
        // Token invalid or expired
        authStore.logout();
        next({
          name: 'login',
          query: { redirect: to.fullPath, reason: 'invalid_session' }
        });
        return;
      }
    }

    // Check role-based access
    if (requiredRole && !authStore.hasRole(requiredRole)) {
      next({
        name: 'forbidden',
        params: { message: 'You do not have permission to access this page.' }
      });
      return;
    }

    next();
  } else {
    // Public route
    next();
  }
});
```

**Route Definitions with Meta:**

```javascript
const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/admin/AdminDashboard.vue'),
    meta: {
      requiresAuth: true,
      role: 'admin'
    }
  },
  {
    path: '/applications/:id/review',
    name: 'application-review',
    component: () => import('@/views/admin/ApplicationReview.vue'),
    meta: {
      requiresAuth: true,
      role: 'admin'
    }
  }
];
```

### 3.9 Account Lockout UX Implementation

**Login Form with Lockout Display:**

```vue
<template>
  <div v-if="lockoutInfo.isLocked" class="alert alert-danger">
    <i class="fas fa-lock"></i>
    <p>
      Account locked due to too many failed login attempts.
      <br>
      Please try again in <strong>{{ lockoutInfo.minutesRemaining }} minute(s)</strong>.
    </p>
    <el-progress
      :percentage="lockoutInfo.percentageRemaining"
      :status="lockoutInfo.percentageRemaining < 20 ? 'success' : 'exception'"
    />
  </div>

  <el-form v-else @submit.prevent="handleLogin">
    <!-- Login form fields -->
  </el-form>
</template>

<script setup>
import { ref, computed } from 'vue';
import axios from 'axios';

const lockoutInfo = ref({
  isLocked: false,
  retryAfter: 0,
  minutesRemaining: 0,
  percentageRemaining: 0
});

async function handleLogin() {
  try {
    const response = await axios.post('/api/auth/login', loginForm);
    // Success handling
  } catch (error) {
    if (error.response?.status === 403 && error.response.data.lockout) {
      // Account locked
      const retryAfter = error.response.data.retry_after; // seconds
      lockoutInfo.value = {
        isLocked: true,
        retryAfter: retryAfter,
        minutesRemaining: Math.ceil(retryAfter / 60),
        percentageRemaining: (retryAfter / 900) * 100 // 900 = 15 minutes in seconds
      };

      // Start countdown timer
      const countdownInterval = setInterval(() => {
        lockoutInfo.value.retryAfter--;
        lockoutInfo.value.minutesRemaining = Math.ceil(lockoutInfo.value.retryAfter / 60);
        lockoutInfo.value.percentageRemaining = (lockoutInfo.value.retryAfter / 900) * 100;

        if (lockoutInfo.value.retryAfter <= 0) {
          clearInterval(countdownInterval);
          lockoutInfo.value.isLocked = false;
        }
      }, 1000);
    } else if (error.response?.status === 401) {
      // Invalid credentials
      ElMessage.error(error.response.data.message || 'Invalid credentials');
    }
  }
}
</script>
```

### 3.10 MFA Challenge UI Implementation

**MFA Code Input Component:**

```vue
<template>
  <div v-if="mfaRequired" class="mfa-challenge">
    <h3>Two-Factor Authentication</h3>
    <p>Enter the 6-digit code from your authenticator app</p>

    <div class="code-input-group">
      <input
        v-for="(digit, index) in 6"
        :key="index"
        ref="codeInputs"
        v-model="mfaCode[index]"
        type="text"
        inputmode="numeric"
        maxlength="1"
        class="code-digit"
        @input="handleInput(index, $event)"
        @keydown="handleKeydown(index, $event)"
        @paste="handlePaste"
      />
    </div>

    <el-button
      type="primary"
      @click="verifyMFA"
      :loading="loading"
      :disabled="mfaCode.join('').length !== 6"
    >
      Verify Code
    </el-button>

    <p class="help-text">
      <i class="fas fa-info-circle"></i>
      Codes expire every 30 seconds. If code doesn't work, wait for new code.
    </p>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';

const mfaRequired = ref(false);
const mfaCode = ref(['', '', '', '', '', '']);
const codeInputs = ref([]);
const loading = ref(false);

function handleInput(index, event) {
  const value = event.target.value;

  // Only allow digits
  if (!/^\d*$/.test(value)) {
    mfaCode.value[index] = '';
    return;
  }

  // Auto-focus next input
  if (value && index < 5) {
    nextTick(() => {
      codeInputs.value[index + 1]?.focus();
    });
  }

  // Auto-submit when all 6 digits entered
  if (index === 5 && value) {
    verifyMFA();
  }
}

function handleKeydown(index, event) {
  // Handle backspace
  if (event.key === 'Backspace' && !mfaCode.value[index] && index > 0) {
    nextTick(() => {
      codeInputs.value[index - 1]?.focus();
    });
  }
}

function handlePaste(event) {
  event.preventDefault();
  const pastedData = event.clipboardData.getData('text').replace(/\D/g, '');

  if (pastedData.length === 6) {
    mfaCode.value = pastedData.split('');
    nextTick(() => {
      codeInputs.value[5]?.focus();
      verifyMFA();
    });
  }
}

async function verifyMFA() {
  loading.value = true;
  try {
    const code = mfaCode.value.join('');
    const response = await axios.post('/api/auth/login', {
      email: email.value,
      password: password.value,
      mfa_code: code
    });

    // Success - store token and redirect
    authStore.setToken(response.data.token);
    authStore.setUser(response.data.user);
    router.push('/dashboard');
  } catch (error) {
    ElMessage.error('Invalid MFA code. Please try again.');
    mfaCode.value = ['', '', '', '', '', ''];
    nextTick(() => {
      codeInputs.value[0]?.focus();
    });
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.code-input-group {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin: 20px 0;
}

.code-digit {
  width: 50px;
  height: 60px;
  text-align: center;
  font-size: 24px;
  font-weight: bold;
  border: 2px solid #dcdfe6;
  border-radius: 8px;
  transition: border-color 0.3s;
}

.code-digit:focus {
  border-color: #409eff;
  outline: none;
}
</style>
```

---

## 4. Role-Based Access Control (RBAC) Implications

### 4.1 Role Definitions and User Distribution

The backend implements a three-tier role system enforced at the database level through the `roles` table and foreign key constraint on `users.role_id`.

| Role ID | Role Code | Display Name | Default Assignment | Target Users |
|---------|-----------|--------------|-------------------|--------------|
| 1 | `admin` | Administrator | Manual (seeder/database) | Camp staff, system administrators |
| 2 | `parent` | Parent/Guardian | Automatic on registration | Parents and legal guardians |
| 3 | `medical` | Medical Provider | Manual (database only) | Internal medical staff with system accounts |

**Important Distinction:** External medical providers (e.g., camper's personal physician) do NOT receive user accounts. They access the system via time-limited, single-use secure tokens (`medical_provider_links` table). The `medical` role is reserved for internal camp medical staff who review all campers' health information.

### 4.2 Comprehensive Permission Matrix

This matrix defines exact CRUD (Create, Read, Update, Delete) permissions for each role across all system resources. Frontend must enforce these permissions through route guards, UI element visibility, and API request authorization.

#### 4.2.1 Camper Management Permissions

| Operation | Admin | Parent | Medical | Frontend Implementation |
|-----------|-------|--------|---------|------------------------|
| **List all campers** | ✅ Full access | ✅ Own campers only | ❌ No access | Filter UI: Admin sees all, Parent filtered by `user_id` |
| **View camper details** | ✅ Any camper | ✅ Own campers only | ❌ No access | Route guard: Check ownership on `:id` routes |
| **Create camper** | ✅ For any user | ✅ For self only | ❌ No access | UI: Both can create, Admin can specify `user_id` |
| **Update camper** | ✅ Any camper | ✅ Own campers only | ❌ No access | Edit form: Disable if not owner (unless admin) |
| **Delete camper** | ✅ Any camper (soft delete) | ✅ Own campers only | ❌ No access | Delete button: Show only if authorized |
| **View risk summary** | ✅ Yes | ❌ No | ✅ Yes | Route: `/campers/:id/risk-summary` - Admin/Medical only |
| **View compliance status** | ✅ Yes | ❌ No | ❌ No | Route: `/campers/:id/compliance-status` - Admin only |

**Frontend Scoping Example:**

```javascript
// Vuex/Pinia getter for accessible campers
const accessibleCampers = computed(() => {
  if (authStore.isAdmin) {
    return campersStore.allCampers; // Admin sees all
  } else if (authStore.isParent) {
    return campersStore.allCampers.filter(c => c.user_id === authStore.user.id); // Parent sees own
  } else {
    return []; // Medical has no camper access
  }
});
```

#### 4.2.2 Application Management Permissions

| Operation | Admin | Parent | Medical | Frontend Implementation |
|-----------|-------|--------|---------|------------------------|
| **List applications** | ✅ All applications | ✅ Own campers' applications | ❌ No access | Filter: Admin all, Parent `camper.user_id = auth.id` |
| **View application details** | ✅ Any application | ✅ Own campers' applications | ❌ No access | Route guard: Check camper ownership |
| **Create application (draft)** | ✅ For any camper | ✅ For own campers | ❌ No access | Camper dropdown: Filtered by accessible campers |
| **Update application** | ✅ Any application | ✅ Own (if pending/under_review) | ❌ No access | Edit enabled: Check status + ownership |
| **Sign application** | ✅ Any application | ✅ Own campers' applications | ❌ No access | Signature pad: Show if authorized |
| **Submit application** | ✅ Any application | ✅ Own (after signing) | ❌ No access | Submit button: Enabled after signature |
| **Review application** | ✅ Yes (approve/reject/waitlist) | ❌ No | ❌ No | Review interface: Admin-only route `/admin/applications/:id/review` |
| **Delete application** | ✅ Any application | ❌ No (can cancel instead) | ❌ No | Delete button: Admin only |
| **Cancel application** | ✅ Any application | ✅ Own (if not final status) | ❌ No | Cancel button: Show if not final (approved/rejected/cancelled) |
| **Search/Filter applications** | ✅ All filters | ✅ Own campers only | ❌ No access | Search UI: Admin sees all statuses, Parent limited |

**Application Status-Based UI Rules:**

```javascript
// Determine if application is editable
function isApplicationEditable(application) {
  const authStore = useAuthStore();

  // Final statuses cannot be edited
  if (['approved', 'rejected', 'cancelled'].includes(application.status)) {
    return false;
  }

  // Admin can edit any non-final application
  if (authStore.isAdmin) {
    return true;
  }

  // Parent can edit own pending or under_review applications
  if (authStore.isParent) {
    const ownsApplication = application.camper?.user_id === authStore.user.id;
    const editableStatus = ['pending', 'under_review'].includes(application.status);
    return ownsApplication && editableStatus && !application.is_draft;
  }

  return false;
}
```

#### 4.2.3 Medical Information Permissions

| Operation | Admin | Parent | Medical | Frontend Implementation |
|-----------|-------|--------|---------|------------------------|
| **List all medical records** | ✅ Yes | ❌ No (own only via camper) | ✅ Yes | Medical Records route: Admin/Medical only |
| **View medical record** | ✅ Any record | ✅ Own campers' records | ✅ Any record | Detail view: Check role + ownership |
| **Create medical record** | ✅ For any camper | ✅ For own campers | ❌ No (read-only) | Create form: Admin/Parent only |
| **Update medical record** | ✅ Any record | ✅ Own campers' records | ✅ Any record (limited fields) | Edit form: Medical can update but not delete |
| **Delete medical record** | ✅ Any record | ❌ No | ❌ No | Delete button: Admin only |
| **List all allergies** | ✅ Yes | ❌ No | ✅ Yes | Allergies list route: Admin/Medical only |
| **View allergy** | ✅ Any allergy | ✅ Own campers' allergies | ✅ Any allergy | Detail view: Check role + ownership |
| **Create allergy** | ✅ For any camper | ✅ For own campers | ✅ For any camper | Add button: All roles can create |
| **Update allergy** | ✅ Any allergy | ✅ Own campers' allergies | ✅ Any allergy | Edit form: All roles can update |
| **Delete allergy** | ✅ Any allergy | ✅ Own campers' allergies | ❌ No | Delete button: Admin/Parent only (Medical cannot delete) |
| **List all medications** | ✅ Yes | ❌ No | ✅ Yes | Medications list route: Admin/Medical only |
| **View medication** | ✅ Any medication | ✅ Own campers' medications | ✅ Any medication | Detail view: Check role + ownership |
| **Create medication** | ✅ For any camper | ✅ For own campers | ✅ For any camper | Add button: All roles can create |
| **Update medication** | ✅ Any medication | ✅ Own campers' medications | ✅ Any medication | Edit form: All roles can update |
| **Delete medication** | ✅ Any medication | ✅ Own campers' medications | ❌ No | Delete button: Admin/Parent only (Medical cannot delete) |
| **List emergency contacts** | ✅ Yes | ❌ No | ✅ Yes | Contacts list route: Admin/Medical only |
| **View emergency contact** | ✅ Any contact | ✅ Own campers' contacts | ✅ Any contact | Detail view: Check role + ownership |
| **Create emergency contact** | ✅ For any camper | ✅ For own campers | ❌ No | Add button: Admin/Parent only |
| **Update emergency contact** | ✅ Any contact | ✅ Own campers' contacts | ❌ No | Edit form: Admin/Parent only |
| **Delete emergency contact** | ✅ Any contact | ✅ Own campers' contacts | ❌ No | Delete button: Admin/Parent only |

**Critical Security Note:** Medical providers (role `medical`) have intentionally limited write permissions. They can CREATE and UPDATE allergies/medications to document health concerns, but CANNOT DELETE them. This design prevents accidental or malicious removal of critical health information. Only parents and admins can delete medical records.

#### 4.2.4 Document Management Permissions

| Operation | Admin | Parent | Medical | Frontend Implementation |
|-----------|-------|--------|---------|------------------------|
| **List documents** | ✅ All documents | ✅ Own documents only | ❌ No access | Documents list: Filter by ownership |
| **View document metadata** | ✅ Any document | ✅ Own documents | ❌ No access | Metadata view: Check ownership |
| **Upload document** | ✅ For any entity | ✅ For own entities | ❌ No (use provider links) | Upload UI: Admin/Parent only |
| **Download document** | ✅ Any document (even unscanned) | ✅ Own (if `scan_passed = true`) | ❌ No access | Download button: Check `scan_passed` flag for non-admins |
| **Delete document** | ✅ Any document | ✅ Own documents | ❌ No access | Delete button: Check ownership |

**Document Security Frontend Logic:**

```javascript
function canDownloadDocument(document) {
  const authStore = useAuthStore();

  // Admin can download any document, even unscanned
  if (authStore.isAdmin) {
    return true;
  }

  // Check ownership
  const ownsDocument = document.uploaded_by === authStore.user.id;
  if (!ownsDocument) {
    return false;
  }

  // Non-admin must wait for security scan to pass
  if (document.scan_passed === null) {
    return false; // Still scanning
  }

  if (document.scan_passed === false) {
    return false; // Failed scan, quarantined
  }

  return true; // Passed scan
}
```

#### 4.2.5 Medical Provider Link Permissions

| Operation | Admin | Parent | Medical | Frontend Implementation |
|-----------|-------|--------|---------|------------------------|
| **List provider links** | ✅ All links | ✅ Own campers' links | ❌ No access | Links list: Filter by camper ownership |
| **View link details** | ✅ Any link | ✅ Own campers' links | ❌ No access | Detail view: Check camper ownership |
| **Create provider link** | ✅ For any camper | ✅ For own campers | ❌ No access | Create form: Specify provider email, message |
| **Revoke provider link** | ✅ Any link | ✅ Own campers' links | ❌ No access | Revoke button: Show if not already revoked/used |
| **Resend provider link** | ✅ Any link (regenerates token) | ❌ No | ❌ No | Resend button: Admin only |
| **Access via token (public)** | N/A | N/A | N/A | Public route `/provider/{token}` - no auth required |

#### 4.2.6 Reporting Permissions

| Operation | Admin | Parent | Medical | Frontend Implementation |
|-----------|-------|--------|---------|------------------------|
| **Applications report** | ✅ Yes | ❌ No | ❌ No | Route: `/admin/reports/applications` - Admin only |
| **Accepted applicants list** | ✅ Yes | ❌ No | ❌ No | Route: `/admin/reports/accepted` - Admin only |
| **Rejected applicants list** | ✅ Yes | ❌ No | ❌ No | Route: `/admin/reports/rejected` - Admin only |
| **Mailing labels** | ✅ Yes | ❌ No | ❌ No | Route: `/admin/reports/mailing-labels` - Admin only |
| **ID badge labels** | ✅ Yes | ❌ No | ❌ No | Route: `/admin/reports/id-labels` - Admin only |

#### 4.2.7 Camp & Session Management Permissions

| Operation | Admin | Parent | Medical | Frontend Implementation |
|-----------|-------|--------|---------|------------------------|
| **List camps** | ✅ Full access | ✅ Read-only (active camps) | ❌ No access | Camp selection: Parent sees active only |
| **View camp details** | ✅ Yes | ✅ Yes (active camps) | ❌ No access | Camp detail page: Public info for parents |
| **Create camp** | ✅ Yes | ❌ No | ❌ No | Create form: Admin-only route |
| **Update camp** | ✅ Yes | ❌ No | ❌ No | Edit form: Admin-only |
| **Delete camp** | ✅ Yes | ❌ No | ❌ No | Delete button: Admin-only |
| **List sessions** | ✅ Full access | ✅ Read-only (active sessions) | ❌ No access | Session selection: Parent sees active only |
| **View session details** | ✅ Yes | ✅ Yes (active sessions) | ❌ No access | Session detail: Public info for parents |
| **Create session** | ✅ Yes | ❌ No | ❌ No | Create form: Admin-only route |
| **Update session** | ✅ Yes | ❌ No | ❌ No | Edit form: Admin-only |
| **Delete session** | ✅ Yes | ❌ No | ❌ No | Delete button: Admin-only |

### 4.3 Role → Page → Component Mapping

This section maps user roles to accessible pages and the specific components that must be conditionally rendered based on permissions.

#### 4.3.1 Administrator Role (`admin`)

**Accessible Pages:**

| Page Route | Component | Purpose |
|------------|-----------|---------|
| `/dashboard` | `AdminDashboard.vue` | Overview of applications, pending reviews, statistics |
| `/applications` | `ApplicationList.vue` | All applications with advanced filtering |
| `/applications/:id` | `ApplicationDetail.vue` | Full application details with review actions |
| `/applications/:id/review` | `ApplicationReview.vue` | Approve/reject/waitlist interface |
| `/campers` | `CamperList.vue` | All campers with search |
| `/campers/:id` | `CamperDetail.vue` | Camper profile with medical info |
| `/campers/:id/risk-summary` | `RiskSummary.vue` | Risk assessment dashboard |
| `/campers/:id/compliance-status` | `ComplianceStatus.vue` | Compliance checklist |
| `/medical-records` | `MedicalRecordList.vue` | All medical records |
| `/medical-records/:id` | `MedicalRecordDetail.vue` | Detailed medical information |
| `/camps` | `CampManagement.vue` | Create/edit/delete camps |
| `/sessions` | `SessionManagement.vue` | Create/edit/delete sessions |
| `/users` | `UserManagement.vue` | Manage user accounts |
| `/reports` | `ReportsHub.vue` | Access to all reports |
| `/reports/applications` | `ApplicationsReport.vue` | Applications report with filters |
| `/reports/accepted` | `AcceptedList.vue` | Accepted applicants |
| `/reports/rejected` | `RejectedList.vue` | Rejected applicants |
| `/reports/mailing-labels` | `MailingLabels.vue` | Generate mailing labels |
| `/reports/id-labels` | `IDLabels.vue` | Generate ID badge labels |
| `/provider-links` | `ProviderLinkManagement.vue` | View all provider links |
| `/documents` | `DocumentManagement.vue` | All documents with download (unscanned OK) |

**Conditionally Rendered Components:**

```vue
<!-- In ApplicationDetail.vue -->
<div v-if="authStore.isAdmin" class="admin-actions">
  <el-button type="primary" @click="reviewApplication">Review Application</el-button>
  <el-button type="danger" @click="deleteApplication">Delete</el-button>
</div>

<!-- In CamperList.vue -->
<el-table-column v-if="authStore.isAdmin" label="Parent">
  <template #default="{ row }">
    {{ row.user.name }} ({{ row.user.email }})
  </template>
</el-table-column>

<!-- In DocumentDetail.vue -->
<el-button
  v-if="authStore.isAdmin || document.scan_passed === true"
  type="primary"
  @click="downloadDocument"
>
  Download
</el-button>
<el-alert
  v-else-if="document.scan_passed === null"
  type="warning"
  :closable="false"
>
  Document is being scanned. Download will be available shortly.
</el-alert>
```

#### 4.3.2 Parent Role (`parent`)

**Accessible Pages:**

| Page Route | Component | Purpose |
|------------|-----------|---------|
| `/dashboard` | `ParentDashboard.vue` | Overview of own campers and applications |
| `/campers` | `CamperList.vue` | Own campers only |
| `/campers/create` | `CamperForm.vue` | Create new camper profile |
| `/campers/:id` | `CamperDetail.vue` | Own camper details (ownership verified) |
| `/campers/:id/edit` | `CamperForm.vue` | Edit own camper |
| `/campers/:id/medical` | `MedicalInformation.vue` | Manage own camper's medical info |
| `/applications` | `ApplicationList.vue` | Own campers' applications only |
| `/applications/create` | `ApplicationForm.vue` | Create application for own camper |
| `/applications/:id` | `ApplicationDetail.vue` | Own camper's application (ownership verified) |
| `/applications/:id/edit` | `ApplicationForm.vue` | Edit draft or pending application |
| `/applications/:id/sign` | `ApplicationSignature.vue` | Digital signature for own application |
| `/provider-links` | `ProviderLinkList.vue` | Own campers' provider links |
| `/provider-links/create` | `ProviderLinkForm.vue` | Create provider link for own camper |
| `/documents` | `DocumentList.vue` | Own documents only |
| `/camps` | `CampBrowse.vue` | View active camps (read-only) |
| `/sessions` | `SessionBrowse.vue` | View active sessions for registration |
| `/profile` | `UserProfile.vue` | Edit own profile and MFA settings |

**Conditionally Hidden Components:**

```vue
<!-- In ApplicationDetail.vue -->
<div v-if="!authStore.isAdmin" class="parent-view">
  <!-- No review actions -->
  <!-- No delete button -->
  <el-button
    v-if="canEdit"
    type="primary"
    @click="editApplication"
  >
    Edit Application
  </el-button>
  <el-button
    v-if="canSign"
    type="success"
    @click="signApplication"
  >
    Sign Application
  </el-button>
  <el-button
    v-if="canCancel"
    type="danger"
    @click="cancelApplication"
  >
    Cancel Application
  </el-button>
</div>

<!-- In CamperList.vue -->
<!-- No "Parent" column (parent sees own campers only) -->
<!-- No "Delete" action (soft delete not exposed to parents in UI) -->

<!-- In DocumentList.vue -->
<el-button
  v-if="document.scan_passed === true"
  type="primary"
  @click="downloadDocument"
>
  Download
</el-button>
<el-alert
  v-else-if="document.scan_passed === null"
  type="info"
>
  Document is being scanned for security. Please check back shortly.
</el-alert>
<el-alert
  v-else
  type="error"
>
  This document failed security scanning. Please contact support.
</el-alert>
```

#### 4.3.3 Medical Provider Role (`medical`)

**Note:** Medical providers with user accounts have very limited UI access. Most medical data is submitted via unauthenticated provider links.

**Accessible Pages:**

| Page Route | Component | Purpose |
|------------|-----------|---------|
| `/dashboard` | `MedicalDashboard.vue` | Overview of medical data |
| `/medical-records` | `MedicalRecordList.vue` | All medical records (read-mostly) |
| `/medical-records/:id` | `MedicalRecordDetail.vue` | View medical record details |
| `/medical-records/:id/edit` | `MedicalRecordForm.vue` | Update medical information (limited) |
| `/allergies` | `AllergyList.vue` | All allergies |
| `/medications` | `MedicationList.vue` | All medications |
| `/emergency-contacts` | `EmergencyContactList.vue` | All emergency contacts (read-only) |
| `/campers/:id/risk-summary` | `RiskSummary.vue` | View risk assessment |

**Restricted Actions:**

```vue
<!-- In MedicalRecordDetail.vue -->
<div class="medical-provider-actions">
  <!-- Can update but not delete -->
  <el-button type="primary" @click="editRecord">Update Information</el-button>
  <!-- No delete button for medical role -->
</div>

<!-- In AllergyList.vue -->
<el-table-column label="Actions">
  <template #default="{ row }">
    <el-button size="small" @click="viewAllergy(row)">View</el-button>
    <el-button size="small" @click="editAllergy(row)">Edit</el-button>
    <!-- No delete button for medical role -->
  </template>
</el-table-column>
```

### 4.4 Frontend Route Protection Strategy

**Complete Route Guard Implementation:**

```javascript
// router/guards.js
import { useAuthStore } from '@/stores/auth';

export function setupRouteGuards(router) {
  router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore();
    const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
    const requiredRole = to.meta.role;
    const requiredRoles = to.meta.roles; // Array of allowed roles
    const requiresOwnership = to.meta.requiresOwnership;

    // Public routes - allow access
    if (!requiresAuth) {
      // If logged in and accessing login page, redirect to dashboard
      if (to.name === 'login' && authStore.isAuthenticated) {
        next({ name: 'dashboard' });
        return;
      }
      next();
      return;
    }

    // Protected routes - check authentication
    if (!authStore.isAuthenticated) {
      next({
        name: 'login',
        query: { redirect: to.fullPath }
      });
      return;
    }

    // Verify user data is loaded
    if (!authStore.user) {
      try {
        await authStore.fetchUser();
      } catch (error) {
        authStore.logout();
        next({
          name: 'login',
          query: { redirect: to.fullPath, reason: 'session_expired' }
        });
        return;
      }
    }

    // Check single role requirement
    if (requiredRole && !authStore.hasRole(requiredRole)) {
      next({
        name: 'forbidden',
        params: {
          message: `This page requires ${requiredRole} role.`
        }
      });
      return;
    }

    // Check multiple role requirement (any of)
    if (requiredRoles && !authStore.hasAnyRole(requiredRoles)) {
      next({
        name: 'forbidden',
        params: {
          message: `This page requires one of: ${requiredRoles.join(', ')}.`
        }
      });
      return;
    }

    // Check ownership requirement (for detail routes)
    if (requiresOwnership) {
      const resourceId = to.params.id;
      const resourceType = to.meta.resourceType; // 'camper', 'application', etc.

      // Admin bypasses ownership checks
      if (!authStore.isAdmin) {
        try {
          const owns = await authStore.checkOwnership(resourceType, resourceId);
          if (!owns) {
            next({
              name: 'forbidden',
              params: {
                message: 'You do not have permission to access this resource.'
              }
            });
            return;
          }
        } catch (error) {
          next({
            name: 'not-found',
            params: { message: 'Resource not found.' }
          });
          return;
        }
      }
    }

    // All checks passed
    next();
  });
}
```

**Route Definitions with RBAC Metadata:**

```javascript
const routes = [
  // Public routes
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/auth/Register.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/views/auth/ResetPassword.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/provider/:token',
    name: 'provider-access',
    component: () => import('@/views/provider/ProviderForm.vue'),
    meta: { requiresAuth: false, layout: 'provider' }
  },

  // Authenticated routes - any role
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/profile/UserProfile.vue'),
    meta: { requiresAuth: true }
  },

  // Parent routes
  {
    path: '/campers',
    name: 'campers',
    component: () => import('@/views/campers/CamperList.vue'),
    meta: {
      requiresAuth: true,
      roles: ['admin', 'parent'] // Admin or Parent
    }
  },
  {
    path: '/campers/:id',
    name: 'camper-detail',
    component: () => import('@/views/campers/CamperDetail.vue'),
    meta: {
      requiresAuth: true,
      roles: ['admin', 'parent'],
      requiresOwnership: true,
      resourceType: 'camper'
    }
  },
  {
    path: '/applications/:id/sign',
    name: 'application-sign',
    component: () => import('@/views/applications/ApplicationSignature.vue'),
    meta: {
      requiresAuth: true,
      roles: ['admin', 'parent'],
      requiresOwnership: true,
      resourceType: 'application'
    }
  },

  // Admin-only routes
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/admin/AdminDashboard.vue'),
    meta: {
      requiresAuth: true,
      role: 'admin'
    }
  },
  {
    path: '/admin/applications/:id/review',
    name: 'application-review',
    component: () => import('@/views/admin/ApplicationReview.vue'),
    meta: {
      requiresAuth: true,
      role: 'admin'
    }
  },
  {
    path: '/admin/reports',
    name: 'reports',
    component: () => import('@/views/admin/ReportsHub.vue'),
    meta: {
      requiresAuth: true,
      role: 'admin'
    }
  },
  {
    path: '/admin/camps',
    name: 'camp-management',
    component: () => import('@/views/admin/CampManagement.vue'),
    meta: {
      requiresAuth: true,
      role: 'admin'
    }
  },

  // Medical provider routes
  {
    path: '/medical/records',
    name: 'medical-records',
    component: () => import('@/views/medical/MedicalRecordList.vue'),
    meta: {
      requiresAuth: true,
      roles: ['admin', 'medical']
    }
  },
  {
    path: '/medical/allergies',
    name: 'allergies',
    component: () => import('@/views/medical/AllergyList.vue'),
    meta: {
      requiresAuth: true,
      roles: ['admin', 'medical']
    }
  },

  // Error pages
  {
    path: '/forbidden',
    name: 'forbidden',
    component: () => import('@/views/errors/Forbidden.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/errors/NotFound.vue'),
    meta: { requiresAuth: false }
  }
];
```

### 4.5 Component-Level Visibility Control

**Composable for Permission Checks:**

```javascript
// composables/usePermissions.js
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

export function usePermissions() {
  const authStore = useAuthStore();

  const can = {
    // Camper permissions
    viewAllCampers: computed(() => authStore.isAdmin),
    createCamper: computed(() => authStore.isAdmin || authStore.isParent),
    editCamper: (camper) => {
      if (authStore.isAdmin) return true;
      if (authStore.isParent) return camper.user_id === authStore.user.id;
      return false;
    },
    deleteCamper: (camper) => {
      if (authStore.isAdmin) return true;
      if (authStore.isParent) return camper.user_id === authStore.user.id;
      return false;
    },

    // Application permissions
    viewAllApplications: computed(() => authStore.isAdmin),
    createApplication: computed(() => authStore.isAdmin || authStore.isParent),
    editApplication: (application) => {
      if (authStore.isAdmin) return true;
      if (authStore.isParent) {
        const owns = application.camper?.user_id === authStore.user.id;
        const editable = !['approved', 'rejected', 'cancelled'].includes(application.status);
        return owns && editable;
      }
      return false;
    },
    signApplication: (application) => {
      if (authStore.isAdmin) return true;
      if (authStore.isParent) {
        const owns = application.camper?.user_id === authStore.user.id;
        const needsSignature = !application.signed_at;
        const notFinal = !['approved', 'rejected', 'cancelled'].includes(application.status);
        return owns && needsSignature && notFinal;
      }
      return false;
    },
    reviewApplication: computed(() => authStore.isAdmin),
    deleteApplication: computed(() => authStore.isAdmin),

    // Medical information permissions
    viewAllMedicalRecords: computed(() => authStore.isAdmin || authStore.isMedical),
    createMedicalRecord: computed(() => authStore.isAdmin || authStore.isParent),
    editMedicalRecord: (record) => {
      if (authStore.isAdmin || authStore.isMedical) return true;
      if (authStore.isParent) return record.camper?.user_id === authStore.user.id;
      return false;
    },
    deleteMedicalRecord: computed(() => authStore.isAdmin),

    createAllergy: computed(() => authStore.isAdmin || authStore.isParent || authStore.isMedical),
    editAllergy: computed(() => authStore.isAdmin || authStore.isParent || authStore.isMedical),
    deleteAllergy: (allergy) => {
      if (authStore.isAdmin) return true;
      if (authStore.isParent) return allergy.camper?.user_id === authStore.user.id;
      return false; // Medical cannot delete
    },

    // Document permissions
    uploadDocument: computed(() => authStore.isAdmin || authStore.isParent),
    downloadDocument: (document) => {
      if (authStore.isAdmin) return true; // Admin can download unscanned
      const owns = document.uploaded_by === authStore.user.id;
      return owns && document.scan_passed === true;
    },
    deleteDocument: (document) => {
      if (authStore.isAdmin) return true;
      return document.uploaded_by === authStore.user.id;
    },

    // Provider link permissions
    createProviderLink: computed(() => authStore.isAdmin || authStore.isParent),
    revokeProviderLink: (link) => {
      if (authStore.isAdmin) return true;
      if (authStore.isParent) return link.camper?.user_id === authStore.user.id;
      return false;
    },
    resendProviderLink: computed(() => authStore.isAdmin),

    // Reporting permissions
    viewReports: computed(() => authStore.isAdmin),

    // Camp management permissions
    manageCamps: computed(() => authStore.isAdmin),
    manageSessions: computed(() => authStore.isAdmin)
  };

  return { can };
}
```

**Usage in Components:**

```vue
<template>
  <div class="camper-detail">
    <h2>{{ camper.first_name }} {{ camper.last_name }}</h2>

    <!-- Edit button - conditionally rendered -->
    <el-button
      v-if="can.editCamper(camper)"
      type="primary"
      @click="editCamper"
    >
      Edit Camper
    </el-button>

    <!-- Delete button - admin or parent owner only -->
    <el-button
      v-if="can.deleteCamper(camper)"
      type="danger"
      @click="deleteCamper"
    >
      Delete Camper
    </el-button>

    <!-- Medical info section - hide if not authorized -->
    <div v-if="can.viewAllMedicalRecords || camper.user_id === authStore.user.id">
      <h3>Medical Information</h3>
      <!-- Medical data display -->
    </div>

    <!-- Admin-only section -->
    <div v-if="authStore.isAdmin" class="admin-panel">
      <h3>Administrative Actions</h3>
      <!-- Admin-specific UI -->
    </div>
  </div>
</template>

<script setup>
import { usePermissions } from '@/composables/usePermissions';
import { useAuthStore } from '@/stores/auth';

const { can } = usePermissions();
const authStore = useAuthStore();
const props = defineProps(['camper']);
</script>
```

### 4.6 Data Filtering in Frontend State

**Vuex/Pinia Store with Role-Based Filtering:**

```javascript
// stores/campers.js
import { defineStore } from 'pinia';
import { useAuthStore } from './auth';
import axios from 'axios';

export const useCampersStore = defineStore('campers', {
  state: () => ({
    allCampers: [], // Raw data from API
    loading: false,
    error: null
  }),

  getters: {
    // Filtered campers based on role
    accessibleCampers(state) {
      const authStore = useAuthStore();

      if (authStore.isAdmin) {
        return state.allCampers; // Admin sees all
      }

      if (authStore.isParent) {
        return state.allCampers.filter(
          camper => camper.user_id === authStore.user.id
        ); // Parent sees own only
      }

      return []; // Medical has no camper access
    },

    getCamperById: (state) => (id) => {
      const authStore = useAuthStore();
      const camper = state.allCampers.find(c => c.id === parseInt(id));

      if (!camper) return null;

      // Authorization check
      if (authStore.isAdmin) return camper;
      if (authStore.isParent && camper.user_id === authStore.user.id) return camper;

      return null; // Unauthorized access
    }
  },

  actions: {
    async fetchCampers() {
      this.loading = true;
      this.error = null;

      try {
        const response = await axios.get('/api/campers');
        // Backend already filters by role, but store all for consistency
        this.allCampers = response.data.data;
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to load campers';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchCamper(id) {
      this.loading = true;
      this.error = null;

      try {
        const response = await axios.get(`/api/campers/${id}`);

        // Update or add to allCampers
        const index = this.allCampers.findIndex(c => c.id === response.data.id);
        if (index >= 0) {
          this.allCampers[index] = response.data;
        } else {
          this.allCampers.push(response.data);
        }

        return response.data;
      } catch (error) {
        if (error.response?.status === 403) {
          this.error = 'You do not have permission to view this camper.';
        } else if (error.response?.status === 404) {
          this.error = 'Camper not found.';
        } else {
          this.error = error.response?.data?.message || 'Failed to load camper';
        }
        throw error;
      } finally {
        this.loading = false;
      }
    }
  }
});
```

### 4.7 Critical Security Implementation Notes

**1. Never Trust Client-Side Authorization:**
- Frontend RBAC enforcement is for UX only (hide irrelevant UI)
- Backend always validates permissions server-side
- Malicious users can bypass client-side checks
- Always expect 403 Forbidden responses and handle gracefully

**2. Avoid Exposing Unauthorized Data:**
- Do not fetch data user cannot access "just in case"
- Filter dropdown options to only show authorized choices (e.g., camper selection)
- Clear sensitive data from store on logout

**3. URL Parameter Security:**
- Never expose sensitive IDs in query parameters
- Use route parameters for resource IDs: `/campers/:id` (better than `/campers?id=123`)
- Backend validates ownership on every request, frontend should prevent unauthorized navigation

**4. Conditional Rendering Best Practices:**
```vue
<!-- GOOD: Hide UI element completely -->
<el-button v-if="can.deleteApplication" @click="delete">Delete</el-button>

<!-- BAD: Disable but show UI element (hints at hidden functionality) -->
<el-button :disabled="!can.deleteApplication" @click="delete">Delete</el-button>
```

**5. Global Error Handling for Authorization:**
```javascript
// axios interceptors
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 403) {
      ElMessage.error('You do not have permission to perform this action.');
      router.push({ name: 'forbidden', params: {
        message: error.response.data.message
      }});
    }
    return Promise.reject(error);
  }
);
```

---

## 5. Application Workflow Mapping

The application lifecycle in the Camp Burnt Gin system follows a strict state machine with defined transitions, validation requirements, and notification triggers. This section maps the complete workflow from draft creation through final decision, documenting backend state, required frontend state, UI views, notifications, and edge cases for each stage.

### 5.1 Application State Machine

The backend implements a six-state application workflow with defined transitions:

**States:**
1. **Pending** (`pending`) - Initial state, draft mode enabled
2. **Under Review** (`under_review`) - Submitted and awaiting administrative review
3. **Approved** (`approved`) - **FINAL** - Accepted for camp attendance
4. **Rejected** (`rejected`) - **FINAL** - Application denied
5. **Waitlisted** (`waitlisted`) - Placed on waiting list, may transition to approved or rejected
6. **Cancelled** (`cancelled`) - **FINAL** - Cancelled by parent

**State Transition Diagram (Text Form):**

```
┌──────────────┐
│   PENDING    │ (is_draft = true, status = pending)
│  (Draft)     │
└──────┬───────┘
       │
       │ ACTION: Parent sets is_draft = false (requires signature)
       │ TRIGGER: PUT /api/applications/{id}
       │ VALIDATION: signature_data, signature_name, signed_at must be present
       │
       ▼
┌──────────────┐
│ UNDER REVIEW │ (is_draft = false, status = under_review, submitted_at set)
│              │
└──────┬───────┘
       │
       │ ACTION: Admin reviews application
       │ TRIGGER: POST /api/applications/{id}/review
       │
       ├───► APPROVED (FINAL - cannot be changed)
       │     - Sets: reviewed_at, reviewed_by, notes (optional)
       │     - Triggers: Acceptance letter email + notification
       │
       ├───► REJECTED (FINAL - cannot be changed)
       │     - Sets: reviewed_at, reviewed_by, notes (required)
       │     - Triggers: Rejection letter email + notification
       │
       └───► WAITLISTED (can transition to approved or rejected later)
             - Sets: reviewed_at, reviewed_by, notes (optional)
             - Triggers: Waitlist notification email
             └──────┬─────────
                    │
                    │ ACTION: Admin reviews again (space available or final decision)
                    │
                    ├───► APPROVED (FINAL)
                    └───► REJECTED (FINAL)

┌─────────────────────────────────────────────┐
│  CANCELLED (FINAL)                           │
│                                             │
│  From: Any non-final state                  │
│  ACTION: Parent cancels application         │
│  TRIGGER: PUT /api/applications/{id}        │
│  Sets: status = cancelled                   │
│  Notification: Admin notified               │
└─────────────────────────────────────────────┘
```

### 5.2 Draft Creation and Saving

**Stage:** Initial Application Creation

**Backend State:**
- `status` = `pending`
- `is_draft` = `true`
- `submitted_at` = `NULL`
- `reviewed_at` = `NULL`
- `signed_at` = `NULL`

**Required Frontend State:**

```javascript
{
  applicationForm: {
    id: null, // Will be set after creation
    camper_id: null, // User selects from dropdown
    camp_session_id: null, // User selects from dropdown
    is_draft: true,
    notes: '', // Optional parent notes
  },
  validationErrors: {},
  saveStatus: 'unsaved', // 'unsaved', 'saving', 'saved', 'error'
  lastSavedAt: null,
  isDirty: false // Track unsaved changes
}
```

**Required UI Views:**

1. **Application Create Form** (`/applications/create`)
   - Camper selection dropdown (filtered by accessible campers)
   - Camp session selection dropdown (filtered by active sessions, registration window open)
   - Notes textarea (optional)
   - "Save Draft" button (primary action)
   - "Cancel" button (navigates back)

2. **Auto-Save Indicator**
   - Visual indicator of save status
   - Last saved timestamp
   - "Saving..." spinner during API call

**Frontend Workflow:**

```javascript
// Auto-save implementation
let autoSaveTimer = null;

watch(
  () => applicationForm,
  () => {
    isDirty.value = true;
    saveStatus.value = 'unsaved';

    // Debounce auto-save
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      saveDraft();
    }, 3000); // Auto-save 3 seconds after last change
  },
  { deep: true }
);

async function saveDraft() {
  saveStatus.value = 'saving';
  validationErrors.value = {};

  try {
    const payload = {
      camper_id: applicationForm.camper_id,
      camp_session_id: applicationForm.camp_session_id,
      is_draft: true,
      notes: applicationForm.notes
    };

    let response;
    if (applicationForm.id) {
      // Update existing draft
      response = await axios.put(`/api/applications/${applicationForm.id}`, payload);
    } else {
      // Create new draft
      response = await axios.post('/api/applications', payload);
      applicationForm.id = response.data.id;
    }

    saveStatus.value = 'saved';
    lastSavedAt.value = new Date();
    isDirty.value = false;

    ElMessage.success('Draft saved', { duration: 2000 });
  } catch (error) {
    saveStatus.value = 'error';
    if (error.response?.status === 422) {
      validationErrors.value = error.response.data.errors;
      ElMessage.error('Validation error: ' + Object.values(error.response.data.errors).flat().join(', '));
    } else if (error.response?.data?.errors?.camper_id?.[0]?.includes('already has an application')) {
      ElMessage.error('This camper already has an application for this session.');
      router.push({ name: 'applications' });
    } else {
      ElMessage.error('Failed to save draft. Please try again.');
    }
  }
}

// Manual save button
async function saveAndExit() {
  await saveDraft();
  if (saveStatus.value === 'saved') {
    router.push({ name: 'applications' });
  }
}

// Warn user before leaving with unsaved changes
onBeforeRouteLeave((to, from, next) => {
  if (isDirty.value) {
    ElMessageBox.confirm(
      'You have unsaved changes. Do you want to save before leaving?',
      'Unsaved Changes',
      {
        confirmButtonText: 'Save and Leave',
        cancelButtonText: 'Leave Without Saving',
        type: 'warning'
      }
    ).then(async () => {
      await saveDraft();
      next();
    }).catch(() => {
      next(); // Leave without saving
    });
  } else {
    next();
  }
});
```

**Notifications:** None (draft saved locally, no email sent)

**Edge Cases:**
1. **Duplicate Application:** Camper already has application for session
   - Backend returns 422 with error: "This camper already has an application for this session."
   - Frontend displays error and prevents creation/update
2. **Registration Window Closed:** Session registration period expired
   - Backend returns 422 with error: "Registration is not currently open for this session."
   - Frontend should disable session selection for closed sessions
3. **Network Failure During Auto-Save:** API call fails
   - Frontend retries once after 5 seconds
   - If retry fails, displays "Failed to auto-save. Please save manually."
   - Keeps local state intact for manual retry

### 5.3 Resume Draft

**Stage:** Returning to Incomplete Application

**Backend State:**
- `is_draft` = `true`
- `status` = `pending`

**Required Frontend State:**

```javascript
{
  applicationId: 'from-route-params',
  application: null, // Loaded from API
  loading: true,
  error: null
}
```

**Required UI View:**

1. **Application Edit Form** (`/applications/:id/edit`)
   - Pre-populated with existing data
   - Same layout as create form
   - "Save Draft" button
   - "Continue to Signature" button (navigates to signature step)

**Frontend Workflow:**

```javascript
async function loadDraft() {
  loading.value = true;
  error.value = null;

  try {
    const response = await axios.get(`/api/applications/${route.params.id}`);
    application.value = response.data;

    // Populate form
    applicationForm.value = {
      id: application.value.id,
      camper_id: application.value.camper_id,
      camp_session_id: application.value.camp_session_id,
      is_draft: application.value.is_draft,
      notes: application.value.notes || ''
    };

    loading.value = false;
  } catch (error) {
    if (error.response?.status === 403) {
      error.value = 'You do not have permission to view this application.';
      router.push({ name: 'forbidden' });
    } else if (error.response?.status === 404) {
      error.value = 'Application not found.';
      router.push({ name: 'not-found' });
    } else {
      error.value = 'Failed to load application.';
    }
    loading.value = false;
  }
}

function continueToSignature() {
  // Validate that camper and session are selected
  if (!applicationForm.value.camper_id || !applicationForm.value.camp_session_id) {
    ElMessage.warning('Please select a camper and camp session before continuing.');
    return;
  }

  // Save draft before navigating
  saveDraft().then(() => {
    router.push({ name: 'application-sign', params: { id: application.value.id } });
  });
}
```

**Notifications:** None

**Edge Cases:**
1. **Application No Longer Draft:** User navigated to edit form for submitted application
   - Backend returns application with `is_draft = false`
   - Frontend detects and redirects to read-only view with message: "This application has been submitted and cannot be edited."
2. **Ownership Changed:** Admin transferred application to different user
   - Backend returns 403 Forbidden for parent user
   - Frontend redirects to applications list with error message

### 5.4 Digital Signature Collection

**Stage:** Parent Signs Application Before Submission

**Backend State:**
- Application exists with `is_draft = true`
- `signed_at` = `NULL` (before signature)
- After signature: `signature_data`, `signature_name`, `signed_at`, `signed_ip_address` populated

**Required Frontend State:**

```javascript
{
  applicationId: 'from-route-params',
  application: null,
  signature: {
    canvas: null, // HTML5 Canvas element ref
    signatureName: '', // Parent's full name
    signatureImage: '', // Base64 encoded PNG
    isSigned: false,
    isSubmitting: false
  },
  agreementAccepted: false, // Checkbox for terms
  validationErrors: {}
}
```

**Required UI View:**

1. **Signature Page** (`/applications/:id/sign`)
   - Application summary (read-only camper info, session info)
   - Terms and conditions checkbox
   - Signature canvas (HTML5 canvas or signature pad library)
   - "Clear" button to reset canvas
   - Text input for printed name
   - "Sign and Continue" button (enabled only if signature drawn, name entered, terms accepted)

**Frontend Implementation:**

```vue
<template>
  <div class="signature-page">
    <h2>Sign Application</h2>

    <!-- Application Summary -->
    <el-card class="summary-card">
      <h3>Application Summary</h3>
      <p><strong>Camper:</strong> {{ application.camper.first_name }} {{ application.camper.last_name }}</p>
      <p><strong>Camp Session:</strong> {{ application.camp_session.name }}</p>
      <p><strong>Dates:</strong> {{ formatDate(application.camp_session.start_date) }} - {{ formatDate(application.camp_session.end_date) }}</p>
    </el-card>

    <!-- Terms and Conditions -->
    <el-card class="terms-card">
      <h3>Terms and Conditions</h3>
      <div class="terms-content">
        <p>By signing this application, I certify that:</p>
        <ul>
          <li>All information provided is accurate and complete</li>
          <li>I am the legal parent or guardian of the camper</li>
          <li>I authorize camp staff to provide emergency medical treatment if needed</li>
          <li>I have reviewed and agree to the camp policies and procedures</li>
        </ul>
      </div>
      <el-checkbox v-model="agreementAccepted" size="large">
        I have read and agree to the terms and conditions
      </el-checkbox>
    </el-card>

    <!-- Signature Canvas -->
    <el-card class="signature-card">
      <h3>Signature</h3>
      <p>Please sign below using your mouse or touchscreen:</p>

      <div class="signature-container">
        <canvas
          ref="signatureCanvas"
          width="600"
          height="200"
          @mousedown="startDrawing"
          @mousemove="draw"
          @mouseup="stopDrawing"
          @mouseleave="stopDrawing"
          @touchstart="startDrawing"
          @touchmove="draw"
          @touchend="stopDrawing"
          class="signature-canvas"
        ></canvas>
      </div>

      <el-button @click="clearSignature" size="small">Clear Signature</el-button>

      <el-form-item label="Printed Name" class="printed-name">
        <el-input
          v-model="signature.signatureName"
          placeholder="Enter your full name"
          maxlength="255"
        />
      </el-form-item>
    </el-card>

    <!-- Actions -->
    <div class="actions">
      <el-button @click="router.back()">Back</el-button>
      <el-button
        type="primary"
        @click="signAndContinue"
        :disabled="!canSign"
        :loading="signature.isSubmitting"
      >
        Sign and Continue to Submission
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const route = useRoute();
const router = useRouter();

const application = ref(null);
const signatureCanvas = ref(null);
const signature = ref({
  signatureName: '',
  signatureImage: '',
  isSigned: false,
  isSubmitting: false
});
const agreementAccepted = ref(false);

let isDrawing = false;
let ctx = null;

onMounted(() => {
  loadApplication();
  setupCanvas();
});

async function loadApplication() {
  try {
    const response = await axios.get(`/api/applications/${route.params.id}`);
    application.value = response.data;

    // Check if already signed
    if (application.value.signed_at) {
      ElMessage.info('This application has already been signed.');
      router.push({ name: 'application-detail', params: { id: application.value.id } });
    }
  } catch (error) {
    ElMessage.error('Failed to load application');
    router.back();
  }
}

function setupCanvas() {
  ctx = signatureCanvas.value.getContext('2d');
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function startDrawing(e) {
  isDrawing = true;
  const rect = signatureCanvas.value.getBoundingClientRect();
  const x = (e.clientX || e.touches[0].clientX) - rect.left;
  const y = (e.clientY || e.touches[0].clientY) - rect.top;
  ctx.beginPath();
  ctx.moveTo(x, y);
  signature.value.isSigned = true;
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const rect = signatureCanvas.value.getBoundingClientRect();
  const x = (e.clientX || e.touches[0].clientX) - rect.left;
  const y = (e.clientY || e.touches[0].clientY) - rect.top;
  ctx.lineTo(x, y);
  ctx.stroke();
}

function stopDrawing() {
  isDrawing = false;
}

function clearSignature() {
  ctx.clearRect(0, 0, signatureCanvas.value.width, signatureCanvas.value.height);
  signature.value.isSigned = false;
  signature.value.signatureImage = '';
}

const canSign = computed(() => {
  return signature.value.isSigned &&
         signature.value.signatureName.trim().length > 0 &&
         agreementAccepted.value;
});

async function signAndContinue() {
  signature.value.isSubmitting = true;

  try {
    // Convert canvas to base64 PNG
    signature.value.signatureImage = signatureCanvas.value.toDataURL('image/png');

    // Submit signature to backend
    await axios.post(`/api/applications/${application.value.id}/sign`, {
      signature_data: signature.value.signatureImage,
      signature_name: signature.value.signatureName
    });

    ElMessage.success('Application signed successfully');

    // Navigate to submission confirmation
    router.push({
      name: 'application-submit',
      params: { id: application.value.id }
    });
  } catch (error) {
    ElMessage.error('Failed to save signature. Please try again.');
  } finally {
    signature.value.isSubmitting = false;
  }
}
</script>

<style scoped>
.signature-canvas {
  border: 2px solid #dcdfe6;
  border-radius: 4px;
  cursor: crosshair;
  background: white;
  display: block;
  margin: 16px auto;
}

.signature-container {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 8px;
}

.terms-content {
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 16px;
  padding: 12px;
  background: #f9fafc;
  border-radius: 4px;
}
</style>
```

**Notifications:** None (signature saved, not submitted yet)

**Edge Cases:**
1. **Empty Signature:** User clicks "Sign and Continue" without drawing
   - Frontend validation prevents submission (button disabled)
   - If bypassed: Backend returns 422 "signature_data is required"
2. **Name Mismatch:** Signature name doesn't match account name
   - Allowed by backend (parent may be signing on behalf of another guardian)
   - No validation required
3. **Duplicate Signature:** User already signed and returns to page
   - Frontend detects `signed_at !== null` and redirects with message
4. **Browser Refresh:** User refreshes page during signature
   - Canvas is cleared (signature not submitted yet)
   - User must re-sign

### 5.5 Application Submission

**Stage:** Converting Draft to Submitted Application

**Backend State Transition:**
- Before: `is_draft = true`, `status = pending`, `submitted_at = NULL`
- After: `is_draft = false`, `status = under_review`, `submitted_at = CURRENT_TIMESTAMP`

**Required Frontend State:**

```javascript
{
  applicationId: 'from-route-params',
  application: null,
  isSubmitting: false,
  submissionConfirmed: false
}
```

**Required UI View:**

1. **Submission Confirmation Page** (`/applications/:id/submit`)
   - Final review checklist (camper info, session, signature confirmed)
   - Warning: "Once submitted, you cannot edit this application."
   - "Submit Application" button (prominent, primary color)
   - "Go Back" button (to make last-minute changes)

**Frontend Workflow:**

```javascript
async function submitApplication() {
  // Confirm submission
  try {
    await ElMessageBox.confirm(
      'Once submitted, you will not be able to edit this application. Are you sure you want to submit?',
      'Confirm Submission',
      {
        confirmButtonText: 'Yes, Submit',
        cancelButtonText: 'Not Yet',
        type: 'warning',
        distinguishCancelAndClose: true
      }
    );
  } catch {
    return; // User cancelled
  }

  isSubmitting.value = true;

  try {
    // Submit by setting is_draft = false
    const response = await axios.put(`/api/applications/${route.params.id}`, {
      is_draft: false
    });

    submissionConfirmed.value = true;

    // Success notification
    ElNotification({
      title: 'Application Submitted',
      message: `Your application for ${application.value.camper.first_name} has been submitted successfully. You will receive an email confirmation shortly.`,
      type: 'success',
      duration: 10000
    });

    // Navigate to application detail (read-only)
    router.push({
      name: 'application-detail',
      params: { id: application.value.id }
    });
  } catch (error) {
    if (error.response?.status === 422) {
      const errors = error.response.data.errors;
      if (errors.signature_data) {
        ElMessage.error('Application must be signed before submission.');
        router.push({ name: 'application-sign', params: { id: application.value.id } });
      } else {
        ElMessage.error('Validation error: ' + Object.values(errors).flat().join(', '));
      }
    } else {
      ElMessage.error('Failed to submit application. Please try again.');
    }
  } finally {
    isSubmitting.value = false;
  }
}
```

**Backend Side Effects:**
- `submitted_at` timestamp set to current time
- Status changes from `pending` to `under_review`
- Application becomes visible in admin review queue
- Parent receives email: "Application Submitted"

**Notifications:**

**Email to Parent:**
```
Subject: Application Submitted - Camp Burnt Gin

Dear [Parent Name],

Your application for [Camper Name] to attend [Session Name] has been successfully submitted.

Application ID: [ID]
Submitted: [Date/Time]

Our team will review your application and you will receive a notification when a decision has been made.

If you have any questions, please contact us at [Contact Email].

Thank you,
Camp Burnt Gin Team
```

**In-App Notification:**
- Type: Success
- Title: "Application Submitted"
- Message: "Your application has been submitted and is under review."

**Edge Cases:**
1. **Missing Signature:** User bypassed signature step
   - Backend returns 422 "Application must be signed before submission."
   - Frontend redirects to signature page with error message
2. **Session Registration Closed:** Registration window closed after draft was created
   - Backend returns 422 "Registration is no longer open for this session."
   - Frontend displays error and prevents submission
3. **Application Already Submitted:** User clicks submit button twice rapidly
   - First request succeeds, second returns application with `is_draft = false`
   - Frontend detects and displays "Application already submitted" message

### 5.6 Administrative Review Process

**Stage:** Admin Reviews Submitted Application

**Backend State:**
- `status = under_review`
- `is_draft = false`
- `reviewed_at = NULL` (before review)

**Required Frontend State (Admin Dashboard):**

```javascript
{
  applicationsList: [],
  filters: {
    status: 'under_review',
    camp_session_id: null,
    search: '',
    date_from: null,
    date_to: null
  },
  pagination: {
    currentPage: 1,
    perPage: 15,
    total: 0
  },
  loading: false
}
```

**Required UI Views:**

1. **Admin Applications List** (`/admin/applications`)
   - Filterable table (status, session, date range, search by camper name)
   - Columns: Application ID, Camper Name, Session, Status, Submitted Date, Actions
   - "Review" button for `under_review` status
   - Pagination controls

2. **Application Review Page** (`/admin/applications/:id/review`)
   - Full application details (camper info, session, medical records, documents)
   - Medical risk indicators (life-threatening allergies, critical medications)
   - Signature display (image)
   - Review decision form:
     - Radio buttons: Approve / Reject / Waitlist
     - Notes textarea (required for rejection)
     - "Submit Review" button

**Frontend Review Workflow:**

```javascript
const reviewForm = ref({
  status: null, // 'approved', 'rejected', 'waitlisted'
  notes: ''
});

async function submitReview() {
  // Validate
  if (!reviewForm.value.status) {
    ElMessage.warning('Please select a review decision.');
    return;
  }

  if (reviewForm.value.status === 'rejected' && !reviewForm.value.notes.trim()) {
    ElMessage.warning('Please provide notes explaining the rejection.');
    return;
  }

  // Confirm
  const statusLabel = {
    approved: 'approve',
    rejected: 'reject',
    waitlisted: 'waitlist'
  }[reviewForm.value.status];

  try {
    await ElMessageBox.confirm(
      `Are you sure you want to ${statusLabel} this application?`,
      'Confirm Review Decision',
      {
        confirmButtonText: 'Yes, Confirm',
        cancelButtonText: 'Cancel',
        type: reviewForm.value.status === 'rejected' ? 'error' : 'warning'
      }
    );
  } catch {
    return;
  }

  isSubmitting.value = true;

  try {
    const response = await axios.post(`/api/applications/${route.params.id}/review`, {
      status: reviewForm.value.status,
      notes: reviewForm.value.notes
    });

    application.value = response.data;

    ElNotification({
      title: 'Review Submitted',
      message: `Application ${statusLabel}d successfully. Parent will be notified.`,
      type: 'success',
      duration: 5000
    });

    // Navigate back to applications list
    router.push({ name: 'admin-applications' });
  } catch (error) {
    if (error.response?.status === 422) {
      ElMessage.error('Validation error: ' + Object.values(error.response.data.errors).flat().join(', '));
    } else {
      ElMessage.error('Failed to submit review. Please try again.');
    }
  } finally {
    isSubmitting.value = false;
  }
}
```

**Backend Side Effects:**
- `status` changes to `approved`, `rejected`, or `waitlisted`
- `reviewed_at` set to current timestamp
- `reviewed_by` set to admin user ID
- `notes` saved
- Notification queued to parent
- If approved: Acceptance letter generated
- If rejected: Rejection letter generated

**Notifications:**

**Approval Email to Parent:**
```
Subject: Application Approved - Camp Burnt Gin

Dear [Parent Name],

Congratulations! Your application for [Camper Name] to attend [Session Name] has been approved.

Session Details:
- Dates: [Start Date] - [End Date]
- Location: [Camp Location]

Next Steps:
1. Review the attached acceptance letter
2. Complete the pre-camp health form (link)
3. Submit any outstanding documents
4. Arrive for check-in on [Start Date] at [Time]

We look forward to seeing [Camper Name] at camp!

Best regards,
Camp Burnt Gin Team
```

**Rejection Email to Parent:**
```
Subject: Application Status Update - Camp Burnt Gin

Dear [Parent Name],

Thank you for your application for [Camper Name] to attend [Session Name].

After careful review, we regret to inform you that we are unable to accept [Camper Name] for this session.

[Admin Notes if provided]

We encourage you to apply for future sessions. If you have questions, please contact us at [Contact Email].

Sincerely,
Camp Burnt Gin Team
```

**Edge Cases:**
1. **Application Already Reviewed:** Another admin reviewed while current admin had page open
   - Backend returns 422 if application status is already final
   - Frontend displays: "This application has already been reviewed by [Reviewer Name] on [Date]."
2. **Missing Medical Information:** Critical medical data not provided
   - Admin can still approve/reject but should note missing information
   - Frontend displays warning banner: "Warning: Medical record incomplete"
3. **Concurrent Reviews:** Two admins review same application simultaneously
   - Last write wins (Laravel handles database-level consistency)
   - First review succeeds, second receives error or overwrites (depending on timing)

### 5.7 Status Change Notifications

**Stage:** Automated System Notifications After Review

**Notification Triggers:**

| Event | Trigger | Recipients | Delivery Method |
|-------|---------|------------|-----------------|
| Application Submitted | `is_draft` changes from `true` to `false` | Parent | Email + In-app notification |
| Application Approved | `status` changes to `approved` | Parent | Email (with acceptance letter) + In-app notification |
| Application Rejected | `status` changes to `rejected` | Parent | Email (with rejection letter) + In-app notification |
| Application Waitlisted | `status` changes to `waitlisted` | Parent | Email + In-app notification |
| Waitlist to Approved | `status` changes from `waitlisted` to `approved` | Parent | Email (with acceptance letter) + In-app notification |
| Waitlist to Rejected | `status` changes from `waitlisted` to `rejected` | Parent | Email + In-app notification |
| Application Cancelled | Parent sets `status` to `cancelled` | Admin | In-app notification only |

**Frontend In-App Notification Display:**

```vue
<template>
  <el-dropdown trigger="click" @command="handleNotificationClick">
    <el-badge :value="unreadCount" :hidden="unreadCount === 0">
      <el-icon :size="24"><Bell /></el-icon>
    </el-badge>
    <template #dropdown>
      <el-dropdown-menu class="notification-dropdown">
        <div class="notification-header">
          <span>Notifications</span>
          <el-button
            v-if="unreadCount > 0"
            text
            size="small"
            @click="markAllRead"
          >
            Mark all read
          </el-button>
        </div>

        <el-scrollbar max-height="400px">
          <el-dropdown-item
            v-for="notification in notifications"
            :key="notification.id"
            :command="notification.id"
            :class="{ unread: !notification.read_at }"
          >
            <div class="notification-item">
              <el-icon :color="getNotificationColor(notification.type)">
                <component :is="getNotificationIcon(notification.type)" />
              </el-icon>
              <div class="notification-content">
                <p class="notification-message">{{ notification.data.message }}</p>
                <span class="notification-time">{{ formatTimeAgo(notification.created_at) }}</span>
              </div>
            </div>
          </el-dropdown-item>
        </el-scrollbar>

        <div class="notification-footer">
          <el-button text @click="viewAllNotifications">View All</el-button>
        </div>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { Bell, CircleCheck, CircleClose, InfoFilled } from '@element-plus/icons-vue';

const notifications = ref([]);

const unreadCount = computed(() =>
  notifications.value.filter(n => !n.read_at).length
);

async function fetchNotifications() {
  try {
    const response = await axios.get('/api/notifications?unread=false');
    notifications.value = response.data.data;
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
  }
}

async function markAllRead() {
  try {
    await axios.put('/api/notifications/read-all');
    notifications.value.forEach(n => {
      n.read_at = new Date().toISOString();
    });
  } catch (error) {
    ElMessage.error('Failed to mark notifications as read');
  }
}

async function handleNotificationClick(notificationId) {
  const notification = notifications.value.find(n => n.id === notificationId);
  if (!notification) return;

  // Mark as read
  if (!notification.read_at) {
    try {
      await axios.put(`/api/notifications/${notificationId}/read`);
      notification.read_at = new Date().toISOString();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  // Navigate to related resource
  if (notification.data.application_id) {
    router.push({
      name: 'application-detail',
      params: { id: notification.data.application_id }
    });
  }
}

function getNotificationIcon(type) {
  if (type.includes('Approved') || type.includes('Accepted')) return CircleCheck;
  if (type.includes('Rejected')) return CircleClose;
  return InfoFilled;
}

function getNotificationColor(type) {
  if (type.includes('Approved')) return '#67c23a';
  if (type.includes('Rejected')) return '#f56c6c';
  if (type.includes('Waitlisted')) return '#e6a23c';
  return '#909399';
}

onMounted(() => {
  fetchNotifications();

  // Poll for new notifications every 30 seconds
  setInterval(fetchNotifications, 30000);
});
</script>
```

### 5.8 Medical Provider Link Workflow

**Stage:** External Medical Provider Submits Information

This workflow is unique: unauthenticated external access via secure token.

**Backend State:**
- `medical_provider_links` table entry with:
  - `token`: 64-character cryptographically secure string
  - `camper_id`: Associated camper
  - `provider_email`: Recipient email
  - `expires_at`: 72 hours from creation (default)
  - `is_used`: `false` (before submission)
  - `revoked_at`: `NULL`

**Frontend Workflow (Parent Creates Link):**

```javascript
async function createProviderLink() {
  try {
    const response = await axios.post('/api/provider-links', {
      camper_id: selectedCamper.value.id,
      provider_email: providerEmail.value,
      message: customMessage.value || 'Please complete the medical information form for camp registration.'
    });

    ElNotification({
      title: 'Provider Link Created',
      message: `An email has been sent to ${providerEmail.value} with a secure link to submit medical information.`,
      type: 'success',
      duration: 8000
    });

    // Display link details
    providerLink.value = response.data;
    showLinkDialog.value = true;
  } catch (error) {
    ElMessage.error('Failed to create provider link');
  }
}

// Revoke link
async function revokeLink(linkId) {
  try {
    await ElMessageBox.confirm(
      'Are you sure you want to revoke this link? The provider will no longer be able to use it.',
      'Confirm Revocation',
      { type: 'warning' }
    );

    await axios.post(`/api/provider-links/${linkId}/revoke`);

    ElMessage.success('Provider link revoked');
    fetchProviderLinks();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Failed to revoke link');
    }
  }
}
```

**Frontend Workflow (Provider Accesses Link):**

**Public Route:** `/provider/:token` (no authentication required)

```vue
<!-- ProviderForm.vue -->
<template>
  <div class="provider-access-page">
    <header class="provider-header">
      <h1>Camp Burnt Gin - Medical Information Form</h1>
    </header>

    <div v-if="linkStatus === 'loading'" class="loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <p>Verifying access link...</p>
    </div>

    <div v-else-if="linkStatus === 'expired'" class="error-state">
      <el-result icon="warning" title="Link Expired" sub-title="This link has expired, been used, or has been revoked. Please contact the parent for a new link.">
      </el-result>
    </div>

    <div v-else-if="linkStatus === 'valid'" class="provider-form">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="info-banner"
      >
        <template #title>
          Completing information for: <strong>{{ camper.first_name }} {{ camper.last_name }}</strong>
        </template>
        This link will expire in {{ hoursRemaining }} hour(s). Once submitted, you will not be able to make changes.
      </el-alert>

      <el-form :model="medicalForm" :rules="rules" ref="formRef" label-position="top">
        <!-- Physician Information -->
        <h3>Physician Information</h3>
        <el-form-item label="Physician Name" prop="physician_name">
          <el-input v-model="medicalForm.physician_name" />
        </el-form-item>
        <el-form-item label="Physician Phone" prop="physician_phone">
          <el-input v-model="medicalForm.physician_phone" />
        </el-form-item>

        <!-- Insurance Information -->
        <h3>Insurance Information</h3>
        <el-form-item label="Insurance Provider" prop="insurance_provider">
          <el-input v-model="medicalForm.insurance_provider" />
        </el-form-item>
        <el-form-item label="Policy Number" prop="insurance_policy_number">
          <el-input v-model="medicalForm.insurance_policy_number" />
        </el-form-item>

        <!-- Medical Conditions -->
        <h3>Medical Conditions</h3>
        <el-form-item label="Special Needs or Medical Conditions">
          <el-input
            v-model="medicalForm.special_needs"
            type="textarea"
            :rows="4"
            maxlength="5000"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="Dietary Restrictions">
          <el-input
            v-model="medicalForm.dietary_restrictions"
            type="textarea"
            :rows="3"
            maxlength="2000"
            show-word-limit
          />
        </el-form-item>

        <!-- Allergies -->
        <h3>Allergies</h3>
        <div v-for="(allergy, index) in medicalForm.allergies" :key="index" class="allergy-entry">
          <el-form-item :label="`Allergy ${index + 1} - Allergen`">
            <el-input v-model="allergy.allergen" placeholder="e.g., Peanuts" />
          </el-form-item>
          <el-form-item label="Severity">
            <el-select v-model="allergy.severity" placeholder="Select severity">
              <el-option label="Mild" value="mild" />
              <el-option label="Moderate" value="moderate" />
              <el-option label="Severe" value="severe" />
              <el-option label="Life-Threatening" value="life_threatening" />
            </el-select>
          </el-form-item>
          <el-form-item label="Reaction">
            <el-input v-model="allergy.reaction" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="Treatment">
            <el-input v-model="allergy.treatment" type="textarea" :rows="2" />
          </el-form-item>
          <el-button @click="removeAllergy(index)" type="danger" size="small">Remove</el-button>
        </div>
        <el-button @click="addAllergy" type="primary" plain>Add Allergy</el-button>

        <!-- Medications -->
        <h3>Current Medications</h3>
        <div v-for="(med, index) in medicalForm.medications" :key="index" class="medication-entry">
          <el-form-item :label="`Medication ${index + 1} - Name`">
            <el-input v-model="med.name" placeholder="e.g., Albuterol Inhaler" />
          </el-form-item>
          <el-form-item label="Dosage">
            <el-input v-model="med.dosage" placeholder="e.g., 2 puffs" />
          </el-form-item>
          <el-form-item label="Frequency">
            <el-input v-model="med.frequency" placeholder="e.g., Every 4-6 hours as needed" />
          </el-form-item>
          <el-form-item label="Purpose">
            <el-input v-model="med.purpose" placeholder="e.g., Asthma control" />
          </el-form-item>
          <el-button @click="removeMedication(index)" type="danger" size="small">Remove</el-button>
        </div>
        <el-button @click="addMedication" type="primary" plain">Add Medication</el-button>

        <!-- Submit -->
        <div class="form-actions">
          <el-button
            type="primary"
            size="large"
            @click="submitForm"
            :loading="isSubmitting"
          >
            Submit Medical Information
          </el-button>
        </div>
      </el-form>
    </div>

    <div v-else-if="linkStatus === 'submitted'" class="success-state">
      <el-result icon="success" title="Thank You!" sub-title="Medical information submitted successfully. The parent will be notified.">
      </el-result>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';

const route = useRoute();
const linkStatus = ref('loading'); // 'loading', 'valid', 'expired', 'submitted'
const camper = ref(null);
const hoursRemaining = ref(0);
const isSubmitting = ref(false);

const medicalForm = ref({
  physician_name: '',
  physician_phone: '',
  insurance_provider: '',
  insurance_policy_number: '',
  special_needs: '',
  dietary_restrictions: '',
  allergies: [],
  medications: []
});

onMounted(async () => {
  await validateLink();
});

async function validateLink() {
  try {
    const response = await axios.get(`/api/provider-access/${route.params.token}`);
    camper.value = response.data.camper;
    hoursRemaining.value = response.data.hours_remaining;
    linkStatus.value = 'valid';
  } catch (error) {
    if (error.response?.status === 410) {
      linkStatus.value = 'expired';
    } else {
      ElMessage.error('Failed to validate access link');
      linkStatus.value = 'expired';
    }
  }
}

function addAllergy() {
  medicalForm.value.allergies.push({
    allergen: '',
    severity: '',
    reaction: '',
    treatment: ''
  });
}

function removeAllergy(index) {
  medicalForm.value.allergies.splice(index, 1);
}

function addMedication() {
  medicalForm.value.medications.push({
    name: '',
    dosage: '',
    frequency: '',
    purpose: ''
  });
}

function removeMedication(index) {
  medicalForm.value.medications.splice(index, 1);
}

async function submitForm() {
  // Confirm submission
  try {
    await ElMessageBox.confirm(
      'Once submitted, you will not be able to make changes. Are you sure you want to submit?',
      'Confirm Submission',
      { type: 'warning' }
    );
  } catch {
    return;
  }

  isSubmitting.value = true;

  try {
    // Filter out empty allergies and medications
    const payload = {
      medical_record: {
        physician_name: medicalForm.value.physician_name,
        physician_phone: medicalForm.value.physician_phone,
        insurance_provider: medicalForm.value.insurance_provider,
        insurance_policy_number: medicalForm.value.insurance_policy_number,
        special_needs: medicalForm.value.special_needs,
        dietary_restrictions: medicalForm.value.dietary_restrictions
      },
      allergies: medicalForm.value.allergies.filter(a => a.allergen.trim() !== ''),
      medications: medicalForm.value.medications.filter(m => m.name.trim() !== '')
    };

    await axios.post(`/api/provider-access/${route.params.token}/submit`, payload);

    linkStatus.value = 'submitted';
  } catch (error) {
    if (error.response?.status === 410) {
      ElMessage.error('This link has expired or been used.');
      linkStatus.value = 'expired';
    } else if (error.response?.status === 422) {
      ElMessage.error('Validation error: ' + Object.values(error.response.data.errors).flat().join(', '));
    } else {
      ElMessage.error('Failed to submit medical information. Please try again.');
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>
```

**Backend Side Effects (Provider Submission):**
- Medical record created or updated
- Allergies created
- Medications created
- Provider link marked as used (`is_used = true`, `used_at = timestamp`)
- Parent notified via email: "Medical provider submitted information"
- Admin notified via in-app notification

**Edge Cases:**
1. **Link Expired During Form Fill:** User started form, link expired before submission
   - Backend returns 410 Gone
   - Frontend displays: "This link has expired. Please request a new link from the parent."
2. **Link Already Used:** Provider clicks link again after submitting
   - Backend returns 410 Gone
   - Frontend displays: "This link has already been used and is no longer valid."
3. **Link Revoked:** Parent revoked link while provider was filling form
   - Backend returns 410 Gone
   - Frontend displays: "This link has been revoked and is no longer valid."

---

## 6. Data Models & Frontend State Design

This section defines the core data entities, their relationships, and the recommended frontend state structure aligned with the backend Eloquent models. The goal is to establish a clear, maintainable state architecture that mirrors the backend data model while optimizing for frontend performance and user experience.

### 6.1 Backend Entity-Relationship Model

**Core Entities and Relationships:**

```
┌──────────────┐
│     User     │
└──────┬───────┘
       │ has_many (1:N)
       ▼
┌──────────────┐       has_many (1:N)        ┌──────────────┐
│    Camper    │───────────────────────────►│  Application │
└──────┬───────┘                            └──────┬───────┘
       │                                           │
       │ has_one (1:1)                             │ belongs_to (N:1)
       ├──────────────────────────►┌───────────────┴────────┐
       │                            │    CampSession         │
       │ has_many (1:N)             └───────────┬────────────┘
       ├──────►┌────────────────┐               │
       │       │    Allergy     │               │ belongs_to (N:1)
       │       └────────────────┘               ▼
       │                                  ┌──────────────┐
       ├──────►┌────────────────┐        │     Camp     │
       │       │   Medication   │        └──────────────┘
       │       └────────────────┘
       │
       ├──────►┌────────────────┐
       │       │EmergencyContact│
       │       └────────────────┘
       │
       ├──────►┌────────────────┐
       │       │ MedicalRecord  │
       │       └────────────────┘
       │
       ├──────►┌────────────────┐
       │       │   Diagnosis    │
       │       └────────────────┘
       │
       ├──────►┌────────────────┐
       │       │BehavioralProfile
       │       └────────────────┘
       │
       ├──────►┌────────────────┐
       │       │  FeedingPlan   │
       │       └────────────────┘
       │
       ├──────►┌────────────────┐
       │       │AssistiveDevice │
       │       └────────────────┘
       │
       ├──────►┌────────────────┐
       │       │ActivityPermission
       │       └────────────────┘
       │
       ├──────►┌────────────────┐
       │       │MedicalProviderLink
       │       └────────────────┘
       │
       └──────►┌────────────────┐ (Polymorphic)
               │    Document    │ (documentable_type, documentable_id)
               └────────────────┘

┌──────────────┐
│     Role     │ (admin, parent, medical)
└──────┬───────┘
       │ has_many (1:N)
       ▼
┌──────────────┐
│     User     │
└──────────────┘
```

### 6.2 Core Entity Definitions

#### 6.2.1 User Model

**Backend Table:** `users`

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | bigint | PK | Unique user identifier |
| `name` | string(255) | Yes | Full name |
| `email` | string(255) | Yes, unique | Email address (login credential) |
| `email_verified_at` | timestamp | Nullable | Email verification timestamp |
| `password` | string(255) | Yes | bcrypt hashed password |
| `role_id` | bigint | Yes, FK | Foreign key to roles table |
| `mfa_enabled` | boolean | Default false | MFA enabled flag |
| `mfa_secret` | string(255) | Nullable, hidden | TOTP secret (never exposed to frontend) |
| `mfa_verified_at` | timestamp | Nullable | MFA verification timestamp |
| `failed_login_attempts` | integer | Default 0 | Failed login counter |
| `lockout_until` | timestamp | Nullable | Account lockout expiration |
| `created_at` | timestamp | Auto | Account creation timestamp |
| `updated_at` | timestamp | Auto | Last update timestamp |

**Frontend State Shape:**

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role: Role;
  mfa_enabled: boolean;
  created_at: string; // ISO 8601 format
  updated_at: string;
}

interface Role {
  id: number;
  name: 'admin' | 'parent' | 'medical';
  display_name: string;
}
```

**Pinia Store:**

```javascript
// stores/auth.js
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    token: null as string | null,
    isAuthenticated: false
  }),

  getters: {
    isAdmin: (state) => state.user?.role.name === 'admin',
    isParent: (state) => state.user?.role.name === 'parent',
    isMedical: (state) => state.user?.role.name === 'medical',

    hasRole: (state) => (role: string) => state.user?.role.name === role,
    hasAnyRole: (state) => (roles: string[]) => roles.includes(state.user?.role.name || ''),

    userName: (state) => state.user?.name || 'User',
    userEmail: (state) => state.user?.email || ''
  },

  actions: {
    setToken(token: string) {
      this.token = token;
      this.isAuthenticated = true;
      // Store in httpOnly cookie or encrypted localStorage
    },

    setUser(user: User) {
      this.user = user;
    },

    async fetchUser() {
      const response = await axios.get('/api/user');
      this.user = response.data;
      return this.user;
    },

    logout() {
      this.user = null;
      this.token = null;
      this.isAuthenticated = false;
      // Clear storage
    }
  }
});
```

#### 6.2.2 Camper Model

**Backend Table:** `campers`

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | bigint | PK | Unique camper identifier |
| `user_id` | bigint | Yes, FK | Parent/guardian user ID |
| `first_name` | string(255) | Yes | Camper's first name |
| `last_name` | string(255) | Yes | Camper's last name |
| `date_of_birth` | date | Yes | Camper's date of birth |
| `gender` | string(50) | Nullable | Gender identity |
| `supervision_level` | enum | Nullable | Supervision requirement level |
| `record_retention_until` | date | Nullable | HIPAA record retention date |
| `created_at` | timestamp | Auto | Record creation timestamp |
| `updated_at` | timestamp | Auto | Last update timestamp |
| `deleted_at` | timestamp | Nullable | Soft delete timestamp (HIPAA compliance) |

**Computed Properties (Frontend):**

```typescript
interface Camper {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string; // YYYY-MM-DD
  gender?: string;
  supervision_level?: string;
  created_at: string;
  updated_at: string;

  // Computed
  full_name: string; // first_name + last_name
  age: number; // Calculated from date_of_birth
  age_on_date?: (date: string) => number; // Age on specific date (session start)

  // Relationships (optional, loaded via API with ?include=)
  user?: User;
  medical_record?: MedicalRecord;
  allergies?: Allergy[];
  medications?: Medication[];
  emergency_contacts?: EmergencyContact[];
  applications?: Application[];
  documents?: Document[];
}
```

**Pinia Store:**

```javascript
// stores/campers.js
export const useCampersStore = defineStore('campers', {
  state: () => ({
    campers: [] as Camper[],
    currentCamper: null as Camper | null,
    loading: false,
    error: null as string | null
  }),

  getters: {
    getCamperById: (state) => (id: number) => {
      return state.campers.find(c => c.id === id) || null;
    },

    accessibleCampers(state) {
      const authStore = useAuthStore();
      if (authStore.isAdmin) return state.campers;
      if (authStore.isParent) {
        return state.campers.filter(c => c.user_id === authStore.user.id);
      }
      return [];
    },

    campersByAge: (state) => {
      return [...state.campers].sort((a, b) => {
        const ageA = calculateAge(a.date_of_birth);
        const ageB = calculateAge(b.date_of_birth);
        return ageA - ageB;
      });
    }
  },

  actions: {
    async fetchCampers() {
      this.loading = true;
      try {
        const response = await axios.get('/api/campers');
        this.campers = response.data.data;
      } catch (error) {
        this.error = 'Failed to load campers';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchCamper(id: number, includes?: string[]) {
      this.loading = true;
      try {
        const params = includes ? { include: includes.join(',') } : {};
        const response = await axios.get(`/api/campers/${id}`, { params });
        this.currentCamper = response.data;

        // Update in list
        const index = this.campers.findIndex(c => c.id === id);
        if (index >= 0) {
          this.campers[index] = response.data;
        } else {
          this.campers.push(response.data);
        }

        return response.data;
      } catch (error) {
        this.error = 'Failed to load camper';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createCamper(camperData: Partial<Camper>) {
      const response = await axios.post('/api/campers', camperData);
      this.campers.push(response.data);
      return response.data;
    },

    async updateCamper(id: number, camperData: Partial<Camper>) {
      const response = await axios.put(`/api/campers/${id}`, camperData);
      const index = this.campers.findIndex(c => c.id === id);
      if (index >= 0) {
        this.campers[index] = response.data;
      }
      return response.data;
    },

    async deleteCamper(id: number) {
      await axios.delete(`/api/campers/${id}`);
      this.campers = this.campers.filter(c => c.id !== id);
    }
  }
});

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}
```

#### 6.2.3 Application Model

**Backend Table:** `applications`

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | bigint | PK | Unique application identifier |
| `camper_id` | bigint | Yes, FK, unique with camp_session_id | Camper ID |
| `camp_session_id` | bigint | Yes, FK | Camp session ID |
| `status` | enum | Yes, default 'pending' | Application status |
| `is_draft` | boolean | Default true | Draft mode flag |
| `submitted_at` | timestamp | Nullable | Submission timestamp |
| `reviewed_at` | timestamp | Nullable | Review timestamp |
| `reviewed_by` | bigint | Nullable, FK | Admin user ID who reviewed |
| `notes` | text | Nullable | Review notes or parent notes |
| `signature_data` | text | Nullable, hidden from API | Base64 signature image (never exposed) |
| `signature_name` | string(255) | Nullable | Printed name of signer |
| `signed_at` | timestamp | Nullable | Signature timestamp |
| `signed_ip_address` | string(45) | Nullable | IP address of signer |
| `created_at` | timestamp | Auto | Creation timestamp |
| `updated_at` | timestamp | Auto | Last update timestamp |

**Enums:**
- `status`: `pending`, `under_review`, `approved`, `rejected`, `waitlisted`, `cancelled`

**Frontend State Shape:**

```typescript
type ApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'waitlisted' | 'cancelled';

interface Application {
  id: number;
  camper_id: number;
  camp_session_id: number;
  status: ApplicationStatus;
  is_draft: boolean;
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by?: number;
  notes?: string;
  signature_name?: string;
  signed_at?: string;
  created_at: string;
  updated_at: string;

  // Computed
  is_final: boolean; // approved, rejected, or cancelled
  is_editable: boolean; // pending or under_review
  is_signed: boolean; // signed_at !== null
  status_label: string; // Formatted status
  status_color: string; // Color for UI badges

  // Relationships
  camper?: Camper;
  camp_session?: CampSession;
  reviewer?: User;
}
```

**Pinia Store:**

```javascript
// stores/applications.js
export const useApplicationsStore = defineStore('applications', {
  state: () => ({
    applications: [] as Application[],
    currentApplication: null as Application | null,
    filters: {
      status: null as ApplicationStatus | null,
      camp_session_id: null as number | null,
      search: '',
      date_from: null as string | null,
      date_to: null as string | null
    },
    pagination: {
      currentPage: 1,
      perPage: 15,
      total: 0
    },
    loading: false
  }),

  getters: {
    getApplicationById: (state) => (id: number) => {
      return state.applications.find(a => a.id === id) || null;
    },

    draftApplications(state) {
      return state.applications.filter(a => a.is_draft === true);
    },

    submittedApplications(state) {
      return state.applications.filter(a => a.is_draft === false);
    },

    applicationsByStatus: (state) => (status: ApplicationStatus) => {
      return state.applications.filter(a => a.status === status);
    },

    pendingReview(state) {
      return state.applications.filter(a => a.status === 'under_review');
    }
  },

  actions: {
    async fetchApplications(params = {}) {
      this.loading = true;
      try {
        const response = await axios.get('/api/applications', {
          params: {
            ...this.filters,
            ...params,
            page: this.pagination.currentPage,
            per_page: this.pagination.perPage
          }
        });

        this.applications = response.data.data;
        this.pagination.total = response.data.meta.total;
        this.pagination.currentPage = response.data.meta.current_page;
      } catch (error) {
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchApplication(id: number) {
      const response = await axios.get(`/api/applications/${id}`);
      this.currentApplication = response.data;

      // Update in list
      const index = this.applications.findIndex(a => a.id === id);
      if (index >= 0) {
        this.applications[index] = response.data;
      }

      return response.data;
    },

    async createApplication(applicationData: Partial<Application>) {
      const response = await axios.post('/api/applications', applicationData);
      this.applications.push(response.data);
      return response.data;
    },

    async updateApplication(id: number, applicationData: Partial<Application>) {
      const response = await axios.put(`/api/applications/${id}`, applicationData);

      const index = this.applications.findIndex(a => a.id === id);
      if (index >= 0) {
        this.applications[index] = response.data;
      }

      if (this.currentApplication?.id === id) {
        this.currentApplication = response.data;
      }

      return response.data;
    },

    async signApplication(id: number, signatureData: { signature_data: string, signature_name: string }) {
      const response = await axios.post(`/api/applications/${id}/sign`, signatureData);

      // Update application with signature info
      const index = this.applications.findIndex(a => a.id === id);
      if (index >= 0) {
        this.applications[index] = { ...this.applications[index], ...response.data };
      }

      return response.data;
    },

    async submitApplication(id: number) {
      return await this.updateApplication(id, { is_draft: false });
    },

    async reviewApplication(id: number, reviewData: { status: ApplicationStatus, notes?: string }) {
      const response = await axios.post(`/api/applications/${id}/review`, reviewData);

      const index = this.applications.findIndex(a => a.id === id);
      if (index >= 0) {
        this.applications[index] = response.data;
      }

      return response.data;
    }
  }
});
```

#### 6.2.4 MedicalRecord Model

**Backend Table:** `medical_records`

**Fields:**

| Field | Type | Required | Constraint |
|-------|------|----------|------------|
| `id` | bigint | PK | |
| `camper_id` | bigint | Yes, FK, unique | One record per camper |
| `physician_name` | string(255) | Nullable | |
| `physician_phone` | string(20) | Nullable | |
| `insurance_provider` | string(255) | Nullable | |
| `insurance_policy_number` | string(100) | Nullable | |
| `special_needs` | text | Nullable | Max 5000 chars |
| `dietary_restrictions` | text | Nullable | Max 2000 chars |
| `created_at` | timestamp | Auto | |
| `updated_at` | timestamp | Auto | |

**Frontend State Shape:**

```typescript
interface MedicalRecord {
  id: number;
  camper_id: number;
  physician_name?: string;
  physician_phone?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  special_needs?: string;
  dietary_restrictions?: string;
  created_at: string;
  updated_at: string;

  // Relationships
  camper?: Camper;
}
```

#### 6.2.5 Allergy Model

**Backend Table:** `allergies`

**Fields:**

| Field | Type | Required | Constraint |
|-------|------|----------|------------|
| `id` | bigint | PK | |
| `camper_id` | bigint | Yes, FK | |
| `allergen` | string(255) | Yes | |
| `severity` | enum | Yes | mild, moderate, severe, life_threatening |
| `reaction` | text | Nullable | Max 2000 chars |
| `treatment` | text | Nullable | Max 2000 chars |
| `created_at` | timestamp | Auto | |
| `updated_at` | timestamp | Auto | |

**Frontend State Shape:**

```typescript
type AllergySeverity = 'mild' | 'moderate' | 'severe' | 'life_threatening';

interface Allergy {
  id: number;
  camper_id: number;
  allergen: string;
  severity: AllergySeverity;
  reaction?: string;
  treatment?: string;
  created_at: string;
  updated_at: string;

  // Computed
  severity_label: string;
  severity_color: string; // For UI badges
  is_critical: boolean; // severe or life_threatening
}
```

#### 6.2.6 Medication Model

**Backend Table:** `medications`

**Fields:**

| Field | Type | Required |
|-------|------|----------|
| `id` | bigint | PK |
| `camper_id` | bigint | Yes, FK |
| `name` | string(255) | Yes |
| `dosage` | string(100) | Yes |
| `frequency` | string(100) | Yes |
| `purpose` | string(500) | Nullable |
| `prescribing_physician` | string(255) | Nullable |
| `notes` | text | Nullable, max 2000 |
| `created_at` | timestamp | Auto |
| `updated_at` | timestamp | Auto |

**Frontend State Shape:**

```typescript
interface Medication {
  id: number;
  camper_id: number;
  name: string;
  dosage: string;
  frequency: string;
  purpose?: string;
  prescribing_physician?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}
```

#### 6.2.7 Document Model (Polymorphic)

**Backend Table:** `documents`

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | bigint | PK | |
| `documentable_type` | string(255) | Nullable | Polymorphic type (e.g., "App\\Models\\Camper") |
| `documentable_id` | bigint | Nullable | Polymorphic ID |
| `uploaded_by` | bigint | FK | User who uploaded |
| `document_type` | string(100) | Nullable | Category (medical, legal, identification) |
| `original_filename` | string(255) | Yes | Original file name |
| `stored_filename` | string(255) | Yes | UUID-based storage filename |
| `mime_type` | string(100) | Yes | File MIME type |
| `file_size` | bigint | Yes | File size in bytes |
| `disk` | string(50) | Default 'local' | Storage disk |
| `path` | string(500) | Yes | Storage path |
| `is_scanned` | boolean | Default false | Security scan completed |
| `scan_passed` | boolean | Nullable | Security scan result (null = pending, true = passed, false = failed) |
| `scanned_at` | timestamp | Nullable | Scan completion timestamp |
| `created_at` | timestamp | Auto | |
| `updated_at` | timestamp | Auto | |

**Frontend State Shape:**

```typescript
interface Document {
  id: number;
  documentable_type?: string;
  documentable_id?: number;
  uploaded_by: number;
  document_type?: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  is_scanned: boolean;
  scan_passed: boolean | null;
  scanned_at?: string;
  created_at: string;
  updated_at: string;

  // Computed
  file_size_formatted: string; // "2.5 MB"
  can_download: boolean; // Based on scan_passed and user role
  scan_status_label: string; // "Pending", "Passed", "Failed"
  scan_status_color: string;
  file_icon: string; // Icon based on MIME type
}
```

### 6.3 Recommended State Management Strategy

**Technology Choice:** Pinia (Vue 3 official state management)

**Rationale:**
- Official Vue 3 recommendation (replaces Vuex)
- TypeScript-first design
- Simpler API than Vuex (no mutations)
- Better development experience with devtools
- Modular store design aligns with backend resource structure

**Store Structure:**

```
stores/
├── auth.js          # User authentication, session management
├── campers.js       # Camper CRUD operations
├── applications.js  # Application lifecycle management
├── medical.js       # Medical records, allergies, medications, contacts
├── documents.js     # Document upload/download management
├── camps.js         # Camp and session data
├── notifications.js # In-app notifications
├── providers.js     # Medical provider links
└── ui.js            # UI state (sidebar, modals, loading states)
```

**Cross-Store Communication:**

```javascript
// applications.js - accessing campers store
import { useCampersStore } from './campers';

export const useApplicationsStore = defineStore('applications', {
  actions: {
    async createApplicationForCamper(camperId: number, sessionId: number) {
      const campersStore = useCampersStore();

      // Verify camper exists
      const camper = campersStore.getCamperById(camperId);
      if (!camper) {
        await campersStore.fetchCamper(camperId);
      }

      // Create application
      return await this.createApplication({
        camper_id: camperId,
        camp_session_id: sessionId,
        is_draft: true
      });
    }
  }
});
```

### 6.4 Form State Isolation Strategy

**Problem:** Large nested forms (application + camper + medical info) can become unwieldy in global state.

**Solution:** Isolate form state in component-level reactive refs, sync with store only on save.

**Pattern:**

```vue
<template>
  <el-form :model="formData" :rules="rules" ref="formRef">
    <!-- Form fields -->
  </el-form>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useCampersStore } from '@/stores/campers';

const campersStore = useCampersStore();

// Component-level form state (isolated)
const formData = ref({
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: ''
});

// Load from store on mount
onMounted(async () => {
  if (props.camperId) {
    const camper = await campersStore.fetchCamper(props.camperId);
    formData.value = { ...camper }; // Clone to avoid mutating store
  }
});

// Save to store on submit
async function handleSubmit() {
  await formRef.value.validate();

  if (props.camperId) {
    await campersStore.updateCamper(props.camperId, formData.value);
  } else {
    await campersStore.createCamper(formData.value);
  }

  router.push({ name: 'campers' });
}
</script>
```

### 6.5 Draft Persistence Approach

**Requirement:** Auto-save draft applications to prevent data loss.

**Strategy:** Debounced auto-save to backend + optimistic local state updates.

**Implementation:**

```javascript
import { watchDebounced } from '@vueuse/core';

const applicationForm = ref({ /* form data */ });
const saveStatus = ref('saved'); // 'saved', 'saving', 'unsaved', 'error'

// Watch for changes and auto-save
watchDebounced(
  applicationForm,
  async () => {
    await saveDraft();
  },
  { debounce: 3000, deep: true }
);

async function saveDraft() {
  saveStatus.value = 'saving';

  try {
    const response = await applicationsStore.updateApplication(
      applicationForm.value.id,
      applicationForm.value
    );

    // Update local form with backend response (timestamps, etc.)
    applicationForm.value = { ...applicationForm.value, ...response };

    saveStatus.value = 'saved';
    lastSavedAt.value = new Date();
  } catch (error) {
    saveStatus.value = 'error';
    console.error('Auto-save failed:', error);
  }
}
```

### 6.6 Validation Layering (Frontend vs Backend)

**Frontend Validation:**
- **Purpose:** Immediate feedback, prevent unnecessary API calls
- **Scope:** Format validation, required fields, length limits
- **Library:** Element Plus built-in validation or Vuelidate

**Backend Validation:**
- **Purpose:** Authoritative validation, security enforcement
- **Scope:** Business rules, uniqueness, authorization, data integrity
- **Always trust:** Backend validation is final

**Layered Approach:**

```javascript
// Frontend validation rules
const rules = {
  first_name: [
    { required: true, message: 'First name is required', trigger: 'blur' },
    { min: 1, max: 255, message: 'First name must be 1-255 characters', trigger: 'blur' }
  ],
  date_of_birth: [
    { required: true, message: 'Date of birth is required', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (new Date(value) >= new Date()) {
          callback(new Error('Date of birth must be in the past'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ],
  email: [
    { required: true, message: 'Email is required', trigger: 'blur' },
    { type: 'email', message: 'Please enter a valid email', trigger: 'blur' }
  ]
};

// Backend validation error handling
async function handleSubmit() {
  try {
    await formRef.value.validate(); // Frontend validation first

    await campersStore.createCamper(formData.value);

    router.push({ name: 'campers' });
  } catch (error) {
    if (error.response?.status === 422) {
      // Backend validation errors
      const backendErrors = error.response.data.errors;

      // Display field-specific errors
      Object.keys(backendErrors).forEach(field => {
        const errorMessage = backendErrors[field].join(', ');
        ElMessage.error(`${field}: ${errorMessage}`);
      });

      // Optionally map backend errors to form fields
      formRef.value.fields.forEach(field => {
        if (backendErrors[field.prop]) {
          field.validateState = 'error';
          field.validateMessage = backendErrors[field.prop][0];
        }
      });
    } else {
      ElMessage.error('An unexpected error occurred. Please try again.');
    }
  }
}
```

### 6.7 Stable Fields for Repopulation

**Use Case:** Returning parents should have forms pre-populated with stable data from previous applications.

**Stable Fields (Unlikely to Change):**
- Parent name, email
- Emergency contact information (if same people)
- Camper date of birth (never changes)
- Physician information (often same doctor)
- Insurance information (if same policy)

**API Endpoint:** `GET /api/profile/prefill`

**Frontend Implementation:**

```javascript
async function prefillForm() {
  try {
    const response = await axios.get('/api/profile/prefill');
    const prefillData = response.data;

    // Prefill emergency contacts
    if (prefillData.emergency_contacts?.length > 0) {
      emergencyContactsForm.value = prefillData.emergency_contacts.map(contact => ({
        ...contact,
        id: null // Remove ID to create new records
      }));
    }

    // Optionally prefill camper data if editing
    if (prefillData.campers?.length === 1) {
      const camper = prefillData.campers[0];
      camperForm.value = {
        first_name: camper.first_name,
        last_name: camper.last_name,
        date_of_birth: camper.date_of_birth,
        gender: camper.gender
      };
    }

    ElMessage.success('Form prefilled with previous information');
  } catch (error) {
    // Prefill is optional, fail silently
    console.warn('Failed to prefill form:', error);
  }
}
```

### 6.8 Derived/Computed Fields

**Computed Properties in Stores:**

```javascript
// stores/campers.js
export const useCampersStore = defineStore('campers', {
  getters: {
    // Camper with computed age
    enrichedCampers(state) {
      return state.campers.map(camper => ({
        ...camper,
        full_name: `${camper.first_name} ${camper.last_name}`,
        age: this.calculateAge(camper.date_of_birth),
        initials: `${camper.first_name[0]}${camper.last_name[0]}`
      }));
    },

    calculateAge: () => (dateOfBirth: string) => {
      const today = new Date();
      const birthDate = new Date(dateOfBirth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    }
  }
});

// stores/applications.js
export const useApplicationsStore = defineStore('applications', {
  getters: {
    enrichedApplications(state) {
      return state.applications.map(app => ({
        ...app,
        is_final: ['approved', 'rejected', 'cancelled'].includes(app.status),
        is_editable: ['pending', 'under_review'].includes(app.status),
        is_signed: Boolean(app.signed_at),
        status_label: this.getStatusLabel(app.status),
        status_color: this.getStatusColor(app.status)
      }));
    },

    getStatusLabel: () => (status: ApplicationStatus) => {
      const labels = {
        pending: 'Pending',
        under_review: 'Under Review',
        approved: 'Approved',
        rejected: 'Rejected',
        waitlisted: 'Waitlisted',
        cancelled: 'Cancelled'
      };
      return labels[status] || status;
    },

    getStatusColor: () => (status: ApplicationStatus) => {
      const colors = {
        pending: '#909399',
        under_review: '#409eff',
        approved: '#67c23a',
        rejected: '#f56c6c',
        waitlisted: '#e6a23c',
        cancelled: '#909399'
      };
      return colors[status] || '#909399';
    }
  }
});
```

---

**End of Phase 3**

**Sections Completed:**
5. ✅ Application Workflow Mapping
6. ✅ Data Models & Frontend State Design

**Next Phase:**
- Section 7: File Upload & Document Handling Considerations
- Section 8: Notification & Messaging Architecture
- Section 9: Performance & Scalability Implications
