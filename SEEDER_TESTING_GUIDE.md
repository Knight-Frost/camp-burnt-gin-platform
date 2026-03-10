# Camp Burnt Gin — Seeder and Testing Guide

**Document version:** 1.0  
**Last updated:** 2026-03-10  
**Applies to:** Backend API (Laravel 12, PHP 8.2+, MySQL 8.0)  
**Scope:** Local and staging environments only. Demo data is never seeded in production.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Running the Seeder](#3-running-the-seeder)
4. [Environment Flags](#4-environment-flags)
5. [Seeder Execution Order and Dependency Map](#5-seeder-execution-order-and-dependency-map)
6. [All Seeded Accounts](#6-all-seeded-accounts)
7. [Subsystem Inventory](#7-subsystem-inventory)
8. [Subsystem Relationship Diagram](#8-subsystem-relationship-diagram)
9. [Tester Verification Guide — 17 Scenarios](#9-tester-verification-guide--17-scenarios)
10. [Post-Seed System Verification Checklist](#10-post-seed-system-verification-checklist)
11. [Appendix: Seeder File Reference](#11-appendix-seeder-file-reference)

---

## 1. Overview

Camp Burnt Gin is a HIPAA-compliant camp management platform serving a special-needs residential camp in Orangeburg, South Carolina. The platform manages camper enrollment, medical records, document compliance, internal messaging, audit logging, and administrative workflows.

The seeder stack provides a fully populated, self-consistent dataset for local development and QA testing. It covers all user roles, all application lifecycle states, a range of medical complexity levels, full document request workflows, inbox conversations, notifications, and audit log entries — without requiring any real files on disk or real email delivery.

**All seeded data is synthetic and contains no real personally identifiable information or protected health information.**

### What the seeder creates

| Category | Count |
|---|---|
| Users (all roles) | 15 |
| Campers | 9 |
| Applications | 13+ (all status variants) |
| Medical records | 9 (one per camper) |
| Diagnoses, allergies, medications | Multiple per complex camper |
| Treatment log entries | 12 |
| Medical incidents | 7 |
| Medical visits | 8 |
| Medical follow-ups | 7 |
| Medical restrictions | 9 |
| Provider links | 7 (all lifecycle states) |
| Document requests | 7 (all 7 status states) |
| Conversations | ~18 (including 7 system-generated) |
| Announcements | 5 |
| Calendar events | 14 |
| Audit log entries | ~35 |
| Notifications | ~21 |

---

## 2. Prerequisites

Before running the seeder, confirm the following:

- PHP 8.2+ is installed and on the system path
- Composer dependencies are installed (`composer install`)
- A local MySQL 8.0 database exists and is accessible
- The `.env` file is configured with correct `DB_*` values
- The application is **not** set to `APP_ENV=production`
- Laravel application key is set (`php artisan key:generate` if needed)

To verify environment:

```bash
php artisan env
# Expected: current environment is: local (or testing/staging)
```

---

## 3. Running the Seeder

### Full reset and seed (recommended for clean test runs)

```bash
php artisan migrate:fresh --seed
```

This command drops all tables, runs all migrations in order, then executes the full seeder stack. It is the standard command for resetting a local environment to a known state.

### Seed only (without dropping tables)

```bash
php artisan db:seed
```

All seeders use `firstOrCreate` or manual duplicate-detection guards, so re-running the seeder on an already-populated database is safe. Duplicate records are skipped rather than doubled.

### Expected console output

```
Seeding core demo data stack...
  Extended users seeded (inactive, locked, MFA, additional staff, address data).
  Provider links seeded (7 links across all lifecycle states).
  Document requests seeded (7 lifecycle states, system inbox conversations created).
  Extended messages seeded (medical threads, archived, long thread, unanswered, internal).

Database seeding completed successfully.

SECURITY WARNING: Change the super admin password immediately!
  Email: admin@campburntgin.org
  Default password: ChangeThisPassword123!
```

### Post-seed security note

The super admin account bootstrapped by `DatabaseSeeder` uses the password `ChangeThisPassword123!`. This is intentional for production bootstrap purposes. **This password must be changed immediately in any non-local environment.** All other demo accounts use the uniform password `password`, which must never appear in production.

---

## 4. Environment Flags

Seeder behavior is controlled by flags in `config/seeding.php`, which reads from `.env`. All flags default to `true` in non-production environments.

| Flag | .env variable | Default | Effect |
|---|---|---|---|
| Master switch | `ENABLE_DEMO_DATA` | `true` | If false, all demo data is skipped; only roles, system config, and super admin are created |
| Medical data | `ENABLE_MEDICAL_SEEDS` | `true` | If false, skips all diagnoses, allergies, medications, incidents, visits, follow-ups, restrictions, and treatment logs |
| Document metadata | `ENABLE_DOCUMENT_SEEDS` | `true` | If false, skips document metadata records |
| Notifications | `ENABLE_NOTIFICATION_SEEDS` | `true` | If false, skips database notification records |
| Extended scenarios | `ENABLE_EXTENDED_SEEDS` | `true` | If false, skips the entire extended stack (inactive/locked users, MFA accounts, waitlisted apps, provider links, behavioral profiles, extended messages, audit logs, document requests, message reads, medical cross-links) |

To run a minimal core-only seed (faster, smaller dataset):

```bash
ENABLE_EXTENDED_SEEDS=false php artisan migrate:fresh --seed
```

To run with no demo data at all (production-equivalent):

```bash
ENABLE_DEMO_DATA=false php artisan migrate:fresh --seed
```

**Important:** Setting `ENABLE_DEMO_DATA=false` also suppresses medical, document, notification, and extended seeds regardless of their individual flags. The master switch takes precedence.

In a true `APP_ENV=production` environment, all demo data is blocked unconditionally at the `DatabaseSeeder` level, regardless of any flag values. The seeder will print `Production environment — demo data skipped.` and exit after creating the super admin account.

---

## 5. Seeder Execution Order and Dependency Map

The seeder stack is divided into three groups: always-run system data, core demo data, and the extended scenario stack.

### Group 1 — Always run (all environments including production)

| Order | Seeder | Purpose |
|---|---|---|
| 1 | `RoleSeeder` | Creates the four roles: super_admin, admin, medical, applicant. All user creation depends on this. |
| 2 | `RequiredDocumentRuleSeeder` | Creates the 14 required document rules used by the document compliance system. |
| 3 | `ActivityPermissionSeeder` | Creates default activity permission templates. |
| 4 | Super admin bootstrap (inline) | Creates `admin@campburntgin.org` with `firstOrCreate` — safe for production. |

### Group 2 — Core demo stack (non-production only)

| Order | Seeder | Dependencies |
|---|---|---|
| 5 | `UserSeeder` | RoleSeeder |
| 6 | `ApplicantSeeder` | RoleSeeder |
| 7 | `CampSeeder` | None |
| 8 | `ApplicationSeeder` | ApplicantSeeder, CampSeeder |
| 9 | `MedicalSeeder` | ApplicantSeeder |
| 10 | `MedicalPhase11Seeder` | MedicalSeeder |
| 11 | `TreatmentLogSeeder` | MedicalPhase11Seeder (for visit ID linking) |
| 12 | `DocumentSeeder` | ApplicationSeeder |
| 13 | `MessageSeeder` | UserSeeder, ApplicantSeeder, ApplicationSeeder |
| 14 | `AnnouncementSeeder` | UserSeeder |
| 15 | `NotificationSeeder` | UserSeeder, ApplicantSeeder |

### Group 3 — Extended scenario stack (non-production, requires Group 2)

| Order | Seeder | Purpose |
|---|---|---|
| 16 | `ExtendedUserSeeder` | Inactive, locked, MFA users; address data on core applicants; user emergency contacts |
| 17 | `WaitlistedApplicationSeeder` | Waitlisted, draft, paper-entered, and returning-applicant applications; creates Henry Carter family |
| 18 | `ExtendedEmergencyContactSeeder` | Secondary and non-pickup emergency contacts |
| 19 | `ProviderLinkSeeder` | Medical provider link workflow in all 5 lifecycle states |
| 20 | `CamperProfileSeeder` | Behavioral profiles, assistive devices, and feeding plans for all campers |
| 21 | `ExtendedMedicalRecordSeeder` | Fills `has_seizures` fields; adds realistic restricted/denied activity permission overrides |
| 22 | `ExtendedMessageSeeder` | Medical staff threads, archived conversation, long thread, unanswered thread, internal coordination thread, Medical2 thread |
| 23 | `ExtendedAuditLogSeeder` | ~35 comprehensive audit log entries across all event categories, spanning 45 days |
| 24 | `ExtendedNotificationSeeder` | Admin, medical, and additional applicant database notifications |
| 25 | `ApplicantDocumentSeeder` | Admin-to-applicant document records in 3 states: pending, submitted, reviewed |
| 26 | `DocumentRequestSeeder` | Full document request lifecycle (7 states); system-generated inbox conversations per request |
| 27 | `MessageReadSeeder` | Read receipts for all conversations; older messages marked read; most-recent messages left unread; Patricia/Mia unanswered thread preserved fully unread |
| 28 | `MedicalCrossLinkSeeder` | Back-fills incident and follow-up `treatment_log_id` cross-links; adds activity restrictions for Ava and Mia; adds behavioral profiles for Ava and Mia |

### Dependency summary

The strict execution order enforces the following dependency chain:

```
RoleSeeder
  → UserSeeder + ApplicantSeeder
      → CampSeeder → ApplicationSeeder
          → MedicalSeeder → MedicalPhase11Seeder → TreatmentLogSeeder
          → DocumentSeeder
          → MessageSeeder
      → AnnouncementSeeder
      → NotificationSeeder
          → ExtendedUserSeeder
              → WaitlistedApplicationSeeder (creates Henry Carter camper/family)
              → ExtendedEmergencyContactSeeder
              → ProviderLinkSeeder
              → CamperProfileSeeder
              → ExtendedMedicalRecordSeeder
              → ExtendedMessageSeeder
              → ExtendedAuditLogSeeder
              → ExtendedNotificationSeeder
              → ApplicantDocumentSeeder
              → DocumentRequestSeeder
                  → MessageReadSeeder
                  → MedicalCrossLinkSeeder
```

---

## 6. All Seeded Accounts

### Universal password

All demo accounts use the password: **`password`**

The super admin bootstrap account uses: **`ChangeThisPassword123!`**

### Staff and admin accounts

| Email | Role | Display Name | Notes |
|---|---|---|---|
| `admin@campburntgin.org` | super_admin | Super Administrator (Jordan Taylor) | Primary super admin; bootstrap account; password is `ChangeThisPassword123!` |
| `admin2@campburntgin.org` | super_admin | Deputy Administrator | Secondary super admin; used for role-management UI testing (last-super-admin guard) |
| `admin@example.com` | admin | Alex Rivera | Primary admin for most seeded actions |
| `admin3@campburntgin.org` | admin | Taylor Brooks | Has address data; Orangeburg, SC |
| `inactive@example.com` | admin | Chris Dale | `is_active = false` — login must be denied |
| `mfa.admin@campburntgin.org` | admin | Morgan Ellis | `mfa_enabled = true` with TOTP secret (Base32 placeholder); MFA gate UI testing only |
| `medical@example.com` | medical | Dr. Morgan Chen | Primary medical staff; records most treatment logs, incidents, visits, follow-ups |
| `medical2@campburntgin.org` | medical | Nurse Jamie Santos | Secondary medical staff; involved in Sofia's catheterization scheduling thread |

### Applicant accounts

| Email | Role | Name | Campers | Application States |
|---|---|---|---|---|
| `sarah.johnson@example.com` | applicant | Sarah Johnson | Ethan (13), Lily (10) | Ethan: approved (S1-2026); Lily: pending (S2-2026) |
| `david.martinez@example.com` | applicant | David Martinez | Sofia (14) | Sofia: under_review |
| `jennifer.thompson@example.com` | applicant | Jennifer Thompson | Noah (12) | Noah: rejected (S1-2026), pending (S2-2026) |
| `michael.williams@example.com` | applicant | Michael Williams | Ava (15), Lucas (16) | Ava: approved (S2-2026); Lucas: pending (S1-2026) |
| `patricia.davis@example.com` | applicant | Patricia Davis | Mia (11) | Mia: approved (S1-2025/past), draft (S1-2026) |
| `grace.wilson@example.com` | applicant | Grace Wilson | Tyler (14) | Tyler: waitlisted |
| `james.carter@example.com` | applicant | James Carter | Henry | Henry: paper application (entered by admin) |
| `locked.applicant@example.com` | applicant | Chris Locke | None | `lockout_until` in future; 5 failed login attempts recorded |

### Edge-state account behavior

| Account | Expected login behavior |
|---|---|
| `inactive@example.com` | Denied. Returns account-inactive error. No token issued. |
| `locked.applicant@example.com` | Denied. Returns lockout error with remaining time. No token issued. |
| `mfa.admin@campburntgin.org` | Password accepted; TOTP code required. Placeholder secret `JBSWY3DPEHPK3PXP` does not produce a valid TOTP in real authenticator apps — intended for UI-gate testing only, not end-to-end TOTP verification. |

---

## 7. Subsystem Inventory

### 7.1 Identity and Access Management

**Tables:** `users`, `roles`, `personal_access_tokens`, `password_reset_tokens`, `sessions`, `user_emergency_contacts`

**Seeded data:**
- 4 roles: `super_admin`, `admin`, `medical`, `applicant`
- 15 users covering all roles and special states
- User-level emergency contacts for 4 applicant accounts (Sarah Johnson has two: spouse and mother)
- Address and phone data on all 6 core applicant accounts and James Carter

**Test states:**
- Normal active login
- `is_active = false` login rejection
- Account lockout (`failed_login_attempts = 5`, `lockout_until` in future)
- MFA gate (`mfa_enabled = true`)
- Last-super-admin guard (two super_admin accounts seeded to test the "cannot delete last super_admin" rule)

### 7.2 Camp and Session Management

**Tables:** `camps`, `camp_sessions`

**Seeded data:**
- 1 camp: Camp Burnt Gin (Orangeburg, SC; capacity 60; age range 6–17)
- 3 sessions:
  - Session 1 — Summer 2025 (inactive/past; used for Mia's historical approval)
  - Session 1 — Summer 2026 (active; June 8–12)
  - Session 2 — Summer 2026 (active; June 22–26)

### 7.3 Camper and Application System

**Tables:** `campers`, `applications`

**Campers (9 total):**

| Camper | Age | Parent | Medical Complexity |
|---|---|---|---|
| Ethan Johnson | 13 | Sarah Johnson | High (ASD, Epilepsy) |
| Lily Johnson | 10 | Sarah Johnson | Low (Asthma) |
| Sofia Martinez | 14 | David Martinez | High (CP, Spina Bifida) |
| Noah Thompson | 12 | Jennifer Thompson | High (Down Syndrome) |
| Ava Williams | 15 | Michael Williams | Moderate (Type 1 Diabetes) |
| Lucas Williams | 16 | Michael Williams | High (Duchenne MD) |
| Mia Davis | 11 | Patricia Davis | Moderate (Sickle Cell Disease) |
| Tyler Wilson | 14 | Grace Wilson | Low |
| Henry Carter | — | James Carter | Minimal |

**Application status coverage:**

| Status | Camper / Session |
|---|---|
| approved | Ethan (S1-2026), Ava (S2-2026), Mia (S1-2025 past), Henry (S1-2026) |
| pending | Lily (S2-2026), Noah (S2-2026), Lucas (S1-2026), Henry (S2-2026) |
| under_review | Sofia |
| rejected | Noah (S1-2026) |
| waitlisted | Tyler |
| cancelled / draft | Lucas (S2-2026) |

### 7.4 Medical Portal

**Tables:** `medical_records`, `emergency_contacts`, `allergies`, `medications`, `diagnoses`, `behavioral_profiles`, `feeding_plans`, `assistive_devices`, `activity_permissions`, `treatment_logs`, `medical_incidents`, `medical_follow_ups`, `medical_visits`, `medical_restrictions`, `medical_provider_links`

**Camper medical complexity:**

| Camper | Diagnoses | Key Medical Needs |
|---|---|---|
| Tyler | None | Baseline, healthy |
| Lily | Asthma | Seasonal allergies, rescue inhaler (ProAir HFA), seasonal restriction (expired) |
| Henry | Minimal | No significant medical history |
| Ava | Type 1 Diabetes | Dexcom G7 CGM, OmniPod insulin pump, hypoglycemia management protocol |
| Mia | Sickle Cell Disease | Heat restriction (85°F / 30-min outdoor limit), SCD crisis monitoring |
| Ethan | ASD, Epilepsy | Seizure action plan, Levetiracetam (Keppra) + Melatonin, behavioral profile, IEP |
| Noah | Down Syndrome | Hearing impairment, severe latex allergy (anaphylaxis risk, EpiPen), cardiac clearance |
| Sofia | Cerebral Palsy (GMFCS III), Spina Bifida | Power wheelchair, BiPAP ventilator, intermittent catheterization (schedule: every 4h), adaptive aquatics |
| Lucas | Duchenne Muscular Dystrophy (Stage 4) | Power wheelchair, ResMed AirCurve 10 VAuto BiPAP, cardiac and respiratory precautions |

**Treatment logs (12 entries):**

| Date | Camper | Type | Summary |
|---|---|---|---|
| 2026-03-01 | Lily | medication_administered | Albuterol rescue inhaler — high-pollen trail walk |
| 2026-03-02 | Mia | observation | Heat protocol activation — ambient temp 89°F |
| 2026-03-03 | Tyler | observation | Headache — suspected dehydration |
| 2026-03-03 | Noah | first_aid | Knee abrasion — latex-free wound care |
| 2026-03-04 | Noah | first_aid | Dressing change — right knee (day 2) |
| 2026-03-04 | Ava | medication_administered | Glucose tablets — hypoglycemia BG 52 mg/dL |
| 2026-03-05 | Ethan | medication_administered | Scheduled evening medications (Levetiracetam + Melatonin) |
| 2026-03-05 | Sofia | other | Scheduled intermittent catheterization (4 PM) |
| 2026-03-05 | Tyler | first_aid | Paper cut — arts and crafts |
| 2026-03-06 | Lucas | emergency | Respiratory distress — O2 sat drop to 94% post-BiPAP |
| 2026-03-06 | Ethan | medication_administered | Scheduled morning medication (Levetiracetam) |
| 2026-03-07 | Ava | observation | Routine morning BG check — post-hypoglycemia protocol |

**Incidents (7 entries):**

| Date | Camper | Type | Severity | Escalation |
|---|---|---|---|---|
| 2026-03-01 | Lily | environmental | minor | No |
| 2026-03-02 | Mia | environmental | moderate | No |
| 2026-03-03 | Noah | injury | minor | No |
| 2026-03-04 | Ava | medical | moderate | Yes (parent notified) |
| 2026-03-05 | Ethan | behavioral | minor | No |
| 2026-03-05 | Tyler | injury | minor | No |
| 2026-03-06 | Lucas | medical | moderate | Yes (physician contacted) |

**Follow-ups (7 entries — calibrated to today for dashboard widget accuracy):**

| Status | Camper | Priority | Due Date | Notes |
|---|---|---|---|---|
| pending (overdue) | Ava | urgent | 2026-03-05 | Contact endocrinologist re: second hypoglycemia event |
| in_progress (overdue) | Lucas | high | 2026-03-06 | Notify cardiologist of respiratory event |
| pending (due today) | Mia | high | 2026-03-07 | Brief outdoor staff on heat restriction protocol |
| pending (upcoming) | Ethan | medium | 2026-03-09 | Update visual schedule for activity transitions |
| pending (upcoming) | Noah | low | 2026-03-09 | Wound recheck — right knee |
| in_progress | Sofia | medium | 2026-03-10 | Confirm adaptive aquatics staff trained on pool transfer |
| completed | Lily | low | 2026-03-02 | Parents notified of 03/01 albuterol rescue use (completed 03/01) |

**Provider links (7 entries):**

| Camper | Provider | State |
|---|---|---|
| Sofia | Dr. James Owens | active — not yet accessed (sent 2 days ago) |
| Tyler | Dr. Anne Bradley | active — accessed 3h ago, not submitted |
| Noah | Dr. Rachel Kim | submitted (form completed) |
| Lucas | Dr. Maria Gonzalez | expired — never submitted (no response in 72h) |
| Mia | Dr. Kevin Patel | revoked by admin |
| Lily | Dr. Sandra Hill | active — sent today |
| Ethan | Dr. Sandra Hill | expired (historical — second link was sent by phone) |

**Note:** Provider link tokens are hashed (bcrypt). Plain tokens are not stored. To generate a real testable link in local dev, use the admin "Resend" flow in the UI.

### 7.5 Document Management

**Tables:** `documents`, `required_document_rules`, `applicant_documents`, `document_requests`

**Required document rules:** 14 rules covering universal requirements, condition-flag triggers, complexity-tier triggers, and supervision-level triggers.

**Document metadata records:** Polymorphic records attached to Applications and Campers. Mix of approved and pending statuses. No actual files exist on disk; file path fields contain plausible paths for display testing.

**Applicant documents:** 5 records across 3 states:
- `pending` — awaiting applicant action
- `submitted` — applicant has uploaded
- `reviewed` — admin has reviewed

**Document requests (7 entries, one per status value):**

| Status | Camper | Document Type | Applicant |
|---|---|---|---|
| awaiting_upload | Ethan | Updated IEP / Special Education Plan | Sarah Johnson |
| uploaded | Sofia | Physician's Letter — Catheterization Protocol | David Martinez |
| scanning | Tyler | Proof of Identity | Grace Wilson |
| under_review | Noah | Audiologist Report | Jennifer Thompson |
| approved | Lucas | BiPAP/Ventilator Operation Certification | Michael Williams |
| rejected | Lily | Seasonal Allergy Action Plan (illegible scan) | Sarah Johnson |
| overdue | Ava | CGM Calibration Log (due date passed) | Michael Williams |

Each document request has a corresponding system-generated inbox conversation (`is_system_generated = true`) with:
- Message 1: automated system notification (no sender)
- Message 2: human admin follow-up message

### 7.6 Inbox and Messaging

**Tables:** `conversations`, `conversation_participants`, `messages`, `message_reads`

**Conversations seeded by MessageSeeder (5 core threads):**

| Subject | Participants | Category |
|---|---|---|
| Ethan Johnson — Session 1 Application Question | Sarah ↔ Admin | application |
| Sofia Martinez — Missing Documents | Admin ↔ David | application |
| Noah Thompson — Session 2 Application | Jennifer ↔ Admin | general |
| Latex Allergy Protocol — Noah Thompson | Jennifer ↔ Admin | medical |
| Packing List and Drop-Off Instructions | Sarah ↔ Admin | general |

**Conversations seeded by ExtendedMessageSeeder (6 additional threads):**

| Subject | Participants | State |
|---|---|---|
| Lucas Williams — Respiratory Event Follow-Up (Internal) | Dr. Chen ↔ Admin | active, medical category |
| Pre-Camp 2025 — Packing List and Drop-Off | Sarah ↔ Admin | archived; Sarah has `is_starred = true` |
| Ava Williams — Insulin Pump and CGM Protocol Questions | Michael ↔ Admin + Dr. Chen | active, 11-message long thread |
| Mia Davis — Heat Protocol Questions | Patricia → Admin | unanswered; no admin reply; fully unread for admin |
| Staff Orientation Logistics — March 14 Attendance Confirmation | Admin ↔ Dr. Chen | active, internal coordination |
| Sofia Martinez — Catheterization Schedule Coordination | Nurse Jamie ↔ Dr. Chen | active, medical, Medical2 thread |

**System-generated conversations (7, from DocumentRequestSeeder):** One per document request. Each is `is_system_generated = true`, category `system`, linked to its `DocumentRequest` record via `related_entity_id`.

**Message read state (set by MessageReadSeeder):**
- Older messages in completed/archived threads: marked read for all participants
- Most-recent message in active threads: left unread to produce unread badge
- Patricia Davis / Mia Heat Protocol thread: left fully unread for admin (tests "unanswered" badge state)
- System-generated document request threads: marked fully read for the applicant participant

### 7.7 Audit Log

**Tables:** `audit_logs`

**Records:** Approximately 35 entries spanning 45 days.

**Event type coverage:**

| Event type | Examples |
|---|---|
| authentication | User login, failed login attempt, logout |
| admin_action | Application approved/rejected, announcement published, role updated, document request created |
| phi_access | Medical record viewed, camper record accessed |
| document | Document uploaded, document approved/rejected |
| medical | Treatment log created, incident recorded |
| system | Seeder-generated system events |

### 7.8 Announcements and Calendar

**Tables:** `announcements`, `calendar_events`

**Announcements (5):**

| Title | Pinned | Urgent | Audience |
|---|---|---|---|
| Registration Now Open — Session 1 and Session 2, Summer 2026 | Yes | No | all |
| URGENT: Medication Form Update Required Before April 1 | Yes | Yes | parent |
| Pre-Camp Medical Review — Scheduling Now Open | No | No | parent |
| Staff Orientation — March 14–15, 2026 | No | No | admin |
| Welcome to the Camp Burnt Gin Applicant Portal | No | No | parent |

**Calendar events (14):**
- 2 session deadlines (all audiences)
- 1 medication form deadline (parent)
- 2 session dates — Summer 2026 (all)
- 2 staff orientation days (admin)
- 1 family pre-camp info night (parent)
- 3 internal review events (admin)
- 3 medical staff-targeted events (medical): staff briefing, medication dispensing schedule, end-of-session record review

### 7.9 Notifications

**Tables:** `notifications` (Laravel polymorphic, UUID primary key)

**Records:** Approximately 21 total across admin, medical, and applicant recipients.

**Mix of states:**
- Unread notifications (for unread badge testing)
- Read notifications (for mark-as-read testing)
- Multiple notification types: application status, new message, document request, medical alert

---

## 8. Subsystem Relationship Diagram

```
User (applicant)
  └── Camper
        ├── Application ──────────── CampSession ──── Camp
        │     └── Document (morph)
        ├── MedicalRecord
        │     ├── Allergy
        │     ├── Medication
        │     └── Diagnosis
        ├── EmergencyContact
        ├── BehavioralProfile
        ├── FeedingPlan
        ├── AssistiveDevice
        ├── ActivityPermission
        ├── TreatmentLog ─────────── MedicalVisit
        ├── MedicalIncident ─────── (treatment_log_id cross-link)
        ├── MedicalFollowUp ─────── (treatment_log_id cross-link)
        ├── MedicalRestriction
        └── MedicalProviderLink

User (admin / medical)
  ├── Conversation ─── Message ─── MessageRead
  │     └── ConversationParticipant (User)
  ├── DocumentRequest ──────────── Conversation (system-generated)
  ├── ApplicantDocument
  └── AuditLog

System
  ├── Announcement
  ├── CalendarEvent
  ├── Notification
  └── RequiredDocumentRule
```

---

## 9. Tester Verification Guide — 17 Scenarios

This section provides step-by-step instructions for each verification scenario. Complete all scenarios in a fresh seeded environment. Scenarios are grouped by subsystem.

---

### Authentication

---

#### Scenario 1: Standard Login

**Role:** admin  
**Credentials:** `admin@example.com` / `password`

**Steps:**
1. Open the frontend application at its local URL.
2. Navigate to the login page.
3. Enter email `admin@example.com` and password `password`.
4. Click the login button.

**Expected result:** Authentication succeeds. The user is redirected to the admin dashboard. The top navigation displays the admin user's name (Alex Rivera). No error messages appear.

**Success criteria:**
- HTTP 200 response from the `/api/auth/login` endpoint
- Sanctum token is issued and stored in `sessionStorage` under key `auth_token`
- Admin dashboard is displayed with navigation items: Dashboard, Applications, Campers, Medical, Documents, Inbox, Announcements, Audit Log, Settings

---

#### Scenario 2: Inactive Account Login Attempt

**Role:** admin (deactivated)  
**Credentials:** `inactive@example.com` / `password`

**Steps:**
1. Navigate to the login page.
2. Enter email `inactive@example.com` and password `password`.
3. Click the login button.

**Expected result:** Login is denied. An error message is displayed indicating the account is inactive or has been disabled. No token is issued. The user remains on the login page.

**Success criteria:**
- HTTP 403 (or equivalent auth error) from `/api/auth/login`
- No Sanctum token is written to `sessionStorage`
- Error message is visible to the user (exact text may vary by implementation)
- User cannot proceed past the login page with these credentials

---

#### Scenario 3: Locked Account Login Attempt

**Role:** applicant (locked)  
**Credentials:** `locked.applicant@example.com` / `password`

**Steps:**
1. Navigate to the login page.
2. Enter email `locked.applicant@example.com` and password `password`.
3. Click the login button.

**Expected result:** Login is denied. An error message indicates the account is locked or too many failed login attempts have occurred. The response may include a lockout expiry time. No token is issued.

**Success criteria:**
- HTTP 423 or 403 (or equivalent lockout error) from `/api/auth/login`
- No Sanctum token is written to `sessionStorage`
- Lockout message is visible; the user is not authenticated
- Database record for this user has `failed_login_attempts = 5` and a `lockout_until` timestamp in the near future

---

### Application Workflow

---

#### Scenario 4: Applicant Views an Approved Application

**Role:** applicant  
**Credentials:** `sarah.johnson@example.com` / `password`

**Steps:**
1. Log in as Sarah Johnson.
2. Navigate to the Applications section of the applicant portal (typically `/applicant/applications`).
3. Locate Ethan Johnson's application for Session 1 — Summer 2026.
4. Click to view the application details.

**Expected result:** The application detail page displays Ethan's application with status `approved`. Session details (Session 1, Summer 2026, June 8–12) are shown. The application includes camper details and any associated documents.

**Success criteria:**
- Application status badge shows `Approved`
- Camper name is Ethan Johnson
- Session is Session 1 — Summer 2026
- No editing controls are present (approved applications are read-only for applicants)
- Page loads without error

---

#### Scenario 5: Admin Reviews a Pending Application

**Role:** admin  
**Credentials:** `admin@example.com` / `password`

**Steps:**
1. Log in as Alex Rivera (admin).
2. Navigate to the Applications section of the admin panel.
3. Filter by status `pending` or locate Lily Johnson's application in the list.
4. Click to open Lily's application.
5. Review the application details including camper information, medical notes, and any attached documents.

**Expected result:** The admin application detail view displays all sections of Lily's application. Medical information, emergency contacts, and documents are accessible. Admin action controls (Approve, Reject, Request Documents) are present.

**Success criteria:**
- Application status is `pending`
- Camper is Lily Johnson (age 10)
- Medical section reflects asthma diagnosis and seasonal allergies
- Admin action buttons are rendered and functional
- No 403 or 404 errors

---

#### Scenario 6: Admin Approves an Under-Review Application

**Role:** admin  
**Credentials:** `admin@example.com` / `password`

**Steps:**
1. Log in as Alex Rivera (admin).
2. Navigate to Applications and locate Sofia Martinez's application (status: `under_review`).
3. Open the application detail view.
4. Review the medical complexity details (Cerebral Palsy GMFCS III, Spina Bifida, catheterization protocol, BiPAP).
5. Click the Approve button.
6. Confirm the approval action in any confirmation dialog.

**Expected result:** Sofia's application status changes from `under_review` to `approved`. A success notification or status update is displayed. An audit log entry is created for `application.approved`. If the system sends notifications, an automated notification is created for David Martinez.

**Success criteria:**
- Application status in the database changes to `approved`
- The UI reflects the new status immediately or after a data refetch
- Audit log contains a new `application.approved` entry attributed to `admin@example.com`
- No 422 or 500 errors

---

### Medical Portal

---

#### Scenario 7: Medical Staff Views a High-Complexity Camper Record

**Role:** medical  
**Credentials:** `medical@example.com` / `password`

**Steps:**
1. Log in as Dr. Morgan Chen.
2. Navigate to the Medical portal.
3. Open the Camper Directory or search for Ethan Johnson.
4. Open Ethan's medical record.
5. Review each section: diagnoses, allergies, medications, behavioral profile, assistive devices, emergency contacts, activity permissions, treatment logs, incidents, restrictions.

**Expected result:** Ethan's full medical record is accessible. The diagnoses section shows ASD and Epilepsy. Medications include Levetiracetam (Keppra) and Melatonin. The behavioral profile is populated. Activity permissions reflect the seizure-related swimming restriction. Treatment logs show the March 5 and March 6 Levetiracetam administrations. Incidents include the March 5 behavioral escalation.

**Success criteria:**
- All sections of the medical record render without error
- PHI fields (encrypted in the database) display correctly — AES-256 decryption is transparent to the UI
- At least 2 diagnoses visible (ASD, Epilepsy)
- At least 2 medications visible (Levetiracetam, Melatonin)
- Behavioral profile is present and populated
- Swimming restriction is shown as active
- Treatment log count is at least 2 entries for Ethan

---

#### Scenario 8: Medical Staff Records a New Treatment Log

**Role:** medical  
**Credentials:** `medical@example.com` / `password`

**Steps:**
1. Log in as Dr. Morgan Chen.
2. Navigate to Medical and open the Camper Directory.
3. Open Mia Davis's medical record.
4. Navigate to the Treatment Logs section.
5. Click to add a new treatment log entry.
6. Select type `observation`.
7. Enter a title, description, treatment date (today), and treatment time.
8. Mark `follow_up_required` as false.
9. Submit the form.

**Expected result:** The new treatment log entry is saved and appears in Mia's treatment log list. The entry reflects the type, title, date, and time entered. The recording staff member is Dr. Morgan Chen.

**Success criteria:**
- New `TreatmentLog` record exists in the database with `camper_id` for Mia and `recorded_by` for Dr. Chen
- Entry appears in the treatment log list on the UI
- No validation errors
- The entry is of type `observation` with the data entered

---

#### Scenario 9: Medical Staff Views Overdue Follow-Ups

**Role:** medical  
**Credentials:** `medical@example.com` / `password`

**Steps:**
1. Log in as Dr. Morgan Chen.
2. Navigate to the Medical portal.
3. Open the Follow-Ups section (sidebar: Follow-Ups / ClipboardCheck icon).
4. Review the follow-up list. Observe the status distribution.

**Expected result:** The follow-up list displays 7 entries. Two entries are visually flagged as overdue:
- Ava: "Contact endocrinologist re: basal rate adjustment" (due 2026-03-05, urgent)
- Lucas: "Notify cardiologist of 03/06 respiratory event" (due 2026-03-06, high, in-progress)

One entry is due today:
- Mia: "Brief all outdoor activity staff on Mia heat restriction protocol" (due 2026-03-07, high)

One entry is completed:
- Lily: "Notify Lily's parents of 03/01 albuterol rescue use" (completed 2026-03-01)

**Success criteria:**
- Overdue items are distinctly visually indicated (color, badge, or label)
- Due-today item is correctly identified
- Completed item shows completion timestamp and completed-by staff member
- Overdue count in any dashboard widget matches 2

---

### Document Management

---

#### Scenario 10: Admin Views the Document Requests Dashboard

**Role:** admin  
**Credentials:** `admin@example.com` / `password`

**Steps:**
1. Log in as Alex Rivera (admin).
2. Navigate to the Documents section of the admin panel.
3. Open the Document Requests view or the AdminDocumentsPage.
4. Review the dashboard metrics and the request table.

**Expected result:** The dashboard shows 7 document requests visible in the table, each with a distinct status. The 7-metric dashboard widgets display counts for each status. All 7 status values are represented: `awaiting_upload` (Ethan/IEP), `uploaded` (Sofia/Catheterization Protocol), `scanning` (Tyler/Proof of Identity), `under_review` (Noah/Audiologist Report), `approved` (Lucas/BiPAP Certification), `rejected` (Lily/Allergy Action Plan), `overdue` (Ava/CGM Calibration Log).

**Success criteria:**
- All 7 document requests are visible in the table
- Each row shows the correct camper name, document type, status, and due date
- Status filter controls are present and functional
- Dashboard metric widgets show correct counts (at minimum: approved=1, rejected=1, overdue=1)
- Download controls are present for uploaded/approved/under_review records

---

#### Scenario 11: Applicant Uploads a Requested Document

**Role:** applicant  
**Credentials:** `sarah.johnson@example.com` / `password`

**Steps:**
1. Log in as Sarah Johnson.
2. Navigate to the Documents section of the applicant portal.
3. Locate the "Requested Documents" section.
4. Find the request for Ethan: "Updated IEP / Special Education Plan" (status: `awaiting_upload`).
5. Click the Upload button for this request.
6. Select a PDF or image file from the local filesystem.
7. Submit the upload.

**Expected result:** The upload is accepted. The document request status changes from `awaiting_upload` to `uploaded`. The due date and instructions remain visible. A success confirmation is displayed. The request is no longer actionable for upload until it is rejected (at which point `canUpload()` returns true again).

**Success criteria:**
- `DocumentRequest` record status changes to `uploaded` in the database
- `uploaded_at`, `uploaded_document_path`, `uploaded_file_name`, and `uploaded_mime_type` are populated
- UI reflects the status change
- No 422 or 500 errors
- The system inbox thread for this request receives a status update message (if the notification integration is active)

---

#### Scenario 12: Admin Approves an Uploaded Document Request

**Role:** admin  
**Credentials:** `admin@example.com` / `password`

**Steps:**
1. Log in as Alex Rivera (admin).
2. Navigate to the Document Requests list.
3. Locate Sofia Martinez's "Physician's Letter — Catheterization Protocol" (status: `uploaded`).
4. Click the Approve button in the row actions.
5. Confirm the approval.

**Expected result:** The document request status changes from `uploaded` to `approved`. The `reviewed_by_admin_id` is set to Alex Rivera's user ID. The `reviewed_at` timestamp is set to the current time. The row in the table reflects the updated status. An audit log entry for `document_request.approved` is created.

**Success criteria:**
- `DocumentRequest` status is `approved` in the database
- `reviewed_by_admin_id` is populated
- `reviewed_at` is a current timestamp
- Audit log contains a new entry with `event_type = admin_action` for this document request
- No errors; UI updates correctly

---

### Inbox

---

#### Scenario 13: Applicant Views Inbox Including System Notification Threads

**Role:** applicant  
**Credentials:** `sarah.johnson@example.com` / `password`

**Steps:**
1. Log in as Sarah Johnson.
2. Navigate to the Inbox section.
3. Review the conversation list.
4. Identify the system-generated threads (labeled with "Document Request:" prefix in the subject).
5. Open the thread for Ethan's IEP request: "Document Request: Updated IEP / Special Education Plan".
6. Read both messages in the thread (system notification body + admin follow-up).

**Expected result:** Sarah's inbox contains at least 2 document-request system threads (Ethan's IEP and Lily's Allergy Action Plan, both associated with Sarah's account). Each thread has 2 messages. The first message has no sender name (system-generated). The second message is from the admin. Thread subjects are prefixed with "Document Request:". Threads may be displayed in a separate "System Notifications" section or with a visual indicator for `is_system_generated = true`.

**Success criteria:**
- System-generated conversations are visible in the inbox
- `is_system_generated = true` conversations are appropriately labeled or grouped
- Thread for Ethan's IEP shows the automated message body and the admin follow-up
- Messages are ordered chronologically (system message first)
- No 403 or 404 errors

---

#### Scenario 14: Admin Views Unanswered Message Thread

**Role:** admin  
**Credentials:** `admin@example.com` / `password`

**Steps:**
1. Log in as Alex Rivera (admin).
2. Navigate to the Inbox.
3. Locate the conversation "Mia Davis — Heat Protocol Questions" from Patricia Davis.
4. Open the conversation.
5. Observe that only one message exists (Patricia's initial message) and no admin reply has been sent.

**Expected result:** The conversation appears in the admin inbox with an unread indicator (badge or bold styling). Opening the conversation shows exactly one message from Patricia Davis describing her concern about Mia's heat restriction protocol and referencing a prior heat crisis incident. There is no reply from any admin user. The conversation is not archived.

**Success criteria:**
- Conversation appears with an unread indicator for the admin
- Message count is 1 (Patricia's message only)
- Sender is `patricia.davis@example.com`
- Message body contains reference to Mia's heat restriction and concern about staff briefing
- No admin reply message exists in the thread
- `MessageRead` table has no read receipt for this message from the admin user

---

#### Scenario 15: Admin Sends a New Message to an Applicant

**Role:** admin  
**Credentials:** `admin@example.com` / `password`

**Steps:**
1. Log in as Alex Rivera (admin).
2. Navigate to the Inbox.
3. Click Compose or New Message.
4. Select Jennifer Thompson (`jennifer.thompson@example.com`) as the recipient.
5. Enter a subject (for example: "Noah Thompson — Session 2 Update").
6. Enter a message body (for example: "Hi Jennifer, I wanted to let you know that Noah's Session 2 application is progressing well. We expect to have a review decision by next week.").
7. Send the message.

**Expected result:** A new conversation is created with Jennifer Thompson as a participant and the admin as creator. The message appears in the conversation. Jennifer's inbox will show the new unread thread. The conversation is visible in the admin's Sent or All conversations view.

**Success criteria:**
- New `Conversation` record exists in the database
- Both the admin and Jennifer are `ConversationParticipant` records
- The message body is stored in the `messages` table
- No idempotency key collision
- Jennifer's inbox shows the new thread as unread

---

### Notifications

---

#### Scenario 16: Admin Views Bell-Icon Notifications

**Role:** admin  
**Credentials:** `admin@example.com` / `password`

**Steps:**
1. Log in as Alex Rivera (admin).
2. Observe the notification bell icon in the top navigation bar.
3. Note whether an unread count badge is displayed.
4. Click the bell icon to open the notifications panel.
5. Review the list of notifications.
6. Identify at least one unread notification.

**Expected result:** The bell icon displays a numeric badge indicating the number of unread notifications. Opening the panel shows a list of notifications with title, message body, timestamp, and read/unread indicator. Notification types include application events, document events, and medical alerts depending on what was seeded by `ExtendedNotificationSeeder`.

**Success criteria:**
- Notification bell renders without error
- Unread count is greater than 0 (at least one unread notification seeded for admin)
- Notification panel opens and lists items
- Each notification shows a title and message string (not raw JSON data)
- Timestamps are formatted and readable

---

#### Scenario 17: Applicant Marks a Notification as Read

**Role:** applicant  
**Credentials:** `sarah.johnson@example.com` / `password`

**Steps:**
1. Log in as Sarah Johnson.
2. Click the notification bell icon.
3. Identify an unread notification in the panel.
4. Click the notification or click a "Mark as read" control on the notification item.
5. Observe the notification state change.
6. Observe whether the unread badge count on the bell icon decrements.

**Expected result:** The selected notification transitions from unread to read state. The visual indicator (bold text, dot, or highlight) is removed from the notification. The bell icon badge count decrements by 1. If all notifications are marked read, the badge disappears or shows zero.

**Success criteria:**
- `read_at` timestamp is set on the `notifications` record in the database after the action
- UI reflects the read state (visual indicator removed)
- Badge count decrements correctly
- Marking one notification read does not affect other unread notifications
- No errors on the mark-as-read API call

---

## 10. Post-Seed System Verification Checklist

Use this checklist after running `php artisan migrate:fresh --seed` to confirm the system is fully operational before beginning a test session.

---

### 10.1 Identity and Access Management

- [ ] All 4 roles exist in the `roles` table: `super_admin`, `admin`, `medical`, `applicant`
- [ ] 15 user records exist (8 applicants, 4 admin/super_admin, 2 medical, 1 super admin bootstrap)
- [ ] `admin@campburntgin.org` exists with `is_active = true` and role `super_admin`
- [ ] `inactive@example.com` has `is_active = false`
- [ ] `locked.applicant@example.com` has `failed_login_attempts = 5` and a future `lockout_until`
- [ ] `mfa.admin@campburntgin.org` has `mfa_enabled = true` and a non-null `mfa_secret`
- [ ] Address data (phone, address_line_1, city, state, postal_code) is populated on 6 core applicant accounts
- [ ] `user_emergency_contacts` table has at least 4 records

---

### 10.2 Camp and Session Management

- [ ] 1 camp record exists: Camp Burnt Gin
- [ ] 3 camp session records exist: Session 1 Summer 2025 (inactive), Session 1 Summer 2026, Session 2 Summer 2026
- [ ] Sessions have capacity 60 and age range 6–17
- [ ] Sessions have correct start/end dates (S1-2026: June 8–12; S2-2026: June 22–26)

---

### 10.3 Camper and Application System

- [ ] 9 camper records exist: Ethan, Lily, Sofia, Noah, Ava, Lucas, Mia, Tyler, Henry
- [ ] At least 13 application records exist
- [ ] At least one application in each status: `approved`, `pending`, `under_review`, `rejected`, `waitlisted`
- [ ] Ethan Johnson has an `approved` application linked to Session 1 — Summer 2026
- [ ] Sofia Martinez has an `under_review` application
- [ ] Tyler Wilson has a `waitlisted` application
- [ ] Noah Thompson has a `rejected` application (S1-2026) and a `pending` application (S2-2026)

---

### 10.4 Medical Portal

- [ ] 9 medical records exist (one per camper)
- [ ] Ethan's record has 2 diagnoses (ASD, Epilepsy), Levetiracetam and Melatonin medications
- [ ] Sofia's record has Cerebral Palsy and Spina Bifida diagnoses, wheelchair and BiPAP assistive devices
- [ ] Noah's record has a latex allergy documented
- [ ] Ava's record has Type 1 Diabetes diagnosis, CGM and insulin pump equipment
- [ ] Lucas's record has Duchenne MD diagnosis, power wheelchair and BiPAP
- [ ] 12 treatment log records exist across 8 campers
- [ ] All 5 treatment types are represented: `medication_administered`, `first_aid`, `observation`, `emergency`, `other`
- [ ] 7 medical incident records exist
- [ ] 8 medical visit records exist
- [ ] 7 medical follow-up records exist
- [ ] At least 2 follow-ups have due dates in the past with non-completed status (overdue)
- [ ] 9 medical restriction records exist (6 active, 1 expired for Lily)
- [ ] 7 provider link records exist covering all 5 states: active (not accessed), active (accessed), submitted, expired, revoked
- [ ] `MedicalCrossLinkSeeder` has back-filled `treatment_log_id` on at least some incident and follow-up records

---

### 10.5 Document Management

- [ ] 14 required document rule records exist
- [ ] At least 5 `applicant_documents` records exist across 3 states (`pending`, `submitted`, `reviewed`)
- [ ] 7 document request records exist, one per status value
- [ ] `awaiting_upload` request exists for Ethan (IEP)
- [ ] `overdue` request exists for Ava (CGM Calibration Log) with `due_date` in the past
- [ ] `rejected` request exists for Lily (Allergy Action Plan) with a non-null `rejection_reason`
- [ ] `approved` request exists for Lucas (BiPAP Certification) with `reviewed_at` and `reviewed_by_admin_id` populated
- [ ] Each document request has a linked `conversation_id` pointing to a system-generated conversation

---

### 10.6 Inbox and Messaging

- [ ] At least 18 conversation records exist (5 core + 6 extended + 7 system-generated)
- [ ] 7 conversations have `is_system_generated = true`
- [ ] 7 system-generated conversations have `system_event_type = 'document.requested'`
- [ ] Each system conversation is linked to a `DocumentRequest` via `related_entity_id`
- [ ] The archived conversation (Pre-Camp 2025 — Packing List) has `is_archived = true`
- [ ] Sarah Johnson's participant record on the archived conversation has `is_starred = true`
- [ ] The "Mia Davis — Heat Protocol Questions" conversation has exactly 1 message (no admin reply)
- [ ] `message_reads` table is populated; most recent messages in active threads have no read receipt for one participant

---

### 10.7 Audit Log

- [ ] At least 35 audit log records exist
- [ ] All 6 event types are represented: `authentication`, `admin_action`, `phi_access`, `document`, `medical`, `system`
- [ ] At least 7 audit entries from `DocumentRequestSeeder` (one per document request, event type `admin_action`, action `document_request.created`)
- [ ] Entries span a date range of at least 45 days (oldest entry approximately 45 days before today)

---

### 10.8 Announcements and Calendar

- [ ] 5 announcement records exist
- [ ] "URGENT: Medication Form Update Required Before April 1" has `is_pinned = true` and `is_urgent = true`
- [ ] 1 announcement has `audience = 'admin'` (Staff Orientation)
- [ ] 14 calendar event records exist
- [ ] At least 3 events have `audience = 'medical'` (medical staff-targeted events)
- [ ] Session events for Summer 2026 exist with correct start/end dates

---

### 10.9 Notifications

- [ ] At least 21 notification records exist in the `notifications` table
- [ ] Notifications exist for admin, medical, and applicant recipient users
- [ ] At least one unread notification exists for `admin@example.com`
- [ ] At least one unread notification exists for one applicant account
- [ ] Notification records contain non-null `data->title` and `data->message` fields (not raw model data)
- [ ] `read_at` is null on unread notifications and set to a timestamp on read notifications

---

## 11. Appendix: Seeder File Reference

All seeder files are located at:  
`backend/camp-burnt-gin-api/database/seeders/`

| File | Group | Tables Populated | Purpose |
|---|---|---|---|
| `DatabaseSeeder.php` | Orchestrator | None directly | Master orchestrator; controls execution order, environment guards, and flag checks |
| `RoleSeeder.php` | Always | `roles` | Creates the 4 application roles |
| `RequiredDocumentRuleSeeder.php` | Always | `required_document_rules` | Creates 14 document compliance rules |
| `ActivityPermissionSeeder.php` | Always | `activity_permissions` | Creates default activity permission templates |
| `UserSeeder.php` | Core | `users` | Creates admin, medical, and deputy super admin staff accounts |
| `ApplicantSeeder.php` | Core | `users`, `campers`, `emergency_contacts` | Creates 6 applicant families (Sarah, David, Jennifer, Michael, Patricia, Grace) with campers and primary emergency contacts |
| `CampSeeder.php` | Core | `camps`, `camp_sessions` | Creates Camp Burnt Gin and 3 sessions (1 past, 2 active) |
| `ApplicationSeeder.php` | Core | `applications` | Creates applications across all status variants for the 9 core campers |
| `MedicalSeeder.php` | Core | `medical_records`, `allergies`, `medications`, `diagnoses` | Creates medical records with diagnoses, allergies, and medications for all campers |
| `MedicalPhase11Seeder.php` | Core | `medical_incidents`, `medical_visits`, `medical_follow_ups`, `medical_restrictions` | Creates 7 incidents, 8 visits, 7 follow-ups, and 9 restrictions across all campers; calibrated dates for dashboard widget accuracy |
| `TreatmentLogSeeder.php` | Core | `treatment_logs` | Creates 12 treatment log entries spanning all 5 types across 8 campers; links to visit records where applicable |
| `DocumentSeeder.php` | Core | `documents` | Creates polymorphic document metadata records on applications and campers |
| `MessageSeeder.php` | Core | `conversations`, `conversation_participants`, `messages` | Creates 5 core inbox conversation threads between applicants and admin |
| `AnnouncementSeeder.php` | Core | `announcements`, `calendar_events`, `audit_logs` | Creates 5 announcements, 14 calendar events, and 6 baseline audit log entries |
| `NotificationSeeder.php` | Core | `notifications` | Creates database notifications for demo applicant accounts |
| `ExtendedUserSeeder.php` | Extended | `users`, `user_emergency_contacts` | Creates inactive, locked, and MFA-enabled users; adds medical2 and admin3 staff; backfills address data on 6 applicants; seeds user-level emergency contacts |
| `WaitlistedApplicationSeeder.php` | Extended | `users`, `campers`, `applications` | Creates waitlisted, draft, paper-entered, and returning-applicant applications; also creates the Henry Carter family and camper record |
| `ExtendedEmergencyContactSeeder.php` | Extended | `emergency_contacts` | Adds secondary and non-pickup emergency contacts for several campers |
| `ProviderLinkSeeder.php` | Extended | `medical_provider_links` | Creates 7 provider links covering all 5 lifecycle states (active-new, active-accessed, submitted, expired, revoked) |
| `CamperProfileSeeder.php` | Extended | `behavioral_profiles`, `assistive_devices`, `feeding_plans` | Creates behavioral profiles, assistive devices, and feeding plans for all campers |
| `ExtendedMedicalRecordSeeder.php` | Extended | `medical_records`, `activity_permissions` | Fills `has_seizures` fields on medical records; adds realistic restricted/denied activity permission overrides |
| `ExtendedMessageSeeder.php` | Extended | `conversations`, `conversation_participants`, `messages` | Creates 6 additional conversation threads: medical staff coordination, archived conversation, 11-message long thread, unanswered applicant thread, internal admin coordination, Medical2 thread |
| `ExtendedAuditLogSeeder.php` | Extended | `audit_logs` | Creates ~35 comprehensive audit log entries spanning 45 days across all event type categories |
| `ExtendedNotificationSeeder.php` | Extended | `notifications` | Creates additional notifications for admin, medical, and applicant users |
| `ApplicantDocumentSeeder.php` | Extended | `applicant_documents` | Creates 5 applicant document records in 3 states: pending, submitted, reviewed |
| `DocumentRequestSeeder.php` | Extended | `document_requests`, `conversations`, `conversation_participants`, `messages`, `audit_logs` | Creates 7 document requests covering all lifecycle states; creates a system-generated inbox conversation per request with a system message and admin follow-up; writes audit log entries |
| `MessageReadSeeder.php` | Extended | `message_reads` | Creates read receipts for all conversations; leaves most-recent messages unread to produce unread badges; preserves Patricia/Mia unanswered thread as fully unread for admin |
| `MedicalCrossLinkSeeder.php` | Extended | `medical_incidents`, `medical_follow_ups`, `medical_restrictions`, `behavioral_profiles` | Back-fills `treatment_log_id` cross-references on incidents and follow-ups; adds activity restrictions for Ava and Mia; adds behavioral profiles for Ava and Mia |

### Configuration file

| File | Purpose |
|---|---|
| `config/seeding.php` | Defines the 5 environment flags (`ENABLE_DEMO_DATA`, `ENABLE_MEDICAL_SEEDS`, `ENABLE_DOCUMENT_SEEDS`, `ENABLE_NOTIFICATION_SEEDS`, `ENABLE_EXTENDED_SEEDS`) with defaults and documentation |

---

*End of SEEDER_TESTING_GUIDE.md*


