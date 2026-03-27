# Camp Burnt Gin — Bug Tracker

**Created:** Phase 1 System Audit
**Last Updated:** 2026-03-26 — Form Full Parity Correction (BUG-127–BUG-134 added and resolved)
**Format:** Sequential ID | Title | Module | Severity | Status | Affected Files

---

## Reference Legends

### Severity

| Level | Definition |
|-------|------------|
| Critical | Broken functionality, security gap, or data integrity risk |
| High | Significant feature gap or workflow-blocking defect |
| Medium | Partial implementation, incorrect behavior, or missing secondary feature |
| Low | Minor inconsistency, stale code, or cosmetic issue |

### Status

| Status | Definition |
|--------|------------|
| Open | Identified; not yet resolved |
| In Progress | Actively being implemented |
| Resolved | Fixed and verified |

---

## Phase Resolution Overview

The table below maps each development phase to the bugs it resolved.

| Phase | Scope | Bugs Resolved |
|-------|-------|---------------|
| Phase 2 | Role rename, email verification, auth cleanup | BUG-001, BUG-002, BUG-003, BUG-004, BUG-006, BUG-008, BUG-012, BUG-017 |
| Phase 3 | Applicant portal, application form | BUG-009, BUG-010, BUG-011 |
| Phase 4 | Profile system expansion | BUG-014 |
| Phase 5 | Admin portal, camper detail, routing | BUG-005, BUG-019, BUG-020, BUG-022, BUG-023, BUG-029, BUG-035, BUG-036, BUG-037, BUG-038, BUG-039, BUG-040, BUG-041, BUG-042, BUG-043, BUG-044, BUG-045, BUG-047, BUG-048 |
| Phase 6 | Medical portal write capabilities | BUG-007, BUG-028, BUG-034 |
| Phase 7 | Notifications, Recent Updates | BUG-018, BUG-027 |
| Phase 8 | Inbox / messaging restructure | BUG-015, BUG-016 |
| Phase 9 | Audit log redesign | BUG-013 |
| Phase 10 | Documentation update | BUG-025, BUG-026 |
| Post Phase 8 | Inbox/messaging corrections | BUG-049, BUG-050 |
| Post Phase 9 | Auth and UI corrections | BUG-051, BUG-052, BUG-053 |
| Post Phase 13 | Application submission corrections | BUG-054, BUG-055, BUG-056 |
| Phase 14 | Form Builder security | BUG-057, BUG-058, BUG-059, BUG-060, BUG-061 |
| System Audit 2026-03-19 | Full system audit + hardening | BUG-073, BUG-102, BUG-103, BUG-104, BUG-105 |
| Workflow Audit 2026-03-24 | Deep workflow audit — capacity gate, scope leak, orphan files, notifications, XSS | BUG-106, BUG-107, BUG-108, BUG-109, BUG-110 |
| Application Lifecycle Audit 2026-03-24 | Approval/reversal architecture — activation, deactivation, transaction safety, audit log, transition validation | BUG-111, BUG-112, BUG-113, BUG-114, BUG-115, BUG-116, BUG-117, BUG-118 |
| Application Form Ecosystem 2026-03-26 | TypeScript type gaps, API contract mismatch, upload status tracking, official forms checklist, staff profile nav | BUG-119–BUG-126 |
| Form Full Parity Correction 2026-03-26 | Missing Guardian 2 address/phones, EC address/phones/language, health flags, behavioral flags + descriptions, app meta, 2nd session, bowel irregularity, 2 missing consents | BUG-127–BUG-134 |

---

## Master Index

| ID | Title | Module | Severity | Status |
|----|-------|--------|----------|--------|
| BUG-001 | Role name "parent" used throughout — must be renamed to "Applicant" | Role Naming / RBAC | High | Resolved |
| BUG-002 | Email verification system not implemented | Email Verification | Critical | Resolved |
| BUG-003 | Stale duplicate PasswordResetService at wrong namespace | Password Reset | Low | Resolved |
| BUG-004 | Account deactivation incorrectly repurposes email_verified_at | User Management | High | Resolved |
| BUG-005 | Broken routes — Admin/Super Admin camper detail and risk pages | Admin — Camper Management | Critical | Resolved |
| BUG-006 | Frontend role-based routing not enforced — RoleGuard never used | RBAC / Routing | High | Resolved |
| BUG-007 | Medical portal is read-only — no write capabilities for medical staff | Medical Portal | Critical | Resolved |
| BUG-008 | External medical provider upload link system should be removed | Medical Workflow | High | Resolved |
| BUG-009 | Applicant portal has no standalone Documents section | Applicant Portal | High | Resolved |
| BUG-010 | ApplicationFormPage header comment incorrectly states sections 6–10 not implemented | Application Form | Low | Resolved |
| BUG-011 | No explicit "Save Draft" button — draft behavior implicit only | Application Form | Medium | Resolved |
| BUG-012 | Seeder conflict — DatabaseSeeder and DevSeeder create conflicting accounts | Seeders | Medium | Resolved |
| BUG-013 | Audit log displays raw vague action names — not human-readable | Audit Log | High | Resolved |
| BUG-014 | Profile system is minimal — missing most fields from Phase 4 requirements | Profile System | High | Resolved |
| BUG-015 | Inbox starred state persisted only in localStorage, not backend | Inbox / Messaging | Medium | Resolved |
| BUG-016 | Inbox missing: Drafts, Sent, Trash, Scheduled send, Important folder | Inbox / Messaging | High | Resolved |
| BUG-017 | Inbox imports Bot icon — AI reference should not appear in UI | Inbox / Messaging | Low | Resolved |
| BUG-018 | Recent Updates system does not exist as a distinct feature | Recent Updates | Medium | Resolved |
| BUG-019 | Super Admin dashboard quick links point to /admin/* routes | Super Admin Portal | Medium | Resolved |
| BUG-020 | Form Management session assignment uses raw ID input, no session picker | Form Management | Medium | Resolved |
| BUG-021 | Form Management files stored on local disk — not accessible in production | Form Management | High | Open |
| BUG-022 | Report downloads load only page 1 of applications for chart data | Admin Reports | High | Resolved |
| BUG-023 | AdminReportsPage imports stale/non-standard motion variant names | Admin Reports | Low | Resolved |
| BUG-024 | Password reset sends no confirmation email | Password Reset | Medium | Open |
| BUG-025 | No CODEBASE_GUIDE.md exists | Documentation | Medium | Resolved |
| BUG-026 | Documentation does not reflect current system state | Documentation | Medium | Resolved |
| BUG-027 | Notification settings toggles — race condition and missing channel controls | Notification Settings | Medium | Resolved |
| BUG-028 | Medical portal has no route or UI for document upload or treatment recording | Medical Portal | Critical | Resolved |
| BUG-029 | Camper detail page missing — /admin/campers/:id leads to 404 | Admin — Camper Management | Critical | Resolved |
| BUG-030 | Applicant portal has no past applications history with filter/sort | Applicant Portal | Medium | Open |
| BUG-031 | Password change uses min 8 chars; password reset requires 12+ with complexity | Security | Medium | Resolved |
| BUG-032 | SettingsPage password form validates min 8 chars — inconsistent with reset policy | Security | Medium | Resolved |
| BUG-033 | Super Admin user management role filter uses raw slugs, not user-friendly labels | Super Admin — User Management | Low | Open |
| BUG-034 | Medical portal inbox missing — no /medical/inbox route | Medical Portal | Medium | Resolved |
| BUG-035 | ApplicationReviewPage back link hardcoded to /admin/applications | Admin / Super Admin | Low | Resolved |
| BUG-036 | Profile Settings actions log out user — stale token not rehydrated before validation | Profile System / Auth | Critical | Resolved |
| BUG-037 | Super Admin can delete their own account — no role restriction on endpoint | Profile System / Security | Critical | Resolved |
| BUG-038 | Application review page shows "Unknown Camper", literal i18n keys, and no medical data | Admin — Application Review | Critical | Resolved |
| BUG-039 | Application list shows "Session #undefined" — wrong JSON key and TypeScript type | Admin — Application List | High | Resolved |
| BUG-040 | Profile save / avatar actions log user out — setUser overwrites roles array | Profile System / Auth | Critical | Resolved |
| BUG-041 | Avatar upload fails — axios instance overrides multipart/form-data Content-Type | Profile System | High | Resolved |
| BUG-042 | Campers list shows raw ISO 8601 date — date_of_birth not formatted | Admin — Camper Management | Medium | Resolved |
| BUG-043 | "View Risk" link routes to 404 — /admin/campers/:id/risk not defined | Admin — Camper Management | High | Resolved |
| BUG-044 | Login page shows two password reveal icons — browser native conflicts with custom button | Auth — Login Page | Low | Resolved |
| BUG-045 | Login redirects back to /login after success — stale token validation races fresh login | Auth — Login | Critical | Resolved |
| BUG-046 | Applicant login broken — blocking issue | Auth — Applicant Login | Critical | Resolved |
| BUG-047 | CamperDetailPage uses camper.t_shirt_size — property does not exist on Camper type | Admin — Camper Management | Medium | Resolved |
| BUG-048 | Portal context links broken — AdminApplicationsPage and AdminCampersPage hardcode /admin/* | Admin / Super Admin | High | Resolved |
| BUG-049 | Applicant cannot send messages to super_admin — hasNonAdminParticipants check too narrow | Inbox / Messaging — RBAC | High | Resolved |
| BUG-050 | Inbox folder switching shows brief blank/skeleton flash | Inbox / Messaging — UI | Medium | Resolved |
| BUG-051 | Page refresh logs user out — useAuthInit reads localStorage but token is in sessionStorage | Auth — Session Persistence | Critical | Resolved |
| BUG-052 | "Under Review" application status badge is green — should be yellow | UI — Status Badges | Low | Resolved |
| BUG-053 | "Pending" application status badge is green — should be grey | UI — Status Badges | Low | Resolved |
| BUG-054 | Application submission fails — signApplication omits signature_data; duplicate campers on retry | Applicant Portal — Application Form | Critical | Resolved |
| BUG-055 | Document upload fails for PNG files — image/x-png not in allowed MIME type list | Document Upload | High | Resolved |
| BUG-056 | Message attachments sent via Compose not visible to recipient | Inbox / Messaging | High | Resolved |
| BUG-057 | FormSectionController store() and update() had no authorization | Form Builder — Backend | Critical | Resolved |
| BUG-058 | FormSectionController reorder() did not scope batch UPDATE to the request's definition | Form Builder — Backend | High | Resolved |
| BUG-059 | FormFieldController store() and update() had no authorization | Form Builder — Backend | Critical | Resolved |
| BUG-060 | FormFieldController reorder() used firstOrNew() for authorization; unscoped batch UPDATE | Form Builder — Backend | High | Resolved |
| BUG-061 | FormFieldOptionController had no authorization on index(), store(), and update() | Form Builder — Backend | Critical | Resolved |
| BUG-062 | Backend test failure — TokenExpirationTest fails when SANCTUM_EXPIRATION=null in .env | Auth — Login / Session | High | Resolved |
| BUG-063 | Page-open animation glitch — content briefly appears at full opacity then disappears on each navigation | UI — Layout | High | Resolved |
| BUG-064 | 188 ESLint errors — accessibility violations and missing React type imports across frontend | Frontend — Multiple | Medium | Resolved |
| BUG-065 | FormDefinitionPolicy::view() exposes draft form definitions to all authenticated users | Security — Form Builder | Critical | Resolved |
| BUG-066 | FormSectionController — section not scoped to parent form in URL (IDOR) | Security — Form Builder | High | Resolved |
| BUG-067 | FormFieldController — field not scoped to parent section in URL (IDOR) | Security — Form Builder | High | Resolved |
| BUG-068 | FormFieldOptionController — option not scoped to parent field in URL (IDOR) | Security — Form Builder | High | Resolved |
| BUG-069 | MedicalRestrictionPolicy::delete() permits medical providers to permanently delete restrictions | Security — Medical Portal | Medium | Resolved |
| BUG-070 | DocumentPolicy::view() medical provider check unreachable — providers blocked from authorized documents | Security — Document Access Control | High | Resolved |
| BUG-071 | Announcement update/destroy routes lacked admin middleware — route-level enforcement gap | Security — Announcements | High | Resolved |
| BUG-072 | RateLimitingTest MFA assertion incorrect — test asserted wrong effective rate limit | Backend Tests — Security | Low | Resolved |
| BUG-073 | DocumentRequestController lacks a dedicated Policy class — no second layer of authorization | Security — Document Requests | Low | Resolved |
| BUG-074 | All FormData uploads broken — explicit Content-Type header omits boundary, Laravel rejects multipart body | Frontend — File Uploads | Critical | Resolved |
| BUG-075 | Auth token stored in sessionStorage — causes logout on every page refresh across all portals | Auth — Token Storage | Critical | Resolved |
| BUG-076 | Admin Campers page shows "Failed to load data" — CamperController::index() eager-loads encrypted PHI | Admin Portal — Campers | Critical | Resolved |
| BUG-077 | Admin Applications page shows "Failed to load data" — ApplicationController::index() eager-loads encrypted PHI | Admin Portal — Applications | Critical | Resolved |
| BUG-078 | Admin Reports shows 0 accepted applications — ReportController uses key 'accepted' but enum value is 'approved' | Admin Portal — Reports | High | Resolved |
| BUG-079 | Wrong MFA code triggers global logout — `/mfa/` not in `isPublicAuthEndpoint` list in axios interceptor | Auth — MFA | High | Resolved |
| BUG-080 | Admin/super-admin portal switches to applicant portal when idle — `AdminLayout`/`SuperAdminLayout` redirect to `getDashboardRoute(role)` on access denial, which resolves to `/applicant/dashboard` when Redux role is stale | Auth — Layout Guards | Critical | Resolved |
| BUG-081 | Campers page search causes 500 — `CamperController::index()` uses `full_name` in SQL WHERE clause but `full_name` is a virtual computed attribute with no backing DB column | Admin Portal — Campers | Critical | Resolved |
| BUG-082 | `RoleGuard` redirects authenticated users with missing role data to `/login`, causing a redirect loop with `ProtectedRoute` | Auth — RBAC | High | Resolved |
| BUG-099 | Admin Campers page "Failed to load data" — `ApplicationStatus` PHP enum missing `Waitlisted` case causes `ValueError` on any endpoint loading applications with `waitlisted` status | Admin Portal — Applications | Critical | Resolved |
| BUG-100 | `SessionDetailPage` 404 — `SessionDashboardController` routes (`GET /sessions/{id}/dashboard`, `GET /sessions/{id}/applications`, `POST /sessions/{id}/archive`) never registered in `api.php` | Admin Portal — Sessions | Critical | Resolved |
| BUG-101 | `CampSessionController::destroy()` permits deletion of sessions with applications; `archive()` action missing entirely | Admin Portal — Sessions | High | Resolved |
| BUG-106 | `ApplicationService::reviewApplication()` missing capacity gate — admin can approve beyond session capacity | Admin Portal — Application Review | Critical | Resolved |
| BUG-107 | `ApplicationController::index()` search uses top-level `orWhereHas` — OR bypasses status/session/is_draft filters, leaking cross-session data | Admin Portal — Applications | High | Resolved |
| BUG-108 | `DocumentRequestController::reject()` clears DB path fields but never deletes the uploaded file from disk — orphaned files accumulate | Document Requests | Medium | Resolved |
| BUG-109 | `ApplicationController::update()` missing inbox system notification when draft is promoted to submitted — email fires but inbox message does not | Applicant Portal — Application Form | Medium | Resolved |
| BUG-110 | `SystemNotificationService::applicationRejected()` embeds reviewer notes in HTML without `e()` escaping — stored XSS vector for admin-injected markup in applicant inbox | Security — Notifications | Low | Resolved |
| BUG-111 | `campers` table has no `is_active` column — reversal leaves camper visible on all operational rosters | Application Lifecycle | Critical | Resolved |
| BUG-112 | `medical_records` table has no `is_active` column — reversal leaves medical record visible to medical staff | Application Lifecycle | Critical | Resolved |
| BUG-113 | `ApplicationService::reviewApplication()` has no `DB::transaction()` — partial failure can leave application, camper, and medical record in inconsistent state | Application Lifecycle | Critical | Resolved |
| BUG-114 | No deactivation logic on reversal (`Approved → Rejected`) — camper and medical record remain active after reversal | Application Lifecycle | Critical | Resolved |
| BUG-115 | No state transition validation in `ApplicationService` — any status can transition to any other without guards | Application Lifecycle | High | Resolved |
| BUG-116 | No audit log entry written for application review decisions — approval, rejection, and reversal actions are unlogged | Application Lifecycle | High | Resolved |
| BUG-117 | `CamperController::index()` medical branch has no `is_active` filter — medical staff see all campers regardless of enrollment status | Medical Portal | High | Resolved |
| BUG-118 | `MedicalRecordController::index()` has no `is_active` filter — all medical records returned to medical staff regardless of camper enrollment status | Medical Portal | High | Resolved |
| BUG-119 | `Application` type in `admin.types.ts` missing 8 narrative fields — `EditNarrativesPanel` required unsafe cast | TypeScript / Types | Medium | Resolved |
| BUG-120 | `ApplicantApplicationsPage` statusFilter typed as `ApplicationStatus \| ''` but uses `'draft'` as a UI-only filter value — TS2367 | TypeScript / Types | Low | Resolved |
| BUG-121 | `StatusBadge` `BadgeVariant` extended `ApplicationStatus` which no longer includes `'draft'` — TS2353/TS2339 | TypeScript / Types | Low | Resolved |
| BUG-122 | `ApplicantOfficialFormsPage` used `variant="outline"` — not a valid `ButtonVariant` value — TS2322 | TypeScript / Types | Low | Resolved |
| BUG-123 | `OfficialFormType::toApiArray()` returned `type` key; frontend `OfficialFormTemplate` interface expected `id` — API/type contract mismatch | Backend / Frontend Alignment | High | Resolved |
| BUG-124 | `ApplicantOfficialFormsPage` always initialized upload cards as `idle` — existing uploads not reflected on page load | Applicant Portal — Official Forms | High | Resolved |
| BUG-125 | `ApplicationReviewPage` had no official forms checklist — admins could not see which required forms were uploaded vs. missing | Admin Portal — Application Review | Medium | Resolved |
| BUG-126 | Admin and super-admin sidebars missing "My Profile" nav item — credential/profile update page not reachable from staff portals | Admin Portal / Super-Admin Portal | Medium | Resolved |
| BUG-127 | Guardian 2 in digital form had only name + one phone — official form requires full address + 3 phones + language/interpreter | ApplicationFormPage — Section 1 | High | Resolved |
| BUG-128 | Emergency contact in digital form had only name, relationship, one phone — official form requires full address + 3 phones + language/interpreter | ApplicationFormPage — Section 1 | High | Resolved |
| BUG-129 | Digital form had no 2nd-choice session selection — official form explicitly provides this | ApplicationFormPage — Section 1 | Medium | Resolved |
| BUG-130 | Digital form had no "first application / attended before" checkboxes — official form has these as required fields | ApplicationFormPage — Section 1 | Medium | Resolved |
| BUG-131 | Camper mailing address not captured in digital form — official form (0717) has a dedicated applicant mailing address block | ApplicationFormPage — Section 1 | Medium | Resolved |
| BUG-132 | Health flags (tubes in ears, contagious illness + description, recent illness + description) were in backend schema but missing from FormState and Section 2 UI | ApplicationFormPage — Section 2 | High | Resolved |
| BUG-133 | Behavioral profile missing 5 new boolean flags (sexual_behaviors, interpersonal_behavior, social_emotional, follows_instructions, group_participation), attends_school, classroom_type, and all per-item description fields — present on official PDF | ApplicationFormPage — Section 3 | High | Resolved |
| BUG-134 | Section 10 was missing "General Consent" (#1) and "Permission to Participate in Activities" (#4) from CONSENT_DEFS — these are explicit PDF consent items; only 5 of 7 required consents were shown | ApplicationFormPage — Section 10 | Critical | Resolved |

---

## Issues

---

### BUG-001

**Title:** Role name "parent" used throughout — must be renamed to "Applicant"
**Module:** Role Naming / RBAC
**Severity:** High
**Status:** Resolved — Phase 2

**Description:**
The system-wide role name `parent` is used in the database seeder, Role model seed data, AuthService registration, User model methods (`isParent()`), all `/parent/` route prefixes, frontend layout components, route guards, and i18n keys. The intended user-facing label is "Applicant." All occurrences must be consistently updated.

**Affected Files:**
- `backend/.../database/seeders/RoleSeeder.php`
- `backend/.../database/seeders/DatabaseSeeder.php`
- `backend/.../database/seeders/DevSeeder.php`
- `backend/.../app/Services/Auth/AuthService.php`
- `backend/.../app/Models/User.php` (`isParent()` method)
- `backend/.../app/Http/Controllers/Api/System/UserController.php` (fallback `'parent'` string)
- `frontend/src/core/routing/index.tsx` (all `/parent/` paths)
- `frontend/src/ui/layout/ParentLayout.tsx`
- `frontend/src/features/parent/` (entire directory naming)
- `frontend/src/shared/constants/roles.ts`
- `docs/backend/ROLES_AND_PERMISSIONS.md`

---

### BUG-002

**Title:** Email verification system not implemented — MustVerifyEmail commented out
**Module:** Email Verification
**Severity:** Critical
**Status:** Resolved — Phase 2

**Description:**
The `User` model has `MustVerifyEmail` commented out. There is no email verification token generation, no verification email, no `/auth/verify-email` route, and no middleware enforcing verified status before granting access. The `email_verified_at` column exists in the DB but is never set by an email verification flow. The ProfilePage shows "Verified / Not verified" status but there is no way for a user to trigger a verification email.

**Affected Files:**
- `backend/.../app/Models/User.php` (MustVerifyEmail commented out)
- `backend/.../app/Http/Controllers/Api/Auth/AuthController.php` (no verify step after register)
- `backend/.../routes/api.php` (no verify-email route)
- `backend/.../app/Notifications/Auth/` (no verification notification)
- `frontend/src/features/auth/api/auth.api.ts`
- `frontend/src/features/profile/pages/ProfilePage.tsx` (shows badge but no resend action)

---

### BUG-003

**Title:** Stale duplicate PasswordResetService at wrong namespace
**Module:** Password Reset
**Severity:** Low
**Status:** Resolved — Phase 2

**Description:**
A duplicate `PasswordResetService.php` exists at `app/Services/PasswordResetService.php` (namespace `App\Services`) in addition to the correct file at `app/Services/Auth/PasswordResetService.php` (namespace `App\Services\Auth`). The controller correctly imports the `Auth\` version. The root-level copy is stale dead code and should be removed to prevent confusion.

**Affected Files:**
- `backend/.../app/Services/PasswordResetService.php` (stale — should be deleted)

---

### BUG-004

**Title:** Account deactivation incorrectly repurposes email_verified_at
**Module:** User Management / Email Verification
**Severity:** High
**Status:** Resolved — Phase 2

**Description:**
`UserController::deactivate()` sets `email_verified_at = null` to deactivate a user, and `reactivate()` sets `email_verified_at = now()`. This conflates email verification state with account activation state. A user who has not verified their email and a user who has been admin-deactivated are indistinguishable in the database. A dedicated `is_active` boolean column is required.

**Affected Files:**
- `backend/.../app/Http/Controllers/Api/System/UserController.php`
- `backend/.../database/migrations/` (migration needed for `is_active` column)
- `backend/.../app/Models/User.php`

---

### BUG-005

**Title:** Broken routes — Admin/Super Admin camper detail and risk pages do not exist
**Module:** Admin — Camper Management
**Severity:** Critical
**Status:** Resolved — Phase 5

**Description:**
`AdminCampersPage` rendered two links per camper row: `Link to="/admin/campers/${camper.id}"` (view) and `Link to="/admin/campers/${camper.id}/risk"` (risk summary). Neither route was defined in `core/routing/index.tsx`. Clicking either link resulted in a 404/NotFoundPage. No camper detail page component existed in the codebase.

**Resolution:**
`CamperDetailPage.tsx` was created and registered at `/admin/campers/:id` and `/super-admin/campers/:id`. The `/risk` route was removed; risk and medical data is displayed inline within CamperDetailPage.

**Affected Files:**
- `frontend/src/core/routing/index.tsx`
- `frontend/src/features/admin/pages/CamperDetailPage.tsx`
- `frontend/src/features/admin/pages/AdminCampersPage.tsx`

---

### BUG-006

**Title:** Frontend role-based routing not enforced — RoleGuard defined but never used
**Module:** RBAC / Routing
**Severity:** High
**Status:** Resolved — Phase 2

**Description:**
`RoleGuard.tsx` is defined but is not applied to any route in `core/routing/index.tsx`. `ProtectedRoute` only checks authentication; it does not enforce role-appropriate portal access. A user with the `applicant` role can manually navigate to `/admin/dashboard` or `/super-admin/audit` and the route will render. Backend policies prevent data access, but the frontend renders the wrong portal shell, potentially exposing UI structure intended for admins.

**Affected Files:**
- `frontend/src/core/routing/index.tsx` (RoleGuard not applied)
- `frontend/src/core/auth/RoleGuard.tsx` (defined but unused)
- `frontend/src/core/auth/ProtectedRoute.tsx`

---

### BUG-007

**Title:** Medical portal is read-only — no write capabilities for on-site medical staff
**Module:** Medical Portal
**Severity:** Critical
**Status:** Resolved — Phase 6

**Description:**
The medical portal (`/medical`) is entirely read-only. Medical staff can browse camper medical records but cannot update records, upload medical documents, record treatments or interventions, log medication administrations, or track real-time medical events during camp. For an on-site camp medical team, this renders the portal non-functional as a clinical tool. The backend has write endpoints for medical data but they are not surfaced in the medical portal UI.

**Resolution:**
All 9 medical policies updated to remove the `MedicalProviderLink` gate — camp medical staff (`medical` role) now have direct read/write access to all camper medical records without requiring individual provider links. `MedicalRecordPage` rebuilt with full inline add/edit modals for allergies, medications, diagnoses, behavioral profiles, feeding plans, assistive devices, and activity permissions. `medical.api.ts` expanded with complete write operations.

**Affected Files:**
- `frontend/src/features/medical/pages/MedicalRecordPage.tsx`
- `frontend/src/features/medical/api/medical.api.ts`
- `backend/camp-burnt-gin-api/app/Policies/MedicalRecordPolicy.php`
- `backend/camp-burnt-gin-api/app/Policies/AllergyPolicy.php`
- `backend/camp-burnt-gin-api/app/Policies/MedicationPolicy.php`
- `backend/camp-burnt-gin-api/app/Policies/DiagnosisPolicy.php`
- `backend/camp-burnt-gin-api/app/Policies/BehavioralProfilePolicy.php`
- `backend/camp-burnt-gin-api/app/Policies/FeedingPlanPolicy.php`
- `backend/camp-burnt-gin-api/app/Policies/AssistiveDevicePolicy.php`
- `backend/camp-burnt-gin-api/app/Policies/ActivityPermissionPolicy.php`
- `backend/camp-burnt-gin-api/app/Policies/EmergencyContactPolicy.php`

---

### BUG-008

**Title:** External medical provider upload link system should be removed
**Module:** Medical Workflow / Provider Links
**Severity:** High
**Status:** Resolved — Phase 2

**Description:**
The system has a `/provider-access/:token` route and a full `MedicalProviderLinkController` that allows external providers to access and upload medical forms via secure expiring tokens. Per Phase 2 requirements, all medical document uploads must occur through the Medical Portal for camp medical staff only. The provider link system creates an external access vector that is outside the intended scope.

**Affected Files:**
- `backend/.../routes/api.php` (provider-access routes)
- `backend/.../app/Http/Controllers/Api/Document/MedicalProviderLinkController.php`
- `backend/.../app/Models/MedicalProviderLink.php`
- `backend/.../app/Notifications/Medical/` (provider link notifications)
- `frontend/src/features/provider/pages/ProviderAccessPage.tsx`
- `frontend/src/core/routing/index.tsx` (provider-access route)

---

### BUG-009

**Title:** Applicant portal has no standalone Documents section
**Module:** Applicant Portal — Documents
**Severity:** High
**Status:** Resolved — Phase 3

**Description:**
There is no `/applicant/documents` route or page. Applicants cannot upload, manage, or review documents independently of the application form. Documents are only visible inside the application detail view as read-only. The application form (Section 9) handles document uploads inline but there is no persistent document management area for applicants.

**Resolution:**
Created `ApplicantDocumentsPage.tsx` at `/applicant/documents` with upload (drag-and-drop), PDF/image preview modal, and delete. Added `getDocuments`, `deleteDocument`, and `uploadDocument` to `parent.api.ts`. Added route and "Documents" nav item to `ParentLayout`.

**Affected Files:**
- `frontend/src/core/routing/index.tsx`
- `frontend/src/features/parent/pages/ApplicantDocumentsPage.tsx`
- `frontend/src/features/parent/api/parent.api.ts`
- `frontend/src/ui/layout/ParentLayout.tsx`
- `frontend/src/shared/constants/routes.ts`

---

### BUG-010

**Title:** ApplicationFormPage header comment incorrectly states sections 6–10 are not yet implemented
**Module:** Applicant — Application Form
**Severity:** Low
**Status:** Resolved — Phase 3

**Description:**
The file comment at the top of `ApplicationFormPage.tsx` states "Phase 1 (current): Scaffold + Sections 1–5" and "Phase 2: Sections 6–10 + submission guard + final API submit." In fact, all 10 sections are fully defined in `FormState` and rendered in the file, and `handleSubmit()` exists with full submit logic. The comment is stale and misleading.

**Resolution:**
Removed stale Phase 1/2 header comments. Removed `phase` field from `SectionDef` and the `SECTIONS` array. Removed dead `if (s.phase === 2) return 'unavailable'` guard from `getSectionStatus`. Updated route comment to `/applicant/applications/new`.

**Affected Files:**
- `frontend/src/features/parent/pages/ApplicationFormPage.tsx`

---

### BUG-011

**Title:** No explicit "Save Draft" button — draft behavior is implicit auto-save only
**Module:** Applicant — Application Form
**Severity:** Medium
**Status:** Resolved — Phase 3

**Description:**
The application form auto-saves to localStorage every 3 seconds but there is no visible "Save Draft" button. Users may be unsure whether progress is persisted. An explicit Save Draft button is required per Phase 3 requirements.

**Resolution:**
Added `handleSaveDraft()` function and a "Save Draft" `Button` (variant="secondary") in the page header. Triggers immediate `persistDraft(form)` and a success toast. Auto-save remains intact.

**Affected Files:**
- `frontend/src/features/parent/pages/ApplicationFormPage.tsx`

---

### BUG-012

**Title:** Seeder conflict — DatabaseSeeder and DevSeeder both create admin@example.com and medical@example.com with different names
**Module:** Seeders
**Severity:** Medium
**Status:** Resolved — Phase 2

**Description:**
`DatabaseSeeder` creates `admin@example.com` with name "Test Admin" and `medical@example.com` with name "Test Medical Staff" before calling `DevSeeder`. `DevSeeder` attempts to create the same emails with names "Alex Rivera" and "Dr. Morgan Chen" using `firstOrCreate`. Because `DatabaseSeeder` runs first, `DevSeeder`'s `firstOrCreate` finds existing records and skips creation — the demo-quality names are never applied. Development environments end up with generic "Test Admin" names instead of the intended realistic demo data.

**Affected Files:**
- `backend/.../database/seeders/DatabaseSeeder.php`
- `backend/.../database/seeders/DevSeeder.php`

---

### BUG-013

**Title:** Audit log displays raw vague action names — not human-readable
**Module:** Super Admin — Audit Log
**Severity:** High
**Status:** Resolved — Phase 9

**Description:**
The audit log UI displays raw action strings such as `view`, `update`, `delete`, `created`, and `reviewed` with no human-readable context. There are no human-readable event descriptions, no before/after values for updates, no event categories, no expandable detail panels, and no export functionality. Filtering is limited to search text and date range with no action type or category filter.

**Resolution:**
- `AuditLogController` expanded: `human_description` field generated server-side, `category` mapped from `event_type`, `entity_label` added, export endpoint `GET /audit-log/export?format=csv|json` added (5,000 row cap)
- Filters expanded to include `event_type` and `entity_type`
- `AuditLogPage.tsx` fully redesigned: timeline view, category badges with icons, expandable detail panels (before/after values, metadata, user agent), CSV/JSON export buttons, improved pagination, collapsible filter panel
- `AuditLogEntry` type expanded with all new fields
- `getAuditLog` and `exportAuditLog` API functions updated

**Affected Files:**
- `frontend/src/features/superadmin/pages/AuditLogPage.tsx`
- `frontend/src/features/admin/types/admin.types.ts`
- `frontend/src/features/admin/api/admin.api.ts`
- `backend/.../app/Http/Controllers/Api/System/AuditLogController.php`
- `backend/.../routes/api.php`

---

### BUG-014

**Title:** Profile system is minimal — missing most fields from Phase 4 requirements
**Module:** Profile System
**Severity:** High
**Status:** Resolved — Phase 4

**Description:**
The current `ProfilePage` only supports name, email update, and MFA setup/disable. Missing features: profile photo/avatar, preferred name, phone number, date of birth, contact address, emergency contacts management, privacy settings, language/locale settings, account activity log (login history), data export, and account deletion. The `SettingsPage` only has appearance, security (password), and notifications tabs. Role-specific settings are entirely absent.

**Resolution:**
- Added migration for profile fields: `preferred_name`, `phone`, `avatar_path`, `address_line_1`, `address_line_2`, `city`, `state`, `postal_code`, `country`
- Added migration and model for `user_emergency_contacts` table
- Expanded `UserProfileController` with: `uploadAvatar`, `removeAvatar`, `listEmergencyContacts`, `storeEmergencyContact`, `updateEmergencyContact`, `destroyEmergencyContact`, `requestDataExport`, `deleteAccount`
- Updated `User` model fillable and `userEmergencyContacts()` relationship
- Added `UserEmergencyContactPolicy` and registered in `AppServiceProvider`
- Added new profile API routes: `POST /profile/avatar`, `DELETE /profile/avatar`, CRUD `/profile/emergency-contacts`, `POST /profile/data-export`, `DELETE /profile/account`
- Expanded `ProfilePage.tsx`: avatar upload/remove, preferred name, phone, full address form, emergency contacts manager (add/edit/delete/set primary)
- Added "Data and Account" tab to `SettingsPage.tsx`: data export request and account deletion with password confirmation
- Updated `profile.api.ts` and `user.types.ts` with all new types and functions

**Affected Files:**
- `frontend/src/features/profile/pages/ProfilePage.tsx`
- `frontend/src/features/profile/pages/SettingsPage.tsx`
- `frontend/src/features/profile/api/profile.api.ts`
- `frontend/src/shared/types/user.types.ts`
- `backend/.../app/Http/Controllers/Api/Camper/UserProfileController.php`
- `backend/.../app/Models/User.php`
- `backend/.../app/Models/UserEmergencyContact.php`
- `backend/.../app/Policies/UserEmergencyContactPolicy.php`
- `backend/.../app/Providers/AppServiceProvider.php`
- `backend/.../database/migrations/2026_03_06_000002_add_profile_fields_to_users_table.php`
- `backend/.../database/migrations/2026_03_06_000003_create_user_emergency_contacts_table.php`
- `backend/.../routes/api.php`

---

### BUG-015

**Title:** Inbox starred state persisted only in localStorage, not the backend
**Module:** Inbox / Messaging
**Severity:** Medium
**Status:** Resolved — Phase 8

**Description:**
Starred conversations are tracked via a `Set<number>` stored in `localStorage` under key `inbox_starred_ids`. Stars are not persisted to the backend database, so the state is lost on logout or in a different browser.

**Resolution:**
Phase 8 migration added `is_starred`, `is_important`, and `trashed_at` columns to `conversation_participants`. `InboxService` now toggles these per-user in the database.

> **Note:** Requires `php artisan migrate` to apply the Phase 8 schema.

**Affected Files:**
- `frontend/src/features/messaging/pages/InboxPage.tsx`
- `backend/.../database/migrations/2026_03_06_000001_add_per_user_state_to_conversation_participants_table.php`

---

### BUG-016

**Title:** Inbox missing: Drafts, Sent, Trash (with restore), Scheduled send, and Important folder
**Module:** Inbox / Messaging
**Severity:** High
**Status:** Resolved — Phase 8

**Description:**
The inbox UI had tabs for: All, Applicants, Medical Team, System, Announcements, and Archive. Missing folders per Phase 8 requirements: Starred, Important, Sent, Drafts, Trash with restore, and Scheduled send. The layout was two-panel rather than the required three-panel.

**Resolution:**
Phase 8 delivered a full three-pane Gmail-style inbox with all 8 folders, per-user state, bulk actions, rich text editor, floating compose, and thread viewer.

> **Note:** Requires `php artisan migrate` to apply the Phase 8 schema.

**Affected Files:**
- `frontend/src/features/messaging/pages/InboxPage.tsx`
- `frontend/src/features/messaging/api/messaging.api.ts`
- `backend/.../database/migrations/2026_03_06_000001_add_per_user_state_to_conversation_participants_table.php`

---

### BUG-017

**Title:** Inbox imports Bot icon — AI reference should not appear in the UI
**Module:** Inbox / Messaging
**Severity:** Low
**Status:** Resolved — Phase 2

**Description:**
`InboxPage.tsx` imports `Bot` from `lucide-react`. Per project conventions, no AI-related references should appear in the repository UI. This import must be removed.

**Affected Files:**
- `frontend/src/features/messaging/pages/InboxPage.tsx`

---

### BUG-018

**Title:** Recent Updates system does not exist as a distinct feature
**Module:** Recent Updates
**Severity:** Medium
**Status:** Resolved — Phase 7

**Description:**
There is no standalone "Recent Updates" or "Activity Feed" module. Admin and applicant dashboards show notifications and review queues but no component that communicates what changed, who changed it, and when in a clear chronological format.

**Resolution:**
The applicant dashboard's "Recent Updates" widget was rebuilt to show human-readable notification titles, body messages, notification-type icons, relative timestamps, unread indicators, per-item mark-as-read on click, and a "Mark all read" shortcut. All notification `toArray()` methods were updated to include `title` and `message` fields. `NotificationController::index()` now unwraps these from the `data` column before returning them to the frontend. `Notification.id` type was corrected to `string` (UUID).

**Affected Files:**
- `frontend/src/features/parent/pages/ApplicantDashboardPage.tsx`
- `frontend/src/ui/components/NotificationPanel.tsx`
- `frontend/src/shared/types/camp.types.ts`
- `backend/.../app/Http/Controllers/Api/System/NotificationController.php`
- `backend/.../app/Notifications/Camper/ApplicationStatusChangedNotification.php`
- `backend/.../app/Notifications/Camper/ApplicationSubmittedNotification.php`
- `backend/.../app/Notifications/NewMessageNotification.php`
- `backend/.../app/Notifications/NewConversationNotification.php`

---

### BUG-019

**Title:** Super Admin dashboard quick links point to /admin/* routes — not /super-admin/*
**Module:** Super Admin Portal
**Severity:** Medium
**Status:** Resolved — Phase 5

**Description:**
`SuperAdminDashboardPage` had quick links to `/admin/applications` and `/admin/campers`, rendering the AdminLayout shell instead of SuperAdminLayout for super admin users.

**Resolution:**
Updated `QUICK_LINKS` in `SuperAdminDashboardPage.tsx` to point to `/super-admin/applications` and `/super-admin/campers`.

**Affected Files:**
- `frontend/src/features/superadmin/pages/SuperAdminDashboardPage.tsx`

---

### BUG-020

**Title:** Form Management — session assignment uses raw ID input, no session picker
**Module:** Form Management
**Severity:** Medium
**Status:** Resolved — Phase 5

**Description:**
When uploading a form template in `FormManagementPage`, the "Assign to Session" field was a plain number input. The purpose of Form Management was also not explained in the UI.

**Resolution:**
Session assignment field is now a `<select>` dropdown populated from `getSessions()`. Header description updated to clearly explain that templates are supplemental PDF/Word forms applicants must complete and submit, optionally scoped to a session.

**Affected Files:**
- `frontend/src/features/superadmin/pages/FormManagementPage.tsx`

---

### BUG-021

**Title:** Form Management files stored on local disk — not accessible for download in production
**Module:** Form Management
**Severity:** High
**Status:** Open

**Description:**
`FormTemplateController` stores uploaded files using `Storage::disk('local')` which maps to `storage/app/`. This disk is not publicly accessible. While the download endpoint streams the file correctly in development, this approach will not work in production environments where storage may be distributed (e.g. S3). The `local` disk should be replaced with `public` or a configurable cloud storage driver.

**Affected Files:**
- `backend/.../app/Http/Controllers/Api/System/FormTemplateController.php`

---

### BUG-022

**Title:** Report downloads — AdminReportsPage loads only page 1 of applications for chart data
**Module:** Admin Reports
**Severity:** High
**Status:** Resolved — Phase 5

**Description:**
`AdminReportsPage` previously called `getApplications({ page: 1 })` to build charts and statistics, undercounting totals for data sets that span multiple pages.

**Resolution:**
`AdminReportsPage` now calls `getReportsSummary()` which targets `GET /reports/summary` — a dedicated aggregate endpoint that counts all records regardless of pagination. Accurate totals are returned for all status counts, session enrollment, and acceptance rate.

**Affected Files:**
- `frontend/src/features/admin/pages/AdminReportsPage.tsx`
- `backend/.../app/Http/Controllers/Api/System/ReportController.php`

---

### BUG-023

**Title:** AdminReportsPage imports stale/non-standard motion variant names
**Module:** Admin Reports
**Severity:** Low
**Status:** Resolved — Phase 5

**Description:**
`AdminReportsPage.tsx` imported `scrollRevealVariants`, `staggerContainerVariants`, and `staggerChildVariants`. These are valid named exports in `motion.ts` — they are the full-name forms of the short-name aliases (`staggerContainer`, `staggerChild`, `pageEntry`). No runtime error occurs, but the imports are inconsistent with the project convention of using the short-name aliases.

**Affected Files:**
- `frontend/src/features/admin/pages/AdminReportsPage.tsx`
- `frontend/src/shared/constants/motion.ts`

---

### BUG-024

**Title:** Password reset sends no confirmation email to notify the user
**Module:** Password Reset
**Severity:** Medium
**Status:** Open

**Description:**
When a user resets their password via the forgot-password flow, the system updates the password and deletes the token but does not send a confirmation email. This is a security best practice gap — a user whose account has been compromised would receive no notification that their password was changed. Note: `changePassword()` via profile settings does trigger a system inbox notification, but the reset flow does not.

**Affected Files:**
- `backend/.../app/Services/Auth/PasswordResetService.php`
- `backend/.../app/Notifications/Auth/` (new notification required)

---

### BUG-025

**Title:** No CODEBASE_GUIDE.md exists
**Module:** Documentation
**Severity:** Medium
**Status:** Resolved — Phase 10

**Description:**
There is no `CODEBASE_GUIDE.md` file at the project root. Per Phase 10 requirements, a comprehensive codebase guide explaining folder structure, data flow, backend/frontend interaction, and architecture diagrams is required for onboarding and debugging.

**Resolution:**
`CODEBASE_GUIDE.md` created at the project root. Covers folder structure, all major files, backend/frontend interaction, data flow diagrams, debugging reference table, database tables at a glance, security layers, testing, and environment setup.

**Affected Files:**
- `CODEBASE_GUIDE.md` (new)

---

### BUG-026

**Title:** Documentation does not reflect current system state in several areas
**Module:** Documentation
**Severity:** Medium
**Status:** Resolved — Phase 10

**Description:**
Several documentation files in `docs/` predated recent system changes and did not accurately reflect: the messaging/inbox system additions, the form templates module, the calendar and announcements additions, or the current profile/notification-preference endpoints.

**Resolution:**
`BACKEND_CHANGELOG.md` updated with Phase 7, 8, 9, and post-phase changes. `ROLES_AND_PERMISSIONS.md` updated: "parent" role renamed to "Applicant" throughout, hierarchy notation corrected. `AUDIT_LOGGING.md` updated with Phase 9 API additions (human descriptions, category mapping, export endpoint). `CODEBASE_GUIDE.md` created as the canonical onboarding and debugging reference.

**Affected Files:**
- `docs/governance/BACKEND_CHANGELOG.md`
- `docs/backend/ROLES_AND_PERMISSIONS.md`
- `docs/backend/AUDIT_LOGGING.md`
- `CODEBASE_GUIDE.md` (new)

---

### BUG-027

**Title:** Notification settings — toggles have a race condition and missing per-type controls
**Module:** Notification Settings
**Severity:** Medium
**Status:** Resolved — Phase 7

**Description:**
The notification preferences system only supports email toggles (4 keys: `application_updates`, `announcements`, `messages`, `deadlines`). There are no SMS or in-app notification controls. The toggle mechanism suffered from a first-click race condition where optimistic updates snapped back visually before the API call completed.

**Resolution:**
(1) All notification `via()` methods now read `notification_preferences` from the notifiable user before deciding whether to include the `mail` channel — preferences are now enforced server-side. (2) `SettingsPage` loads preferences on component mount (not only when the notifications tab is opened), eliminating the first-click race condition. (3) `handleNotifToggle` now guards against simultaneous in-flight saves using the functional updater form to avoid stale closure bugs. (4) All toggles are disabled while any one is saving. (5) The notifications tab now shows per-preference descriptions and a loading skeleton while preferences are fetched.

**Affected Files:**
- `frontend/src/features/profile/pages/SettingsPage.tsx`
- `backend/.../app/Notifications/Camper/ApplicationStatusChangedNotification.php`
- `backend/.../app/Notifications/Camper/ApplicationSubmittedNotification.php`
- `backend/.../app/Notifications/NewMessageNotification.php`
- `backend/.../app/Notifications/NewConversationNotification.php`

---

### BUG-028

**Title:** Medical portal has no route or UI for document upload or treatment recording
**Module:** Medical Portal
**Severity:** Critical
**Status:** Resolved — Phase 6

**Description:**
Medical staff have no UI for uploading medical documents, recording treatments/interventions, updating allergy severity, or logging medication administrations in real time. The backend has write endpoints for medical data but the `medical` role only accesses them as read-only in the frontend. A full clinical workflow UI is required for on-site camp medical staff.

**Resolution:**
Created `MedicalTreatmentLogPage` (`/medical/records/:camperId/treatments`) for recording and reviewing interventions. Created `MedicalDocumentsPage` (`/medical/records/:camperId/documents`) for viewing and uploading camper documents. Created the complete `TreatmentLog` backend system (migration, model, enum, policy, requests, controller, routes). Fixed `DocumentController` and `DocumentPolicy` to give medical staff access to camper and medical record documents.

**Affected Files:**
- `frontend/src/features/medical/pages/MedicalTreatmentLogPage.tsx` (new)
- `frontend/src/features/medical/pages/MedicalDocumentsPage.tsx` (new)
- `backend/camp-burnt-gin-api/database/migrations/2026_03_06_000010_create_treatment_logs_table.php` (new)
- `backend/camp-burnt-gin-api/app/Models/TreatmentLog.php` (new)
- `backend/camp-burnt-gin-api/app/Enums/TreatmentType.php` (new)
- `backend/camp-burnt-gin-api/app/Policies/TreatmentLogPolicy.php` (new)
- `backend/camp-burnt-gin-api/app/Http/Controllers/Api/Medical/TreatmentLogController.php` (new)
- `backend/camp-burnt-gin-api/app/Http/Requests/TreatmentLog/StoreTreatmentLogRequest.php` (new)
- `backend/camp-burnt-gin-api/app/Http/Requests/TreatmentLog/UpdateTreatmentLogRequest.php` (new)
- `backend/camp-burnt-gin-api/app/Policies/DocumentPolicy.php`
- `backend/camp-burnt-gin-api/app/Http/Controllers/Api/Document/DocumentController.php`

---

### BUG-029

**Title:** Camper detail page missing — /admin/campers/:id leads to 404
**Module:** Admin — Camper Management
**Severity:** Critical
**Status:** Resolved — Phase 5

**Description:**
Duplicate report of BUG-005, filed independently during Phase 5 work. See BUG-005 for full description and resolution. `CamperDetailPage` now exists and is registered at `/admin/campers/:id` and `/super-admin/campers/:id`.

**Affected Files:**
- `frontend/src/core/routing/index.tsx`
- `frontend/src/features/admin/pages/CamperDetailPage.tsx`

---

### BUG-030

**Title:** Applicant portal has no past applications history with filter/sort
**Module:** Applicant Portal — Past Applications
**Severity:** Medium
**Status:** Open

**Description:**
`ParentApplicationsPage` displays all applications including past ones in a flat list, but there is no filtering by year, session, or status, no sorting, and no clear visual differentiation between active and historical applications. The "Re-apply" button exists but the overall history UX needs improvement.

**Affected Files:**
- `frontend/src/features/parent/pages/ParentApplicationsPage.tsx`

---

### BUG-031

**Title:** Password change via Settings uses minimum 8-char rule; password reset requires 12+ with complexity
**Module:** Security
**Severity:** Medium
**Status:** Open

**Description:**
The `changePassword` endpoint uses `Password::min(8)` while the `reset` endpoint uses `Password::min(12)->mixedCase()->numbers()->symbols()->uncompromised()`. The two password policies are inconsistent. Both should use the stronger policy.

**Affected Files:**
- `backend/.../app/Http/Controllers/Api/Camper/UserProfileController.php` (uses min 8)
- `backend/.../app/Http/Controllers/Api/Auth/PasswordResetController.php` (uses min 12 + complexity)

---

### BUG-032

**Title:** SettingsPage password form validates min 8 chars — inconsistent with the reset flow requirement
**Module:** Security
**Severity:** Medium
**Status:** Open

**Description:**
`SettingsPage` validates the new password as `z.string().min(8, ...)` on the frontend. This is inconsistent with the password reset flow which requires 12+ characters with mixed case, numbers, and symbols. Frontend and backend password validation rules should be aligned.

**Affected Files:**
- `frontend/src/features/profile/pages/SettingsPage.tsx` (`passwordSchema` min 8)

---

### BUG-033

**Title:** Super Admin user management role filter uses raw role slugs, not user-friendly labels
**Module:** Super Admin — User Management
**Severity:** Low
**Status:** Open

**Description:**
When filtering users by role in `UserManagementPage`, the filter passes raw role slugs (`applicant`, `admin`, `medical`, `super_admin`) to the API. If the UI labels change but the API values do not, the filter will become misaligned. The role naming change in BUG-001 must be coordinated with this filter.

**Affected Files:**
- `frontend/src/features/superadmin/pages/UserManagementPage.tsx`
- `backend/.../app/Http/Controllers/Api/System/UserController.php`

---

### BUG-034

**Title:** Medical portal inbox missing — no /medical/inbox route exists
**Module:** Medical Portal
**Severity:** Medium
**Status:** Resolved — Phase 6

**Description:**
The medical portal had no inbox route or navigation item, preventing medical staff from accessing the messaging system from within their portal.

**Resolution:**
Added `/medical/inbox` route to the medical portal's routing block in `core/routing/index.tsx`, pointing to the shared `InboxPage` component. Added an Inbox nav item to `MedicalLayout` with the `Inbox` icon from `lucide-react`.

**Affected Files:**
- `frontend/src/core/routing/index.tsx`
- `frontend/src/ui/layout/MedicalLayout.tsx`

---

### BUG-035

**Title:** ApplicationReviewPage back link hardcoded to /admin/applications regardless of portal
**Module:** Admin / Super Admin
**Severity:** Low
**Status:** Resolved — Phase 5

**Description:**
`ApplicationReviewPage` is shared between `/admin/applications/:id` and `/super-admin/applications/:id`. The "Back to Applications" link was hardcoded to `/admin/applications`, causing super admin users to be redirected into the Admin portal layout after reviewing an application.

**Resolution:**
Added `useLocation` to `ApplicationReviewPage`. The back link now detects the portal prefix from the current path and navigates to either `/super-admin/applications` or `/admin/applications` accordingly.

**Affected Files:**
- `frontend/src/features/admin/pages/ApplicationReviewPage.tsx`

---

### BUG-036

**Title:** Profile Settings actions log out user — stale token not rehydrated before validation
**Module:** Profile System / Auth
**Severity:** Critical
**Status:** Resolved — Phase 5 Corrections

**Description:**
All profile API calls (save profile, upload avatar, delete avatar, emergency contacts, data export, delete account) returned 401, triggering the axios interceptor which fired `auth:unauthorized` → `clearAuth()` → redirect to login. Root cause: `useAuthInit` read `store.getState().auth.token` before `redux-persist` rehydration completed, resulting in a null token being sent on all requests.

**Resolution:**
Fixed `useAuthInit` hook to await `persistor.getState().bootstrapped` before reading the token. Also fixed FormData Content-Type boundary issue in avatar upload (removed manual `Content-Type` header so axios sets it automatically).

**Affected Files:**
- `frontend/src/features/auth/hooks/useAuthInit.ts`
- `frontend/src/features/profile/api/profile.api.ts`

---

### BUG-037

**Title:** Super Admin can delete their own account — no role restriction on deleteAccount endpoint
**Module:** Profile System / Security
**Severity:** Critical
**Status:** Resolved — Phase 5 Corrections

**Description:**
`UserProfileController::deleteAccount()` had no role check. Any authenticated user — including admin and super_admin — could deactivate their own account. The Delete Account UI section was also visible to all roles in `SettingsPage.tsx`.

**Resolution:**
Added backend role guard: non-applicants receive a 403 response. Added frontend visibility check: the Delete Account section is hidden when the user's primary role is in `ADMIN_ROLES` (`admin`, `super_admin`).

**Affected Files:**
- `backend/.../app/Http/Controllers/Api/Camper/UserProfileController.php`
- `frontend/src/features/profile/pages/SettingsPage.tsx`

---

### BUG-038

**Title:** Application review page shows "Unknown Camper", literal i18n keys, and no medical data
**Module:** Admin — Application Review
**Severity:** Critical
**Status:** Resolved — Phase 5 Corrections

**Description:**
Three compounding issues: (1) `Camper` model had no `$appends = ['full_name']` so the accessor was never serialized to JSON — `camper.full_name` was always undefined. (2) `ApplicationController::show()` only loaded `['camper', 'campSession.camp', 'reviewer']` — medical record and emergency contacts were missing from the response. (3) Multiple `t('common.*')` keys were missing from `en.json`, rendering as literal strings in the UI.

**Resolution:**
Added `$appends = ['full_name']` to the Camper model. Updated `show()` to eager-load `camper.medicalRecord` and `camper.emergencyContacts`. Added missing i18n keys: `common.review`, `common.not_provided`, `common.none`, `common.view`, `common.not_submitted`.

**Affected Files:**
- `backend/.../app/Models/Camper.php`
- `backend/.../app/Http/Controllers/Api/Camper/ApplicationController.php`
- `frontend/src/i18n/en.json`

---

### BUG-039

**Title:** Application list shows "Session #undefined" — wrong JSON key and TypeScript type
**Module:** Admin — Application List / Camper List
**Severity:** High
**Status:** Resolved — Phase 5 Corrections

**Description:**
The `Application` model's `campSession()` relationship serializes as `camp_session` in JSON, but the frontend TypeScript interface used `session?`. The `Application` interface also had `session_id: number` but the database column is `camp_session_id`, so the `Session #${app.session_id}` fallback always rendered "Session #undefined".

**Resolution:**
Added `$appends = ['session']` and `getSessionAttribute()` to the Application model to alias `campSession` as `session` in JSON output. Updated `admin.types.ts` Application interface: renamed `session_id` to `camp_session_id`. Fixed fallback strings in `AdminApplicationsPage.tsx` and `CamperDetailPage.tsx`.

**Affected Files:**
- `backend/.../app/Models/Application.php`
- `frontend/src/features/admin/types/admin.types.ts`
- `frontend/src/features/admin/pages/AdminApplicationsPage.tsx`
- `frontend/src/features/admin/pages/CamperDetailPage.tsx`

---

### BUG-040

**Title:** Profile save / avatar actions log user out — setUser overwrites the roles array
**Module:** Profile System / Auth
**Severity:** Critical
**Status:** Resolved — Phase 5 Corrections (Round 2)

**Description:**
`ProfilePage.tsx` dispatched `setUser(updated)` where `updated` was the raw profile API response. The `/profile` update endpoint does not load the `role` relationship, so the response contained no `roles` array. Replacing the Redux auth user with this object wiped `user.roles` and `user.role`. Layout guards (`SuperAdminLayout`, `AdminLayout`, `ApplicantLayout`) check `user?.roles?.some(...)` and fail when `roles` is undefined, redirecting to `/login`. This affected: save personal info, save address, upload avatar, and remove avatar.

**Resolution:**
Added `useAppSelector` to `ProfilePage` to read the current `authUser`. All four `dispatch(setUser(...))` calls now spread `authUser` as base: `dispatch(setUser({ ...authUser, ...updated } as User))`, preserving `roles`, `token`, and all other auth-state-only fields.

**Affected Files:**
- `frontend/src/features/profile/pages/ProfilePage.tsx`

---

### BUG-041

**Title:** Avatar upload fails — axios instance default Content-Type overrides multipart/form-data boundary
**Module:** Profile System
**Severity:** High
**Status:** Resolved — Phase 5 Corrections (Round 2)

**Description:**
`uploadAvatar()` sent `FormData` via POST, but the axios instance default `Content-Type: application/json` was applied, replacing the browser-generated `multipart/form-data; boundary=...` header. The server received an incorrect content type and rejected the file upload.

**Resolution:**
Added `headers: { 'Content-Type': undefined }` to the `uploadAvatar` axios call so the browser sets the correct multipart header automatically.

**Affected Files:**
- `frontend/src/features/profile/api/profile.api.ts`

---

### BUG-042

**Title:** Campers list shows raw ISO 8601 date — date_of_birth not formatted for display
**Module:** Admin — Camper Management
**Severity:** Medium
**Status:** Resolved — Phase 5 Corrections (Round 2)

**Description:**
`AdminCampersPage.tsx` rendered `camper.date_of_birth` directly. Laravel's `date` cast serializes dates as ISO 8601 (`2013-04-12T00:00:00.000000Z`), producing an unreadable string in the UI.

**Resolution:**
Imported `format` from `date-fns` and wrapped the value: `format(new Date(camper.date_of_birth), 'MMM d, yyyy')`.

**Affected Files:**
- `frontend/src/features/admin/pages/AdminCampersPage.tsx`

---

### BUG-043

**Title:** "View Risk" link in camper list routes to 404 — /admin/campers/:id/risk not defined
**Module:** Admin — Camper Management
**Severity:** High
**Status:** Resolved — Phase 5 Corrections (Round 2)

**Description:**
The "View Risk" button in `AdminCampersPage.tsx` linked to `/admin/campers/:id/risk`, which has no matching route definition. No `CamperRiskPage` component exists. The existing `CamperDetailPage` already displays medical records, risk level, and behavioral profile.

**Resolution:**
Changed the link target from `/admin/campers/${camper.id}/risk` to `/admin/campers/${camper.id}`, routing to the existing `CamperDetailPage`.

**Affected Files:**
- `frontend/src/features/admin/pages/AdminCampersPage.tsx`

---

### BUG-044

**Title:** Login page shows two password reveal icons — browser native icon conflicts with custom Eye button
**Module:** Auth — Login Page
**Severity:** Low
**Status:** Resolved — Phase 5 Corrections (Round 2)

**Description:**
Some browsers (Edge, Chrome, Safari) render a native password reveal button inside `input[type="password"]` fields. This appeared alongside the custom `Eye`/`EyeOff` icon button, making the icon appear visually doubled.

**Resolution:**
Added global CSS in `globals.css` to hide the native browser password reveal buttons (`-ms-reveal`, `-ms-clear`, `-webkit-credentials-auto-fill-button`, `-webkit-strong-password-auto-fill-button`).

**Affected Files:**
- `frontend/src/assets/styles/globals.css`

---

### BUG-045

**Title:** Login redirects back to /login after success — stale token validation races with fresh login
**Module:** Auth — Login
**Severity:** Critical
**Status:** Resolved — Phase 5 Corrections (Round 2)

**Description:**
When a user had a previous session (expired token in sessionStorage), `useAuthInit` would fire `getAuthenticatedUser()` on app mount (async, pending). While that request was in-flight: (1) the user submitted the login form, (2) the toast fired and `navigate('/applicant/dashboard')` was called, (3) `ProtectedRoute` showed `<FullPageLoader>` because `isLoading` was still `true`, (4) `getAuthenticatedUser()` failed on the expired token → `dispatch(clearAuth())` → `isAuthenticated = false` → redirect to `/login`. The user saw a "Welcome back" toast but landed back on the login page.

**Resolution:**
In `useAuthInit`, the `.catch()` handler now compares the current token against the token captured at validation-start. If they differ (user logged in with a new token while old validation was pending), `dispatch(hydrateAuth())` is called instead of `dispatch(clearAuth())`. The `.then()` handler similarly skips `dispatch(setUser(user))` when the token changed, preventing stale rehydration data from overwriting a fresh login.

**Affected Files:**
- `frontend/src/features/auth/hooks/useAuthInit.ts`

---

### BUG-046

**Title:** Applicant login broken — blocking issue, unresolved after multiple sessions
**Module:** Auth — Applicant Login
**Severity:** Critical
**Status:** Resolved — Forensic Audit 2026-03-27

**Description:**
Applicant (`applicant` role) login was broken across multiple prior sessions. Root causes identified and resolved via BUG-051, BUG-075, and BUG-082 (sessionStorage/localStorage mismatch, RoleGuard redirect loop). Full login flow trace confirmed correct in forensic audit: token written to sessionStorage, normalizeUser() extracts 'applicant' role correctly, getDashboardRoute('applicant') returns /applicant/dashboard, RoleGuard permits entry.

**Residual fix (2026-03-27):** `normalizeUser()` was extracting role ID via `user.roles?.[0]?.id` (always undefined for login responses that return `user.role` as an object, not `user.roles` as an array) — defaulting all role IDs to 0. Fixed to prefer `(user.role as Role).id` when available.

**Resolution Files:**
- `frontend/src/features/auth/hooks/useAuthInit.ts` (BUG-051, BUG-075 — sessionStorage/comment fix)
- `frontend/src/core/auth/RoleGuard.tsx` (BUG-082 — redirect loop fix)
- `frontend/src/features/auth/api/auth.api.ts` (2026-03-27 — role ID extraction fix)

---

### BUG-047

**Title:** CamperDetailPage uses camper.t_shirt_size — property does not exist on the Camper type
**Module:** Admin — Camper Management
**Severity:** Medium
**Status:** Resolved — Phase 5

**Description:**
`CamperDetailPage.tsx` referenced `camper.t_shirt_size` (with underscore). The `Camper` type in `admin.types.ts` defines the field as `tshirt_size` (no underscore). In TypeScript strict mode this silently resolves to `undefined`, causing the T-Shirt Size field to always display "—" regardless of actual data.

**Resolution:**
Changed `camper.t_shirt_size` to `camper.tshirt_size` in `CamperDetailPage.tsx`.

**Affected Files:**
- `frontend/src/features/admin/pages/CamperDetailPage.tsx`

---

### BUG-048

**Title:** Portal context links broken — AdminApplicationsPage and AdminCampersPage hardcode /admin/* paths
**Module:** Admin / Super Admin — Applications and Camper Management
**Severity:** High
**Status:** Resolved — Phase 5

**Description:**
`AdminApplicationsPage` and `AdminCampersPage` are shared between `/admin/*` and `/super-admin/*` portals. All internal navigation links hardcoded `/admin/applications/:id` and `/admin/campers/:id`, causing super admin users to be dropped into the Admin portal shell mid-flow. The same issue existed in `ApplicationReviewPage`'s back link.

**Resolution:**
Added `useLocation` to all three pages. The portal prefix (`/admin` vs `/super-admin`) is now derived from the current path and applied to all internal navigation links.

**Affected Files:**
- `frontend/src/features/admin/pages/AdminApplicationsPage.tsx`
- `frontend/src/features/admin/pages/AdminCampersPage.tsx`
- `frontend/src/features/admin/pages/ApplicationReviewPage.tsx`

---

### BUG-049

**Title:** Applicant cannot send messages to super_admin — hasNonAdminParticipants check too narrow
**Module:** Inbox / Messaging — RBAC
**Severity:** High
**Status:** Resolved — Post Phase 8

**Description:**
`ConversationController::store()` computed `hasNonAdminParticipants` using `fn($role) => $role !== 'admin'`. This treated `super_admin` as a non-admin role, blocking applicants from creating conversations with super admins even though the search endpoint correctly allows it.

**Resolution:**
Changed the check to `fn($role) => !in_array($role, ['admin', 'super_admin'], true)` so both admin roles are accepted.

**Affected Files:**
- `backend/.../app/Http/Controllers/Api/Inbox/ConversationController.php`

---

### BUG-050

**Title:** Inbox folder switching shows a brief blank/skeleton flash
**Module:** Inbox / Messaging — UI
**Severity:** Medium
**Status:** Resolved — Post Phase 8

**Description:**
Switching inbox folders caused the conversation list to blank immediately via `setConversations([])` in `changeFolder`, showing skeleton rows for under 200ms before new data arrived. This was compounded when the Phase 8 migration had not been applied — all folder queries would fail with SQL errors, rendering a persistent error state.

**Resolution:**
(1) Removed `setConversations([])` and `setAnnouncements([])` from `changeFolder` — stale content stays visible while loading and is replaced atomically when the fetch resolves. (2) Replaced the skeleton replacement with a subtle top progress bar overlaid on the stale list. (3) Removed redundant `setLoading(true)` and `setError(false)` from inside the `useEffect`. (4) Run `php artisan migrate` to apply Phase 8 schema.

**Affected Files:**
- `frontend/src/features/messaging/pages/InboxPage.tsx`
- `backend/.../database/migrations/2026_03_06_000001_add_per_user_state_to_conversation_participants_table.php` (must be migrated)

---

### BUG-051

**Title:** Page refresh logs user out — useAuthInit reads localStorage but token is in sessionStorage
**Module:** Auth — Session Persistence
**Severity:** Critical
**Status:** Resolved — Post Phase 9

**Description:**
`useAuthInit` read the auth token from `localStorage.getItem('auth_token')` but the login flow stores it in `sessionStorage.setItem('auth_token', token)`. On every page refresh, localStorage returned null → auth state was never restored → user was redirected to `/login`. The 401 handler also cleared localStorage instead of sessionStorage, so the token was never actually removed on session expiry.

**Resolution:**
Changed all three `localStorage` references in `useAuthInit.ts` to `sessionStorage`.

**Affected Files:**
- `frontend/src/features/auth/hooks/useAuthInit.ts`

---

### BUG-052

**Title:** "Under Review" application status badge is green — should be yellow
**Module:** UI — Status Badges
**Severity:** Low
**Status:** Resolved — Post Phase 9

**Description:**
`StatusBadge.tsx` used the same green color for `under_review` as for `approved` and `active`, making it visually indistinguishable from a positive outcome status.

**Resolution:**
Changed `under_review` to a light yellow background (`rgba(234,179,8,0.15)`) with dark amber text (`#854d0e`).

**Affected Files:**
- `frontend/src/ui/components/StatusBadge.tsx`

---

### BUG-053

**Title:** "Pending" application status badge is green — should be grey
**Module:** UI — Status Badges
**Severity:** Low
**Status:** Resolved — Post Phase 9

**Description:**
`StatusBadge.tsx` used the same green color for `pending` as for `approved`, implying a positive outcome for a status that means only "awaiting review."

**Resolution:**
Changed `pending` to grey background and text, matching `draft`, `inactive`, and `cancelled`.

**Affected Files:**
- `frontend/src/ui/components/StatusBadge.tsx`

---

### BUG-054

**Title:** Application submission fails — signApplication omits signature_data; Consents section never completes; duplicate campers on retry
**Module:** Applicant Portal — Application Form
**Severity:** Critical
**Status:** Resolved — Post Phase 13

**Description:**
Three compounding defects in `ApplicationFormPage.tsx` that together made application submission impossible:

1. `Section10` rendered today's date as a display fallback (`value={data.signed_date || today}`) without writing it to form state. `getSectionStatus` evaluated `signed_date === ''` → section remained `'partial'` → Submit button stayed disabled.
2. `signApplication()` in `applicant.api.ts` only posted `signature_name`. The backend `SignApplicationRequest` validates `signature_data` as `required` → 422 on every submission after step 1 (camper creation) had already succeeded.
3. `createCamper` ran unconditionally at step 1 of `handleSubmit`. On failure at any later step, the orphan camper persisted in the database. Each retry created a new duplicate entry visible in `/admin/campers`.

**Resolution:**
1. Added `useEffect` in `Section10` to call `onChange({ signed_date: today })` on mount when `signed_date` is empty.
2. Added `signatureData` parameter to `signApplication()`. `handleSubmit` now derives the value: drawn signature → base64 canvas data; typed signature → the typed name string.
3. Added `pendingCamperIdRef` (`useRef<number | null>`). Step 1 is skipped on retry if the ref already holds an ID; ref is cleared on successful submission.

**Affected Files:**
- `frontend/src/features/parent/pages/ApplicationFormPage.tsx`
- `frontend/src/features/parent/api/applicant.api.ts`

---

### BUG-055

**Title:** Document upload fails for PNG files — image/x-png not in the allowed MIME type list
**Module:** Document Upload
**Severity:** High
**Status:** Resolved — Post Phase 13

**Description:**
PHP's `finfo_file` extension reports PNG files as `image/x-png` instead of `image/png` on some platforms (macOS, Linux with older `magic` database). `DocumentService::validateMimeType` ran a magic-byte check against `Document::ALLOWED_MIME_TYPES` which only listed `image/png`. Valid PNG files were rejected with "Unsupported file type."

**Resolution:**
Added `'image/x-png'` to `Document::ALLOWED_MIME_TYPES`. Added `'image/x-png' => 'png'` to the `$mimeToExtension` map in `DocumentService::generateFilename` so the stored extension resolves correctly to `.png`.

**Affected Files:**
- `backend/camp-burnt-gin-api/app/Models/Document.php`
- `backend/camp-burnt-gin-api/app/Services/Document/DocumentService.php`

---

### BUG-056

**Title:** Message attachments sent via Compose not visible to recipient
**Module:** Inbox / Messaging — FloatingCompose
**Severity:** High
**Status:** Resolved — Post Phase 13

**Description:**
`FloatingCompose::handleSend` called `sendMessage(conv.id, bodyHtml)` without the third `attachments` argument. The `sendMessage` API function already handles `FormData` multipart when attachments are supplied, the backend stores and returns attachments correctly, and `ThreadView` renders them correctly — the only broken link was the omitted argument in `FloatingCompose`. Recipients saw only message text with no attachment preview or download button.

**Resolution:**
Changed the call to `sendMessage(conv.id, bodyHtml, attachments.length > 0 ? attachments : undefined)`, matching the existing working pattern in `ThreadView`.

**Affected Files:**
- `frontend/src/features/messaging/components/FloatingCompose.tsx`

---

### BUG-057

**Title:** FormSectionController store() and update() had no authorization — any authenticated user could create or modify form sections
**Module:** Form Builder — Backend
**Severity:** Critical
**Status:** Resolved — Phase 14

**Description:**
`FormSectionController::store()` and `update()` contained no `$this->authorize()` calls. Any authenticated user (including applicants and medical staff) could POST to create a section or PUT to update one on any form definition, bypassing the `super_admin` + draft-status requirement entirely.

**Resolution:**
`store()` now builds a transient `FormSection` with the `formDefinition` relation pre-loaded and calls `$this->authorize('create', $transient)`. `update()` calls `$this->authorize('update', $section)`.

**Affected Files:**
- `backend/camp-burnt-gin-api/app/Http/Controllers/Api/Form/FormSectionController.php`

---

### BUG-058

**Title:** FormSectionController reorder() did not scope batch UPDATE to the request's definition — cross-definition reordering possible
**Module:** Form Builder — Backend
**Severity:** High
**Status:** Resolved — Phase 14

**Description:**
`FormSectionController::reorder()` executed `FormSection::where('id', $id)->update(...)` without scoping to the definition supplied in the route. A super admin could pass section IDs from a different form definition and reorder them, silently corrupting form structure across versions.

**Resolution:**
Added `->where('form_definition_id', $form->id)` to the WHERE clause inside the transaction loop.

**Affected Files:**
- `backend/camp-burnt-gin-api/app/Http/Controllers/Api/Form/FormSectionController.php`

---

### BUG-059

**Title:** FormFieldController store() and update() had no authorization — any authenticated user could create or modify form fields
**Module:** Form Builder — Backend
**Severity:** Critical
**Status:** Resolved — Phase 14

**Description:**
Same pattern as BUG-057 applied to fields. `FormFieldController::store()` and `update()` contained no `$this->authorize()` calls, allowing any authenticated user to create or modify fields on any section or form definition.

**Resolution:**
`store()` uses the transient model pattern (pre-loads `formDefinition` on the section, builds a transient `FormField`, calls `$this->authorize('create', $transient)`). `update()` calls `$this->authorize('update', $field)`. `index()` changed from the fragile `firstOrNew()` pattern to `$this->authorize('viewAny', FormField::class)`.

**Affected Files:**
- `backend/camp-burnt-gin-api/app/Http/Controllers/Api/Form/FormFieldController.php`

---

### BUG-060

**Title:** FormFieldController reorder() used firstOrNew() for authorization and did not scope batch UPDATE to the section
**Module:** Form Builder — Backend
**Severity:** High
**Status:** Resolved — Phase 14

**Description:**
`$this->authorize('update', $section->fields()->firstOrNew())` is fragile — if the section has no fields, `firstOrNew()` returns an unsaved model with no `form_section_id`, causing the policy to fail with a null traversal. Additionally, the batch UPDATE was not scoped to the section, allowing cross-section field reordering.

**Resolution:**
Authorization changed to `$this->authorize('update', $section->formDefinition)`, consistent with `FormSectionController::reorder`. Batch UPDATE now scoped with `->where('form_section_id', $section->id)`.

**Affected Files:**
- `backend/camp-burnt-gin-api/app/Http/Controllers/Api/Form/FormFieldController.php`

---

### BUG-061

**Title:** FormFieldOptionController had no authorization on index(), store(), and update()
**Module:** Form Builder — Backend
**Severity:** Critical
**Status:** Resolved — Phase 14

**Description:**
`FormFieldOptionController::index()`, `store()`, and `update()` had no authorization at all. Any authenticated user could list, create, or update options on any field. `destroy()` and `reorder()` had inline `isSuperAdmin()` checks but no editable-status guard, and `reorder()` did not scope the batch UPDATE to the parent field.

**Resolution:**
All methods now use `$this->authorize('view'/'update', $field)`, using the parent `FormField` as the authorization proxy via `FormFieldPolicy`. `reorder()` is now scoped with `->where('form_field_id', $field->id)`.

**Affected Files:**
- `backend/camp-burnt-gin-api/app/Http/Controllers/Api/Form/FormFieldOptionController.php`

---

### BUG-062

**Title:** Backend test failure — TokenExpirationTest fails when SANCTUM_EXPIRATION=null in .env
**Module:** Auth — Login / Session
**Severity:** High
**Status:** Resolved — Full Audit 2026-03-12

**Description:**
`TokenExpirationTest::sanctum_token_expiration_is_configured` was failing because the local `.env` file sets `SANCTUM_EXPIRATION=null`. Laravel's `env()` helper converts the string literal `"null"` to PHP `null`, overriding the default value of `60` configured in `config/sanctum.php`. The test asserted `assertNotNull(Config::get('sanctum.expiration'))` and received `null`, causing a CI failure.

**Resolution:**
Added `<env name="SANCTUM_EXPIRATION" value="60"/>` to `phpunit.xml` inside the `<php>` block. PHPUnit environment overrides take precedence over `.env`, ensuring the test suite always validates token expiration regardless of local developer configuration.

**Affected Files:**
- `backend/camp-burnt-gin-api/phpunit.xml`

---

### BUG-063

**Title:** Page-open animation glitch — content briefly appears at full opacity then disappears on each navigation
**Module:** UI — Layout
**Severity:** High
**Status:** Resolved — Full Audit 2026-03-12

**Description:**
The `<main>` element in `DashboardShell.tsx` was animated with `style={{ animation: 'pageIn 160ms ease-out' }}`. The `pageIn` keyframe starts at `opacity: 0, translateY(6px)`. Without `animation-fill-mode: backwards`, the browser painted the element at its default CSS state (opacity: 1) for one frame before the animation engine applied the `from` keyframe. Combined with `key={location.pathname}` forcing a remount on every route change, this produced a visible three-phase glitch: full-opacity flash → snap to transparent → fade in.

**Resolution:**
Changed to `style={{ animation: 'pageIn 160ms ease-out backwards' }}`. The `backwards` fill-mode holds the element at the `from` keyframe state before and during the animation start, eliminating the flash entirely.

**Affected Files:**
- `frontend/src/ui/layout/DashboardShell.tsx`

---

### BUG-064

**Title:** 188 ESLint errors — accessibility violations and missing React type imports across frontend
**Module:** Frontend — Multiple
**Severity:** Medium
**Status:** Resolved — Full Audit 2026-03-12

**Description:**
A full ESLint scan of the frontend codebase revealed 188 errors across three categories:
1. `no-undef` — files using `React.ReactNode`, `React.FormEvent`, `React.MouseEvent`, etc. without importing the React namespace, relying on a global that is not available in the project's ESLint configuration.
2. `jsx-a11y/click-events-have-key-events` + `jsx-a11y/no-static-element-interactions` — backdrop overlays and clickable rows implemented as `<div onClick>` with no keyboard event handling, making them inaccessible to keyboard-only users.
3. `jsx-a11y/label-has-associated-control` — form labels missing `htmlFor` attributes or paired `id` on native controls, preventing screen readers from correctly associating labels with inputs.

**Resolution:**
All errors were corrected across ~30 files. Pattern fixes:
- `React.ReactNode` → add named type import, replace with `ReactNode`
- Backdrop `<div onClick>` → `<button type="button" aria-label="Close">`
- Interactive `<div onClick>` → add `role="button"`, `tabIndex={0}`, `onKeyDown`
- Labels → add `htmlFor`/`id` pairs or nest control directly

Final state: 0 errors, 11 acceptable warnings (`jsx-a11y/no-autofocus` on intentional modal inputs).

**Affected Files:**
All files listed in Appendix A of `docs/audits/full-audit-and-cleansing-report.md`.

### BUG-065

**Title:** FormDefinitionPolicy::view() exposes draft form definitions to all authenticated users
**Module:** Security — Form Builder
**Severity:** Critical
**Status:** Resolved — Full Audit 2026-03-12

**Description:**
`FormDefinitionPolicy::view()` returned `true` for any authenticated user regardless of the form's status. This allowed applicants and medical providers to access draft form definitions (containing unpublished field structures, validation rules, and conditional logic) via `GET /api/form/version/{form}` by supplying the form ID.

**Resolution:**
Fixed `view()` to restrict non-admin users to forms with `status === 'active'` only. Admins retain full access for management purposes.

```php
public function view(User $user, FormDefinition $form): bool
{
    if ($user->isAdmin()) {
        return true;
    }
    return $form->status === 'active';
}
```

---

### BUG-066

**Title:** FormSectionController — section not scoped to parent form in URL (IDOR)
**Module:** Security — Form Builder
**Severity:** High
**Status:** Resolved — Full Audit 2026-03-12

**Description:**
`FormSectionController::update()` and `destroy()` used route model binding to resolve the `{section}` parameter independently of the `{form}` parameter in the URL. A `super_admin` could manipulate a section belonging to a *different* form definition (potentially a published one) by crafting a URL with a mismatched form and section ID. Authorization checks ran against the section's actual parent, bypassing the URL's form.

**Resolution:**
Added `abort_if($section->form_definition_id !== $form->id, 404)` before the authorization check in both `update()` and `destroy()`.

---

### BUG-067

**Title:** FormFieldController — field not scoped to parent section in URL (IDOR)
**Module:** Security — Form Builder
**Severity:** High
**Status:** Resolved — Full Audit 2026-03-12

**Description:**
Same IDOR pattern as BUG-066. `FormFieldController::update()` and `destroy()` resolved `{field}` independently of `{section}`. A `super_admin` could mutate a field from a different section (possibly in a published definition) by crafting the URL.

**Resolution:**
Added `abort_if($field->form_section_id !== $section->id, 404)` before the authorization check in both methods.

---

### BUG-068

**Title:** FormFieldOptionController — option not scoped to parent field in URL (IDOR)
**Module:** Security — Form Builder
**Severity:** High
**Status:** Resolved — Full Audit 2026-03-12

**Description:**
Same IDOR pattern as BUG-066 and BUG-067. `FormFieldOptionController::update()` and `destroy()` resolved `{option}` independently of `{field}`. Cross-field option manipulation was possible.

**Resolution:**
Added `abort_if($option->form_field_id !== $field->id, 404)` before the authorization check in both methods.

---

### BUG-069

**Title:** MedicalRestrictionPolicy::delete() permits medical providers to permanently delete restrictions
**Module:** Security — Medical Portal
**Severity:** Medium
**Status:** Resolved — Full Audit 2026-03-12

**Description:**
`MedicalRestrictionPolicy::delete()` returned `true` for both admins and medical providers. All other Phase 11 medical policies (`MedicalIncidentPolicy`, `MedicalFollowUpPolicy`, `MedicalVisitPolicy`) restrict deletion to admins only. Medical restrictions affect camper safety and represent clinical decisions; allowing medical providers to permanently delete them without admin oversight breaks the audit trail and creates a safety risk.

**Resolution:**
Changed `delete()` to `return $user->isAdmin()` only, consistent with all other Phase 11 medical record deletion policies.

---

### BUG-070

**Title:** DocumentPolicy::view() medical provider check unreachable — providers blocked from authorized documents
**Module:** Security — Document Access Control
**Severity:** High
**Status:** Resolved — Full Audit 2026-03-12

**Description:**
In `DocumentPolicy::view()`, the medical provider access check for `Camper`-attached documents was placed *after* a generic camper ownership check (`$user->campers()->where('id', ...)->exists()`). For medical providers, `campers()` returns an empty collection (they do not own campers), so the ownership check silently returned `false`, and the medical provider check below it was never reached. Medical providers were incorrectly denied access to camper documents they are authorized to view.

**Resolution:**
Moved the medical provider check before the camper ownership check so it runs first. Medical providers pass immediately; applicants fall through to the ownership check.

---

### BUG-071

**Title:** Announcement update/destroy routes lacked admin middleware — route-level enforcement gap
**Module:** Security — Announcements
**Severity:** High
**Status:** Resolved — Full Audit 2026-03-12

**Description:**
The `PUT /{announcement}` and `DELETE /{announcement}` routes in the announcements route group were missing the `->middleware('admin')` directive that `store()` and `togglePin()` had. While the controller methods contained `abort_unless($user->isAdmin(), 403)` checks, the route-level middleware was absent, breaking the defense-in-depth pattern used throughout the API.

**Resolution:**
Added `->middleware('admin')` to both routes in `routes/api.php`.

---

### BUG-072

**Title:** RateLimitingTest MFA assertion incorrect — test asserted wrong effective rate limit
**Module:** Backend Tests — Security
**Severity:** Low
**Status:** Resolved — Full Audit 2026-03-12

**Description:**
`RateLimitingTest::test_mfa_endpoint_rate_limited` was testing the wrong rate limit. `AppServiceProvider` defines a 5/min MFA limit, but `bootstrap/app.php` defines the authoritative rate limiter (which takes precedence since it runs after service provider boot) at **3/min** with a secondary 10/hour limit. The test's loop count did not match the actual effective limit, causing the 429 assertion to fire inside the loop rather than after it.

**Root cause investigation** revealed the actual cache keys used by Laravel 12's `ThrottleRequests` middleware: per-limit keys incorporate `{userId}:attempts:{maxAttempts}:decay:{decaySeconds}` rather than just the user ID, producing keys like `md5('mfa' . '1:attempts:3:decay:60')`.

**Resolution:**
Updated loop count to 3 (matching 3/min effective limit) and renamed method to `test_mfa_endpoint_rate_limited_after_three_attempts`. Updated comment to reference `bootstrap/app.php` as authoritative. The `AppServiceProvider` rate limiter definitions should be reconciled with `bootstrap/app.php` to avoid future confusion — only one location should define named rate limiters.

---

### BUG-073

**Title:** DocumentRequestController lacks a dedicated Policy class — no second layer of authorization
**Module:** Security — Document Requests
**Severity:** Low
**Status:** Resolved (2026-03-19 — System Audit)

**Description:**
`DocumentRequestController` relied entirely on route-level middleware. No `DocumentRequestPolicy` existed, inconsistent with the defense-in-depth pattern used elsewhere.

**Resolution:**
- Created `app/Policies/DocumentRequestPolicy.php` with 8 policy methods: `viewAny`, `view`, `create`, `update`, `delete`, `approve`, `reject`, `upload`, `download`
- Registered `DocumentRequest::class => DocumentRequestPolicy::class` in `AppServiceProvider`
- Added `$this->authorize()` as the first statement in all 14 `DocumentRequestController` methods
- Route list verified: 235 routes, no errors

---

### BUG-074

**Title:** All FormData uploads broken — explicit `Content-Type: multipart/form-data` header omits boundary, causing Laravel to reject multipart body as unparseable
**Module:** Frontend — File Uploads (all portals)
**Severity:** Critical
**Status:** Resolved

**Description:**
Every `FormData` upload call in the frontend used `{ headers: { 'Content-Type': 'multipart/form-data' } }` as the Axios request config. In Axios 1.x, manually setting this header prevents Axios from automatically injecting the multipart boundary token (e.g. `Content-Type: multipart/form-data; boundary=----FormBoundary...`). Without the boundary, Laravel's HTTP kernel cannot delimit the parts of the multipart body and treats the entire payload as unparseable, returning a validation error or empty body — which surfaces to the user as "Failed to send message. Please try again." or silent upload failures.

The correct pattern for FormData in Axios 1.x is `{ headers: { 'Content-Type': undefined } }`, which removes the instance default `application/json` and allows Axios/the browser to set the correct `multipart/form-data; boundary=...` header automatically. This pattern was already used in `profile.api.ts` (avatar upload) — the only working upload prior to this fix.

**Affected files (8 occurrences fixed):**
- `frontend/src/features/messaging/api/messaging.api.ts` — `sendMessage()` with attachments
- `frontend/src/ui/components/DocumentUploader.tsx` — `uploadFile()`
- `frontend/src/features/admin/api/admin.api.ts` — `sendDocumentToApplicant()`, `replaceApplicantDocument()`
- `frontend/src/features/parent/api/applicant.api.ts` — `uploadDocument()`, `submitCompletedDocument()`, `uploadDocumentRequest()`
- `frontend/src/features/provider/pages/ProviderAccessPage.tsx` — `uploadProviderDocument()`
- `frontend/src/features/medical/api/medical.api.ts` — `uploadMedicalDocument()`

**Fix:** Changed `{ headers: { 'Content-Type': 'multipart/form-data' } }` → `{ headers: { 'Content-Type': undefined } }` in all 8 locations.

---

### BUG-075

**Title:** Auth token stored in `sessionStorage` — causes logout on every page refresh across all portals
**Module:** Auth — Token Storage
**Severity:** Critical
**Status:** Resolved

**Description:**
`localStorage.setItem('auth_token', token)` was written in comments and project memory as the intended storage, but every write/read/remove call in the codebase still used `sessionStorage`. `sessionStorage` is scoped to the current browser tab and is cleared when the tab is refreshed in most browsers, making it impossible to stay logged in after a page refresh.

The affected operations:
- **Write on login**: `LoginPage.tsx` lines 105, 197 → `sessionStorage.setItem('auth_token', token)`
- **Read in request interceptor**: `axios.config.ts` line 59 → `sessionStorage.getItem('auth_token')`
- **Read on mount**: `useAuthInit.ts` line 44 → `sessionStorage.getItem('auth_token')`
- **Check on error**: `useAuthInit.ts` line 70 → `sessionStorage.getItem('auth_token')`
- **Remove on unauthorized**: `useAuthInit.ts` line 33 → `sessionStorage.removeItem('auth_token')`
- **Remove on logout**: `auth.api.ts` line 142 → `sessionStorage.removeItem('auth_token')`

**Sequence**: Refresh → Redux resets (in-memory) → `sessionStorage.getItem('auth_token')` returns null → `hydrateAuth()` with no token → `isAuthenticated = false` → `ProtectedRoute` redirects to `/login`.

**Fix:** Changed all 6 `sessionStorage` calls to `localStorage` across `useAuthInit.ts`, `axios.config.ts`, `auth.api.ts`, and `LoginPage.tsx`. Updated all stale comments in `App.tsx`, `ProtectedRoute.tsx`, `store/index.ts`.

---

### BUG-076

**Title:** Admin/Super-Admin Campers page always shows "Failed to load data" — `CamperController::index()` unnecessarily eager-loads encrypted PHI causing `DecryptException` (500)
**Module:** Admin Portal — Campers
**Severity:** Critical
**Status:** Resolved

**Description:**
`CamperController::index()` for admin/super_admin roles eagerly loaded `['user', 'medicalRecord.allergies', 'medicalRecord.medications']`. Both `Allergy` and `Medication` models have fully encrypted PHI fields (via Laravel's `encrypted` cast): `allergen`, `reaction`, `treatment` (Allergy) and `name`, `dosage`, `frequency`, `purpose`, `prescribing_physician`, `notes` (Medication). `MedicalRecord` itself also has 8 encrypted PHI columns.

Loading and serializing these encrypted models in a paginated list context means decrypting PHI for every allergy and medication for every camper on every page load. If any encryption key mismatch or decryption error occurs (e.g. rows seeded with a different `APP_KEY`, or null/corrupt ciphertext), PHP throws `DecryptException` → Laravel returns HTTP 500 → frontend's catch block sets `setError(true)` → "Failed to load data." appears.

**Secondary problem fixed**: The admin campers list page displays a `Session` column using `camper.applications?.[0]?.session?.name`, but `applications` was never loaded in the index. The column always showed "None". This is now fixed by loading `applications.campSession` (which the `Application` model exposes as the `session` virtual attribute).

**Affected file**: `backend/app/Http/Controllers/Api/Camper/CamperController.php` line 55

**Fix:** Changed `Camper::with(['user', 'medicalRecord.allergies', 'medicalRecord.medications'])` to `Camper::with(['user', 'applications.campSession'])` in the admin branch of `index()`. Medical data is loaded only on the individual camper detail page (`show()`), not on the list page.

---

### BUG-077

**Title:** Admin/Super-Admin Applications page always shows "Failed to load data" — `ApplicationController::index()` unnecessarily eager-loads encrypted PHI via `camper.medicalRecord`
**Module:** Admin Portal — Applications
**Severity:** Critical
**Status:** Resolved

**Description:**
Same encrypted PHI eager-load pattern as BUG-076. `ApplicationController::index()` for both the admin branch (lines 74-79) and the applicant branch (lines 133-140) eager-loaded `'camper.medicalRecord'`. The `MedicalRecord` model has 8 fully-encrypted PHI columns (via Laravel's `encrypted` cast). Loading and serializing these fields for every application in the list caused potential `DecryptException` → HTTP 500 → "Failed to load data" in the frontend.

The Applications list page does not display any medical record data — it shows camper name, parent name, session, status, and submission date only. Loading `medicalRecord` was both unnecessary and dangerous.

**Fix:** Removed `'camper.medicalRecord'` from both the admin and applicant eager-load chains in `ApplicationController::index()`.

**Affected file:** `backend/camp-burnt-gin-api/app/Http/Controllers/Api/Camper/ApplicationController.php`

---

### BUG-078

**Title:** Admin Reports page shows 0 accepted applications and charts show "No data yet" — `ReportController::summary()` uses key `'accepted'` but `ApplicationStatus` enum value is `'approved'`
**Module:** Admin Portal — Reports
**Severity:** High
**Status:** Resolved

**Description:**
`ReportController::summary()` at line 92 used `$apps['accepted'] ?? 0` to populate the `accepted_applications` dashboard counter. The `ApplicationStatus` enum has no `Accepted` case — the correct case is `Approved` with a value of `'approved'`. Since `$apps` is keyed by the raw DB status string, `$apps['accepted']` was always `null`, falling back to `0`. The `accepted_applications` field in the API response was always 0 regardless of how many approved applications existed.

Additionally `AdminReportsPage.tsx` referenced `byStatus['accepted']` (always 0) and `byStatus['submitted']` (no such status exists in the enum) for chart data, meaning the "Applications by Status" bar chart never showed approved applications, and the acceptance rate donut chart always showed 0%.

**Fixes:**
1. `ReportController::summary()`: `$apps['accepted'] ?? 0` → `$apps['approved'] ?? 0`; removed `($apps['submitted'] ?? 0)` from the pending aggregation.
2. `AdminReportsPage.tsx`: `byStatus['accepted']` → `byStatus['approved']`; removed stale `submitted` status from chart data; added `cancelled` as a chart bar; updated `CHART_COLORS` to use `approved` key; updated pie chart label "Accepted" → "Approved".

**Affected files:**
- `backend/camp-burnt-gin-api/app/Http/Controllers/Api/System/ReportController.php`
- `frontend/src/features/admin/pages/AdminReportsPage.tsx`

---

### BUG-079

**Title:** Wrong MFA code triggers global logout — `/mfa/` not in `isPublicAuthEndpoint` exclusion list
**Module:** Auth — MFA
**Severity:** High
**Status:** Resolved

**Description:**
The axios response interceptor fires the `auth:unauthorized` custom window event whenever a 401 response is received from any endpoint not in the `isPublicAuthEndpoint` whitelist. The whitelist only covered `/auth/login`, `/auth/register`, `/auth/forgot-password`, and `/auth/reset-password`. The MFA endpoint (`/mfa/verify`) was not included.

When a user entered a wrong MFA code, the backend returned 401. The interceptor treated this as a session expiry event, fired `auth:unauthorized`, which triggered `handleUnauthorized` in `useAuthInit`. The previous (unfixed) version of `handleUnauthorized` immediately cleared the token from localStorage and dispatched `clearAuth()`, logging the user out entirely. Even with the `handleUnauthorized` re-validation fix (BUG context), excluding the MFA endpoint is still the correct fix: a wrong MFA code is not a session expiry and should never trigger global auth re-validation logic.

**Fix:**
Added `url.includes('/mfa/')` to the `isPublicAuthEndpoint` check in the response interceptor. MFA 401s now pass through as normal rejected promises so the MFA page can display its own "invalid code" error message.

**Affected file:**
- `frontend/src/api/axios.config.ts`

---

### BUG-080

**Title:** Admin/super-admin portal turns into applicant portal when left idle — layout guards redirect to `getDashboardRoute(role)` which resolves to `/applicant/dashboard` when Redux role is stale
**Module:** Auth — Layout Guards
**Severity:** Critical
**Status:** Resolved

**Description:**
`AdminLayout` and `SuperAdminLayout` guard access by checking the Redux auth state. If `!hasAccess` (either because the user is not authenticated, or their role in Redux is wrong), both layouts redirected to `getDashboardRoute(getPrimaryRole(user?.roles ?? []))`.

The problem is that `getPrimaryRole([])` returns `'applicant'` as a fallback, and `getDashboardRoute('applicant')` returns `/applicant/dashboard`. So whenever Redux auth state becomes stale (e.g. after a 401 triggered `clearAuth()`, or cross-tab login as a different user), an admin visiting `/admin/*` would be silently routed into the applicant portal — the entire applicant sidebar, nav, and UI would render under the admin user's session.

This was the root cause of the reported symptom: "when super admin and admin are left idle, the portal turns into the applicant portal."

The trigger chain:
1. Admin leaves the portal idle.
2. A background API call (e.g., `DashboardHeader` notification poll, or a stale Axios retry) returns 401.
3. The 401 interceptor fires `auth:unauthorized`.
4. `handleUnauthorized` (before the BUG-079 / re-validation fix) clears auth → `clearAuth()` dispatches.
5. Redux `user` becomes `null` / `roles` becomes `[]`.
6. On next render, `AdminLayout` detects `!hasAccess`, calls `getDashboardRoute(getPrimaryRole([]))` → `/applicant/dashboard`.
7. The admin is now in the applicant portal.

**Fix:**
Changed both `AdminLayout` and `SuperAdminLayout` to redirect to `/forbidden` when `!hasAccess`, instead of computing a role-derived route. `/forbidden` is a standalone page with no portal layout — it surfaces a clear "access denied" message and a link back to login. This eliminates the incorrect portal-switch entirely.

**Affected files:**
- `frontend/src/ui/layout/AdminLayout.tsx`
- `frontend/src/ui/layout/SuperAdminLayout.tsx`

---

### BUG-081

**Title:** Campers page search causes 500 "Column not found: full_name" — `CamperController::index()` uses `full_name` in SQL WHERE clause but it's a virtual accessor with no DB column
**Module:** Admin Portal — Campers
**Severity:** Critical
**Status:** Resolved

**Description:**
`CamperController::index()` used `$q->where('full_name', 'like', '%' . $search . '%')` in both the admin and medical provider search branches. `full_name` is computed at runtime by `getFullNameAttribute()` (concatenating `first_name` and `last_name`) and is declared in `$appends`. It has no backing column in the `campers` table — the migration only creates `first_name` and `last_name`.

Any search in the Campers page triggered:
```
SQLSTATE[42S22]: Column not found: 1054 Unknown column 'full_name' in 'where clause'
```
This returned a 500 to the frontend, setting `setError(true)` and displaying "Failed to load data." The error state persisted even after clearing the search box because the `error` state flag stayed `true` until a Retry was clicked.

**Fix:**
Replaced `WHERE full_name LIKE %term%` with `WHERE first_name LIKE %term% OR last_name LIKE %term%` in both the admin branch and medical provider branch search closures.

**Affected file:**
- `backend/camp-burnt-gin-api/app/Http/Controllers/Api/Camper/CamperController.php`

---

### BUG-082

**Title:** `RoleGuard` sends authenticated users with missing role data to `/login`, causing an infinite redirect loop with `ProtectedRoute`
**Module:** Auth — RBAC
**Severity:** High
**Status:** Resolved

**Description:**
When a user is authenticated (`isAuthenticated = true`) but `user.roles` is empty or malformed (e.g., after a `setUser()` call with incomplete data), `RoleGuard` could not determine a `roleName` and redirected to `/login`. This created a loop:

1. `ProtectedRoute` sees `isAuthenticated = true` → renders children
2. `RoleGuard` sees `!roleName` → redirects to `/login`
3. `LoginPage` renders. If it redirects authenticated users away, back to step 1.

This was a secondary cause of the "all pages fail" symptom — not a 401 loop but a route-guard loop that could prevent any protected page from loading.

**Fix:**
Split the `!user || !roleName` condition into two separate checks:
- `!user` → redirect to `/login` (user is not authenticated at all)
- `!roleName` → redirect to `/forbidden` (user is authenticated but role data is bad — a data/config issue, not an auth issue)

**Affected file:**
- `frontend/src/core/auth/RoleGuard.tsx`

---

### BUG-099

**Title:** Admin Campers page "Failed to load data" — `ApplicationStatus` enum missing `Waitlisted` case
**Module:** Admin Portal — Applications
**Severity:** Critical
**Status:** Resolved

**Description:**
`CamperController::index()` (admin branch) eager-loads `applications.campSession`. The `Application` model casts the `status` column to the `ApplicationStatus` PHP enum. When any application in the database had `status = 'waitlisted'` (set by the Phase 15 capacity gate), Laravel's `::from('waitlisted')` call threw a `ValueError` during JSON serialization, returning a 500 to the frontend. The Campers page caught this with `catch { setError(true) }` and rendered "Failed to load data".

Log evidence (20+ identical entries 2026-03-16):
```
"waitlisted" is not a valid backing value for enum App\Enums\ApplicationStatus
[...] CamperController.php(104): ResponseFactory->json(Array)
```

**Fix:**
Added `case Waitlisted = 'waitlisted'` to `app/Enums/ApplicationStatus.php`. No errors in logs after this fix.

**Affected file:**
- `backend/camp-burnt-gin-api/app/Enums/ApplicationStatus.php`

---

### BUG-100

**Title:** `SessionDetailPage` always 404s — `SessionDashboardController` routes not registered
**Module:** Admin Portal — Sessions
**Severity:** Critical
**Status:** Resolved

**Description:**
Phase 15 created `SessionDashboardController` with `dashboard()` and `applications()` methods, and the frontend `SessionDetailPage` calls `GET /api/sessions/{id}/dashboard`. However the routes were never added to `routes/api.php`. Every request to the session detail page returned 404, rendering the page permanently broken.

**Fix:**
Added three routes inside the `sessions` prefix group in `api.php`:
```php
Route::get('/{session}/dashboard', [SessionDashboardController::class, 'dashboard'])->middleware('admin');
Route::get('/{session}/applications', [SessionDashboardController::class, 'applications'])->middleware('admin');
Route::post('/{session}/archive', [CampSessionController::class, 'archive'])->middleware('admin');
```
Also imported `SessionDashboardController` at the top of `api.php`.

**Affected files:**
- `backend/camp-burnt-gin-api/routes/api.php`

---

### BUG-101

**Title:** `CampSessionController` allows deleting sessions with applications; archive action missing
**Module:** Admin Portal — Sessions
**Severity:** High
**Status:** Resolved

**Description:**
`CampSessionController::destroy()` deleted a session unconditionally even when applications existed, which would orphan application records and break the applicant portal. Phase 15 MEMORY documented this as fixed (BUG-096) but the actual code change was never applied. Additionally, the `archive()` action (set `is_active = false`) was documented as added but also missing.

**Fix:**
1. Added application-existence guard to `destroy()` — returns 422 if any applications are linked.
2. Added `archive()` action — sets `is_active = false`, preserving all application records.
Added `enrolled_count`, `remaining_capacity` accessors and `isAtCapacity()` helper to `CampSession` model.

**Affected files:**
- `backend/camp-burnt-gin-api/app/Http/Controllers/Api/Camp/CampSessionController.php`
- `backend/camp-burnt-gin-api/app/Models/CampSession.php`

---

### BUG-102

**Title:** `waitlisted` and `under_review` share identical amber color in StatusBadge — visually indistinguishable
**Module:** UI — Status Badges
**Severity:** High
**Status:** Resolved (2026-03-19 — System Audit)

**Description:**
Both `waitlisted` and `under_review` used the same amber styling (`rgba(234,179,8,0.15)`, `#854d0e`). Staff could not visually distinguish waitlisted applicants from those under active review.

**Fix:**
- `under_review` → blue: `rgba(37,99,235,0.12)` / `#2563eb`
- `waitlisted` → orange: `rgba(234,88,12,0.12)` / `#ea580c`
- Removed legacy `submitted` and `accepted` variants (not in ApplicationStatus enum, never referenced)

**Affected files:**
- `frontend/src/ui/components/StatusBadge.tsx`

---

### BUG-103

**Title:** Email verification not enforced — unverified users access full system after registration
**Module:** Auth — Email Verification
**Severity:** High
**Status:** Resolved (2026-03-19 — System Audit)

**Description:**
`User` model implements `MustVerifyEmail` and `/auth/email/verify` route exists, but the `verified` middleware was never applied to the main protected route group. Newly registered users could access applications, campers, and all admin functions without verifying their email.

**Fix:**
Restructured `routes/api.php` into three tiers:
1. Public (no auth): login, register, forgot-password, reset-password, email verify
2. Auth-only unverified (`auth:sanctum`): logout, MFA, resend verification
3. Protected (`auth:sanctum` + `verified`): all 200+ remaining routes

**Affected files:**
- `backend/camp-burnt-gin-api/routes/api.php`

---

### BUG-104

**Title:** AdminReportsPage silently drops `waitlisted` applications from all charts
**Module:** Admin Portal — Reports
**Severity:** High
**Status:** Resolved (2026-03-19 — System Audit)

**Description:**
`CHART_COLORS` and `statusCounts` in AdminReportsPage only covered 4 statuses (pending, under_review, approved, rejected). Any `waitlisted` applications were filtered out by `.filter((s) => s.value > 0)` since the key was missing — producing incorrect totals and acceptance rate calculations.

**Fix:**
- Added `waitlisted: '#ea580c'` to `CHART_COLORS`
- Added `{ name: 'Waitlisted', value: byStatus['waitlisted'] ?? 0, color: CHART_COLORS.waitlisted }` to `statusCounts`

**Affected files:**
- `frontend/src/features/admin/pages/AdminReportsPage.tsx`

---

### BUG-105

**Title:** Risk level never displayed in UI — backend endpoint and API client exist but CamperDetailPage never calls them
**Module:** Admin Portal — Camper Management
**Severity:** Medium
**Status:** Resolved (2026-03-19 — System Audit)

**Description:**
`GET /api/campers/{id}/risk-summary` endpoint and `getCamperRiskSummary()` API client function both existed but `CamperDetailPage` and `MedicalEmergencyViewPage` never called them. Risk assessment data was silently discarded.

**Fix:**
- Added risk data fetch (non-blocking) to `CamperDetailPage` useEffect
- Added "Risk Assessment" section card showing: color-coded score (green/orange/red), supervision label + staffing ratio, complexity label, flags list
- Added inline risk badge to `MedicalEmergencyViewPage` header

**Affected files:**
- `frontend/src/features/admin/pages/CamperDetailPage.tsx`
- `frontend/src/features/medical/pages/MedicalEmergencyViewPage.tsx`

---

## Summary

### By Severity

| Severity | Total | Resolved | Open |
|----------|-------|----------|------|
| Critical | 30 | 27 | 3 |
| High | 41 | 40 | 1 |
| Medium | 20 | 17 | 3 |
| Low | 15 | 14 | 1 |
| **Total** | **106** | **98** | **8** |

_Note: counts above reflect tracked entries in this file. MEMORY.md carries the running total across all phases._

### By Status

| Status | Count |
|--------|-------|
| Resolved | 76 |
| Open | 9 |

### Open Issues

| ID | Title | Severity |
|----|-------|----------|
| BUG-021 | Form Management files stored on local disk — not accessible in production | High |
| BUG-024 | Password reset sends no confirmation email | Medium |
| BUG-030 | Applicant portal has no past applications history with filter/sort | Medium |
| BUG-031 | Password change uses min 8 chars; reset requires 12+ with complexity | Medium |
| BUG-032 | SettingsPage password form validates min 8 chars — inconsistent with reset policy | Medium |
| BUG-033 | Super Admin role filter uses raw slugs, not user-friendly labels | Low |
| BUG-046 | Applicant login broken — known blocking issue | Critical |

### By Module

| Module | Issue IDs |
|--------|-----------|
| Role Naming / RBAC | BUG-001, BUG-006, BUG-033 |
| Email Verification | BUG-002, BUG-004 |
| Password Reset | BUG-003, BUG-024, BUG-031, BUG-032 |
| Medical Portal | BUG-007, BUG-008, BUG-028, BUG-034 |
| Admin — Camper Management | BUG-005, BUG-029, BUG-042, BUG-043, BUG-047 |
| Applicant Portal | BUG-009, BUG-011, BUG-030 |
| Applicant — Application Form | BUG-010, BUG-054 |
| Seeders | BUG-012 |
| Audit Log | BUG-013 |
| Profile System | BUG-014, BUG-036, BUG-037, BUG-040, BUG-041 |
| Inbox / Messaging | BUG-015, BUG-016, BUG-017, BUG-049, BUG-050, BUG-056 |
| Document Upload | BUG-055, BUG-074 |
| Recent Updates | BUG-018 |
| Super Admin Portal | BUG-019 |
| Form Management | BUG-020, BUG-021 |
| Admin Reports | BUG-022, BUG-023 |
| Notification Settings | BUG-027 |
| Documentation | BUG-025, BUG-026 |
| Security | BUG-031, BUG-032 |
| Admin — Application Review | BUG-035, BUG-038, BUG-039, BUG-048 |
| Auth — Login / Session | BUG-044, BUG-045, BUG-046, BUG-051, BUG-075 |
| UI — Status Badges | BUG-052, BUG-053 |
| Form Builder — Backend | BUG-057, BUG-058, BUG-059, BUG-060, BUG-061 |
| UI — Layout | BUG-063 |
| Frontend — Accessibility / Static Analysis | BUG-064 |
| Auth — Token Configuration | BUG-062 |
| Security — Form Builder (IDOR / Authorization) | BUG-065, BUG-066, BUG-067, BUG-068 |
| Security — Medical Portal | BUG-069 |
| Security — Document Access Control | BUG-070 |
| Security — Announcements | BUG-071 |
| Backend Tests — Security | BUG-072 |
| Security — Document Requests | BUG-073 |
| Frontend — File Uploads (all portals) | BUG-074 |
| Admin Portal — Campers | BUG-076, BUG-081 |
| Admin Portal — Applications | BUG-077 |
| Admin Portal — Reports | BUG-078 |
| Auth — MFA | BUG-079 |
| Auth — Layout Guards | BUG-080 |
| Auth — RBAC | BUG-082 |
| Admin Portal — Stability (Enum / Routes) | BUG-099, BUG-100, BUG-101 |
| Admin Portal — Application Review | BUG-106 |
| Admin Portal — Applications (Data Leak) | BUG-107 |
| Document Requests — Storage | BUG-108 |
| Applicant Portal — Draft Submission | BUG-109 |
| Security — Notifications | BUG-110 |
