# Application Drafts

**Camp Burnt Gin — Server-Side Draft Persistence System**

---

## Overview

The application draft system allows applicants to save their in-progress application form and return to it later — even from a different device or browser. Draft state is stored server-side in the `application_drafts` table and synchronized to the applicant's browser session via dedicated REST endpoints.

A secondary `sessionStorage` fallback (key: `cbg_app_draft_<userId>`, e.g. `cbg_app_draft_42`) exists for fast in-page restoration, but the server draft is the authoritative source. Closing the browser tab clears sessionStorage; server drafts persist across sessions and devices.

---

## Architecture

```
ApplicationFormPage (frontend)
  │
  ├── On load
  │     GET /api/application-drafts        → list the user's draft slots
  │     GET /api/application-drafts/{id}   → fetch the selected draft's data
  │     Hydrate FormState from draft_data
  │
  ├── On every auto-save (two-tier debounce)
  │     sessionStorage['cbg_app_draft_<userId>'] → written at 3-second debounce (fast)
  │     PUT /api/application-drafts/{id}         → written at 30-second debounce (server)
  │
  └── On final Submit
        POST /applications                 → create Application record
        PATCH /applications/{id}/sign      → submit and lock
        DELETE /api/application-drafts/{id}→ clean up the draft slot
```

---

## Database Table

### `application_drafts`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | Primary key |
| `user_id` | FK → users | Owner; always an applicant |
| `label` | string | Display name for the draft (defaults to "New Application") |
| `application_id` | FK → applications (nullable) | Set once the Application row is created (added 2026-04-19); used for cleanup on finalization |
| `draft_data` | JSON (nullable) | Full serialized FormState blob; null until the first save |
| `created_at` | timestamp | |
| `updated_at` | timestamp | Used for optimistic concurrency guard |

---

## API Endpoints

These endpoints are applicant-only. Admin and medical roles cannot interact with draft slots.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/application-drafts` | List all draft slots for the authenticated user (id, label, timestamps only — no draft_data) |
| `POST` | `/api/application-drafts` | Create a new empty draft slot |
| `GET` | `/api/application-drafts/{draft}` | Retrieve a single draft including its full `draft_data` |
| `PUT` | `/api/application-drafts/{draft}` | Overwrite the draft data (auto-save endpoint) |
| `DELETE` | `/api/application-drafts/{draft}` | Permanently delete a draft (called on final submit) |

---

## Draft Lifecycle

### 1. Creating a Draft

When an applicant navigates to the new application form, a draft slot is created via `POST /api/application-drafts`:

```json
Request body:
{ "label": "New Application" }

Response:
{ "data": { "id": 42, "label": "New Application", "draft_data": null, "created_at": "...", "updated_at": "..." } }
```

### 2. Auto-Saving

As the applicant fills out the form, the frontend periodically (debounced) sends the full FormState to `PUT /api/application-drafts/{id}`:

```json
Request body:
{
  "draft_data": { ...full FormState object... },
  "last_known_updated_at": "2026-04-19T14:23:00.000Z"
}
```

The `last_known_updated_at` field enables optimistic concurrency control (see below).

### 3. Resuming a Draft

On the application start page, the frontend lists saved drafts. Selecting one fetches the full draft data and hydrates the FormState, restoring the applicant's progress.

### 4. Finalizing

On successful submission:
1. The Application record is created (`POST /applications`)
2. The draft's `application_id` is linked (`PUT /api/application-drafts/{id}` with `{ application_id: X }`)
3. The applicant signs and submits (`PATCH /applications/{id}/sign`)
4. The draft slot is deleted (`DELETE /api/application-drafts/{id}`)

---

## Constraints and Guards

### Draft Limit

Each user may have at most 10 concurrent draft slots. Creating an 11th returns `HTTP 429 Too Many Requests`. This guard exists to prevent runaway draft creation from buggy clients.

### Payload Size Cap

Each `draft_data` blob is limited to 512 KB. A fully completed application — including all narrative responses, medication lists, and device notes — is well under this limit. The cap rejects pathologically large payloads without affecting legitimate use. Exceeds-limit responses return `HTTP 422`.

### Optimistic Concurrency Guard

If the caller supplies `last_known_updated_at` on a `PUT` request and it does not match the server's current `updated_at`, the server rejects the save with `HTTP 409 Conflict`:

```json
{
  "message": "Draft was modified in another tab or session. Please reload to see the latest version.",
  "conflict": true,
  "server_updated_at": "2026-04-19T14:25:12.000Z"
}
```

This prevents the two-tab lost-update race condition where progress made in a second browser tab is silently overwritten by a save from the first tab. The frontend should refresh its local draft on receiving a 409 response.

---

## Relationship to the `is_draft` Flag

The `applications` table has its own `is_draft` boolean column. These two mechanisms are distinct:

| Mechanism | What it represents |
|---|---|
| `application_drafts` row | A pre-submission save slot containing raw form state. No Application record exists yet. |
| `applications.is_draft = true` | An Application record has been created server-side but not yet signed and submitted. |

The draft slot is always deleted on successful submission. The `is_draft` flag is cleared when the applicant signs the form. Admin users only ever see applications with `is_draft = false`.

---

## sessionStorage Fallback

The frontend mirrors the current form state to `sessionStorage` under the user-scoped key `cbg_app_draft_<userId>` (e.g. `cbg_app_draft_42`) at a 3-second debounce on every form change. This key is used as a fast-restore fallback when:

- No server draft is found for the current user
- The server is unreachable at the moment the form loads

The sessionStorage copy is cleared when the server draft is successfully loaded or when the application is submitted. It does not survive closing the browser tab — it is a same-session UX convenience to avoid a blank form on brief connectivity interruptions. The server draft is the authoritative cross-session and cross-device store.

---

## Open Issues

| ID | Description |
|---|---|
| BUG-204 | Draft count limit (10 per user) is not surfaced to the applicant before they hit it |
| BUG-205 | Draft data size cap (512 KB) has no pre-flight warning in the UI |
| BUG-206 | Draft delete on finalize is fire-and-forget; if it fails silently, orphaned draft slots accumulate |
| BUG-207 | Server draft hydration can race with the localStorage restore on slow connections, briefly showing stale state |
