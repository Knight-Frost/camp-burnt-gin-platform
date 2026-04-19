# Data Model

This document describes the database schema, entity relationships, and data model for the Camp Burnt Gin API backend.

---

## Database Tables

The system implements 50 database tables across six functional domains.

**Identity and Access (5 tables)**

| Table | Description |
|-------|-------------|
| `users` | User accounts and authentication |
| `roles` | Role definitions: super_admin, admin, applicant, medical |
| `personal_access_tokens` | Sanctum API tokens |
| `sessions` | Laravel server-side session storage |
| `password_reset_tokens` | Password reset tokens (keyed by email) |

**Camp and Session Management (3 tables)**

| Table | Description |
|-------|-------------|
| `camps` | Camp program definitions |
| `camp_sessions` | Individual session schedules with capacity and enrollment tracking |
| `cabins` | Cabin records linked to camp sessions (table exists; admin UI not yet built) |

**Registration and Applications (9 tables)**

| Table | Description |
|-------|-------------|
| `campers` | Camper profiles linked to parent users; soft-deleted |
| `applications` | Enrollment applications with status state machine; soft-deleted |
| `application_consents` | Seven per-application consent records |
| `application_drafts` | Server-side save slots for in-progress application form data |
| `emergency_contacts` | Camper-level emergency contacts |
| `documents` | Polymorphic file records — attachments to applications, campers, messages |
| `document_requests` | Admin-issued document requests to applicants |
| `applicant_documents` | Tracks template + submitted document per request |
| `required_document_rules` | Rule engine: which documents are required before approval |

**Medical (15 tables — all PHI-sensitive)**

| Table | Description |
|-------|-------------|
| `medical_records` | Root health record per camper; one-to-one |
| `allergies` | Allergen records with severity classification |
| `medications` | Medication records with dosage and frequency |
| `diagnoses` | CYSHCN diagnoses with ICD codes and severity |
| `behavioral_profiles` | Behavioral risk data: wandering, aggression, supervision level |
| `feeding_plans` | Feeding type, dietary protocols, G-tube information |
| `assistive_devices` | Assistive device inventory per camper |
| `activity_permissions` | Per-activity clearance levels |
| `personal_care_plans` | ADL assistance levels: bathing, dressing, toileting, mobility, hygiene |
| `medical_provider_links` | Time-limited secure tokens for external provider read access |
| `treatment_logs` | Clinical interventions and medication administrations |
| `medical_incidents` | Injury and health events with severity classification |
| `medical_follow_ups` | Follow-up task queue generated from incidents |
| `medical_visits` | Health office visit records with vitals and disposition |
| `medical_restrictions` | Activity, dietary, and environmental restriction records |

**Risk Assessment (4 tables)**

| Table | Description |
|-------|-------------|
| `risk_factors` | Named scoring factors with point values; database-configurable |
| `risk_rules` | Conditional scoring rules that apply bonus points per factor |
| `risk_thresholds` | Score-to-supervision-level and complexity-tier mappings |
| `risk_assessments` | Persisted scoring results per camper with clinical review state |

**Messaging (4 tables)**

| Table | Description |
|-------|-------------|
| `conversations` | Thread containers; links optionally to applications, campers, sessions |
| `conversation_participants` | Per-user thread membership with inbox state |
| `messages` | Immutable message records; soft-deleted |
| `message_recipients` | TO/CC/BCC recipient rows per message (Gmail-style) |
| `message_reads` | Per-user read receipts |

**Content and Calendar (3 tables)**

| Table | Description |
|-------|-------------|
| `announcements` | Admin-published portal announcements |
| `calendar_events` | Camp calendar entries; auto-created by deadlines observer |
| `deadlines` | Named application deadlines linked to calendar events |

**System (5 tables)**

| Table | Description |
|-------|-------------|
| `notifications` | User notification history |
| `audit_logs` | Immutable HIPAA audit trail |
| `user_emergency_contacts` | Emergency contacts linked to user profiles (distinct from camper contacts) |
| `form_definitions` | Versioned dynamic application form definitions |
| `form_sections` / `form_fields` / `form_field_options` | Form schema hierarchy |

---

## Entity Relationship Diagram

```
┌─────────┐
│  roles  │
└────┬────┘
     │
     │ 1:N
     ▼
┌─────────────┐        1:N         ┌──────────┐
│   users     │◄────────────────────│ campers  │
└──────┬──────┘                     └────┬─────┘
       │                                 │
       │ 1:N                            │ 1:N
       ▼                                 ▼
┌──────────────────┐            ┌──────────────────┐
│ notifications    │            │  applications    │
└──────────────────┘            └────────┬─────────┘
                                         │
       ┌─────────────────────────────────┤
       │                                 │
       │ 1:N                            │ N:1
       ▼                                 ▼
┌──────────────────┐            ┌──────────────────┐
│ medical_records  │            │  camp_sessions   │
└────────┬─────────┘            └────────┬─────────┘
         │                               │
         │                               │ N:1
         │                               ▼
         │                         ┌────────────┐
         │                         │   camps    │
         │                         └────────────┘
         │
         ├─── 1:N ────┐
         │            │
         ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────────────────┐
   │allergies │ │medications│ │ emergency_contacts   │
   └──────────┘ └──────────┘ └──────────────────────┘

        (campers also have)
                │
                ├─── 1:N ──► documents (polymorphic)
                │
                ├─── 1:N ──► medical_provider_links
                │
                ├─── 1:N ──► treatment_logs (recorded_by → users)
                │
                ├─── 1:N ──► medical_incidents (recorded_by → users)
                │
                ├─── 1:N ──► medical_follow_ups (created_by → users)
                │
                ├─── 1:N ──► medical_visits (recorded_by → users)
                │
                └─── 1:N ──► medical_restrictions (created_by → users)


        Inbox Messaging System Entities:

┌─────────────┐        1:N         ┌──────────────────┐
│   users     │◄────────────────────│ conversations    │
└──────┬──────┘                     └────────┬─────────┘
       │                                     │
       │ N:M                                │ 1:N
       ▼                                     ▼
┌──────────────────────┐            ┌──────────────────┐
│ conversation_        │            │  messages        │
│ participants         │            └────────┬─────────┘
└──────────────────────┘                     │
                                 ┌───────────┼──────────┐
                                 │ 1:N       │ 1:N      │
                                 ▼           ▼          ▼
                          ┌──────────┐ ┌──────────────────────┐
                          │ message_ │ │  message_recipients  │
                          │ reads    │ │  (TO/CC/BCC per msg) │
                          └──────────┘ └──────────────────────┘

        (conversations can link to)
                │
                ├─── N:1 ──► applications (optional FK)
                ├─── N:1 ──► campers (optional FK)
                └─── N:1 ──► camp_sessions (optional FK)

        (messages can have)
                │
                └─── 1:N ──► documents (polymorphic attachments)
```

---

## Table Schemas

### users

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | User identifier |
| `name` | varchar(255) | not null | Full name |
| `email` | varchar(255) | unique, not null | Email address |
| `email_verified_at` | timestamp | nullable | Email verification timestamp |
| `password` | varchar(255) | not null | bcrypt password hash |
| `role_id` | bigint | FK to roles, not null | User role |
| `mfa_enabled` | boolean | default false | MFA enabled status |
| `mfa_secret` | varchar(255) | nullable | TOTP secret (hidden) |
| `mfa_verified_at` | timestamp | nullable | MFA verification timestamp |
| `failed_login_attempts` | integer | default 0 | Failed login counter |
| `lockout_until` | timestamp | nullable | Account lockout expiration |
| `remember_token` | varchar(100) | nullable | Remember token |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`email`)
- KEY (`role_id`)

**Relationships:**
- belongs to: `roles`
- has many: `campers`, `notifications`, `personal_access_tokens`

### campers

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Camper identifier |
| `user_id` | bigint | FK to users, not null | Parent user |
| `first_name` | varchar(255) | not null | First name |
| `last_name` | varchar(255) | not null | Last name |
| `date_of_birth` | date | not null | Birth date |
| `gender` | varchar(50) | nullable | Gender |
| `tshirt_size` | varchar(20) | nullable | T-shirt size |
| `supervision_level` | varchar(50) | nullable | Supervision level enum |
| `is_active` | boolean | not null, default false | Operational activation flag — true when at least one approved application exists |
| `record_retention_until` | date | nullable | Date after which permanent deletion is permitted |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |
| `deleted_at` | timestamp | nullable | Soft delete timestamp (record retention) |

**`is_active` lifecycle:** Set to `true` by `ApplicationService` when an application is approved. Set to `false` when an approved application is reversed and no other approved application exists for this camper. Never set by direct API calls.

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`user_id`)
- KEY (`date_of_birth`)
- KEY (`is_active`)
- KEY (`deleted_at`)

**Relationships:**
- belongs to: `users`
- has many: `applications`, `medical_records`, `allergies`, `medications`, `emergency_contacts`, `medical_provider_links`, `treatment_logs`, `medical_incidents`, `medical_follow_ups`, `medical_visits`, `medical_restrictions`
- has many (polymorphic): `documents`

### applications

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Application identifier |
| `camper_id` | bigint | FK to campers, not null | Camper |
| `camp_session_id` | bigint | FK to camp_sessions, not null | Session |
| `status` | enum | not null | pending/approved/rejected/waitlisted |
| `is_draft` | boolean | default true | Draft status |
| `submitted_at` | timestamp | nullable | Submission timestamp |
| `reviewed_at` | timestamp | nullable | Review timestamp |
| `reviewed_by` | bigint | FK to users, nullable | Reviewer user |
| `notes` | text | nullable | Admin notes |
| `signature_data` | text | nullable | Digital signature data |
| `signature_name` | varchar(255) | nullable | Signer name |
| `signed_at` | timestamp | nullable | Signature timestamp |
| `signed_ip_address` | varchar(45) | nullable | Signer IP |
| `form_definition_id` | bigint | FK to form_definitions, nullable | Form version used to create this application (Phase 14) |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`camper_id`, `camp_session_id`)
- KEY (`camp_session_id`)
- KEY (`status`)
- KEY (`is_draft`)
- KEY (`reviewed_at`)
- KEY (`form_definition_id`)

**Relationships:**
- belongs to: `campers`, `camp_sessions`, `users` (reviewer)
- belongs to: `form_definitions` (optional — links the application to the dynamic form version used at submission time)

### medical_records

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Record identifier |
| `camper_id` | bigint | FK to campers, not null, unique | Camper |
| `is_active` | boolean | not null, default false | Operational activation flag — true when associated camper has an approved application |
| `physician_name` | varchar(255) | nullable, encrypted | Physician name (PHI) |
| `physician_phone` | varchar(20) | nullable, encrypted | Physician phone (PHI) |
| `insurance_provider` | varchar(255) | nullable, encrypted | Insurance provider (PHI) |
| `insurance_policy_number` | varchar(100) | nullable, encrypted | Policy number (PHI) |
| `special_needs` | text | nullable, encrypted | Special needs notes (PHI) |
| `dietary_restrictions` | text | nullable, encrypted | Dietary restrictions (PHI) |
| `notes` | text | nullable, encrypted | General medical notes (PHI) |
| `has_seizures` | boolean | default false | Seizure history flag |
| `last_seizure_date` | date | nullable | Date of most recent known seizure |
| `seizure_description` | text | nullable, encrypted | Seizure presentation description (PHI) |
| `has_neurostimulator` | boolean | default false | Neurostimulator presence flag |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**`is_active` lifecycle:** Set to `true` by `ApplicationService` when a medical record is created or reactivated upon approval. Set to `false` when an approved application is reversed and no other approved application exists for the associated camper. Never set by direct API calls. Medical staff operational views are filtered to `is_active = true` only.

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`camper_id`)
- KEY (`is_active`)

**Relationships:**
- belongs to: `campers`

### allergies

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Allergy identifier |
| `camper_id` | bigint | FK to campers, not null | Camper |
| `allergen` | varchar(255) | not null | Allergen name |
| `severity` | enum | not null | mild/moderate/severe |
| `reaction` | text | nullable | Reaction description |
| `treatment` | text | nullable | Treatment protocol |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`camper_id`)

**Relationships:**
- belongs to: `campers`

### medications

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Medication identifier |
| `camper_id` | bigint | FK to campers, not null | Camper |
| `name` | varchar(255) | not null | Medication name |
| `dosage` | varchar(100) | not null | Dosage |
| `frequency` | varchar(100) | not null | Frequency |
| `prescribing_physician` | varchar(255) | nullable | Physician |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`camper_id`)

**Relationships:**
- belongs to: `campers`

### `medical_incidents`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint (PK) | Auto-increment |
| `camper_id` | bigint (FK) | References `campers.id`, cascade delete |
| `recorded_by` | bigint (FK) | References `users.id` |
| `treatment_log_id` | bigint (FK, nullable) | References `treatment_logs.id`, null on delete |
| `type` | enum | `behavioral`, `medical`, `injury`, `environmental`, `emergency`, `other` |
| `severity` | enum | `minor`, `moderate`, `severe`, `critical` |
| `location` | text (encrypted, nullable) | Where incident occurred |
| `title` | text (encrypted) | Brief incident title |
| `description` | text (encrypted) | Full incident narrative |
| `witnesses` | text (encrypted, nullable) | Witness names |
| `escalation_required` | boolean | Default false |
| `escalation_notes` | text (encrypted, nullable) | Escalation details and actions taken |
| `incident_date` | date | Date of occurrence |
| `incident_time` | time (nullable) | Time of occurrence |
| `created_at` / `updated_at` | timestamp | Standard Laravel timestamps |

**Indexes:** `camper_id`, `recorded_by`, `(camper_id, incident_date)`, `type`, `severity`

---

### `medical_follow_ups`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint (PK) | Auto-increment |
| `camper_id` | bigint (FK) | References `campers.id`, cascade delete |
| `created_by` | bigint (FK) | References `users.id` |
| `assigned_to` | bigint (FK, nullable) | References `users.id` |
| `treatment_log_id` | bigint (FK, nullable) | References `treatment_logs.id`, null on delete |
| `title` | string | Follow-up task title |
| `notes` | text (nullable) | Additional context |
| `status` | enum | `pending`, `in_progress`, `completed`, `cancelled` |
| `priority` | enum | `low`, `medium`, `high`, `urgent` |
| `due_date` | date | Task due date |
| `completed_at` | timestamp (nullable) | When status moved to `completed` |
| `completed_by` | bigint (FK, nullable) | References `users.id` |
| `created_at` / `updated_at` | timestamp | Standard Laravel timestamps |

**Indexes:** `camper_id`, `created_by`, `assigned_to`, `status`, `due_date`

---

### `medical_visits`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint (PK) | Auto-increment |
| `camper_id` | bigint (FK) | References `campers.id`, cascade delete |
| `recorded_by` | bigint (FK) | References `users.id` |
| `visit_date` | date | Date of visit |
| `visit_time` | time (nullable) | Time of visit |
| `chief_complaint` | text (encrypted) | Primary reason for visit |
| `symptoms` | text (encrypted) | Observed symptoms |
| `vitals` | JSON (nullable) | `{ temp, pulse, bp, spo2, weight }` |
| `treatment_provided` | text (encrypted, nullable) | Treatment administered |
| `medications_administered` | text (encrypted, nullable) | Medications given during visit |
| `disposition` | enum | `returned_to_activity`, `monitoring`, `sent_home`, `emergency_transfer`, `other` |
| `disposition_notes` | text (encrypted, nullable) | Notes on outcome |
| `follow_up_required` | boolean | Default false |
| `follow_up_notes` | text (encrypted, nullable) | Follow-up instructions |
| `created_at` / `updated_at` | timestamp | Standard Laravel timestamps |

**Indexes:** `camper_id`, `recorded_by`, `(camper_id, visit_date)`

---

### `medical_restrictions`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint (PK) | Auto-increment |
| `camper_id` | bigint (FK) | References `campers.id`, cascade delete |
| `created_by` | bigint (FK) | References `users.id` |
| `restriction_type` | string | e.g., `activity`, `dietary`, `environmental`, `equipment` |
| `description` | text (encrypted) | Restriction details |
| `start_date` | date | Effective from |
| `end_date` | date (nullable) | Null = indefinite |
| `is_active` | boolean | Default true |
| `notes` | text (encrypted, nullable) | Additional clinical notes |
| `created_at` / `updated_at` | timestamp | Standard Laravel timestamps |

**Indexes:** `camper_id`, `created_by`, `(camper_id, is_active)`

---

### conversations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Conversation identifier |
| `created_by_id` | bigint | FK to users, not null | Conversation creator |
| `subject` | varchar(255) | not null | Conversation subject |
| `application_id` | bigint | FK to applications, nullable | Linked application |
| `camper_id` | bigint | FK to campers, nullable | Linked camper |
| `camp_session_id` | bigint | FK to camp_sessions, nullable | Linked session |
| `last_message_at` | timestamp | not null | Last message timestamp |
| `is_archived` | boolean | default false | Archive status |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |
| `deleted_at` | timestamp | nullable | Soft delete timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`created_by_id`)
- KEY (`application_id`)
- KEY (`camper_id`)
- KEY (`camp_session_id`)
- KEY (`is_archived`)
- KEY (`last_message_at`)
- KEY (`deleted_at`)
- COMPOSITE KEY (`is_archived`, `deleted_at`, `last_message_at`)

**Relationships:**
- belongs to: `users` (creator)
- belongs to: `applications` (optional)
- belongs to: `campers` (optional)
- belongs to: `camp_sessions` (optional)
- has many: `messages`
- has many: `conversation_participants`
- has many through: `participants` (users via conversation_participants)

### conversation_participants

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Participant record identifier |
| `conversation_id` | bigint | FK to conversations, not null | Conversation |
| `user_id` | bigint | FK to users, not null | Participant user |
| `joined_at` | timestamp | not null | Join timestamp |
| `left_at` | timestamp | nullable | Leave timestamp |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`conversation_id`, `user_id`)
- KEY (`user_id`)
- KEY (`left_at`)

**Relationships:**
- belongs to: `conversations`
- belongs to: `users`

### messages

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Message identifier |
| `conversation_id` | bigint | FK to conversations, not null | Conversation |
| `sender_id` | bigint | FK to users, not null | Message sender |
| `body` | text | not null | Message content |
| `idempotency_key` | varchar(64) | unique, not null | Duplicate prevention |
| `parent_message_id` | bigint | FK to messages, nullable, null on delete | The message being replied to (`reply` or `reply_all` flows) |
| `reply_type` | enum | nullable | `reply` or `reply_all`; null for original thread messages |
| `created_at` | timestamp | not null | Send timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |
| `deleted_at` | timestamp | nullable | Soft delete timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`idempotency_key`)
- KEY (`conversation_id`)
- KEY (`sender_id`)
- KEY (`created_at`)
- KEY (`deleted_at`)
- COMPOSITE KEY (`parent_message_id`, `created_at`)

**Relationships:**
- belongs to: `conversations`
- belongs to: `users` (sender)
- belongs to: `messages` (parent, optional — only set on reply messages)
- has many: `messages` (replies)
- has many: `message_reads`
- has many: `message_recipients`
- has many (polymorphic): `documents` (attachments via documentable_type/documentable_id)

### message_reads

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Read receipt identifier |
| `message_id` | bigint | FK to messages, not null | Message |
| `user_id` | bigint | FK to users, not null | Reader user |
| `read_at` | timestamp | not null | Read timestamp |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`message_id`, `user_id`)
- KEY (`user_id`)
- KEY (`read_at`)

**Relationships:**
- belongs to: `messages`
- belongs to: `users`

### document_requests

**Purpose:** Tracks admin-initiated requests for applicants to submit specific documents. Drives the Document Request workflow (Phase 13).

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `applicant_id` | bigint FK → users | The applicant receiving the request |
| `application_id` | bigint FK → applications (nullable) | Optional application context |
| `camper_id` | bigint FK → campers (nullable) | Optional camper context |
| `admin_id` | bigint FK → users | Admin who created the request |
| `title` | string | Document name/title requested |
| `description` | text (nullable) | Instructions for the applicant |
| `status` | enum | `awaiting_upload`, `uploaded`, `scanning`, `under_review`, `approved`, `rejected`, `overdue` |
| `due_date` | date (nullable) | Optional deadline |
| `rejection_reason` | text (nullable) | Populated when status = rejected |
| `submitted_at` | timestamp (nullable) | When applicant uploaded |
| `reviewed_at` | timestamp (nullable) | When admin reviewed |
| `document_id` | bigint FK → documents (nullable) | The uploaded document |
| `created_at`, `updated_at` | timestamps | |

**Relationships:**
- belongs to: `users` (applicant), `users` (admin), `applications` (optional), `campers` (optional), `documents` (optional)

---

### applicant_documents

**Purpose:** Tracks documents sent from admins to applicants and their submission status.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `applicant_id` | bigint FK → users | Receiving applicant |
| `admin_id` | bigint FK → users (nullable) | Sending admin |
| `original_document_id` | bigint FK → documents (nullable) | Template/original file |
| `submitted_document_id` | bigint FK → documents (nullable) | Applicant's submitted file |
| `title` | string | Document title |
| `description` | text (nullable) | Instructions |
| `status` | enum | `pending`, `submitted`, `reviewed` |
| `is_reviewed` | boolean | Whether admin has reviewed submission |
| `reviewed_at` | timestamp (nullable) | When admin reviewed |
| `created_at`, `updated_at` | timestamps | |

**Relationships:**
- belongs to: `users` (applicant), `users` (admin), `documents` (original), `documents` (submitted)

---

### form_definitions

**Purpose:** Stores versioned application form definitions managed by super administrators. Only one definition may be published at a time. (Phase 14)

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `name` | string | Human-readable form name |
| `version` | integer | Auto-incrementing version number |
| `status` | enum | `draft`, `published` |
| `published_at` | timestamp (nullable) | When the form was published |
| `created_by` | bigint FK → users (nullable) | Super admin who created it |
| `created_at`, `updated_at` | timestamps | |

**Relationships:**
- belongs to: `users` (creator)
- has many: `form_sections`
- has many: `applications` (via nullable FK)

---

### form_sections

**Purpose:** Defines sections within a form definition. Each section groups related fields. (Phase 14)

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `form_definition_id` | bigint FK → form_definitions | Parent form |
| `title` | string | Section display title |
| `description` | text (nullable) | Optional section instructions |
| `order` | integer | Display order within the form |
| `is_active` | boolean | Whether the section is shown |
| `created_at`, `updated_at` | timestamps | |

**Relationships:**
- belongs to: `form_definitions`
- has many: `form_fields`

---

### form_fields

**Purpose:** Defines individual input fields within a form section. (Phase 14)

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `form_section_id` | bigint FK → form_sections | Parent section |
| `field_key` | string | Stable identifier used in application data. Cannot be changed once applications reference it. |
| `label` | string | Display label |
| `type` | enum | `text`, `textarea`, `select`, `checkbox`, `radio`, `date`, `file`, `number`, `email`, `phone` |
| `placeholder` | string (nullable) | Input placeholder text |
| `help_text` | text (nullable) | Helper text shown below the field |
| `is_required` | boolean | Whether the field is mandatory |
| `is_active` | boolean | Whether the field is shown |
| `validation_rules` | json (nullable) | Additional validation constraints |
| `order` | integer | Display order within the section |
| `created_at`, `updated_at` | timestamps | |

**Relationships:**
- belongs to: `form_sections`
- has many: `form_field_options`

---

### form_field_options

**Purpose:** Stores selectable options for select, checkbox, and radio form fields. (Phase 14)

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `form_field_id` | bigint FK → form_fields | Parent field |
| `label` | string | Display label |
| `value` | string | Stored value |
| `order` | integer | Display order |
| `created_at`, `updated_at` | timestamps | |

**Relationships:**
- belongs to: `form_fields`

---

### announcements

**Purpose:** Stores admin-created announcements shown to users in their portal dashboards.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `title` | string | Announcement title |
| `body` | text | Announcement content |
| `author_id` | bigint FK → users | Admin who created the announcement |
| `is_pinned` | boolean | Whether the announcement is pinned to the top |
| `created_at`, `updated_at` | timestamps | |

---

### calendar_events

**Purpose:** Stores camp-related calendar events visible to users in the portal.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `title` | string | Event title |
| `description` | text (nullable) | Event details |
| `start_date` | date | Event start date |
| `end_date` | date (nullable) | Event end date |
| `all_day` | boolean | Whether the event spans a full day |
| `created_by` | bigint FK → users | User who created the event |
| `created_at`, `updated_at` | timestamps | |

---

### user_emergency_contacts

**Purpose:** Stores emergency contacts linked to user (applicant) profiles. Distinct from camper-level `emergency_contacts`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `user_id` | bigint FK → users | Owning user |
| `name` | string | Contact name |
| `relationship` | string | Relationship to user |
| `phone_primary` | string | Primary phone number |
| `phone_secondary` | string (nullable) | Secondary phone number |
| `created_at`, `updated_at` | timestamps | |

---

### required_document_rules

**Purpose:** Defines which documents are required for application submission, used to enforce document completeness before an application can be finalized.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `document_type` | string | Machine-readable document type identifier |
| `label` | string | Human-readable document label |
| `is_required` | boolean | Whether the document is mandatory for submission |
| `created_at`, `updated_at` | timestamps | |

---

### roles

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Role identifier |
| `name` | varchar(255) | unique, not null | Role name: `super_admin`, `admin`, `applicant`, `medical` |
| `description` | varchar(255) | nullable | Human-readable description |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Relationships:**
- has many: `users`

---

### camps

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Camp identifier |
| `name` | varchar(255) | not null | Camp program name |
| `description` | text | nullable | Camp description |
| `location` | varchar(255) | nullable | Physical location |
| `is_active` | boolean | not null, default true | Active flag |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Relationships:**
- has many: `camp_sessions`

---

### camp_sessions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Session identifier |
| `camp_id` | bigint | FK to camps, cascade delete | Parent camp |
| `name` | varchar(255) | not null | Session name |
| `start_date` | date | not null | Session start date |
| `end_date` | date | not null | Session end date |
| `capacity` | integer unsigned | not null | Maximum camper capacity |
| `min_age` | tinyint unsigned | not null | Minimum camper age |
| `max_age` | tinyint unsigned | nullable | Maximum camper age (nullable after 2026-03-23 migration) |
| `registration_opens_at` | datetime | nullable | When registration becomes available |
| `registration_closes_at` | datetime | nullable | When registration closes |
| `is_active` | boolean | not null, default true | Session active flag |
| `portal_open` | boolean | not null, default false | Controls applicant portal visibility for this session |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:** `(start_date, end_date)`, `is_active`

**Relationships:**
- belongs to: `camps`
- has many: `applications`, `cabins`, `deadlines`, `conversations` (optional FK)

---

### cabins

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Cabin identifier |
| `camp_session_id` | bigint | FK to camp_sessions, cascade delete | Owning session |
| `name` | varchar(100) | not null | Cabin label (e.g. "Cabin A", "Oak") |
| `capacity` | smallint unsigned | not null, default 10 | Max camper occupancy |
| `notes` | text | nullable | Staff notes (accessibility needs, layout) |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:** UNIQUE `(camp_session_id, name)`, `camp_session_id`

**Note:** Table and data model exist; admin UI for cabin assignments is not yet built.

**Relationships:**
- belongs to: `camp_sessions`
- has many: `campers` (via `cabin_id` FK added in 2026-03-14 migration)

---

### emergency_contacts

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Contact identifier |
| `camper_id` | bigint | FK to campers, cascade delete | Associated camper |
| `name` | varchar(255) | not null | Contact full name |
| `relationship` | varchar(255) | not null | Relationship to camper |
| `phone_primary` | varchar(255) | not null | Primary phone |
| `phone_secondary` | varchar(255) | nullable | Secondary phone |
| `email` | varchar(255) | nullable | Email address |
| `is_primary` | boolean | not null, default false | Primary contact flag |
| `is_authorized_pickup` | boolean | not null, default false | Authorized for camper pickup |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |
| `deleted_at` | timestamp | nullable | Soft delete timestamp |

**Indexes:** `camper_id`, `is_primary`

**Relationships:**
- belongs to: `campers`

---

### documents

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Document identifier |
| `documentable_type` | varchar(255) | nullable | Polymorphic owner type (e.g. `App\Models\Application`) |
| `documentable_id` | bigint | nullable | Polymorphic owner ID |
| `uploaded_by` | bigint | FK to users, null on delete | Uploader user |
| `original_filename` | varchar(255) | not null | Original file name |
| `stored_filename` | varchar(255) | not null | Server storage file name |
| `mime_type` | varchar(255) | not null | MIME type |
| `file_size` | bigint unsigned | not null | File size in bytes |
| `disk` | varchar(255) | not null, default 'local' | Storage disk (always private) |
| `path` | varchar(255) | not null | Storage path |
| `document_type` | varchar(255) | nullable | Canonical type key (e.g. `official_medical_form`) |
| `verification_status` | varchar(255) | not null, default 'pending' | `pending`, `approved`, `rejected` |
| `verified_by` | bigint | FK to users, nullable | Verifying admin |
| `verified_at` | timestamp | nullable | Verification timestamp |
| `archived_at` | timestamp | nullable | Archive timestamp (null = active) |
| `submitted_at` | timestamp | nullable | Submission timestamp; null = draft, not visible to admin |
| `expiration_date` | date | nullable | Document expiration date |
| `is_scanned` | boolean | not null, default false | Antivirus scan complete flag |
| `scan_passed` | boolean | nullable | Scan result (null = not yet scanned) |
| `scanned_at` | timestamp | nullable | Scan timestamp |
| `created_at` | timestamp | not null | Upload timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |
| `deleted_at` | timestamp | nullable | Soft delete timestamp |

**Indexes:** `(documentable_type, documentable_id)`, `document_type`, `verification_status`, `expiration_date`, `uploaded_by`

**`submitted_at` lifecycle:** Null on upload for applicant-initiated uploads. Set immediately for admin uploads and `official_medical_form` / `paper_application_packet` types. Admin document index queries filter `whereNotNull('submitted_at')` — drafts are never surfaced to admin.

**Relationships:**
- belongs to (polymorphic): `applications`, `campers`, `messages`, or any documentable model
- belongs to: `users` (uploader), `users` (verifier)

---

### medical_provider_links

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Link identifier |
| `camper_id` | bigint | FK to campers, cascade delete | Target camper |
| `created_by` | bigint | FK to users, cascade delete | Admin who created the link |
| `token` | varchar(64) | unique, not null | Secure access token |
| `provider_email` | varchar(255) | not null | Provider's email address |
| `provider_name` | varchar(255) | nullable | Provider's name |
| `expires_at` | timestamp | not null | Token expiration time |
| `accessed_at` | timestamp | nullable | First access timestamp |
| `submitted_at` | timestamp | nullable | When the provider submitted data |
| `revoked_at` | timestamp | nullable | Revocation timestamp |
| `revoked_by` | bigint | FK to users, nullable | Admin who revoked the link |
| `is_used` | boolean | not null, default false | Whether the token has been accessed |
| `notes` | text | nullable | Admin notes |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:** `token`, `provider_email`, `expires_at`

**Relationships:**
- belongs to: `campers`, `users` (created_by), `users` (revoked_by)

---

### notifications

Uses Laravel's standard notification schema.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Notification identifier |
| `type` | varchar(255) | not null | Notification class name |
| `notifiable_type` | varchar(255) | not null | Polymorphic notifiable type |
| `notifiable_id` | bigint | not null | Polymorphic notifiable ID |
| `data` | text | not null | JSON notification payload |
| `read_at` | timestamp | nullable | Read timestamp (null = unread) |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:** `(notifiable_type, notifiable_id, read_at)`

---

### application_consents

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Consent record identifier |
| `application_id` | bigint | FK to applications, cascade delete | Parent application |
| `consent_type` | varchar(50) | not null | `general`, `photos`, `liability`, `activity`, `authorization` |
| `guardian_name` | varchar(255) | not null | Guardian's legal name |
| `guardian_relationship` | varchar(100) | not null | Relationship to camper |
| `guardian_signature` | text | not null | Typed name or base64 signature image |
| `applicant_signature` | text | nullable | Camper's signature (required only if camper is 18+) |
| `signed_at` | timestamp | not null | Exact consent timestamp |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:** UNIQUE `(application_id, consent_type)`, `application_id`

**Note:** Each application has exactly 5 consent records — one per consent type. Guardian name and signature are legal records but are not HIPAA PHI; they are stored unencrypted.

**Relationships:**
- belongs to: `applications`

---

### application_drafts

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Draft slot identifier |
| `user_id` | bigint | FK to users, cascade delete | Owner (always an applicant) |
| `label` | varchar(255) | not null, default 'New Application' | Display name for the draft |
| `draft_data` | longtext | nullable | Full serialized FormState JSON blob |
| `application_id` | bigint | FK to applications, nullable | Set once the Application row is created; used for cleanup on finalization (added 2026-04-19) |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Auto-updated on every save; used for optimistic concurrency guard |

**Note:** Hard-delete only — no soft deletes. No PHI is stored in `draft_data`; the camper record does not exist until final submission. Max 10 drafts per user (HTTP 429 if exceeded); max 512 KB per `draft_data` blob (HTTP 422 if exceeded). Optimistic concurrency guard: if `last_known_updated_at` is supplied and does not match server `updated_at`, returns HTTP 409 Conflict.

**Relationships:**
- belongs to: `users`
- belongs to: `applications` (optional — set after Application record is created)

---

### diagnoses

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Diagnosis identifier |
| `camper_id` | bigint | FK to campers, cascade delete | Associated camper |
| `name` | varchar(255) | not null | Diagnosis name |
| `description` | text | nullable | Clinical description |
| `severity_level` | varchar(255) | not null | Severity classification |
| `notes` | text | nullable | Additional clinical notes |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:** `camper_id`, `severity_level`

**Relationships:**
- belongs to: `campers`

---

### behavioral_profiles

One record per camper. Contains behavioral risk data used by the risk engine and medical staff.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Profile identifier |
| `camper_id` | bigint | FK to campers, unique, cascade delete | Owning camper (one-to-one) |
| `aggression` | boolean | not null, default false | History of aggressive behavior |
| `self_abuse` | boolean | not null, default false | History of self-injurious behavior |
| `wandering_risk` | boolean | not null, default false | Elopement / wandering risk |
| `one_to_one_supervision` | boolean | not null, default false | Requires dedicated 1:1 supervision |
| `developmental_delay` | boolean | not null, default false | Developmental delay present |
| `functioning_age_level` | varchar(255) | nullable | Estimated developmental age |
| `communication_methods` | json | nullable | Array of communication modalities |
| `notes` | text | nullable | General behavioral notes |
| `sexual_behaviors` | boolean | not null, default false | Problematic sexual behaviors flag |
| `interpersonal_behavior` | boolean | not null, default false | Problematic interpersonal behavior flag |
| `social_emotional` | boolean | not null, default false | Social or emotional condition flag |
| `follows_instructions` | boolean | not null, default false | Difficulty following instructions flag |
| `group_participation` | boolean | not null, default false | Can participate in group activities |
| `attends_school` | boolean | nullable | Attends school (nullable — parent may not answer) |
| `classroom_type` | varchar(200) | nullable | Classroom type when `attends_school = true` |
| `aggression_description` | text | nullable, encrypted | Aggression behavior detail (PHI) |
| `self_abuse_description` | text | nullable, encrypted | Self-abuse behavior detail (PHI) |
| `one_to_one_description` | text | nullable, encrypted | 1:1 supervision detail (PHI) |
| `wandering_description` | text | nullable, encrypted | Wandering risk detail (PHI) |
| `sexual_behaviors_description` | text | nullable, encrypted | Sexual behavior detail (PHI) |
| `interpersonal_behavior_description` | text | nullable, encrypted | Interpersonal behavior detail (PHI) |
| `social_emotional_description` | text | nullable, encrypted | Social/emotional condition detail (PHI) |
| `follows_instructions_description` | text | nullable, encrypted | Instruction-following detail (PHI) |
| `group_participation_description` | text | nullable, encrypted | Group participation detail (PHI) |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:** `camper_id`, `wandering_risk`, `one_to_one_supervision`

**Relationships:**
- belongs to: `campers`

---

### feeding_plans

One record per camper. Contains dietary protocol and tube-feeding data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Plan identifier |
| `camper_id` | bigint | FK to campers, unique, cascade delete | Owning camper (one-to-one) |
| `special_diet` | boolean | not null, default false | Requires special diet |
| `diet_description` | text | nullable | Diet description |
| `g_tube` | boolean | not null, default false | Gastrostomy tube present |
| `formula` | varchar(255) | nullable | Formula type |
| `amount_per_feeding` | varchar(255) | nullable | Volume per feeding |
| `feedings_per_day` | integer | nullable | Number of feedings per day |
| `feeding_times` | json | nullable | Array of feeding time strings |
| `bolus_only` | boolean | not null, default false | Bolus-only feeding flag |
| `notes` | text | nullable | Additional feeding notes |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:** `camper_id`, `g_tube`

**Relationships:**
- belongs to: `campers`

---

### assistive_devices

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Device record identifier |
| `camper_id` | bigint | FK to campers, cascade delete | Associated camper |
| `device_type` | varchar(255) | not null | Device category (e.g. `wheelchair`, `walker`, `AAC device`) |
| `requires_transfer_assistance` | boolean | not null, default false | Staff transfer assistance required |
| `notes` | text | nullable | Device-specific notes |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:** `camper_id`, `device_type`, `requires_transfer_assistance`

**Relationships:**
- belongs to: `campers`

---

### activity_permissions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Permission record identifier |
| `camper_id` | bigint | FK to campers, cascade delete | Associated camper |
| `activity_name` | varchar(255) | not null | Activity identifier |
| `permission_level` | varchar(255) | not null | Clearance level (e.g. `full`, `modified`, `excluded`) |
| `restriction_notes` | text | nullable | Notes on restrictions or accommodations |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:** UNIQUE `(camper_id, activity_name)`, `camper_id`, `activity_name`, `permission_level`

**Relationships:**
- belongs to: `campers`

---

### personal_care_plans

One record per camper. Stores ADL (activities of daily living) assistance levels and care protocols.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Plan identifier |
| `camper_id` | bigint | FK to campers, unique, cascade delete | Owning camper (one-to-one) |
| `bathing_level` | varchar(50) | nullable | Assistance level for bathing/showering |
| `bathing_notes` | text | nullable, encrypted | Bathing protocol detail (PHI) |
| `toileting_level` | varchar(50) | nullable | Daytime toileting assistance level |
| `toileting_notes` | text | nullable, encrypted | Toileting protocol detail (PHI) |
| `nighttime_toileting` | boolean | not null, default false | Requires nighttime toileting assistance |
| `nighttime_notes` | text | nullable, encrypted | Nighttime care detail (PHI) |
| `dressing_level` | varchar(50) | nullable | Dressing/undressing assistance level |
| `dressing_notes` | text | nullable, encrypted | Dressing protocol detail (PHI) |
| `oral_hygiene_level` | varchar(50) | nullable | Oral hygiene assistance level |
| `oral_hygiene_notes` | text | nullable, encrypted | Oral hygiene protocol detail (PHI) |
| `positioning_notes` | text | nullable, encrypted | Positioning and transfer detail (PHI) |
| `sleep_notes` | text | nullable, encrypted | Sleep routine detail (PHI) |
| `falling_asleep_issues` | boolean | not null, default false | Difficulty falling asleep |
| `sleep_walking` | boolean | not null, default false | Sleep walking history |
| `night_wandering` | boolean | not null, default false | Nighttime wandering risk |
| `bowel_control_notes` | text | nullable, encrypted | Bowel and continence detail (PHI) |
| `urinary_catheter` | boolean | not null, default false | Urinary catheter present |
| `menstruation_support` | boolean | not null, default false | Menstruation support required |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Assistance level values:** `independent`, `verbal_cue`, `physical_assist`, `full_assist`

**Relationships:**
- belongs to: `campers`

---

### treatment_logs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Log entry identifier |
| `camper_id` | bigint | FK to campers, cascade delete | Associated camper |
| `recorded_by` | bigint | FK to users, cascade delete | Recording medical staff member |
| `treatment_date` | date | not null | Date of treatment |
| `treatment_time` | time | nullable | Time of treatment |
| `type` | varchar(50) | not null | `medication_administered`, `first_aid`, `observation`, `emergency`, `other` |
| `title` | text | not null, encrypted | Brief intervention title (PHI) |
| `description` | text | not null, encrypted | Full treatment narrative (PHI) |
| `outcome` | text | nullable, encrypted | Treatment outcome (PHI) |
| `follow_up_required` | boolean | not null, default false | Follow-up action needed |
| `follow_up_notes` | text | nullable, encrypted | Follow-up instructions (PHI) |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:** `(camper_id, treatment_date)`, `recorded_by`

**Relationships:**
- belongs to: `campers`, `users` (recorded_by)

---

### risk_factors

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Factor identifier |
| `key` | varchar(255) | unique, not null | Stable identifier used in detection logic |
| `label` | varchar(255) | not null | Human-readable factor name |
| `points` | integer | not null | Base points awarded when this factor is detected |
| `is_active` | boolean | not null, default true | Inactive factors are excluded from scoring |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Relationships:**
- has many: `risk_rules`

---

### risk_rules

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Rule identifier |
| `risk_factor_id` | bigint | FK to risk_factors, cascade delete | Parent factor |
| `condition_type` | varchar(255) | not null | Check type: `count_gte`, `severity_gte`, `field_equals`, etc. |
| `condition_value` | varchar(255) | not null | Threshold value for the condition |
| `bonus_points` | integer | not null | Additional points when condition is met |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Relationships:**
- belongs to: `risk_factors`

---

### risk_thresholds

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Threshold identifier |
| `label` | varchar(255) | not null | Display label (e.g. "Standard", "Enhanced", "Intensive") |
| `min_score` | integer | not null | Inclusive lower bound |
| `max_score` | integer | nullable | Inclusive upper bound (null = open-ended) |
| `supervision_level` | varchar(255) | not null | `standard`, `enhanced`, `intensive`, `one_to_one` |
| `complexity_tier` | varchar(255) | not null | `tier_1`, `tier_2`, `tier_3`, `tier_4` |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

---

### risk_assessments

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Assessment identifier |
| `camper_id` | bigint | FK to campers, cascade delete | Assessed camper |
| `calculated_at` | timestamp | not null | When the score was computed |
| `risk_score` | smallint unsigned | not null | Total score 0–100 |
| `supervision_level` | varchar(20) | not null | System-calculated supervision level |
| `medical_complexity_tier` | varchar(20) | not null | System-calculated complexity tier |
| `flags` | json | nullable | Critical boolean flags (e.g. `seizures`, `g_tube`, `wandering`) |
| `factor_breakdown` | json | nullable | Per-factor detail: `[{key, label, category, points, present}]` |
| `is_current` | boolean | not null, default false | Exactly one record per camper is `true` — the latest |
| `review_status` | varchar(30) | not null, default 'system_calculated' | `system_calculated`, `reviewed`, `overridden` |
| `reviewed_by` | bigint | FK to users, nullable | Medical staff who reviewed |
| `reviewed_at` | timestamp | nullable | Review timestamp |
| `clinical_notes` | text | nullable, encrypted | Clinical observations (PHI) |
| `override_supervision_level` | varchar(20) | nullable | Manually set supervision level (overrides system) |
| `override_reason` | text | nullable, encrypted | Mandatory justification for overrides (PHI) |
| `overridden_by` | bigint | FK to users, nullable | Staff who applied the override |
| `overridden_at` | timestamp | nullable | Override timestamp |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |
| `deleted_at` | timestamp | nullable | Soft delete timestamp |

**Indexes:** `camper_id`, `(camper_id, is_current)`, `calculated_at`, `review_status`

**`effective_supervision_level`:** Derived at read time — `override_supervision_level` if set, otherwise `supervision_level`. Not stored to avoid stale denormalization.

**Relationships:**
- belongs to: `campers`, `users` (reviewed_by), `users` (overridden_by)

---

### message_recipients

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Recipient row identifier |
| `message_id` | bigint | FK to messages, cascade delete | Parent message |
| `user_id` | bigint | FK to users, cascade delete | Recipient user |
| `recipient_type` | enum | not null, default 'to' | `to`, `cc`, `bcc` |
| `is_read` | boolean | not null, default false | Read flag |
| `read_at` | timestamp | nullable | Read timestamp |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:** UNIQUE `(message_id, user_id)`, `(message_id, recipient_type)`, `(user_id, is_read)`

**BCC privacy:** BCC rows exist in this table but the API **must** filter them before returning responses. Only the original message sender may see BCC recipients. Use `Message::getRecipientsForUser(User $viewer)` — never expose this table raw to clients.

**Relationships:**
- belongs to: `messages`, `users`

---

### deadlines

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Deadline identifier |
| `camp_session_id` | bigint | FK to camp_sessions, cascade delete | Owning session |
| `entity_type` | varchar(40) | not null | Polymorphic target type: `document_request`, `application`, `medical_requirement`, `session` |
| `entity_id` | bigint unsigned | nullable | Polymorphic target ID; null = session-wide deadline |
| `title` | varchar(255) | not null | Human-readable label |
| `description` | text | nullable | Additional detail |
| `due_date` | datetime | not null | Deadline date and time |
| `grace_period_days` | tinyint unsigned | not null, default 0 | Days added to `due_date` before enforcement triggers |
| `status` | varchar(20) | not null, default 'pending' | `pending`, `completed`, `overdue`, `extended` |
| `is_enforced` | boolean | not null, default false | Whether enforcement is active |
| `enforcement_mode` | varchar(10) | not null, default 'soft' | `hard` (HTTP 422 block) or `soft` (warning flag) |
| `is_visible_to_applicants` | boolean | not null, default true | Applicant portal visibility |
| `override_note` | text | nullable | Admin note for manual completions or extensions |
| `created_by` | bigint | FK to users | Admin who created the deadline |
| `updated_by` | bigint unsigned | nullable | Admin who last updated |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |
| `deleted_at` | timestamp | nullable | Soft delete timestamp |

**Indexes:** `(entity_type, entity_id)`, `camp_session_id`, `due_date`, `status`, `is_enforced`

**Status sync:** The `SyncDeadlineStatuses` job updates `status` daily. Enforcement logic uses `due_date` arithmetic directly — it is accurate between job runs even if `status` is stale.

**Relationships:**
- belongs to: `camp_sessions`, `users` (created_by)
- has one: `calendar_events` (auto-created via observer)

---

### audit_logs

Immutable HIPAA audit trail. No updates or deletes permitted. Required by HIPAA Security Rule § 164.312(b).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Log entry identifier |
| `request_id` | uuid | not null, indexed | Unique request identifier for correlation |
| `user_id` | bigint | FK to users, null on delete | Acting user (null for system events) |
| `event_type` | varchar(50) | not null | `phi_access`, `admin_action`, `auth_event`, `security_event` |
| `auditable_type` | varchar(255) | nullable | Target model class name |
| `auditable_id` | bigint unsigned | nullable | Target model ID |
| `action` | varchar(100) | not null | Specific action taken |
| `description` | text | nullable | Human-readable description |
| `old_values` | json | nullable | Pre-change state snapshot |
| `new_values` | json | nullable | Post-change state snapshot |
| `metadata` | json | nullable | Additional context (role, portal, etc.) |
| `ip_address` | varchar(45) | nullable | Requester IP address |
| `user_agent` | varchar(255) | nullable | Requester user agent |
| `created_at` | timestamp | not null, indexed | Event timestamp (no `updated_at` — immutable) |

**Indexes:** `request_id`, `(auditable_type, auditable_id)`, `(event_type, created_at)`, `created_at`

**Note:** This table has no `updated_at` column. Records are never modified after insertion. Deletion is prohibited by application policy.

---

## Data Relationships

### One-to-Many

- User → Campers
- User → Notifications
- User → Conversations (created_by)
- User → Messages (sender)
- User → Message Reads
- User → Message Recipients
- User → ApplicationDrafts
- User → DocumentRequests (as applicant or admin)
- User → ApplicantDocuments (as applicant or admin)
- User → UserEmergencyContacts
- User → TreatmentLogs (recorded_by)
- User → MedicalIncidents (recorded_by)
- User → MedicalFollowUps (created_by / assigned_to)
- User → MedicalVisits (recorded_by)
- User → MedicalRestrictions (created_by)
- User → RiskAssessments (reviewed_by / overridden_by)
- Camper → Applications
- Camper → ApplicationDrafts (no direct FK; user_id links them via the applicant)
- Camper → Allergies
- Camper → Medications
- Camper → Diagnoses
- Camper → Emergency Contacts
- Camper → AssistiveDevices
- Camper → ActivityPermissions
- Camper → TreatmentLogs
- Camper → MedicalIncidents
- Camper → MedicalFollowUps
- Camper → MedicalVisits
- Camper → MedicalRestrictions
- Camper → RiskAssessments
- Camper → MedicalProviderLinks
- Camp → CampSessions
- CampSession → Applications
- CampSession → Cabins
- CampSession → Deadlines
- Conversation → Messages
- Conversation → ConversationParticipants
- Message → MessageReads
- Message → MessageRecipients
- Application → ApplicationConsents
- FormDefinition → FormSections
- FormSection → FormFields
- FormField → FormFieldOptions
- RiskFactor → RiskRules

### Many-to-Many

- User ↔ Conversation (through `conversation_participants`)

### One-to-One

- Camper → MedicalRecord
- Camper → BehavioralProfile
- Camper → FeedingPlan
- Camper → PersonalCarePlan

### Polymorphic

- Documents → Documentable (`App\Models\Application`, `App\Models\Camper`, `App\Models\Message`)
- Notifications → Notifiable (any model)

---

## Data Integrity

- Foreign key constraints enforced at the database level on all FKs
- Unique constraints: `users.email`, `(campers.id, camp_sessions.id)`, `(camper_id, activity_name)`, `(application_id, consent_type)`, `(message_id, user_id)`, `(camp_session_id, cabin_name)`, camper one-to-ones (`behavioral_profiles`, `feeding_plans`, `personal_care_plans`)
- Soft deletes (`deleted_at`) on all PII tables: `users`, `campers`, `medical_records`, `emergency_contacts`, `conversations`, `messages`, `documents`, `risk_assessments`
- Hard deletes only on: `application_drafts` (no PHI), `message_reads`, `message_recipients`
- `audit_logs` is append-only — no updates, no deletes, no soft deletes
- Cascading deletes: child records cascade when parents are hard-deleted; soft-delete parents do not cascade
- Encrypted fields use Laravel's `encrypted` cast (AES-256-CBC); these columns must never be loaded in list or index endpoints

---

**Document Status:** Complete and authoritative — all 50 tables documented
**Last Updated:** April 2026
