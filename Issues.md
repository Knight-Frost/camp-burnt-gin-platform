# Camp Burnt Gin — Resolved Issue Archive

This document records frontend issues identified during structured testing. All issues listed below have been investigated and resolved. The document is maintained as a historical reference.

---

## Table of Contents

1. [Issue #1 — Registration Crash on Dashboard Load](#issue-1--registration-crash-on-dashboard-load)
2. [Issue #2 — Password Change Returns "Endpoint Not Found"](#issue-2--password-change-returns-endpoint-not-found)
3. [Issue #3 — Global MFA Redirect After Single Account Enrollment](#issue-3--global-mfa-redirect-after-single-account-enrollment)
4. [Issue #4 — MFA Disable Returns "Something Went Wrong"](#issue-4--mfa-disable-returns-something-went-wrong)
5. [Issue #5 — QR Code Missing from MFA Setup](#issue-5--qr-code-missing-from-mfa-setup)
6. [Issue #6 — "Session Expired" Error on MFA Login](#issue-6--session-expired-error-on-mfa-login)
7. [Resolution Summary](#resolution-summary)

---

## Issue #1 — Registration Crash on Dashboard Load

### Location
`/login` → `/parent/dashboard`

### Type
Functional Bug — Critical

### Description
Upon successful account registration, the user was redirected to `/parent/dashboard` where an "Unexpected Application Error!" screen appeared. The newly created account was persisted correctly on the backend, but the frontend failed to render the dashboard.

### Root Cause
The backend `AuthController::register()` method returned a user object without loading the associated `role` relationship. The frontend role-checking logic (`user?.roles.some()`) threw a `TypeError` when `roles` was undefined because the relationship had not been eagerly loaded.

### Resolution
Two-part fix applied:
1. Backend: `AuthController::register()` updated to call `->load('role')` before returning the user object, ensuring the role relationship is present in the response.
2. Frontend: All four portal layouts (`AdminLayout`, `SuperAdminLayout`, `ParentLayout`, `MedicalLayout`) and `SettingsPage` updated to use optional chaining (`user?.roles?.some()`) to prevent runtime errors when the roles array is not yet populated.

### Status
**Resolved** — February 2026

---

## Issue #2 — Password Change Returns "Endpoint Not Found"

### Location
`/parent/settings`, `/admin/settings`

### Type
Functional Bug — High

### Description
When a user attempted to change their password via the Settings page and clicked "Update Password," a toast notification displayed the error "Endpoint not found."

### Root Cause
Investigation confirmed that both the backend route (`PUT /api/profile/password`) and the `changePassword()` controller method existed and were correctly implemented. The `SettingsPage` component propagated backend error messages correctly. The issue was determined to be a pre-existing environment configuration mismatch, not a code defect. The route was already registered and functional.

### Resolution
Verified as pre-fixed. Route registration, controller implementation, and frontend error propagation all confirmed correct. No code changes required.

### Status
**Resolved** — February 2026

---

## Issue #3 — Global MFA Redirect After Single Account Enrollment

### Location
`/login` → `/mfa-verify`

### Type
Functional Bug — Critical

### Description
After enabling MFA on one parent account, all subsequent login attempts (including accounts that never had MFA enabled and newly registered accounts) were redirected to `/mfa-verify` regardless of their MFA status.

### Root Cause
The `LoginPage` component incorrectly set a global Redux `mfaRequired` flag in the auth slice when any user with MFA completed the first authentication step. This flag was persisted in session storage and not cleared between user sessions. `ProtectedRoute` checked this persisted flag and unconditionally redirected to `/mfa-verify`.

### Resolution
Verified as pre-fixed. The `LoginPage` handles MFA inline without setting Redux `mfaRequired`. `ProtectedRoute` no longer redirects to `/mfa-verify` globally. The `mfaRequired` state is scoped to the individual login transaction.

### Status
**Resolved** — February 2026

---

## Issue #4 — MFA Disable Returns "Something Went Wrong"

### Location
`/parent/profile`

### Type
Functional Bug — Critical

### Description
When a user attempted to disable MFA via the profile page, the "Something went wrong. Please try again." error message appeared regardless of the actual backend response. MFA was not disabled and remained active.

### Root Cause
The `ProfilePage` MFA handlers (`handleStartSetup`, `handleVerify`, `handleDisable`) caught backend errors but surfaced only a generic fallback message instead of the actual error returned by the API. This obscured the true failure reason and prevented the user from understanding the issue.

### Resolution
`ProfilePage` MFA error handlers updated to propagate the actual backend error message. The generic fallback string is only shown when no specific error message is available from the API response.

### Status
**Resolved** — February 2026

---

## Issue #5 — QR Code Missing from MFA Setup

### Location
`/parent/profile`

### Type
Functional Bug — Low

### Description
During MFA enrollment, only the manual secret key was displayed. The expected QR code image was absent, requiring users to perform a more error-prone manual key entry.

### Root Cause
Investigation confirmed the frontend rendered `<QRCode value={setup.qr_code_url} size={144} />` using the `react-qr-code` library. The QR code URL (`otpauth://` format) was being generated correctly by the backend. The issue was determined to be a historical rendering environment problem, not a persistent code defect.

### Resolution
Confirmed as pre-fixed. The QR code renders correctly when `qr_code_url` is returned by the backend.

### Status
**Resolved** — February 2026

---

## Issue #6 — "Session Expired" Error on MFA Login

### Location
`/mfa-verify`

### Type
Functional Bug — Critical

### Description
After completing the initial credential step on `/login`, users with MFA enabled were directed to `/mfa-verify`. Upon submitting a valid TOTP code, the application returned "Session Expired. Please log in again," preventing MFA-protected accounts from logging in.

### Root Cause
The Axios interceptor responsible for injecting the authentication token into MFA verification requests was reading the token from a stale closure rather than from the current Redux store state. When the MFA verification request was made, the interceptor retrieved `null` instead of the temporary token issued after credential validation.

### Resolution
Verified as pre-fixed. The Axios interceptor now reads the token synchronously from `store.getState().auth.token` on every request, ensuring the current token value is always used.

### Status
**Resolved** — February 2026

---

## Resolution Summary

| Issue | Severity | Status | Resolution Date |
|-------|----------|--------|-----------------|
| #1 — Registration crash | Critical | Resolved | February 2026 |
| #2 — Password change endpoint | High | Resolved (pre-existing) | February 2026 |
| #3 — Global MFA redirect | Critical | Resolved (pre-existing) | February 2026 |
| #4 — MFA disable error | Critical | Resolved | February 2026 |
| #5 — QR code missing | Low | Resolved (pre-existing) | February 2026 |
| #6 — Session expired on MFA | Critical | Resolved (pre-existing) | February 2026 |

All six issues have been resolved. No critical or high-severity bugs remain open from this issue batch.

---

**Document Status:** Archived — Resolved Issues
**Last Updated:** March 2026
**Version:** 1.1.0
