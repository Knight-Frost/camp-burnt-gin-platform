# System Architecture

This document provides a comprehensive overview of the Camp Burnt Gin API backend architecture. It describes the system design, component relationships, data flow patterns, and the architectural decisions that guide the implementation.

---

## Table of Contents

1. [Architectural Overview](#architectural-overview)
2. [Layered Architecture](#layered-architecture)
3. [Domain Subsystems](#domain-subsystems)
4. [Data Flow](#data-flow)
5. [Authentication and Authorization](#authentication-and-authorization)
6. [Database Design](#database-design)
7. [Service Layer Design](#service-layer-design)
8. [API Design Principles](#api-design-principles)
9. [Scalability Considerations](#scalability-considerations)
10. [Maintainability and Extensibility](#maintainability-and-extensibility)

---

## Architectural Overview

The Camp Burnt Gin API is designed as a **layered, service-oriented backend** that follows established Laravel conventions while enforcing strict separation of concerns. The architecture prioritizes:

- **Security** — Protection of sensitive medical data (PHI) through role-based access control
- **Maintainability** — Clear separation between layers prevents coupling
- **Testability** — Business logic isolated in services enables comprehensive testing
- **Scalability** — Stateless API design supports horizontal scaling

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT APPLICATIONS                          │
│                    (Frontend, Mobile, Integrations)                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS / REST API
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           ROUTES LAYER                               │
│                         (routes/api.php)                             │
│          Endpoint definitions, middleware assignment                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MIDDLEWARE LAYER                             │
│            Authentication, Role Verification, Rate Limiting          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CONTROLLER LAYER                              │
│         Request handling, response formatting, delegation            │
│                 (app/Http/Controllers/Api/)                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
┌─────────────────────────────────┐ ┌─────────────────────────────────┐
│       FORM REQUEST LAYER        │ │         POLICY LAYER            │
│    Input validation, request    │ │   Authorization rules, access   │
│        authorization            │ │         control logic           │
│   (app/Http/Requests/)          │ │     (app/Policies/)             │
└─────────────────────────────────┘ └─────────────────────────────────┘
                          │                   │
                          └─────────┬─────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER                                │
│            Business logic, workflow orchestration                    │
│                     (app/Services/)                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          MODEL LAYER                                 │
│        Eloquent models, relationships, query scopes                  │
│                      (app/Models/)                                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DATABASE LAYER                               │
│                   MySQL with defined schema                          │
│                   (database/migrations/)                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Layered Architecture

The application implements a strict layered architecture where each layer has defined responsibilities and dependencies flow only downward.

### Layer Responsibilities

#### Routes Layer

**Location:** `routes/api.php`

**Responsibilities:**
- Define all API endpoints
- Assign middleware to routes and groups
- Bind route parameters to models
- Organize endpoints by domain

**Constraints:**
- No business logic
- No direct database access
- No response formatting

#### Middleware Layer

**Location:** `app/Http/Middleware/`

**Responsibilities:**
- Authentication verification via Sanctum
- Role-based access control at route level
- Request preprocessing
- Cross-cutting concerns (CORS, rate limiting)

**Custom Middleware:**

| Middleware | Purpose |
|------------|---------|
| `AuditPhiAccess` | HIPAA-compliant audit logging for PHI access with graceful failure handling |
| `EnsureUserIsAdmin` | Restricts routes to admin users only |
| `EnsureUserHasRole` | Restricts routes to users with specified roles |

#### Controller Layer

**Location:** `app/Http/Controllers/Api/`

**Responsibilities:**
- Receive HTTP requests
- Invoke Form Request validation
- Delegate work to Services
- Format and return HTTP responses

**Constraints:**
- Controllers must be thin (no business logic)
- No direct database queries
- No complex conditionals or loops
- All work delegated to services

**Pattern Example:**

```php
public function store(StoreApplicationRequest $request)
{
    $application = $this->applicationService->create(
        $request->validated()
    );

    return response()->json($application, 201);
}
```

#### Form Request Layer

**Location:** `app/Http/Requests/`

**Responsibilities:**
- Validate incoming request data
- Authorize request execution
- Transform and sanitize input
- Return validation error responses

**Validation Organization:**

```
Requests/
├── Auth/
│   ├── RegisterRequest.php
│   └── LoginRequest.php
├── Camper/
│   ├── StoreCamperRequest.php
│   └── UpdateCamperRequest.php
├── Application/
│   ├── StoreApplicationRequest.php
│   ├── UpdateApplicationRequest.php
│   ├── ReviewApplicationRequest.php
│   └── SignApplicationRequest.php
└── ...
```

#### Policy Layer

**Location:** `app/Policies/`

**Responsibilities:**
- Define authorization rules for model operations
- Enforce ownership and relationship constraints
- Provide fine-grained access control
- Return authorization decisions

**Policy Registration:**

Policies are automatically discovered through Laravel's policy auto-discovery or explicitly registered in `AuthServiceProvider`.

#### Service Layer

**Location:** `app/Services/`

**Responsibilities:**
- Contain all business logic
- Orchestrate complex workflows
- Coordinate between multiple models
- Handle external service integrations
- Manage transactions for multi-step operations

**Service Design Principles:**
- One service per domain responsibility
- Services are stateless
- Services accept and return simple data structures
- Services throw exceptions for error conditions

#### Jobs Layer

**Location:** `app/Jobs/`

**Responsibilities:**
- Handle asynchronous background processing
- Implement retry logic with exponential backoff
- Process notifications, emails, and long-running tasks
- Queue work that doesn't need immediate completion

**Key Jobs:**

| Job | Purpose | Queue | Retries |
|-----|---------|-------|---------|
| SendNotificationJob | Async email notification dispatch | notifications | 3 (60s, 300s, 900s backoff) |

**Job Design Principles:**
- Jobs are idempotent (safe to run multiple times)
- Jobs fail gracefully and log errors
- Jobs use specific queues for prioritization
- Jobs have defined retry strategies

#### Traits

**Location:** `app/Traits/`

**Responsibilities:**
- Provide reusable functionality across controllers
- Encapsulate common patterns
- Reduce code duplication
- Maintain clean, DRY controllers

**Key Traits:**

| Trait | Purpose | Used By |
|-------|---------|---------|
| QueuesNotifications | Helper for dispatching notification jobs | ApplicationController |

#### Model Layer

**Location:** `app/Models/`

**Responsibilities:**
- Define database table mappings
- Declare relationships between entities
- Provide query scopes for common filters
- Cast attributes to appropriate types
- Hide sensitive fields from serialization

**Model Features:**
- Explicit relationship definitions with foreign keys
- Computed attributes via accessors
- Domain-specific methods (e.g., `isEditable()`)
- Query scopes for filtering (e.g., `scopeDraft()`)

---

## Domain Subsystems

The application is organized into logical domain subsystems, each handling a specific area of functionality.

### Authentication Subsystem

**Purpose:** User registration, login, logout, password management, and multi-factor authentication.

**Components:**
- `AuthController` — Registration, login, logout endpoints
- `MfaController` — MFA setup, verification, disable
- `PasswordResetController` — Password reset flow
- `AuthService` — Authentication business logic
- `MfaService` — MFA secret generation and verification
- `PasswordResetService` — Reset token management

**Data Flow:**
```
Registration: Client → AuthController → AuthService → User Model → Database
Login: Client → AuthController → AuthService → Sanctum Token → Response
MFA: Client → MfaController → MfaService → Google2FA → User Model
```

### Camp Management Subsystem

**Purpose:** Define and manage camp programs and sessions.

**Components:**
- `CampController` — Camp CRUD operations
- `CampSessionController` — Session CRUD operations
- `Camp` Model — Camp entity
- `CampSession` Model — Session entity with dates, capacity, age limits

**Relationships:**
```
Camp (1) ──────< CampSession (many)
                      │
                      └──────< Application (many)
```

### Camper Management Subsystem

**Purpose:** Manage camper profiles and their relationship to parent users.

**Components:**
- `CamperController` — Camper CRUD operations
- `CamperPolicy` — Authorization for camper operations
- `Camper` Model — Camper profile with DOB, gender

**Relationships:**
```
User (parent) (1) ──────< Camper (many)
                              │
                              ├──────< Application (many)
                              ├────── MedicalRecord (1)
                              ├──────< EmergencyContact (many)
                              ├──────< Allergy (many)
                              └──────< Medication (many)
```

### Application Subsystem

**Purpose:** Manage the full application lifecycle from draft to approved/rejected.

**Components:**
- `ApplicationController` — Application operations and review
- `ApplicationPolicy` — Authorization for application operations
- `Application` Model — Application with status, signature, review data
- `ApplicationStatus` Enum — Status values and transitions

**Application Status Flow:**
```
┌─────────┐    Submit    ┌──────────────┐    Review    ┌──────────┐
│  Draft  │ ───────────> │ Under Review │ ───────────> │ Approved │
│(pending)│              │              │              └──────────┘
└─────────┘              └──────────────┘                   │
                               │                            │
                               │ Review                     │
                               ▼                            ▼
                         ┌──────────┐              ┌───────────┐
                         │ Rejected │              │ Cancelled │
                         └──────────┘              └───────────┘
```

### Medical Information Subsystem

**Purpose:** Securely manage protected health information (PHI).

**Components:**
- `MedicalRecordController` — Medical record operations
- `AllergyController` — Allergy management
- `MedicationController` — Medication management
- `EmergencyContactController` — Emergency contact management
- `MedicalProviderLinkController` — Provider access tokens
- `MedicalProviderLinkService` — Provider workflow logic
- Associated Policies — Authorization for each entity

**Provider Link Flow:**
```
Parent creates link → Link emailed to provider → Provider accesses form
                                                        │
                                                        ▼
                                               Provider submits data
                                                        │
                                                        ▼
                                          Medical data saved, link marked used
                                                        │
                                                        ▼
                                          Parent and admin notified
```

### Document Management Subsystem

**Purpose:** Handle secure document uploads with validation and scanning.

**Components:**
- `DocumentController` — Upload, download, delete operations
- `DocumentService` — File validation, storage, security scanning
- `DocumentPolicy` — Authorization for document access
- `Document` Model — Polymorphic file metadata

**Document Processing Flow:**
```
Upload → MIME Validation → Size Validation → Storage → Security Scan (async)
                                                              │
                                                              ▼
                                                    Scan result recorded
                                                              │
                                                              ▼
                                              Download allowed if scan passed
```

### Reporting Subsystem

**Purpose:** Generate administrative reports for camp management.

**Components:**
- `ReportController` — Report endpoint access
- `ReportService` — Report generation logic
- `LetterService` — Acceptance/rejection letter generation

**Available Reports:**
- Applications summary with filters
- Accepted applicants list
- Rejected applicants list
- Mailing labels data
- ID labels with allergy information

### Notification Subsystem

**Purpose:** Send and track user notifications.

**Components:**
- `NotificationController` — List and mark notifications
- Notification classes — Individual notification types
- Laravel Notifications — Framework notification system

**Notification Channels:**
- Email (primary)
- Database (for notification history)

---

## Data Flow

### Typical Request Flow

```
1. Client sends HTTP request to API endpoint
                │
                ▼
2. Route middleware authenticates request (Sanctum)
                │
                ▼
3. Route middleware verifies role (if required)
                │
                ▼
4. Controller receives request
                │
                ▼
5. Form Request validates input data
                │
                ▼
6. Controller invokes policy authorization
                │
                ▼
7. Controller delegates to service method
                │
                ▼
8. Service executes business logic
                │
                ▼
9. Service interacts with models/database
                │
                ▼
10. Controller formats response
                │
                ▼
11. Response returned to client
```

### Error Handling Flow

```
Validation Error (Step 5):
    → Form Request returns 422 with error details

Authorization Error (Step 6):
    → Policy returns 403 Forbidden

Business Logic Error (Step 8):
    → Service throws exception
    → Controller catches and returns appropriate error response

Database Error (Step 9):
    → Exception handler logs error
    → Returns 500 with generic message (production)
    → Returns 500 with details (development)
```

---

## Authentication and Authorization

### Authentication Model

The system uses **token-based authentication** via Laravel Sanctum:

1. User authenticates with email/password
2. Server validates credentials and optional MFA code
3. Server generates API token
4. Client includes token in `Authorization: Bearer {token}` header
5. Middleware validates token on each request

### Multi-Factor Authentication

TOTP-based MFA using Google2FA library:

1. User enables MFA via setup endpoint
2. Server generates secret and QR code URL
3. User scans QR code with authenticator app
4. User verifies with 6-digit code
5. Server confirms and enables MFA
6. Future logins require email, password, and TOTP code

### Role-Based Access Control

Three primary roles with distinct access levels:

| Role | Description | Access Level |
|------|-------------|--------------|
| `admin` | Camp administrators | Full system access |
| `parent` | Parents/guardians | Own campers and applications |
| `medical` | Medical providers | Health information only |

### Authorization Enforcement

Authorization is enforced at multiple levels:

1. **Route Level** — Middleware restricts entire routes
2. **Policy Level** — Fine-grained model operation control
3. **Relationship Level** — Ownership verification in policies

**Example Policy Logic:**

```
Can user view application?
    ├── User is admin? → Allow
    ├── User is parent of camper? → Allow
    └── Otherwise → Deny
```

---

## Database Design

### Entity Relationship Model

```
┌──────────┐       ┌──────────┐       ┌──────────────┐
│  roles   │◄──────│  users   │──────►│   sessions   │
└──────────┘   1:N └──────────┘   1:N └──────────────┘
                        │
                        │ 1:N
                        ▼
                   ┌──────────┐
                   │ campers  │
                   └──────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
         ▼              ▼              ▼
┌─────────────┐  ┌───────────┐  ┌────────────────┐
│applications │  │med_records│  │emergency_      │
└─────────────┘  └───────────┘  │contacts        │
         │              │       └────────────────┘
         │              │
         ▼              ├──────┬───────────┐
┌─────────────┐         │      │           │
│camp_sessions│         ▼      ▼           ▼
└─────────────┘   ┌─────────┐ ┌───────┐ ┌───────────┐
         │        │allergies│ │meds   │ │documents  │
         ▼        └─────────┘ └───────┘ └───────────┘
    ┌────────┐
    │ camps  │
    └────────┘
```

### Key Design Decisions

1. **Explicit Foreign Keys** — All relationships use defined foreign key constraints
2. **Unique Constraints** — Prevent duplicate applications per camper per session
3. **Indexing** — Strategic indexes on frequently queried columns
4. **Soft References** — Nullable foreign keys where appropriate (e.g., `reviewed_by`)
5. **Polymorphic Relations** — Documents use polymorphic relations for flexibility

---

## Service Layer Design

### Service Responsibilities

| Service | Responsibility |
|---------|----------------|
| `AuthService` | User registration, login, credential validation |
| `MfaService` | MFA setup, verification, disable |
| `PasswordResetService` | Reset token generation, password update |
| `DocumentService` | File upload, validation, scanning, storage |
| `MedicalProviderLinkService` | Provider link lifecycle, submission processing |
| `ReportService` | Report data aggregation and formatting |
| `LetterService` | Acceptance/rejection letter content |

### Service Patterns

**Input/Output Pattern:**
```php
public function create(array $data): Model
{
    // Validate business rules
    // Execute database operations
    // Trigger notifications
    // Return result
}
```

**Error Handling Pattern:**
```php
public function process(array $data): array
{
    return [
        'success' => true|false,
        'message' => 'Description',
        'data' => $result,
        'errors' => $errors,
    ];
}
```

---

## API Design Principles

### RESTful Conventions

The API follows REST conventions:

- `GET /resources` — List resources
- `GET /resources/{id}` — Retrieve single resource
- `POST /resources` — Create resource
- `PUT /resources/{id}` — Update resource
- `DELETE /resources/{id}` — Delete resource

### Response Format

All responses use JSON format:

**Success Response:**
```json
{
    "id": 1,
    "attribute": "value",
    "created_at": "2024-01-01T00:00:00.000000Z"
}
```

**Collection Response:**
```json
{
    "data": [...],
    "meta": {
        "total": 100,
        "per_page": 15,
        "current_page": 1
    }
}
```

**Error Response:**
```json
{
    "message": "Error description",
    "errors": {
        "field": ["Validation message"]
    }
}
```

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Successful GET/PUT/DELETE |
| 201 | Successful POST (created) |
| 204 | Successful DELETE (no content) |
| 400 | Bad request |
| 401 | Unauthenticated |
| 403 | Forbidden |
| 404 | Not found |
| 422 | Validation error |
| 500 | Server error |

---

## Scalability Considerations

### Stateless Design

The API is stateless:
- No server-side session storage
- Token-based authentication
- Each request contains all necessary context

This enables horizontal scaling across multiple application servers.

### Database Optimization

- Indexed columns for frequent queries
- Eager loading to prevent N+1 queries
- Pagination for list endpoints
- Query scopes for reusable filters

### Asynchronous Processing

Document security scanning is designed for asynchronous processing:
- Upload returns immediately
- Scan runs in background
- Download checks scan status

---

## Maintainability and Extensibility

### Adding New Features

To add a new domain feature:

1. Create migration for database schema
2. Create Eloquent model with relationships
3. Create Form Request classes for validation
4. Create Policy for authorization
5. Create Service for business logic
6. Create Controller with thin methods
7. Add routes to `routes/api.php`
8. Write feature tests

### Modifying Existing Features

Changes should follow the layer where the change belongs:

- Database schema → New migration (never modify existing)
- Validation rules → Form Request class
- Authorization rules → Policy class
- Business logic → Service class
- Endpoint behavior → Controller method
- Route structure → routes/api.php

### Code Organization

The codebase follows consistent naming and organization:

- Controllers: `{Model}Controller`
- Form Requests: `Store{Model}Request`, `Update{Model}Request`
- Policies: `{Model}Policy`
- Services: `{Domain}Service`
- Notifications: `{Event}Notification`

This consistency enables developers to quickly locate and understand code.
