# Camp Burnt Gin — Bug Tracker

**Created:** Phase 1 System Audit
**Last Updated:** Phase 2
**Format:** ID | Title | Module | Severity | Status | Affected Files

---

## Severity Legend

| Level | Meaning |
|-------|---------|
| Critical | Broken functionality, security gap, or data integrity risk |
| High | Significant feature gap or UX failure preventing core workflow |
| Medium | Partial implementation, wrong behavior, or missing secondary feature |
| Low | Minor inconsistency, stale code, or cosmetic issue |

---

## Status Legend

| Status | Meaning |
|--------|---------|
| Open | Identified, not yet fixed |
| In Progress | Actively being implemented |
| Resolved | Fixed and verified |

---

## Issues

---

### BUG-001
**Title:** Role name "parent" used throughout — must be renamed to "Applicant"
**Module:** Role Naming / RBAC
**Severity:** High
**Status:** Resolved — Phase 2
**Description:** The system-wide role name `parent` is used in the database seeder, Role model seed data, AuthService registration, User model methods (`isParent()`), all `/parent/` route prefixes, frontend layout components, route guards, and i18n keys. The intended user-facing label is "Applicant." All occurrences must be consistently updated.
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
**Description:** The `User` model has `MustVerifyEmail` commented out. There is no email verification token generation, no verification email, no `/auth/verify-email` route, and no middleware enforcing verified status before granting access. The `email_verified_at` column exists in the DB but is never set by an email verification flow. The ProfilePage shows "Verified / Not verified" status but there is no way for a user to trigger a verification email.
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
**Description:** A duplicate `PasswordResetService.php` exists at `app/Services/PasswordResetService.php` (namespace `App\Services`) in addition to the correct file at `app/Services/Auth/PasswordResetService.php` (namespace `App\Services\Auth`). The controller correctly imports the `Auth\` version. The root-level copy is stale dead code and should be removed to prevent confusion.
**Affected Files:**
- `backend/.../app/Services/PasswordResetService.php` (stale — should be deleted)

---

### BUG-004
**Title:** account deactivation incorrectly repurposes email_verified_at
**Module:** User Management / Email Verification
**Severity:** High
**Status:** Resolved — Phase 2
**Description:** `UserController::deactivate()` sets `email_verified_at = null` to deactivate a user, and `reactivate()` sets `email_verified_at = now()`. This conflates email verification state with account activation state. A user who registers but has not verified their email and a user who has been deactivated by an admin are indistinguishable in the database. A dedicated `is_active` boolean column is required.
**Affected Files:**
- `backend/.../app/Http/Controllers/Api/System/UserController.php`
- `backend/.../database/migrations/` (migration needed for `is_active` column)
- `backend/.../app/Models/User.php`

---

### BUG-005
**Title:** Broken routes — Admin/Super Admin camper detail and risk pages do not exist
**Module:** Admin / Super Admin — Camper Management
**Severity:** Critical
**Status:** Open
**Description:** `AdminCampersPage` renders two links per camper row: `Link to="/admin/campers/${camper.id}"` (view) and `Link to="/admin/campers/${camper.id}/risk"` (risk summary). Neither route is defined in `core/routing/index.tsx`. Clicking either link results in a 404/NotFoundPage. No camper detail page component exists in the codebase.
**Affected Files:**
- `frontend/src/core/routing/index.tsx` (missing `/admin/campers/:id` and `/admin/campers/:id/risk`)
- `frontend/src/features/admin/pages/AdminCampersPage.tsx`
- `frontend/src/features/admin/pages/` (CamperDetailPage missing entirely)
- Same issue reproduced at `/super-admin/campers` which also uses `AdminCampersPage`

---

### BUG-006
**Title:** Frontend role-based routing not enforced — RoleGuard defined but never used
**Module:** RBAC / Routing
**Severity:** High
**Status:** Resolved — Phase 2
**Description:** `RoleGuard.tsx` is defined but is not applied to any route in `core/routing/index.tsx`. `ProtectedRoute` only checks authentication; it does not enforce role-appropriate portal access. A user with the `parent` role can manually navigate to `/admin/dashboard` or `/super-admin/audit` and the route will render. Backend policies prevent data access, but the frontend renders the wrong portal shell, potentially exposing UI structure intended for admins.
**Affected Files:**
- `frontend/src/core/routing/index.tsx` (RoleGuard not applied)
- `frontend/src/core/auth/RoleGuard.tsx` (defined but unused)
- `frontend/src/core/auth/ProtectedRoute.tsx`

---

### BUG-007
**Title:** Medical portal is read-only — no write capabilities for on-site medical staff
**Module:** Medical Portal
**Severity:** Critical
**Status:** Open
**Description:** The medical portal (`/medical`) is entirely read-only. Medical staff can browse camper medical records but cannot update records, upload medical documents, record treatments or interventions, log medication administrations, or track real-time medical events during camp. For an on-site camp medical team, this makes the portal non-functional as a clinical tool. The backend has write endpoints for medical data (PUT on medical records, allergies, medications, etc.) but they are not surfaced in the medical portal UI.
**Affected Files:**
- `frontend/src/features/medical/pages/MedicalDashboardPage.tsx`
- `frontend/src/features/medical/pages/MedicalRecordPage.tsx`
- `frontend/src/features/medical/api/medical.api.ts`
- `backend/.../app/Http/Controllers/Api/Medical/MedicalRecordController.php`
- `backend/.../app/Policies/MedicalRecordPolicy.php` (may need write permissions for medical role)

---

### BUG-008
**Title:** External medical provider upload link system should be removed
**Module:** Medical Workflow / Provider Links
**Severity:** High
**Status:** Resolved — Phase 2
**Description:** The system has a `/provider-access/:token` route and a full `MedicalProviderLinkController` that allows external providers to access and upload medical forms via secure expiring tokens. Per Phase 2 requirements, all medical document uploads must occur through the Medical Portal for camp medical staff only. The provider link system creates an external access vector that is outside the intended scope.
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
**Description:** There is no `/parent/documents` route or page. Applicants cannot upload, manage, or review documents independently of the application form. Documents are only visible inside the application detail view as read-only. The application form (Section 9) handles document uploads inline but there is no persistent document management area for applicants.
**Resolution:** Created `ApplicantDocumentsPage.tsx` at `/applicant/documents` with upload (drag & drop), PDF/image preview modal, and delete. Added `getDocuments`, `deleteDocument`, `uploadDocument` to `parent.api.ts`. Added route and "Documents" nav item to `ParentLayout`.
**Affected Files:**
- `frontend/src/core/routing/index.tsx`
- `frontend/src/features/parent/pages/ApplicantDocumentsPage.tsx`
- `frontend/src/features/parent/api/parent.api.ts`
- `frontend/src/ui/layout/ParentLayout.tsx`
- `frontend/src/shared/constants/routes.ts`

---

### BUG-010
**Title:** ApplicationFormPage header comment incorrectly states sections 6-10 are Phase 2 / not yet implemented
**Module:** Applicant Application Form
**Severity:** Low
**Status:** Resolved — Phase 3
**Description:** The file comment at the top of `ApplicationFormPage.tsx` says "Phase 1 (current): Scaffold + Sections 1–5" and "Phase 2: Sections 6–10 + submission guard + final API submit." In fact, all 10 sections are fully defined in `FormState` and rendered in the file, and `handleSubmit()` exists with full submit logic. The comment is stale and misleading. It should be removed.
**Resolution:** Removed stale Phase 1/2 header comments. Removed `phase` field from `SectionDef` and SECTIONS array. Removed dead `if (s.phase === 2) return 'unavailable'` guard from `getSectionStatus`. Updated route comment to `/applicant/applications/new`.
**Affected Files:**
- `frontend/src/features/parent/pages/ApplicationFormPage.tsx`

---

### BUG-011
**Title:** No explicit "Save Draft" button — draft behavior is implicit auto-save only
**Module:** Applicant Application Form
**Severity:** Medium
**Status:** Resolved — Phase 3
**Description:** The application form auto-saves to localStorage every 3 seconds but there is no visible "Save Draft" button that clearly communicates to users that their progress is being saved. Users may be unsure whether progress is persisted. Per Phase 3 requirements, an explicit Save Draft button should be added to the UI.
**Resolution:** Added `handleSaveDraft()` function and a "Save Draft" `Button` (variant="secondary") in the page header. Triggers immediate `persistDraft(form)` + `toast.success`. Auto-save remains intact.
**Affected Files:**
- `frontend/src/features/parent/pages/ApplicationFormPage.tsx`

---

### BUG-012
**Title:** Seeder conflict — DatabaseSeeder and DevSeeder both create admin@example.com and medical@example.com with different names
**Module:** Seeders
**Severity:** Medium
**Status:** Resolved — Phase 2
**Description:** `DatabaseSeeder` creates `admin@example.com` with name "Test Admin" and `medical@example.com` with name "Test Medical Staff" before calling `DevSeeder`. `DevSeeder` attempts to create the same emails with names "Alex Rivera" and "Dr. Morgan Chen" using `firstOrCreate`. Because `DatabaseSeeder` runs first, `DevSeeder`'s `firstOrCreate` finds existing records and skips creation — the demo-quality names are never applied. Development environments end up with generic "Test Admin" names instead of the realistic demo data.
**Affected Files:**
- `backend/.../database/seeders/DatabaseSeeder.php`
- `backend/.../database/seeders/DevSeeder.php`

---

### BUG-013
**Title:** Audit log displays raw vague action names — not human-readable
**Module:** Super Admin Audit Log
**Severity:** High
**Status:** Open
**Description:** The audit log UI displays raw action strings like `view`, `update`, `delete`, `created`, `reviewed` with no human-readable context. There are no human-readable event descriptions (e.g. "Alex Rivera approved Application #42"), no before/after values for updates, no event categories, no expandable detail panels, and no export functionality. The IP address field exists in the backend response but is not prominently displayed. Filtering is limited to search text and date range with no action type or category filter.
**Affected Files:**
- `frontend/src/features/superadmin/pages/AuditLogPage.tsx`
- `backend/.../app/Http/Controllers/Api/System/AuditLogController.php`
- `backend/.../app/Models/AuditLog.php`
- `backend/.../app/Observers/` (audit log entries lack descriptive content)

---

### BUG-014
**Title:** Profile system is minimal — missing most fields from Phase 4 requirements
**Module:** Profile System
**Severity:** High
**Status:** Resolved — Phase 4
**Description:** The current `ProfilePage` only supports name, email update, and MFA setup/disable. Missing: profile photo/avatar, preferred name, phone number, date of birth, contact address, emergency contacts management, privacy settings, language/locale settings, account activity log (login history), data export, and account deletion. The `SettingsPage` only has appearance, security (password), and notifications tabs. Role-specific settings are entirely missing.
**Resolution:**
- Added migration for profile fields: preferred_name, phone, avatar_path, address_line_1, address_line_2, city, state, postal_code, country
- Added migration + model for user_emergency_contacts table
- Expanded UserProfileController with: uploadAvatar, removeAvatar, listEmergencyContacts, storeEmergencyContact, updateEmergencyContact, destroyEmergencyContact, requestDataExport, deleteAccount
- Updated User model fillable + userEmergencyContacts() relationship
- Added UserEmergencyContactPolicy + registered in AppServiceProvider
- Added new profile API routes: POST /profile/avatar, DELETE /profile/avatar, CRUD /profile/emergency-contacts, POST /profile/data-export, DELETE /profile/account
- Expanded ProfilePage.tsx: avatar upload/remove, preferred name, phone, full address form, emergency contacts manager (add/edit/delete/set primary)
- Added "Data & Account" tab to SettingsPage.tsx: data export request + account deletion with password confirmation
- Updated profile.api.ts: uploadAvatar, removeAvatar, getEmergencyContacts, createEmergencyContact, updateEmergencyContact, deleteEmergencyContact, requestDataExport, deleteAccount
- Updated user.types.ts: extended User interface + added UserEmergencyContact type
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
**Title:** Inbox / Messaging — starred state persisted only in localStorage, not backend
**Module:** Inbox / Messaging
**Severity:** Medium
**Status:** Open
**Description:** Starred conversations are tracked via a `Set<number>` stored in `localStorage` under key `inbox_starred_ids`. Stars are not persisted to the backend database. Stars are lost when localStorage is cleared, do not sync across devices or browsers, and disappear if the user logs in on a different machine.
**Affected Files:**
- `frontend/src/features/messaging/pages/InboxPage.tsx`
- `backend/.../database/migrations/` (no `is_starred` field on conversation_participants or messages)

---

### BUG-016
**Title:** Inbox missing: Drafts, Sent, Trash (with restore), Scheduled send, Important folder
**Module:** Inbox / Messaging
**Severity:** High
**Status:** Open
**Description:** The inbox UI has tabs: All, Applicants, Medical Team, System, Announcements, Archive. Missing folders per Phase 8 requirements: Starred (client-side only currently), Important (no backend field), Sent, Drafts (compose auto-save not implemented), Trash (soft-delete exists in DB but not exposed in UI with restore), and Scheduled send. The current layout is two-panel (list + thread) — not three-panel as required.
**Affected Files:**
- `frontend/src/features/messaging/pages/InboxPage.tsx`
- `frontend/src/features/messaging/api/messaging.api.ts`
- `backend/.../database/migrations/2026_02_13_000002_create_conversation_participants_table.php` (no `is_starred`, `is_important` columns)
- `backend/.../database/migrations/2026_02_13_000003_create_messages_table.php` (no `scheduled_for`, `sent_at` columns)

---

### BUG-017
**Title:** Inbox imports `Bot` icon — AI reference should not appear in UI
**Module:** Inbox / Messaging
**Severity:** Low
**Status:** Resolved — Phase 2
**Description:** `InboxPage.tsx` imports `Bot` from `lucide-react`. Per global rules, no AI-related references should appear in the repository UI. This import must be removed.
**Affected Files:**
- `frontend/src/features/messaging/pages/InboxPage.tsx`

---

### BUG-018
**Title:** Recent Updates system does not exist as a distinct feature
**Module:** Recent Updates
**Severity:** Medium
**Status:** Open
**Description:** There is no standalone "Recent Updates" or "Activity Feed" module. Admin and parent dashboards show notifications and a review queue, but there is no component that shows what changed, who changed it, and when — in a clear, chronological, human-readable format. Dashboards show counts and review queues but not a meaningful activity feed.
**Affected Files:**
- `frontend/src/features/admin/pages/AdminDashboardPage.tsx`
- `frontend/src/features/parent/pages/ParentDashboardPage.tsx`
- `frontend/src/features/superadmin/pages/SuperAdminDashboardPage.tsx`
- (New component required)

---

### BUG-019
**Title:** Super Admin dashboard quick links point to /admin/* routes — not /super-admin/*
**Module:** Super Admin Portal
**Severity:** Medium
**Status:** Open
**Description:** `SuperAdminDashboardPage` has quick links to `/admin/applications` and `/admin/campers`. While these routes exist and are accessible (no role guard enforcement), a super_admin user navigating these links will be rendered inside the `AdminLayout` shell rather than the `SuperAdminLayout` shell. This is inconsistent UX. The links should point to `/super-admin/applications` and `/super-admin/campers`.
**Affected Files:**
- `frontend/src/features/superadmin/pages/SuperAdminDashboardPage.tsx`

---

### BUG-020
**Title:** Form Management — session assignment uses raw ID input, no session picker
**Module:** Form Management
**Severity:** Medium
**Status:** Open
**Description:** When uploading a form template in `FormManagementPage`, the "Assign to Session" field is a plain number input requiring the admin to know the session ID. There is no dropdown or autocomplete loaded from the `/sessions` API. Additionally, the purpose of Form Management (how uploaded templates connect to the online application form) is not explained in the UI.
**Affected Files:**
- `frontend/src/features/superadmin/pages/FormManagementPage.tsx`

---

### BUG-021
**Title:** Form Management files stored on local disk — not accessible for download in production
**Module:** Form Management
**Severity:** High
**Status:** Open
**Description:** `FormTemplateController` stores uploaded files using `Storage::disk('local')` which maps to `storage/app/`. This disk is not publicly accessible. While the download endpoint streams the file correctly, this approach will not work in production environments where storage may be distributed (e.g. S3). The `local` disk should be replaced with `public` or a configurable cloud storage driver.
**Affected Files:**
- `backend/.../app/Http/Controllers/Api/System/FormTemplateController.php`

---

### BUG-022
**Title:** Report downloads — AdminReportsPage loads only page 1 of applications for chart data
**Module:** Admin Reports
**Severity:** High
**Status:** Open
**Description:** `AdminReportsPage` calls `getApplications({ page: 1 })` to build charts and statistics. This only retrieves the first page (15 records by default). If there are more than 15 applications, the charts and statistics undercount actual totals. The summary stats (Total, Accepted, Rejected, Rate) will be incorrect. A paginated fetch or a dedicated summary endpoint is needed.
**Affected Files:**
- `frontend/src/features/admin/pages/AdminReportsPage.tsx`
- `backend/.../app/Http/Controllers/Api/Camper/ApplicationController.php` (consider adding a stats endpoint)

---

### BUG-023
**Title:** AdminReportsPage imports stale/non-standard motion variant names
**Module:** Admin Reports
**Severity:** Low
**Status:** Open
**Description:** `AdminReportsPage.tsx` imports `scrollRevealVariants`, `staggerContainerVariants`, `staggerChildVariants` from `@/shared/constants/motion`. Other pages import `pageEntry`, `staggerContainer`, `staggerChild`. If the names do not match the exports in the motion constants file, this will cause a runtime TypeScript error or undefined variant warning. The naming convention is inconsistent across pages.
**Affected Files:**
- `frontend/src/features/admin/pages/AdminReportsPage.tsx`
- `frontend/src/shared/constants/motion.ts`

---

### BUG-024
**Title:** Password reset — no email notification confirms password was changed
**Module:** Password Reset
**Severity:** Medium
**Status:** Open
**Description:** When a user resets their password via the forgot-password flow, the system updates the password and deletes the token but does not send a confirmation email notifying the user that their password was changed. This is a security best practice gap. (Note: `changePassword()` via profile settings does trigger a system inbox notification, but the reset flow does not.)
**Affected Files:**
- `backend/.../app/Services/Auth/PasswordResetService.php`
- `backend/.../app/Notifications/Auth/` (new notification needed)

---

### BUG-025
**Title:** No CODEBASE_GUIDE.md exists
**Module:** Documentation
**Severity:** Medium
**Status:** Open
**Description:** There is no `CODEBASE_GUIDE.md` file in the project root. Per Phase 10 requirements, a comprehensive codebase guide explaining folder structure, data flow, backend/frontend interaction, and diagrams is required for onboarding and debugging.
**Affected Files:**
- (New file: `CODEBASE_GUIDE.md` at project root)

---

### BUG-026
**Title:** Documentation does not reflect current system state in several areas
**Module:** Documentation
**Severity:** Medium
**Status:** Open
**Description:** Several documentation files in `docs/` predate recent system changes and do not accurately reflect: (1) the messaging/inbox system additions (conversations, system notifications), (2) the form templates module, (3) the calendar and announcements additions, (4) the current profile/notification-preference endpoints. Documentation is partially stale.
**Affected Files:**
- `docs/backend/INBOX_SYSTEM_DOCUMENTATION.md`
- `docs/backend/ROLES_AND_PERMISSIONS.md`
- `docs/backend/API_REFERENCE.md`
- `docs/backend/DATA_MODEL.md`

---

### BUG-027
**Title:** Notification settings — toggles appear to work but no indication of per-type SMS/in-app controls
**Module:** Notification Settings
**Severity:** Medium
**Status:** Open
**Description:** The notification preferences system only supports email toggles (4 keys: application_updates, announcements, messages, deadlines). There are no SMS or in-app notification controls. The toggle mechanism itself (optimistic update with API call) appears functional. Phase 7 requires the notification system to be more complete and not duplicate or produce race-condition events.
**Affected Files:**
- `frontend/src/features/profile/pages/SettingsPage.tsx`
- `backend/.../app/Http/Controllers/Api/Camper/UserProfileController.php`
- `backend/.../database/migrations/2026_02_27_115413_add_notification_preferences_to_users_table.php`

---

### BUG-028
**Title:** Medical portal — no route or UI for medical staff to upload documents or record treatments
**Module:** Medical Portal
**Severity:** Critical
**Status:** Open
**Description:** Medical staff have no UI for uploading medical documents, recording treatments/interventions, updating allergy severity, or logging medication administrations in real time. The backend has write endpoints for medical data but the `medical` role only accesses them as read-only in the frontend. A full clinical workflow UI is needed for on-site camp medical staff.
**Affected Files:**
- `frontend/src/features/medical/pages/MedicalRecordPage.tsx`
- `frontend/src/features/medical/api/medical.api.ts`
- `backend/.../app/Policies/MedicalRecordPolicy.php`
- `backend/.../app/Policies/AllergyPolicy.php`
- `backend/.../app/Policies/MedicationPolicy.php`

---

### BUG-029
**Title:** Camper detail page missing — /admin/campers/:id leads to 404
**Module:** Admin — Camper Management
**Severity:** Critical
**Status:** Open
**Description:** Duplicate of BUG-005 detail for clarity. The "View" link on every camper row in `AdminCampersPage` navigates to `/admin/campers/:id`. No such route or page component exists. All links to individual camper records produce a 404 NotFoundPage. The same applies to `/admin/campers/:id/risk` (risk summary) and `/super-admin/campers/:id`.
**Affected Files:**
- `frontend/src/core/routing/index.tsx`
- `frontend/src/features/admin/pages/` (CamperDetailPage missing)

---

### BUG-030
**Title:** Applicant portal has no dedicated past applications history with filter/sort
**Module:** Applicant Portal — Past Applications
**Severity:** Medium
**Status:** Open
**Description:** `ParentApplicationsPage` does show all applications including past ones in a flat list, but there is no filtering by year, session, or status, no sorting, and no clear visual differentiation between active and historical applications. The "Re-apply" button exists which is useful, but the overall history UX needs improvement.
**Affected Files:**
- `frontend/src/features/parent/pages/ParentApplicationsPage.tsx`

---

### BUG-031
**Title:** password change via Settings uses minimum 8-char rule; password reset requires 12+ with complexity
**Module:** Security
**Severity:** Medium
**Status:** Open
**Description:** The `changePassword` endpoint uses `Password::min(8)` while the `reset` endpoint uses `Password::min(12)->mixedCase()->numbers()->symbols()->uncompromised()`. The two password policies are inconsistent. Both should use the stronger policy.
**Affected Files:**
- `backend/.../app/Http/Controllers/Api/Camper/UserProfileController.php` (`changePassword` — uses min 8)
- `backend/.../app/Http/Controllers/Api/Auth/PasswordResetController.php` (uses min 12 + complexity)

---

### BUG-032
**Title:** SettingsPage password form uses min 8 chars on frontend but reset requires 12+
**Module:** Security
**Severity:** Medium
**Status:** Open
**Description:** `SettingsPage` validates new password as `z.string().min(8, ...)` on the frontend. This is inconsistent with the password reset flow which requires 12+ characters with mixed case, numbers, and symbols. Frontend and backend password validation rules should match.
**Affected Files:**
- `frontend/src/features/profile/pages/SettingsPage.tsx` (passwordSchema min 8)

---

### BUG-033
**Title:** Super Admin user management — "role" filter uses raw role slugs not user-friendly labels
**Module:** Super Admin — User Management
**Severity:** Low
**Status:** Open
**Description:** When filtering users by role in `UserManagementPage`, the filter would pass raw role slugs (`parent`, `admin`, `medical`, `super_admin`) to the API. If the UI labels change (to "Applicant" etc.) but the API values do not, the filter will be misaligned. The role naming change in BUG-001 must be coordinated with this.
**Affected Files:**
- `frontend/src/features/superadmin/pages/UserManagementPage.tsx`
- `backend/.../app/Http/Controllers/Api/System/UserController.php`

---

### BUG-034
**Title:** Medical portal inbox missing — no /medical/inbox route
**Module:** Medical Portal
**Severity:** Medium
**Status:** Open
**Description:** The routing table for the medical portal includes `/medical/dashboard`, `/medical/records/:camperId`, `/medical/profile`, and `/medical/settings` but no `/medical/inbox`. Medical staff cannot access the messaging system from within their portal. The MedicalLayout likely has an inbox nav item that links to a non-existent route.
**Affected Files:**
- `frontend/src/core/routing/index.tsx`
- `frontend/src/ui/layout/MedicalLayout.tsx`

---

### BUG-035
**Title:** ApplicationReviewPage imported by both AdminLayout and SuperAdminLayout portals — no access issue but noted
**Module:** Admin / Super Admin
**Severity:** Low
**Status:** Open
**Description:** `ApplicationReviewPage` is shared between `/admin/applications/:id` and `/super-admin/applications/:id`. This is intentional reuse and works correctly. However, there is no role-specific behavior differentiation — a super admin sees the exact same review panel as a regular admin. Minor audit note only.
**Affected Files:**
- `frontend/src/features/admin/pages/ApplicationReviewPage.tsx`

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 7 |
| High | 12 |
| Medium | 12 |
| Low | 4 |
| **Total** | **35** |

| Module | Issues |
|--------|--------|
| Role Naming / RBAC | BUG-001, BUG-006, BUG-033 |
| Email Verification | BUG-002, BUG-004 |
| Password Reset | BUG-003, BUG-024, BUG-031, BUG-032 |
| Medical Portal | BUG-007, BUG-008, BUG-028, BUG-034 |
| Admin — Camper Management | BUG-005, BUG-029 |
| Applicant Portal | BUG-009, BUG-011, BUG-030 |
| Application Form | BUG-010 |
| Seeders | BUG-012 |
| Audit Log | BUG-013 |
| Profile System | BUG-014 |
| Inbox / Messaging | BUG-015, BUG-016, BUG-017 |
| Recent Updates | BUG-018 |
| Super Admin Dashboard | BUG-019 |
| Form Management | BUG-020, BUG-021 |
| Admin Reports | BUG-022, BUG-023 |
| Notification Settings | BUG-027 |
| Documentation | BUG-025, BUG-026 |
| Security | BUG-031, BUG-032 |
| Misc / Low | BUG-035 |
