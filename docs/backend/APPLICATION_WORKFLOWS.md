# Application Workflows

This document provides a comprehensive overview of the application lifecycle, state transitions, and workflow processes within the Camp Burnt Gin API system.

---

## Table of Contents

1. [Workflow Overview](#workflow-overview)
2. [Application States and Transitions](#application-states-and-transitions)
3. [Creation and Draft Workflow](#creation-and-draft-workflow)
4. [Submission and Signature Workflow](#submission-and-signature-workflow)
5. [Review and Decision Workflow](#review-and-decision-workflow)
6. [Medical Provider Integration](#medical-provider-integration)
7. [Business Rules and Constraints](#business-rules-and-constraints)
8. [Error Handling](#error-handling)

---

## Workflow Overview

The application workflow manages the complete lifecycle of camp registration applications from creation through final decision, enforcing business rules and maintaining data integrity.

### Key Components

| Component | Role |
|-----------|------|
| Application Model | Registration request with status tracking |
| ApplicationController | API request handling |
| ApplicationService | Approval workflow and compliance management |
| ApplicationPolicy | Authorization enforcement |
| ApplicationStatus Enum | Valid states and transitions |
| Notification System | Status change alerts |
| Audit Logging | State transition recording for compliance |

### Workflow Participants

| Participant | Role | Key Actions |
|-------------|------|-------------|
| Parent | Creator | Create, edit, sign, cancel applications |
| Medical Provider | Healthcare professional | Submit medical info via secure link |
| Administrator | Camp staff | Review, approve, reject, waitlist |
| System | Automated process | Send notifications, enforce deadlines, log events |

---

## Application States and Transitions

### State Definitions

| State | Value | Description | Is Final | Is Editable |
|-------|-------|-------------|----------|-------------|
| Pending | pending | Initial state, not submitted | No | Yes |
| Under Review | under_review | Submitted and being reviewed | No | Yes |
| Approved | approved | Accepted for attendance | Yes | No |
| Rejected | rejected | Not accepted | Yes | No |
| Waitlisted | waitlisted | On waiting list | No | No |
| Cancelled | cancelled | Withdrawn by parent | Yes | No |

### State Transition Matrix

| From State | To State(s) | Trigger | Actor | Conditions |
|------------|-------------|---------|-------|------------|
| Pending | Under Review | Submit | Parent | Signature required, is_draft=false |
| Under Review | Approved | Review decision | Admin | Review notes optional |
| Under Review | Rejected | Review decision | Admin | Review notes required |
| Under Review | Waitlisted | Review decision | Admin | Review notes optional |
| Waitlisted | Approved | Review decision | Admin | Space available |
| Waitlisted | Rejected | Review decision | Admin | No space available |
| Any non-final | Cancelled | Cancellation | Parent | Cannot cancel final states |

### Prevented Transitions

- Cannot transition from any final state (approved, rejected, cancelled)
- Cannot skip pending → approved/rejected (must go through under_review)
- Cannot return to pending once submitted
- Cannot reverse rejected or cancelled status

---

## Creation and Draft Workflow

### Application Creation Flow

```
Parent Auth → Select Session → Select/Create Camper
    ↓
Validate Unique Constraint (one app per camper per session)
    ↓
Create Application (status=pending, is_draft=true)
    ↓
Return Application ID with editable=true
```

### Required Creation Data

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| camper_id | Integer | Yes | Must exist, owned by parent |
| camp_session_id | Integer | Yes | Must exist, active session |
| is_draft | Boolean | No | Defaults to true |
| status | Enum | No | Defaults to pending |

### Draft Mode Characteristics

| Property | Value |
|----------|-------|
| is_draft | true |
| status | pending |
| submitted_at | NULL |
| Editable | Yes |
| Visible to admin | No (filtered from review queue) |
| Can be deleted | Yes |

**Save/Update Draft:**
```http
POST /api/applications
PUT /api/applications/{id}
{
  "is_draft": true,
  "notes": "Partial data..."
}
```

---

## Submission and Signature Workflow

### Digital Signature Components

| Component | Description | Storage |
|-----------|-------------|---------|
| signature_data | Base64-encoded image | Database (hidden from API) |
| signature_name | Printed name | Database |
| signed_at | Signature timestamp | Database |
| signed_ip_address | Signer IP | Database |

### Signature Endpoint

```http
POST /api/applications/{id}/sign
{
  "signature_data": "data:image/png;base64,...",
  "signature_name": "Jane Doe"
}
```

**Authorization:** Parent owns camper OR admin

**Response:** 200 OK with signature confirmation

### Submission Process

```
Parent Reviews Draft → Adds Signature → Sets is_draft=false
    ↓
System Validates Completeness (422 if fails)
    ↓
Update: is_draft=false, status=under_review, submitted_at=now()
    ↓
Log Submission Event
    ↓
Queue Parent Notification
    ↓
Return 200 OK
```

### Submission Requirements

| Requirement | Status |
|-------------|--------|
| Camper profile | Must be complete |
| Camp session | Active, within registration window |
| Digital signature | signature_data, signature_name, signed_at required |
| Medical information | Recommended but not required |
| Emergency contacts | At least one recommended |

---

## Review and Decision Workflow

### Review Process

```
Admin Logs In → Views Applications (status=under_review)
    ↓
Reviews: Camper info, medical records, emergency contacts, notes
    ↓
Makes Decision: POST /api/applications/{id}/review
    ↓
System Validates (422 if invalid)
    ↓
Update: status, reviewed_at, reviewed_by, notes
    ↓
Log Review Event
    ↓
Queue Parent Notification
    ↓
Generate Letter (if approved/rejected)
    ↓
Return 200 OK
```

### Review Endpoint

```http
POST /api/applications/{id}/review
{
  "status": "approved",
  "notes": "Application approved. Meets all requirements."
}
```

**Validation:**
- `status`: Required, must be approved/rejected/waitlisted
- `notes`: Required for rejected, optional for approved/waitlisted

**Authorization:** Admin only

### Decision Notifications

| Event | Trigger | Recipients | Content |
|-------|---------|------------|---------|
| Submitted | status→under_review | Parent | Confirmation of submission |
| Approved | status→approved | Parent | Acceptance letter, camp details, next steps |
| Rejected | status→rejected | Parent | Polite rejection, explanation |
| Waitlisted | status→waitlisted | Parent | Waitlist notification |

**Notification Retry Policy:**
- Attempt 1: Immediate
- Attempt 2: After 60 seconds
- Attempt 3: After 5 minutes
- Attempt 4: After 15 minutes

---

## Medical Provider Integration

### Provider Link Creation Flow

```
Parent → Request Provider Input
    ↓
POST /api/medical-provider-links
{
  "camper_id": 1,
  "provider_email": "doctor@example.com",
  "message": "Please complete medical form"
}
    ↓
System Generates:
  - 64-character secure token
  - Expiration: 72 hours
  - Unique link URL
    ↓
Store Link Record (token, camper_id, email, expires_at)
    ↓
Queue Provider Email
    ↓
Return 201 with Link Details
```

### Provider Submission Flow

```
Provider Clicks Link → GET /api/provider-access/{token}
    ↓
Validate Token (exists, not expired, not used, not revoked)
    ↓
Display Medical Form (camper name read-only)
    ↓
Provider Submits → POST /api/provider-access/{token}/submit
    ↓
Validate Submission (422 if invalid)
    ↓
Update/Create Medical Records
    ↓
Mark Link Used (is_used=true, used_at=now())
    ↓
Log Provider Submission
    ↓
Notify Parent and Admin
    ↓
Return 200 OK
```

### Provider Link Revocation

```http
DELETE /api/medical-provider-links/{id}
```

**Effect:**
- Sets revoked_at to timestamp
- Link immediately invalid
- No notification to provider (security)

---

## Business Rules and Constraints

### Critical Constraints

| Rule | Enforcement | Error Response |
|------|-------------|----------------|
| Application uniqueness | DB constraint on (camper_id, camp_session_id) | HTTP 422: "Camper already has application for this session" |
| Registration window | Session registration_opens_at ≤ now ≤ registration_closes_at | HTTP 422: "Registration not currently open for this session" |
| Age requirements | camper_age_on_start >= min_age AND <= max_age | HTTP 422: "Camper does not meet age requirements" |
| Signature required | signature_data, signature_name, signed_at must be present | HTTP 422: "Application must be signed before submission" |
| Capacity limits | approved_count < session.capacity | Applications waitlisted when full |

### Age Calculation

```
camper_age_on_start = session_start_date - camper_date_of_birth
```

---

## Error Handling

### Common Error Scenarios

| Scenario | Handling | Mitigation |
|----------|----------|------------|
| Concurrent updates | Last write wins (Eloquent) | Frontend optimistic locking with versioning |
| Provider link expires during submit | HTTP 410 Gone | Parent generates new link, provider restarts |
| Cancel after approval | HTTP 422 error | Parent must contact administrator |
| Duplicate provider submission | Link marked used on first attempt, subsequent=410 | Disable submit button after click |
| Session deletion with apps | FK constraint prevents, HTTP 500 | Cancel apps or soft-delete session |
| Parent viewing others' apps | Policy filters, only own apps visible | Query scope: `where('campers.user_id', auth()->id())` |

---

## Cross-References

For related documentation, see:

- [API Reference](./API_REFERENCE.md) — Endpoint specifications
- [Data Model](./DATA_MODEL.md) — Database schema
- [Business Rules](./BUSINESS_RULES.md) — Complete rule catalog
- [Roles and Permissions](./ROLES_AND_PERMISSIONS.md) — Authorization matrix
- [Audit Logging](./AUDIT_LOGGING.md) — PHI access tracking
- [Error Handling](./ERROR_HANDLING.md) — Error patterns

---

**Document Status:** Authoritative
**Last Updated:** February 2026
**Version:** 1.0.0
