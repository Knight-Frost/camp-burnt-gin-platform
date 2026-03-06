# Codebase Guide — Camp Burnt Gin

This guide explains how the entire Camp Burnt Gin codebase is organized, how the backend and frontend interact, and how data flows through the system. It is written so that anyone joining the project — including those new to web development — can orient themselves quickly, and so that experienced engineers can identify precisely where a bug originates.

---

## Table of Contents

1. [What the System Does](#1-what-the-system-does)
2. [Technology Overview](#2-technology-overview)
3. [Top-Level Directory Structure](#3-top-level-directory-structure)
4. [Backend Deep Dive](#4-backend-deep-dive)
5. [Frontend Deep Dive](#5-frontend-deep-dive)
6. [How Backend and Frontend Talk to Each Other](#6-how-backend-and-frontend-talk-to-each-other)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [User Roles and What They Can Do](#8-user-roles-and-what-they-can-do)
9. [Authentication Flow](#9-authentication-flow)
10. [Key Feature Flows](#10-key-feature-flows)
11. [Where to Look When Debugging](#11-where-to-look-when-debugging)
12. [Database Tables at a Glance](#12-database-tables-at-a-glance)
13. [Security and Compliance Layers](#13-security-and-compliance-layers)
14. [Testing](#14-testing)
15. [Configuration and Environment](#15-configuration-and-environment)

---

## 1. What the System Does

Camp Burnt Gin is a secure, HIPAA-conscious web application for managing a summer camp program for children and youth with special health care needs (CYSHCN). It replaces paper and email workflows with a structured, auditable, role-based platform.

**The system supports four groups of users:**

- **Applicants** (parents and guardians) — submit camp applications, manage camper profiles, upload documents, and communicate with staff.
- **Admin staff** — review applications, manage camp sessions, generate reports, and communicate with families.
- **Medical staff** — access and update camper medical records, record treatments, upload clinical documents.
- **Super Administrators** — everything the admin can do, plus user management, role assignment, and the system audit log.

---

## 2. Technology Overview

```
Backend                          Frontend
─────────────────────────────    ─────────────────────────────────────
Laravel 12 (PHP 8.2+)            React 18 + TypeScript 5 (strict mode)
MySQL 8.0                        Vite 5 (build tool)
Laravel Sanctum (auth tokens)    Redux Toolkit + sessionStorage (state)
PHPUnit (308 tests)              Tailwind CSS 3 + CSS design tokens
                                 Framer Motion 12 (animations)
                                 i18next (English + Spanish)
                                 date-fns (date formatting)
```

The backend exposes a JSON REST API. The frontend is a single-page application (SPA) that communicates exclusively through that API. There is no server-side rendering — the backend never generates HTML pages.

---

## 3. Top-Level Directory Structure

```
Camp_Burnt_Gin_Project/
│
├── backend/                     The Laravel API server
│   └── camp-burnt-gin-api/      All backend code lives here
│
├── frontend/                    The React application
│   ├── FRONTEND_GUIDE.md        Canonical frontend reference
│   └── src/                     All frontend source code lives here
│
├── docs/                        Project documentation
│   ├── backend/                 Backend reference docs
│   ├── frontend/                Frontend reference docs
│   └── governance/              Changelog and architecture decisions
│
├── CODEBASE_GUIDE.md            This file
├── BUG_TRACKER.md               Known issues and resolution history
├── README.md                    Project overview
└── DATABASE_ARCHITECTURE_AND_SCHEMA_DOCUMENTATION.md
```

---

## 4. Backend Deep Dive

**Root path:** `backend/camp-burnt-gin-api/`

### 4.1 Entry Point

Every HTTP request enters through Laravel's standard request lifecycle:

```
HTTP Request
    ↓
public/index.php       (Laravel bootstrap)
    ↓
routes/api.php         (Route definitions — where to send each request)
    ↓
Middleware Stack       (Auth, role checks, audit logging)
    ↓
Controller             (Receives the request, delegates to service)
    ↓
Service / Model        (Business logic + database operations)
    ↓
Resource / Response    (Formats the data to send back)
    ↓
JSON Response          (Returned to the frontend)
```

### 4.2 routes/api.php

**Path:** `routes/api.php`

This is the master list of every URL the backend responds to. Every API endpoint is defined here. When a request arrives, Laravel reads this file to decide which controller method handles it.

Example pattern:
```php
Route::middleware(['auth:sanctum', 'role:admin,super_admin'])->group(function () {
    Route::get('/applications', [ApplicationController::class, 'index']);
    Route::post('/applications/{id}/review', [ApplicationController::class, 'review']);
});
```

The middleware stack applied to each group tells you:
- `auth:sanctum` — user must be logged in with a valid token
- `role:admin,super_admin` — user must have one of these roles
- `audit.phi` — access will be recorded in the audit log

### 4.3 app/Http/Controllers/

**Path:** `app/Http/Controllers/`

Controllers are the entry point of business logic. Each controller method maps to one API endpoint. Controllers should stay thin — they validate the request, authorize it, call a service, and return a response.

```
Controllers/
├── Api/
│   ├── Auth/                  Login, register, password reset, MFA, email verify
│   ├── Camper/                Camper profiles, applications, user profiles
│   ├── Document/              File uploads, downloads, provider links
│   ├── Inbox/                 Conversations, messages, user search
│   ├── Medical/               Medical records, treatment logs
│   └── System/                Admin functions: reports, audit log, notifications,
│                              users, form templates, sessions, camps
```

**When debugging:** If an API call fails, find the endpoint in `routes/api.php`, identify the controller method, and read it. The controller tells you what service it calls and what data it expects.

### 4.4 app/Services/

**Path:** `app/Services/`

Services contain the actual business logic — the "how." Controllers delegate complex operations here. If a controller is too long, the logic belongs in a service.

Key services:
```
Services/
├── Auth/
│   ├── AuthService.php          Login, token creation, role resolution
│   └── PasswordResetService.php Password reset token lifecycle
├── ApplicationService.php       Application status transitions, notifications
├── InboxService.php             Conversation creation, message delivery, folder state
└── ...
```

### 4.5 app/Models/

**Path:** `app/Models/`

Eloquent models represent database tables. Each model file corresponds to one database table and defines:
- The columns that can be filled (`$fillable`)
- Columns that are cast (e.g., JSON, dates, encrypted values)
- Relationships to other models
- Custom accessors (computed attributes)

Key models:
```
Models/
├── User.php                  Users (all roles)
├── Camper.php                Camper profiles (linked to a User)
├── Application.php           Camp applications (Camper → CampSession)
├── MedicalRecord.php         One medical record per camper
├── Allergy.php               Belongs to MedicalRecord
├── Medication.php            Belongs to MedicalRecord
├── TreatmentLog.php          Medical staff clinical notes
├── Conversation.php          Inbox conversations (threading parent)
├── Message.php               Individual messages in a conversation
├── ConversationParticipant.php  Per-user state: read, starred, trashed, important
├── AuditLog.php              Immutable audit trail records
├── Camp.php                  Camp definitions
└── CampSession.php           Session scheduling (belongs to Camp)
```

**PHI Encryption:** Fields on MedicalRecord, Allergy, Medication, TreatmentLog, etc. use Laravel's `encrypted` cast. The value stored in the database is AES-256-CBC ciphertext. Laravel automatically decrypts it when you read the model attribute.

### 4.6 app/Policies/

**Path:** `app/Policies/`

Policies answer authorization questions: "Can this user do this action on this record?" They are called from controllers using `$this->authorize('action', $model)`.

Example — `CamperPolicy::view()`:
```php
public function view(User $user, Camper $camper): bool
{
    // Admin can view any camper
    if ($user->isAdmin()) return true;
    // Applicant can only view their own campers
    if ($user->isParent()) return $user->id === $camper->user_id;
    // Medical staff can view any camper for clinical context
    if ($user->isMedical()) return true;
    return false;
}
```

**When debugging an "access denied" error:** Find the policy class matching the resource (e.g., `ApplicationPolicy` for application errors) and read the relevant method.

### 4.7 app/Http/Requests/

**Path:** `app/Http/Requests/`

Form Request classes validate incoming data before it reaches the controller. If validation fails, Laravel automatically returns a `422 Unprocessable Entity` response with field-level error messages.

**When debugging a 422 response:** Find the form request class used by the controller action and check its `rules()` method.

### 4.8 app/Http/Resources/

**Path:** `app/Http/Resources/`

API Resources transform Eloquent models into the JSON shape the frontend expects. They can include, exclude, or rename fields before the response is sent.

**When debugging "field missing from API response":** Check if there is an API Resource for that model. If there is, the field may need to be added to `toArray()`.

### 4.9 app/Observers/

**Path:** `app/Observers/`

Observers hook into model lifecycle events (created, updated, deleted) and trigger side effects automatically — without the controller needing to call them manually.

Primary use: writing audit log entries whenever PHI-related data changes.

### 4.10 app/Notifications/

**Path:** `app/Notifications/`

Laravel Notification classes control what happens when the system needs to alert a user. Each notification defines:
- `via()` — which channels to use (database, mail) — gated by the user's notification preferences
- `toMail()` — the email body
- `toArray()` — what gets stored in the `notifications` table (must include `title` and `message`)

```
Notifications/
├── Auth/                     Password reset, email verification
├── Camper/                   Application status changes
└── NewMessageNotification.php   New inbox message
```

### 4.11 app/Enums/

**Path:** `app/Enums/`

PHP 8.1+ backed enums for type-safe status and category values.

```
Enums/
├── ApplicationStatus.php     pending, under_review, approved, rejected, waitlisted, cancelled
├── TreatmentType.php         MedicationAdministered, FirstAid, Observation, Emergency, Other
└── ...
```

### 4.12 database/migrations/

**Path:** `database/migrations/`

Migration files define the database schema. Each file creates, modifies, or drops tables. They run in filename order (by timestamp prefix).

**When debugging a database column error:** Check if the column exists in a migration. If it was added recently, run `php artisan migrate` to apply it.

### 4.13 database/seeders/

**Path:** `database/seeders/`

Seeders populate the database with initial or development data.

```
Seeders/
├── DatabaseSeeder.php    Runs on fresh install — creates roles, default super_admin
├── RoleSeeder.php        Creates all four roles
└── DevSeeder.php         Creates realistic demo users and camper data (dev only)
```

---

## 5. Frontend Deep Dive

**Root path:** `frontend/src/`

### 5.1 Overall Structure

```
src/
├── app/              App bootstrap, providers, root layouts, global pages
├── api/              Axios HTTP client configuration
├── core/             Authentication logic and routing
├── features/         Domain modules (one per major feature area)
├── ui/               Shared layout components and overlays
├── shared/           Constants, types, hooks, utilities used everywhere
├── store/            Redux store configuration
├── theme/            Theme setup
├── i18n/             Translation files (English and Spanish)
└── assets/styles/    Design tokens and global CSS
```

### 5.2 app/

**Path:** `src/app/`

The application entry point and root-level concerns.

```
app/
├── main.tsx          React root render — mounts <App> with <AppProviders>
├── App.tsx           Calls useAuthInit(), renders <RouterProvider>
├── providers.tsx     Wraps everything: Redux store, i18n, Toaster, ErrorBoundary
├── ErrorBoundary.tsx Catches unhandled React errors
├── layouts/
│   └── AuthLayout.tsx   Layout for login/register pages (no nav)
└── pages/
    ├── LoginPage.tsx
    ├── RegisterPage.tsx
    ├── MfaVerifyPage.tsx
    ├── ForgotPasswordPage.tsx
    ├── ResetPasswordPage.tsx
    ├── VerifyEmailPage.tsx
    ├── NotFoundPage.tsx
    └── ForbiddenPage.tsx
```

### 5.3 api/

**Path:** `src/api/`

```
api/
└── axios.config.ts   Configured Axios instance used by all API calls
```

`axios.config.ts` does three important things:

1. Sets the base URL from the `VITE_API_BASE_URL` environment variable.
2. Injects the Bearer token from Redux state (or sessionStorage fallback) on every request.
3. Handles error responses globally: 401 fires the `auth:unauthorized` event → clears session and redirects to login.

**When debugging "all API calls return 401":** Check `axios.config.ts` to confirm the token is being read and injected correctly.

### 5.4 core/

**Path:** `src/core/`

```
core/
├── auth/
│   ├── ProtectedRoute.tsx    Redirects to /login if not authenticated
│   └── RoleGuard.tsx         Redirects to /forbidden if wrong role
└── routing/
    └── index.tsx             All route definitions — the URL map of the app
```

**ProtectedRoute** wraps all authenticated routes. It checks `isLoading` (while session restores on refresh) and `isAuthenticated` from Redux. If either check fails, the user is redirected appropriately.

**RoleGuard** wraps each portal's route tree. It reads the user's role from Redux and denies access if they don't have a permitted role. `super_admin` inherits all `admin` permissions.

**routing/index.tsx** is the single source of truth for what URLs exist in the frontend and which components render at each one. When a page is missing or 404ing, this is the first file to check.

### 5.5 features/

**Path:** `src/features/`

This is where most product code lives. Each feature is a self-contained module with its own pages, API client, types, and state.

```
features/
├── admin/            Admin portal — applications, campers, sessions, reports
├── auth/             Login, register, password reset, MFA, email verify
├── medical/          Medical portal — records, treatments, documents
├── messaging/        Inbox — conversations, messages, compose
├── parent/           Applicant portal — applications, campers, documents
├── profile/          Profile page, settings page
├── provider/         External provider access link flow
└── superadmin/       Super admin portal — users, audit log, form templates
```

Inside each feature module the structure is consistent:
```
features/<domain>/
├── api/              API call functions (one file per domain)
├── pages/            Page-level React components
├── components/       Reusable components used only within this feature
├── types/            TypeScript interfaces for this feature's data
├── hooks/            Custom hooks for this feature
└── store/            Redux slice (if needed)
```

**When debugging a feature:** Start in `features/<domain>/pages/` for UI issues, `features/<domain>/api/` for API issues, and `features/<domain>/types/` for type mismatch issues.

### 5.6 ui/

**Path:** `src/ui/`

```
ui/
├── layout/           Portal layout shells (sidebar + header per role)
│   ├── AdminLayout.tsx
│   ├── SuperAdminLayout.tsx
│   ├── ApplicantLayout.tsx
│   └── MedicalLayout.tsx
├── components/       Shared components used across features
│   ├── StatusBadge.tsx     Colored status pill (Pending, Approved, etc.)
│   ├── Skeletons.tsx       Loading placeholder shapes
│   ├── FullPageLoader.tsx  Full-screen spinner (used during auth init)
│   └── NotificationPanel.tsx  Slide-out notification drawer
└── overlays/         Modal and drawer base components
```

### 5.7 shared/

**Path:** `src/shared/`

```
shared/
├── constants/
│   ├── roles.ts      Role names, labels, getPrimaryRole(), getDashboardRoute()
│   ├── routes.ts     Route path constants (ROUTES.LOGIN, etc.)
│   └── motion.ts     Framer Motion animation variants (pageEntry, staggerChild)
├── types/
│   ├── api.types.ts  ApiResponse<T>, PaginatedResponse<T> wrappers
│   ├── camp.types.ts Notification, Document, etc.
│   └── index.ts      Re-exports all shared types
├── hooks/            Utility hooks (useDebounce, etc.)
└── utils/
    ├── cn.ts         Tailwind class merge utility (clsx + twMerge)
    └── phiSanitizer.ts  Strips PHI fields before logging to console
```

### 5.8 store/

**Path:** `src/store/`

```
store/
├── index.ts          Configures the Redux store with all reducers
├── hooks.ts          Typed useAppSelector and useAppDispatch
└── middleware/
    └── phiProtection.ts  Middleware that blocks PHI from appearing in Redux DevTools
```

Redux is used only for authentication state (`auth` slice). No other feature uses Redux — they use local React state instead. The auth slice contains: `user`, `token`, `isAuthenticated`, `isLoading`, `mfaRequired`, `mfaVerified`.

### 5.9 i18n/

**Path:** `src/i18n/`

English (`en.json`) and Spanish (`es.json`) translation files. All user-facing strings pass through `useTranslation()` → `t('key')`. If a key is missing, the key string is rendered literally — which is a visible bug.

**When debugging literal key strings in the UI:** The key is missing from `en.json`. Add it there and to `es.json`.

### 5.10 assets/styles/

**Path:** `src/assets/styles/`

```
styles/
├── design-tokens.css   CSS custom properties (--ember-orange, --card, --border, etc.)
└── globals.css         Global resets and base styles
```

All colors in the application are referenced via CSS custom properties. Never use hardcoded hex values in components. Use `var(--token-name)` or Tailwind utilities that map to them.

---

## 6. How Backend and Frontend Talk to Each Other

### Request Flow

```
User Action (e.g., clicks "Submit Application")
    ↓
React Component calls an API function
    ↓
API function (in features/<domain>/api/*.ts)
    ↓
axios.config.ts (Axios instance)
    ↓ Adds: Authorization: Bearer <token>, X-Request-ID
HTTP Request → backend API server
    ↓
routes/api.php routes it to a Controller
    ↓
Middleware checks: auth:sanctum, role:admin...
    ↓
Controller calls: $this->authorize() → Policy check
    ↓
Controller calls Service or Model
    ↓
Database query (Eloquent)
    ↓
Response (JSON) → Axios → React
    ↓
Component updates state and re-renders
```

### API Response Shapes

All API responses follow one of two standard shapes:

**Single resource:**
```json
{
  "data": { ...resource... },
  "message": "Success"
}
```

**Paginated list:**
```json
{
  "data": [ ...items... ],
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 25,
    "total": 112,
    "from": 1,
    "to": 25
  },
  "links": { ... }
}
```

These shapes are typed in the frontend as `ApiResponse<T>` and `PaginatedResponse<T>` in `src/shared/types/api.types.ts`.

---

## 7. Data Flow Diagrams

### 7.1 Application Submission Flow

```
Applicant fills application form (ApplicationFormPage)
    │
    │  Auto-save to localStorage every 3 seconds (draft)
    │  User clicks "Save Draft" → PATCH /applications/:id (status: draft)
    │  User clicks "Submit" → PATCH /applications/:id (status: pending)
    ↓
ApplicationController::update() or store()
    ↓
ApplicationService validates and transitions status
    ↓
ApplicationStatusChangedNotification dispatched
    ↓
Email sent to applicant (if preference enabled)
Notification stored in `notifications` table
    ↓
Admin sees application in AdminApplicationsPage
    │
    │  Admin clicks "Review Application"
    ↓
ApplicationReviewPage → POST /applications/:id/review
    ↓
ApplicationController::review()
    ↓
Status updated → approved / rejected / waitlisted
    ↓
ApplicationStatusChangedNotification → applicant notified
```

### 7.2 Medical Record Access Flow

```
Medical staff opens MedicalRecordPage
    ↓
GET /medical-records/:camperId  (with audit.phi middleware)
    ↓
AuditPhiAccess middleware fires AFTER response
    ↓
AuditLog::create({ event_type: 'phi_access', action: 'view', ... })
    ↓
MedicalRecordPage renders read/edit form
    ↓
Staff updates allergy → PUT /allergies/:id
    ↓
AllergyPolicy::update() checks: isAdmin() or isMedical()
    ↓
Allergy saved with encrypted field values
    ↓
AuditLog entry written (phi_access, action: update)
```

### 7.3 Authentication Flow

```
User visits /login
    ↓
App.tsx mounts → useAuthInit() fires
    ↓
Reads token from sessionStorage
    ↓
If token exists: GET /user → restores session in Redux
If no token: dispatches hydrateAuth() → isLoading = false
    ↓
ProtectedRoute evaluates: isLoading? show loader
                           !isAuthenticated? redirect to /login
                           else: render portal
    ↓
User submits login form → POST /auth/login
    ↓
Token received → sessionStorage.setItem('auth_token', token)
    ↓
Redux: setUser + setToken + hydrateAuth
    ↓
Navigate to role-appropriate dashboard
```

### 7.4 Inbox Message Flow

```
User clicks Compose → FloatingCompose modal opens
    ↓
User fills To/Subject/Body → clicks Send
    ↓
POST /conversations (creates conversation + participant records)
    ↓
POST /conversations/:id/messages (sends the message)
    ↓
InboxService creates Message, notifies participants
    ↓
NewConversationNotification / NewMessageNotification dispatched
    ↓
Recipient opens Inbox → GET /conversations?folder=inbox
    ↓
ConversationController queries conversations where user is participant
    ↓
Message list renders with unread count, star state, timestamps
    ↓
User clicks a conversation → GET /conversations/:id/messages
    ↓
Messages marked as read (PATCH /conversations/:id/read)
```

---

## 8. User Roles and What They Can Do

| Role | Backend Slug | Portal URL | Who Uses It |
|------|-------------|------------|-------------|
| Super Administrator | `super_admin` | `/super-admin` | System owners |
| Administrator | `admin` | `/admin` | Camp staff |
| Medical Staff | `medical` | `/medical` | On-site nurses |
| Applicant | `applicant` | `/applicant` | Parents/guardians |

**Note:** The database and backend use `applicant` as the role slug. Code older than Phase 2 may still reference `parent` as the slug — this is a known legacy label.

### Role Inheritance

```
super_admin
    ├── All admin capabilities (via isAdmin() returning true for both roles)
    └── Additional: user management, role assignment, audit log

admin
    ├── All application review, camper management, reporting
    └── Cannot assign roles or access governance functions

medical
    ├── All medical record read/write for any camper
    ├── Treatment log recording (own entries only)
    └── Cannot access applications, admin functions

applicant
    ├── Own campers and applications only
    └── Cannot access any other family's data
```

### Where Role Checks Happen

**Backend — three layers:**
1. `routes/api.php` — middleware(`role:admin,super_admin`) blocks the route entirely
2. Policies — `CamperPolicy::view()` checks ownership within a role
3. Controllers — scope queries (`if ($user->isAdmin()) → all records, else → own records only`)

**Frontend — two layers:**
1. `RoleGuard` in `core/routing/index.tsx` — wraps each portal's route tree, redirects if wrong role
2. Layout components — show/hide nav items and UI controls based on user role

---

## 9. Authentication Flow

### Token Lifecycle

```
Login:    POST /auth/login → token returned → saved to sessionStorage + Redux
Request:  axios reads Redux state.auth.token (or sessionStorage fallback)
Refresh:  page reload → useAuthInit reads sessionStorage → GET /user → restores Redux
Logout:   POST /logout → sessionStorage cleared → Redux clearAuth() → redirect to /login
401:      axios interceptor fires auth:unauthorized event → same as logout
```

### sessionStorage vs localStorage

The auth token is stored in `sessionStorage` deliberately:
- It is tab-isolated (each browser tab holds its own session).
- It persists across page refreshes within the same tab.
- It is cleared when the tab is closed.
- This allows testing multiple roles in separate tabs simultaneously.

### MFA Flow

If a user has MFA enabled:
1. `POST /auth/login` returns `{ mfa_required: true }` — no token yet.
2. Login page switches to the MFA code input step.
3. User enters the 6-digit code.
4. `POST /auth/login` is called again with `{ email, password, mfa_code }`.
5. Server validates TOTP code and returns the full auth token.

---

## 10. Key Feature Flows

### Application Review (Admin)

```
AdminApplicationsPage (lists all applications with status filters)
    ↓ clicks "Review Application"
ApplicationReviewPage (shows full application details)
    ↓ admin selects "Approved" / "Rejected" / "Under Review"
    ↓ POST /applications/:id/review
ApplicationController::review()
    ↓
Application status updated in database
    ↓
ApplicationStatusChangedNotification → applicant's email + in-app
```

The review page is shared between `/admin/applications/:id` and `/super-admin/applications/:id`. The "Back" link detects which portal is active and navigates to the correct parent list.

### Report Downloads (Admin)

```
AdminReportsPage (shows summary stats from GET /reports/summary)
    ↓ clicks "Download CSV"
downloadReport('applications' | 'accepted' | 'rejected' | 'mailing-labels' | 'id-labels')
    ↓
GET /reports/:type (with Accept: text/csv)
    ↓
ReportController streams CSV response
    ↓
Frontend creates a blob URL and triggers browser download
```

### Audit Log (Super Admin)

```
AuditLogPage renders timeline of events
    ↓
GET /audit-log?page=1&per_page=25&event_type=...&from=...&to=...
    ↓
AuditLogController::index()
    ↓
Each entry is enriched with:
  - human_description: "Super Administrator viewed Camper #3's record"
  - category: "Medical" (mapped from event_type)
  - entity_label: "Camper" (from auditable_type class name)
    ↓
AuditLogPage renders entries as expandable timeline cards
    ↓ user clicks export
GET /audit-log/export?format=csv (capped at 5,000 rows)
    ↓ browser downloads file
```

### Medical Record Update

```
MedicalRecordPage loads GET /campers/:id/medical-record
    ↓ staff clicks "Add Allergy"
Modal opens → staff fills allergy form → clicks "Save"
    ↓
POST /medical-records/:id/allergies
    ↓
AllergyPolicy::create() — allows admin and medical roles
    ↓
Allergy stored with encrypted `allergen` and `reaction` fields
    ↓
AuditLog entry: phi_access / create
    ↓
MedicalRecordPage refreshes allergy list
```

---

## 11. Where to Look When Debugging

### "Page shows 404 / nothing loads at this URL"

→ Check `frontend/src/core/routing/index.tsx`. The route may not be defined, or the component import path may be wrong.

### "API call returns 401 (Unauthorized)"

→ Check `frontend/src/api/axios.config.ts` — is the token being injected?
→ Check `backend/routes/api.php` — does the route require `auth:sanctum`?
→ Run `frontend/src/features/auth/hooks/useAuthInit.ts` — is the session being restored on refresh?

### "API call returns 403 (Forbidden)"

→ Find the Policy class for the resource (e.g., `AllergyPolicy.php`).
→ Check the `update()` / `view()` / `create()` method — does the user's role pass the check?
→ Check the route middleware in `routes/api.php` — is the role restriction too narrow?

### "API call returns 422 (Validation Failed)"

→ Find the Form Request class used by the controller.
→ Check the `rules()` method — which field is failing validation and why?
→ The response `errors` object contains field-level messages.

### "Field missing or undefined in the UI"

→ Check the API Resource (`app/Http/Resources/`) — is the field included in `toArray()`?
→ Check the model — does it have the field in `$appends` or `$fillable`?
→ Check the TypeScript type (`features/<domain>/types/*.ts`) — is the field typed?

### "Notification / email not sending"

→ Check the Notification class in `app/Notifications/`.
→ Check the `via()` method — is it gated by `notification_preferences`?
→ Verify the queue worker is running (`php artisan queue:work`).

### "Status badge shows wrong color"

→ Check `frontend/src/ui/components/StatusBadge.tsx` — find the `variantConfig` entry for that status slug.

### "Page flickers or shows wrong content momentarily"

→ Look for `setItems([])` being called before a fetch — this is the stale-content anti-pattern. Remove the clear call; only clear when the new data arrives.

### "Auth state is lost on page refresh"

→ Check `frontend/src/features/auth/hooks/useAuthInit.ts` — it must read from `sessionStorage`, not `localStorage`.

### "i18n key displayed as literal string"

→ The key is missing from `frontend/src/i18n/en.json`. Add it there and to `es.json`.

---

## 12. Database Tables at a Glance

| Table | What It Stores |
|-------|---------------|
| `users` | All user accounts (all roles) |
| `roles` | Role definitions (super_admin, admin, applicant, medical) |
| `role_user` | Many-to-many: which role each user has |
| `campers` | Camper profiles (child data, linked to a user account) |
| `applications` | Camp applications linking a camper to a camp session |
| `camp_sessions` | Scheduled sessions (dates, capacity, linked to a camp) |
| `camps` | Camp definitions (name, location) |
| `medical_records` | One per camper — base medical profile |
| `allergies` | Belongs to a medical record (encrypted fields) |
| `medications` | Belongs to a medical record (encrypted fields) |
| `diagnoses` | Belongs to a medical record |
| `behavioral_profiles` | Belongs to a medical record |
| `feeding_plans` | Belongs to a medical record |
| `assistive_devices` | Belongs to a medical record |
| `activity_permissions` | Belongs to a medical record |
| `emergency_contacts` | Belongs to a medical record |
| `treatment_logs` | Clinical notes recorded by medical staff |
| `documents` | File upload records (polymorphic: camper or medical record) |
| `conversations` | Inbox conversation threads |
| `messages` | Individual messages in a conversation |
| `conversation_participants` | Per-user state: is_read, is_starred, is_important, trashed_at |
| `audit_logs` | Immutable audit trail (PHI access, auth events, admin actions) |
| `notifications` | Laravel database notifications (JSON data, read_at) |
| `notification_preferences` | Per-user email/channel preferences |
| `password_reset_tokens` | Temporary tokens for the forgot-password flow |
| `form_templates` | Supplemental PDF/Word forms uploaded by super admin |

**PHI encryption note:** The following tables store encrypted values via Laravel's `encrypted` cast: `medical_records`, `allergies`, `medications`, `treatment_logs`. The encryption key is defined in `.env` (`APP_KEY`). Rotating this key requires re-encrypting all encrypted fields.

---

## 13. Security and Compliance Layers

### HIPAA-Conscious Design

The system is designed to support HIPAA compliance for systems handling Protected Health Information (PHI). Key controls:

| Control | Implementation |
|---------|---------------|
| Access control | RBAC at route, policy, and query scope levels |
| Audit controls | `AuditPhiAccess` middleware writes immutable records to `audit_logs` |
| PHI encryption | Laravel `encrypted` cast on sensitive medical fields |
| Token-based auth | Laravel Sanctum — no session cookies |
| Token isolation | sessionStorage prevents cross-tab token sharing |
| PHI sanitization | `phiSanitizer.ts` strips PHI before console/error logging |
| Parameter sanitization | `AuditPhiAccess` redacts token, password, secret from audit metadata |

### Request Security Chain

```
Every authenticated API request:

1. auth:sanctum middleware        → validates Bearer token
2. role:* middleware              → checks role against allowed list
3. audit.phi middleware (PHI)     → logs access after response
4. Controller: $this->authorize() → calls Policy::method()
5. Policy                         → verifies ownership / role scope
6. Query scope                    → WHERE user_id = ? (non-admin)
```

### Rate Limiting and Lockout

- Login endpoint: 5 failed attempts → 15-minute lockout (tracked in DB)
- Rate limiting applied to sensitive endpoints via Laravel's throttle middleware
- Lockout state returned in API response so the frontend can display the countdown

---

## 14. Testing

### Backend Tests

**Location:** `backend/camp-burnt-gin-api/tests/`
**Run:** `cd backend/camp-burnt-gin-api && php artisan test`
**Count:** 308 passing tests

Test classes follow PHPUnit conventions. Feature tests in `tests/Feature/` make real HTTP requests through the Laravel test client. Unit tests in `tests/Unit/` test individual classes.

**To run a single test:**
```bash
php artisan test --filter TestClassName
```

### Frontend Tests

**Location:** `frontend/src/__tests__/`
**Run:** `cd frontend && pnpm test`

Frontend tests use Vitest and React Testing Library.

---

## 15. Configuration and Environment

### Backend (.env)

Key variables:

| Variable | Purpose |
|----------|---------|
| `APP_KEY` | Laravel encryption key (also encrypts PHI fields) |
| `APP_ENV` | `local` / `production` |
| `DB_*` | MySQL connection settings |
| `MAIL_*` | SMTP configuration for email notifications |
| `QUEUE_CONNECTION` | `sync` (dev) or `database`/`redis` (production) |
| `SANCTUM_STATEFUL_DOMAINS` | Domains allowed to use Sanctum tokens |

### Frontend (.env)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Full URL to the backend API (e.g., `https://api.campburntgin.org`) |
| `VITE_ENABLE_DEVTOOLS` | `true` to enable Redux DevTools (dev only) |

### Running Locally

**Backend:**
```bash
cd backend/camp-burnt-gin-api
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

**Frontend:**
```bash
cd frontend
pnpm install
pnpm dev
```

**Apply pending migrations (required after Phase 8):**
```bash
cd backend/camp-burnt-gin-api
php artisan migrate
```

This applies the Phase 8 migration that adds `is_starred`, `is_important`, and `trashed_at` to `conversation_participants`. Without it, all inbox folder queries fail with SQL column-not-found errors.

---

## Document Information

**Status:** Complete and authoritative
**Last Updated:** March 2026 (Phase 10 — Documentation)
**Covers phases:** 1 through 10
