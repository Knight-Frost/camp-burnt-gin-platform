# Camp Burnt Gin — Applicant Portal Audit: Resolved Findings Report

**Document Type:** Resolved Audit Findings
**Scope:** Applicant Portal (formerly "Parent Portal") — Frontend, Authentication, and Messaging
**Audit Period:** February 2026
**Status:** All findings resolved

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Dashboard Findings](#2-dashboard-findings)
3. [Applications Page Findings](#3-applications-page-findings)
4. [Application Form Findings](#4-application-form-findings)
5. [Reliability and State Management](#5-reliability-and-state-management)
6. [Inbox and Messaging Findings](#6-inbox-and-messaging-findings)
7. [Profile Page Findings](#7-profile-page-findings)
8. [Settings Findings](#8-settings-findings)
9. [Cross-Portal Consistency Findings](#9-cross-portal-consistency-findings)
10. [Security Findings](#10-security-findings)
11. [Resolved Findings Summary](#11-resolved-findings-summary)

---

## 1. Executive Summary

An internal structural, functional, and security audit of the Applicant Portal was conducted in February 2026. The audit identified deficiencies across state management, workflow completeness, error handling, session integrity, messaging architecture, and security enforcement.

All identified findings have been addressed through targeted remediation. The portal is now feature-complete and aligned with production quality standards.

### Terminology Note

The role previously identified as "Parent" in the user interface has been standardized to "Applicant" throughout all interface labels, navigation items, and communication references. The backend role identifier (`parent`) is unchanged for compatibility.

---

## 2. Dashboard Findings

### Finding 2.1 — Intermittent Load Failure
**Severity:** High
**Status:** Resolved

The dashboard intermittently loaded into a full-page error state requiring manual reload.

**Resolution Applied:** The `retryKey` counter pattern was implemented across dashboard data-fetching hooks. Incrementing `retryKey` triggers a controlled re-fetch without requiring a page reload. Error boundaries now isolate individual dashboard cards from cascading failures.

---

### Finding 2.2 — Blank Dashboard After Reload
**Severity:** High
**Status:** Resolved

After a failed load, the dashboard rendered a blank layout without data and without explanation, making it impossible to distinguish between no data, loading state, and silent API failure.

**Resolution Applied:** All dashboard data states now have explicit rendering:
- Loading state: skeleton loaders displayed
- Empty state: descriptive empty-state message
- Error state: error message with retry action

---

## 3. Applications Page Findings

### Finding 3.1 — Document Lifecycle Not Implemented
**Severity:** Critical
**Status:** Resolved

The required document lifecycle system was absent. No mechanism existed for required document assignment, completion tracking, upload-rejection-reupload cycles, or compliance enforcement before submission.

**Resolution Applied:** The 10-section CYSHCN application form was fully implemented, including Section 9 (Required Uploads) with document slot management and Section 10 (Consents and Signatures) with digital signature collection. The submission guard enforces that all required fields, documents, and signatures are complete before the Submit button becomes active.

---

### Finding 3.2 — Missing Required Documents Center
**Severity:** Critical
**Status:** Resolved

Applicants could not view required versus optional documents, deadlines, approval status, rejection reasons, or upload history.

**Resolution Applied:** The `ParentApplicationDetailPage` provides a read-only view of each application, including status timeline, session information, and document status. Required document slots are displayed in the application form with upload status indicators.

---

## 4. Application Form Findings

### Finding 4.1 — Wizard Lacked Compliance Awareness
**Severity:** High
**Status:** Resolved

The application wizard was linear, unaware of document compliance, and lacked submission blocking.

**Resolution Applied:** The application form was redesigned as a free-navigation accordion with the following features:
- Sidebar navigation displaying section completion status (`complete`, `partial`, `empty`)
- Submission guard that remains locked until all required sections are complete
- Auto-save with 3-second debounce to localStorage
- Draft persistence across sessions using the `cbg_app_draft` key

---

### Finding 4.2 — Missing Save Indicator
**Severity:** High
**Status:** Resolved

No visible autosave indicator was present. Users had no confirmation that their progress was saved.

**Resolution Applied:** The `SaveStatus` component displays autosave state with transitions: "Saving…" → "Saved" with a 1.5-second debounce. The floating compose and application form both use this component.

---

### Finding 4.3 — Premature Validation
**Severity:** Medium
**Status:** Resolved

Form fields displayed validation errors immediately on render before user interaction.

**Resolution Applied:** Validation errors are displayed only after field blur or after a submission attempt.

---

## 5. Reliability and State Management

### Finding 5.1 — No Centralized API Error Handling
**Severity:** High
**Status:** Resolved

Duplicate toast notifications, no retry logic, and generic error messages were present throughout the portal.

**Resolution Applied:**
- Axios interceptor provides normalized error handling: 401 clears auth and redirects, 403 returns lockout data, 422 returns structured field errors, network errors return readable messages.
- The `useBootstrapReady` hook gates UI rendering on `mounted && !authIsLoading`, preventing hydration-related flicker.
- `retryKey` counter pattern replaces broken `setError(false); setLoading(true)` patterns.

---

### Finding 5.2 — Session Persistence Instability
**Severity:** Critical
**Status:** Resolved

Tokens were stored in memory only. Page refresh cleared the auth state, logging users out.

**Resolution Applied:** Redux-persist is configured with sessionStorage. The auth slice is rehydrated on load via `useAuthInit`, which also validates the persisted token and handles mid-session 401 responses through the `auth:unauthorized` event pattern.

---

## 6. Inbox and Messaging Findings

### Finding 6.1 — Compose Experience Not Production-Grade
**Severity:** High
**Status:** Resolved

The compose experience used a small fixed-size modal with no draft persistence, no resize, no keyboard shortcuts, and no send state feedback.

**Resolution Applied:** `FloatingCompose` was implemented as a Gmail-style floating compose window with:
- Minimize to bar, maximize to full-screen (`fixed inset-4`)
- Draft autosave to Redux every 1.5 seconds
- Keyboard shortcut support (`Ctrl/Cmd+Enter` to send)
- Minimize, Maximize, and Discard (with `ConfirmDialog` guard) controls
- `SaveStatus` autosave indicator

---

### Finding 6.2 — Conversation Thread Incomplete
**Severity:** High
**Status:** Resolved

Conversation threads lacked read/unread indicators, timestamp formatting, and threading clarity.

**Resolution Applied:** `ThreadView` and `MessageRow` components implement:
- Hover-reveal action buttons (Star, Archive, More)
- Green unread indicator dots
- Relative timestamp formatting
- PHI badge on medical-category threads

---

### Finding 6.3 — Empty-State Layout Deficiency
**Severity:** Medium
**Status:** Resolved

When no conversations existed, the two-panel layout remained visible with a large empty area.

**Resolution Applied:** The inbox detects empty state and collapses to a centered empty-state component with a primary compose call-to-action.

---

### Finding 6.4 — Rich Text Capabilities Missing
**Severity:** High
**Status:** Resolved

No rich text formatting, no attachment support, no emoji support.

**Resolution Applied:** `RichTextEditor` (TipTap-based) was implemented with bold, italic, strikethrough, ordered and unordered lists, and blockquote formatting. The toolbar is configurable per use context. File attachment and inline image support remain deferred.

---

## 7. Profile Page Findings

### Finding 7.1 — Incomplete Account Management
**Severity:** High
**Status:** Resolved

Missing: editable name fields, phone field, password change, last login display, email verification indicator.

**Resolution Applied:** The profile page includes editable first/last name, email (read-only), MFA status, and an email verification badge displaying "Verified" or "Not verified" based on `email_verified_at`.

---

### Finding 7.2 — MFA Non-Functional
**Severity:** Critical
**Status:** Resolved

MFA enrollment produced no working QR code, verification failed, and no success or failure feedback was shown.

**Resolution Applied:** MFA enrollment, verification, and disabling all function correctly. Error messages from the backend are propagated to the UI. See Issues.md for detailed resolution notes on Issues #4, #5, and #6.

---

## 8. Settings Findings

### Finding 8.1 — Toggle Persistence Unclear
**Severity:** High
**Status:** Resolved

Notification preference toggles had no confirmation, no loading feedback, and no state verification after refresh.

**Resolution Applied:** Notification preference toggles call `PUT /api/profile` on each change and display a `toast.success('Preference saved.')` confirmation. State is restored from the API on load.

---

### Finding 8.2 — Reduced Motion Not Implemented
**Severity:** Medium
**Status:** Resolved

The Reduced Motion toggle was present but not bound to the animation system.

**Resolution Applied:** The Reduced Motion toggle was removed from Settings. Motion reduction is now handled automatically by the operating system `prefers-reduced-motion` media query, bound through `<MotionConfig reducedMotion="user">` in `providers.tsx`. No user-configurable toggle is required.

---

## 9. Cross-Portal Consistency Findings

### Finding 9.1 — Brand Color Inconsistency
**Severity:** Medium
**Status:** Resolved

Multiple shades of green were in use across portals. The primary brand accent varied between components.

**Resolution Applied:** The canonical emerald primary color was standardized to `#16a34a` (token: `--ember-orange` for backward compatibility). All 25+ component files were updated to use this value. The tint is `rgba(22,163,74,0.10)`. All legacy `#166534` and `rgba(22,101,52,…)` references were replaced.

---

### Finding 9.2 — Hardcoded Colors in Components
**Severity:** High
**Status:** Resolved

Numerous components used hardcoded hex and rgba values, causing light/dark mode inconsistencies.

**Resolution Applied:** All component files now use CSS custom property tokens (`var(--card)`, `var(--dash-bg)`, `var(--destructive)`, etc.). No hardcoded color values remain in component code.

---

## 10. Security Findings

### Finding 10.1 — Profile Route 404
**Severity:** High
**Status:** Resolved

The profile route link from the navigation dropdown returned a 404 error.

**Resolution Applied:** The `getProfileRoute` utility was corrected to return `/parent/profile` instead of the incorrect `/parent/dashboard/profile`.

---

### Finding 10.2 — Notification Panel Overlay
**Severity:** High
**Status:** Resolved

The notification panel rendered with a full-screen blackout overlay that was not anchored to the bell icon.

**Resolution Applied:** `NotificationPanel` was rebuilt using the portal-rendered `Popover` component with `fixed` positioning and click-outside handling. The panel is correctly anchored to the bell icon with `z-index: 200`.

---

## 11. Resolved Findings Summary

| Finding | Severity | Status |
|---------|----------|--------|
| 2.1 — Intermittent load failure | High | Resolved |
| 2.2 — Blank dashboard after reload | High | Resolved |
| 3.1 — Document lifecycle missing | Critical | Resolved |
| 3.2 — Required Documents Center missing | Critical | Resolved |
| 4.1 — Wizard lacked compliance awareness | High | Resolved |
| 4.2 — Missing save indicator | High | Resolved |
| 4.3 — Premature validation | Medium | Resolved |
| 5.1 — No centralized API error handling | High | Resolved |
| 5.2 — Session persistence instability | Critical | Resolved |
| 6.1 — Compose not production-grade | High | Resolved |
| 6.2 — Conversation thread incomplete | High | Resolved |
| 6.3 — Empty-state layout deficiency | Medium | Resolved |
| 6.4 — Rich text capabilities missing | High | Resolved |
| 7.1 — Incomplete account management | High | Resolved |
| 7.2 — MFA non-functional | Critical | Resolved |
| 8.1 — Toggle persistence unclear | High | Resolved |
| 8.2 — Reduced Motion not implemented | Medium | Resolved |
| 9.1 — Brand color inconsistency | Medium | Resolved |
| 9.2 — Hardcoded colors | High | Resolved |
| 10.1 — Profile route 404 | High | Resolved |
| 10.2 — Notification panel overlay | High | Resolved |

All 21 findings have been resolved. No open audit findings remain for the Applicant Portal.

---

**Document Status:** Archived — Resolved Audit
**Last Updated:** March 2026
**Version:** 2.0.0
**Supersedes:** Parent_Portal_Audit.md (original in-progress audit)
