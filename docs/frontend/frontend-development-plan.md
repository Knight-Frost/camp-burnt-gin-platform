# Frontend Development Plan
## Camp Burnt Gin Application Software

**Document Type:** Authoritative Development Execution Plan
**Project:** Camp Burnt Gin Application Software — Frontend
**Backend API:** Laravel 12.0 REST API (PHP 8.2+)
**Version:** 1.0.0
**Date:** February 13, 2026
**Status:** Active — Authoritative
**Architecture Reference:** Frontend Architecture Plan v1.0.0

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Development Principles](#2-development-principles)
3. [Pre-Development Checklist](#3-pre-development-checklist)
4. [Phase Roadmap](#4-phase-roadmap)
5. [Phase 1 — Foundation & Infrastructure](#5-phase-1--foundation--infrastructure)
6. [Phase 2 — Design System & Visual Language](#6-phase-2--design-system--visual-language)
7. [Phase 3 — Authentication & Session](#7-phase-3--authentication--session)
8. [Phase 4 — Core Feature Modules](#8-phase-4--core-feature-modules)
9. [Phase 5 — HIPAA & Security Hardening](#9-phase-5--hipaa--security-hardening)
10. [Phase 6 — Settings System](#10-phase-6--settings-system)
11. [Phase 7 — Motion & Interaction Design](#11-phase-7--motion--interaction-design)
12. [Phase 8 — Accessibility & Compliance](#12-phase-8--accessibility--compliance)
13. [Phase 9 — Performance Optimization](#13-phase-9--performance-optimization)
14. [Phase 10 — Testing](#14-phase-10--testing)
15. [Phase 11 — Observability & Error Handling](#15-phase-11--observability--error-handling)
16. [Phase 12 — Pre-Deployment](#16-phase-12--pre-deployment)
17. [Phase 13 — Deployment](#17-phase-13--deployment)
18. [Phase 14 — Post-Deployment](#18-phase-14--post-deployment)
19. [Development Standards](#19-development-standards)
20. [Definition of Done](#20-definition-of-done)
21. [Risk Register](#21-risk-register)

---

## 1. Project Overview

### 1.1 Scope Summary

This plan governs the full frontend development lifecycle of the Camp Burnt Gin Application Software — a HIPAA-regulated, role-based camp registration and management platform. The frontend is a production-grade React 18 SPA that integrates with a fully complete Laravel 12.0 REST API (286 automated tests, 114 requirements, 100% complete).

### 1.2 Target Outcomes

By the end of this plan, the frontend will:
- Deliver a state-of-the-art, visually distinctive interface that sets a new standard for camp management software
- Be fully HIPAA-compliant with zero Protected Health Information in any persistence layer
- Support all three user roles (Administrator, Parent/Guardian, Medical Provider) with complete feature parity to the backend API
- Achieve a Lighthouse performance score above 90 on all pages
- Pass WCAG 2.1 AA accessibility compliance on all user-facing routes
- Include a comprehensive, secure Settings system giving users meaningful control
- Incorporate production-grade glassmorphism, motion, and interaction design
- Be covered by a test suite with 80%+ unit/integration coverage and 100% E2E coverage of critical flows

### 1.3 Backend Integration Contract

The backend API is production-ready. The frontend must integrate with:

| Domain | Endpoints | Critical Requirements |
|--------|-----------|----------------------|
| Authentication | Register, Login, Logout, Password Reset | MFA TOTP, 60-min session, account lockout |
| MFA | Setup, Verify, Disable | QR code display, TOTP entry flow |
| User Profile | Get, Update, Prefill | Role-aware rendering |
| Camps & Sessions | CRUD (admin), Read (all) | Session availability, capacity |
| Campers | CRUD (scoped by role) | Child participant profiles, PHI boundary |
| Applications | CRUD, Sign, Review | 6-state workflow, digital signature, draft auto-save |
| Medical Records | CRUD (scoped by role) | PHI designation, medical provider access |
| Allergies & Medications | CRUD (scoped) | Medical provider create/update, no delete |
| Emergency Contacts | CRUD (scoped) | Medical provider read-only |
| Documents | Upload, Download, Delete | 10 MB limit, security scan status, drag-and-drop |
| Medical Provider Links | Create, Validate, Submit, Revoke | 72-hour expiry, single-use, unauthenticated access |
| Reports | 5 report types (admin only) | PDF, CSV, Excel export formats |
| Notifications | List, Mark Read | Polling every 30s, type-based rendering |
| Inbox | Conversations, Messages, Attachments | Immutable messages, read receipts, attachment upload |

---

## 2. Development Principles

### 2.1 Standards That Are Never Negotiated

- HIPAA PHI never leaves application memory. No exceptions.
- TypeScript strict mode is always on. `any` types are a build failure.
- Every interactive element is keyboard accessible before a feature is merged.
- No feature ships without passing its defined test coverage threshold.
- All animations respect `prefers-reduced-motion`.
- Production builds have no `console.log` statements.
- No inline `style` attributes. All styling is via Tailwind classes or CSS custom properties.

### 2.2 Quality Standards

- **Surpass, never match.** The default standard for visual design, code quality, and UX is "best-in-class," not "sufficient."
- **Structure over speed.** A well-structured component that takes a day longer is preferable to a fast component that will be refactored in a week.
- **User dignity.** Forms and interfaces must never make users feel lost, confused, or unsafe. Empty states, error messages, and loading indicators are first-class features.
- **Security is a feature.** Every PHI interaction is designed to communicate care and professionalism to the user.

---

## 3. Pre-Development Checklist

Before any code is written:

- [ ] Confirm backend API is accessible at development URL
- [ ] Confirm all 286 backend tests pass against the development database
- [ ] Obtain Figma access and export all design tokens
- [ ] Set up local environment variables (`.env.local`)
- [ ] Configure ESLint and Prettier with project rules
- [ ] Set up Husky pre-commit hooks (lint, type-check, test)
- [ ] Configure Sentry project with PHI-masking configuration
- [ ] Set up CI/CD pipeline skeleton (GitHub Actions or equivalent)
- [ ] Confirm font licenses and load strategy (self-hosted or Google Fonts CDN)
- [ ] Document Axios base URL, CORS configuration, and CSRF cookie endpoint with backend team
- [ ] Confirm Laravel Sanctum CSRF cookie endpoint (`/sanctum/csrf-cookie`)
- [ ] Review all 18 API versioning deprecation rules with backend team
- [ ] Confirm email delivery works for MFA setup and password reset in development

---

## 4. Phase Roadmap

```
PHASE 1:  Foundation & Infrastructure         ─── 1 week
PHASE 2:  Design System & Visual Language     ─── 1.5 weeks
PHASE 3:  Authentication & Session            ─── 1 week
PHASE 4:  Core Feature Modules                ─── 4 weeks
PHASE 5:  HIPAA & Security Hardening          ─── 0.5 weeks
PHASE 6:  Settings System                     ─── 0.5 weeks
PHASE 7:  Motion & Interaction Design         ─── 0.5 weeks
PHASE 8:  Accessibility & Compliance          ─── 0.5 weeks
PHASE 9:  Performance Optimization            ─── 0.5 weeks
PHASE 10: Testing                             ─── 1.5 weeks
PHASE 11: Observability & Error Handling      ─── 0.5 weeks
PHASE 12: Pre-Deployment                      ─── 0.5 weeks
PHASE 13: Deployment                          ─── 0.5 weeks
PHASE 14: Post-Deployment                     ─── Ongoing

Total estimate: ~13 weeks (development team size-dependent)
```

### Phase Dependency Map

```
Phase 1 (Foundation)
    │
    ▼
Phase 2 (Design System) ──────────────────────────────┐
    │                                                  │
    ▼                                                  │
Phase 3 (Authentication)                               │
    │                                                  ▼
    ▼                                         Phase 7 (Motion)
Phase 4 (Features) ──── Phase 5 (Security)
    │                         │
    ▼                         ▼
Phase 6 (Settings)     Phase 8 (Accessibility)
    │                         │
    └─────────┬───────────────┘
              ▼
         Phase 9 (Performance)
              │
              ▼
         Phase 10 (Testing)
              │
              ▼
         Phase 11 (Observability)
              │
              ▼
         Phase 12 (Pre-Deployment)
              │
              ▼
         Phase 13 (Deployment)
              │
              ▼
         Phase 14 (Post-Deployment)
```

---

## 5. Phase 1 — Foundation & Infrastructure

**Goal:** A running application with correct project structure, tooling, environment configuration, and a working Axios instance connected to the backend.

### 5.1 Project Scaffolding

- [ ] Initialize Vite project (`react-ts` template)
- [ ] Configure `tsconfig.json` with strict mode and path aliases (`@/` → `src/`)
- [ ] Install all production dependencies from Architecture Plan Section 2.1
- [ ] Install all dev dependencies (Vitest, Playwright, ESLint plugins)
- [ ] Create directory structure per Architecture Plan Section 3.1 (no files yet, just folder skeleton)
- [ ] Configure Tailwind CSS 4.x with custom theme extension
- [ ] Create `assets/styles/globals.css` with all CSS custom properties (tokens) from Architecture Plan Section 8.3

### 5.2 Tooling Configuration

- [ ] Configure ESLint with: `@typescript-eslint`, `jsx-a11y`, `react-hooks`, `import`, `no-eval` custom rule
- [ ] Configure Prettier with consistent project formatting rules
- [ ] Set up Husky + lint-staged: run ESLint, TypeScript check, and tests on changed files before commit
- [ ] Configure Vitest with jsdom environment and `@testing-library/jest-dom` setup
- [ ] Configure Playwright with three browser targets: Chromium, Firefox, WebKit
- [ ] Set up path alias resolution in both Vite and Vitest configs
- [ ] Configure environment variable types (`vite-env.d.ts`)

### 5.3 Environment Configuration

- [ ] Create `.env.example` documenting all required environment variables
- [ ] Create `.env.local` with development values (not committed)
- [ ] Confirm `VITE_API_BASE_URL` resolves correctly to backend development server
- [ ] Confirm `VITE_ENABLE_DEVTOOLS=true` for development
- [ ] Confirm `VITE_ENVIRONMENT=development`

### 5.4 Redux Store Setup

- [ ] Install `@reduxjs/toolkit` and `react-redux`
- [ ] Create `store/index.ts` with typed store configuration
- [ ] Create `store/hooks.ts` with `useAppSelector` and `useAppDispatch`
- [ ] Create `store/rootReducer.ts` (empty slices as placeholders for now)
- [ ] Create `store/middleware/phiProtection.ts` — middleware that throws in development if a PHI field name appears in a persist action
- [ ] Create `store/middleware/correlationId.ts` — middleware that attaches X-Request-ID to outgoing actions for tracing
- [ ] Write unit tests for PHI protection middleware

### 5.5 Axios Instance & Interceptors

- [ ] Create `api/axios.config.ts` — single configured Axios instance
- [ ] Implement request interceptor: inject `Authorization: Bearer {token}` from Redux store
- [ ] Implement request interceptor: attach `X-Request-ID` correlation header from `utils/correlationId.ts`
- [ ] Implement response interceptor: 401 handling (clear auth + redirect)
- [ ] Implement response interceptor: 403 + lockout handling (countdown timer trigger)
- [ ] Implement response interceptor: 429 handling (exponential backoff + retry-after countdown)
- [ ] Implement response interceptor: deprecation header detection (dev console warning)
- [ ] Create `api/versioning.ts` — `getVersionedUrl()` utility
- [ ] Create `utils/correlationId.ts` — UUID v4 generator for X-Request-ID
- [ ] Write unit tests for each interceptor behavior

### 5.6 Router Setup

- [ ] Create `router/index.tsx` with `createBrowserRouter`
- [ ] Create `router/routes.ts` with typed route path constants
- [ ] Create `router/ProtectedRoute.tsx` — auth + MFA + role guard (no UI yet, just redirect logic)
- [ ] Create `router/PublicRoute.tsx` — redirects authenticated users to `/dashboard`
- [ ] Add placeholder `div` for each route with the route name displayed (temporary, replaced in later phases)
- [ ] Confirm all routes resolve without 404 in development

### 5.7 Phase 1 Validation

- [ ] `npm run build` completes without errors or TypeScript warnings
- [ ] `npm run dev` starts and all placeholder routes are reachable
- [ ] ESLint reports zero errors
- [ ] All Phase 1 unit tests pass
- [ ] Redux DevTools show the empty store with all slices listed

---

## 6. Phase 2 — Design System & Visual Language

**Goal:** A complete, documented component library that serves as the single source of truth for all UI elements. Every component is built to the standard described in the Architecture Plan before any feature work begins.

### 6.1 Typography & Font Loading

- [ ] Add `Syne` (display, 700–800), `Plus Jakarta Sans` (body, 400–600), and `JetBrains Mono` (mono, 400) to the project
- [ ] Configure either self-hosting or Google Fonts CDN with `font-display: swap`
- [ ] Set CSS custom properties `--font-display`, `--font-body`, `--font-mono` in `globals.css`
- [ ] Define the full type scale as CSS custom properties (`--text-xs` through `--text-5xl`)
- [ ] Verify rendering at all sizes on both Retina and standard displays

### 6.2 Color Token System

- [ ] Implement all brand, semantic, glass, and shadow CSS custom properties from Architecture Plan Section 8.3
- [ ] Implement dark mode overrides under `[data-theme="dark"]` selector
- [ ] Map all tokens to Tailwind `theme.extend` via the Tailwind CSS v4 configuration
- [ ] Verify contrast ratios meet 4.5:1 for all text/background pairings (use a contrast checker)

### 6.3 Glassmorphism Components

- [ ] Create `components/glass/GlassCard.tsx` — standard content card with blur, border, shadow
- [ ] Create `components/glass/GlassPanel.tsx` — wider panel with configurable blur intensity
- [ ] Create `components/glass/GlassModal.tsx` — modal surface with heavy blur backdrop
- [ ] Implement hover state transitions on GlassCard (translateY, shadow intensification)
- [ ] Test glass rendering on solid background (should work) and gradient background (optimal)
- [ ] Ensure glass components degrade gracefully if `backdrop-filter` is unsupported
- [ ] Write Vitest component tests verifying prop-driven rendering

### 6.4 Atom Components

- [ ] `atoms/Button.tsx` — variants: primary, secondary, danger, ghost, outline; sizes: sm, md, lg; states: default, hover, active, disabled, loading
- [ ] `atoms/Input.tsx` — types: text, email, password, search, number; states: default, focus, error, disabled
- [ ] `atoms/Textarea.tsx` — resizable, character count optional
- [ ] `atoms/Checkbox.tsx` — custom styled, indeterminate state supported
- [ ] `atoms/RadioButton.tsx` — custom styled, groupable
- [ ] `atoms/Select.tsx` — Radix UI Select as base, custom styling
- [ ] `atoms/Label.tsx` — associates with `htmlFor`, optional required indicator
- [ ] `atoms/Badge.tsx` — variants: default, success, warning, error, info
- [ ] `atoms/Avatar.tsx` — initials fallback, image support
- [ ] `atoms/Spinner.tsx` — sizes: sm, md, lg; accessible with aria-label
- [ ] `atoms/Divider.tsx` — horizontal and vertical variants
- [ ] All atoms: write unit tests covering all variants and states

### 6.5 Molecule Components

- [ ] `molecules/FormField.tsx` — Label + Input/Textarea/Select + ErrorMessage wrapper with proper ARIA associations
- [ ] `molecules/SearchBar.tsx` — Input + search icon + 300ms debounce, clear button
- [ ] `molecules/StatusBadge.tsx` — Badge with ApplicationStatus mapping (color + label)
- [ ] `molecules/FileDropzone.tsx` — drag-and-drop zone with MIME type validation, size validation, hover state
- [ ] `molecules/PasswordInput.tsx` — Input with visibility toggle + PasswordStrengthIndicator
- [ ] `molecules/PasswordStrengthIndicator.tsx` — visual strength bar with 5 levels
- [ ] `molecules/PhoneInput.tsx` — Input with `(###) ###-####` mask

### 6.6 Organism Components

- [ ] `organisms/DataTable.tsx` — column-sortable, paginated, row-selectable, empty state, loading skeleton, responsive
- [ ] `organisms/Modal.tsx` — built on GlassModal + Radix Dialog, focus trap, escape key dismiss, backdrop click dismiss, animated open/close
- [ ] `organisms/FormWizard.tsx` — multi-step form with progress indicator, back/next navigation, step validation
- [ ] `organisms/SignatureCanvas.tsx` — canvas-based drawing with mouse and touch support, clear button, export to PNG base64
- [ ] `organisms/UploadQueue.tsx` — multi-file list with individual progress bars, cancel buttons, scan status indicators
- [ ] `organisms/ApplicationTimeline.tsx` — vertical timeline of application status history with timestamps

### 6.7 Layout Components

- [ ] `layout/AppShell.tsx` — root layout: sidebar + header + main content + toast container
- [ ] `layout/Header.tsx` — role-aware top navigation: notifications badge, inbox badge, user menu, settings link
- [ ] `layout/Sidebar.tsx` — role-filtered navigation links, active state, collapsible on mobile, logo
- [ ] `layout/Breadcrumbs.tsx` — auto-generated from route, clickable ancestors
- [ ] `layout/PageWrapper.tsx` — standard page content container with consistent padding and max-width

### 6.8 Feedback Components

- [ ] `feedback/SkeletonLoader.tsx` — configurable skeleton shapes: text, card, table, list item, dashboard
- [ ] `feedback/EmptyState.tsx` — illustration + title + description + optional action button
- [ ] `feedback/ErrorBoundary.tsx` — React error boundary with fallback UI and Sentry capture
- [ ] `feedback/OfflineBanner.tsx` — animated banner appears/disappears based on network status

### 6.9 Phase 2 Validation

- [ ] Visual audit: all components match Figma specifications
- [ ] All components render correctly in both light and dark themes
- [ ] All atoms and molecules have passing unit tests
- [ ] No inline `style` attributes exist anywhere in the component library
- [ ] All tokens are sourced from CSS custom properties or Tailwind config — zero hardcoded hex values
- [ ] Color contrast audit passes for all text/background pairings

---

## 7. Phase 3 — Authentication & Session

**Goal:** Complete, secure authentication flows: registration, login, MFA setup, MFA verification, password reset, session timeout, account lockout — all with full UI polish and HIPAA compliance.

### 7.1 Auth State (Redux)

- [ ] Create `features/auth/store/authSlice.ts`
  - State: `token`, `user`, `mfaVerified`, `sessionExpiry`, `isAuthenticated`
  - Actions: `setAuth`, `clearAuth`, `setMFAVerified`, `updateSessionExpiry`
- [ ] Implement `clearAllPHI()` action that zeros campers, medical, applications, documents slices
- [ ] Write unit tests for all auth slice actions and reducers

### 7.2 Auth API Service

- [ ] Create `features/auth/api/auth.api.ts`
  - `register(data)` → POST /api/auth/register
  - `login(data)` → POST /api/auth/login
  - `logout()` → POST /api/logout
  - `forgotPassword(email)` → POST /api/auth/forgot-password
  - `resetPassword(data)` → POST /api/auth/reset-password
  - `refreshSession()` → POST /api/auth/refresh-session
  - `getUser()` → GET /api/user
  - `updateProfile(data)` → PUT /api/profile

### 7.3 MFA API Service

- [ ] Add to `features/auth/api/auth.api.ts` (or separate `mfa.api.ts`)
  - `mfaSetup()` → POST /api/mfa/setup
  - `mfaVerify(code)` → POST /api/mfa/verify
  - `mfaDisable(password, code)` → POST /api/mfa/disable

### 7.4 Validation Schemas (Zod)

- [ ] `features/auth/schemas/auth.schemas.ts`
  - `registerSchema`: name (max 255), email (valid), password (12+ chars, uppercase, lowercase, number, symbol, confirmed)
  - `loginSchema`: email, password, optional mfa_code (6 digits)
  - `forgotPasswordSchema`: email
  - `resetPasswordSchema`: email, token, password, password_confirmation
  - `mfaVerifySchema`: code (exactly 6 digits)
  - `mfaDisableSchema`: password, code

### 7.5 Auth Pages & Components

#### Registration Page
- [ ] Create `features/auth/pages/RegisterPage.tsx`
- [ ] Implement form with React Hook Form + Zod resolver
- [ ] Add real-time password strength indicator
- [ ] Add password confirmation match validation
- [ ] Display field-level error messages from Zod and from backend 422 response
- [ ] Success: redirect to `/mfa/setup`

#### Login Page
- [ ] Create `features/auth/pages/LoginPage.tsx`
- [ ] Implement email + password form with MFA code field
- [ ] MFA code field: show only if user has `mfa_enabled: true` OR after initial failed attempt returns MFA requirement
- [ ] Handle 403 lockout: display countdown timer, disable form
- [ ] Handle 401: display "Invalid credentials" (no enumeration)
- [ ] Success (no MFA): redirect to `/dashboard`
- [ ] Success (MFA required): show inline MFA code field

#### MFA Setup Page
- [ ] Create `features/auth/pages/MFASetupPage.tsx`
- [ ] Create `features/auth/components/MFASetupWizard.tsx`
  - Step 1: Explanation of what MFA is and why it is required
  - Step 2: Display QR code (render `qr_code_url` via a QR library or `<img>`) and manual entry key
  - Step 3: TOTP verification entry + confirm
  - Step 4: Success confirmation with "Go to Dashboard" CTA
- [ ] Handle errors: invalid code, expired setup attempt

#### Password Reset Flow
- [ ] Create `features/auth/pages/ForgotPasswordPage.tsx` — email input, success message regardless of outcome
- [ ] Create `features/auth/pages/ResetPasswordPage.tsx` — reads `?token=` and `?email=` from URL, password + confirmation form

#### Session Timeout System
- [ ] Create `features/auth/hooks/useSessionTimeout.ts`
  - Track `sessionExpiry` from Redux
  - At 55 minutes: dispatch action to show `SessionTimeoutModal`
  - At 60 minutes: dispatch `clearAuth()` + `clearAllPHI()` + redirect to `/login`
- [ ] Create `features/auth/components/SessionTimeoutModal.tsx`
  - Animated modal with countdown timer (5:00 → 0:00)
  - "Stay Logged In" button: calls `refreshSession()`, resets timer
  - "Log Out Now" button: immediate logout sequence
  - Auto-saves any active draft application before logging out

### 7.6 Logout Sequence

- [ ] Implement complete logout sequence (Architecture Plan Section 7.3)
- [ ] Confirm state is fully cleared via Redux DevTools after logout
- [ ] Confirm browser back button cannot expose PHI after logout

### 7.7 Phase 3 Validation

- [ ] Complete registration → MFA setup → login → dashboard flow works end-to-end
- [ ] Account lockout countdown appears and disables form on 5 failed attempts
- [ ] Session timeout modal appears at 55 minutes (test with short timeout in dev)
- [ ] Forced logout at 60 minutes clears all Redux state including PHI slices
- [ ] Page refresh after logout redirects to `/login` (token not persisted)
- [ ] All auth Zod schemas validate correctly against backend error responses

---

## 8. Phase 4 — Core Feature Modules

**Goal:** All six primary feature areas are fully implemented, integrated with the backend API, and visually complete. This is the largest phase and may be parallelized across team members.

### 8.1 Feature Build Order

Features are ordered by dependency. Each feature follows the same implementation checklist:

```
For each feature:
1. Redux slice (state shape, async thunks, selectors)
2. API service class
3. Zod validation schemas
4. TypeScript types
5. Custom hooks
6. Presentational components
7. Page-level containers
8. Route registration
9. Unit tests for slice, hooks, schemas
10. Integration tests for key flows
```

### 8.2 Campers Feature

- [ ] `features/campers/store/campersSlice.ts` — CRUD thunks, PHI-zero policy on slice state
- [ ] `features/campers/api/campers.api.ts` — index, show, store, update, destroy
- [ ] `features/campers/schemas/camper.schemas.ts` — createCamperSchema, updateCamperSchema
- [ ] `features/campers/components/CamperCard.tsx` — name, DOB, age, PHI blur support
- [ ] `features/campers/components/CamperForm.tsx` — first_name, last_name, date_of_birth, gender
- [ ] `features/campers/components/CamperList.tsx` — DataTable with search and pagination
- [ ] `features/campers/pages/CampersListPage.tsx` — GlassPanel layout, "Add Child Participant" CTA
- [ ] `features/campers/pages/CamperDetailPage.tsx` — profile detail, linked applications, edit/delete actions
- [ ] `features/campers/pages/CreateCamperPage.tsx` — wizard-style form
- [ ] Role scoping: parent users see only their own child participants; admin sees all
- [ ] Delete confirmation dialog (Modal organism) before soft delete

### 8.3 Applications Feature

- [ ] `features/applications/store/applicationsSlice.ts` — full workflow state, draft tracking, optimistic updates
- [ ] `features/applications/api/applications.api.ts` — index, show, store, update, sign, review
- [ ] `features/applications/schemas/application.schemas.ts` — draft schema, submit schema, review schema
- [ ] `features/applications/hooks/useAutoSave.ts` — 30-second interval auto-save of draft, `beforeunload` save, last-saved timestamp
- [ ] `features/applications/components/ApplicationCard.tsx` — status badge, child participant name, session info, last updated
- [ ] `features/applications/components/ApplicationForm.tsx` — multi-step wizard (select session → camper details → terms → signature)
- [ ] `features/applications/components/StatusBadge.tsx` — 6 states: pending, under_review, approved, rejected, waitlisted, cancelled
- [ ] `features/applications/components/SignatureCanvas.tsx` — touch and mouse support, clear and save actions, exports to base64 PNG
- [ ] `features/applications/components/ApplicationTimeline.tsx` — vertical status history with timestamps and reviewer notes
- [ ] `features/applications/components/ReviewPanel.tsx` — admin-only: status selector (approved | rejected | waitlisted), notes textarea, submit
- [ ] `features/applications/pages/ApplicationsListPage.tsx` — filterable by status, role-scoped list
- [ ] `features/applications/pages/ApplicationDetailPage.tsx` — full detail with timeline, documents, medical summary link
- [ ] `features/applications/pages/CreateApplicationPage.tsx` — FormWizard with auto-save
- [ ] `features/applications/pages/ReviewApplicationPage.tsx` — admin-only review view
- [ ] Edit prevention: render read-only view for applications in final states (approved, rejected, cancelled)
- [ ] Idempotency key on submission to prevent duplicate applications

### 8.4 Medical Records Feature

- [ ] `features/medical/store/medicalSlice.ts` — PHI policy enforced: zero TTL, no persistence
- [ ] `features/medical/api/medical.api.ts` — medical records, allergies, medications, emergency contacts CRUD
- [ ] `features/medical/schemas/medical.schemas.ts` — Zod schemas for all medical forms
- [ ] `features/medical/components/MedicalRecordForm.tsx` — diagnosis, treatment, physician info
- [ ] `features/medical/components/AllergyManager.tsx` — allergy list with severity indicators, add/edit/delete (role-gated delete)
- [ ] `features/medical/components/MedicationManager.tsx` — medication list, add/edit/delete (role-gated delete)
- [ ] `features/medical/components/EmergencyContactForm.tsx` — primary/secondary phone, relationship, pickup authorization
- [ ] `features/medical/pages/MedicalRecordPage.tsx` — tabbed layout: Medical Records | Allergies | Medications | Emergency Contacts
- [ ] PHI blur integration: all medical content responds to `usePhiBlur()` hook
- [ ] Role rendering: medical provider sees records but cannot delete; admin has full access; parent manages own child's data

### 8.5 Documents Feature

- [ ] `features/documents/store/documentsSlice.ts` — upload queue, scan status tracking, pagination
- [ ] `features/documents/api/documents.api.ts` — index, upload (multipart), download, delete
- [ ] `features/documents/hooks/useFileUpload.ts` — validation (10 MB, MIME types), upload progress, cancellation, queue management
- [ ] `features/documents/components/FileDropzone.tsx` — visual drag-and-drop zone with animated hover state, file type icons
- [ ] `features/documents/components/DocumentList.tsx` — file name, size, type, scan status, download and delete actions
- [ ] `features/documents/components/UploadProgress.tsx` — progress bar per file with percentage, cancel button
- [ ] `features/documents/components/ScanStatusIndicator.tsx` — Badge with pending (spinner) | passed (green) | failed (red) status
- [ ] `features/documents/pages/DocumentsPage.tsx` — dropzone + document list, role-scoped access
- [ ] Downloads blocked in UI for scan_status `failed` (non-admin users)
- [ ] Client-side MIME type validation before upload attempt

### 8.6 Inbox Feature

- [ ] `features/inbox/store/conversationSlice.ts` — conversations[], unreadCount, pagination
- [ ] `features/inbox/store/messageSlice.ts` — messagesByConversation{}, optimistic messages
- [ ] `features/inbox/api/inbox.api.ts` — full conversation and message API (Architecture Plan Section 7.5)
- [ ] `features/inbox/hooks/useInboxPolling.ts` — 30-second unread count polling with 3-failure suspension
- [ ] `features/inbox/hooks/useSendMessage.ts` — optimistic message UI with rollback
- [ ] `features/inbox/schemas/inbox.schemas.ts` — createConversationSchema, sendMessageSchema (Architecture Plan Section 7.7)
- [ ] `features/inbox/components/ConversationList.tsx` — list with unread indicators, last message preview, archive badge
- [ ] `features/inbox/components/ConversationListItem.tsx` — participant avatars, subject, last message preview, time, unread dot
- [ ] `features/inbox/components/MessageThread.tsx` — chronological message list with virtual scrolling for large threads
- [ ] `features/inbox/components/MessageItem.tsx` — sender avatar, message body, timestamp, read receipts, attachment list
- [ ] `features/inbox/components/MessageComposer.tsx` — textarea with attachment upload (5 files max, 10 MB each), send button
- [ ] `features/inbox/components/UnreadBadge.tsx` — count badge on navigation item and header icon
- [ ] `features/inbox/pages/InboxPage.tsx` — two-pane layout: conversation list (left) + message thread (right) with responsive collapse
- [ ] Role-gated controls: parent can only create conversations with admins; medical provider cannot create conversations; admin can manage participants
- [ ] Idempotency key on message send to prevent duplicates

### 8.7 Notifications Feature

- [ ] `features/notifications/store/notificationsSlice.ts` — notifications[], unreadCount, lastFetched
- [ ] `features/notifications/api/notifications.api.ts` — index, markRead, markAllRead
- [ ] `features/notifications/hooks/useNotificationPolling.ts` — 30-second polling with 3-failure circuit breaker
- [ ] `features/notifications/components/NotificationPanel.tsx` — dropdown panel in header, list of notification items, "Mark all read" action
- [ ] `features/notifications/components/NotificationItem.tsx` — type-based icon, title, message, relative timestamp, read/unread state
- [ ] Notification type rendering: `application_submitted`, `application_reviewed`, `document_uploaded`, `medical_provider_link_accessed`, `session_reminder`, `account_activity`
- [ ] Click-through routing: each notification type links to the relevant resource

### 8.8 Admin Feature

- [ ] `features/admin/api/camps.api.ts` — camps and sessions CRUD
- [ ] `features/admin/api/reports.api.ts` — all 5 report endpoints, format selection (PDF, CSV, Excel)
- [ ] `features/admin/store/adminSlice.ts` — camps, sessions, users, reports
- [ ] `features/admin/components/CampManager.tsx` — CRUD UI for camp organizational entities
- [ ] `features/admin/components/SessionManager.tsx` — CRUD UI for camp sessions with date ranges and capacity
- [ ] `features/admin/components/UserManager.tsx` — list and manage user accounts and roles
- [ ] `features/admin/components/ReportViewer.tsx` — report selector, format selector, date range picker, download button
- [ ] `features/admin/pages/AdminDashboard.tsx` — stats overview (total camps, sessions, applications by status, recent activity)
- [ ] `features/admin/pages/AdminCampsPage.tsx`
- [ ] `features/admin/pages/AdminSessionsPage.tsx`
- [ ] `features/admin/pages/AdminUsersPage.tsx`
- [ ] `features/admin/pages/AdminReportsPage.tsx`
- [ ] All admin routes guarded by `allowedRoles={['admin']}` in `ProtectedRoute`

### 8.9 Medical Provider Link Feature

- [ ] `features/admin/api/medicalLinks.api.ts` — list, create, validate, submit, revoke, resend
- [ ] `features/medical-provider/pages/MedicalProviderLinkPage.tsx` — unauthenticated token-gated entry
  - Validates link via `GET /api/medical-provider-links/{token}/validate`
  - Shows expired/invalid state if link is invalid
  - Shows medical record submission form if valid
  - Submits via `POST /api/medical-provider-links/{token}/submit`

### 8.10 Dashboard Feature

- [ ] `features/dashboard/components/StatsCard.tsx` — animated count cards (GlassCard base)
- [ ] `features/dashboard/components/ActivityFeed.tsx` — recent activity timeline
- [ ] `features/dashboard/components/QuickActions.tsx` — role-specific action buttons
- [ ] `features/dashboard/components/SessionCalendar.tsx` — mini calendar with session highlights
- [ ] `features/dashboard/pages/AdminDashboard.tsx` — application status summary, recent registrations, capacity overview
- [ ] `features/dashboard/pages/ParentDashboard.tsx` — child participant profiles, application statuses, notifications

### 8.11 Phase 4 Validation

- [ ] All API integrations confirmed against live backend (not mocked)
- [ ] Role-based access tested with all three user roles
- [ ] Application full workflow tested: create draft → auto-save → sign → submit → admin review → approve → notification received
- [ ] File upload works with progress bar, scan status polling, and download
- [ ] Inbox message thread works with optimistic send and read receipts
- [ ] Reports generate and download in all three formats (PDF, CSV, Excel)

---

## 9. Phase 5 — HIPAA & Security Hardening

**Goal:** Confirm all HIPAA requirements are enforced at the frontend layer, all security boundaries hold, and the threat model mitigations are in place.

- [ ] Audit: Confirm zero PHI in localStorage using browser DevTools after any workflow
- [ ] Audit: Confirm zero PHI in sessionStorage
- [ ] Audit: Confirm zero PHI appears in any URL (router navigation, links, API calls)
- [ ] Audit: Confirm `console.log` is stripped in production build (`console.log` ESLint rule + Vite build config)
- [ ] Audit: Confirm Redux DevTools are disabled in production (`VITE_ENABLE_DEVTOOLS=false`)
- [ ] Audit: Confirm Redux Persist is either not configured or explicitly excludes all PHI slices
- [ ] Implement `utils/phiSanitizer.ts` — removes known PHI field names from error objects before Sentry capture
- [ ] Confirm `clearAllPHI()` zeros all PHI slices on logout (verify via Redux DevTools test)
- [ ] Confirm token is not re-populated after page refresh (verify localStorage/sessionStorage are empty post-refresh → /login redirect)
- [ ] Test account lockout: 5 failed logins → lockout message with countdown → cannot login until countdown completes
- [ ] Test session timeout: forced logout at 60 minutes clears all PHI
- [ ] Test medical provider link: confirm single-use behavior (second visit to same link → expired state)
- [ ] Configure Content Security Policy headers (via meta tag in `index.html` or backend header)
- [ ] Confirm all external links use `rel="noopener noreferrer"`
- [ ] Confirm file downloads go through authenticated backend endpoints, never direct file URLs
- [ ] Run `npm audit` and resolve all critical/high severity vulnerabilities
- [ ] Review OWASP Top 10 checklist for SPA-specific vulnerabilities

---

## 10. Phase 6 — Settings System

**Goal:** A comprehensive, polished Settings page that gives users maximum safe control over their experience.

- [ ] Create `features/settings/store/settingsSlice.ts` with all setting fields (Architecture Plan Section 11.2)
- [ ] Implement persistence: selected non-PHI settings persist to localStorage under `cbg_settings_v1`
- [ ] Implement settings hydration on app startup (load from localStorage → merge with defaults)
- [ ] Create `features/settings/pages/SettingsPage.tsx` — tabbed layout matching categories in Architecture Plan Section 11.2
- [ ] Create `features/settings/components/AppearanceSettings.tsx` — theme switcher (system/light/dark), color accent picker, font size, compact mode, background style
- [ ] Create `features/settings/components/AccessibilitySettings.tsx` — reduced motion, animation speed, high contrast, focus indicators, screen reader mode
- [ ] Create `features/settings/components/NotificationSettings.tsx` — email toggle, in-app toggle, sound toggle, badge toggle, polling interval
- [ ] Create `features/settings/components/SecuritySettings.tsx` — session warning timing, auto-lock, blur PHI on unfocus, confirm before logout, login activity view
- [ ] Create `features/settings/components/PrivacySettings.tsx` — blur PHI toggle with explanation
- [ ] Create `features/settings/components/AccountSettings.tsx` — change name, email, password, MFA management, active session list
- [ ] Implement `useTheme.ts` — reads `settingsSlice.theme`, applies `[data-theme="dark"]` to `<html>`
- [ ] Implement `usePhiBlur.ts` — reads `settingsSlice.blurPHIOnUnfocus`, returns `blurred` boolean
- [ ] Apply `blurred` state to all PHI-containing components (camper details, medical records, application details)
- [ ] Implement `useMotion.ts` — reads `settingsSlice.reducedMotion` and system preference
- [ ] Test: changing theme applies immediately without page reload
- [ ] Test: blur PHI blurs sensitive content when window loses focus
- [ ] Test: reduced motion disables all Motion animations
- [ ] Test: font size change applies to all body text

---

## 11. Phase 7 — Motion & Interaction Design

**Goal:** Every state transition, page navigation, and user action is accompanied by purposeful, physically-grounded animation that communicates clearly and delights without distracting.

- [ ] Create `constants/motion.ts` with all animation tokens (Architecture Plan Section 10.4)
- [ ] Implement page transition system with `AnimatePresence` in router
- [ ] Apply `VARIANTS.page` entrance animation to all route-level page components
- [ ] Apply `VARIANTS.card` entrance with stagger to all list views (DataTable rows, application cards, notification items)
- [ ] Apply `VARIANTS.modal` to all Modal and GlassModal open/close cycles
- [ ] Implement glass card hover lift: `translateY(-2px)` + shadow intensification
- [ ] Implement button press feedback: scale 0.97 on `active` state
- [ ] Implement form field focus: smooth border color transition + subtle glow on brand-color fields
- [ ] Implement notification badge: animated scale pulse when unread count increases
- [ ] Implement application status change: badge color transition animation (not instant swap)
- [ ] Implement upload progress bar: smooth width transition with easing
- [ ] Implement session timeout countdown: number counter animation
- [ ] Implement sidebar collapse/expand: spring-based width transition
- [ ] Implement toast notifications (Sonner): slide-in with spring, slide-out on dismiss
- [ ] Implement dashboard stats cards: count-up animation on mount
- [ ] Implement empty state illustrations: gentle floating animation (reduced amplitude if `reducedMotion`)
- [ ] Confirm all animations have zero visual effect when `reducedMotion` is `true`
- [ ] Performance test: confirm no Cumulative Layout Shift from animation-triggered layout changes

---

## 12. Phase 8 — Accessibility & Compliance

**Goal:** WCAG 2.1 AA compliance on every user-facing page.

- [ ] Audit all interactive elements for keyboard accessibility (Tab, Enter, Space, Escape, Arrow keys)
- [ ] Audit all custom widgets for correct ARIA roles, names, and values
- [ ] Audit all form inputs for associated `<label>` elements (or `aria-labelledby`)
- [ ] Audit all form validation errors for `aria-describedby` association
- [ ] Audit all modals for focus trap: focus must remain within modal when open
- [ ] Audit DataTable for ARIA grid pattern compliance
- [ ] Audit all icon-only buttons for `aria-label`
- [ ] Audit color contrast for all text/background pairings (target 4.5:1 minimum)
- [ ] Audit focus indicators — must be visible in all themes and high-contrast mode
- [ ] Run `axe-core` automated scan against all 20+ pages; resolve all violations
- [ ] Run ESLint `jsx-a11y` and resolve all errors
- [ ] Test with keyboard navigation only: complete registration → login → create application → sign → submit
- [ ] Test with screen reader (VoiceOver or NVDA): verify all content is announced correctly
- [ ] Test with high contrast mode enabled (Windows or OS-level + application setting)
- [ ] Test with zoom at 200% — ensure no horizontal overflow, no content obscured
- [ ] Verify touch targets are minimum 44×44 CSS pixels on mobile

---

## 13. Phase 9 — Performance Optimization

**Goal:** All performance targets from Architecture Plan Section 13.1 are met or exceeded.

- [ ] Run initial Lighthouse audit — record baseline scores
- [ ] Implement route-based lazy loading for all page components
- [ ] Verify Vite chunk splitting: feature modules in separate chunks, vendor chunk extracted
- [ ] Verify bundle sizes: main chunk < 100 KB gzipped, total initial load < 300 KB gzipped
- [ ] Implement skeleton screens for all data-loading pages (eliminate layout shift on data load)
- [ ] Add `loading="lazy" decoding="async"` to all non-critical images
- [ ] Implement pagination UI for all list views — verify API queries use `?page=` parameter
- [ ] Add debounce (300ms) to all search inputs
- [ ] Confirm static data caching (camps, sessions) is working — navigate away and back; confirm no duplicate API call within TTL
- [ ] Verify optimistic UI updates are functioning on create/update/delete operations
- [ ] Implement `useMemo` and `useCallback` on expensive computations and callback-prop components
- [ ] Run production build and verify source maps are generated for Sentry
- [ ] Run final Lighthouse audit — confirm LCP < 2.5s, CLS < 0.1, TTI < 3.5s, score > 90
- [ ] Test on simulated 3G connection — verify page is usable within 5 seconds

---

## 14. Phase 10 — Testing

**Goal:** 80%+ unit/integration coverage, 100% E2E coverage of all critical user flows.

### 14.1 Unit Tests (Vitest)

- [ ] `features/auth/store/authSlice.ts` — all reducers, all async thunk states
- [ ] `features/campers/store/campersSlice.ts` — CRUD thunks, PHI zero policy on clear
- [ ] `features/applications/store/applicationsSlice.ts` — all status transitions, draft state
- [ ] All custom hooks: `useSessionTimeout`, `useAutoSave`, `useFileUpload`, `useInboxPolling`, `useNotificationPolling`, `usePermissions`, `useOnlineStatus`
- [ ] All utility functions: `retryWithBackoff`, `phiSanitizer`, `cacheManager`, `correlationId`, `formatters`, `validators`
- [ ] All Zod schemas: test valid and invalid inputs for every schema
- [ ] Redux middleware: `phiProtection` (throws on PHI in persist action), `correlationId` (attaches header)

### 14.2 Integration Tests (React Testing Library)

- [ ] `LoginForm` — valid credentials submit, invalid credentials display error, lockout state renders countdown
- [ ] `MFASetupWizard` — step navigation, QR display, code verification, success
- [ ] `ApplicationForm` — multi-step navigation, auto-save indication, signature capture, submission
- [ ] `FileDropzone` — drag-and-drop, file validation (size, type), upload queue
- [ ] `MessageComposer` — text input, attachment attach/remove, send with optimistic update, rollback on error
- [ ] `SessionTimeoutModal` — countdown display, "Stay Logged In" triggers token refresh, auto-logout at 0
- [ ] `ProtectedRoute` — unauthenticated redirect, MFA redirect, role denial redirect

### 14.3 E2E Tests (Playwright)

- [ ] **Critical Flow 1:** Register → Email verification (if applicable) → Login → MFA setup → Dashboard
- [ ] **Critical Flow 2:** Login with MFA → Create child participant → Create application draft → Auto-save → Sign → Submit
- [ ] **Critical Flow 3:** Admin login → Review application → Approve → Confirm parent receives notification
- [ ] **Critical Flow 4:** Upload document → Wait for scan status → Download document
- [ ] **Critical Flow 5:** Session timeout warning at t=55min → Click "Stay Logged In" → Session extended
- [ ] **Critical Flow 6:** Session timeout → Forced logout → Confirm PHI cleared → Redirect to login → Back button does not reveal PHI
- [ ] **Critical Flow 7:** Network offline → OfflineBanner visible → Draft save queued → Network restored → Draft saved
- [ ] **Critical Flow 8:** Admin creates medical provider link → External provider visits link → Submits medical data → Link marked used
- [ ] **Critical Flow 9:** Admin generates report → Downloads PDF → Verifies file opens
- [ ] **Critical Flow 10:** Inbox conversation → Send message with attachment → Verify read receipt

### 14.4 Coverage Reporting

- [ ] Configure Vitest coverage with V8 provider
- [ ] Generate HTML coverage report
- [ ] Confirm overall unit/integration coverage >= 80%
- [ ] Block CI if coverage drops below threshold

---

## 15. Phase 11 — Observability & Error Handling

**Goal:** The application is observable in production. Errors are captured, correlated, and routed to the right team. PHI is never exposed in any monitoring output.

- [ ] Initialize Sentry with `VITE_SENTRY_DSN` environment variable
- [ ] Configure Sentry `beforeSend` hook: runs `phiSanitizer.ts` on all error events
- [ ] Configure Sentry tags: `userId` (numeric), `roleId`, `environment`, `correlationId`
- [ ] Confirm Sentry session replay is disabled (HIPAA)
- [ ] Implement `feedback/ErrorBoundary.tsx` wrapping all route-level components — captures to Sentry on render errors
- [ ] Confirm correlation ID (`X-Request-ID`) flows from frontend through API response headers
- [ ] Confirm correlation ID is included in all Sentry error captures
- [ ] Test global error handler (`utils/errorHandler.ts`) for each HTTP status code (401, 403, 422, 429, 500)
- [ ] Test `useNotificationPolling` circuit breaker: confirm polling suspends after 3 consecutive failures
- [ ] Test `useInboxPolling` circuit breaker: same behavior
- [ ] Test `useOnlineStatus`: OfflineBanner appears on disconnect, disappears on reconnect
- [ ] Test exponential backoff retry: confirm 3 retries with increasing delay on 5xx errors
- [ ] Test rate-limit handling: 429 response triggers countdown timer and blocks re-submission
- [ ] Confirm all toast error messages are user-friendly (no stack traces, no PHI, no raw JSON)
- [ ] Configure production alerting rules per Architecture Plan Section 15.3 in Sentry or Datadog

---

## 16. Phase 12 — Pre-Deployment

**Goal:** The application is verified, audited, and approved for production deployment.

### 16.1 Code Quality

- [ ] Run ESLint — zero errors, zero warnings
- [ ] Run TypeScript `tsc --noEmit` — zero errors
- [ ] Run Prettier — zero formatting discrepancies
- [ ] Remove all `console.log`, `console.warn`, `console.error` statements (ESLint enforced)
- [ ] Remove all `TODO` comments — resolve or create issues in the tracker
- [ ] Remove all `@ts-ignore` and `@ts-expect-error` suppressions (zero exceptions)
- [ ] Remove all unused imports (ESLint `no-unused-imports` enforced)
- [ ] Add JSDoc comments to all public utility functions and hooks

### 16.2 Security Audit

- [ ] Final `npm audit` — zero critical or high vulnerabilities
- [ ] Final OWASP Top 10 review for SPA vulnerabilities
- [ ] Verify HTTPS is enforced (no mixed content)
- [ ] Verify CSP headers are present and correctly configured
- [ ] Final PHI audit: localStorage, sessionStorage, URL params, console, Sentry payloads all confirmed clean
- [ ] Verify Redux DevTools are disabled in production build

### 16.3 Accessibility Final Audit

- [ ] Full axe-core scan against production build on staging
- [ ] Manual keyboard navigation test of all 20+ pages
- [ ] Color contrast final pass with WCAG 2.1 AA checker

### 16.4 Performance Final Audit

- [ ] Lighthouse CI run against staging — all pages score > 90
- [ ] Bundle analyzer audit — no unexpected large chunks
- [ ] Core Web Vitals: LCP < 2.5s, CLS < 0.1, FID < 100ms confirmed on staging
- [ ] Test on mobile device (real hardware) — all pages usable and visually correct

### 16.5 Build Verification

- [ ] Run production build: `npm run build`
- [ ] Test production build locally: `npm run preview`
- [ ] Verify all routes load correctly in production build
- [ ] Verify source maps are generated for Sentry
- [ ] Verify gzip/Brotli compression is enabled on the web server

### 16.6 Stakeholder Sign-Off

- [ ] Product owner approves all user flows
- [ ] Security lead reviews PHI audit results and approves
- [ ] Design lead approves visual implementation against Figma specifications
- [ ] Backend team confirms API integration is correct (no mismatched contracts)

---

## 17. Phase 13 — Deployment

- [ ] Back up current production deployment
- [ ] Deploy to staging environment
- [ ] Run full E2E test suite against staging with real backend
- [ ] Run smoke test: login, create child participant, create application, submit, admin approve
- [ ] Obtain QA sign-off on staging
- [ ] Deploy to production during low-traffic window
- [ ] Monitor Sentry error rate for 30 minutes post-deployment
- [ ] Monitor API response latency for 30 minutes post-deployment
- [ ] Test all critical flows on production
- [ ] Confirm all pages load and no JavaScript errors in browser console
- [ ] Confirm MFA setup works end-to-end in production

---

## 18. Phase 14 — Post-Deployment

### 18.1 Immediate Monitoring (Week 1)

- [ ] Review Sentry error logs daily
- [ ] Review performance metrics daily (Lighthouse, Core Web Vitals)
- [ ] Monitor API error rates via alerting configuration
- [ ] Collect user feedback from administrators and parents

### 18.2 Ongoing Maintenance

- [ ] Review error logs weekly
- [ ] Update npm dependencies monthly — prioritize security patches
- [ ] Patch critical security vulnerabilities within 24 hours of disclosure
- [ ] Re-run Lighthouse audit monthly
- [ ] Review API deprecation headers — migrate before sunset dates

### 18.3 Feature Iteration

- [ ] Collect and triage user feedback
- [ ] Evaluate TanStack Query adoption if real-time collaboration features are added (ADR-001 revisit condition)
- [ ] Evaluate Web Push notifications if polling approach proves insufficient
- [ ] Evaluate Service Worker / offline-first if field connectivity issues are reported

---

## 19. Development Standards

### 19.1 File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| React Components | PascalCase + `.tsx` | `CamperForm.tsx` |
| Custom Hooks | camelCase + `use` prefix + `.ts` | `useAutoSave.ts` |
| Utility Functions | camelCase + `.ts` | `retryWithBackoff.ts` |
| Types/Interfaces | camelCase + `.types.ts` | `camper.types.ts` |
| Zod Schemas | camelCase + `.schemas.ts` | `application.schemas.ts` |
| API Services | camelCase + `.api.ts` | `campers.api.ts` |
| Redux Slices | camelCase + `Slice.ts` | `applicationsSlice.ts` |
| Constants | camelCase + `.ts` | `applicationStatus.ts` |
| Test Files | mirrored filename + `.test.ts(x)` | `useAutoSave.test.ts` |
| E2E Tests | feature name + `.spec.ts` | `applications.spec.ts` |

### 19.2 Component Writing Standards

- Every component has a named function export (not anonymous arrow function)
- Every component has a typed `Props` interface defined above the component
- Every component uses `React.memo()` if it accepts stable props and re-renders frequently
- Every component handles its own loading state unless managed by a parent container
- No component exceeds 200 lines — if it does, extract sub-components

### 19.3 TypeScript Standards

- `strict: true` in `tsconfig.json` — mandatory
- No `any` — zero exceptions in production code
- All async function return types are explicitly declared
- All Redux async thunk payloads are typed
- All Axios response data is typed against the API contract

### 19.4 Git Workflow

| Branch Type | Naming | Target |
|-------------|--------|--------|
| Feature | `feature/CBG-{id}-short-description` | `develop` |
| Bug Fix | `fix/CBG-{id}-short-description` | `develop` |
| Hotfix | `hotfix/CBG-{id}-short-description` | `main` |
| Release | `release/v{major}.{minor}.{patch}` | `main` |

Commit messages follow Conventional Commits:
`feat(applications): add digital signature capture component`
`fix(auth): correct MFA code field visibility logic`
`security(phi): ensure PHI is cleared from all slices on logout`

### 19.5 Pull Request Standards

All PRs must:
- Pass CI (lint, TypeScript, Vitest, Playwright)
- Include a screenshot or Loom video for visual changes
- Reference the relevant issue/ticket
- Be reviewed by at least one other developer
- Pass the Definition of Done checklist (Section 20)

---

## 20. Definition of Done

A feature, component, or page is considered done when ALL of the following are true:

- [ ] Feature works correctly as specified, verified against the live backend API
- [ ] All user roles have been tested (administrator, parent, medical provider) with correct scoping
- [ ] PHI audit passed: no PHI in localStorage, sessionStorage, URL, logs, or error payloads
- [ ] TypeScript compiles with zero errors (`tsc --noEmit`)
- [ ] ESLint reports zero errors including `jsx-a11y` accessibility rules
- [ ] Unit tests written and passing, contributing to >= 80% coverage target
- [ ] All interactive elements are keyboard accessible
- [ ] Color contrast passes 4.5:1 for all text/background combinations
- [ ] Loading state is handled (skeleton or spinner)
- [ ] Empty state is handled (EmptyState component with CTA)
- [ ] Error state is handled (inline error or toast, user-friendly message)
- [ ] Animations respect `useMotion()` reduced motion preference
- [ ] Component renders correctly in light and dark themes
- [ ] Component renders correctly at mobile (375px), tablet (768px), and desktop (1280px) breakpoints
- [ ] No inline `style` attributes exist
- [ ] No hardcoded hex colors (all via tokens or Tailwind classes)
- [ ] PR reviewed and approved by at least one team member

---

## 21. Risk Register

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R-01 | HIPAA audit finds PHI in unexpected location | Low | Critical | PHI audit protocol in Phase 5, PHI middleware in development, pre-deployment audit |
| R-02 | Backend API breaking changes after development begins | Low | High | Version detection utility, backend team communication protocol, integration tests catch regressions |
| R-03 | Third-party dependency vulnerability introduced | Medium | High | Monthly `npm audit`, automated Dependabot alerts, immediate patch policy |
| R-04 | Performance targets not met on initial build | Medium | Medium | Performance budget in Vite, Lighthouse CI in pipeline, Phase 9 dedicated optimization |
| R-05 | Accessibility violations discovered late in development | Low | Medium | ESLint `jsx-a11y` from Phase 1, axe-core in CI from Phase 2, not deferred to Phase 8 |
| R-06 | MFA implementation incompatible with authenticator apps | Low | High | Test with Google Authenticator, Authy, and 1Password TOTP in Phase 3 |
| R-07 | Glassmorphism `backdrop-filter` unsupported in target browser | Low | Low | Graceful fallback to solid background with same border and shadow, tested in Phase 2 |
| R-08 | Team unfamiliarity with Redux Toolkit patterns | Medium | Medium | ADR-001 documented, RTK architecture documented in Architecture Plan, code review enforcement |
| R-09 | Session timeout behavior disrupts long form workflows | Medium | Medium | Auto-save draft before timeout, clear user communication via modal |
| R-10 | Document security scan delays block user workflow | Low | Medium | Pending scan status clearly communicated, download blocked only for failed scans |

---

**Document Status:** Authoritative
**Maintained By:** Frontend Lead
**Review Cycle:** Per-phase, updated as each phase completes
**Architecture Reference:** Frontend Architecture Plan v1.0.0
**Compliance Alignment:** HIPAA, RBAC, MFA, WCAG 2.1 AA
**Total Phases:** 14 (including pre-development and post-deployment)
