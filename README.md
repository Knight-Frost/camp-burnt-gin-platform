# Camp Burnt Gin — System Documentation

This repository contains the complete Camp Burnt Gin camp management system: a HIPAA-conscious, full-stack web application for managing camp registrations, medical records, internal communications, and administrative operations. The system is designed for the CYSHCN (Children and Youth with Special Health Care Needs) program.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Repository Structure](#3-repository-structure)
4. [User Roles](#4-user-roles)
5. [Portal Map](#5-portal-map)
6. [Quick Start](#6-quick-start)
7. [Key File Paths](#7-key-file-paths)
8. [Authentication](#8-authentication)
9. [Where to Look When Debugging](#9-where-to-look-when-debugging)
10. [Documentation Map](#10-documentation-map)
11. [Development Standards](#11-development-standards)
12. [Build Status](#12-build-status)

---

## 1. System Overview

Camp Burnt Gin provides four role-based portals for applicants (parents), administrators, medical staff, and super administrators. It replaces paper and email workflows with a structured, auditable, role-based platform. All medical data is handled in compliance with HIPAA technical safeguards.

### Core Capabilities

| Domain | Description |
|--------|-------------|
| Registration | Multi-section application form with auto-save, document uploads, and digital signatures |
| Medical Records | PHI-protected medical profiles with conditional logic and external provider access links |
| Inbox | Threaded messaging with rich text editor and floating compose |
| Administration | Application review, session management, camper management, and reporting |
| Audit Logging | Full audit trail for all administrative and PHI-access events |
| User Management | Role-based access control with super-admin governance interface |
| Form Builder | Dynamic application form management with versioned schema definitions |

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Laravel 12, PHP 8.2+, MySQL 8.0, Laravel Sanctum 4.2 |
| Frontend | React 18, TypeScript 5 (strict mode), Tailwind CSS 3, Vite 5 |
| State Management | Redux Toolkit 2 (in-memory; auth token persisted to sessionStorage manually) |
| Animation | Framer Motion 12 |
| Internationalization | i18next 25 (English and Spanish) |
| Testing | PHPUnit (backend), Vitest (frontend) |
| Package Manager | pnpm (frontend), Composer (backend) |

---

## 3. Repository Structure

```
Camp_Burnt_Gin_Project/
├── README.md                              # This file
├── BUG_TRACKER.md                         # Active issue tracking
├── backend/
│   └── camp-burnt-gin-api/                # Laravel 12 API
│       ├── app/                           # Controllers, services, models, policies
│       ├── database/                      # Migrations and seeders
│       ├── routes/                        # API route definitions (routes/api.php)
│       └── tests/                         # PHPUnit test suites
├── frontend/                              # React + TypeScript application
│   ├── FRONTEND_GUIDE.md                  # Canonical frontend developer reference
│   └── src/
│       ├── app/                           # Entry point and providers
│       ├── api/                           # Axios configuration and interceptors
│       ├── core/                          # Auth, routing, and role guards
│       ├── features/                      # Domain feature modules
│       ├── ui/                            # Portal layout shells and shared components
│       ├── shared/                        # Constants, types, hooks, utilities
│       ├── i18n/                          # Translation files (en.json, es.json)
│       └── assets/styles/                 # Design tokens and global CSS
├── docs/
│   ├── backend/                           # Backend reference documentation
│   ├── frontend/                          # Frontend reference documentation
│   └── decisions/                         # Architecture decisions
└── design/                                # Design assets
```

---

## 4. User Roles

| Role | Backend Slug | Who Uses It | Access Scope |
|------|-------------|-------------|--------------|
| Super Administrator | `super_admin` | System owners | All admin capabilities plus user management, role assignment, and audit log |
| Administrator | `admin` | Camp staff | All applications, campers, sessions, reports, and inbox |
| Medical Staff | `medical` | On-site nurses and clinicians | Medical records browser and treatment logging (read/write) |
| Applicant | `applicant` (or `parent`) | Parents and guardians | Own campers and applications only |

**Role inheritance:** `super_admin` inherits all `admin` privileges via the `isAdmin()` override. The last `super_admin` account cannot be deleted or demoted.

---

## 5. Portal Map

| Portal | URL Prefix | Role | Key Features |
|--------|-----------|------|--------------|
| Applicant | `/applicant` | `applicant` | Dashboard, application form, camper view, inbox, profile, documents, settings |
| Admin | `/admin` | `admin`, `super_admin` | Applications, campers, sessions, reports, calendar, announcements, inbox |
| Medical | `/medical` | `medical` | Dashboard, medical records browser, incidents, follow-ups, visits |
| Super Admin | `/super-admin` | `super_admin` | User management, audit log, form builder, all admin features |

The root path (`/`) redirects to `/login`. There is no public landing page.

---

## 6. Quick Start

### Backend

```bash
cd backend/camp-burnt-gin-api
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

> **Email verification:** All protected routes require a verified email address. New registrations must verify their email before they can access the app. In local development, set `MAIL_MAILER=log` in `.env` and retrieve the verification link from `storage/logs/laravel.log`. For Docker setups, use Mailhog at http://localhost:8025.

Full setup instructions: [docs/backend/SETUP.md](docs/backend/SETUP.md)

### Frontend

```bash
cd frontend
cp .env.example .env.local
# .env.example already sets VITE_API_BASE_URL=http://localhost:8000 — no edits needed for default local setup
pnpm install
pnpm run dev
# Application available at http://localhost:5173
```

Full development reference: [frontend/FRONTEND_GUIDE.md](frontend/FRONTEND_GUIDE.md)

---

## 7. Key File Paths

| Purpose | Path |
|---------|------|
| Frontend developer reference (canonical) | `frontend/FRONTEND_GUIDE.md` |
| Route definitions (frontend) | `frontend/src/core/routing/index.tsx` |
| Route path constants | `frontend/src/shared/constants/routes.ts` |
| Auth Redux slice | `frontend/src/features/auth/store/authSlice.ts` |
| Axios config (token injection, 401 handling) | `frontend/src/api/axios.config.ts` |
| Design tokens (CSS custom properties) | `frontend/src/assets/styles/design-tokens.css` |
| i18n English translations | `frontend/src/i18n/en.json` |
| i18n Spanish translations | `frontend/src/i18n/es.json` |
| API route definitions (backend) | `backend/camp-burnt-gin-api/routes/api.php` |
| Active bug log | `BUG_TRACKER.md` |

---

## 8. Authentication

### Token Lifecycle

Authentication uses Laravel Sanctum. Tokens are stored in `sessionStorage` (not `localStorage`) for per-tab isolation.

```
Login:    POST /auth/login → token returned → saved to sessionStorage + Redux
Request:  Axios reads Redux state.auth.token (sessionStorage fallback) → injects Authorization: Bearer header
Refresh:  page reload → useAuthInit reads sessionStorage → GET /user → restores Redux state
Logout:   POST /logout → sessionStorage cleared → Redux clearAuth() → redirect to /login
401:      Axios interceptor fires auth:unauthorized event → same as logout path
```

Tokens expire after 30 minutes of inactivity. Account lockout occurs after 5 failed login attempts (15-minute cooldown).

### MFA Flow

If a user has TOTP-based MFA enabled:

1. `POST /auth/login` returns `{ mfa_required: true }` — no token is issued yet.
2. The login page switches to the MFA code input step.
3. User enters the 6-digit authenticator code.
4. `POST /auth/login` is re-submitted with `{ email, password, mfa_code }`.
5. Server validates the TOTP code and issues the full authentication token.

---

## 9. Where to Look When Debugging

| Symptom | Where to Look |
|---------|---------------|
| Page shows 404 or nothing loads at a URL | `frontend/src/core/routing/index.tsx` — route may be missing or component path may be wrong |
| API call returns 401 (Unauthorized) | `frontend/src/api/axios.config.ts` (token injection), `backend/routes/api.php` (auth:sanctum middleware), `useAuthInit.ts` (session restore) |
| API call returns 403 (Forbidden) | Policy class for the resource (e.g., `AllergyPolicy.php`), route middleware in `routes/api.php` |
| API call returns 422 (Validation Failed) | Form Request class used by the controller — check `rules()` method |
| Field missing or undefined in UI | API Resource `toArray()` in `app/Http/Resources/`, TypeScript type in `features/<domain>/types/` |
| Notification or email not sending | Notification class `via()` method (gated by `notification_preferences`), queue worker status |
| Status badge shows wrong color | `frontend/src/ui/components/StatusBadge.tsx` — `variantConfig` entry for that status slug |
| Page flickers or shows stale content | Remove `setItems([])` before fetch; only clear when new data arrives |
| Auth state lost on page refresh | `useAuthInit.ts` must read from `sessionStorage`, not `localStorage` |
| i18n key shows as literal string | Key is missing from `frontend/src/i18n/en.json` — add to both `en.json` and `es.json` |
| Database column not found | Run `php artisan migrate` — a recent migration may not have been applied |
| N+1 query in a list endpoint | Controller must use `with()` eager loading; check the relationship chain |

---

## 10. Documentation Map

### Backend Reference

| Document | Purpose |
|----------|---------|
| [docs/backend/ARCHITECTURE.md](docs/backend/ARCHITECTURE.md) | Technical architecture, design patterns, system purpose, performance |
| [docs/backend/API_REFERENCE.md](docs/backend/API_REFERENCE.md) | Complete endpoint reference with request/response examples |
| [docs/backend/DATA_MODEL.md](docs/backend/DATA_MODEL.md) | Database schema, entity relationships, table reference |
| [docs/backend/AUTHENTICATION.md](docs/backend/AUTHENTICATION.md) | Auth mechanisms, token lifecycle, MFA, session management |
| [docs/backend/ROLES_AND_PERMISSIONS.md](docs/backend/ROLES_AND_PERMISSIONS.md) | RBAC system, role definitions, permission matrix |
| [docs/backend/SECURITY.md](docs/backend/SECURITY.md) | Security architecture, HIPAA compliance controls |
| [docs/backend/AUDIT_LOGGING.md](docs/backend/AUDIT_LOGGING.md) | PHI audit trail, event categories, log format |
| [docs/backend/BUSINESS_RULES.md](docs/backend/BUSINESS_RULES.md) | Application logic, validation rules, workflow constraints |
| [docs/backend/APPLICATION_WORKFLOWS.md](docs/backend/APPLICATION_WORKFLOWS.md) | Application lifecycle, status machine, admin review flow |
| [docs/backend/INBOX_SYSTEM.md](docs/backend/INBOX_SYSTEM.md) | Messaging architecture, participant model, immutability rules |
| [docs/backend/FILE_UPLOADS.md](docs/backend/FILE_UPLOADS.md) | Document upload security, MIME validation, scanning lifecycle |
| [docs/backend/ERROR_HANDLING.md](docs/backend/ERROR_HANDLING.md) | Error codes, HTTP status codes, error response format |
| [docs/backend/SETUP.md](docs/backend/SETUP.md) | Local development environment setup |
| [docs/backend/CONFIGURATION.md](docs/backend/CONFIGURATION.md) | Environment variables and configuration reference |
| [docs/backend/DEPLOYMENT.md](docs/backend/DEPLOYMENT.md) | Production deployment procedures and CI/CD pipeline |
| [docs/backend/TESTING.md](docs/backend/TESTING.md) | Testing strategy, test execution, database seeder guide |
| [docs/backend/TROUBLESHOOTING.md](docs/backend/TROUBLESHOOTING.md) | Common issues, diagnostics, solutions |
| [docs/backend/CONTRIBUTING.md](docs/backend/CONTRIBUTING.md) | Code standards, branching, PR guidelines, documentation rules |

### Frontend Reference

| Document | Purpose |
|----------|---------|
| [frontend/FRONTEND_GUIDE.md](frontend/FRONTEND_GUIDE.md) | Canonical frontend developer reference |
| [docs/frontend/OVERVIEW.md](docs/frontend/OVERVIEW.md) | Portal architecture, tech stack, security model, development tooling |
| [docs/frontend/DESIGN_SYSTEM.md](docs/frontend/DESIGN_SYSTEM.md) | Design tokens, color system, typography, animation standards |
| [docs/frontend/COMPONENT_GUIDE.md](docs/frontend/COMPONENT_GUIDE.md) | Shared UI component reference |

### Decisions and History

| Document | Purpose |
|----------|---------|
| [docs/decisions/ARCHITECTURE_DECISIONS.md](docs/decisions/ARCHITECTURE_DECISIONS.md) | Architectural Decision Records (ADRs) |

---

## 11. Development Standards

Full contributing guidelines are in [docs/backend/CONTRIBUTING.md](docs/backend/CONTRIBUTING.md). The non-negotiable rules are:

1. **PHI fields must use the `encrypted` cast** — never store medical data in plaintext.
2. **Authorize before processing** — call `$this->authorize()` in controllers before any service call.
3. **All user-facing strings must use i18next** — no hardcoded English strings in components.
4. **All colors via CSS custom properties** — never use hardcoded hex values; use `var(--token-name)`.
5. **New database tables require a seeder** — add a corresponding seeder class and register it in `DatabaseSeeder`.
6. **No business logic in controllers** — delegate to service classes.
7. **Run `php artisan test` before committing** — all 308 tests must pass.

---

## 12. Build Status

| Component | Status | Detail |
|-----------|--------|--------|
| Backend API | Complete | 308 passing tests, 0 known security vulnerabilities |
| Frontend application | Complete | All four portals fully implemented and wired to API |
| Authentication and MFA | Complete | Login, registration, TOTP MFA, password reset |
| Applicant portal | Complete | Dashboard, application form, camper view, inbox, profile, settings |
| Admin portal | Complete | Dashboard, applications, campers, sessions, reports, calendar, announcements, inbox |
| Medical portal | Complete | Dashboard, records browser, incidents, follow-ups, visits |
| Super Admin portal | Complete | Dashboard, user management, audit log, form builder |
| Messaging system | Complete | Two-panel inbox, floating compose, rich text editor |
| RBAC | Complete | Four roles enforced at route, middleware, and policy layers |
| i18n | Complete | English and Spanish translations |
| Type safety | Complete | TypeScript strict mode, 0 type errors |

---

**Document Status:** Authoritative
**Last Updated:** March 2026
**Version:** 3.0.0
