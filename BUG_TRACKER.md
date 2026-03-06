# Camp Burnt Gin — Bug Tracker

**Created:** Phase 1 System Audit
**Last Updated:** Phase 10 — Documentation
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
**Status:** Resolved — Phase 5
**Description:** `AdminCampersPage` rendered two links per camper row: `Link to="/admin/campers/${camper.id}"` (view) and `Link to="/admin/campers/${camper.id}/risk"` (risk summary). Neither route was defined in `core/routing/index.tsx`. Clicking either link resulted in a 404/NotFoundPage. No camper detail page component existed in the codebase.
**Resolution:** `CamperDetailPage.tsx` was created and registered at `/admin/campers/:id` and `/super-admin/campers/:id`. The `/risk` route was removed; risk/medical data is displayed inline within CamperDetailPage.
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
**Status:** Resolved — Phase 6
**Description:** The medical portal (`/medical`) is entirely read-only. Medical staff can browse camper medical records but cannot update records, upload medical documents, record treatments or interventions, log medication administrations, or track real-time medical events during camp. For an on-site camp medical team, this makes the portal non-functional as a clinical tool. The backend has write endpoints for medical data (PUT on medical records, allergies, medications, etc.) but they are not surfaced in the medical portal UI.
**Resolution:** All 9 medical policies updated to remove the `MedicalProviderLink` gate — camp medical staff (`medical` role) now have direct read/write access to all camper medical records without requiring individual provider links. `MedicalRecordPage` rebuilt with full inline add/edit modals for allergies, medications, diagnoses, behavioral profiles, feeding plans, assistive devices, and activity permissions. `medical.api.ts` expanded with complete write operations.
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
**Status:** Resolved — Phase 9
**Description:** The audit log UI displays raw action strings like `view`, `update`, `delete`, `created`, `reviewed` with no human-readable context. There are no human-readable event descriptions (e.g. "Alex Rivera approved Application #42"), no before/after values for updates, no event categories, no expandable detail panels, and no export functionality. The IP address field exists in the backend response but is not prominently displayed. Filtering is limited to search text and date range with no action type or category filter.
**Resolution:**
- `AuditLogController` expanded: `human_description` field generated server-side, `category` mapped from `event_type`, `entity_label` added, export endpoint `GET /audit-log/export?format=csv|json` added
- Filters expanded to include `event_type`, `entity_type`
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
**Status:** Resolved — Phase 8
**Description:** Starred conversations are tracked via a `Set<number>` stored in `localStorage` under key `inbox_starred_ids`. Stars are not persisted to the backend database.
**Resolution:** Phase 8 migration added `is_starred`, `is_important`, `trashed_at` columns to `conversation_participants`. `InboxService` toggles these per-user. **Requires `php artisan migrate`.**
**Affected Files:**
- `frontend/src/features/messaging/pages/InboxPage.tsx`
- `backend/.../database/migrations/2026_03_06_000001_add_per_user_state_to_conversation_participants_table.php`

---

### BUG-016
**Title:** Inbox missing: Drafts, Sent, Trash (with restore), Scheduled send, Important folder
**Module:** Inbox / Messaging
**Severity:** High
**Status:** Resolved — Phase 8
**Description:** The inbox UI has tabs: All, Applicants, Medical Team, System, Announcements, Archive. Missing folders per Phase 8 requirements: Starred, Important, Sent, Drafts, Trash with restore, and Scheduled send. The current layout was two-panel instead of three-panel.
**Resolution:** Phase 8 delivered the full 3-pane Gmail-style inbox with all 8 folders, per-user state, bulk actions, rich text editor, floating compose, and thread viewer. **Requires `php artisan migrate`.**
**Affected Files:**
- `frontend/src/features/messaging/pages/InboxPage.tsx`
- `frontend/src/features/messaging/api/messaging.api.ts`
- `backend/.../database/migrations/2026_03_06_000001_add_per_user_state_to_conversation_participants_table.php`

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

### BUG-047
**Title:** Applicant cannot send messages to super_admin — hasNonAdminParticipants check too narrow
**Module:** Inbox / Messaging — RBAC
**Severity:** High
**Status:** Resolved — Post Phase 8
**Description:** `ConversationController::store()` computed `hasNonAdminParticipants` using `fn($role) => $role !== 'admin'`. This treated `super_admin` as a non-admin role, blocking applicants from creating conversations with super admins even though the search endpoint correctly allows it.
**Resolution:** Changed check to `fn($role) => !in_array($role, ['admin', 'super_admin'], true)` so both admin roles are accepted.
**Affected Files:**
- `backend/.../app/Http/Controllers/Api/Inbox/ConversationController.php`

---

### BUG-048
**Title:** Inbox folder switching shows brief error/skeleton flash (visual glitch)
**Module:** Inbox / Messaging — UI
**Severity:** Medium
**Status:** Resolved — Post Phase 8
**Description:** Switching inbox folders caused a brief visible glitch: the conversation list blanked immediately (via `setConversations([])` in `changeFolder`), showing skeleton rows or an error state for <200ms before new data arrived. Also caused by Phase 8 migration (`is_starred`, `is_important`, `trashed_at` columns) not being applied — all folder queries would fail with SQL errors showing as "Could not load messages."
**Resolution:** (1) Removed `setConversations([])` / `setAnnouncements([])` from `changeFolder` — old content stays visible while loading. New data replaces it atomically when the fetch resolves. (2) Replaced skeleton replacement with a subtle top progress bar that overlays the stale list. (3) Removed redundant `setLoading(true)` / `setError(false)` from inside the `useEffect`. (4) Run `php artisan migrate` to apply Phase 8 schema.
**Affected Files:**
- `frontend/src/features/messaging/pages/InboxPage.tsx`
- `backend/.../database/migrations/2026_03_06_000001_add_per_user_state_to_conversation_participants_table.php` (must be migrated)

---

### BUG-018
**Title:** Recent Updates system does not exist as a distinct feature
**Module:** Recent Updates
**Severity:** Medium
**Status:** Resolved — Phase 7
**Description:** There is no standalone "Recent Updates" or "Activity Feed" module. Admin and parent dashboards show notifications and a review queue, but there is no component that shows what changed, who changed it, and when — in a clear, chronological, human-readable format. Dashboards show counts and review queues but not a meaningful activity feed.
**Resolution:** The applicant dashboard's "Recent Updates" widget was rebuilt to show human-readable notification titles, body messages, notification-type icons, relative timestamps, unread indicators, per-item mark-as-read on click, and a "Mark all read" shortcut. All notification `toArray()` methods were updated to include `title` and `message` fields. `NotificationController::index()` now unwraps these from the `data` column before returning them to the frontend. `Notification.id` type was corrected to `string` (UUID). `NotificationPanel` (slide-out panel) was also updated to use `id: string`.
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
**Description:** `SuperAdminDashboardPage` had quick links to `/admin/applications` and `/admin/campers`, rendering the wrong layout shell (AdminLayout instead of SuperAdminLayout) for super admin users.
**Resolution:** Updated `QUICK_LINKS` in `SuperAdminDashboardPage.tsx` to point to `/super-admin/applications` and `/super-admin/campers`.
**Affected Files:**
- `frontend/src/features/superadmin/pages/SuperAdminDashboardPage.tsx`

---

### BUG-020
**Title:** Form Management — session assignment uses raw ID input, no session picker
**Module:** Form Management
**Severity:** Medium
**Status:** Resolved — Phase 5
**Description:** When uploading a form template in `FormManagementPage`, the "Assign to Session" field was a plain number input. Additionally, the purpose of Form Management was not explained in the UI.
**Resolution:** Session assignment field is now a `<select>` dropdown populated from `getSessions()`. Header description updated to clearly explain the purpose: templates are supplemental PDF/Word forms applicants must complete and submit, optionally scoped to a session.
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
**Status:** Resolved — Phase 5
**Description:** `AdminReportsPage` previously called `getApplications({ page: 1 })` to build charts and statistics, undercounting totals beyond the first page.
**Resolution:** `AdminReportsPage` now calls `getReportsSummary()` which hits `GET /reports/summary` — a dedicated aggregate endpoint that counts all records regardless of pagination. Accurate totals are returned for all status counts, session enrollment, and acceptance rate.
**Affected Files:**
- `frontend/src/features/admin/pages/AdminReportsPage.tsx`
- `backend/.../app/Http/Controllers/Api/System/ReportController.php`

---

### BUG-023
**Title:** AdminReportsPage imports stale/non-standard motion variant names
**Module:** Admin Reports
**Severity:** Low
**Status:** Resolved — Phase 5
**Description:** `AdminReportsPage.tsx` imported `scrollRevealVariants`, `staggerContainerVariants`, `staggerChildVariants`. These are valid named exports in `motion.ts` — they are the full-name forms. The short-name aliases (`staggerContainer`, `staggerChild`, `pageEntry`) are also exported from `motion.ts` and resolve to the same objects. No runtime error occurs.
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
**Status:** Resolved — Phase 10
**Description:** There is no `CODEBASE_GUIDE.md` file in the project root. Per Phase 10 requirements, a comprehensive codebase guide explaining folder structure, data flow, backend/frontend interaction, and diagrams is required for onboarding and debugging.
**Resolution:** `CODEBASE_GUIDE.md` created at project root. Covers folder structure, all major files, backend/frontend interaction, data flow diagrams, debugging reference table, database tables at a glance, security layers, testing, and environment setup.
**Affected Files:**
- `CODEBASE_GUIDE.md` (new)

---

### BUG-026
**Title:** Documentation does not reflect current system state in several areas
**Module:** Documentation
**Severity:** Medium
**Status:** Resolved — Phase 10
**Description:** Several documentation files in `docs/` predated recent system changes and did not accurately reflect: (1) the messaging/inbox system additions (conversations, system notifications), (2) the form templates module, (3) the calendar and announcements additions, (4) the current profile/notification-preference endpoints. Documentation was partially stale.
**Resolution:** `BACKEND_CHANGELOG.md` updated with Phase 7, 8, 9, and post-phase changes. `ROLES_AND_PERMISSIONS.md` updated: "parent" role renamed to "Applicant" throughout, hierarchy notation corrected, last-updated stamp updated. `AUDIT_LOGGING.md` updated with Phase 9 API additions (human descriptions, category mapping, export endpoint). `CODEBASE_GUIDE.md` created as the canonical onboarding and debugging reference.
**Affected Files:**
- `docs/governance/BACKEND_CHANGELOG.md`
- `docs/backend/ROLES_AND_PERMISSIONS.md`
- `docs/backend/AUDIT_LOGGING.md`
- `CODEBASE_GUIDE.md` (new)

---

### BUG-027
**Title:** Notification settings — toggles appear to work but no indication of per-type SMS/in-app controls
**Module:** Notification Settings
**Severity:** Medium
**Status:** Resolved — Phase 7
**Description:** The notification preferences system only supports email toggles (4 keys: application_updates, announcements, messages, deadlines). There are no SMS or in-app notification controls. The toggle mechanism itself (optimistic update with API call) appears functional. Phase 7 requires the notification system to be more complete and not duplicate or produce race-condition events.
**Resolution:** (1) All notification `via()` methods now read `notification_preferences` from the notifiable user before deciding whether to include the `mail` channel — preferences are now enforced. (2) `SettingsPage` loads preferences on component mount (not only when the notifications tab is opened), eliminating the first-click race condition that caused toggles to visually snap back. (3) `handleNotifToggle` now guards against simultaneous in-flight saves (returns early if `savingNotif !== null`) and uses the functional updater form to avoid stale closure bugs. (4) All toggles are disabled while any one is saving, preventing duplicate toast messages. (5) The notifications tab now shows per-preference descriptions and a loading skeleton while preferences are being fetched. (6) The `notifLoading` state prevents double-fetch when the component re-renders rapidly.
**Affected Files:**
- `frontend/src/features/profile/pages/SettingsPage.tsx`
- `backend/.../app/Notifications/Camper/ApplicationStatusChangedNotification.php`
- `backend/.../app/Notifications/Camper/ApplicationSubmittedNotification.php`
- `backend/.../app/Notifications/NewMessageNotification.php`
- `backend/.../app/Notifications/NewConversationNotification.php`

---

### BUG-028
**Title:** Medical portal — no route or UI for medical staff to upload documents or record treatments
**Module:** Medical Portal
**Severity:** Critical
**Status:** Resolved — Phase 6
**Description:** Medical staff have no UI for uploading medical documents, recording treatments/interventions, updating allergy severity, or logging medication administrations in real time. The backend has write endpoints for medical data but the `medical` role only accesses them as read-only in the frontend. A full clinical workflow UI is needed for on-site camp medical staff.
**Resolution:** Created `MedicalTreatmentLogPage` (`/medical/records/:camperId/treatments`) for recording and reviewing interventions. Created `MedicalDocumentsPage` (`/medical/records/:camperId/documents`) for viewing and uploading camper documents. Created the complete `TreatmentLog` backend system (migration, model, enum, policy, requests, controller, routes). Fixed `DocumentController` and `DocumentPolicy` to give medical staff access to camper and medical record documents.
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
**Description:** Duplicate of BUG-005. See BUG-005 resolution. `CamperDetailPage` now exists and is registered at `/admin/campers/:id` and `/super-admin/campers/:id`.
**Affected Files:**
- `frontend/src/core/routing/index.tsx`
- `frontend/src/features/admin/pages/CamperDetailPage.tsx`

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
**Status:** Resolved — Phase 6
**Resolution:** Added `/medical/inbox` route to the medical portal's routing block in `core/routing/index.tsx`, pointing to the shared `InboxPage` component. Also added an Inbox nav item to `MedicalLayout` with the `Inbox` icon from `lucide-react`. Medical staff can now access messaging from within their portal.
**Affected Files:**
- `frontend/src/core/routing/index.tsx`
- `frontend/src/ui/layout/MedicalLayout.tsx`

---

### BUG-035
**Title:** ApplicationReviewPage — "Back" link hardcoded to /admin/applications regardless of portal
**Module:** Admin / Super Admin
**Severity:** Low
**Status:** Resolved — Phase 5
**Description:** `ApplicationReviewPage` is shared between `/admin/applications/:id` and `/super-admin/applications/:id`. The "Back to Applications" link was hardcoded to `/admin/applications`, causing super admin users to be redirected into the wrong portal layout after reviewing an application. Role-specific behavior is otherwise intentionally identical.
**Resolution:** Added `useLocation` to `ApplicationReviewPage`. Back link now detects portal prefix from current path and navigates to either `/super-admin/applications` or `/admin/applications` accordingly.
**Affected Files:**
- `frontend/src/features/admin/pages/ApplicationReviewPage.tsx`

---

### BUG-036
**Title:** Profile Settings actions log out user — stale token not rehydrated before validation
**Module:** Profile System / Auth
**Severity:** Critical
**Status:** Resolved — Phase 5 Corrections
**Description:** All profile API calls (save profile, upload avatar, delete avatar, emergency contacts, data export, delete account) returned 401, triggering the axios interceptor which fired `auth:unauthorized` → `clearAuth()` → redirect to login. Root cause: `useAuthInit` read `store.getState().auth.token` before `redux-persist` rehydration completed, resulting in a stale null token being sent on all requests.
**Resolution:** Fixed `useAuthInit` hook to await `persistor.getState().bootstrapped` before reading the token. Also fixed FormData Content-Type boundary bug in avatar upload (removed manual `Content-Type` header so axios sets it automatically).
**Affected Files:**
- `frontend/src/features/auth/hooks/useAuthInit.ts`
- `frontend/src/features/profile/api/profile.api.ts`

---

### BUG-037
**Title:** Super Admin can delete their own account — no role restriction on deleteAccount endpoint
**Module:** Profile System / Security
**Severity:** Critical
**Status:** Resolved — Phase 5 Corrections
**Description:** `UserProfileController::deleteAccount()` had no role check. Any authenticated user — including admin and super_admin — could deactivate their own account. The Delete Account UI section was also visible to all roles in `SettingsPage.tsx`.
**Resolution:** Added backend role guard: non-applicants receive a 403 response. Added frontend visibility check: Delete Account section hidden when user's primary role is in `ADMIN_ROLES` (admin, super_admin).
**Affected Files:**
- `backend/.../app/Http/Controllers/Api/Camper/UserProfileController.php`
- `frontend/src/features/profile/pages/SettingsPage.tsx`

---

### BUG-038
**Title:** Application review page shows "Unknown Camper", literal i18n keys, and no medical data
**Module:** Admin — Application Review
**Severity:** Critical
**Status:** Resolved — Phase 5 Corrections
**Description:** Three compounding issues: (1) `Camper` model had no `$appends = ['full_name']` so the accessor was never serialized to JSON — `camper.full_name` was always undefined. (2) `ApplicationController::show()` only loaded `['camper', 'campSession.camp', 'reviewer']` — medical record and emergency contacts were missing. (3) Multiple `t('common.*')` keys were missing from `en.json`, rendering as literal strings.
**Resolution:** Added `$appends = ['full_name']` to Camper model. Updated `show()` to eager-load `camper.medicalRecord` and `camper.emergencyContacts`. Added missing i18n keys: `common.review`, `common.not_provided`, `common.none`, `common.view`, `common.not_submitted`.
**Affected Files:**
- `backend/.../app/Models/Camper.php`
- `backend/.../app/Http/Controllers/Api/Camper/ApplicationController.php`
- `frontend/src/i18n/en.json`

---

### BUG-039
**Title:** Application list shows "Session #undefined" — wrong JSON key and wrong TypeScript type
**Module:** Admin — Application List / Camper List
**Severity:** High
**Status:** Resolved — Phase 5 Corrections
**Description:** The `Application` model's `campSession()` relationship serializes as `camp_session` in JSON, but the frontend TypeScript interface used `session?`. The `Application` interface also had `session_id: number` but the database column is `camp_session_id`, so the `Session #${app.session_id}` fallback always rendered "Session #undefined".
**Resolution:** Added `$appends = ['session']` and `getSessionAttribute()` to Application model to alias `campSession` as `session` in JSON output. Updated `admin.types.ts` Application interface: renamed `session_id` → `camp_session_id`. Fixed fallback strings in `AdminApplicationsPage.tsx` and `CamperDetailPage.tsx`.
**Affected Files:**
- `backend/.../app/Models/Application.php`
- `frontend/src/features/admin/types/admin.types.ts`
- `frontend/src/features/admin/pages/AdminApplicationsPage.tsx`
- `frontend/src/features/admin/pages/CamperDetailPage.tsx`

---

### BUG-040
**Title:** Profile save / avatar actions log user out — `setUser` overwrites `roles` array
**Module:** Profile System / Auth
**Severity:** Critical
**Status:** Resolved — Phase 5 Corrections (Round 2)
**Description:** `ProfilePage.tsx` dispatched `setUser(updated)` where `updated` was the raw profile API response. The `/profile` update endpoint does not load the `role` relationship, so the response has no `roles` array. Replacing the Redux auth user with this object wiped `user.roles` and `user.role`. Layout guards (`SuperAdminLayout`, `AdminLayout`, `ApplicantLayout`) check `user?.roles?.some(...)` and fail when `roles` is undefined, redirecting to `/login` — appearing as a logout. Affected: save personal info, save address, upload avatar, remove avatar.
**Resolution:** Added `useAppSelector` to `ProfilePage` to read current `authUser`. All four `dispatch(setUser(...))` calls now spread `authUser` as base: `dispatch(setUser({ ...authUser, ...updated } as User))`, preserving `roles`, `token`, and all other auth-state-only fields.
**Affected Files:**
- `frontend/src/features/profile/pages/ProfilePage.tsx`

---

### BUG-041
**Title:** Avatar upload fails — axios instance default Content-Type overrides multipart/form-data boundary
**Module:** Profile System
**Severity:** High
**Status:** Resolved — Phase 5 Corrections (Round 2)
**Description:** `uploadAvatar()` sent `FormData` via POST, but the axios instance default `Content-Type: application/json` was applied, replacing the browser-generated `multipart/form-data; boundary=...` header. The server received an incorrect content type and rejected the file.
**Resolution:** Added `headers: { 'Content-Type': undefined }` to the `uploadAvatar` axios call so the browser sets the correct multipart header automatically.
**Affected Files:**
- `frontend/src/features/profile/api/profile.api.ts`

---

### BUG-042
**Title:** Campers list shows raw ISO 8601 date — `date_of_birth` not formatted
**Module:** Admin — Camper Management
**Severity:** Medium
**Status:** Resolved — Phase 5 Corrections (Round 2)
**Description:** `AdminCampersPage.tsx` rendered `camper.date_of_birth` directly. Laravel's `date` cast serializes dates as ISO 8601 (`2013-04-12T00:00:00.000000Z`), producing an unreadable string in the UI.
**Resolution:** Imported `format` from `date-fns` and wrapped the value: `format(new Date(camper.date_of_birth), 'MMM d, yyyy')`.
**Affected Files:**
- `frontend/src/features/admin/pages/AdminCampersPage.tsx`

---

### BUG-043
**Title:** "View Risk" link in camper list routes to 404 — missing `/admin/campers/:id/risk` route
**Module:** Admin — Camper Management
**Severity:** High
**Status:** Resolved — Phase 5 Corrections (Round 2)
**Description:** The "View Risk" button in `AdminCampersPage.tsx` linked to `/admin/campers/:id/risk`, which has no matching route definition. No `CamperRiskPage` component exists. The existing `CamperDetailPage` already displays medical records, risk level, and behavioral profile.
**Resolution:** Changed link target from `/admin/campers/${camper.id}/risk` to `/admin/campers/${camper.id}`, routing to the existing `CamperDetailPage`.
**Affected Files:**
- `frontend/src/features/admin/pages/AdminCampersPage.tsx`

---

### BUG-045
**Title:** Login redirects back to `/login` after success — stale token validation races with fresh login
**Module:** Auth — Login / useAuthInit
**Severity:** Critical
**Status:** Resolved — Phase 5 Corrections (Round 2)
**Description:** When a user had a previous session (expired token in sessionStorage), `useAuthInit` would fire `getAuthenticatedUser()` on app mount (async, pending). While that request was in-flight: (1) the user fills in the login form and submits, (2) the toast fires and `navigate('/applicant/dashboard')` is called, (3) `ProtectedRoute` shows `<FullPageLoader>` because `isLoading` is still `true` (waiting for `hydrateAuth()`), (4) `getAuthenticatedUser()` fails because the old token is expired → `dispatch(clearAuth())` → `isAuthenticated = false` → `ProtectedRoute` redirects to `/login`. Result: user sees "Welcome back, X." toast but lands back on the login page.
**Resolution:** In `useAuthInit`, the `.catch()` handler now compares the current token against the token captured at validation-start. If they differ (user logged in with a new token while old validation was pending), `dispatch(hydrateAuth())` is called instead of `dispatch(clearAuth())`. The `.then()` handler similarly skips `dispatch(setUser(user))` when the token changed, preventing stale rehydration data from overwriting a fresh login.
**Affected Files:**
- `frontend/src/features/auth/hooks/useAuthInit.ts`

---

### BUG-044
**Title:** Login page shows two password reveal icons — browser native icon conflicts with custom Eye button
**Module:** Auth — Login Page
**Severity:** Low
**Status:** Resolved — Phase 5 Corrections (Round 2)
**Description:** Some browsers (Edge, Chrome, Safari) render a native password reveal button inside `input[type="password"]` fields. This appeared alongside the custom `Eye`/`EyeOff` icon button, making the icon appear visually doubled or out of place.
**Resolution:** Added global CSS in `globals.css` to hide the native browser password reveal buttons (`-ms-reveal`, `-ms-clear`, `-webkit-credentials-auto-fill-button`, `-webkit-strong-password-auto-fill-button`).
**Affected Files:**
- `frontend/src/assets/styles/globals.css`

---

### BUG-046
**Title:** Applicant login broken — blocking issue, unresolved after multiple attempts
**Module:** Auth — Applicant Login
**Severity:** Critical
**Status:** Open — Known Blocking Issue
**Description:** Applicant (role: `applicant`) login is broken. After submitting valid credentials, the login flow fails to complete or redirects incorrectly. This issue was investigated over multiple sessions without resolution. It is tracked here as a known blocking issue. It does not affect admin, super_admin, or medical role logins. Root cause is not yet confirmed — likely involves token handling, role resolution, or redirect logic specific to the applicant portal entry path.
**Affected Files (suspected):**
- `frontend/src/features/auth/hooks/useAuthInit.ts`
- `frontend/src/core/auth/ProtectedRoute.tsx`
- `frontend/src/core/routing/index.tsx` (applicant portal guard)
- `backend/.../app/Http/Controllers/Api/Auth/AuthController.php`

---

### BUG-049
**Title:** Applicant cannot send messages to super_admin — hasNonAdminParticipants check too narrow
**Module:** Inbox / Messaging — RBAC
**Severity:** High
**Status:** Resolved — Post Phase 8
**Description:** `ConversationController::store()` computed `hasNonAdminParticipants` using `fn($role) => $role !== 'admin'`. This treated `super_admin` as a non-admin role, blocking applicants from creating conversations with super admins even though the search endpoint correctly allows it.
**Resolution:** Changed check to `fn($role) => !in_array($role, ['admin', 'super_admin'], true)`.
**Affected Files:**
- `backend/.../app/Http/Controllers/Api/Inbox/ConversationController.php`

---

### BUG-050
**Title:** Inbox folder switching shows brief blank/skeleton flash (visual glitch)
**Module:** Inbox / Messaging — UI
**Severity:** Medium
**Status:** Resolved — Post Phase 8
**Description:** Switching inbox folders caused the conversation list to blank immediately via `setConversations([])` in `changeFolder`, showing skeleton rows for <200ms before new data arrived.
**Resolution:** Removed the immediate clear; stale content stays visible during load. New data replaces it atomically. Top loading bar overlay replaces skeleton rows. Phase 8 migration must also be applied.
**Affected Files:**
- `frontend/src/features/messaging/pages/InboxPage.tsx`

---

### BUG-051
**Title:** Page refresh logs user out — useAuthInit reads localStorage but token is in sessionStorage
**Module:** Auth — Session Persistence
**Severity:** Critical
**Status:** Resolved — Post Phase 9
**Description:** `useAuthInit` read the auth token from `localStorage.getItem('auth_token')` but the login flow stores it in `sessionStorage.setItem('auth_token', token)`. On every page refresh, localStorage returns null → auth state never restores → user is redirected to /login. Also caused by the same mismatch: the 401 handler cleared localStorage instead of sessionStorage, so the token was never actually removed on session expiry.
**Resolution:** Changed all three `localStorage` references in `useAuthInit.ts` to `sessionStorage`.
**Affected Files:**
- `frontend/src/features/auth/hooks/useAuthInit.ts`

---

### BUG-052
**Title:** "Under Review" application status badge is green — should be yellow
**Module:** UI — Status Badges
**Severity:** Low
**Status:** Resolved — Post Phase 9
**Description:** `StatusBadge.tsx` used the same green color for `under_review` as for `approved` and `active`, making it visually indistinguishable from a positive outcome.
**Resolution:** Changed `under_review` to light yellow background (`rgba(234,179,8,0.15)`) with dark amber text (`#854d0e`).
**Affected Files:**
- `frontend/src/ui/components/StatusBadge.tsx`

---

### BUG-053
**Title:** "Pending" application status badge is green — should be grey
**Module:** UI — Status Badges
**Severity:** Low
**Status:** Resolved — Post Phase 9
**Description:** `StatusBadge.tsx` used the same green color for `pending` as for `approved`, implying a positive outcome for a status that simply means "awaiting review."
**Resolution:** Changed `pending` to grey background and text (matching `draft`, `inactive`, `cancelled`).
**Affected Files:**
- `frontend/src/ui/components/StatusBadge.tsx`

---

### BUG-047
**Title:** CamperDetailPage uses `camper.t_shirt_size` — property does not exist on Camper type
**Module:** Admin — Camper Management
**Severity:** Medium
**Status:** Resolved — Phase 5
**Description:** `CamperDetailPage.tsx` referenced `camper.t_shirt_size` (with underscore). The `Camper` type in `admin.types.ts` defines the field as `tshirt_size` (no underscore). In TypeScript strict mode this silently resolves to `undefined`, causing the T-Shirt Size field to always display "—" regardless of actual data.
**Resolution:** Changed `camper.t_shirt_size` → `camper.tshirt_size` in `CamperDetailPage.tsx`.
**Affected Files:**
- `frontend/src/features/admin/pages/CamperDetailPage.tsx`

---

### BUG-048
**Title:** Portal context links broken — AdminApplicationsPage and AdminCampersPage hardcode /admin/* paths
**Module:** Admin / Super Admin — Applications and Camper Management
**Severity:** High
**Status:** Resolved — Phase 5
**Description:** `AdminApplicationsPage` and `AdminCampersPage` are shared between `/admin/*` and `/super-admin/*` portals. All internal navigation links hardcoded `/admin/applications/:id` and `/admin/campers/:id`, causing super admin users to be dropped into the Admin portal shell mid-flow. The same issue existed in `ApplicationReviewPage`'s back link.
**Resolution:** Added `useLocation` to all three pages. Portal prefix (`/admin` vs `/super-admin`) is now derived from the current path and applied to all internal navigation links.
**Affected Files:**
- `frontend/src/features/admin/pages/AdminApplicationsPage.tsx`
- `frontend/src/features/admin/pages/AdminCampersPage.tsx`
- `frontend/src/features/admin/pages/ApplicationReviewPage.tsx`

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 13 |
| High | 17 |
| Medium | 14 |
| Low | 7 |
| **Total** | **51** |

| Status | Count |
|--------|-------|
| Resolved | 43 |
| Open | 8 |

| Module | Issues |
|--------|--------|
| Role Naming / RBAC | BUG-001, BUG-006, BUG-033 |
| Email Verification | BUG-002, BUG-004 |
| Password Reset | BUG-003, BUG-024, BUG-031, BUG-032 |
| Medical Portal | BUG-007, BUG-008, BUG-028, BUG-034 |
| Admin — Camper Management | BUG-005, BUG-029, BUG-042, BUG-043, BUG-047 |
| Applicant Portal | BUG-009, BUG-011, BUG-030 |
| Application Form | BUG-010 |
| Seeders | BUG-012 |
| Audit Log | BUG-013 |
| Profile System | BUG-014, BUG-036, BUG-037, BUG-040, BUG-041 |
| Inbox / Messaging | BUG-015, BUG-016, BUG-017, BUG-049, BUG-050 |
| Recent Updates | BUG-018 |
| Super Admin Dashboard | BUG-019 |
| Form Management | BUG-020, BUG-021 |
| Admin Reports | BUG-022, BUG-023 |
| Notification Settings | BUG-027 |
| Documentation | BUG-025, BUG-026 |
| Security | BUG-031, BUG-032 |
| Admin — Application Review | BUG-035, BUG-038, BUG-039, BUG-048 |
| Auth — Login / Session | BUG-044, BUG-045, BUG-046, BUG-051 |
| UI — Status Badges | BUG-052, BUG-053 |
