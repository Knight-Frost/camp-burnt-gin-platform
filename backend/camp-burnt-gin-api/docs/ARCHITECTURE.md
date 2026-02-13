# System Architecture

This document provides a comprehensive overview of the Camp Burnt Gin API architecture, including design patterns, technology choices, component organization, and architectural decisions that guide system implementation and maintenance.

---

## 1. High-Level Overview

The Camp Burnt Gin API is a Laravel 12-based RESTful backend designed to manage camp registration, medical records, staff workflows, and administrative oversight. The system serves as the authoritative data source for all camp operations and is built to handle Protected Health Information (PHI) in compliance with HIPAA security requirements.

### Purpose

Provide a secure, scalable, and maintainable API backend that enables:
- Secure management of camper registration and applications
- Protected storage and access of medical information (PHI)
- Role-based authorization for parents, administrators, and medical providers
- Comprehensive audit logging for compliance
- Integration with future frontend applications

### Key Goals

| Goal | Description |
|------|-------------|
| **Security** | Token-based authentication, role-based access control, PHI encryption, audit logging |
| **Modularity** | Layered architecture with clear separation of concerns |
| **Scalability** | Stateless API design supporting horizontal scaling |
| **Maintainability** | Service layer isolation, comprehensive testing, consistent patterns |

---

## 2. Architecture Style

### RESTful API Pattern

The system implements a **RESTful API architecture** using Laravel 12's routing and controller conventions. All client interactions occur through stateless HTTP requests using standard REST verbs (GET, POST, PUT, DELETE).

### Layered Architecture

The application follows a strict **layered architecture** where each layer has defined responsibilities and dependencies flow downward only:

```
Client Layer (Frontend/Mobile)
        ↓
Routes Layer (Endpoint definitions)
        ↓
Middleware Layer (Auth, RBAC, Rate limiting)
        ↓
Controller Layer (Request handling)
        ↓
Form Request Layer (Validation) + Policy Layer (Authorization)
        ↓
Service Layer (Business logic)
        ↓
Model Layer (Data access, relationships)
        ↓
Database Layer (MySQL persistence)
```

### Separation of Concerns

Each layer has a single, well-defined responsibility:

- **Controllers** — Receive requests, delegate to services, return responses
- **Services** — Contain all business logic and orchestrate workflows
- **Models** — Represent database entities and relationships
- **Policies** — Enforce authorization rules
- **Form Requests** — Validate and sanitize input data

This separation ensures:
- Business logic is testable in isolation
- Controllers remain thin and focused
- Database queries are encapsulated in models
- Authorization is consistent across endpoints

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend Framework** | Laravel 12 | RESTful API framework with ORM, routing, middleware |
| **Language** | PHP 8.2+ | Modern PHP with type declarations and error handling |
| **Database** | MySQL 8.0+ | Relational storage with foreign key constraints |
| **Authentication** | Laravel Sanctum | Token-based API authentication |
| **Authorization** | Laravel Policies | Role-based access control (RBAC) |
| **Multi-Factor Auth** | PragmaRX Google2FA | TOTP-based MFA implementation |
| **Notifications** | Laravel Notifications | Email and database notification delivery |
| **Queue System** | Laravel Queues | Asynchronous job processing (emails, document scanning) |
| **Testing** | PHPUnit + Laravel Testing | Unit and feature test framework |
| **File Storage** | Laravel Storage | Secure file upload and retrieval |
| **Validation** | Laravel Form Requests | Input validation with custom rules |

---

## 4. Directory Structure

### Application Directory (`app/`)

```
app/
├── Http/
│   ├── Controllers/Api/     # API endpoint controllers (domain-organized)
│   │   ├── Auth/           # Authentication controllers
│   │   ├── Camp/           # Camp management controllers
│   │   ├── Camper/         # Camper and application controllers
│   │   ├── Document/       # Document and provider link controllers
│   │   ├── Medical/        # Medical record controllers
│   │   └── System/         # System health and notification controllers
│   ├── Requests/            # Form request validation classes (domain-organized)
│   └── Middleware/          # Custom middleware (audit logging, role checks)
├── Services/                # Business logic (domain-organized)
│   ├── Auth/               # Authentication services
│   ├── Camper/             # Application workflow services
│   ├── Document/           # Document enforcement services
│   ├── Medical/            # Medical assessment services
│   └── System/             # Reporting and letter services
├── Models/                  # Eloquent models and relationships
├── Policies/                # Authorization rules for model operations
├── Notifications/           # Notification classes (domain-organized)
│   ├── Auth/               # Authentication notifications
│   ├── Camper/             # Application notifications
│   ├── Document/           # Provider link notifications
│   ├── Medical/            # Medical update notifications
│   └── System/             # System-level notifications
├── Jobs/                    # Asynchronous queue jobs
├── Traits/                  # Reusable functionality (notifications, etc.)
└── Enums/                   # Enumeration classes (statuses, roles, severity levels)
```

### Database Directory (`database/`)

```
database/
├── migrations/              # Database schema definitions (timestamped)
├── seeders/                 # Development and test data seeders
└── factories/               # Model factories for testing
```

### Routes Directory (`routes/`)

```
routes/
├── api.php                  # API endpoint definitions (all /api/* routes)
└── web.php                  # Web routes (minimal, not used for API)
```

### Documentation Directory (`docs/`)

```
docs/
├── API_OVERVIEW.md          # API capabilities overview
├── API_REFERENCE.md         # Complete endpoint documentation
├── ARCHITECTURE.md          # This document
├── SECURITY.md              # Security architecture and HIPAA compliance
├── TESTING.md               # Testing strategy and execution
└── ...                      # Additional technical documentation
```

### Tests Directory (`tests/`)

```
tests/
├── Feature/                 # End-to-end API endpoint tests
├── Unit/                    # Isolated component tests (services, models)
└── TestCase.php             # Base test case with shared utilities
```

---

## 5. Core Components

### Authentication System

**Technology:** Laravel Sanctum token-based authentication

**Components:**
- `Auth\AuthController` — Registration, login, logout endpoints
- `Auth\AuthService` — Credential validation, token generation
- `Auth\MfaController` — Multi-factor authentication setup and verification
- `Auth\MfaService` — TOTP secret generation and code validation

**Features:**
- Email and password authentication
- TOTP-based multi-factor authentication (Google Authenticator compatible)
- Token expiration and revocation
- Account lockout after failed attempts
- Password reset flow

### Application Workflow Engine

**Purpose:** Manage complete application lifecycle from draft to final decision

**Components:**
- `Camper\ApplicationController` — Application operations
- `Camper\ApplicationService` — Application approval workflow and compliance
- `ApplicationPolicy` — Authorization rules
- `Application` Model — Application data with status tracking
- `ApplicationStatus` Enum — Valid status values and transitions

**Features:**
- Draft mode with auto-save capability
- Digital signature capture
- Status workflow (pending → under review → approved/rejected/waitlisted)
- Admin review with notes
- Automatic notification dispatch
- Acceptance and rejection letter generation

### Role-Based Authorization

**Technology:** Laravel Policies with custom middleware

**Roles:**
- `admin` — Full system access, application review, reporting
- `parent` — Own campers and applications only
- `medical` — Medical information access via provider links (token-based, no user account)

**Enforcement Layers:**
1. **Route Middleware** — Restricts entire routes by role
2. **Policy Layer** — Fine-grained model-level authorization
3. **Relationship Validation** — Ownership checks (e.g., parent owns camper)

### Audit Logging System

**Purpose:** HIPAA-compliant audit trail for PHI access

**Implementation:**
- `AuditPhiAccess` Middleware — Logs all PHI-related requests
- `AuditLog` Model — Stores access records with user, resource, timestamp, IP
- Graceful failure handling (logging failures do not block requests)

**Logged Actions:**
- Medical record access (view, create, update)
- Allergy and medication access
- Emergency contact access
- Document downloads
- Provider link creation and revocation

### Document Upload System

**Purpose:** Secure file upload with validation and security scanning

**Components:**
- `Document\DocumentController` — Upload, download, delete operations
- `Document\DocumentEnforcementService` — Document compliance and validation
- `DocumentPolicy` — Authorization for document access
- `Document` Model — Polymorphic file metadata

**Features:**
- MIME type validation
- File size limits (10 MB)
- Dangerous extension detection
- Security scanning (async, blocks download until passed)
- Polymorphic attachment (documents can attach to campers, applications, medical records)

### Multi-Factor Authentication (MFA) System

**Technology:** PragmaRX Google2FA (TOTP-based)

**Workflow:**
1. User enables MFA via setup endpoint
2. System generates secret and QR code URL
3. User scans QR code with authenticator app
4. User verifies with 6-digit code
5. System enables MFA for user account
6. Future logins require email + password + TOTP code

**Security Features:**
- Cryptographically secure secret generation
- Rate limiting on MFA verification attempts
- Fallback mechanism (future enhancement)

---

## 6. Data Flow

### Request Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Client sends HTTP request to /api/* endpoint             │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Route matches endpoint definition in routes/api.php      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Middleware validates authentication token (Sanctum)      │
│    → Token missing/invalid: Return 401 Unauthorized         │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Middleware verifies user role (if required)              │
│    → Insufficient role: Return 403 Forbidden                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Controller method invoked                                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Form Request validates input data                        │
│    → Validation fails: Return 422 with field errors         │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Policy checks authorization for action                   │
│    → Authorization fails: Return 403 Forbidden              │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Controller delegates to Service method                   │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. Service executes business logic                          │
│    - Coordinates multiple models                            │
│    - Enforces business rules                                │
│    - Manages database transactions                          │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. Service interacts with Model(s)                         │
│     Models query database via Eloquent ORM                  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 11. Service returns result to Controller                    │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 12. Controller formats HTTP response (JSON)                 │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 13. Response returned to client with appropriate status code│
└─────────────────────────────────────────────────────────────┘
```

### Controller → Service → Model Example

**Controller (Thin):**
```php
public function store(StoreApplicationRequest $request)
{
    $application = $this->applicationService->create(
        $request->validated()
    );

    return response()->json($application, 201);
}
```

**Service (Business Logic):**
```php
public function create(array $data): Application
{
    // Validate business rules
    $this->validateUniqueApplication($data['camper_id'], $data['camp_session_id']);

    // Create application with transaction
    DB::beginTransaction();
    try {
        $application = Application::create($data);
        $this->notifyApplicationCreated($application);
        DB::commit();
        return $application;
    } catch (\Exception $e) {
        DB::rollBack();
        throw $e;
    }
}
```

**Model (Data Access):**
```php
class Application extends Model
{
    protected $fillable = ['camper_id', 'camp_session_id', 'status'];

    public function camper()
    {
        return $this->belongsTo(Camper::class);
    }

    public function campSession()
    {
        return $this->belongsTo(CampSession::class);
    }
}
```

---

## 7. Security Architecture

### Token-Based Authentication

**Implementation:** Laravel Sanctum API tokens

- Tokens generated on successful login
- Tokens transmitted via `Authorization: Bearer {token}` header
- Tokens validated on every request via middleware
- Tokens expire after configurable period (default: 60 minutes)
- Tokens revoked on logout

### Authorization Policies

**Ownership Model:**
- Parents can only access their own campers and applications
- Admins have full access to all resources
- Medical providers access specific records via secure tokens

**Policy Enforcement:**
- All model operations protected by policies
- Authorization checked before service layer execution
- Consistent authorization logic across all endpoints

### IDOR Prevention

**Insecure Direct Object Reference** attacks are prevented through:

1. **Policy Layer** — Verifies user has permission to access resource
2. **Relationship Validation** — Confirms ownership relationships (e.g., user → camper → application)
3. **Database Constraints** — Foreign keys enforce referential integrity

### Input Validation

**Form Request Classes:**
- All input validated before reaching controllers
- Custom validation rules for domain logic (age ranges, date constraints)
- Sanitization of user input
- Type casting and transformation

### Audit Logging

**PHI Access Logging:**
- All access to medical records, allergies, medications logged
- Logs include user, resource, timestamp, IP address, user agent
- Logs are tamper-evident (no update/delete operations)
- Graceful failure (logging errors do not block API requests)

### Secure File Handling

**Document Security:**
- MIME type validation prevents executable uploads
- File extension checking blocks dangerous file types
- Security scanning detects malware patterns
- Unscanned files blocked from download (non-admin users)
- Polymorphic storage prevents direct file access

---

## 8. Scalability & Performance

### Stateless API Design

The API is fully stateless:
- No server-side session storage
- All authentication via tokens
- Each request contains complete context

**Benefits:**
- Horizontal scaling across multiple application servers
- Load balancing without session affinity
- High availability with minimal coordination

### Database Optimization

**Indexing Strategy:**
- Foreign keys indexed automatically
- Frequently queried columns indexed explicitly
- Composite indexes for multi-column queries
- Unique indexes for constraint enforcement

**Query Optimization:**
- Eager loading prevents N+1 query problems
- Query scopes encapsulate reusable filters
- Pagination reduces memory consumption
- Select only required columns

### Service Layer Separation

**Benefits:**
- Business logic isolated from controllers enables caching at service layer
- Database-agnostic service interfaces support future optimizations
- Transaction management centralized in services

### Asynchronous Processing

**Queue System:**
- Email notifications dispatched to queues
- Document security scanning runs asynchronously
- Long-running reports can be queued
- Retry logic with exponential backoff

### Horizontal Scaling Considerations

The architecture supports horizontal scaling:

1. **Database Layer** — MySQL supports read replicas for scaling reads
2. **Application Layer** — Stateless design allows multiple app servers
3. **Queue Layer** — Queue workers can scale independently
4. **File Storage Layer** — Can migrate to S3-compatible storage for distributed access

---

## 9. Future Expansion

The architecture is designed to support future growth and feature additions:

### Extensibility Points

| Extension | How Architecture Supports It |
|-----------|------------------------------|
| **Additional User Roles** | Role-based middleware and policies are extensible |
| **External Integrations** | Service layer can integrate with third-party APIs |
| **Real-Time Notifications** | Queue system can be extended with WebSocket broadcasting |
| **Advanced Reporting** | Report service can be extended with new report types |
| **Mobile Applications** | RESTful API supports any HTTP client |
| **Payment Processing** | Service layer can integrate payment gateway |
| **Calendar Integration** | Service layer can sync sessions with external calendars |

### Modularity Benefits

The layered architecture allows:
- **Independent Layer Updates** — Services can be refactored without changing controllers
- **Feature Toggles** — New features can be enabled/disabled via configuration
- **A/B Testing** — Service layer supports multiple implementations
- **Version Migration** — API versioning can be added at route level

### Maintainability

Consistent patterns across the codebase:
- Controllers follow identical structure
- Services use standard input/output patterns
- Models use consistent naming and relationship definitions
- Tests follow predictable organization

This consistency reduces onboarding time and maintenance burden.

---

## Summary

The Camp Burnt Gin API architecture prioritizes **security, maintainability, and scalability** through:

- **Layered design** with clear separation of concerns
- **RESTful API** following industry conventions
- **Token-based authentication** with multi-factor support
- **Role-based authorization** with fine-grained policies
- **Service layer isolation** for testable business logic
- **Comprehensive audit logging** for HIPAA compliance
- **Stateless design** supporting horizontal scaling

This architecture provides a solid foundation for current operations and future expansion.
