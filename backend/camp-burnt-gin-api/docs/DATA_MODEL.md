# Data Model

This document describes the database schema, entity relationships, and data model for the Camp Burnt Gin API backend.

---

## Database Tables

The system implements 16 database tables:

| Table | Records | Description |
|-------|---------|-------------|
| `users` | Variable | User accounts and authentication |
| `roles` | 3 | Role definitions (admin, parent, medical) |
| `camps` | Variable | Camp program definitions |
| `camp_sessions` | Variable | Individual camp session schedules |
| `campers` | Variable | Camper profiles linked to parents |
| `applications` | Variable | Camp applications with status tracking |
| `medical_records` | Variable | Medical information for campers |
| `allergies` | Variable | Allergy records with severity |
| `medications` | Variable | Medication records |
| `emergency_contacts` | Variable | Emergency contact information |
| `documents` | Variable | File upload metadata (polymorphic) |
| `medical_provider_links` | Variable | Secure provider access tokens |
| `notifications` | Variable | User notification history |
| `personal_access_tokens` | Variable | Sanctum API tokens |
| `sessions` | Variable | Laravel session storage |
| `password_reset_tokens` | Temporary | Password reset tokens |

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
                └─── 1:N ──► medical_provider_links
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
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |
| `deleted_at` | timestamp | nullable | Soft delete timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`user_id`)
- KEY (`date_of_birth`)
- KEY (`deleted_at`)

**Relationships:**
- belongs to: `users`
- has many: `applications`, `medical_records`, `allergies`, `medications`, `emergency_contacts`, `medical_provider_links`
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
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`camper_id`, `camp_session_id`)
- KEY (`camp_session_id`)
- KEY (`status`)
- KEY (`is_draft`)
- KEY (`reviewed_at`)

**Relationships:**
- belongs to: `campers`, `camp_sessions`, `users` (reviewer)

### medical_records

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Record identifier |
| `camper_id` | bigint | FK to campers, not null, unique | Camper |
| `physician_name` | varchar(255) | nullable | Physician name |
| `physician_phone` | varchar(20) | nullable | Physician phone |
| `insurance_provider` | varchar(255) | nullable | Insurance provider |
| `insurance_policy_number` | varchar(100) | nullable | Policy number |
| `special_needs` | text | nullable | Special needs notes |
| `dietary_restrictions` | text | nullable | Dietary restrictions |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`camper_id`)

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

### Other Tables

Refer to database migrations in `database/migrations/` for complete schema definitions of:
- `camps`, `camp_sessions`, `emergency_contacts`, `documents`, `medical_provider_links`, `notifications`, `roles`

---

## Data Relationships

### One-to-Many

- User → Campers
- User → Notifications
- Camper → Applications
- Camper → Allergies
- Camper → Medications
- Camper → Emergency Contacts
- Camp → Camp Sessions
- Camp Session → Applications

### One-to-One

- Camper → Medical Record (one record per camper)

### Polymorphic

- Documents → Documentable (camper, application, etc.)

---

## Data Integrity

- Foreign key constraints enforced
- Unique constraints on email, camper+session
- Soft deletes on campers (audit trail)
- Cascading deletes where appropriate
- NOT NULL constraints on required fields

---

**Document Status:** Complete and authoritative
**Last Updated:** February 2026
