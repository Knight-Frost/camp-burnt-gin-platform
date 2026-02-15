# Camp Burnt Gin API Reference

**Version:** 1.0
**Base URL:** `/api`
**Authentication:** Bearer Token (Laravel Sanctum)
**Content Type:** `application/json`

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Rate Limiting](#rate-limiting)
3. [Global Error Responses](#global-error-responses)
4. [Authentication Endpoints](#authentication-endpoints)
5. [User Profile Endpoints](#user-profile-endpoints)
6. [MFA Endpoints](#mfa-endpoints)
7. [Camp Endpoints](#camp-endpoints)
8. [Camp Session Endpoints](#camp-session-endpoints)
9. [Camper Endpoints](#camper-endpoints)
10. [Application Endpoints](#application-endpoints)
11. [Medical Record Endpoints](#medical-record-endpoints)
12. [Allergy Endpoints](#allergy-endpoints)
13. [Medication Endpoints](#medication-endpoints)
14. [Emergency Contact Endpoints](#emergency-contact-endpoints)
15. [Document Endpoints](#document-endpoints)
16. [Medical Provider Link Endpoints](#medical-provider-link-endpoints)
17. [Notification Endpoints](#notification-endpoints)
18. [Inbox Endpoints](#inbox-endpoints)
19. [Report Endpoints](#report-endpoints)

---

## Authentication & Authorization

### Bearer Token Authentication

All authenticated endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer {your-api-token}
```

Tokens are issued upon successful login or registration. Tokens expire after 60 minutes of inactivity.

### Authorization Levels

| Role | Permissions |
|------|-------------|
| **Super Admin** | Full system access, delegation authority |
| **Admin** | Operational access, camp management, application review, reporting |
| **Parent** | Own campers, applications, documents only |
| **Medical Provider** | View-only access to medical records |

### Endpoint Notation

Each endpoint lists:
- **Auth:** Yes/No
- **Role:** Required role(s) or "Any" for all authenticated users
- **Rate Limit:** Applicable rate limiter

---

## Rate Limiting

| Rate Limiter | Limit | Scope | Applies To |
|--------------|-------|-------|------------|
| `api` | 60/min | General authenticated endpoints | Most endpoints |
| `auth` | 5/min, 20/hour | Login, registration, password reset | Auth endpoints |
| `mfa` | 3/min, 10/hour | MFA operations | MFA setup/verify/disable |
| `provider-link` | 2/min, 10/hour | Medical provider link access | Provider endpoints |
| `uploads` | 5/min, 50/hour | Document uploads | Upload endpoint |
| `sensitive` | 10/min, 100/hour | Document downloads, provider links | Download endpoints |
| `inbox-conversation` | 5/min | Conversation creation | Inbox conversations |
| `inbox-message` | 60/min | Message sending | Inbox messages |

**Rate limit tracking:** By user ID (authenticated) or IP address (unauthenticated)

**Rate limit response:** HTTP 429 with `Retry-After` header

---

## Global Error Responses

### Standard Error

```json
{
  "message": "Human-readable error message"
}
```

### Validation Error

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "field_name": ["Validation error message"]
  }
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful request |
| 201 | Created | Resource created |
| 400 | Bad Request | Business logic error |
| 401 | Unauthorized | Authentication required/failed |
| 403 | Forbidden | Not authorized for action |
| 404 | Not Found | Resource not found |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Common Error Scenarios

**401 Unauthorized - Invalid credentials:**
```json
{
  "success": false,
  "message": "Invalid credentials.",
  "attempts_remaining": 3
}
```

**401 Unauthorized - Account locked:**
```json
{
  "success": false,
  "message": "Too many failed login attempts. Account locked temporarily.",
  "lockout": true,
  "retry_after": 900
}
```

**403 Forbidden - Insufficient permissions:**
```json
{
  "message": "Unauthorized"
}
```

**404 Not Found:**
```json
{
  "message": "Resource not found"
}
```

---

## Authentication Endpoints

### POST /auth/register

Register a new user account (creates parent role by default).

**Auth:** No | **Rate Limit:** `auth`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| name | string | Yes | Max 255 characters |
| email | string | Yes | Valid email, unique, max 255 |
| password | string | Yes | Min 12 chars, mixed case, numbers, symbols, not compromised |
| password_confirmation | string | Yes | Must match password |

**Success (201):**
```json
{
  "message": "Account created successfully.",
  "data": {
    "user": { "id": 1, "name": "John Smith", "email": "john@example.com", "mfa_enabled": false },
    "token": "1|aBcDeFgHiJkLmNoPqRsTuVwXyZ"
  }
}
```

---

### POST /auth/login

Authenticate user and issue API token.

**Auth:** No | **Rate Limit:** `auth`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| email | string | Yes | Valid email |
| password | string | Yes | - |
| mfa_code | string | Conditional | Exactly 6 chars (required if MFA enabled) |

**Success (200):**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": { "id": 1, "name": "John Smith", "role": { "id": 2, "name": "parent" } },
    "token": "2|xYzAbCdEfGhIjKlMnOpQrStUvW"
  }
}
```

**MFA Required (200):**
```json
{
  "success": true,
  "message": "MFA verification required.",
  "mfa_required": true
}
```

---

### POST /auth/logout

Revoke current token.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Success (200):** `{ "message": "Logged out successfully." }`

---

### GET /user

Get authenticated user profile.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | User ID |
| name | string | Full name |
| email | string | Email address |
| email_verified_at | timestamp | Email verification time |
| mfa_enabled | boolean | MFA status |
| role | object | Role object with id and name |

---

### POST /auth/forgot-password

Send password reset link.

**Auth:** No | **Rate Limit:** `auth`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| email | string | Yes | Valid email |

**Success (200):** `{ "message": "If an account exists with this email, a password reset link has been sent." }`

**Note:** Generic response prevents email enumeration.

---

### POST /auth/reset-password

Reset password using reset token.

**Auth:** No | **Rate Limit:** `auth`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| token | string | Yes | Reset token from email |
| email | string | Yes | Valid email |
| password | string | Yes | Min 12 chars, mixed case, numbers, symbols, not compromised |
| password_confirmation | string | Yes | Must match password |

**Success (200):** `{ "message": "Password has been reset successfully." }`

**Error (400):** `{ "message": "This password reset token is invalid or has expired." }`

---

## User Profile Endpoints

### GET /profile

Get current user profile.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

Returns same schema as `/user` endpoint.

---

### PUT /profile

Update current user profile.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| name | string | No | Max 255 characters |
| email | string | No | Valid email, unique (excluding current user), max 255 |

**Success (200):** Updated user object

---

### GET /profile/prefill

Get pre-fill data for returning applicants.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Response includes:**
- Parent information
- Previous campers
- Previous emergency contacts
- Previous medical information (physician, insurance)

---

## MFA Endpoints

### POST /mfa/setup

Initialize MFA setup. Returns QR code and secret.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `mfa`

**Success (200):**
```json
{
  "message": "MFA setup initialized. Scan the QR code with your authenticator app.",
  "data": {
    "qr_code": "data:image/svg+xml;base64,...",
    "secret": "JBSWY3DPEHPK3PXP",
    "recovery_codes": ["ABC123-DEF456", "GHI789-JKL012", ...]
  }
}
```

**Error (400):** `{ "message": "MFA is already enabled for this account." }`

---

### POST /mfa/verify

Verify and enable MFA.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `mfa`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| code | string | Yes | Exactly 6 characters |

**Success (200):** Returns recovery codes

**Error (401):** `{ "message": "Invalid verification code." }`

---

### POST /mfa/disable

Disable MFA.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `mfa`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| code | string | Yes | Exactly 6 characters |
| password | string | Yes | Current password |

**Success (200):** `{ "message": "MFA has been disabled." }`

**Error (400):** `{ "message": "Invalid verification code or password." }`

---

## Camp Endpoints

### GET /camps

List all camps. Non-admin users see only active camps.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Response:** Array of camp objects with nested sessions array

---

### GET /camps/{id}

Get camp details.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**URL Parameters:** `id` (integer) - Camp ID

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Camp ID |
| name | string | Camp name |
| description | string | Camp description |
| location | string | Camp location |
| is_active | boolean | Active status |
| sessions | array | Associated camp sessions |

---

### POST /camps

Create new camp.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| name | string | Yes | Max 255 characters |
| description | string | No | - |
| location | string | No | Max 255 characters |
| is_active | boolean | No | Default: true |

**Success (201):** Created camp object

---

### PUT /camps/{id}

Update camp.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**URL Parameters:** `id` (integer) - Camp ID

All parameters optional (same validation as POST).

**Success (200):** Updated camp object

---

### DELETE /camps/{id}

Soft delete camp.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**URL Parameters:** `id` (integer) - Camp ID

**Success (200):** `{ "message": "Camp deleted successfully." }`

---

## Camp Session Endpoints

### GET /camp-sessions

List all camp sessions. Non-admin users see only active sessions.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camp_id | integer | Filter by camp ID |

---

### GET /camp-sessions/{id}

Get session details.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Session ID |
| camp_id | integer | Parent camp ID |
| name | string | Session name |
| start_date | date | Session start date |
| end_date | date | Session end date |
| capacity | integer | Maximum campers |
| min_age | integer | Minimum age requirement |
| max_age | integer | Maximum age requirement |
| registration_opens_at | timestamp | Registration open time |
| registration_closes_at | timestamp | Registration close time |
| is_active | boolean | Active status |

---

### POST /camp-sessions

Create session.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| camp_id | integer | Yes | Valid camp ID |
| name | string | Yes | Max 255 characters |
| start_date | date | Yes | YYYY-MM-DD format |
| end_date | date | Yes | After start_date |
| capacity | integer | Yes | Minimum 1 |
| min_age | integer | No | Minimum 5 |
| max_age | integer | No | Maximum 18 |
| registration_opens_at | timestamp | No | Before registration_closes_at |
| registration_closes_at | timestamp | No | Before start_date |
| is_active | boolean | No | Default: true |

**Success (201):** Created session object

---

### PUT /camp-sessions/{id}

Update session.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated session object

---

### DELETE /camp-sessions/{id}

Soft delete session.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Camp session deleted successfully." }`

---

## Camper Endpoints

### GET /campers

List campers. Parents see only their own campers; admins see all.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| parent_id | integer | Filter by parent (admin only) |

---

### GET /campers/{id}

Get camper details.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Camper ID |
| parent_id | integer | Parent user ID |
| first_name | string | First name |
| last_name | string | Last name |
| date_of_birth | date | Birth date |
| gender | string | Gender |
| grade | string | School grade |
| school | string | School name |
| special_needs | string | Special needs description |
| dietary_restrictions | string | Dietary restrictions |
| t_shirt_size | string | T-shirt size |

---

### POST /campers

Create camper.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| first_name | string | Yes | Max 255 characters |
| last_name | string | Yes | Max 255 characters |
| date_of_birth | date | Yes | YYYY-MM-DD, age 5-18 |
| gender | string | Yes | Male, Female, Other, Prefer not to say |
| grade | string | No | Max 50 characters |
| school | string | No | Max 255 characters |
| special_needs | string | No | - |
| dietary_restrictions | string | No | - |
| t_shirt_size | string | No | YS, YM, YL, AS, AM, AL, AXL |

**Success (201):** Created camper object

---

### PUT /campers/{id}

Update camper.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated camper object

---

### DELETE /campers/{id}

Soft delete camper.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Camper deleted successfully." }`

---

## Application Endpoints

### GET /applications

List applications. Parents see only their own; admins see all.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camper_id | integer | Filter by camper |
| camp_session_id | integer | Filter by session |
| status | string | Filter by status (pending, approved, rejected, waitlisted) |

---

### GET /applications/{id}

Get application details.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Application ID |
| camper_id | integer | Camper ID |
| camp_session_id | integer | Session ID |
| status | string | pending, approved, rejected, waitlisted |
| is_draft | boolean | Draft status |
| submitted_at | timestamp | Submission time |
| reviewed_at | timestamp | Review time |
| reviewed_by | integer | Reviewer user ID |
| review_notes | string | Admin review notes |
| parent_signature | string | Digital signature |
| signed_at | timestamp | Signature time |

---

### POST /applications

Create application.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| camper_id | integer | Yes | Valid camper ID (owned by user) |
| camp_session_id | integer | Yes | Valid session ID |
| is_draft | boolean | No | Default: false |

**Validation Rules:**
- Camper age must be within session age range
- No duplicate application for same camper/session
- Session must be open for registration

**Success (201):** Created application object

---

### PUT /applications/{id}

Update application.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| is_draft | boolean | No | Cannot edit approved/rejected applications |

**Success (200):** Updated application object

---

### POST /applications/{id}/review

Review application (admin only).

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| status | string | Yes | approved, rejected, waitlisted |
| review_notes | string | No | - |

**Compliance:** Approved applications require all medical compliance documents to be verified and not expired (CYSHCN enforcement).

**Success (200):** Updated application object

---

### POST /applications/{id}/sign

Sign application.

**Auth:** Yes | **Role:** Parent (own only) | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| signature | string | Yes | Digital signature |

**Success (200):** Application with signature timestamp

---

### DELETE /applications/{id}

Delete application.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Application deleted successfully." }`

---

## Medical Record Endpoints

### GET /medical-records

List medical records.

**Auth:** Yes | **Role:** Parent (own campers), Medical Provider, Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camper_id | integer | Filter by camper |

**HIPAA Compliance:** All medical record access is logged to audit trail.

---

### GET /medical-records/{id}

Get medical record details.

**Auth:** Yes | **Role:** Parent (own only), Medical Provider, Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Record ID |
| camper_id | integer | Camper ID |
| physician_name | string | Primary physician |
| physician_phone | string | Physician phone |
| insurance_provider | string | Insurance company |
| insurance_policy_number | string | Policy number |
| medical_history | text | Medical history |
| current_medications | text | Current medications |
| immunization_status | string | Immunization status |
| last_physical_date | date | Last physical exam date |

**HIPAA Compliance:** Access logged with correlation ID, user ID, IP address.

---

### POST /medical-records

Create medical record.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| camper_id | integer | Yes | Valid camper ID (owned by user) |
| physician_name | string | Yes | Max 255 characters |
| physician_phone | string | Yes | Valid phone format |
| insurance_provider | string | No | Max 255 characters |
| insurance_policy_number | string | No | Max 255 characters |
| medical_history | text | No | - |
| current_medications | text | No | - |
| immunization_status | string | No | up_to_date, pending, incomplete |
| last_physical_date | date | No | YYYY-MM-DD |

**Success (201):** Created medical record

---

### PUT /medical-records/{id}

Update medical record.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated medical record

**HIPAA Compliance:** Updates logged to audit trail.

---

### DELETE /medical-records/{id}

Delete medical record.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Medical record deleted successfully." }`

---

## Allergy Endpoints

### GET /allergies

List allergies.

**Auth:** Yes | **Role:** Parent (own campers), Medical Provider, Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camper_id | integer | Filter by camper |

---

### GET /allergies/{id}

Get allergy details.

**Auth:** Yes | **Role:** Parent (own only), Medical Provider, Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Allergy ID |
| camper_id | integer | Camper ID |
| allergen | string | Allergen name |
| severity | string | mild, moderate, severe |
| reaction | string | Reaction description |
| treatment | string | Treatment protocol |

---

### POST /allergies

Create allergy record.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| camper_id | integer | Yes | Valid camper ID (owned by user) |
| allergen | string | Yes | Max 255 characters |
| severity | string | Yes | mild, moderate, severe |
| reaction | string | No | - |
| treatment | string | No | - |

**Success (201):** Created allergy record

---

### PUT /allergies/{id}

Update allergy record.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated allergy record

---

### DELETE /allergies/{id}

Delete allergy record.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Allergy deleted successfully." }`

---

## Medication Endpoints

### GET /medications

List medications.

**Auth:** Yes | **Role:** Parent (own campers), Medical Provider, Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camper_id | integer | Filter by camper |

---

### GET /medications/{id}

Get medication details.

**Auth:** Yes | **Role:** Parent (own only), Medical Provider, Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Medication ID |
| camper_id | integer | Camper ID |
| name | string | Medication name |
| dosage | string | Dosage instructions |
| frequency | string | Administration frequency |
| time_of_day | string | Time of administration |
| prescribing_physician | string | Prescribing physician |
| reason | string | Reason for medication |

---

### POST /medications

Create medication record.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| camper_id | integer | Yes | Valid camper ID (owned by user) |
| name | string | Yes | Max 255 characters |
| dosage | string | Yes | Max 255 characters |
| frequency | string | Yes | Max 255 characters |
| time_of_day | string | No | morning, afternoon, evening, bedtime, as_needed |
| prescribing_physician | string | No | Max 255 characters |
| reason | string | No | - |

**Success (201):** Created medication record

---

### PUT /medications/{id}

Update medication record.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated medication record

---

### DELETE /medications/{id}

Delete medication record.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Medication deleted successfully." }`

---

## Emergency Contact Endpoints

### GET /emergency-contacts

List emergency contacts.

**Auth:** Yes | **Role:** Parent (own campers), Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camper_id | integer | Filter by camper |

---

### GET /emergency-contacts/{id}

Get contact details.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Contact ID |
| camper_id | integer | Camper ID |
| name | string | Contact name |
| relationship | string | Relationship to camper |
| phone_primary | string | Primary phone |
| phone_secondary | string | Secondary phone |
| email | string | Email address |
| is_primary | boolean | Primary contact flag |
| is_authorized_pickup | boolean | Pickup authorization |

---

### POST /emergency-contacts

Create emergency contact.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| camper_id | integer | Yes | Valid camper ID (owned by user) |
| name | string | Yes | Max 255 characters |
| relationship | string | Yes | Max 255 characters |
| phone_primary | string | Yes | Valid phone format |
| phone_secondary | string | No | Valid phone format |
| email | string | No | Valid email, max 255 |
| is_primary | boolean | No | Default: false |
| is_authorized_pickup | boolean | No | Default: false |

**Success (201):** Created contact

---

### PUT /emergency-contacts/{id}

Update emergency contact.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated contact

---

### DELETE /emergency-contacts/{id}

Delete emergency contact.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Emergency contact deleted successfully." }`

---

## Document Endpoints

### GET /documents

List documents.

**Auth:** Yes | **Role:** Parent (own campers), Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| documentable_type | string | Filter by type (camper, application, medical_record) |
| documentable_id | integer | Filter by parent resource ID |

---

### GET /documents/{id}

Get document metadata.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Document ID |
| documentable_type | string | Parent resource type |
| documentable_id | integer | Parent resource ID |
| document_type | string | Document type category |
| original_name | string | Original filename |
| mime_type | string | MIME type |
| size | integer | File size (bytes) |
| scan_status | string | Virus scan status |
| verification_status | string | Verification status |
| expires_at | date | Expiration date |
| uploaded_by | integer | Uploader user ID |

---

### POST /documents

Upload document.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `uploads`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| file | file | Yes | Max 10MB, PDF/JPEG/PNG/GIF/DOC/DOCX |
| documentable_type | string | Yes | camper, application, medical_record |
| documentable_id | integer | Yes | Valid parent resource ID (owned by user) |
| document_type | string | Yes | Valid document type |
| expires_at | date | No | YYYY-MM-DD (future date) |

**Document Types:**
- Medical: physical_exam, immunization_record, medication_authorization, allergy_action_plan
- Compliance: seizure_management_plan, gtube_feeding_plan, behavioral_support_plan
- General: parent_id, insurance_card, consent_form, photo_release

**Compliance:** High-complexity campers require additional documents. G-tube feeding plans required for feeding tube devices. Seizure management plans required for seizure diagnosis.

**Success (201):** Created document metadata

---

### GET /documents/{id}/download

Download document.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `sensitive`

**Success (200):** Binary file with appropriate headers

---

### DELETE /documents/{id}

Delete document.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Document deleted successfully." }`

---

## Medical Provider Link Endpoints

### GET /provider-links

List provider links.

**Auth:** Yes | **Role:** Parent (own campers), Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camper_id | integer | Filter by camper |

---

### GET /provider-links/{id}

Get provider link details.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Link ID |
| camper_id | integer | Camper ID |
| token | string | Secure access token |
| provider_email | string | Provider email |
| expires_at | timestamp | Expiration time |
| accessed_at | timestamp | First access time |
| submitted_at | timestamp | Submission time |
| is_revoked | boolean | Revoked status |

---

### POST /provider-links

Create provider link.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| camper_id | integer | Yes | Valid camper ID (owned by user) |
| provider_email | string | Yes | Valid email |
| expires_at | timestamp | No | Future timestamp (default: 7 days) |

**Success (201):** Created provider link with secure token

---

### POST /provider-links/{id}/resend

Resend provider link email.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Provider link has been resent." }`

---

### POST /provider-links/{id}/revoke

Revoke provider link.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Provider link has been revoked." }`

---

### GET /provider-access/{token}

Access provider form (no authentication required).

**Auth:** No | **Rate Limit:** `provider-link`

**URL Parameters:** `token` (string) - Secure access token

**Success (200):** Camper medical form data

**Errors:**
- 403: Link expired, revoked, or already used
- 404: Invalid token

---

### POST /provider-access/{token}/submit

Submit provider form.

**Auth:** No | **Rate Limit:** `provider-link`

**URL Parameters:** `token` (string) - Secure access token

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| physician_name | string | Yes | Max 255 characters |
| physician_phone | string | Yes | Valid phone format |
| medical_notes | text | No | - |
| documents | array | No | File uploads (same validation as /documents) |

**Success (200):** Submission confirmation

**Note:** Link becomes single-use after successful submission.

---

## Notification Endpoints

### GET /notifications

List user notifications.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| unread | boolean | Filter unread notifications |

**Response:** Array of notification objects

---

### GET /notifications/{id}

Get notification details.

**Auth:** Yes | **Role:** Any (own only) | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Notification ID |
| type | string | Notification type |
| data | object | Notification data |
| read_at | timestamp | Read timestamp |
| created_at | timestamp | Creation timestamp |

---

### PUT /notifications/{id}/read

Mark notification as read.

**Auth:** Yes | **Role:** Any (own only) | **Rate Limit:** `api`

**Success (200):** Updated notification

---

### POST /notifications/read-all

Mark all notifications as read.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Success (200):** `{ "message": "All notifications marked as read." }`

---

### DELETE /notifications/{id}

Delete notification.

**Auth:** Yes | **Role:** Any (own only) | **Rate Limit:** `api`

**Success (200):** `{ "message": "Notification deleted successfully." }`

---

## Inbox Endpoints

### GET /inbox/conversations

List conversations.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| archived | boolean | Include archived conversations |

**Response:** Paginated array of conversation objects

**HIPAA Compliance:** All inbox operations logged to audit trail.

---

### GET /inbox/conversations/{id}

Get conversation details.

**Auth:** Yes | **Role:** Participant | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Conversation ID |
| subject | string | Conversation subject |
| created_by | integer | Creator user ID |
| archived_at | timestamp | Archive timestamp |
| participants | array | Participant user objects |

---

### POST /inbox/conversations

Create conversation.

**Auth:** Yes | **Role:** Admin, Parent | **Rate Limit:** `inbox-conversation` (5/min)

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| subject | string | Yes | Max 255 characters |
| participant_ids | array | Yes | Min 1 valid user ID |
| initial_message | string | Yes | Initial message body |

**Role Restrictions:**
- Parents can only create conversations with admins
- Parents cannot create parent-to-parent conversations
- Medical providers cannot create conversations
- Admins can create any conversation

**Success (201):** Created conversation

---

### POST /inbox/conversations/{id}/archive

Archive conversation.

**Auth:** Yes | **Role:** Creator | **Rate Limit:** `api`

**Success (200):** `{ "message": "Conversation archived." }`

---

### POST /inbox/conversations/{id}/participants

Add participant (admin only).

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| user_id | integer | Yes | Valid user ID |

**Success (200):** Updated conversation

---

### DELETE /inbox/conversations/{id}

Soft delete conversation (admin only).

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Conversation deleted." }`

---

### GET /inbox/conversations/{id}/messages

List messages in conversation.

**Auth:** Yes | **Role:** Participant | **Rate Limit:** `api`

**Response:** Paginated array of message objects

**Side Effect:** Auto-marks retrieved messages as read (except sender's own messages).

---

### POST /inbox/conversations/{id}/messages

Send message.

**Auth:** Yes | **Role:** Participant | **Rate Limit:** `inbox-message` (60/min)

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| body | string | Yes | Not empty |
| attachments | array | No | Max 5 files, 10MB each, PDF/JPEG/PNG/GIF/DOC/DOCX |
| idempotency_key | string | Yes | Unique key for duplicate prevention |

**Success (201):** Created message

**HIPAA Compliance:** Messages are immutable (cannot be edited). Soft deletion preserves audit trail.

---

### DELETE /inbox/messages/{id}

Soft delete message (admin only).

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Message deleted." }`

**Note:** Parents cannot delete their own messages (immutability requirement).

---

### GET /inbox/unread-count

Get unread message count.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Success (200):** `{ "unread_count": 5 }`

---

## Report Endpoints

### GET /reports/applications

Application summary report.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camp_session_id | integer | Filter by session |
| status | string | Filter by status |

**Response:** Application statistics and list

---

### GET /reports/campers

Camper summary report.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camp_session_id | integer | Filter by session |

**Response:** Camper demographics and statistics

---

### GET /reports/medical-compliance

Medical compliance report.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camp_session_id | integer | Filter by session |

**Response:** Compliance status for all campers

**Includes:**
- Document verification status
- Expiration tracking
- CYSHCN compliance requirements
- Missing document identification

---

### GET /reports/documents

Document report.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Response:** Document upload statistics and verification status

---

---

**API Version:** 1.0
**Last Updated:** February 2026
**Total Endpoints:** 112
**Authentication:** Laravel Sanctum Bearer Tokens
**Compliance:** HIPAA-compliant PHI access auditing, CYSHCN medical compliance enforcement
