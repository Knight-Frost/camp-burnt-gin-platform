# Camp Burnt Gin — Frontend Overview

Production-grade, HIPAA-conscious frontend for the Camp Burnt Gin camp registration and management platform.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Getting Started](#3-getting-started)
4. [Portal Architecture](#4-portal-architecture)
5. [Key File Paths](#5-key-file-paths)
6. [Security Model](#6-security-model)
7. [Development Tooling](#7-development-tooling)

---

## 1. Project Overview

| Property | Value |
|----------|-------|
| Version | 1.0.0 |
| Backend API | Laravel 12 REST API |
| Compliance | HIPAA-conscious, WCAG 2.1 AA |
| Architecture | Feature-Driven Architecture (FDA) |
| Auth Strategy | Bearer token (Redux-persist, localStorage key: `auth_token`) |
| i18n | English and Spanish |

---

## 2. Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | 18.3 |
| Language | TypeScript (strict mode) | 5.7 |
| Build tool | Vite | 5.4 |
| State management | Redux Toolkit + redux-persist | 2.5 |
| Routing | React Router | 7.0 |
| Styling | Tailwind CSS | 3.4 |
| Animation | Framer Motion | 12.4 |
| Form validation | Zod + React Hook Form | 3.24 / 7.54 |
| HTTP client | Axios | 1.7 |
| i18n | i18next | 25 |
| Testing | Vitest | — |
| Package manager | pnpm | — |

---

## 3. Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Backend API running (see `docs/backend/SETUP.md`)

### Installation

```bash
cd frontend
pnpm install
```

### Development

```bash
# Copy environment file and set VITE_API_BASE_URL
cp .env.example .env.local

pnpm run dev
# Application available at http://localhost:5173
```

### Build

```bash
pnpm run build
```

### Type Checking

```bash
pnpm run type-check
```

### Testing

```bash
pnpm test run        # Run all Vitest tests
pnpm test            # Watch mode
```

---

## 4. Portal Architecture

The application serves four role-based portals, each with its own layout, navigation tree, and feature pages. The root path redirects to `/login`.

| Portal | URL Prefix | Role | Key Features |
|--------|-----------|------|--------------|
| Applicant | `/applicant` | `applicant` | Application form, camper view, inbox, profile |
| Admin | `/admin` | `admin`, `super_admin` | Applications, campers, sessions, reports, calendar, announcements, inbox |
| Medical | `/medical` | `medical` | Medical records browser |
| Super Admin | `/super-admin` | `super_admin` | User management, audit log, form templates, all admin features |

---

## 5. Key File Paths

| Purpose | Path |
|---------|------|
| Frontend dev reference (canonical) | `frontend/FRONTEND_GUIDE.md` |
| Design tokens | `frontend/src/assets/styles/design-tokens.css` |
| Routing | `frontend/src/core/routing/index.tsx` |
| Auth slice | `frontend/src/features/auth/store/authSlice.ts` |
| Axios config | `frontend/src/api/axios.config.ts` |
| ROUTES constants | `frontend/src/shared/constants/routes.ts` |
| i18n (English) | `frontend/src/i18n/en.json` |
| i18n (Spanish) | `frontend/src/i18n/es.json` |

---

## 6. Security Model

| Control | Implementation |
|---------|---------------|
| Token storage | localStorage via redux-persist (key: `auth_token`, persists across reloads) |
| Token expiration | 30 minutes (enforced by backend Sanctum configuration) |
| Mid-session 401 | Axios interceptor fires `auth:unauthorized` event → `clearAuth()` + redirect to `/login` |
| PHI in logs | `phiSanitizer.ts` strips 24 PHI fields before any console output; Redux DevTools middleware strips PHI |
| Role enforcement | Route middleware (backend), portal layout role checks (frontend) |
| Input validation | Zod schemas on all form submissions |

---

## Development Tooling

### VS Code Extensions

The following VS Code extensions are recommended for this project and are listed in `.vscode/extensions.json`. VS Code will prompt for installation upon project opening.

| Extension ID | Name | Purpose |
|-------------|------|---------|
| bradlc.vscode-tailwindcss | Tailwind CSS IntelliSense | Auto-completion and syntax highlighting for Tailwind classes |
| esbenp.prettier-vscode | Prettier | Code formatting |
| dbaeumer.vscode-eslint | ESLint | JavaScript/TypeScript linting |
| csstools.postcss | PostCSS Language Support | PostCSS syntax highlighting |
| usernamehm.errorlens | Error Lens | Inline error and warning display |
| streetsidesoftware.code-spell-checker | Code Spell Checker | Spelling verification |
| ms-playwright.playwright | Playwright Test | End-to-end test support |

### Accessibility Tooling

**Full Accessibility Audit:**
```bash
npm run a11y
```
Executes Lighthouse and axe-core audits. Generates `lighthouse-report.html` with detailed findings.

**Lighthouse Only:**
```bash
npm run a11y:lighthouse
```
Runs Lighthouse audit against preview server (http://localhost:4173). Requires prior build execution.

**axe-core Only:**
```bash
npm run a11y:axe
```
Runs axe accessibility checks. Requires preview server to be running.

**Development Server Quick Check:**
```bash
npm run a11y:dev
```
Runs axe-core against development server (http://localhost:5173). No build required.

### Performance Monitoring

**Bundle Analysis:**
```bash
npm run analyze
```
Builds the application and opens bundle visualization at `dist/stats.html`. Displays chunk sizes (gzipped and brotli), module dependencies, and largest modules.

**Performance Audit:**
```bash
npm run perf
```
Executes build, starts preview server, and runs Lighthouse performance audit. Generates comprehensive performance report.

### Pre-Commit Checklist

Execute before committing code:

```bash
npm run lint
npm run type-check
npm run test
```

### Pre-Release Checklist

Execute before production deployment:

1. Run full test suite
2. Execute accessibility audit (`npm run a11y`)
3. Execute performance audit (`npm run perf`)
4. Review Lighthouse report scores (accessibility minimum 90%, performance minimum 85%, best practices minimum 90%)

---

**Document Status:** Authoritative
**Last Updated:** March 2026
**Version:** 2.1.0
