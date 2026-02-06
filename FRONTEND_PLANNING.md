# CAMP BURNT GIN - FRONTEND PLANNING DOCUMENT

**Status**: Planning Phase (No Implementation)

**Backend Version**: Laravel 12 API (70+ endpoints, production-ready)

**Date**: 2026-02-05

**Purpose**: Authoritative frontend architecture specification

---

## 1. BACKEND → FRONTEND CONTRACT REVIEW

### API Domains & Integration Requirements

| Backend Domain | Endpoints | Frontend Responsibility |
|----------------|-----------|-------------------------|
| **Authentication** | `/api/auth/*` (6 endpoints) | Login form, registration, password reset, logout, session management |
| **MFA** | `/api/mfa/*` (3 endpoints) | QR code display, code input, enable/disable flows |
| **Campers** | `/api/campers/*` (5 CRUD) | Camper list, create/edit forms, detail view |
| **Applications** | `/api/applications/*` (8 endpoints) | Application wizard, draft management, signing, submission, status tracking |
| **Medical Records** | `/api/medical-records/*` (4 CRUD) | Medical form, PHI display (encrypted), view-only for providers |
| **Allergies/Meds** | `/api/allergies/*`, `/api/medications/*` (4 each) | Dynamic lists, add/remove, severity indicators |
| **Emergency Contacts** | `/api/emergency-contacts/*` (4 CRUD) | Contact management, primary designation |
| **Provider Links** | `/api/provider-links/*` (5 endpoints) | Link creation, status monitoring, revoke action |
| **Provider Access** | `/api/provider-access/{token}` (3 endpoints) | Token-based form (no auth), submission confirmation |
| **Documents** | `/api/documents/*` (4 endpoints) | File upload widget, scan status display, download links |
| **Camps/Sessions** | `/api/camps/*`, `/api/camp-sessions/*` (9 total) | Session browser, registration calendar, capacity indicators |
| **Reports** | `/api/reports/*` (4 endpoints) | Report viewer (admin), CSV export triggers |
| **Notifications** | `/api/notifications/*` (3 endpoints) | Notification bell, unread counter, mark-as-read |

### Authentication Contract

**Required Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
Accept: application/json
```

**Token Lifecycle**:
- **Acquisition**: `POST /api/auth/login` returns `token` field
- **Storage**: Client-side secure storage (see Security section)
- **Expiration**: 60 minutes (backend enforced)
- **Renewal**: No refresh token; must re-authenticate
- **Revocation**: `POST /api/logout` invalidates immediately

**Frontend Must Handle**:
- Store token after login (secure, httpOnly if web)
- Attach to all requests except public endpoints
- Detect 401 responses → redirect to login
- Show expiration warning at 55 minutes (5-min buffer)
- Clear token on logout or 401

### MFA Flow Contract

**Standard Login (No MFA)**:
```
Request: POST /api/auth/login { email, password }
Response: { user, token, mfa_required: false }
Action: Store token, redirect to dashboard
```

**MFA-Enabled Login**:
```
Request: POST /api/auth/login { email, password }
Response: { mfa_required: true, message: "MFA code required" }
Action: Show MFA code input field

Request: POST /api/auth/login { email, password, mfa_code: "123456" }
Response: { user, token, mfa_required: false }
Action: Store token, redirect to dashboard
```

**Account Lockout**:
```
Response (after 5 fails):
{
  success: false,
  message: "Account locked...",
  lockout: true,
  retry_after: 840,  // seconds
  attempts_remaining: 0
}
Action: Show countdown timer, disable login form
```

**Frontend Requirements**:
- Two-step login UI (credentials → MFA code if required)
- Lockout countdown display (retry_after seconds)
- Failed attempt counter (1-5 attempts)
- Clear error messaging

### Pagination Contract

**All Collection Endpoints Return**:
```json
{
  "data": [ {...}, {...} ],
  "meta": {
    "current_page": 1,
    "last_page": 7,
    "per_page": 15,
    "total": 100
  }
}
```

**Frontend Must**:
- Default to page 1
- Display pagination controls if `last_page > 1`
- Request next page via `?page=2` query param
- Show "X of Y results" using meta.total
- Handle empty collections gracefully

### Error Response Contract

| Status | Structure | Frontend Action |
|--------|-----------|-----------------|
| **422** | `{ message, errors: { field: ["error"] } }` | Display field-level errors below inputs |
| **401** | `{ message: "Unauthenticated" }` | Redirect to login, clear token |
| **403** | `{ message: "Unauthorized" }` | Show "Access Denied" modal, redirect |
| **404** | `{ message: "Not found" }` | Show "Resource Not Found" page |
| **429** | `{ message: "Too Many Requests" }` + `Retry-After` header | Show rate limit message with timer |
| **500** | `{ message: "Server Error" }` | Generic error page, log to monitoring |

**Critical Frontend Assumption**:
- **NEVER parse `errors` object structure**; backend guarantees field-name keys
- **ALWAYS show `message`** as primary error text
- **422 errors are field-specific**; display inline near form inputs

### Rate Limiting Contract

| Endpoint | Limit | Frontend Handling |
|----------|-------|-------------------|
| Login | 5/min per IP | Disable after 5 rapid attempts, show "slow down" |
| MFA Verify | 3/min per user | Show remaining attempts (1-3) |
| Provider Access | 2/min per IP | Token-based, unlikely to hit; log if occurs |
| File Uploads | 5/min per user | Batch uploads sequentially, not parallel |
| General API | 60/min per user | Unlikely to hit; log if occurs |

**429 Response Example**:
```
HTTP 429
Retry-After: 42  (seconds)
{ message: "Too Many Requests" }
```

**Frontend Must**:
- Respect `Retry-After` header
- Display countdown timer
- Disable submit buttons during countdown
- Log rate limit events for monitoring

### Implicit Backend Assumptions (Breaking Changes if Violated)

| Backend Assumption | Frontend Must NOT |
|--------------------|-------------------|
| Tokens expire in 60min | Store tokens indefinitely without expiry check |
| One application per camper per session | Allow duplicate submissions |
| Approved/rejected apps are final | Show edit UI after status is final |
| Provider links expire in 72h | Display links without expiry indicators |
| Scanned files block download | Download unscanned files (non-admin) |
| Ownership enforced by backend | Display other users' data based on client-side logic |
| MFA codes are 6 digits | Accept non-numeric or wrong-length codes |
| Signatures are base64 canvas data | Send signature as text or image URL |

---

## 2. USER ROLES & FRONTEND SURFACE AREA

### Role Definitions

| Role | Primary Users | System Access Level |
|------|---------------|---------------------|
| **parent** | Parents/guardians registering campers | Own campers, applications, medical data |
| **admin** | Camp staff, administrators | Full system access, review applications, reports |
| **medical** | Healthcare providers (token-based, not user accounts) | Single-camper medical form via link |

### Parent/Guardian Frontend Surface

**Navigation Structure**:
```
Dashboard
  ├─ My Campers
  │   ├─ Add New Camper
  │   └─ [Camper Name]
  │       ├─ Profile
  │       ├─ Medical Records
  │       ├─ Applications (list)
  │       ├─ Emergency Contacts
  │       └─ Documents
  ├─ Available Camp Sessions
  ├─ My Applications
  │   ├─ Drafts
  │   └─ Submitted
  ├─ Notifications
  ├─ Account Settings
  │   ├─ Profile
  │   ├─ Security (MFA)
  │   └─ Password
  └─ Logout
```

**Pages Required**:

| Page | Route | Purpose | Key Actions |
|------|-------|---------|-------------|
| Login | `/login` | Authentication | Email/password, MFA code, "Forgot Password" |
| Register | `/register` | Account creation | Name, email, password |
| Dashboard | `/dashboard` | Overview | Camper cards, application status, notifications |
| Camper List | `/campers` | Manage campers | Add new, view details |
| Camper Detail | `/campers/:id` | Single camper hub | Edit profile, view medical, applications |
| Medical Record | `/campers/:id/medical` | PHI form | Edit physician, insurance, special needs |
| Allergies/Meds | `/campers/:id/medical` | List management | Add/remove, edit severity |
| Emergency Contacts | `/campers/:id/contacts` | Contact management | Add/remove, set primary |
| Application Form | `/applications/new` | Multi-step wizard | Select camper, select session, submit |
| Application Detail | `/applications/:id` | View/edit app | Sign, submit, view status |
| Camp Sessions | `/sessions` | Browse sessions | Filter, register |
| Notifications | `/notifications` | Notification center | View, mark read |
| Account Settings | `/settings` | Profile/security | MFA setup, password change |

**UI States Per Page**:

| State | When | Display |
|-------|------|---------|
| **Empty** | No campers created | "Add your first camper" call-to-action |
| **Loading** | Fetching data | Skeleton loaders, spinner |
| **Error** | API failure | Error message + retry button |
| **Read-Only** | Application approved/rejected | Gray out form, show "Final" badge |
| **Locked** | Account lockout | Countdown timer, disabled login |
| **Expired** | Token expired | "Session expired, please log in" |

**Actions Allowed**:
- Create/edit own campers
- Create/edit own applications (if not final status)
- View own medical records
- Create medical provider links
- Upload documents
- Sign applications
- View notifications

**Actions Forbidden** (Must Not Display UI For):
- View other users' campers
- Edit other users' applications
- Review applications (admin-only)
- Delete finalized applications
- View system reports
- Manage camps/sessions

---

### Admin Frontend Surface

**Navigation Structure**:
```
Admin Dashboard
  ├─ Applications
  │   ├─ Pending Review
  │   ├─ Under Review
  │   ├─ Approved
  │   ├─ Rejected
  │   └─ Waitlisted
  ├─ Campers (All)
  ├─ Camps & Sessions
  │   ├─ Manage Camps
  │   ├─ Manage Sessions
  │   └─ Session Calendar
  ├─ Reports
  │   ├─ Applications Report
  │   ├─ Accepted Applicants
  │   ├─ Rejected Applicants
  │   ├─ Mailing Labels
  │   └─ ID Labels (with allergy flags)
  ├─ Users (future)
  ├─ Notifications
  ├─ Account Settings
  └─ Logout
```

**Pages Required** (In Addition to Parent Pages):

| Page | Route | Purpose | Key Actions |
|------|-------|---------|-------------|
| Admin Dashboard | `/admin` | System overview | Stats, pending count, alerts |
| Application Review | `/admin/applications/:id` | Review interface | Approve, reject, waitlist, add notes |
| Application List | `/admin/applications` | Filter/search apps | Filter by status, session, camper |
| All Campers | `/admin/campers` | Full camper list | Search, view medical flags |
| Camp Management | `/admin/camps` | CRUD camps | Create, edit, activate/deactivate |
| Session Management | `/admin/sessions` | CRUD sessions | Create, edit, set capacity, dates |
| Reports | `/admin/reports` | Report viewer | Generate, filter, export CSV |

**UI States Per Page**:

| State | When | Display |
|-------|------|---------|
| **Pending** | Applications awaiting review | Yellow badge, review button enabled |
| **Under Review** | Admin opened but not decided | Blue badge, in-progress indicator |
| **Final** | Approved/rejected/cancelled | Green/red/gray badge, read-only |
| **Overdue** | Registration deadline passed | Red "Overdue" flag |

**Actions Allowed**:
- All parent actions (full system access)
- Review applications (approve, reject, waitlist, add notes)
- Manage camps and sessions (CRUD)
- View all campers and applications
- Generate reports
- View all medical records (with audit logging)

**Actions Forbidden**:
- Cannot edit parent-signed applications without unsigning
- Cannot delete submitted applications (can cancel)

---

### Medical Provider Frontend Surface (Token-Based)

**Navigation Structure**:
```
Provider Form (No Navigation)
  └─ Medical Information Form
      ├─ Camper Name (read-only)
      ├─ Physician Information
      ├─ Insurance Information
      ├─ Allergies (dynamic list)
      ├─ Medications (dynamic list)
      ├─ Special Needs/Dietary
      ├─ Document Upload (optional)
      └─ Submit
```

**Single Page**:

| Page | Route | Purpose | Key Actions |
|------|-------|---------|-------------|
| Provider Form | `/provider/{token}` | Medical data submission | Fill form, upload files, submit |

**UI States**:

| State | When | Display |
|-------|------|---------|
| **Valid** | Token valid, not expired/used | Form enabled |
| **Expired** | Token past 72h | "Link expired, contact parent" |
| **Revoked** | Parent/admin revoked | "Link revoked, access denied" |
| **Submitted** | Already submitted | "Already submitted, thank you" |
| **Invalid** | Token not found | "Invalid link" |

**Actions Allowed**:
- View camper name only (no other PII)
- Submit medical record data
- Upload supporting documents

**Actions Forbidden**:
- View other campers
- View existing medical records (can overwrite)
- Access camp sessions or applications
- Create account or login

**Critical UX Requirement**:
- **No authentication UI** (email/password)
- **Token in URL only** (`/provider/{token}`)
- **Single-page experience** (no navigation)
- **Clear submission confirmation** (cannot re-access after submit)

---

## 3. APPLICATION & WORKFLOW MAPPING

### End-to-End Workflows

#### Workflow 1: New Parent Registration → First Application

```
1. ACCOUNT CREATION
   Page: /register
   Input: Name, email, password, confirmation
   API: POST /api/auth/register
   Success: Auto-login with token, redirect to /dashboard
   Error: Email already exists → show "Login instead"

2. DASHBOARD (EMPTY STATE)
   Page: /dashboard
   Display: "No campers yet. Add your first camper to register for camp!"
   Action: Click "Add Camper" button

3. CREATE CAMPER
   Page: /campers/new
   Input: First name, last name, date of birth, gender
   API: POST /api/campers
   Success: Redirect to /campers/:id
   Error: Validation errors → show inline

4. CAMPER PROFILE
   Page: /campers/:id
   Display: Profile card, "Apply for Camp" button
   Action: Click "Apply for Camp"

5. SELECT CAMP SESSION
   Page: /applications/new?camper_id=:id
   Display: Available sessions (filtered by camper age, registration open)
   Input: Select session
   Action: Click "Continue"

6. APPLICATION FORM (DRAFT)
   Page: /applications/new?camper_id=:id&session_id=:id
   Display: Multi-step form
   Auto-save: POST /api/applications with is_draft=true every 30 seconds
   Navigation: "Save Draft" or "Continue to Medical"

7. MEDICAL INFORMATION
   Page: /campers/:id/medical
   Options:
     A. Fill form yourself → /campers/:id/medical/edit
     B. Send to provider → /provider-links/new

   Option A: Self-Fill
   Input: Physician, insurance, allergies, medications, special needs
   API: POST /api/medical-records
   Success: Return to application

   Option B: Provider Link
   Input: Provider email, name, expiry (72h default)
   API: POST /api/provider-links
   Success: Email sent, show "Waiting for provider" status
   UI: Show link status (pending, accessed, submitted)

8. EMERGENCY CONTACTS
   Page: /campers/:id/contacts
   Input: Name, phone, email, relationship, primary flag, pickup authorization
   API: POST /api/emergency-contacts (2 minimum required)

9. REVIEW & SIGN
   Page: /applications/:id/review
   Display: Read-only summary of all data
   Input: Canvas signature + name
   API: POST /api/applications/:id/sign
   Success: Enable "Submit Application" button

10. SUBMIT APPLICATION
    Page: /applications/:id
    Action: Click "Submit Application"
    Confirmation: "Are you sure? You cannot edit after submission."
    API: PUT /api/applications/:id (is_draft=false, submit=true)
    Success: Email + notification sent, redirect to /applications/:id
    Display: "Submitted on [date]" badge

11. AWAIT REVIEW
    Page: /applications/:id
    Display: "Pending Review" status
    Notification: Email when admin reviews

12. ADMIN REVIEWS
    Page: /admin/applications/:id
    Action: Approve/Reject/Waitlist + notes
    API: POST /api/applications/:id/review
    Success: Email + notification to parent

13. PARENT RECEIVES DECISION
    Page: /notifications or /applications/:id
    Display: "Approved" (green) or "Rejected" (red) badge
    Action: View acceptance/rejection letter
```

**State Persistence Requirements**:

| Data | Client-Side | Server-Side | Persistence Strategy |
|------|-------------|-------------|----------------------|
| Application draft | ❌ Never | ✅ Database | Auto-save every 30s via API |
| Form input (unsaved) | ✅ Session storage | ❌ No | Clear on navigation or submit |
| Token | ✅ Secure storage | ✅ Database | Store until logout or expiry |
| User profile | ❌ No (refetch) | ✅ Database | Fetch on login, refetch on update |
| Notification read status | ❌ No | ✅ Database | API marks as read |

**Optimistic UI Safety**:

| Action | Optimistic UI | Why |
|--------|---------------|-----|
| Mark notification read | ✅ Safe | Reversible, low impact |
| Add to list | ❌ Dangerous | Data loss if fails, show spinner |
| Submit application | ❌ Dangerous | Cannot undo, show loading state |
| Sign application | ❌ Dangerous | Signature data critical, wait for 200 |
| Delete camper | ❌ Dangerous | Cannot undo, show confirmation + wait |

---

#### Workflow 2: Medical Provider Link Flow

```
1. PARENT CREATES LINK
   Page: /campers/:id/medical
   Action: Click "Send to Medical Provider"
   Input: Provider email, name, notes
   API: POST /api/provider-links
   Success: Email sent, show link status card

2. PROVIDER RECEIVES EMAIL
   Email: Contains link https://app.camp.com/provider/{token}
   Action: Click link

3. PROVIDER ACCESSES FORM
   Page: /provider/{token}
   Validation:
     - Token exists → Continue
     - Expired → Show "Link expired" message
     - Revoked → Show "Link revoked" message
     - Already used → Show "Already submitted" message
   API: GET /api/provider-access/{token}
   Success: Display camper name + empty form

4. PROVIDER SUBMITS FORM
   Page: /provider/{token}
   Input: Physician info, insurance, allergies, medications, special needs
   API: POST /api/provider-access/{token}/submit
   Success: Show "Thank you, submission received"
   UI: Mark link as "used" (is_used=true)

5. PARENT RECEIVES NOTIFICATION
   Notification: "Medical provider has submitted information for [Camper Name]"
   Page: /campers/:id/medical
   Display: Updated medical data (read-only or editable)

6. REVOKE LINK (OPTIONAL)
   Page: /campers/:id/medical
   Action: Click "Revoke Link" on active link
   Confirmation: "Are you sure? Provider will lose access."
   API: POST /api/provider-links/:id/revoke
   Success: Link status changes to "Revoked"
```

**Link Status UI Requirements**:

| Status | Display | Actions Available |
|--------|---------|-------------------|
| **Created** | "Sent on [date], expires on [date]" | Revoke, Resend |
| **Accessed** | "Opened by provider on [date]" | Revoke |
| **Submitted** | "Submitted on [date]" (green) | View data |
| **Expired** | "Expired on [date]" (gray) | Create new link |
| **Revoked** | "Revoked on [date]" (red) | Create new link |

---

#### Workflow 3: Draft Management & Recovery

```
1. START APPLICATION
   Page: /applications/new
   Input: Select camper, select session
   API: POST /api/applications (is_draft=true)
   Success: Draft created with ID

2. AUTO-SAVE (EVERY 30 SECONDS)
   Trigger: Input change + 30s debounce
   API: PUT /api/applications/:id
   Success: Show "Draft saved at [time]" indicator
   Failure: Show "Save failed, retry?" banner

3. NAVIGATE AWAY
   Trigger: User clicks back or closes tab
   Warning: "You have unsaved changes. Save draft before leaving?"
   Actions:
     - "Save Draft" → PUT /api/applications/:id → Navigate
     - "Discard" → Navigate without saving
     - "Cancel" → Stay on page

4. RESUME DRAFT
   Page: /dashboard
   Display: "You have 2 incomplete applications" card
   Action: Click "Resume"
   Redirect: /applications/:id
   Load: Draft data from API (GET /api/applications/:id)

5. CONVERT DRAFT TO SUBMISSION
   Page: /applications/:id
   Validation:
     - Medical record exists
     - Emergency contacts exist (2 min)
     - Application signed
   Action: Click "Submit Application"
   API: PUT /api/applications/:id (is_draft=false, submit=true)
   Success: Redirect to /applications/:id with "Submitted" badge
```

**Concurrent Edit Prevention**:

| Scenario | Backend Behavior | Frontend Handling |
|----------|------------------|-------------------|
| User opens draft on 2 devices | Both can edit | Show warning: "Last saved at [time] from [device/IP]" |
| User submits while provider submits medical | Race condition possible | Optimistic locking (not implemented); show conflict error |
| Admin reviews while parent edits | Parent blocked by policy | Show "Application is under review, cannot edit" |

**Failure Scenarios**:

| Failure | Detection | Recovery Path |
|---------|-----------|---------------|
| Auto-save fails | API returns error | Show banner: "Save failed, retry in 10s" |
| Timeout during submit | No response in 30s | Show "Submission in progress..." spinner, poll status |
| 401 during save | Token expired | Save to local storage, redirect to login, restore after login |
| 422 validation error | Backend rejects | Display field errors, highlight invalid fields |
| 500 server error | API failure | Show "Server error, please try again" + retry button |

---

## 4. STATE MANAGEMENT STRATEGY

### Global vs Page-Scoped State

**Global State** (Shared Across App):

| Data | Scope | Storage | Invalidation Strategy |
|------|-------|---------|----------------------|
| **Auth Token** | Entire app | Secure storage (httpOnly cookie or encrypted localStorage) | Logout, 401, 60-min expiry |
| **Current User** | Entire app | Memory (React context, Vuex, etc.) | Logout, profile update |
| **User Role** | Entire app | Derived from user object | Never (tied to user) |
| **Unread Notification Count** | Header/nav | Memory | Fetch on login, poll every 60s, update on mark-read |
| **Active Camper** | Multi-page workflows | Session storage | Clear on workflow complete |

**Page-Scoped State** (No Global Persistence):

| Data | Scope | Storage | Invalidation Strategy |
|------|-------|---------|----------------------|
| **Camper List** | /campers page | Memory | Refetch on navigation, after create/edit |
| **Application Detail** | /applications/:id | Memory | Refetch on load, after save |
| **Medical Record** | /campers/:id/medical | Memory | Refetch on load, after provider submit |
| **Form Input (unsaved)** | Form pages | Component state | Clear on save or navigate away |
| **Pagination State** | List pages | URL query params | Reset to page 1 on filter change |

### Caching Strategy

**Cache Everything by Default, Invalidate Explicitly**:

| Data Type | Cache Duration | Invalidation Trigger |
|-----------|----------------|----------------------|
| **User Profile** | Until logout | Profile update, role change |
| **Camper List** | Until stale | Create, edit, delete camper |
| **Application List** | Until stale | Submit, review, delete application |
| **Camp Sessions** | 5 minutes | Admin edits session (admins bypass cache) |
| **Medical Records** | Until stale | Self-edit, provider submission |
| **Notifications** | 1 minute | Mark as read, new notification received |
| **Documents** | Until stale | Upload, delete document |

**What Must Always Be Fresh** (No Cache):

| Data | Why |
|------|-----|
| Application status after review | Parent expects immediate update after admin decision |
| Provider link status | Time-sensitive (expiry, revocation) |
| Token validation | Security risk if cached |
| Notification count | User expects real-time updates |

### Long-Running Drafts

**Challenges**:
- User may leave draft for days/weeks
- Token may expire before draft complete
- Form fields may change (backend updates)

**Frontend Strategy**:

| Issue | Solution |
|-------|----------|
| **Token expiry during draft** | Auto-save before expiry (55-min warning), redirect to login, restore draft on re-login |
| **Stale form structure** | Fetch fresh schema on load (validate field names match) |
| **Lost connection** | Save to local storage as backup, sync on reconnect |
| **Browser crash** | Auto-save every 30s ensures max 30s loss |

**Draft Persistence Rules**:

```
1. Auto-save every 30 seconds (debounced on input change)
2. Manual save on "Save Draft" button
3. Emergency save before token expiry (at 58 minutes)
4. Local storage backup (sync to API when online)
5. Discard local backup after successful API save
6. Show "Draft saved at [time]" indicator
```

### Partial Submissions

**Definition**: Application submitted without all required data (e.g., medical provider hasn't submitted yet)

**Backend Behavior**:
- Application can be submitted if camper + session selected
- Medical record not required at submission time
- Emergency contacts required (validated on submit)

**Frontend Strategy**:

| Scenario | Validation | UX |
|----------|------------|-----|
| **Medical pending** | Warn but allow submit | "Medical information pending. You can submit and add later." |
| **No emergency contacts** | Block submit | "2 emergency contacts required before submission" |
| **Unsigned** | Block submit | "Signature required to submit application" |
| **No allergies/medications** | Allow (optional fields) | Checkbox: "No known allergies" |

**Completion Checklist UI**:

```
✓ Camper information complete
✓ Camp session selected
⚠ Medical information pending (provider link sent)
✓ Emergency contacts added (2)
✗ Application not signed
⚠ Documents missing (optional)

[Submit Application] button disabled until all required items checked
```

### Role Switching (Future-Proofing)

**Current State**: Single role per user (parent, admin, medical)

**If Multi-Role Added**:

| Challenge | Frontend Strategy |
|-----------|-------------------|
| User has admin + parent role | Show role switcher in header, refetch data on switch |
| Permissions differ per role | Maintain separate navigation/state per role |
| Cached data from wrong role | Clear all caches on role switch |

**Recommendation**: Do not implement role switching until backend supports it (currently 1:1 user:role)

### Failure Recovery Paths

**Scenario 1: Token Expiry During Form Fill**

```
1. User fills form for 65 minutes (exceeds 60-min token expiry)
2. Frontend detects 401 on auto-save at 60 minutes
3. Save form data to local storage (encrypted)
4. Redirect to login with returnUrl=/applications/:id
5. User logs in
6. Restore form data from local storage
7. Resume auto-save with new token
8. Clear local storage backup
```

**Scenario 2: Network Failure During Submit**

```
1. User clicks "Submit Application"
2. API request fails (timeout or network error)
3. Show "Submission failed, retrying..." banner
4. Retry 3 times with exponential backoff (1s, 3s, 9s)
5. If all retries fail:
   - Show "Submission failed. Check your connection."
   - Enable "Retry Submission" button
   - Do NOT navigate away (preserve form state)
6. User clicks "Retry Submission"
7. API succeeds → Navigate to /applications/:id
```

**Scenario 3: Validation Error After Submit**

```
1. User clicks "Submit Application"
2. API returns 422 with field errors
3. Frontend:
   - Scroll to first invalid field
   - Highlight invalid fields in red
   - Show error messages below fields
   - Keep form editable
   - Enable "Submit Application" button again
4. User fixes errors, clicks "Submit" again
```

---

## 5. FORM ARCHITECTURE & VALIDATION

### Validation Strategy: Client-Side Duplication

**Principle**: Duplicate all backend validation rules on frontend for instant feedback; defer complex/stateful validation to backend.

**Duplicate Frontend-Side**:

| Field Type | Backend Rule | Frontend Rule |
|------------|--------------|---------------|
| **Email** | `required, email, max:255, unique:users` | `required, email format, max 255` (skip unique check) |
| **Password** | `required, min:8, mixedCase, numbers, confirmed` | `required, min 8, uppercase, lowercase, number, match confirmation` |
| **Date of Birth** | `required, date, before:today` | `required, valid date, not future` |
| **Phone** | `required, regex:/^\d{3}-\d{3}-\d{4}$/` | `required, format XXX-XXX-XXXX` |
| **Camper Age** | `min_age, max_age (session-specific)` | ❌ Defer to backend (depends on session data) |
| **Unique Constraint** | `unique:applications,camper_id,camp_session_id` | ❌ Defer to backend (database lookup) |

**Validation Timing**:

| Event | Action |
|-------|--------|
| **On blur** | Validate single field (instant feedback) |
| **On input** | Clear error if field becomes valid |
| **On submit** | Validate entire form, show all errors |
| **On API 422** | Override with server-side errors (server is source of truth) |

### Backend Validation Rules to Defer

**Do NOT Duplicate**:
1. **Uniqueness checks** (e.g., email already exists) - Requires database lookup
2. **Foreign key existence** (e.g., camp_session_id exists) - Requires API call
3. **Business logic** (e.g., session capacity full) - Stateful, changes over time
4. **Complex cross-field validation** (e.g., age matches session age range) - Easier to validate server-side

**Handle on API 422**:
- Display server-returned error messages exactly as provided
- Do not try to predict these errors client-side

### Form Field Validation Matrix

#### Registration Form

| Field | Type | Client Validation | Backend Validation | Error Display |
|-------|------|-------------------|-------------------|---------------|
| Name | Text | Required, max 255 | Required, max 255 | Inline below field |
| Email | Email | Required, email format, max 255 | Required, email, unique | Inline below field |
| Password | Password | Required, min 8, uppercase, lowercase, number | Required, min 8, mixedCase, numbers | Inline + strength indicator |
| Confirm Password | Password | Required, matches password | Required, confirmed | Inline below field |

#### Camper Form

| Field | Type | Client Validation | Backend Validation | Error Display |
|-------|------|-------------------|-------------------|---------------|
| First Name | Text | Required, max 255 | Required, max 255 | Inline |
| Last Name | Text | Required, max 255 | Required, max 255 | Inline |
| Date of Birth | Date | Required, valid date, not future | Required, date, before:today | Inline + date picker |
| Gender | Select | Required | Required, in:male,female,other | Inline |

#### Application Form

| Field | Type | Client Validation | Backend Validation | Error Display |
|-------|------|-------------------|-------------------|---------------|
| Camper | Select | Required | Required, exists:campers, ownership | Inline |
| Session | Select | Required | Required, exists:camp_sessions, unique with camper | Inline |
| Signature Data | Canvas | Required (non-empty), base64 | Required | Modal error |
| Signature Name | Text | Required, max 255 | Required, max 255 | Inline |

#### Medical Record Form

| Field | Type | Client Validation | Backend Validation | Error Display |
|-------|------|-------------------|-------------------|---------------|
| Physician Name | Text | Max 255 | Max 255, encrypted | Inline |
| Physician Phone | Phone | Format XXX-XXX-XXXX | Nullable, encrypted | Inline + format hint |
| Insurance Provider | Text | Max 255 | Max 255, encrypted | Inline |
| Policy Number | Text | Max 255 | Max 255, encrypted | Inline |
| Special Needs | Textarea | Max 5000 | Max 5000, encrypted | Character counter |
| Dietary Restrictions | Textarea | Max 5000 | Max 5000, encrypted | Character counter |

#### Allergy Form

| Field | Type | Client Validation | Backend Validation | Error Display |
|-------|------|-------------------|-------------------|---------------|
| Allergen | Text | Required, max 255 | Required, max 255 | Inline |
| Severity | Select | Required | Required, enum | Inline |
| Reaction | Textarea | Max 1000 | Max 1000 | Character counter |
| Treatment | Textarea | Max 1000 | Max 1000 | Character counter |

### Conditional Field Logic

**Emergency Contact Form**:

| Field | Condition | Behavior |
|-------|-----------|----------|
| Phone Secondary | Always | Optional |
| Email | Always | Optional |
| Is Primary | At least 1 contact must be primary | Validate: At least one marked primary |
| Is Authorized Pickup | Always | Optional, defaults to false |

**Medical Record Form**:

| Condition | Behavior |
|-----------|----------|
| Has insurance = Yes | Show insurance provider + policy number (required) |
| Has insurance = No | Hide insurance fields |
| Has allergies = Yes | Show allergy list (required) |
| Has allergies = No | Show "No known allergies" checkbox |

### Multi-Step Form Architecture (Application Wizard)

**Steps**:

```
Step 1: Select Camper & Session
  ├─ Camper dropdown (or "Add New Camper" link)
  ├─ Session dropdown (filtered by camper age)
  └─ [Continue] button

Step 2: Medical Information
  ├─ Option A: Fill form yourself
  ├─ Option B: Send link to medical provider
  └─ [Continue] button (enabled only if medical data exists OR link sent)

Step 3: Emergency Contacts
  ├─ Contact 1 (required, must be primary)
  ├─ Contact 2 (required)
  ├─ Add More (optional)
  └─ [Continue] button

Step 4: Review & Sign
  ├─ Read-only summary
  ├─ Canvas signature + name
  └─ [Submit Application] button
```

**Navigation Rules**:

| Action | Allowed? | Behavior |
|--------|----------|----------|
| Next step | Only if current step valid | Validate, save, navigate |
| Previous step | Always | Save current, navigate back |
| Direct navigation (e.g., step 1 → step 4) | ❌ No | Force sequential flow |
| Close/navigate away | Always | Show "Save draft?" confirmation |

**Validation Per Step**:

| Step | Validation | Save Trigger |
|------|------------|--------------|
| 1 | Camper selected, session selected | On "Continue" |
| 2 | Medical record exists OR provider link sent | On "Continue" |
| 3 | 2+ contacts, at least 1 primary | On "Continue" |
| 4 | All previous steps complete, signed | On "Submit" |

### Draft Autosave Expectations

**Autosave Triggers**:
1. **Time-based**: Every 30 seconds if form dirty
2. **Event-based**: On step navigation (forward/back)
3. **Manual**: On "Save Draft" button click

**Autosave Behavior**:

| Trigger | API Call | UI Feedback |
|---------|----------|-------------|
| 30-second timer | PUT /api/applications/:id | "Draft saved at 2:34 PM" |
| Step navigation | PUT /api/applications/:id | Loading spinner during save |
| Manual save | PUT /api/applications/:id | "Draft saved" toast message |
| Save failure | Retry once | "Save failed, retrying..." banner |

**Dirty State Detection**:
- Track initial form values on load
- Compare current values to initial values
- Mark dirty if different
- Clear dirty flag on successful save

### Confirmation and Review States

**Review State (Step 4)**:

| Section | Display | Editable? |
|---------|---------|-----------|
| Camper Information | Read-only summary | ❌ (use "Back" to edit) |
| Session | Read-only | ❌ (use "Back" to edit) |
| Medical Information | Read-only summary | ❌ (use "Back" or edit medical record) |
| Emergency Contacts | Read-only list | ❌ (use "Back" to edit) |
| Signature | Canvas + name input | ✅ (can sign on review page) |

**Confirmation Modals**:

| Action | Confirmation Text | Buttons |
|--------|-------------------|---------|
| Submit application | "Are you sure? You cannot edit after submission." | Cancel, Submit |
| Delete camper | "This will delete all applications for this camper. Are you sure?" | Cancel, Delete |
| Revoke provider link | "Provider will lose access. Are you sure?" | Cancel, Revoke |
| Discard draft | "Your changes will be lost. Are you sure?" | Cancel, Discard |

---

## 6. SECURITY & COMPLIANCE SURFACE

### Token Handling (Client-Side)

**Storage Options**:

| Method | Security | Recommendation |
|--------|----------|----------------|
| **localStorage** | ⚠️ Vulnerable to XSS | ❌ Not recommended for production |
| **sessionStorage** | ⚠️ Vulnerable to XSS, clears on tab close | ❌ Not recommended |
| **httpOnly cookie** | ✅ Protected from XSS | ✅ **Recommended** (requires backend support) |
| **Encrypted localStorage** | ⚠️ Still vulnerable to XSS if key in JS | ⚠️ Acceptable if httpOnly not available |

**Recommended Strategy** (If httpOnly cookie not available):

```
1. Store token in memory (React state, Vuex, etc.)
2. Persist to encrypted localStorage for page refresh
3. Decrypt on app load, clear from localStorage
4. Clear from memory on logout or 401
5. Never log token to console or error tracking
```

**Token Expiry Handling**:

| Time | Action |
|------|--------|
| 55 minutes (5-min warning) | Show banner: "Session expires in 5 minutes. Save your work." |
| 58 minutes (2-min warning) | Force auto-save drafts, show countdown |
| 60 minutes (expiry) | Clear token, redirect to login with returnUrl |

**Token Transmission**:

```
✅ ALWAYS: Authorization: Bearer {token}
❌ NEVER: URL query params (?token=...)
❌ NEVER: POST body (unless login endpoint)
❌ NEVER: localStorage without encryption
```

### Session Expiry UX

**Expiry Warning Flow**:

```
1. At 55 minutes (T-5):
   Show banner: "Your session will expire in 5 minutes. Any unsaved work will be lost."
   Actions: [Stay Logged In] button (re-authenticates)

2. At 58 minutes (T-2):
   Force auto-save all drafts
   Show countdown: "Session expires in 2:00"

3. At 60 minutes (expiry):
   API returns 401
   Frontend:
     - Clear token from storage
     - Save current page URL (returnUrl)
     - Redirect to /login?returnUrl=/applications/123
     - Show: "Your session expired. Please log in to continue."

4. After re-login:
   - Restore token
   - Redirect to returnUrl
   - Restore draft from API (not local storage)
```

**Critical Rule**: Never trust local storage for sensitive data after expiry. Always refetch from API.

### Sensitive Data Handling

**What Must NEVER Be Stored Client-Side**:

| Data | Why | Violation Impact |
|------|-----|------------------|
| **Raw passwords** | Credential theft | HIPAA violation, account compromise |
| **MFA secrets** | 2FA bypass | Account takeover |
| **Medical records (plaintext)** | PHI exposure | HIPAA violation, regulatory fine |
| **Insurance policy numbers** | PII theft | Identity theft risk |
| **Full SSNs** (if added) | PII theft | Regulatory violation |
| **Other users' data** | Privacy violation | HIPAA violation |

**What Can Be Cached (With Caution)**:

| Data | Cache Strategy | Expiry |
|------|----------------|--------|
| **Own camper names** | Memory only | Until logout |
| **Application status** | Memory, refetch on view | Until stale |
| **Encrypted medical data (from API)** | ❌ Do not cache | Fetch fresh every time |
| **Notification count** | Memory | 1 minute |

### Audit-Sensitive Actions (Visual Indicators Required)

**Backend Automatically Audits**:
- All PHI access (medical records, allergies, medications)
- Medical provider link creation/revocation
- Application review (admin)
- Document downloads

**Frontend Must Surface**:

| Action | Visual Indicator | Purpose |
|--------|------------------|---------|
| Viewing medical record | 🔒 "Protected Health Information" banner | Remind user this is audited |
| Admin viewing all campers | 🔍 "Admin View" mode indicator | Distinguish from parent view |
| Downloading document | 📄 "Document access logged" tooltip | Inform audit trail |
| Provider link creation | 📧 "Email sent to provider on [date]" | Confirm action recorded |

**Audit Log Display (Admin Only)**:

| Field | Display |
|-------|---------|
| User | Name + email |
| Action | "Viewed medical record for [Camper Name]" |
| Timestamp | "2026-02-05 14:23:45 EST" |
| IP Address | "192.168.1.1" |

### Common Frontend Security Mistakes (MUST AVOID)

| Mistake | Impact | Prevention |
|---------|--------|------------|
| **Storing token in localStorage without encryption** | XSS vulnerability → token theft | Use httpOnly cookie or encrypt |
| **Role-based UI hiding without backend check** | Unauthorized access if user modifies DOM | Backend ALWAYS enforces, UI is hint only |
| **Displaying other users' data from cache** | Privacy violation | Refetch data with user ID filter |
| **Not validating token expiry client-side** | User submits form with expired token → 401 | Check expiry every request, warn at 55min |
| **Logging sensitive data to console** | PHI exposure in logs | Remove all console.log in production |
| **Using GET for sensitive operations** | URLs logged in server access logs | Use POST for create/update/delete |
| **Caching medical records** | PHI exposure if device stolen | Always refetch, never cache |
| **Storing signature data in local storage** | Cannot recover if lost | Always save to API immediately |

### HIPAA Compliance (Frontend Responsibilities)

| Requirement | Frontend Implementation |
|-------------|------------------------|
| **Access Control** | Verify token on every request, redirect on 401 |
| **Automatic Logoff** | Enforce 60-minute expiry, warn at 55 minutes |
| **Encryption in Transit** | Use HTTPS only, fail if HTTP |
| **Audit Logging** | Display "Access logged" indicators, support audit UI (admin) |
| **PHI Visibility** | Show 🔒 icon on medical pages, remind users of confidentiality |
| **Minimum Necessary** | Only fetch data user needs (parent sees own campers only) |

**PHI Display Rules**:

| Data | Display Rule |
|------|--------------|
| Medical records | Show 🔒 banner: "Protected Health Information - Confidential" |
| Allergies | Show severity badge (e.g., ⚠️ Life-Threatening) |
| Medications | Show 💊 icon, mark as "Prescription" if applicable |
| Insurance | Mask policy number: "**** **** 1234" (show last 4 only) |

---

## 7. PERFORMANCE & SCALABILITY PLANNING

### API Call Minimization

**Anti-Pattern: Fetch-on-Render**

```
❌ BAD:
  - Component mounts → fetch user
  - Component mounts → fetch campers
  - Component mounts → fetch applications
  - Component mounts → fetch notifications
  Result: 4 sequential API calls, 2+ seconds load time
```

**Pattern: Batch Fetching**

```
✅ GOOD:
  - On login: Fetch user + unread notification count (1 call)
  - On dashboard load: Fetch campers + application summaries (1 call with includes)
  - On detail page: Fetch single resource with relations (1 call)
  Result: 1-2 API calls, <500ms load time
```

### Prefetch vs Lazy Loading Strategy

| Data | Strategy | When |
|------|----------|------|
| **User profile** | Prefetch | On login |
| **Unread notification count** | Prefetch | On login, poll every 60s |
| **Camper list** | Prefetch | On dashboard load |
| **Application summaries** | Prefetch | On dashboard load (if ≤10 campers) |
| **Medical records** | Lazy load | On medical record page visit |
| **Documents** | Lazy load | On document list page visit |
| **Camp sessions (all)** | Lazy load | On browse sessions page |
| **Admin reports** | Lazy load | On report page visit, never cache |

**Prefetch Timing**:

```
1. Login success
   ├─ Fetch user profile (required)
   ├─ Prefetch notification count (parallel)
   └─ Redirect to dashboard

2. Dashboard mount
   ├─ Fetch campers (required)
   ├─ Prefetch application summaries (parallel, if ≤10 campers)
   └─ Render
```

### Pagination, Filtering, Searching UX

**Backend Limits**:
- 15 items per page (default)
- Max 100 items per page
- No limit parameter → returns 15

**Frontend Pagination Component**:

| Element | Behavior |
|---------|----------|
| Previous button | Disabled on page 1 |
| Page numbers | Show max 7 (1 ... 4 5 6 ... 10) |
| Next button | Disabled on last page |
| "X of Y results" | Display `meta.total` |
| Per-page selector | Allow 15, 30, 50, 100 |

**Filtering UX**:

| Filter Type | Implementation |
|-------------|----------------|
| **Status filter (applications)** | Dropdown: All, Pending, Approved, Rejected, Waitlisted |
| **Session filter (applications)** | Dropdown: All sessions + selected session |
| **Search (campers)** | Text input, debounced 500ms, searches name + email |
| **Date range (applications)** | Date picker: Submitted between [start] and [end] |

**Search Behavior**:

```
1. User types in search box
2. Debounce 500ms (wait for user to stop typing)
3. If query.length ≥ 3:
   - Send API request: GET /api/campers?search=john
   - Reset to page 1
   - Show loading spinner
4. If query.length < 3:
   - Show "Type at least 3 characters to search"
```

**Backend Search Limitations**:
- Search is case-insensitive
- Searches first_name, last_name, email only
- No fuzzy matching (exact substring)

**Frontend Must**:
- Show "No results found" if data array empty
- Preserve filters in URL query params (shareable links)
- Clear search on filter change

### High-Latency Network Handling

**Optimistic UI (Safe Cases)**:

| Action | Optimistic Update | Rollback on Failure |
|--------|-------------------|---------------------|
| Mark notification read | Immediately reduce count, gray out item | Re-fetch on error |
| Add to list | Show new item with "Saving..." indicator | Remove on error |

**Pessimistic UI (Dangerous Cases)**:

| Action | Behavior |
|--------|----------|
| Submit application | Show spinner, disable button, wait for 200 response |
| Sign application | Show "Saving signature..." modal, wait for success |
| Delete camper | Show confirmation modal + loading spinner, wait for 204 |

**Timeout Handling**:

| Timeout | Action |
|---------|--------|
| **5 seconds** | Show "This is taking longer than expected..." |
| **15 seconds** | Show "Still working..." + "Cancel" button |
| **30 seconds** | Abort request, show "Request timed out. Please try again." |

**Retry Strategy**:

| Failure Type | Retry Behavior |
|--------------|----------------|
| Network error (offline) | Retry 3 times with exponential backoff (1s, 3s, 9s) |
| 500 server error | Retry 1 time after 2 seconds |
| 422 validation error | Do not retry (user must fix) |
| 401 unauthorized | Do not retry (redirect to login) |

### Slow Network UX

**Loading States**:

| Element | Loading Indicator |
|---------|-------------------|
| Page load | Full-page skeleton loader |
| List load | Skeleton list items (3-5 rows) |
| Form submit | Spinner on button + disable |
| File upload | Progress bar (0-100%) |
| Navigation | Top-bar loading indicator |

**Progressive Rendering**:

```
1. Show page shell immediately (header, nav, footer)
2. Show skeleton loaders for content
3. Fetch data
4. Replace skeletons with real data
5. Show "loaded" state
```

---

## 8. UX GUARDRAILS (NON-NEGOTIABLE)

### Accessibility Requirements (WCAG 2.1 AA Minimum)

| Requirement | Implementation |
|-------------|----------------|
| **Keyboard Navigation** | All interactive elements focusable, logical tab order |
| **Screen Reader Support** | Semantic HTML, ARIA labels, alt text on images |
| **Color Contrast** | 4.5:1 for text, 3:1 for UI components |
| **Focus Indicators** | Visible focus ring on all focusable elements |
| **Form Labels** | All inputs have associated labels (not just placeholders) |
| **Error Identification** | Errors announced by screen readers, visually distinct |
| **Link Purpose** | Link text describes destination ("View Application #123" not "Click Here") |

**Testing Checklist**:
- [ ] Navigate entire app using keyboard only (no mouse)
- [ ] Test with screen reader (NVDA, JAWS, or VoiceOver)
- [ ] Run automated accessibility audit (axe, WAVE)
- [ ] Verify color contrast with browser dev tools

### Mobile Behavior Expectations

**Responsive Breakpoints**:

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single column, stacked navigation |
| Tablet | 640px - 1024px | Two columns where appropriate |
| Desktop | > 1024px | Multi-column, sidebar navigation |

**Mobile-Specific UX**:

| Element | Mobile Behavior |
|---------|-----------------|
| **Navigation** | Hamburger menu, slide-out drawer |
| **Tables** | Horizontal scroll or card view |
| **Forms** | Full-width inputs, larger touch targets (min 44x44px) |
| **Modals** | Full-screen on mobile |
| **Date pickers** | Native mobile date picker |
| **File upload** | Use device camera/gallery picker |
| **Signatures** | Canvas signature with finger/stylus |

**Touch Targets**:
- Minimum 44x44px for all buttons/links
- Adequate spacing between interactive elements (min 8px)
- Avoid hover-only interactions (use click/tap)

### Error Messaging Tone & Clarity

**Tone Guidelines**:
- ✅ **Helpful**: Explain what went wrong and how to fix it
- ✅ **Concise**: 1-2 sentences maximum
- ✅ **Non-technical**: Avoid jargon ("server error" → "something went wrong")
- ❌ **Avoid blame**: "You entered..." → "The email format is invalid"
- ❌ **Avoid humor**: Errors are frustrating, stay professional

**Error Message Examples**:

| Scenario | ❌ Bad | ✅ Good |
|----------|--------|---------|
| Invalid email | "Invalid input" | "Please enter a valid email address (e.g., you@example.com)" |
| Password too short | "Validation failed" | "Password must be at least 8 characters long" |
| Account locked | "Access denied" | "Your account is locked due to too many failed login attempts. Try again in 14 minutes." |
| Network error | "Error 500" | "We're having trouble connecting. Please check your internet and try again." |
| Duplicate application | "Unique constraint violation" | "You've already applied for this camp session" |

**Field-Level Errors**:
- Display below the field (not above)
- Red text + red border on field
- Icon (⚠️ or ❌) for visual indicator
- Clear error when user starts typing (immediate feedback)

### Loading and Disabled States

**Loading States**:

| Element | Loading Indicator | Duration |
|---------|-------------------|----------|
| Button | Spinner + "Loading..." text | Until API response |
| Page | Skeleton loaders | Until data fetched |
| Table | Skeleton rows | Until data fetched |
| Modal | Spinner centered | Until content ready |

**Disabled States**:

| Reason | Visual Indicator | User Feedback |
|--------|------------------|---------------|
| Form invalid | Grayed out button + "Complete required fields" tooltip | Highlight invalid fields on click |
| Loading | Spinner + disabled cursor | No click event |
| Permission denied | Hidden (don't show button at all) | N/A |
| Final status | Grayed out form + "Cannot edit approved applications" banner | No interaction allowed |

**Critical Rule**: Never show a button the user cannot click. Either:
1. Disable with clear explanation (tooltip or banner)
2. Hide entirely (if permission-based)

### Guiding Non-Technical Users

**Assumption**: Parents/guardians may not be tech-savvy, may use mobile, may be stressed.

**UX Principles**:

| Principle | Implementation |
|-----------|----------------|
| **Minimalism** | Show only what's needed for current step |
| **Progressive Disclosure** | Reveal complexity gradually (multi-step forms) |
| **Clear CTAs** | "Submit Application" not "Proceed" |
| **Visual Hierarchy** | Primary actions prominent (blue button), secondary actions subtle (text link) |
| **Contextual Help** | ? icons with tooltips, "Need help?" links |
| **Confirmation** | Confirm destructive actions ("Are you sure?") |
| **Success Feedback** | Green checkmark + "Application submitted successfully!" |

**Help System**:

| Page | Help Content |
|------|--------------|
| Application form | "What information do I need?" expandable section |
| Medical records | "Why do we need this?" explanation + privacy policy link |
| Signature | "How to sign" instructions (draw with mouse/finger) |
| Provider links | "What is a medical provider link?" explainer |

**Onboarding (First-Time Users)**:

```
1. After registration:
   Show modal: "Welcome! Let's get started."
   Steps:
     - Add your first camper
     - Browse camp sessions
     - Start an application

2. On dashboard (if empty):
   Show: "No campers yet. Add your first camper to register for camp!"
   CTA: [Add Camper] button

3. On first application:
   Show: "This will take about 10 minutes. You can save and return anytime."
   Progress bar: Step 1 of 4
```

---

## 9. FRONTEND PHASE BREAKDOWN

### Phase 1: Foundation (MVP Core)

**Goal**: Authentication + basic camper/application flow (no admin, no provider links)

**Included**:

| Feature | Pages | APIs | Components |
|---------|-------|------|------------|
| **Authentication** | Login, Register, Forgot Password, Reset Password | `/api/auth/*` | LoginForm, RegisterForm, PasswordResetForm |
| **User Profile** | Profile, Settings | `/api/user` | ProfileCard, PasswordChangeForm |
| **Camper Management** | List, Create, Edit, View | `/api/campers/*` | CamperCard, CamperForm |
| **Basic Application** | Create (draft), View, Edit | `/api/applications` (CRUD) | ApplicationForm (single-page, not wizard) |
| **Notifications** | List, Mark Read | `/api/notifications/*` | NotificationBell, NotificationList |

**Explicitly Excluded**:
- ❌ MFA (Phase 2)
- ❌ Multi-step application wizard (Phase 2)
- ❌ Medical provider links (Phase 2)
- ❌ Admin dashboard (Phase 3)
- ❌ Signature canvas (Phase 2)
- ❌ File uploads (Phase 2)

**Validation Before Moving On**:
- [ ] User can register, login, logout
- [ ] User can create camper
- [ ] User can create application (draft)
- [ ] User can view notifications
- [ ] All forms display validation errors correctly
- [ ] Mobile responsive (basic layout)

**Estimated Scope**: 20-25 components, 8-10 pages, 15 API integrations

---

### Phase 2: Core Flows (Production-Ready Parent Experience)

**Goal**: Complete parent workflow including medical, signatures, multi-step forms, MFA

**Included**:

| Feature | Pages | APIs | Components |
|---------|-------|------|------------|
| **MFA** | MFA Setup, MFA Verify | `/api/mfa/*` | QRCodeDisplay, MFACodeInput |
| **Multi-Step Application** | Application Wizard (4 steps) | `/api/applications/*` | ApplicationWizard, StepIndicator, ReviewStep |
| **Medical Records** | Medical Form, Allergy List, Medication List | `/api/medical-records/*`, `/api/allergies/*`, `/api/medications/*` | MedicalRecordForm, AllergyCard, MedicationCard |
| **Emergency Contacts** | Contact List, Add/Edit | `/api/emergency-contacts/*` | EmergencyContactCard, ContactForm |
| **Signatures** | Signature Canvas, Sign Modal | `/api/applications/:id/sign` | SignatureCanvas, SignatureModal |
| **Documents** | Upload, List, Download | `/api/documents/*` | FileUploadWidget, DocumentList |
| **Provider Links** | Create Link, View Status, Revoke | `/api/provider-links/*` | ProviderLinkCard, LinkStatusBadge |
| **Provider Form** | Token-Based Medical Submission | `/api/provider-access/{token}` | ProviderFormPage (standalone) |
| **Camp Sessions** | Browse, Filter | `/api/camp-sessions/*` | SessionCard, SessionFilter |

**Explicitly Excluded**:
- ❌ Admin dashboard (Phase 3)
- ❌ Reports (Phase 3)
- ❌ Application review (Phase 3)
- ❌ Camp/session management (Phase 3)

**Validation Before Moving On**:
- [ ] User can complete full application workflow (create camper → submit app → sign → receive decision)
- [ ] MFA setup/verify/disable works
- [ ] Provider link creation → email sent → provider submits → parent receives notification
- [ ] Signature canvas works on desktop and mobile
- [ ] File upload + download works
- [ ] Draft auto-save works (30s interval)
- [ ] Token expiry warning displays at 55 minutes

**Estimated Scope**: 35-40 additional components, 10-12 pages, 25 API integrations

---

### Phase 3: Role-Specific Dashboards (Admin + Advanced Features)

**Goal**: Admin review workflow, reports, camp management

**Included**:

| Feature | Pages | APIs | Components |
|---------|-------|------|------------|
| **Admin Dashboard** | Overview, Stats | `/api/applications` (filtered) | AdminDashboard, StatCard |
| **Application Review** | Review Page, Approve/Reject | `/api/applications/:id/review` | ReviewForm, StatusChangeModal |
| **User Management** | User List, View (future) | N/A (not implemented backend) | N/A |
| **Camp Management** | Camp List, Create, Edit | `/api/camps/*` | CampCard, CampForm |
| **Session Management** | Session List, Create, Edit | `/api/camp-sessions/*` | SessionCard, SessionForm |
| **Reports** | Applications, Accepted, Rejected, Labels | `/api/reports/*` | ReportViewer, ReportFilters, CSVExport |

**Explicitly Excluded**:
- ❌ Advanced user management (create/edit users)
- ❌ Audit log viewer (Phase 4)
- ❌ System settings (Phase 4)

**Validation Before Moving On**:
- [ ] Admin can review applications (approve, reject, waitlist)
- [ ] Admin can manage camps and sessions
- [ ] Admin can generate reports
- [ ] Role-based navigation works (admin sees admin menu, parent does not)
- [ ] Admin cannot edit parent-signed applications without unsigning

**Estimated Scope**: 20-25 additional components, 8-10 pages, 15 API integrations

---

### Phase 4: Edge Cases, Polish, Hardening

**Goal**: Production-ready with full error handling, accessibility, performance optimization

**Included**:

| Feature | Purpose |
|---------|---------|
| **Comprehensive Error Handling** | 401, 403, 404, 422, 429, 500 pages, retry logic |
| **Accessibility Audit** | WCAG 2.1 AA compliance, screen reader testing |
| **Performance Optimization** | Code splitting, lazy loading, image optimization, caching |
| **Offline Support** | Service worker, offline page, local storage fallback |
| **Analytics** | Event tracking (application submit, errors, page views) |
| **Audit Log Viewer (Admin)** | View PHI access logs | `/api/audit-logs` (if implemented) | AuditLogTable |
| **Advanced Notifications** | Real-time notifications (WebSockets or polling) | N/A | NotificationToast |
| **Help System** | Contextual help, FAQ page, support contact | N/A | HelpModal, FAQPage |
| **Empty States** | Friendly "No data" messages with CTAs | N/A | EmptyState component |
| **Loading Skeletons** | Skeleton loaders for all major pages | N/A | SkeletonLoader component |

**Validation Before Moving On**:
- [ ] All error scenarios tested (simulate 401, 403, 500, network failure)
- [ ] Accessibility score > 90 (Lighthouse)
- [ ] Performance score > 80 (Lighthouse)
- [ ] Works offline (shows offline page, restores on reconnect)
- [ ] All forms have empty states
- [ ] All lists have skeleton loaders
- [ ] Mobile experience tested on real devices
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)

**Estimated Scope**: 15-20 additional components, polish across all pages, 5-10 API integrations

---

### Phase Summary

| Phase | Timeline | Team Size | Key Deliverable |
|-------|----------|-----------|-----------------|
| **Phase 1** | 4-6 weeks | 2-3 devs | Basic auth + camper/application CRUD |
| **Phase 2** | 6-8 weeks | 3-4 devs | Full parent workflow (MFA, medical, signatures, provider links) |
| **Phase 3** | 4-6 weeks | 2-3 devs | Admin dashboard + reports |
| **Phase 4** | 3-4 weeks | 2-3 devs | Production hardening |
| **Total** | 17-24 weeks | - | Full production-ready system |

**Critical Dependencies**:
- Phase 2 depends on Phase 1 (cannot build wizard without basic forms)
- Phase 3 depends on Phase 2 (admin reviews applications created by parents)
- Phase 4 can start in parallel with Phase 3 (polish work)

---

## 10. RISK & GAP ANALYSIS

### Easy to Misuse from Frontend

| Backend Feature | Easy to Misuse | How to Misuse | Prevention |
|----------------|----------------|---------------|------------|
| **Token expiry (60 min)** | Yes | Assume token valid indefinitely → 401 on critical operation | Check expiry client-side, warn at 55 min |
| **Draft auto-save** | Yes | Assume save succeeded without checking response → data loss | Always check API response, show "Save failed" banner |
| **Ownership enforcement** | Yes | Cache other users' data, assume backend doesn't validate | Always refetch with user filter, trust backend |
| **Unique constraints** | Yes | Allow duplicate submissions client-side → 422 error | Disable submit button after first submit |
| **Status finality** | Yes | Show edit UI for approved applications → 403 error | Check `isEditable()` before rendering edit button |
| **Provider link expiry** | Yes | Show expired links as valid → user clicks, gets error | Display expiry date, gray out expired links |
| **File upload security** | Yes | Upload file, assume safe, allow download before scan | Check `scan_passed` flag, block unscanned files |

### Missing Endpoints or Unclear Contracts

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **No token refresh endpoint** | User must re-login every 60 minutes | Add `/api/auth/refresh` or extend token expiry to 4 hours |
| **No batch upload for documents** | Must upload files one-by-one (rate limited to 5/min) | Add `/api/documents/batch` endpoint (future) |
| **No notification preferences** | User receives all emails, cannot opt out | Add notification settings (future) |
| **No audit log API** | Admin cannot view PHI access logs | Add `/api/audit-logs` endpoint (future) |
| **No user management API** | Admin cannot create/edit users | Add `/api/users` CRUD endpoints (future) |
| **No session capacity check on apply** | User submits application for full session → waitlisted | Add capacity indicator to session list |
| **No draft conflict resolution** | User edits draft on 2 devices → last write wins | Add optimistic locking or "last modified" indicator |

### Frontend Decisions That Could Force Backend Rewrites

| Frontend Decision | Backend Impact | Mitigation |
|-------------------|----------------|------------|
| **Store token in localStorage (unencrypted)** | XSS vulnerability → security breach | Use httpOnly cookies (requires backend support) or encrypt localStorage |
| **Cache medical records client-side** | PHI exposure → HIPAA violation | Never cache PHI, always refetch |
| **Optimistic UI for application submit** | User assumes submitted, but backend failed → lost submission | Use pessimistic UI (wait for 200 response) |
| **Assume role can change during session** | Backend enforces single role per user → UI breaks | Do not implement role switcher unless backend supports |
| **Custom date formats (non-ISO)** | Backend expects ISO 8601, frontend sends MM/DD/YYYY → 422 error | Always send dates in ISO format (YYYY-MM-DD) |
| **Client-side pagination (load all, paginate in JS)** | Works for small datasets, breaks at scale → performance issue | Always use server-side pagination |
| **Client-side search (filter in JS)** | Works for small datasets, breaks at scale → missing results | Always use server-side search |

### Critical Assumptions (Test Extensively)

| Assumption | If Wrong | Test Scenario |
|------------|----------|---------------|
| Backend returns 422 for validation errors | Frontend doesn't handle → generic error shown | Submit form with invalid data, verify field errors display |
| Token expiry is exactly 60 minutes | Frontend warns at 55 min, token expires at 59 min → early logout | Test token expiry timing in staging |
| Provider links expire at exactly 72 hours | Frontend shows "1 day left", link expires in 1 hour → broken link | Test link expiry edge cases |
| Backend enforces ownership on every request | Frontend caches other users' data → exposed | Test with multiple accounts, verify cannot access others' data |
| Signature data is base64 canvas | Frontend sends image URL → backend rejects | Test signature submission with various formats |
| MFA codes are 6 numeric digits | Frontend accepts 5-digit codes → backend rejects | Test MFA with invalid code lengths |

### Recommendations for Risk Mitigation

1. **Contract Testing**: Use contract tests (Pact, Postman) to verify API contracts don't break
2. **Error Scenario Testing**: Test all error responses (401, 403, 422, 500) in staging
3. **Token Expiry Testing**: Simulate token expiry at various points in workflow
4. **Mobile Testing**: Test on real iOS/Android devices, not just emulators
5. **Accessibility Testing**: Run automated + manual accessibility audits
6. **Performance Testing**: Load test with 100+ campers, 500+ applications
7. **Security Testing**: Run OWASP ZAP or similar security scanner
8. **Cross-Browser Testing**: Test on Chrome, Firefox, Safari, Edge
9. **Offline Testing**: Simulate network failure, slow network, intermittent connectivity
10. **Role-Based Testing**: Test with each role (parent, admin, medical provider) to verify permissions

---

## FINAL RECOMMENDATIONS

### Non-Negotiable Frontend Requirements

1. **Security First**
   - httpOnly cookies for token storage (or encrypted localStorage as fallback)
   - Never cache PHI client-side
   - Token expiry warning at 55 minutes
   - Clear all data on logout or 401

2. **User Experience**
   - Mobile-first design (assume users on phones)
   - Accessibility WCAG 2.1 AA minimum
   - Clear error messages (no jargon)
   - Loading states for all async operations
   - Confirmation for destructive actions

3. **Data Integrity**
   - Server is source of truth (refetch, don't cache critical data)
   - Pessimistic UI for critical operations (wait for 200)
   - Draft auto-save every 30 seconds
   - Form validation before submission

4. **Performance**
   - Server-side pagination (never load all, paginate in JS)
   - Lazy load non-critical data
   - Skeleton loaders (never show blank page)
   - Optimize images (WebP, lazy loading)

5. **HIPAA Compliance**
   - Display "Protected Health Information" banner on medical pages
   - Log all PHI access (backend handles, but UI should indicate)
   - Auto-logout at 60 minutes (no exceptions)
   - Encrypt data in transit (HTTPS only)

### Moving Forward

1. **Technology Stack Decision**: Choose framework (React, Vue, Svelte, etc.), state management (Redux, Vuex, Context), UI library (Material-UI, Chakra, custom)
2. **Design System**: Create component library, design tokens, style guide
3. **API Client**: Create typed API client (Axios, Fetch) with error handling, retries, token management
4. **Project Setup**: Scaffolding, linting, testing framework, CI/CD
5. **Phase 1 Kick-off**: Start with authentication + basic camper/application CRUD

---

**This document is the authoritative frontend planning specification for the Camp Burnt Gin project. All frontend development should align with the contracts, workflows, security requirements, and UX guardrails defined above.**
