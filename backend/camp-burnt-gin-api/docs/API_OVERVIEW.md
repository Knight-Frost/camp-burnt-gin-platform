# API Overview

This document provides a comprehensive overview of the Camp Burnt Gin API capabilities, organized by functional domain. It is intended for developers integrating with the API, technical stakeholders evaluating system capabilities, and team members requiring an understanding of available functionality.

---

## Table of Contents

1. [API Fundamentals](#api-fundamentals)
2. [Authentication Domain](#authentication-domain)
3. [User Profile Domain](#user-profile-domain)
4. [Camp Management Domain](#camp-management-domain)
5. [Camper Management Domain](#camper-management-domain)
6. [Application Domain](#application-domain)
7. [Medical Information Domain](#medical-information-domain)
8. [Medical Provider Domain](#medical-provider-domain)
9. [Document Management Domain](#document-management-domain)
10. [Notification Domain](#notification-domain)
11. [Reporting Domain](#reporting-domain)
12. [Error Handling](#error-handling)

---

## API Fundamentals

### Base URL

All API endpoints are prefixed with `/api/`:

```
https://api.campburntgin.org/api/
```

### Authentication

Most endpoints require authentication via Laravel Sanctum tokens:

```http
Authorization: Bearer {token}
```

Tokens are obtained through the login endpoint and should be included in all subsequent requests.

### Content Type

All requests and responses use JSON:

```http
Content-Type: application/json
Accept: application/json
```

### Response Format

#### Success Response (Single Resource)

```json
{
    "id": 1,
    "attribute": "value",
    "created_at": "2024-01-01T00:00:00.000000Z",
    "updated_at": "2024-01-01T00:00:00.000000Z"
}
```

#### Success Response (Collection)

```json
{
    "data": [
        { "id": 1, "attribute": "value" },
        { "id": 2, "attribute": "value" }
    ],
    "meta": {
        "current_page": 1,
        "per_page": 15,
        "total": 100,
        "last_page": 7
    }
}
```

#### Error Response

```json
{
    "message": "Error description",
    "errors": {
        "field_name": ["Specific error message"]
    }
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Malformed request |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 422 | Unprocessable Entity | Validation errors |
| 500 | Server Error | Internal server error |

---

## Authentication Domain

The authentication domain handles user registration, login, logout, password management, and multi-factor authentication.

### Capabilities

| Capability | Description | Access |
|------------|-------------|--------|
| User Registration | Create new parent accounts | Public |
| User Login | Authenticate and receive token | Public |
| User Logout | Revoke current token | Authenticated |
| Password Reset Request | Initiate password reset flow | Public |
| Password Reset | Complete password reset | Public (with token) |
| MFA Setup | Initialize TOTP enrollment | Authenticated |
| MFA Verification | Confirm and enable MFA | Authenticated |
| MFA Disable | Remove MFA from account | Authenticated |

### Registration

New users register with email, password, and name. Accounts are created with the `parent` role by default.

**Required Fields:**
- `name` — User's full name
- `email` — Unique email address
- `password` — Minimum 8 characters, mixed case, numbers
- `password_confirmation` — Must match password

**Response:** User object with authentication token.

### Login

Users authenticate with email and password. If MFA is enabled, a 6-digit TOTP code is also required.

**Required Fields:**
- `email` — Registered email address
- `password` — Account password
- `mfa_code` — 6-digit code (if MFA enabled)

**Response:** User object with authentication token, or MFA required indicator.

### Multi-Factor Authentication

MFA adds an additional security layer using TOTP (Time-based One-Time Password):

1. **Setup** — Request returns secret key and QR code URL
2. **Verification** — Submit code to enable MFA
3. **Disable** — Submit code and password to disable MFA

---

## User Profile Domain

The user profile domain manages the authenticated user's account information.

### Capabilities

| Capability | Description | Access |
|------------|-------------|--------|
| View Profile | Retrieve current user information | Authenticated |
| Update Profile | Modify name and email | Authenticated |
| Pre-fill Data | Retrieve data for returning applicants | Authenticated |

### Profile Pre-fill

For returning families, the pre-fill endpoint provides:
- Latest camper information
- Associated medical records
- Emergency contacts
- All registered campers for selection

This enables fast application completion for families with prior applications.

---

## Camp Management Domain

The camp management domain handles camp programs and session scheduling.

### Capabilities

| Capability | Description | Access |
|------------|-------------|--------|
| List Camps | View all camp programs | Public (active only) / Admin (all) |
| View Camp | View camp details with sessions | Public |
| Create Camp | Add new camp program | Admin |
| Update Camp | Modify camp information | Admin |
| Delete Camp | Remove camp program | Admin |
| List Sessions | View camp sessions | Public (active only) / Admin (all) |
| View Session | View session details | Public |
| Create Session | Add new session | Admin |
| Update Session | Modify session information | Admin |
| Delete Session | Remove session | Admin |

### Camp Information

Camps include:
- Name and description
- Location
- Active status

### Session Information

Sessions include:
- Associated camp
- Session name and dates
- Capacity limits
- Age requirements (min/max)
- Registration window (open/close dates)
- Active status

---

## Camper Management Domain

The camper management domain handles camper profiles and their relationship to parent users.

### Capabilities

| Capability | Description | Access |
|------------|-------------|--------|
| List Campers | View campers | Admin (all) / Parent (own) |
| View Camper | View camper details | Admin / Parent (own) |
| Create Camper | Register new camper | Admin / Parent |
| Update Camper | Modify camper information | Admin / Parent (own) |
| Delete Camper | Remove camper profile | Admin / Parent (own) |

### Camper Information

Campers include:
- First and last name
- Date of birth
- Gender
- Parent/guardian association

### Ownership Model

Parents can only view and manage campers they have created. Administrators have full access to all campers.

---

## Application Domain

The application domain manages the complete application lifecycle from creation to final decision.

### Capabilities

| Capability | Description | Access |
|------------|-------------|--------|
| List Applications | View applications with filtering | Admin (all) / Parent (own) |
| View Application | View application details | Admin / Parent (own) |
| Create Application | Submit new application | Admin / Parent |
| Update Application | Modify application | Admin / Parent (if editable) |
| Sign Application | Add digital signature | Parent (own) |
| Review Application | Approve/reject application | Admin |
| Delete Application | Remove application | Admin |

### Application States

| Status | Description | Next States |
|--------|-------------|-------------|
| Pending | Initial state, not submitted | Under Review |
| Under Review | Being reviewed by admin | Approved, Rejected, Waitlisted |
| Approved | Accepted (final) | — |
| Rejected | Not accepted (final) | — |
| Waitlisted | On waitlist | Approved, Rejected |
| Cancelled | Cancelled by applicant (final) | — |

### Draft Mode

Applications can be saved as drafts:
- Drafts are not submitted for review
- Partial data can be saved
- Drafts can be updated until submission
- Submission transitions to pending/under_review

### Digital Signatures

Applications require digital signatures:
- Signature data captured
- Signer name recorded
- Timestamp and IP address recorded
- Signature required before review

### Search and Filtering

Application lists support:
- Search by camper name or parent email
- Filter by status
- Filter by camp session
- Filter by date range
- Sorting options

### Application Review

Administrators review applications:
- Status change (approve, reject, waitlist)
- Review notes
- Reviewer and timestamp recorded
- Automatic notification to parent
- Automatic acceptance/rejection letters

---

## Medical Information Domain

The medical information domain handles Protected Health Information (PHI) for campers.

### Medical Records

| Capability | Description | Access |
|------------|-------------|--------|
| List Records | View all medical records | Admin / Medical Provider |
| View Record | View record details | Admin / Medical / Parent (own) |
| Create Record | Create medical record | Admin / Parent |
| Update Record | Modify medical record | Admin / Medical / Parent (own) |
| Delete Record | Remove medical record | Admin |

**Record Contents:**
- Physician name and phone
- Insurance provider and policy number
- Special needs
- Dietary restrictions
- Additional notes

### Allergies

| Capability | Description | Access |
|------------|-------------|--------|
| List Allergies | View all allergies | Admin / Medical Provider |
| View Allergy | View allergy details | Admin / Medical / Parent (own) |
| Create Allergy | Add allergy record | Admin / Medical / Parent |
| Update Allergy | Modify allergy | Admin / Medical / Parent (own) |
| Delete Allergy | Remove allergy | Admin / Parent (own) |

**Allergy Information:**
- Allergen name
- Severity (mild, moderate, severe, life-threatening)
- Reaction description
- Treatment protocol

### Medications

| Capability | Description | Access |
|------------|-------------|--------|
| List Medications | View all medications | Admin / Medical Provider |
| View Medication | View medication details | Admin / Medical / Parent (own) |
| Create Medication | Add medication record | Admin / Medical / Parent |
| Update Medication | Modify medication | Admin / Medical / Parent (own) |
| Delete Medication | Remove medication | Admin / Parent (own) |

**Medication Information:**
- Medication name
- Dosage
- Frequency
- Purpose
- Prescribing physician
- Additional notes

### Emergency Contacts

| Capability | Description | Access |
|------------|-------------|--------|
| List Contacts | View all contacts | Admin / Medical Provider |
| View Contact | View contact details | Admin / Medical / Parent (own) |
| Create Contact | Add contact | Admin / Parent |
| Update Contact | Modify contact | Admin / Parent (own) |
| Delete Contact | Remove contact | Admin / Parent (own) |

**Contact Information:**
- Contact name
- Relationship to camper
- Primary phone
- Secondary phone
- Email address
- Primary contact flag
- Authorized pickup flag

---

## Medical Provider Domain

The medical provider domain enables secure, unauthenticated access for healthcare providers to submit medical information.

### Capabilities

| Capability | Description | Access |
|------------|-------------|--------|
| Create Provider Link | Generate secure link | Admin / Parent |
| List Provider Links | View generated links | Admin / Parent (own) |
| View Provider Link | View link details | Admin / Parent (own) |
| Revoke Provider Link | Invalidate link | Admin / Parent (own) |
| Resend Provider Link | Send new notification | Admin |
| Access Provider Form | View submission form | Token bearer |
| Submit Medical Data | Submit health information | Token bearer |
| Upload Documents | Attach medical documents | Token bearer |

### Link Lifecycle

```
Created → Emailed → Accessed → Submitted → Complete
    │         │         │
    │         │         └──► (Single use, marked as used)
    │         │
    │         └──► Revoked (Optional, by parent/admin)
    │
    └──► Expired (72 hours default)
```

### Provider Submission

Providers access via secure link (no account required):

1. Provider receives email with unique link
2. Provider clicks link and views form
3. Provider enters medical information:
   - Physician details
   - Special needs
   - Allergies with severity
   - Medications with dosages
4. Provider uploads supporting documents (optional)
5. Provider submits form
6. Link marked as used
7. Parent and admin notified

### Security Features

- 64-character cryptographically secure tokens
- 72-hour expiration (configurable)
- Single-use enforcement
- Revocation capability
- Access logging

---

## Document Management Domain

The document management domain handles secure file uploads and downloads.

### Capabilities

| Capability | Description | Access |
|------------|-------------|--------|
| List Documents | View accessible documents | Authenticated |
| Upload Document | Add new document | Authenticated |
| View Document | View document metadata | Owner / Admin / Authorized |
| Download Document | Retrieve document file | Owner / Admin / Authorized |
| Delete Document | Remove document | Owner / Admin |

### Supported File Types

| Type | Extensions | MIME Types |
|------|------------|------------|
| PDF | .pdf | application/pdf |
| Images | .jpg, .jpeg, .png, .gif | image/jpeg, image/png, image/gif |
| Documents | .doc, .docx | application/msword, application/vnd.openxmlformats-... |

### File Size Limit

Maximum file size: 10 MB

### Security Processing

1. **Upload Validation**
   - MIME type verification
   - File size check
   - Extension validation

2. **Security Scanning**
   - Dangerous extension detection
   - Content type verification
   - Malware pattern detection

3. **Download Protection**
   - Unscanned files blocked (non-admin)
   - Failed scans blocked
   - Authorization verified

### Polymorphic Attachments

Documents can be attached to:
- Campers
- Medical records
- Applications

---

## Notification Domain

The notification domain manages user notifications and their read status.

### Capabilities

| Capability | Description | Access |
|------------|-------------|--------|
| List Notifications | View user's notifications | Authenticated |
| Mark as Read | Mark single notification read | Authenticated |
| Mark All Read | Mark all notifications read | Authenticated |

### Notification Types

| Type | Trigger | Recipient |
|------|---------|-----------|
| Application Submitted | Application submission | Parent |
| Status Changed | Admin reviews application | Parent |
| Provider Link Created | Link generated | Medical provider |
| Provider Link Revoked | Link revoked | Parent |
| Provider Link Expired | Link expires unused | Parent |
| Submission Received | Provider submits data | Parent, Admin |
| Acceptance Letter | Application approved | Parent |
| Rejection Letter | Application rejected | Parent |
| Password Reset | Reset requested | User |

### Notification Channels

- **Email** — Primary delivery method
- **Database** — Stored for in-app display

---

## Reporting Domain

The reporting domain provides administrative reports for camp management.

### Capabilities

All reporting capabilities are restricted to administrators.

| Report | Description | Parameters |
|--------|-------------|------------|
| Applications Report | Application summary with filtering | status, session, date range |
| Accepted Applicants | List of approved applicants | session, date range |
| Rejected Applicants | List of rejected applicants | session, date range |
| Mailing Labels | Data for label generation | session |
| ID Labels | Identification badge data | session |

### Applications Report

Provides:
- Application list with details
- Summary statistics
- Status breakdown
- Session breakdown

### Accepted Applicants Report

For approved applications:
- Camper information
- Age at session start
- Session dates
- Parent contact information

### Rejected Applicants Report

For rejected applications:
- Camper information
- Rejection notes
- Parent contact information

### Mailing Labels

Data formatted for label printing:
- Recipient name
- Camper name
- Email address

### ID Labels

Data for identification badges:
- Camper name
- Session information
- Severe allergy flags

---

## Error Handling

### Validation Errors (422)

When request validation fails:

```json
{
    "message": "The given data was invalid.",
    "errors": {
        "email": ["The email field is required."],
        "password": ["The password must be at least 8 characters."]
    }
}
```

### Authentication Errors (401)

When token is missing or invalid:

```json
{
    "message": "Unauthenticated."
}
```

### Authorization Errors (403)

When user lacks permission:

```json
{
    "message": "This action is unauthorized."
}
```

### Not Found Errors (404)

When resource does not exist:

```json
{
    "message": "Resource not found."
}
```

### Server Errors (500)

When an unexpected error occurs:

```json
{
    "message": "Server Error"
}
```

In development mode, additional error details may be included.

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- Default: 60 requests per minute per user
- Login: 5 attempts per minute per IP
- Password reset: 3 requests per minute per email

When rate limit exceeded:

```json
{
    "message": "Too Many Attempts."
}
```

Response includes `Retry-After` header indicating seconds until reset.

---

## Pagination

Collection endpoints support pagination:

### Request Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | 1 | Current page number |
| `per_page` | 15 | Items per page (max 100) |

### Response Metadata

```json
{
    "data": [...],
    "meta": {
        "current_page": 1,
        "from": 1,
        "last_page": 7,
        "per_page": 15,
        "to": 15,
        "total": 100
    },
    "links": {
        "first": "https://api.example.com/api/resource?page=1",
        "last": "https://api.example.com/api/resource?page=7",
        "prev": null,
        "next": "https://api.example.com/api/resource?page=2"
    }
}
```

---

## Conclusion

The Camp Burnt Gin API provides comprehensive functionality for camp application management, medical information handling, and administrative workflows. The API follows REST conventions and implements robust security measures appropriate for handling Protected Health Information.

For implementation details and code examples, consult the source code and inline documentation within the repository.
