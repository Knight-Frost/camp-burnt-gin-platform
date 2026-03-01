# Frontend Architecture Considerations
## Camp Burnt Gin Application Software

**Document Type:** Technical Architecture Guidance — Planning Phase Reference
**Audience:** Frontend Development Team
**Purpose:** Define frontend architecture, UI flows, component design, security, state management
**Backend:** Laravel 12.0 REST API (see [API_REFERENCE.md](../backend/API_REFERENCE.md))
**Date:** February 2026
**Status:** Informational — Planning Reference

> **Note:** This document was produced during the architecture planning phase. The implementation has been completed. For the current system state, refer to [frontend/FRONTEND_GUIDE.md](../../frontend/FRONTEND_GUIDE.md). This document is preserved for traceability and academic reference.

---

## Document Alignment

Aligns with: SRS (Deliverable 2), Software Development & Design Document (Deliverable 3), Interview Documentation (Deliverable 1), Phase 1 Rubric (CSCI 475)

**Mandatory Requirements:**
- HIPAA compliance for PHI
- RBAC enforcement
- MFA requirement
- Mobile-first responsive design
- Modular, scalable architecture
- RTM alignment

---

## Terminology

| Term | Definition |
|------|------------|
| **Camp** | Organizational program entity (not session-specific) |
| **Camp Session** | Time-bound program with dates, capacity, age requirements |
| **Camper** | Child participant |
| **Parent/Guardian** | Legal guardian managing camper profiles |
| **Medical Provider** | Healthcare professional with PHI access |
| **Application** | Registration request linking camper to session |

**Critical:** "Camper management" = managing child records only (not administrative camp/session data)

---

## 1. Backend Overview

**Technology Stack:**

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Laravel 12.0 | API framework |
| Language | PHP 8.2+ | Server-side |
| Authentication | Sanctum 4.2 | Token auth |
| MFA | PragmaRX Google2FA 9.0 | TOTP |
| Database | MySQL 8.0+ | Persistence |
| Authorization | Policies + Middleware | RBAC |

**Characteristics:**
- Stateless (horizontal scalability)
- RESTful resources with standard HTTP verbs
- Service layer for complex logic
- Policy-based fine-grained access control
- Defense-in-depth security (TLS, Sanctum, MFA, Policies, Validation, Audit)

**API Standards:**
- Base: `/api`
- Auth: `Authorization: Bearer {token}`
- Format: `application/json`
- Pagination: Laravel format (15 items default)
- Rate Limiting: 5/min auth, 60/min general

**Completion Status:** 100% (114 requirements, 286 tests, 654 assertions)

---

## 2. Backend API Surface

**See:** [API_REFERENCE.md](../backend/API_REFERENCE.md) for complete endpoint documentation.

**Endpoint Summary:**

| Category | Endpoints | Key Features |
|----------|-----------|--------------|
| Authentication | 7 | Register, login, logout, password reset, MFA |
| User Profile | 3 | Profile CRUD, prefill data |
| MFA | 3 | Setup, verify, disable |
| Camps | 5 | CRUD camps |
| Sessions | 5 | CRUD sessions |
| Campers | 5 | CRUD campers |
| Applications | 7 | CRUD, review, sign, status workflow |
| Medical Records | 5 | CRUD with PHI audit logging |
| Allergies | 5 | CRUD |
| Medications | 5 | CRUD |
| Emergency Contacts | 5 | CRUD |
| Documents | 5 | Upload, download, virus scan status |
| Provider Links | 7 | Token-based external access |
| Notifications | 5 | List, mark read, delete |
| Inbox | 10 | HIPAA-compliant messaging |
| Reports | 4 | Admin reporting |

**Total:** 85 endpoints

---

## 3. Authentication & Session Architecture

### 3.1 Token Management Strategy

**Decision:** Memory-only token storage (Redux state, no persistence)

**Trade-offs:**

| Approach | Security | UX | Decision |
|----------|----------|-----|----------|
| localStorage | Low (XSS vulnerable) | High (persists) | ❌ Rejected |
| sessionStorage | Medium (XSS vulnerable) | Medium (tab-scoped) | ❌ Rejected |
| Memory (Redux) | High (cleared on refresh) | Low (re-login on refresh) | ✅ **Selected** |
| httpOnly cookie | Highest (XSS-proof) | High | ❌ Incompatible with SPA |

**Rationale:** HIPAA prioritizes security over convenience. Memory-only storage prevents XSS token theft.

### 3.2 Session Lifecycle

```
Login → Token issued (60min TTL) → Activity resets timer → 55min warning → 60min auto-logout
```

**Implementation Requirements:**
- Activity tracking: mousedown, keydown, scroll, touchstart
- Warning at 55 minutes
- Forced logout at 60 minutes
- State clearing on logout/expiration

### 3.3 MFA Flow

```
Login attempt → Password valid → MFA enabled?
  → Yes: Prompt TOTP → Verify → Issue token
  → No: Issue token immediately
```

**Setup Flow:**
```
User requests MFA → Backend generates secret → Display QR code → User scans → Verify test code → Enable MFA
```

### 3.4 Account Lockout Handling

| Attempt | Response |
|---------|----------|
| 1-4 | 401 with attempts remaining |
| 5 | 403 with 15min lockout |
| 6+ | 403 with progressive lockout (+10min each) |

**Frontend:** Display countdown timer, disable login button during lockout.

---

## 4. Role-Based Access Control (RBAC)

### 4.1 Role Hierarchy

```
Super Admin > Admin > Parent > Medical Provider
```

### 4.2 Permission Matrix

| Feature | Super Admin | Admin | Parent | Medical Provider |
|---------|-------------|-------|--------|------------------|
| Camp/Session CRUD | ✅ | ✅ | ❌ | ❌ |
| Application Review | ✅ | ✅ | ❌ | ❌ |
| View All Campers | ✅ | ✅ | Own only | All (read-only) |
| Medical Records | ✅ | ✅ | Own only | All (read-only) |
| Documents Upload | ✅ | ✅ | Own only | ❌ |
| Provider Links | ✅ | ✅ | Own only | ❌ |
| Reports | ✅ | ✅ | ❌ | ❌ |
| Inbox Conversations | ✅ | ✅ | With admins only | Cannot create |
| User Management | ✅ | Delegate only | ❌ | ❌ |

### 4.3 Frontend Implementation

**Route Guards:**
```typescript
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user || user.role.name !== 'admin') return <Navigate to="/unauthorized" />;
  return children;
};
```

**Conditional Rendering:**
```typescript
{user.role.name === 'admin' && <ApproveButton />}
{user.id === camper.parent_id && <EditButton />}
```

**Data Scoping:**
- Parents: Filter API responses to `parent_id === currentUser.id`
- Medical: Read-only access enforced by omitting mutation actions

---

## 5. Application Workflow

### 5.1 Status State Machine

```
                 ┌──────────┐
                 │ pending  │ (Draft saved, not submitted)
                 └────┬─────┘
                      │ submit()
                      ▼
             ┌────────────────┐
             │ under_review   │ (Admin reviewing)
             └────┬─────┬─────┘
                  │     │
        approve() │     │ reject()
                  ▼     ▼
          ┌─────────┐ ┌──────────┐
          │approved │ │ rejected │ (Final states)
          └─────────┘ └──────────┘
                │
                │ waitlist()
                ▼
          ┌───────────┐
          │waitlisted │
          └───────────┘
```

**State Transitions:**

| From | To | Actor | Conditions |
|------|----|-------|------------|
| pending | under_review | Parent | Application complete, signed |
| under_review | approved | Admin | Medical compliance verified |
| under_review | rejected | Admin | None |
| under_review | waitlisted | Admin | None |
| approved | cancelled | Admin/Parent | Before session start |

**Immutability:** Approved/rejected applications cannot be edited (only cancelled).

### 5.2 Draft Auto-Save

**Decision:** Auto-save every 30 seconds

**Trade-offs:**

| Interval | Server Load | Data Loss Risk | Decision |
|----------|-------------|----------------|----------|
| 10s | High | Very Low | ❌ Too aggressive |
| 30s | Medium | Low | ✅ **Selected** |
| 60s | Low | Medium | ❌ Too risky |

**Implementation:** Debounced PUT request on field change + interval save.

---

## 6. Data Models & State Design

### 6.1 State Management Decision Matrix

| Solution | Complexity | Boilerplate | DevTools | Performance | Decision |
|----------|------------|-------------|----------|-------------|----------|
| Context API | Low | Low | None | Medium | ❌ No time-travel |
| Redux Toolkit | Medium | Medium | Excellent | High | ✅ **Selected** |
| Zustand | Low | Very Low | Basic | High | ❌ Less mature |
| MobX | Medium | Low | Good | High | ❌ Learning curve |
| Recoil | Medium | Medium | Experimental | High | ❌ Meta-owned |

**Rationale:** Redux Toolkit provides mature ecosystem, excellent DevTools, strong TypeScript support, and predictable state management for complex RBAC/PHI handling.

### 6.2 State Slices

```
store/
├── slices/
│   ├── authSlice.ts        // User, token, MFA status
│   ├── campersSlice.ts     // Camper entities
│   ├── applicationsSlice.ts // Application entities
│   ├── sessionsSlice.ts    // Camp session data
│   ├── medicalSlice.ts     // Medical records (memory-only)
│   ├── documentsSlice.ts   // Document metadata
│   ├── notificationsSlice.ts // Notifications
│   └── inboxSlice.ts       // Inbox conversations/messages
```

**Normalization:** Use `@reduxjs/toolkit` `createEntityAdapter` for efficient lookups.

### 6.3 PHI Handling Rules

| Data Type | Storage Location | Persistence | Access Control |
|-----------|------------------|-------------|----------------|
| User profile | Redux auth slice | Memory only | Current user |
| Camper basic info | Redux campers slice | Memory only | Owned campers |
| Medical records | Redux medical slice | Memory only | RBAC enforced |
| Documents | Metadata in Redux | Memory only | Download via API |
| Applications | Redux applications slice | Memory only | RBAC enforced |

**Critical:** No PHI in localStorage, sessionStorage, cookies, or URLs.

---

## 7. Inbox Messaging

### 7.1 Architecture

**HIPAA Compliance Features:**
- Messages immutable (no edit)
- Soft delete preserves audit trail
- All operations logged
- Attachments encrypted at rest

### 7.2 Role Restrictions

| Action | Admin | Parent | Medical |
|--------|-------|--------|---------|
| Create conversation | Any participants | With admin only | ❌ Cannot create |
| Send message | ✅ | ✅ | ✅ (if participant) |
| Add participants | ✅ | ❌ | ❌ |
| Delete message | ✅ | ❌ | ❌ |

**Design Decision:** Parent-to-parent messaging disabled (must route through admin for supervision).

### 7.3 Read Receipt Pattern

```
GET /inbox/conversations/{id}/messages
→ Auto-marks messages as read (except sender's own)
→ Returns messages with read_at timestamps
```

**Idempotency:** Multiple reads don't create duplicate receipts.

---

## 8. File Upload & Document Handling

### 8.1 Upload Flow

```
Client validation → Upload to /api/documents → Virus scan → Verification → Available for download
```

### 8.2 Client Validation

| Rule | Value | Enforcement |
|------|-------|-------------|
| Max size | 10 MB | Client + server |
| Allowed types | PDF, JPEG, PNG, GIF, DOC, DOCX | MIME check |
| Max files | 5 per message | Client |

### 8.3 Document Types & Compliance

**Medical Documents:**
- physical_exam
- immunization_record
- medication_authorization
- allergy_action_plan

**Compliance Documents (CYSHCN):**
- seizure_management_plan (required for seizure diagnosis)
- gtube_feeding_plan (required for feeding tube)
- behavioral_support_plan (required for 1:1 supervision)

**Application Approval:** Admin cannot approve without required compliance documents verified and not expired.

---

## 9. Notifications

### 9.1 Notification Types

| Type | Trigger | Recipients |
|------|---------|------------|
| application_submitted | Parent submits | Admins |
| application_reviewed | Admin approves/rejects | Parent |
| document_uploaded | Parent uploads | Admins (if pending review) |
| inbox_message | Message sent | Conversation participants |
| provider_link_accessed | External provider accesses | Parent |
| session_reminder | 7 days before session | Parents with approved apps |

### 9.2 Display Strategy

**Decision:** Polling every 30 seconds (no WebSockets)

**Trade-offs:**

| Approach | Real-time | Complexity | Server Load | Decision |
|----------|-----------|------------|-------------|----------|
| Polling (30s) | Near real-time | Low | Medium | ✅ **Selected** |
| WebSockets | True real-time | High | High | ❌ Overkill for use case |
| Server-Sent Events | Real-time | Medium | Medium | ❌ Limited browser support |

**Rationale:** 30-second delay acceptable for camp application workflow. Avoids WebSocket connection management complexity.

---

## 10. Performance & Scalability

### 10.1 Performance Budget

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial Load (FCP) | < 1.5s | Lighthouse |
| Time to Interactive (TTI) | < 3s | Lighthouse |
| Largest Contentful Paint (LCP) | < 2.5s | Core Web Vitals |
| Cumulative Layout Shift (CLS) | < 0.1 | Core Web Vitals |
| API Response Time | < 500ms (p95) | Backend metrics |

### 10.2 Optimization Strategies

| Strategy | Implementation | Impact |
|----------|----------------|--------|
| Code Splitting | React.lazy() for routes | -60% initial bundle |
| Tree Shaking | ES6 imports, no default exports | -20% bundle size |
| Image Optimization | WebP with fallback, lazy loading | -70% image payload |
| API Caching | Cache camps/sessions (24h TTL) | -80% repeat requests |
| Pagination | 15 items/page | Prevent large payloads |
| Debouncing | Search inputs (300ms) | Reduce API calls |

### 10.3 Caching Strategy

| Data Type | Cache Duration | Invalidation |
|-----------|----------------|--------------|
| Camps | 24 hours | On camp CRUD |
| Sessions | 24 hours | On session CRUD |
| User profile | 1 hour | On profile update |
| Medical records | No cache | Always fresh |
| Applications | No cache | Real-time status |

---

## 11. Security & HIPAA Compliance

### 11.1 Threat Model Summary

| Threat | Severity | Mitigation | Residual Risk |
|--------|----------|------------|---------------|
| Token Theft (XSS) | High | Memory-only storage, CSP, HTTPS | Low |
| XSS Injection | High | React auto-escaping, DOMPurify | Very Low |
| CSRF | Medium | Sanctum tokens, SameSite cookies | Very Low |
| PHI Leakage | High | No client storage, no logs, no URLs | Medium |
| Brute Force | Medium | Rate limiting, lockout, MFA | Very Low |
| Medical Link Misuse | High | Time-limited, single-use, audit logging | Medium |

**Overall Risk Posture:** Acceptable for HIPAA-regulated production with documented compensating controls.

### 11.2 PHI Display Rules

| Data Type | List View | Detail View | Export |
|-----------|-----------|-------------|--------|
| Camper Name | Full | Full | Admin only |
| Date of Birth | MM/DD/YYYY | MM/DD/YYYY | Admin only |
| Medical Records | Count only | Full | No |
| Allergies | Count only | Full with severity | Admin, Medical |
| Medications | Count only | Full with dosage | Admin, Medical |

### 11.3 Security Checklist

- ✅ HTTPS enforced (TLS 1.2+)
- ✅ Token in memory only (Redux)
- ✅ No PHI in localStorage/sessionStorage/cookies
- ✅ No PHI in URL parameters
- ✅ Auto-logout at 60 minutes
- ✅ MFA required for all users
- ✅ React auto-escaping (XSS protection)
- ✅ Sanctum CSRF protection
- ✅ Content Security Policy headers
- ✅ Audit logging for PHI access
- ✅ Production: Redux DevTools disabled
- ✅ Production: Console logs stripped

---

## 12. Error Handling & Resilience

### 12.1 HTTP Status Handling

| Status | User Message | Action |
|--------|--------------|--------|
| 400 | "Invalid request. Please try again." | Display error |
| 401 | "Session expired. Please log in again." | Redirect to login |
| 403 | "You don't have permission for this action." | Display error |
| 404 | "The requested resource was not found." | Display error |
| 422 | Field-specific validation errors | Inline field errors |
| 429 | "Too many requests. Retry in X seconds." | Disable + countdown |
| 500 | "Server error. Please try again later." | Display error + retry |

### 12.2 Retry Strategy

| Error Type | Retry | Backoff | Max Attempts |
|------------|-------|---------|--------------|
| Network failure | Yes | Exponential (1s, 2s, 4s) | 3 |
| 500 Server Error | Yes | Exponential | 3 |
| 429 Rate Limit | Yes | Wait retry_after | 1 |
| 401/403 Auth | No | N/A | 0 (redirect) |
| 422 Validation | No | N/A | 0 (user fix) |

### 12.3 Offline Handling

**Decision:** No offline support

**Rationale:** HIPAA compliance requires real-time server validation and audit logging. Offline mode introduces sync complexity and compliance risk.

---

## 13. Recommended Frontend Architecture

### 13.1 Technology Stack

**Core Framework Decision Matrix:**

| Framework | Learning Curve | Performance | Ecosystem | TypeScript | Decision |
|-----------|---------------|-------------|-----------|------------|----------|
| React 18 | Medium | Excellent | Mature | Excellent | ✅ **Selected** |
| Vue 3 | Low | Excellent | Growing | Good | ❌ Smaller ecosystem |
| Angular 17 | High | Good | Mature | Native | ❌ Overhead for SPA |
| Svelte | Low | Excellent | Small | Good | ❌ Less mature |

**Rationale:** React provides mature ecosystem, strong community support, excellent TypeScript integration, and team familiarity.

**Recommended Stack:**

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React 18 | UI library |
| Language | TypeScript 5+ | Type safety |
| State | Redux Toolkit | State management |
| Routing | React Router 6 | Client-side routing |
| Forms | React Hook Form | Form management |
| Validation | Zod | Schema validation |
| HTTP | Axios | API client |
| UI Components | Tailwind CSS + Headless UI | Styling + accessibility |
| Build | Vite | Fast bundling |
| Testing | Vitest + React Testing Library | Unit/integration tests |

### 13.2 Project Structure

```
src/
├── api/                # API client configuration
│   ├── axiosConfig.ts  # Axios setup, interceptors
│   └── endpoints.ts    # API endpoint constants
├── components/         # Reusable components
│   ├── common/         # Generic UI components
│   ├── forms/          # Form components
│   └── layouts/        # Layout components
├── features/           # Feature-based modules
│   ├── auth/           # Authentication
│   ├── campers/        # Camper management
│   ├── applications/   # Application workflow
│   ├── medical/        # Medical records
│   ├── inbox/          # Messaging
│   └── admin/          # Admin features
├── hooks/              # Custom React hooks
├── store/              # Redux configuration
│   └── slices/         # Redux slices
├── types/              # TypeScript definitions
├── utils/              # Utility functions
└── App.tsx             # Root component
```

### 13.3 Component Design Principles

**Container/Presentational Pattern:**
- Container: Connects to Redux, handles logic
- Presentational: Pure, receives props, no side effects

**Composition over Props Drilling:**
- Use Context for theme, i18n
- Use Redux for global state (auth, entities)
- Props for local component communication

**Accessibility Requirements:**
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- ARIA labels for complex widgets

---

## 14. State Management Architecture

### 14.1 Redux Slice Design

**Slice Structure:**
```typescript
// slices/campersSlice.ts
import { createSlice, createEntityAdapter } from '@reduxjs/toolkit';

const campersAdapter = createEntityAdapter<Camper>();

const campersSlice = createSlice({
  name: 'campers',
  initialState: campersAdapter.getInitialState({
    loading: false,
    error: null
  }),
  reducers: {
    // Synchronous actions
  },
  extraReducers: (builder) => {
    // Async thunk handling
  }
});
```

**Normalized State:**
```typescript
{
  campers: {
    ids: [1, 2, 3],
    entities: {
      1: { id: 1, first_name: "Alice", ... },
      2: { id: 2, first_name: "Bob", ... },
      3: { id: 3, first_name: "Charlie", ... }
    },
    loading: false,
    error: null
  }
}
```

**Benefits:**
- O(1) lookups by ID
- Easy updates without array iteration
- Prevents duplicates

### 14.2 Async Thunk Pattern

```typescript
export const fetchCampers = createAsyncThunk(
  'campers/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/campers');
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);
```

**State Lifecycle:**
```
pending → loading: true, error: null
fulfilled → loading: false, add entities
rejected → loading: false, error: message
```

---

## 15. Routing & Navigation

### 15.1 Route Structure

```
/                       # Landing page
/login                  # Login form
/register               # Registration form
/mfa-setup              # MFA enrollment
/dashboard              # Role-based dashboard
/campers                # Camper list
/campers/:id            # Camper detail
/campers/:id/edit       # Camper edit
/applications           # Application list
/applications/:id       # Application detail
/medical-records/:id    # Medical record detail (RBAC)
/inbox                  # Inbox list
/inbox/:id              # Conversation view
/admin/camps            # Camp management (admin only)
/admin/sessions         # Session management (admin only)
/admin/reports          # Reports (admin only)
/provider/:token        # Medical provider external access
```

### 15.2 Route Guard Implementation

```typescript
// RequireAuth: Any authenticated user
// RequireRole: Specific role required
// RequireOwnership: Resource ownership check

<Route path="/campers/:id/edit" element={
  <RequireAuth>
    <RequireOwnership resource="camper">
      <CamperEditPage />
    </RequireOwnership>
  </RequireAuth>
} />

<Route path="/admin/camps" element={
  <RequireAuth>
    <RequireRole role="admin">
      <CampsPage />
    </RequireRole>
  </RequireAuth>
} />
```

---

## 16. Form Management

### 16.1 React Hook Form + Zod Integration

**Decision Rationale:**
- React Hook Form: Minimal re-renders, excellent performance
- Zod: TypeScript-first validation, type inference
- Combined: Type-safe forms with minimal boilerplate

**Example Pattern:**
```typescript
const camperSchema = z.object({
  first_name: z.string().min(1, "Required").max(255),
  last_name: z.string().min(1, "Required").max(255),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(["Male", "Female", "Other", "Prefer not to say"])
});

type CamperForm = z.infer<typeof camperSchema>;

const { register, handleSubmit, formState: { errors } } =
  useForm<CamperForm>({
    resolver: zodResolver(camperSchema)
  });
```

### 16.2 Server Validation Integration

**Pattern:** Client validates, server is source of truth

```typescript
try {
  await api.post('/campers', data);
} catch (error) {
  if (error.response.status === 422) {
    // Map server errors to form fields
    Object.entries(error.response.data.errors).forEach(([field, messages]) => {
      setError(field, { message: messages[0] });
    });
  }
}
```

---

## 17. Testing Strategy

### 17.1 Test Pyramid

```
      ┌─────────┐
      │   E2E   │  10% - Critical user flows
      └─────────┘
    ┌─────────────┐
    │ Integration │  30% - Feature interactions
    └─────────────┘
  ┌─────────────────┐
  │      Unit       │  60% - Individual components/functions
  └─────────────────┘
```

### 17.2 Testing Tools

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit | Vitest | Fast test runner |
| Component | React Testing Library | Component testing |
| Integration | React Testing Library + MSW | API mocking |
| E2E | Playwright | Browser automation |

### 17.3 What to Test

**Priority 1 (Critical):**
- Authentication flows
- Application submission workflow
- RBAC enforcement
- Medical record access control
- File upload validation

**Priority 2 (Important):**
- Form validation
- Error handling
- Navigation guards
- API error responses

**Priority 3 (Nice to have):**
- UI component snapshots
- Accessibility checks
- Performance benchmarks

---

## 18. Deployment & Build

### 18.1 Environment Configuration

| Environment | API Base URL | Features |
|-------------|--------------|----------|
| Development | `http://localhost:8000/api` | Redux DevTools enabled, verbose logging |
| Staging | `https://staging-api.campburntgin.org/api` | Redux DevTools enabled, moderate logging |
| Production | `https://api.campburntgin.org/api` | Redux DevTools disabled, minimal logging, error tracking |

### 18.2 Build Optimization

```bash
# Development
vite --mode development

# Production
vite build --mode production
```

**Production Build Checks:**
- Source maps disabled
- Console logs stripped
- Redux DevTools disabled
- Dead code eliminated
- Assets minified
- Gzip compression enabled

---

## 19. Accessibility Requirements

### 19.1 WCAG 2.1 AA Compliance

**Critical Requirements:**
- Keyboard navigation (tab order, focus states)
- Screen reader support (ARIA labels, semantic HTML)
- Color contrast ratios (4.5:1 minimum)
- Focus indicators (visible focus ring)
- Form labels (every input has associated label)
- Error identification (clear, programmatically associated)

### 19.2 ARIA Patterns

| Component | ARIA Pattern |
|-----------|--------------|
| Modal | role="dialog", aria-modal="true", focus trap |
| Dropdown | role="combobox", aria-expanded, aria-controls |
| Tabs | role="tablist", "tab", "tabpanel", aria-selected |
| Alerts | role="alert", aria-live="assertive" |
| Navigation | role="navigation", aria-label |

---

## 20. Identified Gaps & Recommendations

### 20.1 Missing Backend Features

| Feature | Impact | Priority | Workaround |
|---------|--------|----------|------------|
| WebSocket support | Real-time updates limited to polling | Low | 30s polling acceptable |
| Bulk operations | Manual iteration required | Medium | Client-side batching |
| Advanced search | Limited filtering | Medium | Client-side filtering |
| Data export | Reports only via API | Low | Manual download |

### 20.2 Frontend Implementation Priorities

**Phase 1 (MVP):**
1. Authentication + MFA
2. Camper management
3. Application submission
4. Medical records (basic CRUD)
5. Document upload

**Phase 2 (Enhancement):**
1. Inbox messaging
2. Notifications
3. Admin reporting
4. Medical provider links
5. Advanced workflows

**Phase 3 (Polish):**
1. Performance optimization
2. Accessibility audit
3. E2E testing
4. Analytics integration
5. Mobile app (React Native)

---

## 21. Development Checklist

**Setup:**
- [ ] Initialize React 18 + TypeScript + Vite project
- [ ] Configure Redux Toolkit with slices
- [ ] Set up React Router 6
- [ ] Configure Axios with interceptors
- [ ] Implement authentication flow
- [ ] Create route guards (RequireAuth, RequireRole)

**Core Features:**
- [ ] User registration + login + MFA
- [ ] Camper CRUD
- [ ] Application workflow (draft, submit, review)
- [ ] Medical records with RBAC
- [ ] Document upload/download
- [ ] Inbox messaging

**Security:**
- [ ] Memory-only token storage
- [ ] 60-minute session timeout
- [ ] No PHI in localStorage/URLs
- [ ] CSRF protection configured
- [ ] Content Security Policy headers

**Testing:**
- [ ] Unit tests for utilities/hooks
- [ ] Component tests for critical UI
- [ ] Integration tests for auth flow
- [ ] E2E tests for application submission
- [ ] Accessibility audit (axe-core)

**Performance:**
- [ ] Code splitting by route
- [ ] Image lazy loading
- [ ] API response caching
- [ ] Bundle size < 200KB (gzipped)
- [ ] Lighthouse score > 90

**Deployment:**
- [ ] Production build optimized
- [ ] Environment variables configured
- [ ] Error tracking (Sentry)
- [ ] Analytics (Google Analytics)
- [ ] CI/CD pipeline configured

---

**Document Version:** 2.0
**Last Updated:** February 2026
**Status:** Production-Ready Architecture
**Total Decisions Documented:** 47
**Critical Trade-offs:** 12
**Security Mitigations:** 10
