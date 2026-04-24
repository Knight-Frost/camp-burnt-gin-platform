# File Uploads

This document provides comprehensive documentation for the document management and file upload system in the Camp Burnt Gin API, covering upload security, validation, storage, scanning, and download procedures for handling sensitive medical documents.

---

## Table of Contents

1. [Overview and Security Principles](#overview-and-security-principles)
2. [Document Model](#document-model)
3. [Supported File Types and Limits](#supported-file-types-and-limits)
4. [Upload Process](#upload-process)
5. [Security Validation Layers](#security-validation-layers)
6. [File Storage](#file-storage)
7. [Security Scanning](#security-scanning)
8. [Document Download and Deletion](#document-download-and-deletion)
9. [Polymorphic Associations](#polymorphic-associations)
10. [Authorization and Error Handling](#authorization-and-error-handling)

---

## Overview and Security Principles

The document management system provides secure file upload, storage, and retrieval for sensitive medical documents (PHI) with HIPAA-compliant handling.

### Security Principles

| Principle | Implementation |
|-----------|----------------|
| Defense in Depth | Multiple validation layers (MIME, size, extension, content) |
| Least Privilege | Access restricted via policy authorization |
| Fail Secure | Unscanned or suspicious files blocked by default |
| Audit Trail | All document access logged to audit_logs table |
| Data Protection | Files stored outside web root with random filenames |

### Key Features

- MIME type validation against allowed types
- File size limits (10 MB maximum)
- Extension validation
- Security scanning for malicious content
- Polymorphic associations (campers, medical records, applications)
- Access control via policies
- Quarantine-based approval workflow

---

## Document Model

### Database Schema

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| documentable_type | VARCHAR(255) | Polymorphic parent class |
| documentable_id | BIGINT | Polymorphic parent ID |
| uploaded_by | BIGINT | User ID who uploaded |
| document_type | VARCHAR(100) | Category (medical, legal, identification) |
| original_filename | VARCHAR(255) | Original upload filename |
| stored_filename | VARCHAR(255) | UUID-based storage filename |
| mime_type | VARCHAR(100) | Detected MIME type |
| file_size | BIGINT | File size in bytes |
| disk | VARCHAR(50) | Storage disk (local, s3) |
| path | VARCHAR(500) | Full storage path |
| is_scanned | BOOLEAN | Security scan completed |
| scan_passed | BOOLEAN | Scan result (null = pending) |
| scanned_at | TIMESTAMP | Scan completion timestamp |
| deleted_at | TIMESTAMP | Soft-delete timestamp (null = active) |

### Relationships

```php
// Uploader
public function uploader(): BelongsTo
{
    return $this->belongsTo(User::class, 'uploaded_by');
}

// Polymorphic Parent
public function documentable(): MorphTo
{
    return $this->morphTo();
}
```

---

## Supported File Types and Limits

### Allowed MIME Types

| Category | MIME Type | Extensions |
|----------|-----------|------------|
| PDF | application/pdf | .pdf |
| JPEG | image/jpeg | .jpg, .jpeg |
| PNG | image/png | .png |
| GIF | image/gif | .gif |
| Word (Legacy) | application/msword | .doc |
| Word (Modern) | application/vnd.openxmlformats-officedocument.wordprocessingml.document | .docx |

**Constant:**
```php
public const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
```

### Frontend MIME Type Restriction

The `DocumentUploader.tsx` React component enforces a client-side subset of the backend's allowed types. The `accept` attribute and the `ACCEPTED_TYPES` constant are intentionally more restrictive to match the most common use cases and avoid user-facing errors from uploading file types that the backend permits but that are rarely needed:

```typescript
// DocumentUploader.tsx — ACCEPTED_TYPES
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
```

WebP images are explicitly excluded. Although WebP is a valid image format, the backend `Document::ALLOWED_MIME_TYPES` does not include `image/webp`. Allowing WebP on the frontend would result in files that pass client-side validation and then fail silently on the server.

The backend is the authoritative validation layer. The frontend restriction is a usability safeguard only.

### File Size Limit

**Maximum:** 10 MB (10,485,760 bytes)

**Rationale:** Medical documents typically under 10 MB, prevents resource exhaustion attacks, balances usability with security.

---

## Upload Process

### Endpoint

```
POST /api/documents
Content-Type: multipart/form-data
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | File | Yes | File upload (max 10 MB) |
| documentable_type | String | Yes | Parent model class |
| documentable_id | Integer | Yes | Parent model ID |
| document_type | String | No | Category (medical, legal, identification) |

### Upload Flow

```
Client Upload → Controller → Form Validation (422 if fails)
    ↓
Policy Authorization (403 if unauthorized)
    ↓
MIME Type Validation (422 if invalid)
    ↓
File Size Validation (422 if too large)
    ↓
Generate UUID Filename
    ↓
Store File to Disk
    ↓
Create Document Record
    ↓
Queue Security Scan (async)
    ↓
Return 201 with Metadata
```

### Success Response (201)

```json
{
  "success": true,
  "document": {
    "id": 42,
    "documentable_type": "App\\Models\\MedicalRecord",
    "documentable_id": 10,
    "uploaded_by": 5,
    "document_type": "medical",
    "original_filename": "medical_form.pdf",
    "stored_filename": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
    "mime_type": "application/pdf",
    "file_size": 245789,
    "is_scanned": false,
    "scan_passed": null
  }
}
```

---

## Security Validation Layers

### Layer 1: Request Validation (Form Request)

```php
'file' => [
    'required',
    'file',
    'max:10240',  // 10 MB in kilobytes
    'mimes:pdf,jpg,jpeg,png,gif,doc,docx',
]
```

### Layer 2: MIME Type Validation

```php
protected function validateMimeType(UploadedFile $file): bool
{
    return in_array($file->getMimeType(), Document::ALLOWED_MIME_TYPES);
}
```

Purpose: Prevent MIME type spoofing.

### Layer 3: File Size Validation

```php
protected function validateFileSize(UploadedFile $file): bool
{
    return $file->getSize() <= Document::MAX_FILE_SIZE;
}
```

Purpose: Prevent resource exhaustion.

### Layer 4: Extension Validation (During Scan)

```php
$dangerousExtensions = ['exe', 'bat', 'cmd', 'sh', 'php', 'js', 'vbs', 'com', 'pif', 'scr'];
```

Purpose: Block executable files.

### Layer 5: Content Validation (During Scan)

```php
$dangerousMimeTypes = [
    'application/x-executable',
    'application/x-msdownload',
    'application/x-httpd-php',
    'application/x-sh',
    'text/x-php',
    'text/x-shellscript',
];
```

Purpose: Block script files.

---

## File Storage

### Storage Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| Storage | Local disk (default) | Development |
| Location | storage/app/documents/ | Outside web root |
| Filename | UUID-based | Prevent enumeration |
| Path Format | documents/{entity}/{year}/{month}/{uuid}.{ext} | Organization |

### Filename Generation

```php
protected function generateFilename(UploadedFile $file): string
{
    $extension = $file->getClientOriginalExtension();
    return Str::uuid().'.'.$extension;
}
// Example: a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf
```

### Security Measures

| Measure | Implementation |
|---------|----------------|
| Outside web root | Files in storage/app/, not public/ |
| Random filenames | UUID prevents enumeration attacks |
| Access control | Download requires authorization |
| No direct access | Not accessible via direct URL |

---

## Security Scanning

### Scan Process

Scanning performed asynchronously after upload to avoid blocking response.

```php
dispatch(function () use ($document) {
    $scanPassed = $this->performSecurityScan($document);
    $document->update([
        'is_scanned' => true,
        'scan_passed' => $scanPassed,
        'scanned_at' => now(),
    ]);
})->afterResponse();
```

### Scan Results

| scan_passed | Meaning | Download Access |
|-------------|---------|-----------------|
| null | Pending/Manual review required | Admin only |
| true | Approved | All authorized users |
| false | Dangerous file | No access (quarantined) |

### Manual Approval

```php
// Approve
$document->update(['is_scanned' => true, 'scan_passed' => true, 'scanned_at' => now()]);

// Reject
$document->update(['is_scanned' => true, 'scan_passed' => false, 'scanned_at' => now()]);
```

### Production Integration Options

| Solution | Type | Description |
|----------|------|-------------|
| ClamAV | Open Source | Install daemon, use clamav/clamav package |
| VirusTotal API | Cloud | Upload hash to 70+ antivirus engines |
| AWS GuardDuty | Enterprise | Automatic S3 scanning, CloudWatch alerts |
| Microsoft Defender | Enterprise | Azure-based scanning |

**HIPAA Note:** Current implementation uses quarantine-based manual approval for compliance.

---

## Document Download and Deletion

### Download Endpoint

```
GET /api/documents/{id}/download
```

### Download Flow

```
Client Request → Policy Authorization (403 if unauthorized)
    ↓
Check Scan Status:
  - Not scanned + not admin → 403
  - Scan failed → 403
  - Scan passed OR admin → Allow
    ↓
Log to Audit Trail
    ↓
Stream File (200 OK)
```

### Download Responses

**Success:**
```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="medical_form.pdf"
```

**Not Scanned (403):**
```json
{"message": "This document has not been scanned for security threats and cannot be downloaded."}
```

**Scan Failed (403):**
```json
{"message": "This document failed security screening and has been quarantined."}
```

### Delete Endpoint

```
DELETE /api/documents/{id}
```

**Authorization:** Uploader or admin only

**Response:** 204 No Content

### Document Deletion Lifecycle

The `Document` model uses Laravel's `SoftDeletes` trait. Deletion behavior differs depending on the type of delete operation:

| Operation | Database record | Physical file |
|---|---|---|
| `$document->delete()` (soft delete) | Sets `deleted_at`; row remains | **Preserved** — file stays on disk |
| `$document->forceDelete()` (hard delete) | Row removed permanently | **Deleted** — file removed from disk |

Soft-delete intentionally preserves the physical file so that the document can be fully restored (including its binary content) if `restore()` is called on the record. Restoring a soft-deleted record without the underlying file would result in a broken reference.

The physical file deletion on `forceDelete()` is handled by a model observer registered in `Document::booted()`:

```php
protected static function booted(): void
{
    static::forceDeleting(function (Document $document): void {
        if ($document->disk && $document->path) {
            Storage::disk($document->disk)->delete($document->path);
        }
    });
}
```

If the file cannot be deleted (e.g., already missing), the failure is logged as a warning and does not block the database row deletion. This prevents orphaned rows from accumulating when storage-side inconsistencies occur.

**HIPAA implication:** `forceDelete()` is the only approved mechanism for permanent PHI removal. It must not be called on active documents and should be part of a formal data disposal process documented separately.

---

## Polymorphic Associations

### Supported Entities

| Entity | Model Class | Use Case |
|--------|-------------|----------|
| Camper | App\Models\Camper | Identification, photos |
| Medical Record | App\Models\MedicalRecord | Medical forms, insurance |
| Application | App\Models\Application | Supporting documentation |

### Association Example

```http
POST /api/documents
{
  "file": [binary],
  "documentable_type": "App\\Models\\MedicalRecord",
  "documentable_id": 10,
  "document_type": "medical"
}
```

### Retrieve Associated Documents

```php
// Via Eloquent
$medicalRecord = MedicalRecord::find(10);
$documents = $medicalRecord->documents;

// Via API
GET /api/medical-records/10
// Response includes documents array
```

---

## Authorization and Error Handling

### Document Policy

| Action | Rule |
|--------|------|
| View | User owns parent OR admin OR medical role |
| Upload | User owns parent OR admin |
| Download | Can view AND scan passed (OR admin) |
| Delete | Uploader OR admin |

### Common Errors

| Error | HTTP | Message | Resolution |
|-------|------|---------|------------|
| File too large | 422 | File size exceeds maximum | Reduce file size |
| Invalid type | 422 | File type not allowed | Convert to PDF/image |
| Missing file | 422 | File field required | Include in multipart request |
| Invalid parent | 422 | documentable_id invalid | Ensure parent exists |
| Storage failure | 500 | Failed to store file | Check disk space/permissions |

### Server Configuration

**PHP (php.ini):**
```ini
file_uploads = On
upload_max_filesize = 12M
post_max_size = 12M
max_execution_time = 60
memory_limit = 256M
```

**Nginx:**
```nginx
client_max_body_size 12M;
```

**Apache:**
```apache
LimitRequestBody 12582912
```

---

## Document Categories

The system recognises three functional categories of document. These are not stored as a separate column — they are distinguished by context, ownership, and upload origin.

| Category | Description | Upload path | Who uploads |
|----------|-------------|-------------|-------------|
| **Required** | Documents mandated by compliance rules (`RequiredDocumentRule`). Must be present, non-expired, and `verification_status = approved` before an application can be approved. Examples: `immunization_record`, `insurance_card`, `official_medical_form`. | `POST /api/documents` with `documentable_type=App\Models\Application` | Applicant (or admin on behalf) |
| **Requested** | Admin-initiated document requests sent to a specific applicant via `DocumentRequest`. Status progresses through `awaiting_upload → uploaded → scanning → under_review → approved / rejected`. When approved, the request is counted as satisfying the corresponding required document type for the linked application. | `POST /api/document-requests/{id}/upload` | Applicant in response to a request |
| **Supporting** | Any document uploaded to a camper, application, or other documentable that is not tied to a compliance rule. Examples: release forms, permission slips, photos. | `POST /api/documents` | Admin or applicant |

---

## Paper Application Document Handling

Paper applications (`submission_source = paper_self`) follow a different lifecycle from digital applications and require special handling in the document compliance system.

### How paper applications differ

A digital application has its `submitted_at` field stamped during the online finalize step. A paper application bypasses this flow: the parent uploads a physical packet (`paper_application_packet`) via the Official Forms portal, and the application may never have `submitted_at` set on it.

This means documents associated with a paper application can exist in the system but not be visible to queries that filter on `submitted_at IS NOT NULL` — which is the standard filter used to hide drafts from admin views.

### How the compliance system handles it

`DocumentEnforcementService::checkCompliance()` accepts an optional `Application $application` argument. When provided, `getUploadedDocuments()` merges documents from three paths:

1. **Camper-scoped documents** — `Camper.documents()` (always included).
2. **Application-scoped documents** — Documents attached to the camper's applications where `submitted_at IS NOT NULL`, **plus** all documents attached to the provided `$application` directly, even if `submitted_at` is null.
3. **Approved DocumentRequest stubs** — For any `DocumentRequest` linked to the application's ID with `status = approved` and an uploaded file path, a synthetic `Document` object is constructed with `verification_status = approved`. This allows admin-requested documents to satisfy compliance rules without requiring a separate `documents` row.

The result is that paper applications are treated as first-class citizens by the compliance engine. No document that is genuinely present and approved is invisible to the approval gate.

### Fix: Document Visibility for Paper Applications (2026-04-24)

**Previous issue:**

`DocumentEnforcementService::checkCompliance()` was called without an application context:
```php
$compliance = $this->documentEnforcement->checkCompliance($application->camper);
```

`getUploadedDocuments()` built its application-scoped document set from `submitted_at IS NOT NULL` across all the camper's applications. For paper applications that had never gone through the digital finalize step, their attached documents had `submitted_at = null` and were excluded from the set. The compliance gate reported them as "missing" and blocked approval.

**Current behavior:**

`ApplicationService::reviewApplication()` now passes the application:
```php
$compliance = $this->documentEnforcement->checkCompliance($application->camper, $application);
```

The provided application is always included in Path 2, bypassing the `submitted_at` filter for that specific application only. Drafts on other applications are still filtered out. Approved `DocumentRequest` rows (Path 3) are also synthesised and included.

---

## Approval Validation Logic

When an admin submits an approval decision, `DocumentEnforcementService::checkCompliance()` evaluates whether all required documents are satisfied before the application status is changed.

### Definitions

| Term | Definition |
|------|------------|
| **Missing** | No document with the required `document_type` exists in any of the three paths (camper docs, application docs, approved requests). |
| **Unverified** | A document exists but `verification_status` is `pending` or `rejected`. |
| **Approved** | A document exists and `verification_status = approved`. Expiration date (if set) has not passed. |

### Outcome

| Result | Condition | HTTP response |
|--------|-----------|---------------|
| Compliant | All required document types are Approved and non-expired | Approval proceeds |
| Non-compliant | One or more required types are Missing or Unverified | HTTP 422; `compliance` details included in response body |
| Override | Admin confirms `override_incomplete = true` | Approval proceeds with `incomplete_approval = true` recorded; audit log notes the override |

### What counts toward compliance

- Documents attached to the camper (`documentable_type = App\Models\Camper`).
- Documents attached to any of the camper's applications where `submitted_at IS NOT NULL`.
- Documents attached to the **current application being approved**, regardless of `submitted_at`.
- Approved `DocumentRequest` rows for the current application (synthesised stubs).

Documents that do **not** count:
- Draft documents on other applications (`submitted_at = null` on documents not linked to the current application).
- Archived documents (`archived_at IS NOT NULL`).
- Expired documents (beyond `expiration_date`).

---

## Cross-References

For related documentation, see:

- [API Reference](./API_REFERENCE.md) — Document endpoints
- [Security](./SECURITY.md) — File upload security
- [Audit Logging](./AUDIT_LOGGING.md) — Document access audit trail
- [Roles and Permissions](./ROLES_AND_PERMISSIONS.md) — Authorization rules
- [Troubleshooting](./TROUBLESHOOTING.md) — Common upload issues

---

**Document Status:** Authoritative
**Last Updated:** April 2026 (2026-04-24) — Added Document Categories, Paper Application Document Handling, Approval Validation Logic, and fix explanation for paper application document visibility. Previous: 2026-04-09 Full System Forensic Audit.
**Version:** 1.2.0
