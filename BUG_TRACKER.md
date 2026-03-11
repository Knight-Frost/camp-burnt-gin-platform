# Camp Burnt Gin — Bug Tracker

**Created:** Phase 1 System Audit
**Last Updated:** Phase 14 — Issues BUG-057 through BUG-061 (security fixes)
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
| BUG-031 | Password change uses min 8 chars; password reset requires 12+ with complexity | Security | Medium | Open |
| BUG-032 | SettingsPage password form validates min 8 chars — inconsistent with reset policy | Security | Medium | Open |
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
| BUG-046 | Applicant login broken — blocking issue | Auth — Applicant Login | Critical | Open |
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
**Status:** Open — Known Blocking Issue

**Description:**
Applicant (`applicant` role) login is broken. After submitting valid credentials, the login flow fails to complete or redirects incorrectly. This issue was investigated over multiple sessions without resolution. It does not affect `admin`, `super_admin`, or `medical` role logins. Root cause is not yet confirmed — likely involves token handling, role resolution, or redirect logic specific to the applicant portal entry path.

**Suspected Files:**
- `frontend/src/features/auth/hooks/useAuthInit.ts`
- `frontend/src/core/auth/ProtectedRoute.tsx`
- `frontend/src/core/routing/index.tsx` (applicant portal guard)
- `backend/.../app/Http/Controllers/Api/Auth/AuthController.php`

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

## Summary

### By Severity

| Severity | Total | Resolved | Open |
|----------|-------|----------|------|
| Critical | 17 | 14 | 3 |
| High | 21 | 19 | 2 |
| Medium | 14 | 11 | 3 |
| Low | 9 | 9 | 0 |
| **Total** | **61** | **53** | **8** |

### By Status

| Status | Count |
|--------|-------|
| Resolved | 53 |
| Open | 8 |

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
| Document Upload | BUG-055 |
| Recent Updates | BUG-018 |
| Super Admin Portal | BUG-019 |
| Form Management | BUG-020, BUG-021 |
| Admin Reports | BUG-022, BUG-023 |
| Notification Settings | BUG-027 |
| Documentation | BUG-025, BUG-026 |
| Security | BUG-031, BUG-032 |
| Admin — Application Review | BUG-035, BUG-038, BUG-039, BUG-048 |
| Auth — Login / Session | BUG-044, BUG-045, BUG-046, BUG-051 |
| UI — Status Badges | BUG-052, BUG-053 |
| Form Builder — Backend | BUG-057, BUG-058, BUG-059, BUG-060, BUG-061 |
