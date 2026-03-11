# Changelog

All notable changes to the Camp Burnt Gin API project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Phase 14 — Dynamic Application Form Management (2026-03-10)

#### Added

**New Migrations (5)**
- `2026_03_10_200001_create_form_definitions_table` — `form_definitions`: id, name, slug (unique), version (smallint), status enum(draft/active/archived), description, created_by_user_id (FK→users nullOnDelete), published_at, timestamps
- `2026_03_10_200002_create_form_sections_table` — `form_sections`: id, form_definition_id (FK cascadeOnDelete), title, short_title, description, icon_name, sort_order, is_active, timestamps; indexed on (form_definition_id, sort_order) and (form_definition_id, is_active)
- `2026_03_10_200003_create_form_fields_table` — `form_fields`: id, form_section_id (FK cascadeOnDelete), field_key (unique per section), label, placeholder, help_text, field_type (enum 13 types), is_required, is_active, sort_order, validation_rules (json), conditional_logic (json), default_value, width (enum full/half/third), timestamps
- `2026_03_10_200004_create_form_field_options_table` — `form_field_options`: id, form_field_id (FK cascadeOnDelete), label, value, sort_order, is_active, timestamps
- `2026_03_10_200005_add_form_definition_id_to_applications_table` — nullable `form_definition_id` FK (nullOnDelete) on `applications` for version-locking historical submissions

**New Models**
- `app/Models/FormDefinition.php` — HasMany sections/activeSections, BelongsTo createdBy; scopes: active(), draft(); helpers: isActive(), isEditable()
- `app/Models/FormSection.php` — BelongsTo formDefinition, HasMany fields/activeFields; scope: active()
- `app/Models/FormField.php` — BelongsTo formSection, HasMany options/activeOptions; casts validation_rules + conditional_logic as array; scope: active()
- `app/Models/FormFieldOption.php` — BelongsTo formField; scope: active()

**New Policies**
- `app/Policies/FormDefinitionPolicy.php` — viewAny: isAdmin(); view: any authenticated; create/update/delete: isSuperAdmin() + editable; publish: isSuperAdmin() + status=draft; duplicate: isSuperAdmin()
- `app/Policies/FormSectionPolicy.php` — view/viewAny: isAdmin(); mutations: isSuperAdmin() + formDefinition.isEditable()
- `app/Policies/FormFieldPolicy.php` — view/viewAny: isAdmin(); mutations: isSuperAdmin() + formSection.formDefinition.isEditable()

**New Service**
- `app/Services/Form/FormBuilderService.php` — publish() (archives current active, activates draft, invalidates cache inside transaction), duplicate() (eager-loads full tree before N+1-free deep copy), seedFromHardcodedForm() (creates v1 from current ApplicationFormPage.tsx: 10 sections, 112 fields), validateKeyChange() (guards field_key renames when submitted applications exist), invalidateCache()

**New Exception**
- `app/Exceptions/FormFieldKeyChangeException.php` — thrown when field_key change attempted on a field referenced by submitted applications

**New Form Request Classes (8)**
- `app/Http/Requests/Form/StoreFormDefinitionRequest.php`
- `app/Http/Requests/Form/UpdateFormDefinitionRequest.php`
- `app/Http/Requests/Form/StoreFormSectionRequest.php`
- `app/Http/Requests/Form/UpdateFormSectionRequest.php`
- `app/Http/Requests/Form/ReorderFormItemsRequest.php` (shared by section/field/option reorder endpoints)
- `app/Http/Requests/Form/StoreFormFieldRequest.php` (validates field_key regex `^[a-z][a-z0-9_]*$`)
- `app/Http/Requests/Form/UpdateFormFieldRequest.php`
- `app/Http/Requests/Form/StoreFormFieldOptionRequest.php`
- `app/Http/Requests/Form/UpdateFormFieldOptionRequest.php`

**New Controllers (4)**
- `app/Http/Controllers/Api/Form/PublicFormController.php` — GET /form/active (cached schema, 10-min TTL), GET /form/versions/{form}
- `app/Http/Controllers/Api/Form/FormDefinitionController.php` — full CRUD + publish + duplicate; index() uses withCount to avoid N+1
- `app/Http/Controllers/Api/Form/FormSectionController.php` — CRUD + reorder; reorder scoped to definition's sections only
- `app/Http/Controllers/Api/Form/FormFieldController.php` — CRUD + reorder + activate/deactivate; store/update authorized via transient model pattern; reorder scoped to section's fields only
- `app/Http/Controllers/Api/Form/FormFieldOptionController.php` — CRUD + reorder; all mutations authorized via parent field policy; reorder scoped to field's options only

**New Seeder**
- `database/seeders/FormDefinitionSeeder.php` — calls FormBuilderService::seedFromHardcodedForm(); seeded successfully: 10 sections, 112 fields matching current ApplicationFormPage.tsx

**New Routes (26)** added to `routes/api.php`:
- `GET /form/active`, `GET /form/versions/{form}` — public schema (authenticated)
- `GET|POST /form/definitions`, `GET|PUT|DELETE /form/definitions/{form}`, `POST /form/definitions/{form}/publish|duplicate`
- `GET|POST /form/definitions/{form}/sections`, `PUT|DELETE /form/definitions/{form}/sections/{section}`, `POST /form/definitions/{form}/sections/reorder`
- `GET|POST /form/sections/{section}/fields`, `PUT|DELETE /form/sections/{section}/fields/{field}`, `POST /form/sections/{section}/fields/reorder`, `POST /form/fields/{field}/activate|deactivate`
- `GET|POST /form/fields/{field}/options`, `PUT|DELETE /form/fields/{field}/options/{option}`, `POST /form/fields/{field}/options/reorder`

**New Frontend Files**
- `frontend/src/features/forms/types/form.types.ts` — TypeScript types: FieldType (13), FieldWidth, FormDefinitionStatus, FormFieldOption, FormFieldSchema, FormFieldAdmin, FormSectionSchema, FormSectionAdmin, FormDefinitionListItem, FormDefinitionDetail, FormSchema, mutation payload types
- `frontend/src/features/forms/api/forms.api.ts` — all admin CRUD API functions (25 functions)
- `frontend/src/features/superadmin/components/form-builder/OptionsEditor.tsx` — inline option editor for select/radio/checkbox_group fields
- `frontend/src/features/superadmin/components/form-builder/AddSectionModal.tsx` — create/edit section modal
- `frontend/src/features/superadmin/components/form-builder/AddFieldModal.tsx` — create/edit field modal with type grid, conditional logic, OptionsEditor
- `frontend/src/features/superadmin/pages/FormBuilderPage.tsx` — three-column layout: version list | section list | field list; full CRUD + reorder + activate/deactivate

#### Modified
- `app/Models/Application.php` — added form_definition_id to $fillable + formDefinition() BelongsTo relationship
- `app/Providers/AppServiceProvider.php` — registered FormDefinitionPolicy, FormSectionPolicy, FormFieldPolicy
- `database/seeders/DatabaseSeeder.php` — added FormDefinitionSeeder to system configuration section
- `routes/api.php` — added 26 form management routes
- `frontend/src/features/parent/api/applicant.api.ts` — added getActiveFormSchema()
- `frontend/src/shared/constants/routes.ts` — added SUPER_ADMIN_FORM_BUILDER constant
- `frontend/src/core/routing/index.tsx` — added /super-admin/form-builder lazy route
- `frontend/src/ui/layout/SuperAdminLayout.tsx` — added Form Builder to pinned system nav items
- `frontend/src/i18n/en.json` + `es.json` — added portal_nav.form_builder key + full form_builder i18n section (~40 keys each)

#### Security Fixes (found during code review, resolved same session)
- **BUG-057**: `FormSectionController::store()` and `update()` had no authorization — any authenticated user could create/modify sections. Fixed using transient model + `$this->authorize('create', $transient)` pattern.
- **BUG-058**: `FormSectionController::reorder()` did not scope batch UPDATE to the request's definition — any super_admin could reorder sections from other definitions. Fixed with `->where('form_definition_id', $form->id)`.
- **BUG-059**: `FormFieldController::store()` and `update()` had no authorization. Fixed using transient model pattern for store(), `$this->authorize('update', $field)` for update().
- **BUG-060**: `FormFieldController::reorder()` used `firstOrNew()` for authorization (null-deref risk if section has no fields) and did not scope the batch UPDATE. Fixed by authorizing against formDefinition and scoping with `->where('form_section_id', $section->id)`.
- **BUG-061**: `FormFieldOptionController::index()`, `store()`, and `update()` had no authorization. Fixed using `$this->authorize('view'/'update', $field)` (parent field as authorization proxy).
- **BUG-062**: `FormFieldOptionController::reorder()` used raw `isSuperAdmin()` check without editable-status guard and did not scope the batch UPDATE. Fixed with policy-based auth and `->where('form_field_id', $field->id)`.

#### Performance Fixes (found during code review, resolved same session)
- **FormDefinitionController::index()**: replaced per-definition `$def->sections()->count()` with `->withCount('sections')` (eliminates N+1)
- **FormBuilderService::duplicate()**: added `$source->load('sections.fields.options')` before nested loops (eliminates N+1 inside transaction)
- **FormBuilderService::publish()**: moved `$this->invalidateCache()` inside the DB transaction closure (atomically clears cache with status change)
- **FormDefinitionPolicy::publish()**: added `&& $form->status === 'draft'` guard (defense-in-depth; controller had a 409 check but policy was the missing authoritative gate)

#### Setup Required
```bash
php artisan migrate
php artisan db:seed --class=FormDefinitionSeeder
```

---

### Bugfix — Message Attachment Rendering (2026-03-10)

#### Fixed
- **Route parameter name mismatch** (`routes/api.php`): `GET /{message}/attachments/{document}` route segment renamed to `{documentId}` to match the `int $documentId` parameter in `MessageController::downloadAttachment()`. Previously Laravel could not bind the route segment to the method parameter, causing every attachment download and image preview fetch to fail.
- **`MessageAttachmentResource`** (`app/Http/Resources/MessageAttachmentResource.php`, new): Replaces raw `Document` model serialization in message responses. Exposes only `id`, `original_filename`, `mime_type`, `file_size` — storage internals (`path`, `stored_filename`, `disk`) and PHI audit fields (`verification_status`, `is_scanned`, etc.) are never sent to the client.
- **`MessageController::shapeMessage()`**: New private helper used by `index()`, `store()`, and `show()`. Runs attachments through `MessageAttachmentResource` and shapes sender to include only `id`, `name`, `email`, `role`.
- **Wrong storage path in download** (`MessageController::downloadAttachment`): Was using `storage_path('app/' . $document->path)` which resolves to `storage/app/...`, but the Laravel 12 `local` disk root is `storage/app/private/`. All downloads were throwing `FileNotFoundException`, caught by the catch block and returned as 404. Fixed by using `Storage::disk($document->disk)->download()` which resolves the path through the correct disk root.
- **Frontend** (`ThreadView.tsx`): Added `|| 'Attachment'` / `|| 'attachment'` fallback for `att.original_filename` in display and download filename in case the field is ever empty.

---

### Phase 11 — Medical Portal Expansion (2026-03-07)

#### Added

**New Models & Migrations**
- `MedicalIncident` (`app/Models/MedicalIncident.php`) — incident reports with `IncidentType` enum (`behavioral`, `medical`, `injury`, `environmental`, `emergency`, `other`) and `IncidentSeverity` enum (`minor`, `moderate`, `severe`, `critical`); all PHI fields encrypted
- `MedicalFollowUp` (`app/Models/MedicalFollowUp.php`) — follow-up task queue with `FollowUpStatus` (`pending`, `in_progress`, `completed`, `cancelled`) and `FollowUpPriority` (`low`, `medium`, `high`, `urgent`) enums; tracks `assigned_to`, `completed_at`, `completed_by`
- `MedicalVisit` (`app/Models/MedicalVisit.php`) — health office visit records with `vitals` JSON column (`temp`, `pulse`, `bp`, `spo2`, `weight`) and `VisitDisposition` enum (`returned_to_activity`, `monitoring`, `sent_home`, `emergency_transfer`, `other`); chief complaint, symptoms, treatment, and disposition notes are encrypted PHI
- `MedicalRestriction` (`app/Models/MedicalRestriction.php`) — camper restrictions (activity, dietary, environmental, equipment) with active/expired tracking
- Migrations for all four new tables with compound indexes on `(camper_id, incident_date)`, `(camper_id, visit_date)`, `(camper_id, is_active)`, and individual indexes on status, type, severity, due_date columns
- `HasMany` relationships added to `Camper` model: `incidents()`, `followUps()`, `visits()`, `restrictions()`

**New Controllers & Routes**
- `MedicalStatsController` — `GET /medical/stats`: returns dashboard aggregate counts (campers with severe allergies, on medications, with active restrictions, missing records), follow-up queue metrics (overdue, due today, open), recent activity feed, and treatment type breakdown
- `MedicalIncidentController` — full CRUD under `role:admin,medical` middleware; camper-scoped listing via `GET /medical-incidents/camper/{camper}`; destroy restricted to admin
- `MedicalFollowUpController` — full CRUD; status transition on PUT automatically sets `completed_at` and `completed_by`; destroy restricted to admin
- `MedicalVisitController` — full CRUD; camper-scoped listing via `GET /medical-visits/camper/{camper}`; destroy restricted to admin
- `MedicalRestrictionController` — medical role has read-only access; create/update/delete restricted to admin

**New Policies**
- `MedicalIncidentPolicy`, `MedicalFollowUpPolicy`, `MedicalVisitPolicy`, `MedicalRestrictionPolicy` — all registered in `AppServiceProvider`

**Frontend**
- `MedicalDashboardPage` transformed into an operational command center: 5-stat bar (powered by `/medical/stats`), alert strip for overdue/due-today follow-ups, two-column layout (recent activity feed + follow-up task panel with mark-complete), paginated camper medical directory with search
- New pages: `MedicalIncidentsPage` (dual-mode: global + camper-scoped), `MedicalFollowUpsPage` (5 tab filters), `MedicalVisitsPage` (dual-mode with vitals entry), `MedicalEmergencyViewPage` (read-only emergency quick view with 7 sections)
- 3 new sidebar navigation items: Incidents, Follow-Ups, Visits
- New route constants and lazy-loaded routes for all new pages + camper-scoped variants

#### Fixed

- `CamperController::index()` — medical providers previously received an empty `data: []` response; corrected by adding an explicit `isMedicalProvider()` branch that returns all campers with eager-loaded medical relations and search support

#### Updated

- `docs/backend/API_REFERENCE.md` — 5 new endpoint sections (incidents, follow-ups, visits, restrictions, stats); TOC updated; Camper listing endpoint notes medical role access
- `docs/backend/DATA_MODEL.md` — 4 new table schemas; table count updated (21 → 25); ERD updated; Camper relationships extended
- `docs/backend/ROLES_AND_PERMISSIONS.md` — Medical provider narrative expanded; 4 new permission matrix sections (incidents, follow-ups, visits, restrictions); camper listing permission updated
- `docs/backend/AUDIT_LOGGING.md` — 4 new route patterns added to PHI monitoring; PHI event list updated; new logging examples added

---

### Phase 10 — Documentation and Codebase Guide (2026-03-06)

#### Added

- `README.md` updated to include developer debugging quick-reference, key file paths, authentication flow, and full documentation map.

#### Updated

- `docs/decisions/CHANGELOG.md` — Phases 8, 9, and post-phase fixes added.
- `docs/backend/ROLES_AND_PERMISSIONS.md` — "Parent" role references updated to "Applicant" throughout; hierarchy notation updated; role assignment description updated.
- `docs/backend/AUDIT_LOGGING.md` — Phase 9 audit log enhancements documented: human descriptions, category mapping, export endpoint.
- `BUG_TRACKER.md` — status updated for all Phase 8–10 resolved items; new post-phase bugs added (BUG-049 through BUG-053); summary table updated.

---

### Post-Phase 8 Fixes (2026-03-06)

#### Fixed

- `ConversationController::store()` — `hasNonAdminParticipants` check was `$role !== 'admin'`, treating `super_admin` as a non-admin. Corrected to `!in_array($role, ['admin', 'super_admin'], true)`. Applicants can now start conversations with super admins. (BUG-049)
- `InboxPage.tsx` — folder switching caused a brief blank/skeleton flash because `setConversations([])` was called immediately in `changeFolder`. Fix: stale content stays visible during load; new data replaces it atomically. Top loading bar overlay replaces skeleton rows. (BUG-050)
- `useAuthInit.ts` — token was read from `localStorage` but written to `sessionStorage` on login, causing logout on every page refresh. All three `localStorage` references corrected to `sessionStorage`. (BUG-051)
- `StatusBadge.tsx` — `under_review` status badge was green (matching `approved`). Changed to light yellow background with dark amber text. `pending` status badge changed from green to grey to distinguish it from approved/active states. (BUG-052, BUG-053)

---

### Phase 9 — Audit Log Redesign (2026-03-06)

#### Changed

- `AuditLogController` fully rewritten:
  - `buildQuery(Request $request)` — shared filter builder used by both `index()` and `export()`.
  - `formatEntries(array $items)` — enriches each entry with `human_description`, `category`, and `entity_label`.
  - `buildHumanDescription(...)` — maps 20+ action/entity combinations to plain-English sentences (e.g., "Super Administrator approved Application #42").
  - `mapCategory(string $eventType)` — maps backend event type strings to display categories: Authentication, Messaging, Applications, Notifications, Security, Medical, Administrative, Documents, System.
  - `shortEntityType(string $type)` — strips namespace from Eloquent model class names for display.
  - `export(Request $request)` — new endpoint `GET /audit-log/export?format=csv|json`. Returns up to 5,000 rows as a file download.
- `routes/api.php` — single `GET /audit-log` route replaced with a prefixed group: `GET /audit-log` (index) and `GET /audit-log/export` (export), both under `role:super_admin` middleware.
- `admin.types.ts` — `AuditLogEntry` interface extended with `category`, `human_description`, `entity_label`.
- `admin.api.ts` — `getAuditLog()` updated to accept `event_type` and `entity_type` params; `exportAuditLog()` added as a blob-download function.
- `AuditLogPage.tsx` — fully redesigned:
  - Timeline layout with expandable entry rows.
  - `CategoryBadge` — colored pill with icon per event category.
  - `AuditEntryRow` — displays human description, category badge, user/IP/entity meta, timestamp + relative time, expand/collapse toggle.
  - `MetadataPanel` — translates raw route/method/status metadata into plain English ("Action performed: Viewed a camper profile", "Result: Success").
  - `DiffBlock` — before/after value comparison with human-readable field labels.
  - User agent parsed to "Chrome 145 on macOS" instead of raw UA string.
  - Export buttons (CSV, JSON), collapsible filter panel, pagination.

#### Fixed

- BUG-013: Audit log displayed vague raw action names with no human-readable context, no categories, no before/after values, no export.

---

### Phase 8 — Inbox / Messaging Restructure (2026-03-06)

#### Added

- Migration `2026_03_06_000001_add_per_user_state_to_conversation_participants_table.php` — adds `is_starred BOOLEAN`, `is_important BOOLEAN`, `trashed_at TIMESTAMP NULL` to `conversation_participants`. **Run `php artisan migrate` before testing inbox folders.**
- All 8 inbox folders implemented: Inbox, Starred, Important, Sent, Drafts, Trash, Scheduled, Archive.
- Per-user folder state persisted to backend via `ConversationParticipant` fields.
- Three-pane Gmail-style layout: folder pane, message list pane, thread viewer pane.
- Floating compose modal with rich text editor (bold, italic, underline, lists), attachment support.
- Bulk actions toolbar: archive, delete, mark read/unread.
- Stale-while-revalidate folder loading: old content visible while new data loads, replaced atomically.
- Top loading bar overlay on folder switch (replaces skeleton row flash).

#### Fixed

- BUG-015: Starred state was client-only (localStorage). Now persisted to `conversation_participants.is_starred`.
- BUG-016: Inbox missing Drafts, Sent, Trash with restore, Scheduled, Important folder. All implemented.

---

### Phase 7 — Notifications and Recent Updates (2026-03-06)

#### Fixed

- `ApplicationStatusChangedNotification::via()` — now reads `notification_preferences.application_updates` from the notifiable user before including the `mail` channel. Previously, email was always sent regardless of user preferences.
- `ApplicationSubmittedNotification::via()` — same fix as above; respects `application_updates` preference.
- `NewMessageNotification::via()` — now reads `notification_preferences.messages` before including `mail`. Previously always sent email.
- `NewConversationNotification::via()` — same fix; respects `messages` preference.
- `NotificationController::index()` — previously returned raw `DatabaseNotification` Eloquent models, causing `title` and `message` to be absent from the response (they live inside the `data` JSON column, not as top-level fields). Controller now maps each notification to an explicit shape: `id`, `type`, `title`, `message`, `data`, `read_at`, `created_at`. The frontend can now render human-readable notification content directly.
- `NotificationController::index()` — `unread_only` filter previously used separate query paths; consolidated to a single conditional for clarity.
- `Notification` TypeScript type — `id` corrected from `number` to `string` (Laravel DatabaseNotifications use UUID primary keys). `read_at` type widened to `string | null`.
- `ApplicantDashboardPage` — `pendingCount` filter used `'submitted'` which is not a valid `ApplicationStatus` value; corrected to `'pending'`.

#### Changed

- All notification `toArray()` methods now include `title` and `message` fields so stored notifications are self-describing. This eliminates blank notification cards in the Recent Updates widget.
- `SettingsPage` notification preferences are now fetched on component mount rather than only when the notifications tab is first opened. This eliminates a race condition where an in-flight preference load would overwrite an optimistic toggle update made by the user immediately after opening the tab.
- `handleNotifToggle` in `SettingsPage` now guards against simultaneous saves (early return when `savingNotif !== null`) and uses the functional `setState` updater to avoid stale closure bugs.
- All notification preference toggles are now disabled while any one is saving, preventing duplicate toast messages.
- Notification preference toggle descriptions added to the Settings UI so users understand what each toggle controls.
- `notifications.api.ts` — `getNotifications()` return type updated to `NotificationsResponse` (custom shape with `unread_count` in meta). `markNotificationRead()` parameter type updated to `string` to match UUID ids.
- `ApplicantDashboardPage` "Recent Updates" widget rebuilt: shows notification type icon, human-readable title, body message, relative timestamp, unread indicator dot, per-item mark-as-read on click, and a "Mark all read" shortcut button.
- `NotificationPanel` (slide-out panel) `handleMarkRead` parameter type updated to `string` to match UUID ids.

---

### Phase 6 — Medical Portal Fixes & Feature Completion (2026-03-06, continued)

#### Fixed

- `CamperPolicy::view()` — medical providers can now view individual camper profiles. Required for clinical workflows: recording treatments against a named camper, reviewing medical records, and uploading documents. Medical role still cannot list, create, update, or delete campers.
- `MedicalTreatmentLogPage` — handled the case where `camperId` is absent (global `/medical/treatments` nav route). Previously called `getCamper(NaN)` → 403/404 → "Failed to load data" for all medical staff navigating from the sidebar. Now conditionally skips the `getCamper` call and fetches all treatment logs when no camper context is present.
- `treatment_logs` migration — `title` column changed from `string(255)` to `text`. The `encrypted` cast produces Base64-encoded ciphertext that exceeds VARCHAR(255) for any non-trivial input, causing silent data truncation. `text` type (65,535 bytes) accommodates all encrypted values.

#### Changed

- Auth token storage changed from `localStorage` to `sessionStorage`. Eliminates the multi-tab session collision bug where logging into one tab overwrote the token used by all other tabs. Each browser tab now maintains an isolated session, enabling testing of multiple roles simultaneously without interference. Normal single-tab production use is unaffected.
- Medical portal navigation — Announcements nav item added. Route `/medical/announcements` now renders the read-only `ParentAnnouncementsPage` for medical staff. Medical staff can view announcements but cannot create, edit, or delete them.

---

### Phase 6 — Medical Portal Rebuild (2026-03-06)

#### Added

- `TreatmentLog` model (`app/Models/TreatmentLog.php`) with PHI encryption on `title`, `description`, `outcome`, `follow_up_notes` via Laravel `encrypted` cast
- `TreatmentType` enum (`app/Enums/TreatmentType.php`) with cases: `MedicationAdministered`, `FirstAid`, `Observation`, `Emergency`, `Other`
- `TreatmentLogPolicy` (`app/Policies/TreatmentLogPolicy.php`) — admin full access; medical staff can create and update own entries only; no delete for medical role
- `StoreTreatmentLogRequest` and `UpdateTreatmentLogRequest` form requests with HIPAA-appropriate validation
- `TreatmentLogController` (`app/Http/Controllers/Api/Medical/TreatmentLogController.php`) with index (filterable by camper_id, date range, type), store, show, update, destroy
- Migration `2026_03_06_000010_create_treatment_logs_table.php` — adds `treatment_logs` table with indexes on `[camper_id, treatment_date]` and `recorded_by`
- Treatment log routes under `role:admin,medical` middleware; destroy restricted to `admin` middleware only
- `TreatmentLog::class => TreatmentLogPolicy::class` registered in `AppServiceProvider`
- **Frontend — `MedicalTreatmentLogPage`**: full treatment log UI with add-entry form, type badges, expandable log entries, follow-up indicators; supports both `/medical/treatments` (all campers) and `/medical/records/:camperId/treatments` (per-camper)
- **Frontend — `MedicalDocumentsPage`**: drag-and-drop upload zone, upload progress tracking, download via blob URL, per-camper document listing
- **Frontend** routes for `/medical/treatments`, `/medical/records/:camperId/treatments`, `/medical/records/:camperId/documents`, `/medical/inbox`
- **Frontend** `MedicalLayout` nav items: Treatment Logs, Inbox (previously missing)
- **Frontend** `ROUTES` constants: `MEDICAL_TREATMENT_LOGS`, `MEDICAL_RECORD_TREATMENTS`, `MEDICAL_RECORD_DOCUMENTS`
- **i18n** (en + es): `medical.treatments.*`, `medical.documents.*`, `medical.modal.*` namespaces; common keys `notes`, `description`, `download`, `permitted`, `not_permitted`

#### Changed

- `MedicalRecordPolicy` — removed `MedicalProviderLink` gate from `view()` and `update()`; medical staff have direct access as logged-in users
- `AllergyPolicy`, `MedicationPolicy`, `DiagnosisPolicy`, `BehavioralProfilePolicy`, `FeedingPlanPolicy`, `AssistiveDevicePolicy`, `ActivityPermissionPolicy` — same provider link gate removal; medical staff can now create and update (but not delete) all sub-records
- `DocumentPolicy` — medical staff can access all `Camper` and `MedicalRecord` documents without a provider link check
- `DocumentController::index()` — added `isMedicalProvider()` branch fetching all camper and medical record documents
- **Frontend** `MedicalRecordPage` — rebuilt from read-only viewer to full edit UI with 14 modal types for inline editing of all medical sub-resources
- **Frontend** `medical.api.ts` — added write operations for all medical sub-resources; added full `TreatmentLog` API section with TypeScript interfaces; added `getCamperDocuments()`, `uploadDocument()`, `downloadDocument()`

#### Fixed

- BUG-007: Medical portal was read-only for camp medical staff; root cause was `MedicalProviderLink` policy gate designed for external unauthenticated providers being incorrectly applied to logged-in medical role users
- BUG-028: Medical portal missing write capabilities, treatment log, and document management — all implemented in this phase
- BUG-034: `/medical/inbox` route missing; route and nav item added

---

### Frontend — Phase 5 Continuation (2026-03-06)

#### Fixed

- `SuperAdminDashboardPage` quick links corrected: `/admin/applications` and `/admin/campers` changed to `/super-admin/applications` and `/super-admin/campers` — super admins now navigate within the Super Admin portal shell.
- `AdminApplicationsPage` "Review" link is now portal-context-aware using `useLocation`. When the page is loaded inside `/super-admin/applications`, review links correctly navigate to `/super-admin/applications/:id`.
- `AdminCampersPage` "View Risk" and "View" links are now portal-context-aware. When loaded inside `/super-admin/campers`, all camper links resolve to `/super-admin/campers/:id`.
- `ApplicationReviewPage` "Back to Applications" link is now portal-context-aware. When loaded inside the Super Admin portal, the back link returns to `/super-admin/applications`.
- `CamperDetailPage` T-Shirt Size field corrected from `camper.t_shirt_size` to `camper.tshirt_size` — field was silently resolving to `undefined` due to property name mismatch with the `Camper` TypeScript type.
- `FormManagementPage` header description updated to clearly explain the feature purpose: supplemental PDF/Word form templates that applicants must complete, optionally scoped to a camp session.

---

## [1.1.0] - 2026-03-01

### Overview

Patch and feature release addressing bugs identified during structured QA testing, completing the announcement and calendar systems, adding form template management, and extending the audit logging and user management APIs.

### Added

- `UserController` at `app/Http/Controllers/Api/System/UserController.php` — paginated user listing, role update, account deactivation, and account reactivation under `role:super_admin` middleware
- `FormTemplateController` at `app/Http/Controllers/Api/System/FormTemplateController.php` — CRUD operations and download endpoint for uploaded PDF/Word form templates; files stored at `storage/app/form-templates/`
- `FormTemplate` model and migration (`2026_02_28_000001_create_form_templates_table.php`)
- `AuditLogController` at `app/Http/Controllers/Api/System/AuditLogController.php` — `GET /api/audit-log` with search parameter support, under `role:super_admin` middleware
- Notification preferences backend: migration (`2026_02_27_115413_add_notification_preferences_to_users_table.php`), model fields, and controller endpoints on `UserProfileController`
- `CalendarEventsController` — `GET/POST/PUT/DELETE /api/calendar` endpoints for camp event management
- Announcements pin and urgent flags on `AnnouncementsController`
- `GET /api/users` and `PUT /api/users/{id}/role` routes registered under `role:super_admin`

### Fixed

- `AuditLogController::index()` response structure corrected to return `{ data, meta: { current_page, last_page, per_page, total, from, to } }` (previously returned flat paginator)
- `AuthController::register()` now calls `->load('role')` before returning the user object, resolving the null role crash on first login
- `ReportController` updated to return `StreamedResponse` with `Content-Type: text/csv`; `id_labels` export handles `camp_session_id` as optional
- Account lockout threshold corrected to 5 attempts (was incorrectly set to 10 in `User.php` and `AuthService.php`)
- `ProfilePage` MFA handlers now propagate actual backend error messages instead of generic fallback strings

### Testing

- Test suite expanded to 308 passing tests with 708 assertions
- Feature tests added for `UserController`, `FormTemplateController`, `AuditLogController`, and `CalendarEventsController`
- Account lockout threshold tests corrected to match implementation

---

## [1.0.0] - 2026-02-11

### Overview

Initial production release of the Camp Burnt Gin API backend. This release represents a complete, production-ready API system for managing camp registrations, medical information, and administrative workflows with HIPAA-compliant PHI handling.

**Release Highlights:**
- Complete authentication and authorization system with MFA support
- Comprehensive medical information management with PHI audit logging
- Application workflow with digital signatures and review process
- Document management with security scanning
- Medical provider secure link system
- Administrative reporting capabilities
- Full test coverage (228 tests, 430 assertions)
- Security audit completed with zero vulnerabilities

### Added

#### Authentication and Security
- User registration with email/password authentication
- Token-based authentication via Laravel Sanctum
- Multi-factor authentication (MFA) using TOTP
- MFA enrollment with QR code generation
- Password reset flow with secure tokens (30-minute expiration)
- Role-based access control (Admin, Parent, Medical roles)
- Policy-based authorization for fine-grained access control
- Rate limiting on authentication endpoints (5 attempts/minute)
- Account lockout after 5 failed login attempts (15-minute cooldown)
- Token expiration (30 minutes) for HIPAA compliance
- Session encryption with APP_KEY
- Bcrypt password hashing (cost factor 14)

#### User Management
- User profile management (view, update)
- Role assignment system
- Pre-fill data endpoint for returning applicants
- User-owned camper relationships

#### Camp Management
- Camp CRUD operations (Create, Read, Update, Delete)
- Camp session management with dates and capacity tracking
- Age requirements (min/max) for sessions
- Registration windows (open/close dates)
- Session capacity limits
- Active/inactive status flags

#### Camper Management
- Camper profile creation and management
- Parent-owned camper relationships
- Camper information (name, DOB, gender)
- Authorization checks for camper access

#### Application Management
- Application creation with draft mode
- Application submission workflow
- Digital signature capture and storage
- Application review by administrators
- Status transitions (pending → under_review → approved/rejected/waitlisted)
- Application cancellation by parents
- Unique constraint (one application per camper per session)
- Application search and filtering
- Application status notifications

#### Medical Information Management
- Medical record CRUD operations
- Allergy tracking with severity levels (mild, moderate, severe, life-threatening)
- Medication tracking with dosage and frequency
- Emergency contact management with pickup authorization
- PHI access restricted by role and ownership
- Audit logging for all PHI access (HIPAA compliance)

#### Medical Provider Integration
- Secure provider link generation (64-character tokens)
- Token expiration (72 hours default)
- Single-use link enforcement
- Provider submission without authentication
- Link revocation capability
- Provider access audit logging

#### Document Management
- File upload with validation (MIME type, size, extension)
- Supported file types (PDF, images, Word documents)
- File size limit (10 MB)
- Security scanning (quarantine-based approval)
- Document download with authorization
- Document deletion by owner or admin
- Polymorphic associations (attach to campers, medical records, applications)
- Unscanned document protection (admin-only access)

#### Notification System
- Email notifications for application status changes
- Database notification storage for in-app display
- Notification read status tracking
- Acceptance and rejection letter generation
- Provider link notifications
- Application submission notifications
- Asynchronous notification dispatch via queue
- Notification retry logic (3 attempts with exponential backoff)

#### Reporting System
- Applications report with filtering and statistics
- Accepted applicants report
- Rejected applicants report
- Mailing labels data generation
- ID labels with allergy information
- Admin-only access restriction

#### Audit Logging
- PHI access logging via middleware
- Authentication event logging
- Administrative action logging
- Audit log database table with indexed queries
- Request ID correlation for distributed tracing
- Graceful failure handling (audit failures don't block requests)
- HIPAA-compliant audit trail

#### API Features
- RESTful API design with consistent response formats
- Pagination for list endpoints (default 15 items per page)
- Request validation via Form Request classes
- JSON response format for all endpoints
- Standard HTTP status codes
- Rate limiting (60 requests/minute general, tiered for sensitive endpoints)
- CORS configuration support
- Request ID middleware for tracing

### Testing
- 228 automated tests with 430 assertions
- Feature tests for all major workflows
- Unit tests for business logic
- Policy tests for authorization
- Test coverage for authentication, application workflow, medical records
- Fast test execution (~2-3 seconds for full suite)

### Documentation
- Comprehensive API reference documentation
- System architecture documentation
- Security documentation with HIPAA compliance notes
- Data model documentation
- Testing guide
- Environment setup guide
- Contributing guidelines
- Business rules documentation
- Roles and permissions matrix
- Backend completion status document

### Security
- Security audit completed February 11, 2026
- 29 security, performance, and architectural issues resolved
- Zero vulnerabilities remaining
- Enterprise-grade security posture
- HIPAA Technical Safeguards compliance
- Input validation on all endpoints
- SQL injection prevention via Eloquent ORM
- XSS prevention via JSON responses
- CSRF protection
- Secure password storage with bcrypt
- API token hashing (SHA-256)
- MFA secret encryption
- Audit logging for compliance

### Infrastructure
- Laravel 12.x framework
- PHP 8.2+ requirement
- MySQL 8.0+ database
- Redis support for caching and queues
- Queue worker support via Supervisor
- File storage (local, S3-compatible)
- Email delivery via SMTP, SendGrid, Mailgun, SES

### Changed
- None (initial release)

### Deprecated
- None (initial release)

### Removed
- None (initial release)

### Fixed
- None (initial release)

### Security
- All known security vulnerabilities addressed in security audit

---

## Version History

### Version Numbering

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR version** (1.x.x): Incompatible API changes
- **MINOR version** (x.1.x): New functionality in a backwards-compatible manner
- **PATCH version** (x.x.1): Backwards-compatible bug fixes

### Release Types

- **Major Release** (1.0.0, 2.0.0): Significant new features, breaking changes
- **Minor Release** (1.1.0, 1.2.0): New features, backwards-compatible
- **Patch Release** (1.0.1, 1.0.2): Bug fixes, security patches

---

## Migration Guides

### Migrating from Pre-Release to 1.0.0

**Database:**
- No migration required (initial release)
- Run `php artisan migrate` for fresh installation

**Configuration:**
- Copy `.env.example` to `.env`
- Configure all required environment variables
- Generate application key: `php artisan key:generate`

**Dependencies:**
- Run `composer install --no-dev --optimize-autoloader`

---

## Future Releases

### Planned for 1.1.0
- Payment processing integration
- Advanced reporting with custom filters
- Bulk operations for administrators
- Enhanced notification preferences
- Calendar view for camp sessions

Planned future enhancements include payment processing integration, real-time features via WebSockets, and extended mobile support.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing to this project.

---

## Links

- [Repository](https://github.com/your-org/camp-burnt-gin-api)
- [Documentation](./README.md)
- [Issue Tracker](https://github.com/your-org/camp-burnt-gin-api/issues)
- [Security Policy](./SECURITY.md)

---

**Document Status:** Authoritative
**Maintained By:** Development Team
**Last Updated:** March 2026
