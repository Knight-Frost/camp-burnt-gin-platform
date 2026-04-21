# Camp Burnt Gin — Domain Model: Applicant / Application / Camper

**Authoritative source of truth. Any code, report, or UI that contradicts these definitions is a bug.**

---

## 1. Definitions

### Applicant
A parent or guardian who owns a user account in the system.

- Role: `applicant`
- May create and manage multiple applications — one per child per session
- Is **not** a camper and must never be counted as one
- Identified by `users.id` where `role = 'applicant'`

### Application
A submission for a specific child to attend a specific session.

**Lifecycle (ordered):**
```
draft → submitted → under_review → [approved | rejected | waitlisted | cancelled | withdrawn]
```

- Exists independently of camper enrollment status
- A child may appear in the system as part of an application without being an enrolled camper
- Identified by `applications.id`

### Camper
A child who has been **officially accepted and enrolled** into a session.

- Must only be recognized as enrolled when `application.status = 'approved'`
- The domain marker is `campers.is_active = true`
- `is_active = true` is set by `ApplicationService::updateStatus()` at the approval transition
- `is_active = false` is restored by the same service if approval is reversed
- Identified by `campers.id` **and** `campers.is_active = true`

---

## 2. The Enrollment Rule

> **A child becomes a Camper IF AND ONLY IF at least one of their Applications has `status = 'approved'`.**

No other state — draft, submitted, under_review, waitlisted — grants camper status.

This is enforced at the application layer by `ApplicationService` and reflected in the DB via `is_active`. There is no DB-level constraint because Camper rows must exist before approval to support the progressive application form (PATH B stub pattern, see below).

---

## 3. The Stub Pattern (PATH B)

When a parent starts a new application for a new child, the system creates a Camper stub immediately so the application form has a `camper_id` to write progressive section data against. This stub:

- Is created with `is_active = false`
- Has placeholder name `'New Camper'` until the parent fills in the child's details
- Is **not** an enrolled camper and must never appear in camper directories or counts
- Is cleaned up via cascade soft-delete if the draft is deleted (`ApplicationController::destroy()`)
- Is an implementation detail of the application UX, not a domain entity

---

## 4. Hard Rules

| Rule | Where enforced |
|------|---------------|
| `total_campers` in reports = `Camper::active()->count()` | `ReportController::summary()` |
| Camper Directory shows only enrolled campers | `CamperController::index()` admin path |
| Session `registered_campers` = approved applications only | `SessionDashboardController` |
| Session `registered_families` = families with non-draft applications | `SessionDashboardController` |
| Families summary `total_campers` = enrolled only | `FamilyController::index()` |
| Medical views filter by `Camper::active()` | `CamperController`, `MedicalStatsController`, `DocumentController` |
| Seeders backfill `is_active` after creating approved applications | `ApplicationSeeder::backfillIsActive()`, `EdgeCaseSeeder` |

---

## 5. Invalid States

These are bugs if found in a production database:

| State | Why invalid |
|-------|-------------|
| `campers.is_active = true` with no approved application | Orphaned activation — `is_active` was set without a valid approval |
| `campers.is_active = true` with only draft applications | Draft ≠ enrollment; deactivation was missed |
| Camper row with no applications at all | Orphaned stub — cleanup in `ApplicationController::destroy()` missed |
| `total_campers` count including `is_active = false` rows | Query violation — must use `Camper::active()` |

---

## 6. Correct Queries

```php
// All enrolled campers
Camper::active()->get();

// Enrolled campers for a specific session
Camper::active()
    ->whereHas('applications', fn ($q) => $q->where('camp_session_id', $sessionId)
        ->where('status', ApplicationStatus::Approved->value))
    ->get();

// Count enrolled campers
Camper::active()->count();

// Enrolled campers for a set of families
Camper::whereIn('user_id', $userIds)->where('is_active', true)->count();

// Session enrolled count (from applications side)
Application::where('camp_session_id', $id)
    ->where('status', ApplicationStatus::Approved->value)
    ->distinct()->count('camper_id');
```

---

## 7. Key Services

| Service | Responsibility |
|---------|---------------|
| `ApplicationService::updateStatus()` | The single entry point for all application status transitions. Sets/clears `camper.is_active` and `medicalRecord.is_active` at approval/reversal. |
| `ApplicationController::initializeDraft()` | Creates Camper stub (PATH B). Always `is_active=false`. |
| `ApplicationController::destroy()` | Cascades soft-delete to stub camper if last application deleted. |

---

## 8. Terminology Reference

| Term | Correct meaning | Never use for |
|------|----------------|--------------|
| Enrolled Camper | Child with `is_active=true` (approved application) | Children with pending/submitted applications |
| Applicant | Parent/guardian user account | The child |
| Registered Camper | Synonym for Enrolled Camper in UI labels | Children with submitted-but-not-approved apps |
| Child in System | Camper row regardless of enrollment | Do not use "camper" for this concept in UI |
| Active Application | Application with status `submitted` or `under_review` | Draft applications |
