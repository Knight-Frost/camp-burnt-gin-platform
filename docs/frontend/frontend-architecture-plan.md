# Frontend Architecture Plan
## Camp Burnt Gin Application Software

**Document Type:** Technical Architecture Plan — Planning Phase Reference
**Project:** Camp Burnt Gin Application Software — Frontend
**Backend API:** Laravel 12.0 REST API (PHP 8.2+)
**Version:** 1.0.0
**Date:** February 13, 2026
**Status:** Informational — Planning Reference
**Compliance Scope:** HIPAA, WCAG 2.1 AA, RBAC, MFA

> **Note:** This document was produced during the architecture planning phase. The implementation has been completed. For the current system state, refer to [frontend/FRONTEND_GUIDE.md](../../frontend/FRONTEND_GUIDE.md). This document is preserved for traceability and academic reference.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [State Management Architecture](#4-state-management-architecture)
5. [Routing & Access Control](#5-routing--access-control)
6. [API Integration Layer](#6-api-integration-layer)
7. [Authentication & Session Architecture](#7-authentication--session-architecture)
8. [Design System & Component Architecture](#8-design-system--component-architecture)
9. [Visual Design Language](#9-visual-design-language)
10. [Motion & Animation System](#10-motion--animation-system)
11. [Settings & User Preferences System](#11-settings--user-preferences-system)
12. [Security Architecture (Frontend)](#12-security-architecture-frontend)
13. [Performance Architecture](#13-performance-architecture)
14. [Error Handling & Resilience](#14-error-handling--resilience)
15. [Observability & Monitoring](#15-observability--monitoring)
16. [Testing Architecture](#16-testing-architecture)
17. [Accessibility Architecture](#17-accessibility-architecture)
18. [Build & Deployment Architecture](#18-build--deployment-architecture)
19. [Architectural Decision Records](#19-architectural-decision-records)

---

## 1. Architecture Overview

### 1.1 System Context

The Camp Burnt Gin frontend is a production-grade single-page application (SPA) serving three distinct user roles — Administrator, Parent/Guardian, and Medical Provider — across a HIPAA-regulated camp registration and management platform. It communicates exclusively with a Laravel 12.0 RESTful backend via authenticated, token-based API calls.

### 1.2 Architectural Style

The frontend follows a Feature-Driven Architecture (FDA) pattern. Each business domain (authentication, campers, applications, medical, inbox, administration) is encapsulated as a self-contained feature module with its own components, pages, hooks, state slices, API services, schemas, and types. Shared infrastructure lives at the top level, never within a feature.

```
┌──────────────────────────────────────────────────────────────┐
│                        User (Browser)                        │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS / TLS 1.2+
┌───────────────────────────▼──────────────────────────────────┐
│                    React 18 SPA (Vite)                       │
│                                                              │
│   ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  │
│   │  Router  │  │   Store   │  │  Design  │  │ Settings │  │
│   │  Guards  │  │  (Redux)  │  │  System  │  │  Engine  │  │
│   └────┬─────┘  └─────┬─────┘  └────┬─────┘  └────┬─────┘  │
│        │              │             │              │         │
│   ┌────▼──────────────▼─────────────▼──────────────▼──────┐ │
│   │              Feature Modules (FDA)                     │ │
│   │  auth | campers | applications | medical | inbox | ... │ │
│   └────────────────────────┬───────────────────────────────┘ │
│                            │                                 │
│   ┌────────────────────────▼───────────────────────────────┐ │
│   │              API Service Layer (Axios)                  │ │
│   └────────────────────────┬───────────────────────────────┘ │
└───────────────────────────┬──────────────────────────────────┘
                            │ Bearer {token} / application/json
┌───────────────────────────▼──────────────────────────────────┐
│               Laravel 12.0 REST API (/api)                   │
│  Auth | Camps | Campers | Applications | Medical | Inbox...  │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 Core Architectural Principles

- **Security First.** Every architectural decision is evaluated through a security lens. HIPAA compliance is non-negotiable and drives state management, routing, storage, and rendering decisions.
- **Feature Isolation.** Features cannot directly import from other features. All cross-feature communication passes through the Redux store or shared hooks.
- **Type Safety Throughout.** TypeScript strict mode is mandatory. No `any` types in production code. All API responses are typed against backend contracts.
- **HIPAA PHI Boundary.** Protected Health Information never touches localStorage, sessionStorage, URL parameters, console logs, or error messages. Memory-only storage via Redux is the sole PHI residence.
- **Progressive Enhancement.** The application functions on all modern browsers, degrades gracefully on poor connections, and handles offline states explicitly.
- **3× Scalability Target.** The architecture must absorb 3× growth in features (from 6 to 18+) without structural refactoring.

---

## 2. Technology Stack

### 2.1 Core Stack

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| Framework | React | 18.3.1 | Concurrent rendering, Server Components readiness, ecosystem depth |
| Language | TypeScript | 5.x | Strict typing, IDE productivity, API contract enforcement |
| Build Tool | Vite | 6.x | Sub-second HMR, ES module native, superior DX |
| State Management | Redux Toolkit | 2.x | HIPAA-compliant memory-only state, predictable debugging, RTK Query as optional enhancement |
| Router | React Router | 7.x | File-based routing optional, nested layouts, data loaders |
| HTTP Client | Axios | 1.x | Interceptors, instance configuration, cancel tokens |
| Styling | Tailwind CSS | 4.x | Token-driven utility classes, zero runtime CSS, JIT purging |
| Animation | Motion (Framer Motion) | 12.x | Production-grade animation API, layout animations, gesture support |
| Forms | React Hook Form | 7.x | Uncontrolled performance, resolver integration |
| Validation | Zod | 3.x | Runtime schema validation, TypeScript inference, backend parity |
| UI Primitives | Radix UI | Latest | Accessible headless primitives, WAI-ARIA compliant |
| Icons | Lucide React | 0.487 | Consistent icon language, tree-shakeable |
| Toast | Sonner | 2.x | Lightweight, beautiful, promise-aware notifications |
| Date Handling | date-fns | 3.x | Immutable, tree-shakeable, locale-aware |
| Testing (Unit) | Vitest | Latest | Vite-native, Jest-compatible API |
| Testing (E2E) | Playwright | Latest | Multi-browser, trace viewer, network mocking |
| Testing (Components) | React Testing Library | Latest | Behavior-focused, accessibility-integrated |
| Error Monitoring | Sentry | Latest | PHI-masked error tracking, source maps, session replay |
| Linting | ESLint + jsx-a11y | Latest | Accessibility enforcement, security rules |
| Formatting | Prettier | Latest | Consistent, opinionated formatting |

### 2.2 Optional Enhancement Stack

| Tool | Purpose | Activation Condition |
|------|---------|---------------------|
| TanStack Query (React Query) | Server-state for non-PHI data | If real-time collaboration is added |
| SWR | Lightweight polling for notifications | Alternative to manual polling |
| Web Workers | Signature processing, report generation | If main thread performance degrades |
| Workbox (Service Worker) | Offline-first draft saving | If field usage pattern requires it |
| DOMPurify | Sanitize any innerHTML use | Required if rich-text rendering is added |

---

## 3. Project Structure

### 3.1 Top-Level Directory Layout

```
src/
├── api/                          # Global API config and utilities
│   ├── axios.config.ts           # Axios instance, interceptors, defaults
│   ├── api.types.ts              # Shared API response types
│   └── versioning.ts             # Version detection utility
│
├── assets/                       # Static files
│   ├── fonts/                    # Self-hosted typography
│   ├── images/                   # Optimized images
│   └── styles/
│       ├── globals.css           # CSS custom properties, resets
│       └── tailwind.css          # Tailwind directives
│
├── components/                   # Shared design system components
│   ├── atoms/                    # Button, Input, Badge, Label, Avatar
│   ├── molecules/                # FormField, SearchBar, StatusBadge, FileDropzone
│   ├── organisms/                # DataTable, Modal, FormWizard, SignatureCanvas
│   ├── layout/
│   │   ├── AppShell.tsx          # Root layout wrapper
│   │   ├── Header.tsx            # Top navigation
│   │   ├── Sidebar.tsx           # Role-aware navigation sidebar
│   │   ├── Breadcrumbs.tsx
│   │   └── PageWrapper.tsx       # Page-level layout with spacing
│   ├── feedback/
│   │   ├── SkeletonLoader.tsx    # Loading state skeletons
│   │   ├── EmptyState.tsx        # Empty data states
│   │   ├── ErrorBoundary.tsx     # React error boundary
│   │   └── OfflineBanner.tsx     # Network status indicator
│   └── glass/                    # Glassmorphism component variants
│       ├── GlassCard.tsx
│       ├── GlassPanel.tsx
│       └── GlassModal.tsx
│
├── features/                     # Feature modules (isolated FDA)
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── MFASetupWizard.tsx
│   │   │   ├── MFAVerificationForm.tsx
│   │   │   ├── PasswordStrengthIndicator.tsx
│   │   │   └── SessionTimeoutModal.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── ForgotPasswordPage.tsx
│   │   │   ├── ResetPasswordPage.tsx
│   │   │   └── MFASetupPage.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useSessionTimeout.ts
│   │   │   └── useMFASetup.ts
│   │   ├── store/
│   │   │   └── authSlice.ts
│   │   ├── api/
│   │   │   └── auth.api.ts
│   │   └── schemas/
│   │       └── auth.schemas.ts
│   │
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── StatsCard.tsx
│   │   │   ├── ActivityFeed.tsx
│   │   │   ├── QuickActions.tsx
│   │   │   └── SessionCalendar.tsx
│   │   └── pages/
│   │       ├── AdminDashboard.tsx
│   │       └── ParentDashboard.tsx
│   │
│   ├── campers/
│   │   ├── components/
│   │   │   ├── CamperCard.tsx
│   │   │   ├── CamperForm.tsx
│   │   │   └── CamperList.tsx
│   │   ├── pages/
│   │   │   ├── CampersListPage.tsx
│   │   │   ├── CamperDetailPage.tsx
│   │   │   └── CreateCamperPage.tsx
│   │   ├── hooks/
│   │   │   └── useCampers.ts
│   │   ├── store/
│   │   │   └── campersSlice.ts
│   │   ├── api/
│   │   │   └── campers.api.ts
│   │   └── schemas/
│   │       └── camper.schemas.ts
│   │
│   ├── applications/
│   │   ├── components/
│   │   │   ├── ApplicationCard.tsx
│   │   │   ├── ApplicationForm.tsx
│   │   │   ├── ApplicationTimeline.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── SignatureCanvas.tsx
│   │   │   └── ReviewPanel.tsx
│   │   ├── pages/
│   │   │   ├── ApplicationsListPage.tsx
│   │   │   ├── ApplicationDetailPage.tsx
│   │   │   ├── CreateApplicationPage.tsx
│   │   │   └── ReviewApplicationPage.tsx
│   │   ├── hooks/
│   │   │   ├── useApplications.ts
│   │   │   └── useAutoSave.ts
│   │   ├── store/
│   │   │   └── applicationsSlice.ts
│   │   ├── api/
│   │   │   └── applications.api.ts
│   │   └── schemas/
│   │       └── application.schemas.ts
│   │
│   ├── medical/
│   │   ├── components/
│   │   │   ├── MedicalRecordForm.tsx
│   │   │   ├── AllergyManager.tsx
│   │   │   ├── MedicationManager.tsx
│   │   │   └── EmergencyContactForm.tsx
│   │   ├── pages/
│   │   │   ├── MedicalRecordPage.tsx
│   │   │   └── MedicalProviderLinkPage.tsx
│   │   ├── hooks/
│   │   │   └── useMedical.ts
│   │   ├── store/
│   │   │   └── medicalSlice.ts
│   │   ├── api/
│   │   │   └── medical.api.ts
│   │   └── schemas/
│   │       └── medical.schemas.ts
│   │
│   ├── documents/
│   │   ├── components/
│   │   │   ├── FileDropzone.tsx
│   │   │   ├── DocumentList.tsx
│   │   │   ├── UploadProgress.tsx
│   │   │   └── ScanStatusIndicator.tsx
│   │   ├── pages/
│   │   │   └── DocumentsPage.tsx
│   │   ├── hooks/
│   │   │   └── useFileUpload.ts
│   │   ├── store/
│   │   │   └── documentsSlice.ts
│   │   └── api/
│   │       └── documents.api.ts
│   │
│   ├── inbox/
│   │   ├── components/
│   │   │   ├── ConversationList.tsx
│   │   │   ├── ConversationListItem.tsx
│   │   │   ├── MessageThread.tsx
│   │   │   ├── MessageItem.tsx
│   │   │   ├── MessageComposer.tsx
│   │   │   └── UnreadBadge.tsx
│   │   ├── pages/
│   │   │   └── InboxPage.tsx
│   │   ├── hooks/
│   │   │   ├── useInbox.ts
│   │   │   └── useInboxPolling.ts
│   │   ├── store/
│   │   │   ├── conversationSlice.ts
│   │   │   └── messageSlice.ts
│   │   ├── api/
│   │   │   └── inbox.api.ts
│   │   ├── schemas/
│   │   │   └── inbox.schemas.ts
│   │   └── types/
│   │       └── inbox.types.ts
│   │
│   ├── notifications/
│   │   ├── components/
│   │   │   ├── NotificationPanel.tsx
│   │   │   └── NotificationItem.tsx
│   │   ├── hooks/
│   │   │   └── useNotificationPolling.ts
│   │   ├── store/
│   │   │   └── notificationsSlice.ts
│   │   └── api/
│   │       └── notifications.api.ts
│   │
│   ├── settings/
│   │   ├── components/
│   │   │   ├── SettingsPanel.tsx
│   │   │   ├── AppearanceSettings.tsx
│   │   │   ├── AccessibilitySettings.tsx
│   │   │   ├── NotificationSettings.tsx
│   │   │   ├── SecuritySettings.tsx
│   │   │   ├── PrivacySettings.tsx
│   │   │   └── AccountSettings.tsx
│   │   ├── pages/
│   │   │   └── SettingsPage.tsx
│   │   ├── hooks/
│   │   │   └── useSettings.ts
│   │   └── store/
│   │       └── settingsSlice.ts
│   │
│   ├── admin/
│   │   ├── components/
│   │   │   ├── CampManager.tsx
│   │   │   ├── SessionManager.tsx
│   │   │   ├── UserManager.tsx
│   │   │   └── ReportViewer.tsx
│   │   ├── pages/
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AdminCampsPage.tsx
│   │   │   ├── AdminSessionsPage.tsx
│   │   │   ├── AdminUsersPage.tsx
│   │   │   └── AdminReportsPage.tsx
│   │   ├── hooks/
│   │   │   └── useAdmin.ts
│   │   ├── store/
│   │   │   └── adminSlice.ts
│   │   └── api/
│   │       ├── camps.api.ts
│   │       └── reports.api.ts
│   │
│   └── medical-provider/          # External medical provider link flow
│       ├── components/
│       │   ├── ProviderLinkForm.tsx
│       │   └── ProviderLinkExpired.tsx
│       └── pages/
│           └── MedicalProviderLinkPage.tsx
│
├── hooks/                         # Shared custom hooks
│   ├── usePermissions.ts          # Role-based permission helper
│   ├── useOnlineStatus.ts         # Network connectivity detection
│   ├── useDebounce.ts             # Input debouncing
│   ├── useLocalStorage.ts         # Non-PHI local storage (settings only)
│   ├── usePagination.ts           # Pagination state
│   ├── useConfirmDialog.ts        # Imperative confirm dialog
│   └── useTheme.ts                # Theme management
│
├── router/
│   ├── index.tsx                  # Router configuration
│   ├── routes.ts                  # Route constants
│   ├── ProtectedRoute.tsx         # Auth + role guard HOC
│   └── PublicRoute.tsx            # Redirect authenticated users
│
├── store/
│   ├── index.ts                   # Store configuration
│   ├── hooks.ts                   # Typed useAppSelector / useAppDispatch
│   ├── rootReducer.ts             # Combined reducers
│   └── middleware/
│       ├── phiProtection.ts       # Middleware: block PHI from persistence
│       └── correlationId.ts       # Middleware: attach X-Request-ID
│
├── types/                         # Shared TypeScript types
│   ├── api.types.ts               # Common API response envelopes
│   ├── user.types.ts
│   ├── camper.types.ts
│   ├── application.types.ts
│   ├── medical.types.ts
│   ├── document.types.ts
│   ├── notification.types.ts
│   ├── camp.types.ts
│   └── settings.types.ts
│
├── utils/
│   ├── errorHandler.ts            # Global HTTP error handler
│   ├── phiSanitizer.ts            # Strip PHI from logs / error reports
│   ├── retryWithBackoff.ts        # Exponential backoff utility
│   ├── formatters.ts              # Date, phone, size formatters
│   ├── validators.ts              # Shared validation helpers
│   ├── correlationId.ts           # X-Request-ID generator
│   └── cacheManager.ts            # Redux cache TTL manager
│
├── constants/
│   ├── roles.ts                   # Role name constants
│   ├── applicationStatus.ts       # Status constants and metadata
│   ├── routes.ts                  # Route path constants
│   └── api.ts                     # API configuration constants
│
├── App.tsx
└── main.tsx
```

### 3.2 Feature Module Contract

Every feature module must expose the following internal contract:

```
features/{feature}/
├── components/          # Presentational and smart components
├── pages/               # Route-level container components
├── hooks/               # Feature-specific custom hooks
├── store/               # Redux slice(s)
├── api/                 # API service class
├── schemas/             # Zod validation schemas
└── types/               # Feature-specific TypeScript types (if complex)
```

**Isolation Rules:**
- A feature may import from `components/`, `hooks/`, `types/`, `utils/`, `constants/`, and `store/`.
- A feature must never import directly from another feature's internals.
- Cross-feature data communication flows exclusively through the Redux store.
- Cross-feature navigation uses route constants from `constants/routes.ts`.

---

## 4. State Management Architecture

### 4.1 State Taxonomy

| State Type | Description | Solution | PHI Allowed |
|------------|-------------|----------|-------------|
| Authentication State | Token, user identity, MFA status, session expiry | Redux (authSlice) | No |
| Server State (non-PHI) | Camps, sessions, roles | Redux (cacheManager TTL) | N/A |
| Server State (PHI) | Campers, medical records, applications | Redux (no persistence, TTL: 0) | Yes (memory only) |
| UI State | Modals, sidebars, loading flags | Redux (uiSlice) | No |
| Form State | Draft inputs, validation | React Hook Form (local) | No |
| Settings State | Theme, accessibility, preferences | Redux (settingsSlice, persisted via non-PHI localStorage) | No |
| Notification State | Inbox count, notification items | Redux (notificationsSlice) | No |

### 4.2 Redux Store Configuration

```
store/
├── authSlice          (token, user, mfaVerified, sessionExpiry)
├── campersSlice        (items[], loading, error, lastFetched)
├── applicationsSlice   (items[], currentApplication, loading, error, lastFetched)
├── medicalSlice        (records{}, allergies{}, medications{}, emergencyContacts{})
├── documentsSlice      (items[], uploadQueue[], loading)
├── conversationSlice   (conversations[], loading, unreadCount)
├── messageSlice        (messagesByConversation{}, sending, loading)
├── notificationsSlice  (items[], unreadCount, lastFetched)
├── campsSlice          (camps[], sessions[], loading, lastFetched)
├── settingsSlice       (theme, animations, reducedMotion, fontSize, etc.)
├── uiSlice             (modals{}, sidebar, breadcrumbs)
└── adminSlice          (users[], reports{}, loading)
```

### 4.3 PHI Cache Management Policy

PHI data (campers, medical records, allergies, medications, emergency contacts, applications) follows a zero-persistence policy:

- Redux Persist is disabled for all PHI slices.
- On logout, `clearAuth()` dispatches alongside `clearAllPHI()`, which zeroes all PHI slices.
- No PHI slice ever sets a `lastFetched` TTL greater than the session lifetime (60 minutes).
- A custom Redux middleware (`phiProtection.ts`) intercepts all actions and throws in development if PHI appears in a persistence action.

### 4.4 Cache Invalidation Strategy (Non-PHI)

```typescript
// utils/cacheManager.ts
const CACHE_TTL: Record<string, number> = {
  camps:    30 * 60 * 1000,   // 30 minutes — camps change infrequently
  sessions: 15 * 60 * 1000,   // 15 minutes — sessions change occasionally
  roles:    60 * 60 * 1000,   // 60 minutes — roles are static
};

export function isCacheStale(sliceName: string, lastFetched: number | null): boolean {
  if (!lastFetched) return true;
  const ttl = CACHE_TTL[sliceName] ?? 5 * 60 * 1000;
  return Date.now() - lastFetched > ttl;
}
```

---

## 5. Routing & Access Control

### 5.1 Route Map

| Path | Component | Guard | Roles |
|------|-----------|-------|-------|
| `/login` | `LoginPage` | Public (redirect if authed) | None |
| `/register` | `RegisterPage` | Public | None |
| `/forgot-password` | `ForgotPasswordPage` | Public | None |
| `/reset-password` | `ResetPasswordPage` | Public | None |
| `/mfa/setup` | `MFASetupPage` | Authenticated, no MFA required | Any authed |
| `/mfa/verify` | `MFAVerifyPage` | Authenticated, no MFA required | Any authed |
| `/medical-link/:token` | `MedicalProviderLinkPage` | Public (token-gated) | None |
| `/dashboard` | `DashboardPage` | Authenticated + MFA | Any |
| `/campers` | `CampersListPage` | Authenticated + MFA | Admin, Parent |
| `/campers/new` | `CreateCamperPage` | Authenticated + MFA | Admin, Parent |
| `/campers/:id` | `CamperDetailPage` | Authenticated + MFA + ownership | Admin, Parent |
| `/applications` | `ApplicationsListPage` | Authenticated + MFA | Admin, Parent |
| `/applications/new` | `CreateApplicationPage` | Authenticated + MFA | Admin, Parent |
| `/applications/:id` | `ApplicationDetailPage` | Authenticated + MFA + ownership | Admin, Parent |
| `/medical/:camperId` | `MedicalRecordPage` | Authenticated + MFA | Admin, Medical |
| `/documents` | `DocumentsPage` | Authenticated + MFA | Admin, Parent |
| `/inbox` | `InboxPage` | Authenticated + MFA | Any |
| `/notifications` | `NotificationsPage` | Authenticated + MFA | Any |
| `/settings` | `SettingsPage` | Authenticated + MFA | Any |
| `/admin` | `AdminDashboard` | Authenticated + MFA | Admin only |
| `/admin/camps` | `AdminCampsPage` | Authenticated + MFA | Admin only |
| `/admin/sessions` | `AdminSessionsPage` | Authenticated + MFA | Admin only |
| `/admin/users` | `AdminUsersPage` | Authenticated + MFA | Admin only |
| `/admin/reports` | `AdminReportsPage` | Authenticated + MFA | Admin only |
| `/forbidden` | `ForbiddenPage` | None | N/A |
| `*` | `NotFoundPage` | None | N/A |

### 5.2 Route Guard Implementation

```
User navigates to /campers
        │
        ▼
  isAuthenticated?
  ─────┬──────────────────
  No   │ Yes
  ▼    │
Redirect ▼
/login  mfaVerified?
        ──────────────────
        No   │ Yes
        ▼    │
     Redirect ▼
    /mfa/  hasRole(allowedRoles)?
    verify ───────────────────
           No   │ Yes
           ▼    │
       Redirect ▼
      /forbidden  ownershipCheck?
                  ──────────────
                  Fail │ Pass
                  ▼    │
              403 / 404 ▼
                       Render Page
```

### 5.3 Lazy Loading Strategy

All route-level components are lazy-loaded via `React.lazy()` wrapped in `<Suspense>`. The loading fallback is a full-page skeleton matched to the target page's layout to prevent layout shift.

---

## 6. API Integration Layer

### 6.1 Axios Configuration

The application maintains a single configured Axios instance. All API calls go through this instance, ensuring consistent headers, interceptors, and error handling.

```
api/axios.config.ts
├── Base URL: VITE_API_BASE_URL + /api
├── Timeout: 30,000ms (120,000ms for report endpoints)
├── Content-Type: application/json
├── Authorization: Bearer {token} (from Redux authSlice)
├── X-Request-ID: generated correlation ID
│
├── Request Interceptors:
│   ├── Inject Bearer token from Redux store
│   ├── Attach X-Request-ID correlation header
│   └── Version detection (getVersionedUrl)
│
└── Response Interceptors:
    ├── 401 → clearAuth() + redirect /login
    ├── 403 (lockout) → display lockout countdown
    ├── 429 → exponential backoff retry
    ├── 500/502/503 → Sentry capture + user toast
    ├── Deprecation header detection (dev warning)
    └── PHI sanitization before Sentry logging
```

### 6.2 API Service Pattern

Each feature exposes a static API service class:

```typescript
// features/{feature}/api/{feature}.api.ts
export class CampersAPI {
  private static readonly base = '/campers';

  static index(params?: CamperQueryParams): Promise<PaginatedResponse<Camper>> {
    return axiosInstance.get(this.base, { params });
  }
  static show(id: number): Promise<ApiResponse<Camper>> {
    return axiosInstance.get(`${this.base}/${id}`);
  }
  static store(data: CreateCamperDTO): Promise<ApiResponse<Camper>> {
    return axiosInstance.post(this.base, data);
  }
  static update(id: number, data: UpdateCamperDTO): Promise<ApiResponse<Camper>> {
    return axiosInstance.put(`${this.base}/${id}`, data);
  }
  static destroy(id: number): Promise<void> {
    return axiosInstance.delete(`${this.base}/${id}`);
  }
}
```

### 6.3 Pagination Contract

All paginated API responses conform to Laravel's pagination envelope:

```typescript
interface PaginatedResponse<T> {
  data: T[];
  links: { first: string; last: string; prev: string | null; next: string | null; };
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
  };
}
```

---

## 7. Authentication & Session Architecture

### 7.1 Token Lifecycle

```
                    POST /api/auth/login
                           │
                    ┌──────▼──────┐
                    │  Validate   │
                    │ credentials │
                    └──────┬──────┘
                           │
              ┌────────────▼────────────┐
              │     MFA Required?       │
              │   mfa_enabled: true     │
              └────┬───────────────┬────┘
              No   │               │ Yes
                   ▼               ▼
              Issue token    Require mfa_code
                   │         in same request
                   ▼               │
          ┌────────────────┐       │
          │ Store in Redux  ◄───────┘
          │ authSlice.token │
          │ (memory only)   │
          └───────┬─────────┘
                  │
           ┌──────▼──────────────────────────────┐
           │            Session Timer             │
           │                                      │
           │   t=0min    t=55min    t=60min        │
           │    │           │          │           │
           │   Start    Show modal  Force logout   │
           │  session   "Stay        if no        │
           │            logged in?"  action        │
           └──────────────────────────────────────┘
                  │
           On "Stay logged in":
           POST /api/auth/refresh-session
           Revoke old token → Issue new token
```

### 7.2 Token Storage Policy

| Location | PHI Risk | Token Storage | Rationale |
|----------|---------|--------------|-----------|
| Redux store (memory) | Low | YES | Cleared on tab close, no persistence |
| localStorage | High | NEVER | Survives tab close, accessible to JS |
| sessionStorage | Medium | NEVER | Feature parity risk with localStorage |
| Cookie (httpOnly) | Low | CSRF token only | Not accessible to JS |
| URL parameter | Critical | NEVER | Logged in server access logs |

### 7.3 Logout Sequence

```
1. User triggers logout (explicit, timeout, or 401)
2. POST /api/logout (revoke token on backend)
3. dispatch(clearAuth())          — clears token, user, session data
4. dispatch(clearAllPHI())        — zeros all PHI slices
5. dispatch(resetUI())            — clears modal/navigation state
6. sessionStorage.clear()         — belt-and-suspenders clear
7. Redirect to /login             — with no state.from (prevent back navigation)
```

---

## 8. Design System & Component Architecture

### 8.1 Atomic Design Hierarchy

```
Atoms
├── Button (variant: primary | secondary | danger | ghost | outline)
├── Input (type: text | email | password | search | number)
├── Textarea
├── Checkbox
├── RadioButton
├── Select
├── Label
├── Badge (variant: status-based, severity-based)
├── Avatar
├── Spinner
├── Divider
└── Icon (via Lucide)

Molecules
├── FormField (Label + Input + ErrorMessage)
├── SearchBar (Input + Icon + debounce)
├── StatusBadge (Badge + ApplicationStatus)
├── FileDropzone (drag-and-drop + validation)
├── PasswordInput (Input + visibility toggle + strength meter)
├── DatePicker (Calendar + Input)
└── PhoneInput (Input + format mask)

Organisms
├── DataTable (sorting + pagination + selection + empty state)
├── Modal (GlassModal + animations + focus trap)
├── FormWizard (multi-step with progress)
├── SignatureCanvas (canvas-based digital signature)
├── ConversationThread (messages + composer)
├── NotificationPanel (dropdown list)
├── ApplicationTimeline (status history visualization)
└── UploadQueue (multi-file progress + cancel)
```

### 8.2 Component Standards

All components must:
- Accept a `className` prop for style extension (no hardcoded overrides)
- Define explicit TypeScript prop interfaces
- Include `aria-label` or associate with a visible label
- Handle loading, empty, and error states explicitly
- Be pure/memoized where render cost is measurable

### 8.3 Design Token System

All visual properties are expressed through CSS custom properties, derived from a single source of truth:

```css
/* assets/styles/globals.css */
:root {
  /* Color - Brand */
  --color-brand-50:  #f0f9ff;
  --color-brand-100: #e0f2fe;
  --color-brand-500: #0ea5e9;
  --color-brand-600: #0284c7;
  --color-brand-700: #0369a1;
  --color-brand-900: #0c4a6e;

  /* Color - Semantic */
  --color-success:  #10b981;
  --color-warning:  #f59e0b;
  --color-error:    #ef4444;
  --color-info:     #3b82f6;

  /* Typography */
  --font-display:  'Syne', system-ui;
  --font-body:     'Plus Jakarta Sans', sans-serif;
  --font-mono:     'JetBrains Mono', monospace;
  --font-size-base: 16px;

  /* Spacing */
  --space-form-gap:    1.5rem;
  --space-section-gap: 2.5rem;
  --space-page-pad:    2rem;

  /* Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.5rem;
  --radius-glass: 1.25rem;

  /* Glass Morphism */
  --glass-bg: rgba(255, 255, 255, 0.08);
  --glass-bg-hover: rgba(255, 255, 255, 0.12);
  --glass-border: rgba(255, 255, 255, 0.15);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  --glass-blur: blur(16px);
  --glass-blur-heavy: blur(32px);
  --glass-saturate: saturate(180%);

  /* Animation */
  --duration-fast:    150ms;
  --duration-base:    250ms;
  --duration-slow:    400ms;
  --duration-page:    500ms;
  --ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-smooth:      cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-exit:        cubic-bezier(0.55, 0, 1, 0.45);

  /* Shadow */
  --shadow-sm:   0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-md:   0 4px 12px rgba(0, 0, 0, 0.1);
  --shadow-lg:   0 8px 24px rgba(0, 0, 0, 0.12);
  --shadow-xl:   0 16px 48px rgba(0, 0, 0, 0.15);
  --shadow-glow: 0 0 24px rgba(14, 165, 233, 0.3);
}

/* Dark mode token overrides */
[data-theme="dark"] {
  --glass-bg: rgba(15, 23, 42, 0.5);
  --glass-bg-hover: rgba(15, 23, 42, 0.65);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
```

---

## 9. Visual Design Language

### 9.1 Design Philosophy

The Camp Burnt Gin interface merges the warmth of an outdoor/camp aesthetic with the precision and trust of a HIPAA-regulated medical system. The result is a design language that is professional without being clinical, vibrant without being distracting, and structured without being rigid.

**Core Visual Characteristics:**
- Generous whitespace and padding — no cramped layouts
- Layered depth through glassmorphism and subtle shadows
- Bold typography hierarchy that guides attention
- Purposeful color use — accent colors appear where action is required
- Smooth, physically-grounded motion that communicates state changes

### 9.2 Typography System

| Role | Font | Weight | Use Case |
|------|------|--------|----------|
| Display | Syne | 700–800 | Page headings, hero text, section titles |
| Body | Plus Jakarta Sans | 400–600 | Paragraphs, labels, UI text |
| Mono | JetBrains Mono | 400 | Code, IDs, tokens, timestamps |

**Type Scale:**

```
--text-xs:   0.75rem  / 1rem line-height
--text-sm:   0.875rem / 1.25rem
--text-base: 1rem     / 1.5rem
--text-lg:   1.125rem / 1.75rem
--text-xl:   1.25rem  / 1.75rem
--text-2xl:  1.5rem   / 2rem
--text-3xl:  1.875rem / 2.25rem
--text-4xl:  2.25rem  / 2.5rem
--text-5xl:  3rem     / 1
```

### 9.3 Glassmorphism System

Glass components are applied contextually — cards, modals, panels, and sidebars over background imagery or gradient fields.

**GlassCard Component:**
```
background: var(--glass-bg)
backdrop-filter: var(--glass-blur) var(--glass-saturate)
border: 1px solid var(--glass-border)
border-radius: var(--radius-glass)
box-shadow: var(--glass-shadow)
transition: background var(--duration-base) var(--ease-smooth)
```

**GlassCard Hover State:**
```
background: var(--glass-bg-hover)
box-shadow: var(--shadow-xl)
transform: translateY(-2px)
```

**Usage Rules:**
- Glass is the primary surface for content cards, dashboards, and modals
- Glass must always sit over a background layer (gradient, image, or pattern) to be visible
- Never apply glass to interactive form inputs — use solid surfaces for clarity
- PHI content panels use a slightly more opaque glass to subconsciously communicate sensitivity

### 9.4 Color Application Principles

| Color Usage | Token | Context |
|-------------|-------|---------|
| Primary actions | `--color-brand-600` | Primary buttons, links, active nav |
| Destructive actions | `--color-error` | Delete, reject, revoke |
| Success states | `--color-success` | Approved status, upload complete |
| Warning states | `--color-warning` | Waitlisted, session near capacity |
| Neutral surfaces | Tailwind gray scale | Backgrounds, borders, disabled |
| PHI indicators | Amber accent | Subtle amber tint on PHI containers |

### 9.5 Layout Grid

All page layouts follow a 12-column grid at desktop, collapsing to 4 columns at mobile:

```
Desktop:  12 columns, 24px gutter, 32px page margin
Tablet:   8 columns,  20px gutter, 24px page margin
Mobile:   4 columns,  16px gutter, 16px page margin
```

Sections within pages use a consistent vertical rhythm of `--space-section-gap` (2.5rem) between content blocks, with generous internal padding using `--space-page-pad` (2rem).

---

## 10. Motion & Animation System

### 10.1 Animation Principles

The animation system follows four principles: purposeful (every animation communicates state), physical (motion respects real-world physics via spring curves), respectful (reduced motion settings are honored), and fast (total animation budget per interaction is under 400ms).

### 10.2 Motion Hierarchy

```
Tier 1 — Instant (0–150ms):
  Hover states, focus rings, toggle states

Tier 2 — Quick (150–300ms):
  Button feedback, badge updates, tooltip appearance

Tier 3 — Considered (300–500ms):
  Modal open/close, page transitions, dropdown menus

Tier 4 — Cinematic (500ms+):
  Page-load sequences, onboarding screens, achievement moments
```

### 10.3 Page Transition System

Page transitions use a coordinated entry sequence:
1. Background gradient fades in (0ms delay, 300ms)
2. Navigation/header slides down (50ms delay, 350ms spring)
3. Page content fades up with slight vertical shift (100ms delay, 400ms spring)
4. Interactive elements stagger in (150ms + 50ms per element)

### 10.4 Motion Tokens

```typescript
// constants/motion.ts
export const MOTION = {
  spring: { type: 'spring', stiffness: 400, damping: 30 },
  springGentle: { type: 'spring', stiffness: 200, damping: 25 },
  smooth: { ease: [0.25, 0.46, 0.45, 0.94], duration: 0.25 },
  fast: { ease: [0.25, 0.46, 0.45, 0.94], duration: 0.15 },
  page: { ease: [0.25, 0.46, 0.45, 0.94], duration: 0.4 },
};

export const VARIANTS = {
  page: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0, transition: MOTION.page },
    exit: { opacity: 0, y: -8 },
  },
  card: {
    initial: { opacity: 0, y: 8, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1, transition: MOTION.spring },
  },
  modal: {
    initial: { opacity: 0, scale: 0.96, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0, transition: MOTION.springGentle },
    exit: { opacity: 0, scale: 0.97, y: 4 },
  },
  stagger: {
    animate: { transition: { staggerChildren: 0.06 } },
  },
  listItem: {
    initial: { opacity: 0, x: -8 },
    animate: { opacity: 1, x: 0, transition: MOTION.spring },
  },
};
```

### 10.5 Reduced Motion

The application reads `prefers-reduced-motion` and the user-controlled `reducedMotion` setting (Section 11) to disable non-essential animations:

```typescript
// hooks/useMotion.ts
export function useMotion() {
  const systemPrefers = useMediaQuery('(prefers-reduced-motion: reduce)');
  const userSetting = useAppSelector(s => s.settings.reducedMotion);
  return { reduce: systemPrefers || userSetting };
}
```

When `reduce` is true, all `motion/*` components receive `{ initial: false }` and duration overrides of 0ms.

---

## 11. Settings & User Preferences System

### 11.1 Settings Architecture

The Settings system is a first-class feature, not an afterthought. It provides users with meaningful, safe, and secure control over their experience. All settings are stored in the `settingsSlice` and persisted to a non-PHI dedicated localStorage key. Settings never contain user identity, health information, or authentication material.

### 11.2 Settings Categories

```
Settings
├── Appearance
│   ├── Theme (system | light | dark)
│   ├── Color Accent (6 preset accents)
│   ├── Font Size (small | default | large | x-large)
│   ├── Compact Mode (reduce padding/spacing)
│   └── Background Style (gradient | solid | subtle-pattern)
│
├── Motion & Accessibility
│   ├── Reduced Motion (true | false)
│   ├── Animation Speed (fast | normal | slow | off)
│   ├── High Contrast Mode (WCAG AAA)
│   ├── Focus Indicators (default | enhanced | maximum)
│   └── Screen Reader Optimized Mode
│
├── Notifications
│   ├── Email Notifications (true | false)
│   ├── In-App Notifications (true | false)
│   ├── Notification Sound (true | false)
│   ├── Notification Badge (true | false)
│   └── Polling Interval (30s | 60s | 120s | manual)
│
├── Privacy & Security
│   ├── Session Timeout Duration (warning at 50 | 55 | 58 minutes)
│   ├── Auto-lock Screen on Idle (true | false, HIPAA note shown)
│   ├── Blur PHI on Unfocus (true | false — blurs sensitive fields)
│   ├── Confirm Before Logout (true | false)
│   └── Show Login Activity (last login time, device, IP region)
│
├── Data & Display
│   ├── Items Per Page (10 | 15 | 25 | 50)
│   ├── Date Format (MM/DD/YYYY | YYYY-MM-DD | Relative)
│   ├── Time Format (12h | 24h)
│   └── Default Dashboard View (summary | list | grid)
│
└── Account
    ├── Change Name
    ├── Change Email
    ├── Change Password
    ├── MFA Management (enable | disable | regenerate backup codes)
    └── Active Sessions (view and revoke other sessions)
```

### 11.3 Settings Persistence Contract

```typescript
// store/slices/settingsSlice.ts
const SETTINGS_STORAGE_KEY = 'cbg_settings_v1';  // Non-PHI only

// Persisted settings (no PHI — safe for localStorage)
const persistedKeys: Array<keyof SettingsState> = [
  'theme', 'colorAccent', 'fontSize', 'compactMode',
  'reducedMotion', 'animationSpeed', 'highContrast',
  'notificationSound', 'itemsPerPage', 'dateFormat',
  'timeFormat', 'sessionWarningAt',
];

// Never persisted settings
const sessionOnlyKeys: Array<keyof SettingsState> = [
  'blurPHIOnUnfocus',  // security preference reset on login for awareness
  'lastLoginInfo',      // fetched fresh each session
];
```

### 11.4 Blur-PHI Feature

When `blurPHIOnUnfocus` is enabled, fields containing Protected Health Information apply a blur filter when the user's focus leaves the browser window or the field's containing panel:

```typescript
// hooks/usePhiBlur.ts
export function usePhiBlur() {
  const { blurPHIOnUnfocus } = useSettings();
  const [blurred, setBlurred] = useState(false);

  useEffect(() => {
    if (!blurPHIOnUnfocus) return;
    const handleBlur = () => setBlurred(true);
    const handleFocus = () => setBlurred(false);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => { /* cleanup */ };
  }, [blurPHIOnUnfocus]);

  return { blurred };
}
```

---

## 12. Security Architecture (Frontend)

### 12.1 Frontend Threat Model Summary

| ID | Threat | Risk Level | Primary Mitigation |
|----|--------|------------|-------------------|
| TM-01 | Token Theft | Low | Memory-only storage, CSP, HTTPS |
| TM-02 | XSS Injection | Very Low | React escaping, DOMPurify, CSP |
| TM-03 | CSRF | Very Low | Sanctum CSRF token, SameSite=Lax |
| TM-04 | Replay Attack | Low | HTTPS + token revocation on logout |
| TM-05 | PHI Leakage | Medium | Zero storage of PHI, log sanitization |
| TM-06 | Brute Force | Very Low | Rate limiting + lockout + MFA |
| TM-07 | Rate Limit Abuse | Low | Exponential backoff, request debounce |
| TM-08 | Medical Link Misuse | Medium | 72h expiry + single-use + audit log |
| TM-09 | Client Storage Exposure | Medium | Memory-only PHI, session clear |
| TM-10 | Session Fixation | Very Low | Token regeneration on every login |

### 12.2 Content Security Policy

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' https://api.sentry.io;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
```

### 12.3 PHI Protection Rules (Enforced)

- No PHI in localStorage, sessionStorage, cookies, or URL parameters
- No PHI in `console.log()` — stripped by ESLint rule and production build
- No PHI in Redux DevTools (disabled in production via env check)
- No PHI in Sentry error payloads — `phiSanitizer.ts` strips known PHI fields before capture
- All PHI requests include the `X-Request-ID` correlation header for audit trail
- Redux Persist is configured to exclude all PHI slices

### 12.4 Secure Code Practices

- `eval()` and `new Function()` are prohibited (ESLint `no-eval`)
- `dangerouslySetInnerHTML` requires a DOMPurify-sanitized value (ESLint custom rule)
- All file downloads go through backend-authenticated endpoints, never direct URLs
- External links use `rel="noopener noreferrer"`
- Form submissions include idempotency keys for critical operations

---

## 13. Performance Architecture

### 13.1 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Largest Contentful Paint (LCP) | < 2.5s | Lighthouse |
| First Input Delay (FID) | < 100ms | Web Vitals |
| Cumulative Layout Shift (CLS) | < 0.1 | Lighthouse |
| Time to Interactive (TTI) | < 3.5s | Lighthouse |
| Lighthouse Score | > 90 | Lighthouse |
| Initial Bundle (main chunk) | < 300 KB gzipped | Vite build |
| API Response (p95) | < 500ms | Monitoring |
| Page Load (3G) | < 5s | Throttled test |

### 13.2 Code Splitting Strategy

All routes are lazy-loaded. Additionally, large feature modules (medical records, reports, admin dashboard) are split into dedicated async chunks. The shadcn/ui component library and recharts are split into a `vendors` chunk.

### 13.3 Image Optimization

All images use `<img loading="lazy" decoding="async" />`. SVG assets are inlined where they serve as icons. User-uploaded document thumbnails are served via the backend's signed URLs with appropriate cache headers.

### 13.4 Request Optimization

- Axios request deduplication: identical requests within 100ms are coalesced
- Pagination: all list views default to 15 items per page (user-configurable to 50 max)
- Debounce: search inputs debounce at 300ms before triggering API calls
- Static data caching: camps and sessions cached in Redux with TTL per `cacheManager.ts`
- Optimistic UI updates for all mutation operations with rollback on failure

---

## 14. Error Handling & Resilience

### 14.1 Error Handling Layers

```
Layer 1 — Axios Interceptors
  401 → session clear + redirect
  403 → role denial message
  422 → field-level validation errors
  429 → countdown timer + backoff
  500+ → Sentry capture + user toast

Layer 2 — Redux AsyncThunk
  rejected → slice error state → component error UI

Layer 3 — React Error Boundary
  Uncaught render errors → fallback UI + Sentry

Layer 4 — Form Validation (Zod)
  Field-level, before submission

Layer 5 — Network Detection
  offline → OfflineBanner + queue draft saves
```

### 14.2 Retry Strategy

```
Retryable:   5xx errors, 429 (after countdown), network timeout
Non-Retry:   4xx errors (except 429), auth errors

Backoff:     delay = initialDelay × 2^attempt
Initial:     1000ms
Max retries: 3
Max delay:   10,000ms
```

### 14.3 Draft Auto-Save Resilience

Application drafts auto-save every 30 seconds and also on `window.beforeunload`. If the network is offline, the save is queued and retried on reconnection with exponential backoff. A visible "Last saved" timestamp and "Save failed" indicator provide user feedback.

---

## 15. Observability & Monitoring

### 15.1 Structured Logging

All frontend log events are structured as JSON with PHI stripped:

```typescript
interface LogEvent {
  correlationId: string;    // X-Request-ID
  timestamp: string;        // ISO 8601
  level: 'info' | 'warn' | 'error';
  component: string;        // Component or slice name
  action: string;           // What happened
  userId?: number;          // Never email or name
  roleId?: number;
  duration?: number;        // For performance events
  // PHI NEVER appears here
}
```

### 15.2 Sentry Configuration

Sentry is configured with PHI masking as a `beforeSend` hook, sampling at 20% for performance events and 100% for errors. Session replay is disabled for HIPAA compliance. All error events are tagged with `correlationId`, `userId` (numeric only), and `roleId`.

### 15.3 Alert Severity

| Severity | Condition | Response |
|----------|-----------|----------|
| P0 Critical | Error rate > 50% for 5 min, complete outage | Immediate page on-call |
| P1 High | Error rate > 5% for 10 min, API down | Email + Slack < 30 min |
| P2 Medium | API p95 > 2s for 15 min, session timeout spike | Slack < 2 hours |
| P3 Low | Deprecation warnings, minor issues | Ticket creation |

---

## 16. Testing Architecture

### 16.1 Testing Pyramid

```
E2E Tests (Playwright)          — 20% of test suite
  Complete user flows
  Multi-browser validation
  Network resilience tests

Integration Tests (RTL)         — 30% of test suite
  Feature-level flows
  Redux integration
  API mock scenarios

Unit Tests (Vitest)             — 50% of test suite
  Custom hooks
  Utility functions
  Redux slices
  Zod schemas
```

### 16.2 Coverage Targets

| Layer | Target | Mandatory |
|-------|--------|-----------|
| Custom Hooks | 90% | Yes |
| Utility Functions | 95% | Yes |
| Redux Slices | 85% | Yes |
| Zod Schemas | 90% | Yes |
| Components (interaction) | 75% | Yes |
| E2E Critical Paths | 100% | Yes |

### 16.3 Mandatory E2E Scenarios

- Register → Login → MFA setup → Dashboard
- Create child participant → Create application → Sign → Submit
- Admin review → Approve application → Notification received
- Document upload → Scan status polling
- Session timeout → Warning modal → Stay logged in
- Session timeout → Force logout → PHI cleared
- Offline detection → Draft queued → Reconnect → Draft saved

---

## 17. Accessibility Architecture

### 17.1 WCAG 2.1 AA Requirements

| Criterion | Requirement |
|-----------|-------------|
| 1.4.3 Contrast | 4.5:1 minimum for normal text, 3:1 for large text |
| 1.4.11 Non-text Contrast | 3:1 for UI components and focus indicators |
| 2.1.1 Keyboard | All interactive elements keyboard accessible |
| 2.4.3 Focus Order | Logical focus order, no focus traps except modals |
| 2.4.7 Focus Visible | Focus indicator always visible |
| 3.3.1 Error Identification | Errors identified in text, not color alone |
| 3.3.2 Labels | All form inputs have programmatic labels |
| 4.1.2 Name/Role/Value | All custom widgets have ARIA name, role, value |

### 17.2 Automated Enforcement

- `eslint-plugin-jsx-a11y` runs on every commit
- `axe-core` runs in CI against all pages
- Storybook accessibility addon required for component library development
- Color contrast checked at design token level

---

## 18. Build & Deployment Architecture

### 18.1 Environment Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `https://api.campburntgin.org` |
| `VITE_API_VERSION` | API version prefix | `v1` |
| `VITE_SENTRY_DSN` | Sentry error tracking | `https://...@sentry.io/...` |
| `VITE_ENVIRONMENT` | Environment name | `production` |
| `VITE_ENABLE_DEVTOOLS` | Enable Redux DevTools | `false` in production |

### 18.2 Build Pipeline

```
Source → ESLint → TypeScript check → Vitest → Vite Build
         ↓ fail      ↓ fail           ↓ fail    ↓ success
      Block CI    Block CI          Block CI    Bundle analysis
                                                → Playwright E2E
                                                → Deploy to staging
                                                → Smoke test
                                                → Deploy to production
```

### 18.3 Bundle Size Governance

| Chunk | Max Size (gzipped) | Enforcement |
|-------|------------------|-------------|
| Main (App entry) | 100 KB | Vite build warning |
| Vendor (React, RTK, Router) | 150 KB | Bundle analyzer audit |
| Feature module (each) | 50 KB | Code review |
| Total initial load | 300 KB | Lighthouse CI |

---

## 19. Architectural Decision Records

### ADR-001: Redux Toolkit over TanStack Query

**Status:** Accepted
**Decision:** Use Redux Toolkit exclusively for all state management, including server state.
**Rationale:** HIPAA compliance requires explicit control over PHI persistence. Redux Toolkit's zero-persistence model is simpler to audit than TanStack Query's per-query `gcTime: 0` configuration. Single state paradigm reduces cognitive overhead. Score: RTK 7.85 vs TQ 7.70 (weighted compliance-first matrix).
**Revisit Condition:** If real-time collaboration features requiring background synchronization are added.

### ADR-002: Vite over Create React App

**Status:** Accepted
**Decision:** Use Vite as the build tool.
**Rationale:** Sub-100ms HMR, native ES module support, superior tree-shaking, and active maintenance trajectory.

### ADR-003: Feature-Driven Architecture (FDA)

**Status:** Accepted
**Decision:** Organize code by feature domain, not technical layer.
**Rationale:** Scales to 3× feature growth without structural refactoring. Reduces cross-feature coupling. Enables team parallelism on independent features.

### ADR-004: Glassmorphism as Primary Surface Language

**Status:** Accepted
**Decision:** GlassCard, GlassPanel, and GlassModal are the primary surface components.
**Rationale:** Conveys depth, modernity, and professionalism while allowing content to remain in focus. Supports both light and dark themes through CSS variable theming.

### ADR-005: Motion Library (Framer Motion / Motion) for Animations

**Status:** Accepted
**Decision:** Use the Motion library (formerly Framer Motion) for all animation needs.
**Rationale:** Layout animations, spring physics, gesture support, and AnimatePresence for exit animations are beyond CSS-only capabilities. `prefers-reduced-motion` support is first-class.

### ADR-006: Memory-Only Token Storage

**Status:** Accepted
**Decision:** Authentication tokens are stored exclusively in Redux store memory. No persistence layer.
**Rationale:** HIPAA requirement. localStorage/sessionStorage exposure risk to XSS and browser extensions is unacceptable for a regulated application. Users re-authenticate after page refresh as the security trade-off.

---

**Document Status:** Authoritative
**Maintained By:** Frontend Lead
**Review Cycle:** Quarterly or on major backend API changes
**Compliance Alignment:** HIPAA, RBAC, MFA, WCAG 2.1 AA
**Backend Reference:** Laravel 12.0 REST API — `/api` base path
