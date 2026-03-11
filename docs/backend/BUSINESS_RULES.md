# Business Rules

This document defines the business logic, validation rules, and workflow constraints implemented in the Camp Burnt Gin API.

---

## Application Business Rules

### Duplicate Prevention

**Rule:** One application per camper per session

**Enforcement:** Unique database constraint on (camper_id, camp_session_id)

### Draft vs Submitted

**Draft Applications:**
- `is_draft = true`
- `submitted_at = null`
- Can be edited by parent
- Not visible to administrators in review queue
- No notifications sent

**Submitted Applications:**
- `is_draft = false`
- `submitted_at` timestamp recorded
- Limited editing (only before review)
- Visible to administrators
- Confirmation notification sent to parent

### Status Transitions

**Allowed Transitions:**
```
Pending → Approved (admin review)
Pending → Rejected (admin review)
Pending → Waitlisted (admin review)
```

**Not Allowed:**
- Approved → Rejected
- Rejected → Approved
- Waitlisted → Approved (must create new application)

### Application Editing Rules

**Parents can edit when:**
- Application is in draft mode, OR
- Application is pending (not yet reviewed)

**Parents cannot edit when:**
- Application has been approved/rejected/waitlisted

**Admins can:**
- Edit any application at any time

### Digital Signatures

**Requirements:**
- Signature required before final submission
- Captures signature data, name, timestamp, IP address
- Once signed, signature cannot be modified
- Re-submission requires new signature

---

## Camper Age Restrictions

### Age Calculation

**Rule:** Age determined by date of birth relative to session start date

**Implementation:**
```php
$age = $camper->date_of_birth->diffInYears($session->start_date);
```

### Session Age Limits

**Validation:**
- Session defines `min_age` and `max_age` (optional)
- Application rejected if camper age outside range
- Age checked at application creation

**Example:**
- Session: Ages 8-12
- Camper born: 2015-06-15
- Session start: 2026-07-01
- Camper age: 11 years (eligible)

---

## Medical Information Rules

### Medical Record Uniqueness

**Rule:** One medical record per camper

**Enforcement:** Unique database constraint on `camper_id`

### Allergy Severity Levels

**Enum Values:**
- `mild` - Minor reaction, monitoring required
- `moderate` - Significant reaction, intervention may be needed
- `severe` - Life-threatening, immediate intervention required

**Business Logic:**
```php
public function requiresImmediateAttention(): bool
{
    return $this->severity === AllergySeverity::Severe;
}
```

### Medical Provider Link Expiration

**Rules:**
- Links expire 4-72 hours after creation (configurable)
- Default: 72 hours
- Cannot be extended; must create new link
- Single use: marked as used after submission

**Revocation:**
- Parent or admin can revoke at any time
- Revoked links cannot be unrevoked
- Revocation reason stored in notes

---

## Session Capacity Rules

### Capacity Tracking

**Rule:** Sessions have maximum capacity

**Validation:**
- Checked at application approval
- Waitlist used when capacity reached
- Capacity includes only approved applications

**Example:**
- Capacity: 50
- Approved: 48
- Pending: 10
- Available: 2

### Waitlist Management

**Business Logic:**
- Waitlisted applications do not count toward capacity
- Manual promotion from waitlist to approved by admin
- No automatic promotion

---

## Document Upload Rules

### Allowed File Types

**MIME Types:**
- application/pdf
- image/jpeg, image/png, image/gif
- application/msword
- application/vnd.openxmlformats-officedocument.wordprocessingml.document

### File Size Limit

**Maximum:** 10 MB (10,485,760 bytes)

### Security Scanning

**Rules:**
- All uploads scanned for malware
- Dangerous extensions blocked (exe, bat, sh, php, js)
- Unscanned files cannot be downloaded by non-admin users
- Scan failures quarantine file

---

## Notification Business Rules

### Automatic Notifications

**Sent When:**
- Application submitted (to parent)
- Application status changed (to parent)
- Medical provider link created (to provider)
- Medical provider link expiring soon (to provider and parent)
- Medical provider submission received (to parent and admin)
- Acceptance/rejection letters (to parent)

**Not Sent When:**
- Draft application saved
- Admin previews application
- Medical provider link revoked

### Notification Delivery

**Method:** Email via SMTP

**Retry Logic:**
- 3 automatic retries
- Exponential backoff (1s, 2s, 4s)
- Failed notifications logged

---

## Authorization Business Rules

### Ownership Rules

**Parents can only access:**
- Their own campers
- Applications for their campers
- Medical records for their campers
- Documents attached to their resources

**Verification:**
```php
public function ownsCamper(Camper $camper): bool
{
    return $this->id === $camper->user_id;
}
```

### Medical Provider Access

**Authenticated Medical Providers:**
- View all medical records (read-only)
- Cannot modify camper profiles
- Cannot create applications
- All access logged for HIPAA

**External Providers (token links):**
- Access only specific camper via token
- Submit medical information once
- Cannot view applications or administrative data

---

## Document Request Rules (Phase 13)

### Status Lifecycle

```
awaiting_upload → uploaded → scanning → under_review → approved (final)
                                                      → rejected (final)
awaiting_upload → overdue (when due_date passes without upload)
```

### Rules

1. Only admin and super_admin roles can create document requests.
2. A document request may be optionally linked to a specific application or camper, but neither is required.
3. The applicant receives a system inbox notification when a document request is created.
4. Status updates (approval, rejection, reupload requests) are appended as new messages to the same inbox thread.
5. An applicant may only upload one document per request. To allow resubmission, an admin must explicitly invoke the reupload action.
6. A request with `canUpload()` returning true accepts uploads. The `canUpload()` helper returns true only for status values: `awaiting_upload`, `rejected` (if reupload requested).
7. Rejection requires a reason (stored in `rejection_reason`).
8. Admins can extend the deadline of a request regardless of its current status.
9. A request cannot be deleted after a document has been submitted — it can only be cancelled.

---

## Form Definition Rules (Phase 14)

### Version Management

1. Only one form definition may have `status = published` at any given time. Publishing a new definition automatically supersedes the previous one.
2. A form definition begins in `draft` status. Only published definitions are served to applicants.
3. Draft definitions can be edited freely. Published definitions cannot be directly edited — they must be duplicated first.
4. The active form schema is publicly cached for 10 minutes under key `form.active.v{version}`.

### Field Key Rules

1. A field's `field_key` is a stable machine-readable identifier used to store application data.
2. Once at least one application has been submitted that references a `field_key`, that key cannot be renamed. Attempts will raise a `FormFieldKeyChangeException` and return a 422 response.
3. Field keys must be unique within a form definition.

### Reorder Rules

1. Sections, fields, and options can be reordered using batch reorder endpoints. Reorder operations are scoped to the parent (a section's fields cannot be moved to another section via reorder).

### Field Deactivation

1. A field can be deactivated without being deleted. Deactivated fields are hidden from applicants but remain in the database for data integrity.

---

## Related Documentation

- [APPLICATION_WORKFLOWS.md](APPLICATION_WORKFLOWS.md) - Application lifecycle
- [DATA_MODEL.md](DATA_MODEL.md) - Database schema
- [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) - Authorization rules

---

**Document Status:** Complete and authoritative
**Last Updated:** March 2026
