# Camp Burnt Gin — Medical System Analysis

> **Purpose:** Verify assistant understanding of the medical system against the actual codebase.
> **Date:** 2026-03-09
> **Based on:** Phase 11 codebase (complete as of 2026-03-07)

---

## Table of Contents

1. [Source of Medical Data](#1-source-of-medical-data)
2. [Relationship Between Applications and Campers](#2-relationship-between-applications-and-campers)
3. [Medical Record Structure](#3-medical-record-structure)
4. [Alerts and Medical Risk Indicators](#4-alerts-and-medical-risk-indicators)
5. [Medical Staff Workflow](#5-medical-staff-workflow)
6. [Visits and Treatments](#6-visits-and-treatments)
7. [Medical History Representation](#7-medical-history-representation)
8. [Operational Tools for Medical Staff](#8-operational-tools-for-medical-staff)
9. [Safety Features](#9-safety-features)
10. [Full Medical Workflow](#10-full-medical-workflow)
11. [Database Schema Reference](#11-database-schema-reference)
12. [Controller & API Reference](#12-controller--api-reference)
13. [Authorization Policies (RBAC)](#13-authorization-policies-rbac)
14. [Frontend Pages & Routes](#14-frontend-pages--routes)
15. [Known Issues & Tech Debt](#15-known-issues--tech-debt)

---

## 1. Source of Medical Data

Medical data enters the system at two distinct points:

### 1.1 Application Stage (Parent/Applicant Submission)

When a parent submits a camp application for their child, the application form captures an initial set of medical fields. These are stored on the **Application** model and are linked to the applicant (parent) account.

```
Application
└── applicant_id (FK → User)
└── medical fields (captured at intake):
    ├── allergies (text)
    ├── medications (text)
    ├── special_needs (text)
    ├── dietary_restrictions (text)
    └── emergency_contacts (JSON or relational)
```

These fields are **preliminary** — they represent parent-reported information before clinical review.

### 1.2 Camper Record Stage (After Approval)

Once an application is approved, the system creates a **Camper** record. At this point, a structured medical profile is established using dedicated relational tables rather than free-text fields on the application.

```
Camper
├── medicalRecord         (HasOne → MedicalRecord)
├── allergies             (HasMany → Allergy)
├── medications           (HasMany → Medication)
├── diagnoses             (HasMany → Diagnosis)
├── behavioralProfile     (HasOne → BehavioralProfile)
├── feedingPlan           (HasOne → FeedingPlan)
├── assistiveDevices      (HasMany → AssistiveDevice)
├── activityPermissions   (HasMany → ActivityPermission)
├── emergencyContacts     (HasMany → EmergencyContact)
├── incidents             (HasMany → MedicalIncident)       [Phase 11]
├── followUps             (HasMany → MedicalFollowUp)       [Phase 11]
├── visits                (HasMany → MedicalVisit)          [Phase 11]
├── restrictions          (HasMany → MedicalRestriction)    [Phase 11]
└── treatmentLogs         (HasMany → TreatmentLog)          [Phase 6]
```

**PHI Note:** All narrative/clinical fields across these models are encrypted at rest using Laravel's `encrypted` cast (AES-256-CBC).

---

## 2. Relationship Between Applications and Campers

### 2.1 Approval Flow

```
Parent submits Application
        ↓
Admin reviews Application
        ↓
Admin approves Application
        ↓
System creates Camper record (linked to Application)
        ↓
System creates MedicalRecord stub (1:1 with Camper)
        ↓
Medical staff populates full clinical profile
```

### 2.2 Entity Relationship

```
User (applicant/parent)
└── Application
    └── (approved) → Camper
                     ├── MedicalRecord (1:1)
                     ├── Allergy[]
                     ├── Medication[]
                     ├── Diagnosis[]
                     ├── BehavioralProfile (1:1)
                     ├── FeedingPlan (1:1)
                     ├── AssistiveDevice[]
                     ├── ActivityPermission[]
                     ├── EmergencyContact[]
                     ├── MedicalIncident[]
                     ├── MedicalFollowUp[]
                     ├── MedicalVisit[]
                     ├── MedicalRestriction[]
                     └── TreatmentLog[]
```

**Key Models Involved:**
- `App\Models\Application` — intake form
- `App\Models\Camper` — active camp participant
- `App\Models\MedicalRecord` — clinical health summary (1:1 with Camper, auto-created on approval)

---

## 3. Medical Record Structure

### 3.1 Core Health Summary (`medical_records` table)

The `MedicalRecord` model is a 1:1 companion to `Camper`. It stores physician/insurance/special-needs data.

| Column | Type | Encrypted | Notes |
|--------|------|-----------|-------|
| `id` | bigint | — | PK |
| `camper_id` | bigint | — | Unique FK → campers |
| `physician_name` | text | ✓ | |
| `physician_phone` | text | ✓ | |
| `insurance_provider` | text | ✓ | |
| `insurance_policy_number` | text | ✓ | |
| `special_needs` | text | ✓ | |
| `dietary_restrictions` | text | ✓ | |
| `notes` | text | ✓ | |
| `has_seizures` | boolean | — | |
| `last_seizure_date` | date | — | |
| `seizure_description` | text | ✓ | |
| `has_neurostimulator` | boolean | — | |

**Computed attribute:** `primary_diagnosis` — first diagnosis name appended automatically.

### 3.2 Full Data Hierarchy

```
Camper
│
├── MedicalRecord (1:1)
│   └── physician info, insurance, special needs, seizure history
│
├── Allergy[] — allergen, reaction, treatment, severity (enum)
├── Medication[] — name, dosage, frequency, purpose, prescribing_physician
├── Diagnosis[] — name, description, severity
│
├── BehavioralProfile (1:1)
│   └── wandering_risk, aggression, de-escalation strategies
│
├── FeedingPlan (1:1)
│   └── G-tube needs, special diets, feeding schedules
│
├── AssistiveDevice[] — wheelchairs, comms devices, mobility aids
├── ActivityPermission[] — per-activity clearance
├── EmergencyContact[] — names, phones, pickup authorization
│
├── MedicalRestriction[] — activity/dietary/environmental/equipment restrictions
│   └── is_active, start_date, end_date, restriction_type, description
│
├── TreatmentLog[] — clinical interventions (medication given, first aid, etc.)
│   └── type (enum), treatment_date, medication_given, dosage_given, follow_up_required
│
├── MedicalIncident[] — health/safety events
│   └── type (enum), severity (enum), incident_date, escalation_required
│
├── MedicalVisit[] — health office encounters
│   └── visit_date, chief_complaint, vitals (JSON), disposition (enum)
│   └── TreatmentLog[] (HasMany — treatments administered during visit)
│
└── MedicalFollowUp[] — follow-up task queue
    └── status (enum), priority (enum), due_date, assigned_to, completed_by
```

---

## 4. Alerts and Medical Risk Indicators

### 4.1 Alert Sources

Alerts are not a standalone table; they are **computed at query time** from existing medical data.

| Alert Type | Source | Trigger Condition |
|------------|--------|-------------------|
| Severe Allergy | `Allergy.severity` | `severe` or `life_threatening` |
| Overdue Follow-Up | `MedicalFollowUp.due_date + status` | `due_date < today` AND status ≠ completed/cancelled |
| Due-Today Follow-Up | `MedicalFollowUp.due_date + status` | `due_date = today` AND status = pending |
| Critical Incident | `MedicalIncident.severity` | severity = `critical` |
| Missing Medical Record | `campers` LEFT JOIN `medical_records` | no matching medical_record row |
| Escalated Visit | `MedicalVisit.disposition` | `sent_home` or `emergency_transfer` |

### 4.2 Where Alerts Are Displayed

**Dashboard Alert Strip (`MedicalDashboardPage`):**
```
┌──────────────────────────────────────────────────────────┐
│  🔴  2 overdue follow-ups  ·  🟡  1 due today            │
└──────────────────────────────────────────────────────────┘
```

**Dashboard Stats Bar (5 metric cards):**
```
┌─────────┬──────────────────┬─────────────────┬──────────────────────┬───────────────────────┐
│  Total  │  Severe Allergies│  On Medications │  Active Restrictions │  Missing Med Record   │
│  Campers│                  │                 │                      │                       │
└─────────┴──────────────────┴─────────────────┴──────────────────────┴───────────────────────┘
```

**Medical Record Page Header:**
- Alert strip for individual camper (severe allergies, missing insurance, seizure plan required, etc.)

**Emergency View Page (`MedicalEmergencyViewPage`):**
- Allergy section displays severity badges (color-coded by level)
- Designed for quick visual scanning during emergencies

### 4.3 Alert Generation Logic

No cron job or event-driven alert pipeline. Alerts are generated via:
1. `GET /medical/stats` endpoint → `MedicalStatsController::index()` runs COUNT queries
2. `Allergy::requiresImmediateAttention()` helper on model → checks severity enum
3. `MedicalFollowUp::isOverdue()` / `isDueToday()` helpers
4. `MedicalIncident::isCritical()` helper

---

## 5. Medical Staff Workflow

### 5.1 Locating a Camper

```
Medical Staff Logs In
        ↓
/medical/dashboard  →  Paginated Camper Directory (bottom section)
                        Search by name, view quick summary
        ↓
Click camper name  →  /medical/records/{camperId}  →  MedicalRecordPage
        ↓
Full profile: allergies, medications, diagnoses, restrictions, etc.
        ↓
Quick-nav buttons in header:
    [View Incidents]  →  /medical/incidents?camper_id={camperId}
    [View Visits]     →  /medical/visits?camper_id={camperId}
```

### 5.2 Logging a Medical Event

```
From MedicalRecordPage or /medical/incidents:

Staff clicks "Record Incident"
        ↓
Incident Form Modal opens
Required:  type, severity, title, description, incident_date
Optional:  location, witnesses, escalation_notes, treatment_log_id
        ↓
POST /medical-incidents
        ↓
Backend: policy check → MedicalIncident::create()
        ↓
Incident appears in camper record + global incidents list
Audit log: "Medical provider recorded MedicalIncident #N"
```

### 5.3 Workflow Diagram

```
[Medical Staff Logs In]
         │
         ▼
[/medical/dashboard]──────────────────────────────────────────┐
    │  StatBar: Counts           FollowUpPanel: Tasks          │
    │  AlertStrip: Overdue       ActivityFeed: Recent Events   │
    │  Directory: Camper List                                  │
    │                                                          │
    ▼                                                          │
[Search / Select Camper]                                       │
    │                                                          │
    ▼                                                          │
[/medical/records/{camperId}]  ←───── Quick nav from dashboard │
    │  Full profile (allergies, meds, restrictions, etc.)      │
    │                                                          │
    ├──► [Log Treatment]  → POST /treatment-logs               │
    │       Allergy conflict check runs server-side            │
    │                                                          │
    ├──► [Record Visit]   → POST /medical-visits               │
    │       Vitals, chief complaint, disposition               │
    │                                                          │
    ├──► [Record Incident]→ POST /medical-incidents            │
    │       Type, severity, escalation                         │
    │                                                          │
    └──► [Emergency View] → /medical/emergency/{camperId}      │
             Read-only quick summary for emergencies           │
                                                               │
[/medical/follow-ups] ◄────────────────────────────────────────┘
    Task queue: mark complete, reassign, filter by status/priority
```

---

## 6. Visits and Treatments

### 6.1 Visits (`medical_visits` table)

A **MedicalVisit** is a formal health office encounter. It captures the full clinical picture of a single sick-bay visit.

| Field | Type | Notes |
|-------|------|-------|
| `visit_date` | date | |
| `visit_time` | time (nullable) | |
| `chief_complaint` | text (encrypted) | Why camper came in |
| `symptoms` | text (encrypted) | Observed symptoms |
| `vitals` | JSON | `{temp, pulse, bp_systolic, bp_diastolic, weight, spo2}` |
| `treatment_provided` | text (encrypted) | Summary of care given |
| `medications_administered` | text (encrypted) | Medications given |
| `disposition` | enum | `returned_to_activity`, `monitoring`, `sent_home`, `emergency_transfer`, `other` |
| `disposition_notes` | text (encrypted) | |
| `follow_up_required` | boolean | |
| `follow_up_notes` | text (encrypted) | |

### 6.2 Treatment Logs (`treatment_logs` table)

A **TreatmentLog** is a single clinical intervention. It can exist independently or be linked to a visit.

| Field | Type | Notes |
|-------|------|-------|
| `treatment_date` | date | |
| `treatment_time` | string (HH:MM) | |
| `type` | enum | `medication_administered`, `first_aid`, `observation`, `emergency`, `other` |
| `title` | text (encrypted) | |
| `description` | text (encrypted) | What was done |
| `outcome` | text (encrypted) | Result |
| `medication_given` | text (encrypted) | Medication name |
| `dosage_given` | text (encrypted) | |
| `follow_up_required` | boolean | |
| `follow_up_notes` | text (encrypted) | |
| `medical_visit_id` | FK (nullable) | Linked visit (if from health office) |

### 6.3 Hierarchy Diagram

```
MedicalVisit (formal health office encounter)
│
│  visit_date, vitals, chief_complaint, disposition
│
└── TreatmentLog[]  (individual care actions during visit)
        │
        ├── type: medication_administered
        │     └── medication_given, dosage_given
        │
        ├── type: first_aid
        │     └── description, outcome
        │
        ├── type: observation
        │     └── description, outcome
        │
        └── type: emergency
              └── description, escalation context

TreatmentLog (standalone — not linked to a visit)
│
└── Captured outside health office (e.g., field treatment, medication admin at meal)
```

---

## 7. Medical History Representation

### 7.1 Chronological History

The system supports **chronological history** through multiple record types:

| Record Type | Table | Default Order |
|-------------|-------|---------------|
| Visits | `medical_visits` | `visit_date DESC`, `visit_time DESC` |
| Incidents | `medical_incidents` | `incident_date DESC`, `incident_time DESC` |
| Treatment Logs | `treatment_logs` | `treatment_date DESC` |
| Follow-Ups | `medical_follow_ups` | `due_date ASC` (soonest first) |

### 7.2 How History Is Accessed

**Per-Camper View (MedicalRecordPage):**
- Each resource type has its own expandable section
- Lists are paginated per-resource
- Quick-nav buttons to full scoped views:
  - `[View Incidents]` → `/medical/incidents?camper_id={id}`
  - `[View Visits]` → `/medical/visits?camper_id={id}`

**Global View:**
- `/medical/incidents` — all incidents, filterable by camper, type, severity, date range
- `/medical/visits` — all visits, filterable by camper, date range
- `/medical/treatments` — all treatment logs, filterable by camper, type, date range

**Dashboard Activity Feed:**
- Merged timeline of last 5 treatments + 5 incidents + 5 visits from past 7 days
- Sorted chronologically newest-first

### 7.3 Timeline Example (Dashboard Feed)

```
Today — 14:32   Treatment: Tylenol administered — Emma R.
Today — 11:15   Visit: Stomach ache, returned to activity — Liam T.
Yesterday       Incident: Minor injury (scrape on knee) — Sofia K.
Yesterday       Treatment: Bandage applied — Sofia K.
2 days ago      Visit: Headache, monitoring — Noah P.
```

---

## 8. Operational Tools for Medical Staff

### 8.1 Dashboard (`/medical/dashboard`)

**Stats Bar — 5 aggregated metrics:**

```
┌──────────┬──────────────────┬─────────────────┬──────────────────────┬──────────────────────┐
│  Total   │  Severe          │  On             │  Active              │  Missing             │
│  Campers │  Allergies       │  Medications    │  Restrictions        │  Medical Record      │
│  ───────  │  ───────────────  │  ──────────────  │  ───────────────────  │  ───────────────────  │
│  45      │  3               │  18             │  5                   │  2                   │
└──────────┴──────────────────┴─────────────────┴──────────────────────┴──────────────────────┘
```

**Alert Strip:**
```
🔴 2 overdue follow-ups   🟡 1 follow-up due today
```

**Two-Column Layout:**
```
Left Column: Recent Activity Feed        Right Column: Follow-Up Panel
─────────────────────────────────        ──────────────────────────────
[Today 14:32] Treatment: Emma R.         [All] [Pending] [In Progress] [Done] [Cancelled]
[Today 11:15] Visit: Liam T.             ─────────────────────────────────────────────────
[Yesterday]   Incident: Sofia K.         🔴 Check fever at lunch     [Mark Complete]
[Yesterday]   Treatment: Sofia K.             Assigned: Dr. Chen | Due: TODAY
[2 days ago]  Visit: Noah P.             🟡 Parent callback: Jordan M.  [Mark Complete]
[2 days ago]  Incident: Marcus B.             Assigned: Nurse Kim | Due: 3/10
```

**Medical Directory (bottom):**
- Paginated camper list with search
- Quick medical summary per row
- Link to full medical record

### 8.2 Quick Visit Logging (`/medical/visits`)

- "New Visit" button opens form
- Required: camper, visit_date, chief_complaint, symptoms, disposition
- Optional: vitals (JSON widget), medications_administered, follow_up_required
- On save: creates MedicalVisit; optionally creates linked MedicalFollowUp

### 8.3 Incident Reporting (`/medical/incidents`)

- "Record Incident" button opens form
- Required: camper, type, severity, title, description, incident_date
- Optional: location, witnesses, escalation_required, escalation_notes
- Expandable rows show full details inline

### 8.4 Follow-Up Tracking (`/medical/follow-ups`)

- 5-tab filter (All / Pending / In Progress / Completed / Cancelled)
- Visual overdue indicator (red) and due-today indicator (yellow)
- Status transition buttons: Pending → In Progress → Completed
- `completed_at` and `completed_by` set automatically by backend on completion

### 8.5 Emergency View (`/medical/emergency/{camperId}`)

Read-only quick-summary page with 7 sections:
1. Camper demographics
2. Emergency contacts
3. Known allergies (with severity badges)
4. Current medications
5. Diagnoses
6. Special needs & dietary restrictions
7. Active restrictions

Designed for rapid visual scanning during emergencies — no edit controls.

---

## 9. Safety Features

### 9.1 Allergy Conflict Detection

**Location:** `TreatmentLog::detectAllergyConflicts()` (static method)

**Trigger:** Runs during `POST /treatment-logs` when `medication_given` is present.

**Algorithm:**
```
For each known allergy on the camper:
    If allergy.allergen is a case-insensitive substring of medication_given:
        → Flag as conflict
        → Return: { allergen, severity, reaction, treatment }
```

**Response on conflict:**
- Backend returns HTTP 422 with conflict list
- Frontend shows warning modal: "Allergy conflict detected — continue?"
- Staff must explicitly confirm to proceed

**Limitation:** Substring matching only. No pharmacological cross-reactivity database (e.g., penicillin/amoxicillin cross-reactivity is not automatically detected unless allergy is literally named "amoxicillin").

### 9.2 PHI Encryption at Rest

All narrative clinical fields are encrypted using Laravel's `encrypted` cast (AES-256-CBC):
- Allergen names, reactions, treatments
- Medication names, dosages, purposes
- Clinical notes, descriptions, complaints, symptoms
- Physician and insurance information
- Witness names, locations, escalation notes

**Not encrypted (queryable for filtering/sorting):**
- Enum values (type, severity, status, disposition)
- Boolean flags
- Date/time fields
- IDs and foreign keys
- Vitals JSON (future aggregation/trending potential)

### 9.3 Audit Logging

**Middleware:** `audit.phi` applied to all medical routes.

**Every medical endpoint logs:**
- User ID (who accessed)
- Action (view, create, update, delete)
- Entity type and ID
- Before/after values (for updates)
- IP address and timestamp

**Access:** Admins and super_admins only (medical staff cannot view audit logs).

### 9.4 Role-Based Access Control

| Action | applicant | medical | admin / super_admin |
|--------|-----------|---------|---------------------|
| View own child's medical record | ✓ | — | ✓ |
| View all medical records | — | ✓ | ✓ |
| Create/update allergies, meds, diagnoses | — | ✓ | ✓ |
| Delete allergies, meds, diagnoses | — | — | ✓ |
| Create/update treatment logs (own entries) | — | ✓ | ✓ |
| Create/update incidents (own entries) | — | ✓ | ✓ |
| Update any incident/visit/treatment | — | — | ✓ |
| Create/update follow-ups (any provider) | — | ✓ | ✓ |
| Create/update/delete restrictions | — | — | ✓ |
| View restrictions | — | ✓ (read-only) | ✓ |
| Delete any record | — | — | ✓ |
| View audit logs | — | — | ✓ |

### 9.5 Camper Record Immutability

- Medical staff cannot delete records they did not create
- Admins required for all delete operations
- Audit trail preserved even for "deleted" entries (soft-delete where applicable)

---

## 10. Full Medical Workflow

### 10.1 End-to-End System Flow

```
╔══════════════════════════════════════════════════════════════╗
║               MEDICAL DATA ENTRY POINTS                      ║
╚══════════════════════════════════════════════════════════════╝

[1. Parent/Applicant Stage]
        │
        ▼
Parent submits Application
(allergies, medications, special needs, emergency contacts — free text)
        │
        ▼
Admin reviews & approves Application
        │
        ▼
System creates Camper + MedicalRecord stub
        │
        ▼
[2. Clinical Setup Stage]
        │
        ▼
Medical staff populates structured profile on /medical/records/{camperId}:
    ├── Allergies (with severity classification)
    ├── Medications (with dosage, prescriber)
    ├── Diagnoses
    ├── Behavioral Profile
    ├── Feeding Plan
    ├── Assistive Devices
    ├── Activity Permissions
    └── Emergency Contacts

Admin adds Medical Restrictions (activity/dietary/environmental)
        │
        ▼
[3. Camp Operations Stage]
        │
        ▼
Medical Staff logs in → /medical/dashboard
        │
        ├── View alert strip (overdue follow-ups)
        ├── View stats bar (severe allergy count, missing records, etc.)
        ├── Review activity feed (recent treatments, incidents, visits)
        └── Work follow-up task queue
        │
        ▼
Camper arrives at health office or incident occurs in camp
        │
        ├── VISIT FLOW:
        │   Medical staff opens camper record
        │   Reviews allergies + medications + restrictions FIRST
        │   Records MedicalVisit:
        │       chief_complaint, symptoms, vitals
        │       treatment_provided, medications_administered
        │       disposition (returned to activity / monitoring / sent home / emergency transfer)
        │   If medication given → TreatmentLog created (allergy conflict check runs)
        │   If follow-up needed → MedicalFollowUp task created
        │
        ├── INCIDENT FLOW:
        │   Staff records MedicalIncident:
        │       type, severity, description, witnesses
        │       escalation_required flag
        │   If critical → dashboard alert strip triggers on next load
        │   If treatment given → link TreatmentLog to incident
        │
        └── TREATMENT FLOW (standalone, outside health office):
            Staff records TreatmentLog:
                type: medication_administered / first_aid / observation
                medication_given → allergy conflict check
                outcome, follow_up_required
        │
        ▼
[4. Follow-Up & Resolution Stage]
        │
        ▼
MedicalFollowUp tasks appear in /medical/follow-ups
    ├── Overdue tasks (red indicator)
    ├── Due-today tasks (yellow indicator)
    └── In-progress tasks
        │
        ▼
Any medical staff member can:
    ├── Pick up a task (mark in_progress)
    ├── Reassign to colleague (assigned_to)
    └── Mark complete (completed_at / completed_by auto-set by backend)
        │
        ▼
[5. Emergency View (rapid access)]
        │
        ▼
/medical/emergency/{camperId}
    7-section read-only summary:
    Allergies (severity-badged) · Medications · Diagnoses · Restrictions
    Emergency Contacts · Demographics · Special Needs
        │
        ▼
[6. Audit & Governance]
        │
        ▼
All PHI access logged by audit.phi middleware
Admins can review audit log: who viewed what, when, from where
Export available (CSV/JSON, 5,000 row cap)
```

### 10.2 Allergy Conflict Detection Sub-Flow

```
Staff enters medication name in TreatmentLog form
        ↓
POST /treatment-logs (with medication_given field)
        ↓
TreatmentLogController::store() invoked
        ↓
TreatmentLog::detectAllergyConflicts(medicationName, camper->allergies)
        ↓
    Substring match (case-insensitive) against each known allergy
        ↓
    ┌─────────────────────┐    ┌─────────────────────────────────┐
    │ No conflicts found  │    │ Conflict(s) found               │
    └─────────────────────┘    └─────────────────────────────────┘
            ↓                              ↓
    TreatmentLog saved            HTTP 422 returned with:
    Audit log created             { allergen, severity, reaction, treatment }
                                          ↓
                                  Frontend warning modal shown
                                  "Allergy conflict! Continue?"
                                          ↓
                              ┌───────────┐   ┌──────────────┐
                              │  Cancel   │   │ Confirm      │
                              └───────────┘   └──────────────┘
                                                    ↓
                                          POST retried (bypass flag)
                                          TreatmentLog saved with conflict noted
```

---

## 11. Database Schema Reference

### Migrations Summary

| Migration File | Table | Added |
|----------------|-------|-------|
| `2024_01_03_000001` | `medical_records` | Core health summary |
| `2024_01_03_000003` | `allergies` | Allergy tracking |
| `2024_01_03_000004` | `medications` | Medication tracking |
| `2024_01_03_000005` | `diagnoses` | Diagnoses |
| `2024_01_03_000006` | `behavioral_profiles` | Behavioral data |
| `2024_01_03_000007` | `feeding_plans` | Feeding/nutrition |
| `2024_01_03_000008` | `assistive_devices` | Mobility/comm devices |
| `2024_01_03_000009` | `activity_permissions` | Activity clearance |
| `2024_01_03_000010` | `emergency_contacts` | Emergency contacts |
| `2026_03_06_000010` | `treatment_logs` | Phase 6 — clinical interventions |
| `2026_03_07_000001` | `medical_incidents` | Phase 11 — incident reports |
| `2026_03_07_000002` | `medical_follow_ups` | Phase 11 — follow-up tasks |
| `2026_03_07_000003` | `medical_visits` | Phase 11 — health office visits |
| *(inferred)* | `medical_restrictions` | Phase 11 — activity restrictions |

### Enums Reference

| Enum | Values |
|------|--------|
| `AllergySeverity` | mild, moderate, severe, life_threatening |
| `IncidentType` | behavioral, medical, injury, environmental, emergency, other |
| `IncidentSeverity` | minor, moderate, severe, critical |
| `FollowUpStatus` | pending, in_progress, completed, cancelled |
| `FollowUpPriority` | low, medium, high, urgent |
| `VisitDisposition` | returned_to_activity, monitoring, sent_home, emergency_transfer, other |
| `TreatmentType` | medication_administered, first_aid, observation, emergency, other |

---

## 12. Controller & API Reference

| Controller | Endpoint | Methods | Policy Gate |
|------------|----------|---------|-------------|
| `MedicalRecordController` | `/medical-records` | index, store, show, update, destroy | admin\|medical |
| `MedicalStatsController` | `/medical/stats` | index | admin\|medical |
| `MedicalIncidentController` | `/medical-incidents` | index, store, show, update, destroy | admin\|medical |
| `MedicalFollowUpController` | `/medical-follow-ups` | index, store, show, update, destroy | admin\|medical |
| `MedicalVisitController` | `/medical-visits` | index, store, show, update, destroy | admin\|medical |
| `MedicalRestrictionController` | `/medical-restrictions` | index, store, show, update, destroy | admin\|medical (read), admin (write) |
| `TreatmentLogController` | `/treatment-logs` | index, store, show, update, destroy | admin\|medical |

**Camper-Scoped Routes:**
- `GET /medical-visits/camper/{camperId}` — visits for one camper
- `GET /medical-incidents/camper/{camperId}` — incidents for one camper

---

## 13. Authorization Policies (RBAC)

### Policy Matrix

| Policy | viewAny | view | create | update | delete |
|--------|---------|------|--------|--------|--------|
| `MedicalRecordPolicy` | admin\|medical | admin\|medical\|applicant (own) | admin\|applicant | admin\|medical\|applicant (own) | admin |
| `MedicalIncidentPolicy` | admin\|medical | admin\|medical | admin\|medical | admin\|medical (own) | admin |
| `MedicalFollowUpPolicy` | admin\|medical | admin\|medical | admin\|medical | admin\|medical (any) | admin |
| `MedicalVisitPolicy` | admin\|medical | admin\|medical | admin\|medical | admin\|medical (own) | admin |
| `MedicalRestrictionPolicy` | admin\|medical | admin\|medical | admin | admin | admin |
| `TreatmentLogPolicy` | admin\|medical | admin\|medical | admin\|medical | admin\|medical (own) | admin |

**"own" = `recorded_by === auth()->id()` or `created_by === auth()->id()`**
**"any" = collaborative, no creator restriction (FollowUps)**

---

## 14. Frontend Pages & Routes

| Route | Page Component | Role | Purpose |
|-------|---------------|------|---------|
| `/medical/dashboard` | `MedicalDashboardPage` | medical | Operational command center |
| `/medical/records` | `MedicalRecordsListPage` | medical | Browse all camper records |
| `/medical/records/:camperId` | `MedicalRecordPage` | medical | Full single-camper record |
| `/medical/records/:camperId/treatments` | `MedicalTreatmentLogPage` | medical | Camper-scoped treatment log |
| `/medical/treatments` | `MedicalTreatmentLogPage` | medical | Global treatment log |
| `/medical/documents` | `MedicalDocumentsPage` | medical | Document management |
| `/medical/incidents` | `MedicalIncidentsPage` | medical | Incident reporting & browsing |
| `/medical/follow-ups` | `MedicalFollowUpsPage` | medical | Follow-up task queue |
| `/medical/visits` | `MedicalVisitsPage` | medical | Health office visits |
| `/medical/emergency/:camperId` | `MedicalEmergencyViewPage` | medical | Emergency quick-view (read-only) |
| `/medical/inbox` | `MessagingPage` (scoped) | medical | Medical staff messaging |

**Layout:** All medical routes render within `MedicalLayout` (sidebar with role-appropriate navigation items).

**Sidebar Items (Phase 11):**
- Dashboard (LayoutDashboard icon)
- Medical Records (FileText icon)
- Treatment Logs (ClipboardList icon)
- Incidents (AlertOctagon icon)
- Follow-Ups (ClipboardCheck icon)
- Visits (Stethoscope icon)
- Documents (FolderOpen icon)
- Inbox (MessageCircle icon)

---

## 15. Known Issues & Tech Debt

### Pending Migrations (must run before use)

```bash
php artisan migrate
```

Required for:
- Phase 8: `conversation_participants` table — `is_starred`, `is_important`, `trashed_at` columns
- Phase 6: `treatment_logs` table

### Open Bugs (as of Phase 11)

From `BUG_TRACKER.md` — 8 open bugs remain (details in tracker). None are critical-severity medical issues as of Phase 11.

### Design Notes / Limitations

1. **Allergy conflict detection** uses substring matching only — no pharmacological cross-reactivity database. Penicillin-class cross-reactions (e.g., penicillin ↔ amoxicillin) will not be caught unless the allergy is named exactly.

2. **Medical restrictions** are admin-only for create/update. There is no workflow for medical staff to propose restrictions pending admin approval.

3. **Vitals** are stored as an unencrypted JSON column to support future aggregation/trending. If PHI classification applies to vitals, this should be revisited.

4. **MedicalRecord** auto-created on camper approval — if an admin deletes and re-creates a camper record, medical record continuity must be verified manually.

5. **Alert Strip** refreshes only on page load / explicit refetch. There is no real-time push (no WebSocket or polling) for new critical incidents during active sessions.

---


